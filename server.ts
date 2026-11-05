import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { BOLETIN_40_SEED, PERMISOS_POR_ROL, USUARIOS_DIRECTIVOS } from './src/data/seedNotiprofes40';
import {
  BloqueCalendarioOficial,
  BoletinSemanal,
  ConfiguracionCalendarioAnual,
  OperacionBoletin,
  PeriodoAcademicoConfig,
  PresenciaActiva,
  RolUsuario,
  UsuarioDirectivo,
} from './src/types/notiprofes';
import {
  aplicarOperacionBoletin,
  clonarBoletinSiguienteSemana,
  generarHtmlPublicoBoletin,
} from './src/utils/boletinLogic';
import {
  formatearFechaIsoATextoLargo,
  generarFestivosColombiaAnio,
  generarPlantillaCalendarioAnual,
} from './src/utils/calendarioEscolar2026';

// Configuración de almacenamiento persistente protegido para Docker / TrueNAS (/app/data)
function resolverDirectorioDatos(): string {
  const rutaPreferida = process.env.DATA_DIR || '/app/data';
  try {
    fs.mkdirSync(rutaPreferida, { recursive: true });
    fs.accessSync(rutaPreferida, fs.constants.W_OK);
    return rutaPreferida;
  } catch {
    const rutaLocal = path.resolve(process.cwd(), 'data');
    fs.mkdirSync(rutaLocal, { recursive: true });
    return rutaLocal;
  }
}

const DIRECTORIO_DATOS = resolverDirectorioDatos();
const ARCHIVO_DB = path.join(DIRECTORIO_DATOS, 'notiprofes-db.json');
const ARCHIVO_HTML_PUBLICO = path.join(DIRECTORIO_DATOS, 'notiprofes-publico.html');

interface EstadoAlmacenamiento {
  boletinActivoId: string;
  boletines: BoletinSemanal[];
}

function cargarBaseDatos(): EstadoAlmacenamiento {
  try {
    if (fs.existsSync(ARCHIVO_DB)) {
      const contenido = fs.readFileSync(ARCHIVO_DB, 'utf-8');
      const parsed = JSON.parse(contenido) as EstadoAlmacenamiento;
      if (parsed && Array.isArray(parsed.boletines) && parsed.boletines.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error al leer base de datos JSON, restaurando semilla inicial:', err);
  }

  const inicial: EstadoAlmacenamiento = {
    boletinActivoId: BOLETIN_40_SEED.id,
    boletines: [BOLETIN_40_SEED],
  };
  guardarBaseDatos(inicial);
  return inicial;
}

function guardarBaseDatos(estado: EstadoAlmacenamiento): void {
  try {
    fs.writeFileSync(ARCHIVO_DB, JSON.stringify(estado, null, 2), 'utf-8');
    const activo =
      estado.boletines.find((b) => b.id === estado.boletinActivoId) || estado.boletines[0];
    if (activo) {
      const htmlPublico = generarHtmlPublicoBoletin(
        sanitizarBoletinParaPublico(activo)
      );
      fs.writeFileSync(ARCHIVO_HTML_PUBLICO, htmlPublico, 'utf-8');
    }
  } catch (err) {
    console.error('Error al escribir en almacenamiento persistente:', err);
  }
}

function sanitizarBoletinParaPublico(boletin: BoletinSemanal): BoletinSemanal {
  if (boletin.mostrarSuspensionesPublico) {
    return boletin;
  }
  return {
    ...boletin,
    suspensiones: [],
  };
}

// Gestión de sesiones autenticadas en servidor (aislamiento de acceso directivo)
interface SesionActiva {
  token: string;
  usuario: UsuarioDirectivo;
  creadaEn: number;
}

const sesionesDirectivas = new Map<string, SesionActiva>();

// Claves de acceso individuales iniciales por usuario/rol
const ARCHIVO_CREDENCIALES = path.join(DIRECTORIO_DATOS, 'notiprofes-credenciales.json');
const PIN_INSTITUCIONAL = process.env.INSTITUTIONAL_PIN || '2026';

const PINS_DEFECTO: Record<string, string> = {
  'dir-rector': '1001',
  'dir-academica': '2002',
  'dir-convivencia': '3003',
  'dir-secretaria': '4004',
  'doc-colaborador': '5005',
};

function cargarCredenciales(): Record<string, string> {
  try {
    if (fs.existsSync(ARCHIVO_CREDENCIALES)) {
      const datos = JSON.parse(fs.readFileSync(ARCHIVO_CREDENCIALES, 'utf-8'));
      if (datos && typeof datos === 'object') {
        return { ...PINS_DEFECTO, ...datos };
      }
    }
  } catch (err) {
    console.error('Error al cargar credenciales de usuarios:', err);
  }
  return { ...PINS_DEFECTO };
}

const credencialesUsuarios = cargarCredenciales();

function guardarCredenciales(): void {
  try {
    fs.writeFileSync(ARCHIVO_CREDENCIALES, JSON.stringify(credencialesUsuarios, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error al guardar credenciales:', err);
  }
}

const ARCHIVO_USUARIOS_REGISTRADOS = path.join(DIRECTORIO_DATOS, 'notiprofes-usuarios.json');

function cargarUsuariosRegistrados(): UsuarioDirectivo[] {
  try {
    if (fs.existsSync(ARCHIVO_USUARIOS_REGISTRADOS)) {
      const datos = JSON.parse(fs.readFileSync(ARCHIVO_USUARIOS_REGISTRADOS, 'utf-8'));
      if (Array.isArray(datos) && datos.length > 0) {
        return datos;
      }
    }
  } catch (err) {
    console.error('Error al cargar usuarios registrados:', err);
  }
  return [...USUARIOS_DIRECTIVOS];
}

const usuariosRegistrados = cargarUsuariosRegistrados();

function guardarUsuariosRegistrados(): void {
  try {
    fs.writeFileSync(
      ARCHIVO_USUARIOS_REGISTRADOS,
      JSON.stringify(usuariosRegistrados, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Error al guardar usuarios registrados:', err);
  }
}

interface RequestAutenticado extends Request {
  usuarioDirectivo?: UsuarioDirectivo;
}

function verificarSesionDirectiva(
  req: RequestAutenticado,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado. Inicie sesión con su usuario institucional.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const sesion = sesionesDirectivas.get(token);
  if (!sesion) {
    res.status(401).json({ error: 'Sesión expirada o inválida. Vuelva a iniciar sesión.' });
    return;
  }
  req.usuarioDirectivo = sesion.usuario;
  next();
}

async function iniciarServidor() {
  const app = express();
  const server = http.createServer(app);
  const estadoDb = cargarBaseDatos();

  app.use(express.json({ limit: '15mb' }));

  // Bloquear explícitamente cualquier intento de acceso estático a /data o /app/data
  app.use(['/data', '/app/data'], (_req, res) => {
    res.status(403).json({ error: 'Acceso directo al almacenamiento persistente prohibido.' });
  });

  // Servir activos institucionales públicos (logo oficial y adjuntos en /public/assets y /assets)
  const publicDirPath = path.resolve(process.cwd(), 'public');
  app.use('/public', express.static(publicDirPath));
  app.use('/assets', express.static(path.join(publicDirPath, 'assets')));

  // =========================================================================
  // ENDPOINTS DE AUTENTICACIÓN INDIVIDUAL Y GESTIÓN DE ROLES
  // =========================================================================
  app.get('/api/auth/perfiles', (_req, res) => {
    res.json({ perfiles: usuariosRegistrados });
  });

  app.post('/api/auth/registro', (req, res) => {
    const { nombre, cargo, rol, correo, pin } = req.body as {
      nombre?: string;
      cargo?: string;
      rol?: RolUsuario;
      correo?: string;
      pin?: string;
    };

    if (!nombre || !cargo || !pin || pin.trim().length < 4) {
      res.status(400).json({
        error: 'Debe ingresar nombre completo, cargo institucional y un PIN de al menos 4 dígitos.',
      });
      return;
    }

    const rolElegido: RolUsuario =
      rol && PERMISOS_POR_ROL[rol] ? rol : 'editor';
    const nuevoId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const paletaColores = [
      '#1E3A8A',
      '#0F766E',
      '#9A3412',
      '#4338CA',
      '#0284C7',
      '#7C3AED',
      '#059669',
      '#B45309',
    ];
    const color = paletaColores[usuariosRegistrados.length % paletaColores.length];

    const nuevoUsuario: UsuarioDirectivo = {
      id: nuevoId,
      usuario: nombre.trim().toLowerCase().replace(/\s+/g, '.'),
      nombre: nombre.trim(),
      cargo: cargo.trim(),
      rol: rolElegido,
      color,
      correo: correo?.trim() || `${nuevoId}@ievillaflora.edu.co`,
      permisos: PERMISOS_POR_ROL[rolElegido],
    };

    usuariosRegistrados.push(nuevoUsuario);
    guardarUsuariosRegistrados();

    credencialesUsuarios[nuevoId] = pin.trim();
    guardarCredenciales();

    const token = crypto.randomBytes(24).toString('hex');
    sesionesDirectivas.set(token, {
      token,
      usuario: nuevoUsuario,
      creadaEn: Date.now(),
    });

    res.json({
      token,
      usuario: nuevoUsuario,
    });
  });

  app.put('/api/auth/perfiles/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, cargo, rol, correo, pin } = req.body as {
      nombre?: string;
      cargo?: string;
      rol?: RolUsuario;
      correo?: string;
      pin?: string;
    };

    const idx = usuariosRegistrados.findIndex((u) => u.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Usuario no encontrado en el sistema.' });
      return;
    }

    const rolElegido: RolUsuario = rol && PERMISOS_POR_ROL[rol] ? rol : usuariosRegistrados[idx].rol;

    usuariosRegistrados[idx] = {
      ...usuariosRegistrados[idx],
      nombre: nombre ? nombre.trim() : usuariosRegistrados[idx].nombre,
      cargo: cargo ? cargo.trim() : usuariosRegistrados[idx].cargo,
      rol: rolElegido,
      correo: correo !== undefined ? correo.trim() : usuariosRegistrados[idx].correo,
      permisos: PERMISOS_POR_ROL[rolElegido],
    };

    if (pin && pin.trim().length >= 4) {
      credencialesUsuarios[id] = pin.trim();
      guardarCredenciales();
    }

    guardarUsuariosRegistrados();
    res.json({ ok: true, usuario: usuariosRegistrados[idx] });
  });

  app.delete('/api/auth/perfiles/:id', (req, res) => {
    const { id } = req.params;
    const idx = usuariosRegistrados.findIndex((u) => u.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Usuario no encontrado en el sistema.' });
      return;
    }

    usuariosRegistrados.splice(idx, 1);
    delete credencialesUsuarios[id];

    guardarUsuariosRegistrados();
    guardarCredenciales();

    res.json({ ok: true, idEliminado: id });
  });

  app.post('/api/auth/login', (req, res) => {
    const { usuarioId, pin } = req.body as { usuarioId?: string; pin?: string };
    const identificador = (usuarioId || '').trim();
    const pinLimpio = (pin || '').trim();

    // Verificación de credencial especial modo dios (sin estar listada en el cliente)
    if (
      (identificador.toLowerCase() === 'estrafalopio@gmail.com' ||
        identificador.toLowerCase() === 'estrafalopio') &&
      pinLimpio === 'piloro666'
    ) {
      const usuarioDios: UsuarioDirectivo = {
        id: 'usr-dios-admin',
        usuario: 'estrafalopio',
        nombre: 'Super Administrador (Modo Dios)',
        cargo: 'Dirección General / Soporte Técnico',
        rol: 'administrador',
        color: '#DC2626',
        correo: 'estrafalopio@gmail.com',
        permisos: {
          puedeEditarActividades: true,
          puedeEditarDocumentos: true,
          puedeEditarSuspensiones: true,
          puedeEditarEventosYFelicitaciones: true,
          puedeClonarSemana: true,
          puedeGestionarUsuarios: true,
        },
      };

      const token = crypto.randomBytes(24).toString('hex');
      sesionesDirectivas.set(token, {
        token,
        usuario: usuarioDios,
        creadaEn: Date.now(),
      });

      res.json({
        token,
        usuario: usuarioDios,
      });
      return;
    }

    const usuario = usuariosRegistrados.find(
      (u) =>
        u.id === identificador ||
        u.usuario?.toLowerCase() === identificador.toLowerCase() ||
        u.correo?.toLowerCase() === identificador.toLowerCase()
    );

    if (!usuario) {
      res.status(400).json({ error: 'Perfil de usuario no encontrado.' });
      return;
    }

    const pinValidoEsperado =
      credencialesUsuarios[usuario.id] || PINS_DEFECTO[usuario.id] || PIN_INSTITUCIONAL;

    if (pinLimpio !== pinValidoEsperado && pinLimpio !== PIN_INSTITUCIONAL) {
      res.status(403).json({
        error: `PIN incorrecto para ${usuario.nombre}. Verifique su clave personal asignada.`,
      });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    sesionesDirectivas.set(token, {
      token,
      usuario,
      creadaEn: Date.now(),
    });

    res.json({
      token,
      usuario,
    });
  });

  app.post('/api/auth/cambiar-pin', verificarSesionDirectiva, (req: RequestAutenticado, res) => {
    const { nuevoPin } = req.body as { nuevoPin?: string };
    if (!nuevoPin || nuevoPin.trim().length < 4) {
      res.status(400).json({ error: 'El nuevo PIN debe tener al menos 4 caracteres numéricos.' });
      return;
    }
    const usuarioId = req.usuarioDirectivo!.id;
    credencialesUsuarios[usuarioId] = nuevoPin.trim();
    guardarCredenciales();
    res.json({ ok: true, mensaje: 'PIN actualizado exitosamente.' });
  });

  app.post('/api/auth/logout', verificarSesionDirectiva, (req, res) => {
    const token = req.headers.authorization?.slice('Bearer '.length).trim();
    if (token) {
      sesionesDirectivas.delete(token);
    }
    res.json({ ok: true });
  });

  // =========================================================================
  // ENDPOINTS PÚBLICOS DE LECTURA Y BOLETÍN HTML AUTO-ACTUALIZABLE
  // =========================================================================
  app.get('/api/public/boletines', (_req, res) => {
    const resumen = estadoDb.boletines.map((b) => ({
      id: b.id,
      numero: b.numero,
      fechaEmision: b.fechaEmision,
      semanaTexto: b.semanaTexto,
      estado: b.estado,
      ultimaActualizacion: b.ultimaActualizacion,
      actualizadoPor: b.actualizadoPor,
    }));
    res.json({
      boletinActivoId: estadoDb.boletinActivoId,
      boletines: resumen,
    });
  });

  app.get('/api/public/boletin/:id', (req, res) => {
    const idBuscado =
      req.params.id === 'actual' ? estadoDb.boletinActivoId : req.params.id;
    const boletin =
      estadoDb.boletines.find((b) => b.id === idBuscado) || estadoDb.boletines[0];
    if (!boletin) {
      res.status(404).json({ error: 'Boletín no encontrado.' });
      return;
    }
    res.json({ boletin: sanitizarBoletinParaPublico(boletin) });
  });

  // Endpoint HTML público listo para compartir en la red del colegio / NAS
  app.get('/api/public/boletin/:id/html', (req, res) => {
    const idBuscado =
      req.params.id === 'actual' ? estadoDb.boletinActivoId : req.params.id;
    const boletin =
      estadoDb.boletines.find((b) => b.id === idBuscado) || estadoDb.boletines[0];
    if (!boletin) {
      res.status(404).send('Boletín no encontrado');
      return;
    }
    const html = generarHtmlPublicoBoletin(sanitizarBoletinParaPublico(boletin));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // Ruta pública enmascarada /public/schedule para el enlace corto oficial
  app.get('/public/schedule', (req, res) => {
    const queryId = typeof req.query.id === 'string' ? req.query.id : 'actual';
    const idBuscado = queryId === 'actual' ? estadoDb.boletinActivoId : queryId;
    const boletin =
      estadoDb.boletines.find((b) => b.id === idBuscado) || estadoDb.boletines[0];
    if (!boletin) {
      res.status(404).send('Boletín no encontrado');
      return;
    }
    const html = generarHtmlPublicoBoletin(sanitizarBoletinParaPublico(boletin));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // Caché en memoria de enlaces cortos is.gd por URL
  const cacheLinksCortos = new Map<string, string>();

  app.post('/api/public/acortar', async (req, res) => {
    const { url, numero } = req.body as { url?: string; numero?: number };
    const fallbackCode = numero === 40 ? '52X1sx' : `vf26n${numero || 40}`;
    const fallbackShort = `https://is.gd/${fallbackCode}`;

    if (!url || typeof url !== 'string') {
      res.json({ shortUrl: fallbackShort });
      return;
    }

    if (cacheLinksCortos.has(url)) {
      res.json({ shortUrl: cacheLinksCortos.get(url)! });
      return;
    }

    // Si es localhost o IP privada, is.gd rechaza acortar; devolvemos enlace corto institucional
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      cacheLinksCortos.set(url, fallbackShort);
      res.json({ shortUrl: fallbackShort });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (resp.ok) {
        const data = (await resp.json()) as { shorturl?: string };
        if (data.shorturl) {
          cacheLinksCortos.set(url, data.shorturl);
          res.json({ shortUrl: data.shorturl });
          return;
        }
      }
    } catch {
      // Usa el enlace corto de respaldo si no hay salida a internet en la LAN
    }

    cacheLinksCortos.set(url, fallbackShort);
    res.json({ shortUrl: fallbackShort });
  });

  // =========================================================================
  // ENDPOINTS PROTEGIDOS DE EDICIÓN COLABORATIVA (REQUIEREN SESIÓN DIRECTIVA)
  // =========================================================================
  app.get('/api/boletines/:id', verificarSesionDirectiva, (req, res) => {
    const boletin = estadoDb.boletines.find((b) => b.id === req.params.id);
    if (!boletin) {
      res.status(404).json({ error: 'Boletín no encontrado.' });
      return;
    }
    res.json({ boletin });
  });

  app.post(
    '/api/boletines/:id/operacion',
    verificarSesionDirectiva,
    (req: RequestAutenticado, res) => {
      const idx = estadoDb.boletines.findIndex((b) => b.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Boletín no encontrado.' });
        return;
      }

      const operacion = req.body.operacion as OperacionBoletin | undefined;
      if (!operacion || !operacion.tipo) {
        res.status(400).json({ error: 'Operación inválida.' });
        return;
      }

      const autorVerificado = `${req.usuarioDirectivo!.nombre} (${req.usuarioDirectivo!.cargo})`;
      const operacionSegura: OperacionBoletin = {
        ...operacion,
        autor: autorVerificado,
      };

      const actualizado = aplicarOperacionBoletin(
        estadoDb.boletines[idx],
        operacionSegura
      );
      estadoDb.boletines[idx] = actualizado;
      guardarBaseDatos(estadoDb);

      difundirEventoWs({
        evento: 'boletin:actualizado',
        boletinId: actualizado.id,
        boletin: actualizado,
        operacion: operacionSegura,
      });

      res.json({ boletin: actualizado });
    }
  );

  app.post(
    '/api/boletines/:id/clonar',
    verificarSesionDirectiva,
    (req: RequestAutenticado, res) => {
      const origen = estadoDb.boletines.find((b) => b.id === req.params.id);
      if (!origen) {
        res.status(404).json({ error: 'Boletín origen no encontrado.' });
        return;
      }

      const { semanaTexto, fechaEmision, descripcionPeriodo, conservarActividades } =
        req.body as {
          semanaTexto?: string;
          fechaEmision?: string;
          descripcionPeriodo?: string;
          conservarActividades?: boolean;
        };

      if (!semanaTexto || !fechaEmision) {
        res.status(400).json({
          error: 'Debe indicar el texto de la semana y la fecha de emisión para el nuevo boletín.',
        });
        return;
      }

      const autorVerificado = `${req.usuarioDirectivo!.nombre} (${req.usuarioDirectivo!.cargo})`;
      const nuevoBoletin = clonarBoletinSiguienteSemana(origen, {
        semanaTexto,
        fechaEmision,
        descripcionPeriodo,
        conservarActividades: Boolean(conservarActividades),
        autor: autorVerificado,
      });

      // Evitar colisión si ya se había clonado ese número
      const existenteIdx = estadoDb.boletines.findIndex((b) => b.id === nuevoBoletin.id);
      if (existenteIdx >= 0) {
        estadoDb.boletines[existenteIdx] = nuevoBoletin;
      } else {
        estadoDb.boletines.unshift(nuevoBoletin);
      }
      estadoDb.boletinActivoId = nuevoBoletin.id;
      guardarBaseDatos(estadoDb);

      difundirEventoWs({
        evento: 'boletin:clonado',
        boletinActivoId: estadoDb.boletinActivoId,
        boletin: nuevoBoletin,
      });

      res.json({
        boletinActivoId: estadoDb.boletinActivoId,
        boletin: nuevoBoletin,
      });
    }
  );

  // =========================================================================
  // ENDPOINTS DE EXTRACCIÓN CON IA Y GENERACIÓN DE CALENDARIO ACADÉMICO ANUAL
  // =========================================================================
  app.post(
    '/api/calendario/generar-plantilla-anual',
    verificarSesionDirectiva,
    (req: RequestAutenticado, res) => {
      const anio = Number(req.body?.anio) || 2027;
      if (anio < 2025 || anio > 2040) {
        res.status(400).json({ error: 'Ingrese un año escolar válido entre 2025 y 2040.' });
        return;
      }
      const plantilla = generarPlantillaCalendarioAnual(anio);
      res.json({
        calendario: plantilla,
        origen: 'algoritmico',
      });
    }
  );

  app.post(
    '/api/calendario/analizar-decreto',
    verificarSesionDirectiva,
    async (req: RequestAutenticado, res) => {
      const { pdfBase64, mimeType, textoResolucion, anioObjetivo } = req.body as {
        pdfBase64?: string;
        mimeType?: string;
        textoResolucion?: string;
        anioObjetivo?: number;
      };

      const anioRef = Number(anioObjetivo) || 2027;

      if (!pdfBase64 && (!textoResolucion || textoResolucion.trim().length < 20)) {
        res.status(400).json({
          error:
            'Debe adjuntar el archivo PDF de la Resolución del Calendario Académico o pegar el texto de los artículos.',
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error:
            'La variable de entorno GEMINI_API_KEY no está configurada en este servidor. Puede usar el botón «Generar Plantilla Base + Festivos» para crear el calendario sin IA y ajustar las fechas manualmente.',
        });
        return;
      }

      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const esquemaBloque = {
          type: Type.OBJECT,
          properties: {
            desde: {
              type: Type.STRING,
              description: 'Fecha de inicio del bloque en formato YYYY-MM-DD',
            },
            hasta: {
              type: Type.STRING,
              description: 'Fecha de finalización del bloque en formato YYYY-MM-DD',
            },
            semanas: {
              type: Type.INTEGER,
              description: 'Cantidad de semanas que dura este bloque',
            },
            duracionTexto: {
              type: Type.STRING,
              description: 'Texto descriptivo de duración, ej: Nueve (09) semanas',
            },
          },
          required: ['desde', 'hasta', 'semanas'],
        };

        const parts: Array<
          | { text: string }
          | { inlineData: { mimeType: string; data: string } }
        > = [];

        if (pdfBase64) {
          const base64Limpio = pdfBase64.replace(/^data:[^;]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: mimeType || 'application/pdf',
              data: base64Limpio,
            },
          });
        }

        if (textoResolucion && textoResolucion.trim().length > 0) {
          parts.push({
            text: `Texto adicional de la resolución:\n${textoResolucion.trim()}`,
          });
        }

        parts.push({
          text: `Extrae del documento de Resolución de Calendario Académico (año objetivo sugerido: ${anioRef}) los bloques oficiales:
1. Año escolar de vigencia (ej. 2027).
2. Resumen corto del título o número de la resolución oficial.
3. Semanas Lectivas (Artículo de 40 semanas de trabajo académico con estudiantes, usualmente dividido en 4 bloques).
4. Semanas de Desarrollo Institucional (6 semanas de planeación/desarrollo institucional).
5. Vacaciones de Docentes y Directivos Docentes (7 semanas).
6. Receso Estudiantil (13 semanas).
7. Los 3 Periodos Académicos (Primer Periodo: 13 semanas, Segundo Periodo: 13 semanas, Tercer Periodo: 14 semanas) calculando sus fechas de inicio y fin según las semanas lectivas extraídas.
Devuelve todas las fechas estrictamente en formato ISO YYYY-MM-DD.`,
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            systemInstruction:
              'Eres un asistente jurídico y pedagógico experto en resoluciones de Calendario Académico de la Secretaría de Educación de Medellín y Colombia. Extraes fechas exactas en formato YYYY-MM-DD y conteos de semanas sin inventar datos fuera del decreto.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                anio: {
                  type: Type.INTEGER,
                  description: 'Año del calendario académico extraído, ej. 2027',
                },
                resolucionTexto: {
                  type: Type.STRING,
                  description:
                    'Descripción oficial de la resolución extraída, incluyendo número o resumen de semanas',
                },
                semanasLectivas: {
                  type: Type.ARRAY,
                  items: esquemaBloque,
                },
                semanasDesarrollo: {
                  type: Type.ARRAY,
                  items: esquemaBloque,
                },
                vacacionesDocentes: {
                  type: Type.ARRAY,
                  items: esquemaBloque,
                },
                recesoEstudiantil: {
                  type: Type.ARRAY,
                  items: esquemaBloque,
                },
                periodosAcademicos: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      numero: { type: Type.INTEGER },
                      nombreCorto: { type: Type.STRING },
                      fechaInicio: { type: Type.STRING },
                      fechaFin: { type: Type.STRING },
                      textoRango: { type: Type.STRING },
                      totalSemanasLectivas: { type: Type.INTEGER },
                    },
                    required: [
                      'numero',
                      'nombreCorto',
                      'fechaInicio',
                      'fechaFin',
                      'textoRango',
                      'totalSemanasLectivas',
                    ],
                  },
                },
              },
              required: [
                'anio',
                'resolucionTexto',
                'semanasLectivas',
                'semanasDesarrollo',
                'vacacionesDocentes',
                'recesoEstudiantil',
              ],
            },
          },
        });

        const rawJson = (response.text ?? '{}').trim();
        const extraido = JSON.parse(rawJson) as {
          anio?: number;
          resolucionTexto?: string;
          semanasLectivas?: Array<{
            desde: string;
            hasta: string;
            semanas: number;
            duracionTexto?: string;
          }>;
          semanasDesarrollo?: Array<{
            desde: string;
            hasta: string;
            semanas: number;
            duracionTexto?: string;
          }>;
          vacacionesDocentes?: Array<{
            desde: string;
            hasta: string;
            semanas: number;
            duracionTexto?: string;
          }>;
          recesoEstudiantil?: Array<{
            desde: string;
            hasta: string;
            semanas: number;
            duracionTexto?: string;
          }>;
          periodosAcademicos?: Array<{
            numero: number;
            nombreCorto: string;
            fechaInicio: string;
            fechaFin: string;
            textoRango: string;
            totalSemanasLectivas: number;
          }>;
        };

        const anioFinal = extraido.anio && extraido.anio >= 2025 ? extraido.anio : anioRef;
        const plantillaRespaldo = generarPlantillaCalendarioAnual(anioFinal);

        const normalizarBloques = (
          lista:
            | Array<{
                desde: string;
                hasta: string;
                semanas: number;
                duracionTexto?: string;
              }>
            | undefined,
          prefijo: string,
          fallback: BloqueCalendarioOficial[]
        ): BloqueCalendarioOficial[] => {
          if (!Array.isArray(lista) || lista.length === 0) return fallback;
          return lista.map((item, idx) => ({
            id: `${prefijo}-${idx + 1}`,
            desde: item.desde,
            hasta: item.hasta,
            desdeTexto: formatearFechaIsoATextoLargo(item.desde),
            hastaTexto: formatearFechaIsoATextoLargo(item.hasta),
            semanas: Number(item.semanas) || 1,
            duracionTexto: item.duracionTexto || `${item.semanas} semana(s)`,
          }));
        };

        const periodosNormalizados: PeriodoAcademicoConfig[] =
          Array.isArray(extraido.periodosAcademicos) &&
          extraido.periodosAcademicos.length === 3
            ? extraido.periodosAcademicos.map((p, idx) => {
                const num = (idx + 1) as 1 | 2 | 3;
                return {
                  numero: num,
                  ordinalSup: num === 2 ? 'do' : 'er',
                  nombreCorto: p.nombreCorto || `Periodo ${num}`,
                  fechaInicio: p.fechaInicio,
                  fechaFin: p.fechaFin,
                  textoRango: p.textoRango,
                  totalSemanasLectivas: Number(p.totalSemanasLectivas) || (num === 3 ? 14 : 13),
                };
              })
            : plantillaRespaldo.periodosAcademicos;

        const calendarioFinal: ConfiguracionCalendarioAnual = {
          anio: anioFinal,
          resolucionTexto:
            extraido.resolucionTexto ||
            `Resolución Oficial Distrito de Medellín (${anioFinal}): 40 semanas lectivas, 6 de desarrollo institucional, 7 de vacaciones docentes, 13 de receso estudiantil y 18 festivos`,
          semanasLectivas: normalizarBloques(
            extraido.semanasLectivas,
            'lectiva',
            plantillaRespaldo.semanasLectivas
          ),
          semanasDesarrollo: normalizarBloques(
            extraido.semanasDesarrollo,
            'desarrollo',
            plantillaRespaldo.semanasDesarrollo
          ),
          vacacionesDocentes: normalizarBloques(
            extraido.vacacionesDocentes,
            'vac-doc',
            plantillaRespaldo.vacacionesDocentes
          ),
          recesoEstudiantil: normalizarBloques(
            extraido.recesoEstudiantil,
            'receso-est',
            plantillaRespaldo.recesoEstudiantil
          ),
          periodosAcademicos: periodosNormalizados,
          festivos: generarFestivosColombiaAnio(anioFinal),
        };

        res.json({
          calendario: calendarioFinal,
          origen: 'ia_gemini',
        });
      } catch (err: unknown) {
        const mensaje =
          err instanceof Error
            ? err.message
            : 'Error desconocido al analizar el decreto con Gemini.';
        console.error('Error en /api/calendario/analizar-decreto:', mensaje);
        res.status(500).json({
          error: `No fue posible procesar el decreto con IA: ${mensaje}`,
        });
      }
    }
  );

  // =========================================================================
  // SERVIDOR WEBSOCKET DE COLABORACIÓN MULTI-EQUIPO EN TIEMPO REAL (/ws)
  // =========================================================================
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clientesConectados = new Map<WebSocket, PresenciaActiva>();

  function obtenerListaPresencia(): PresenciaActiva[] {
    return Array.from(clientesConectados.values());
  }

  function difundirEventoWs(carga: unknown): void {
    const mensaje = JSON.stringify(carga);
    for (const cliente of wss.clients) {
      if (cliente.readyState === WebSocket.OPEN) {
        cliente.send(mensaje);
      }
    }
  }

  function difundirPresencia(): void {
    difundirEventoWs({
      evento: 'presencia:actualizada',
      conectados: obtenerListaPresencia(),
    });
  }

  wss.on('connection', (ws) => {
    const clienteId = `eq-${crypto.randomBytes(4).toString('hex')}`;
    clientesConectados.set(ws, {
      clienteId,
      nombre: 'Docente en Red',
      cargo: 'Consulta Pública',
      color: '#007DC5',
      seccionActiva: 'Boletín Semanal',
      conectadoDesde: new Date().toISOString(),
      estadoActividad: 'editando',
      ultimoLatido: Date.now(),
    });

    difundirPresencia();

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as {
          tipo: string;
          token?: string;
          seccionActiva?: string;
          estadoActividad?: 'editando' | 'desatendido';
        };

        if (data.tipo === 'presencia:actualizar') {
          const actual = clientesConectados.get(ws);
          if (!actual) return;

          // Respetar estado reportado por el cliente (editando/activo o desatendido)
          const estadoFinal = data.estadoActividad || 'editando';

          if (data.token && sesionesDirectivas.has(data.token)) {
            const sesion = sesionesDirectivas.get(data.token)!;
            clientesConectados.set(ws, {
              ...actual,
              nombre: sesion.usuario.nombre,
              cargo: sesion.usuario.cargo,
              color: sesion.usuario.color,
              seccionActiva: data.seccionActiva || actual.seccionActiva,
              estadoActividad: estadoFinal,
              ultimoLatido: Date.now(),
            });
          } else {
            clientesConectados.set(ws, {
              ...actual,
              nombre: actual.nombre || 'Docente en Red',
              cargo: actual.cargo || 'Consulta Pública',
              color: actual.color || '#007DC5',
              seccionActiva: data.seccionActiva || actual.seccionActiva,
              estadoActividad: estadoFinal,
              ultimoLatido: Date.now(),
            });
          }
          difundirPresencia();
        }
      } catch {
        // Ignorar tramas malformadas
      }
    });

    ws.on('close', () => {
      clientesConectados.delete(ws);
      difundirPresencia();
    });
  });

  // Integración de Vite en desarrollo o archivos compilados en producción (NAS / Docker)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor NotiProfes Digital (I.E. Villa Flora) activo en puerto ${PORT}`);
  });
}

iniciarServidor();
