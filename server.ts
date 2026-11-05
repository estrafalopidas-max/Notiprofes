import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { BOLETIN_40_SEED, PERMISOS_POR_ROL, USUARIOS_DIRECTIVOS } from './src/data/seedNotiprofes40';
import {
  BoletinSemanal,
  OperacionBoletin,
  PresenciaActiva,
  RolUsuario,
  UsuarioDirectivo,
} from './src/types/notiprofes';
import {
  aplicarOperacionBoletin,
  clonarBoletinSiguienteSemana,
  generarHtmlPublicoBoletin,
} from './src/utils/boletinLogic';

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

  app.use(express.json({ limit: '2mb' }));

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
