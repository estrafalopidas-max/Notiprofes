import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { BOLETIN_39_SEED, BOLETIN_40_SEED, BOLETIN_41_SEED, PERMISOS_POR_ROL, USUARIOS_DIRECTIVOS } from './src/data/seedNotiprofes40';
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

function contarActividadesBoletin(dias: BoletinSemanal['dias'] | undefined): number {
  if (!Array.isArray(dias)) return 0;
  return dias.reduce((acc, d) => acc + (Array.isArray(d.actividades) ? d.actividades.length : 0), 0);
}

function normalizarListaBoletines(boletines: BoletinSemanal[]): BoletinSemanal[] {
  const mapa = new Map<number, BoletinSemanal>();

  // Semillas base garantizadas
  mapa.set(BOLETIN_39_SEED.numero, BOLETIN_39_SEED);
  mapa.set(BOLETIN_40_SEED.numero, BOLETIN_40_SEED);
  mapa.set(BOLETIN_41_SEED.numero, BOLETIN_41_SEED);

  for (const b of boletines) {
    if (b.numero === 39) {
      const diasValidos39 =
        b.dias?.[0]?.fechaTexto === 'LUNES 26 DE OCTUBRE' &&
        contarActividadesBoletin(b.dias) > 0;
      mapa.set(39, {
        ...BOLETIN_39_SEED,
        ...b,
        numero: 39,
        fechaEmision: '30/10/2026',
        semanaTexto: 'Semana del 26 de octubre al 30 de octubre de 2026.',
        descripcionPeriodo: 'Programación de la NOVENA semana del TERCER periodo del año lectivo.',
        dias: diasValidos39 ? b.dias : BOLETIN_39_SEED.dias,
      });
    } else if (b.numero === 40) {
      const diasValidos40 =
        b.dias?.[0]?.fechaTexto === 'LUNES 2 DE NOVIEMBRE' &&
        b.dias?.[0]?.id === 'dia-lunes' &&
        contarActividadesBoletin(b.dias) > 0;
      mapa.set(40, {
        ...BOLETIN_40_SEED,
        ...b,
        numero: 40,
        fechaEmision: '06/11/2026',
        semanaTexto: 'Semana del 2 de noviembre al 6 de noviembre de 2026.',
        descripcionPeriodo: 'Programación de la DÉCIMA semana del TERCER periodo del año lectivo.',
        dias: diasValidos40 ? b.dias : BOLETIN_40_SEED.dias,
      });
    } else if (b.numero === 41) {
      const diasValidos41 =
        b.dias?.[0]?.fechaTexto === 'LUNES 9 DE NOVIEMBRE' &&
        contarActividadesBoletin(b.dias) > 0;
      mapa.set(41, {
        ...BOLETIN_41_SEED,
        ...b,
        numero: 41,
        fechaEmision: '13/11/2026',
        semanaTexto: 'Semana del 9 de noviembre al 13 de noviembre de 2026.',
        descripcionPeriodo: 'Programación de la UNDÉCIMA semana del TERCER periodo del año lectivo.',
        dias: diasValidos41 ? b.dias : BOLETIN_41_SEED.dias,
      });
    } else {
      mapa.set(b.numero, b);
    }
  }

  return Array.from(mapa.values()).sort((a, b) => b.numero - a.numero);
}

function cargarBaseDatos(): EstadoAlmacenamiento {
  try {
    if (fs.existsSync(ARCHIVO_DB)) {
      const contenido = fs.readFileSync(ARCHIVO_DB, 'utf-8');
      const parsed = JSON.parse(contenido) as EstadoAlmacenamiento;
      if (parsed && Array.isArray(parsed.boletines) && parsed.boletines.length > 0) {
        const normalizados = normalizarListaBoletines(parsed.boletines);
        const activoExiste =
          parsed.boletinActivoId !== BOLETIN_39_SEED.id &&
          normalizados.some((b) => b.id === parsed.boletinActivoId);
        const estadoFinal: EstadoAlmacenamiento = {
          boletinActivoId: activoExiste ? parsed.boletinActivoId : BOLETIN_40_SEED.id,
          boletines: normalizados,
        };
        guardarBaseDatos(estadoFinal);
        return estadoFinal;
      }
    }
  } catch (err) {
    console.error('Error al leer base de datos JSON, restaurando semilla inicial:', err);
  }

  const inicial: EstadoAlmacenamiento = {
    boletinActivoId: BOLETIN_40_SEED.id,
    boletines: [BOLETIN_39_SEED, BOLETIN_40_SEED, BOLETIN_41_SEED],
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

/**
 * Evalúa si ya es viernes a partir de las 18:00 (hora legal de Colombia UTC-5)
 * o si el boletín ya fue emitido previamente para permitir actualizaciones inmediatas.
 */
function evaluarHorarioEmisionViernes18h(boletin: BoletinSemanal): {
  habilitadoParaEnvioMasivo: boolean;
  esModificacionPosterior: boolean;
  horaActualColombiaTexto: string;
  motivoRestriccion?: string;
} {
  // Si el boletín ya fue publicado oficialmente al menos una vez (tiene drivePdfInfo o ya estaba publicado),
  // se trata de una modificación posterior y se habilita de inmediato sin restricción de horario.
  const yaPublicadoPreviamente =
    boletin.estado === 'publicado' ||
    Boolean(boletin.drivePdfInfo?.fileId) ||
    (boletin.drivePdfInfo?.version || 0) > 0;

  if (yaPublicadoPreviamente) {
    return {
      habilitadoParaEnvioMasivo: true,
      esModificacionPosterior: true,
      horaActualColombiaTexto: new Date().toLocaleTimeString('es-CO', {
        timeZone: 'America/Bogota',
      }),
    };
  }

  // Obtener fecha y hora en zona horaria oficial de Medellín / Colombia (America/Bogota)
  const fechaActualBogota = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
  );
  const diaSemana = fechaActualBogota.getDay(); // 0: domingo, 5: viernes, 6: sábado
  const hora = fechaActualBogota.getHours();

  // El viernes a partir de las 18:00 horas (6:00 p.m.) hasta el fin de semana está legalmente habilitado
  // Si es viernes y ya son las 18h o más, o si es sábado/domingo posterior a la emisión
  const esViernesDespuesDe18h = diaSemana === 5 && hora >= 18;
  const esFinDeSemanaOSiguiente = diaSemana === 6 || diaSemana === 0;

  const habilitadoParaEnvioMasivo = esViernesDespuesDe18h || esFinDeSemanaOSiguiente;

  const horaActualColombiaTexto = fechaActualBogota.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (!habilitadoParaEnvioMasivo) {
    return {
      habilitadoParaEnvioMasivo: false,
      esModificacionPosterior: false,
      horaActualColombiaTexto,
      motivoRestriccion: `La primera emisión oficial y el envío de notificaciones por correo a los docentes están programados institucionalmente para el viernes a partir de las 6:00 p. m. (18:00 h). Hora actual en Colombia: ${horaActualColombiaTexto}. Puede continuar editando y guardando los borradores en el servidor.`,
    };
  }

  return {
    habilitadoParaEnvioMasivo: true,
    esModificacionPosterior: false,
    horaActualColombiaTexto,
  };
}

// Gestión de sesiones autenticadas en servidor con persistencia protegida
interface SesionActiva {
  token: string;
  usuario: UsuarioDirectivo;
  creadaEn: number;
}

// Expiración máxima de sesión directiva en memoria y persistencia: 12 horas
const SESION_TTL_MS = 12 * 60 * 60 * 1000;

const ARCHIVO_SESIONES = path.join(DIRECTORIO_DATOS, 'notiprofes-sesiones.json');

function cargarSesionesPersistidas(): Map<string, SesionActiva> {
  const mapa = new Map<string, SesionActiva>();
  try {
    if (fs.existsSync(ARCHIVO_SESIONES)) {
      const contenido = fs.readFileSync(ARCHIVO_SESIONES, 'utf-8');
      const lista = JSON.parse(contenido) as SesionActiva[];
      if (Array.isArray(lista)) {
        const ahora = Date.now();
        for (const ses of lista) {
          if (ses && ses.token && ses.usuario && ahora - ses.creadaEn < SESION_TTL_MS) {
            mapa.set(ses.token, ses);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error al cargar sesiones persistidas:', err);
  }
  return mapa;
}

const sesionesDirectivas = cargarSesionesPersistidas();

function guardarSesionesPersistidas(): void {
  try {
    const lista = Array.from(sesionesDirectivas.values());
    fs.writeFileSync(ARCHIVO_SESIONES, JSON.stringify(lista, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error al guardar sesiones persistidas:', err);
  }
}

// Cifrado seguro de claves/PINs individuales mediante PBKDF2 y Salt
interface CredencialHash {
  hash: string;
  salt: string;
}

function generarHashPin(pinLimpio: string, saltExistente?: string): CredencialHash {
  const salt = saltExistente || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pinLimpio.trim(), salt, 10000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function verificarPinEntrante(pinIngresado: string, cred: CredencialHash | string): boolean {
  if (!cred || !pinIngresado) return false;
  if (typeof cred === 'string') {
    // Para cadenas legadas directas, comparación en tiempo constante
    const bufIngresado = Buffer.from(pinIngresado.trim());
    const bufEsperado = Buffer.from(cred.trim());
    if (bufIngresado.length !== bufEsperado.length) return false;
    return crypto.timingSafeEqual(bufIngresado, bufEsperado);
  }
  if (!cred.hash || !cred.salt) return false;
  const hashGenerado = crypto.pbkdf2Sync(pinIngresado.trim(), cred.salt, 10000, 32, 'sha256').toString('hex');
  const bufGen = Buffer.from(hashGenerado, 'hex');
  const bufEsp = Buffer.from(cred.hash, 'hex');
  if (bufGen.length !== bufEsp.length) return false;
  return crypto.timingSafeEqual(bufGen, bufEsp);
}

const ARCHIVO_CREDENCIALES = path.join(DIRECTORIO_DATOS, 'notiprofes-credenciales.json');
const PIN_INSTITUCIONAL = process.env.INSTITUTIONAL_PIN || '2026';

const PINS_DEFECTO_RAW: Record<string, string> = {
  'dir-rector': '1001',
  'dir-academica': '2002',
  'dir-convivencia': '3003',
  'dir-secretaria': '4004',
  'doc-colaborador': '5005',
};

function cargarCredenciales(): Record<string, CredencialHash> {
  const credsFinales: Record<string, CredencialHash> = {};

  // Inicializar hashes para PINs por defecto
  for (const [usrId, pinRaw] of Object.entries(PINS_DEFECTO_RAW)) {
    credsFinales[usrId] = generarHashPin(pinRaw);
  }

  try {
    if (fs.existsSync(ARCHIVO_CREDENCIALES)) {
      const datos = JSON.parse(fs.readFileSync(ARCHIVO_CREDENCIALES, 'utf-8'));
      if (datos && typeof datos === 'object') {
        for (const [key, val] of Object.entries(datos)) {
          if (typeof val === 'string') {
            // Migrar clave plana legada a hash cifrado
            credsFinales[key] = generarHashPin(val);
          } else if (val && typeof val === 'object' && 'hash' in val && 'salt' in val) {
            credsFinales[key] = val as CredencialHash;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error al cargar credenciales cifradas:', err);
  }

  return credsFinales;
}

const credencialesUsuarios = cargarCredenciales();

function guardarCredenciales(): void {
  try {
    fs.writeFileSync(ARCHIVO_CREDENCIALES, JSON.stringify(credencialesUsuarios, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error al guardar credenciales cifradas:', err);
  }
}

// Persistir hashes iniciales si no existía el archivo
guardarCredenciales();

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

// =========================================================================
// CONFIGURACIÓN Y SERVICIO SMTP PARA NOTIFICACIONES AUTOMÁTICAS A DOCENTES
// =========================================================================
// Las credenciales secretas (SMTP_HOST, SMTP_USER, SMTP_PASS) se leen exclusivamente
// desde variables de entorno del backend (Docker / TrueNAS). En disco (/app/data) solo
// se persisten preferencias no sensibles (lista de correos docentes y estado del envío).
const ARCHIVO_NOTIFICACIONES = path.join(DIRECTORIO_DATOS, 'notiprofes-notificaciones.json');

interface PreferenciasNotificacionSmtp {
  notificarAutomaticamenteAlPublicar: boolean;
  asuntoPrefijo: string;
  destinatariosDocentes: string[];
  ultimoEnvio?: {
    fecha: string;
    boletinNumero: number;
    totalDestinatarios: number;
    estado: 'enviado' | 'error';
    detalle: string;
  };
}

function obtenerCorreosInicialesDocentes(): string[] {
  const correos = usuariosRegistrados
    .map((u) => u.correo?.trim())
    .filter((c): c is string => Boolean(c && c.includes('@')));
  const base = [
    ...correos,
    'docentes@ievillaflora.edu.co',
    'coordinacion@ievillaflora.edu.co',
  ];
  return Array.from(new Set(base));
}

function cargarPreferenciasNotificacion(): PreferenciasNotificacionSmtp {
  try {
    if (fs.existsSync(ARCHIVO_NOTIFICACIONES)) {
      const datos = JSON.parse(
        fs.readFileSync(ARCHIVO_NOTIFICACIONES, 'utf-8')
      ) as Partial<PreferenciasNotificacionSmtp>;
      if (datos && Array.isArray(datos.destinatariosDocentes)) {
        return {
          notificarAutomaticamenteAlPublicar:
            datos.notificarAutomaticamenteAlPublicar ?? true,
          asuntoPrefijo:
            datos.asuntoPrefijo || '[NotiProfes Oficial · I.E. Villa Flora]',
          destinatariosDocentes: datos.destinatariosDocentes,
          ultimoEnvio: datos.ultimoEnvio,
        };
      }
    }
  } catch (err) {
    console.error('Error al cargar preferencias de notificación SMTP:', err);
  }
  return {
    notificarAutomaticamenteAlPublicar: true,
    asuntoPrefijo: '[NotiProfes Oficial · I.E. Villa Flora]',
    destinatariosDocentes: obtenerCorreosInicialesDocentes(),
  };
}

const preferenciasNotificacion = cargarPreferenciasNotificacion();

function guardarPreferenciasNotificacion(): void {
  try {
    fs.writeFileSync(
      ARCHIVO_NOTIFICACIONES,
      JSON.stringify(preferenciasNotificacion, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Error al guardar preferencias de notificación SMTP:', err);
  }
}

const ARCHIVO_SMTP_SERVIDOR = path.join(DIRECTORIO_DATOS, 'notiprofes-smtp-servidor.json');
const ARCHIVO_LLAVE_MAESTRA = path.join(DIRECTORIO_DATOS, '.notiprofes-master.key');

function obtenerLlaveCifradoLocal(): Buffer {
  const secretoEntorno = (
    process.env.APP_SECRET ||
    process.env.SUPPORT_ADMIN_PASS ||
    ''
  ).trim();
  if (secretoEntorno) {
    return crypto.createHash('sha256').update(secretoEntorno).digest();
  }
  try {
    if (fs.existsSync(ARCHIVO_LLAVE_MAESTRA)) {
      const hex = fs.readFileSync(ARCHIVO_LLAVE_MAESTRA, 'utf-8').trim();
      if (hex.length === 64) {
        return Buffer.from(hex, 'hex');
      }
    }
    const nuevaLlave = crypto.randomBytes(32);
    fs.writeFileSync(ARCHIVO_LLAVE_MAESTRA, nuevaLlave.toString('hex'), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    return nuevaLlave;
  } catch {
    return crypto
      .createHash('sha256')
      .update(`notiprofes-vf-${DIRECTORIO_DATOS}`)
      .digest();
  }
}

function cifrarSecretoLocal(textoPlano: string): string {
  if (!textoPlano) return '';
  if (textoPlano.startsWith('enc:v1:')) return textoPlano;
  const key = obtenerLlaveCifradoLocal();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(textoPlano, 'utf-8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function descifrarSecretoLocal(valorAlmacenado: string): string {
  if (!valorAlmacenado) return '';
  if (!valorAlmacenado.startsWith('enc:v1:')) return valorAlmacenado;
  try {
    const partes = valorAlmacenado.split(':');
    if (partes.length !== 5) return '';
    const iv = Buffer.from(partes[2], 'hex');
    const tag = Buffer.from(partes[3], 'hex');
    const encrypted = Buffer.from(partes[4], 'hex');
    const key = obtenerLlaveCifradoLocal();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf-8');
  } catch {
    return '';
  }
}

interface ConfiguracionServidorSmtpPersistida {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  actualizadoEn?: string;
  actualizadoPor?: string;
}

function cargarConfiguracionSmtpPersistida(): Partial<ConfiguracionServidorSmtpPersistida> {
  try {
    if (fs.existsSync(ARCHIVO_SMTP_SERVIDOR)) {
      const datos = JSON.parse(
        fs.readFileSync(ARCHIVO_SMTP_SERVIDOR, 'utf-8')
      ) as Partial<ConfiguracionServidorSmtpPersistida>;
      if (datos && typeof datos === 'object') {
        const passPlana = datos.pass ? descifrarSecretoLocal(datos.pass) : '';
        return {
          ...datos,
          pass: passPlana,
        };
      }
    }
  } catch (err) {
    console.error('Error al cargar configuración de servidor SMTP:', err);
  }
  return {};
}

const configSmtpPersistida: Partial<ConfiguracionServidorSmtpPersistida> =
  cargarConfiguracionSmtpPersistida();

function guardarConfiguracionSmtpPersistida(): void {
  try {
    const copiaSegura = {
      ...configSmtpPersistida,
      pass: configSmtpPersistida.pass
        ? cifrarSecretoLocal(configSmtpPersistida.pass)
        : '',
    };
    fs.writeFileSync(
      ARCHIVO_SMTP_SERVIDOR,
      JSON.stringify(copiaSegura, null, 2),
      { encoding: 'utf-8', mode: 0o600 }
    );
  } catch (err) {
    console.error('Error al guardar configuración de servidor SMTP:', err);
  }
}

// Persistencia de carpetas institucionales de Google Drive por año lectivo (ej. "Notiprofes 2026", "Notiprofes 2027")
export interface ConfiguracionCarpetaDriveAnual {
  anio: number;
  folderInput: string;
  folderId: string;
  folderName: string;
  actualizadoEn?: string;
  actualizadoPor?: string;
}

const ARCHIVO_DRIVE_CARPETAS = path.join(
  DIRECTORIO_DATOS,
  'notiprofes-drive-carpetas.json'
);

function extraerIdCarpetaDriveServidor(entrada: string): string {
  const limpio = (entrada || '').trim();
  if (!limpio) return '';
  const matchFolders = limpio.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (matchFolders?.[1]) return matchFolders[1];
  const matchIdParam = limpio.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (matchIdParam?.[1]) return matchIdParam[1];
  // Si parece un ID directo de Google Drive (sin espacios ni barras y al menos 15 caracteres)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(limpio) && !limpio.includes(' ')) {
    return limpio;
  }
  return '';
}

function normalizarNombreCarpetaAnualPorDefecto(
  valor: string | undefined,
  anioNum: number
): string {
  const limpio = String(valor || '').trim();
  if (!limpio || /^Villa Flora\s+\d{4}$/i.test(limpio)) {
    return `Notiprofes ${anioNum}`;
  }
  return limpio;
}

function cargarCarpetasDrivePorAnio(): Record<string, ConfiguracionCarpetaDriveAnual> {
  const basePorDefecto: Record<string, ConfiguracionCarpetaDriveAnual> = {
    '2026': {
      anio: 2026,
      folderInput: 'Notiprofes 2026',
      folderId: '',
      folderName: 'Notiprofes 2026',
    },
    '2027': {
      anio: 2027,
      folderInput: 'Notiprofes 2027',
      folderId: '',
      folderName: 'Notiprofes 2027',
    },
  };

  try {
    if (fs.existsSync(ARCHIVO_DRIVE_CARPETAS)) {
      const raw = JSON.parse(
        fs.readFileSync(ARCHIVO_DRIVE_CARPETAS, 'utf-8')
      ) as Record<string, ConfiguracionCarpetaDriveAnual>;
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
          const anioNum = Number(v?.anio || k);
          if (anioNum >= 2020 && anioNum <= 2100) {
            const nombreNormalizado = normalizarNombreCarpetaAnualPorDefecto(
              v.folderName,
              anioNum
            );
            const inputNormalizado = normalizarNombreCarpetaAnualPorDefecto(
              v.folderInput || v.folderName,
              anioNum
            );
            basePorDefecto[String(anioNum)] = {
              anio: anioNum,
              folderInput: inputNormalizado,
              folderId: String(v.folderId || '').trim(),
              folderName: nombreNormalizado,
              actualizadoEn: v.actualizadoEn,
              actualizadoPor: v.actualizadoPor,
            };
          }
        }
      }
    }
  } catch (err) {
    console.error('Error al cargar configuración de carpetas Google Drive:', err);
  }
  return basePorDefecto;
}

const carpetasDrivePorAnio = cargarCarpetasDrivePorAnio();

function guardarCarpetasDrivePorAnio(): void {
  try {
    fs.writeFileSync(
      ARCHIVO_DRIVE_CARPETAS,
      JSON.stringify(carpetasDrivePorAnio, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Error al guardar configuración de carpetas Google Drive:', err);
  }
}

// Almacenamiento persistente de PDFs oficiales en el servidor (/app/data/pdfs) + Puente Google Apps Script
const DIRECTORIO_PDFS = path.join(DIRECTORIO_DATOS, 'pdfs');
if (!fs.existsSync(DIRECTORIO_PDFS)) {
  fs.mkdirSync(DIRECTORIO_PDFS, { recursive: true });
}

interface ConfiguracionConectorDrive {
  appsScriptUrl: string;
  secretToken: string;
  actualizadoEn?: string;
  actualizadoPor?: string;
}

const ARCHIVO_DRIVE_CONECTOR = path.join(
  DIRECTORIO_DATOS,
  'notiprofes-drive-conector.json'
);

const URL_APPS_SCRIPT_PREDETERMINADA =
  'https://script.google.com/macros/s/AKfycbyjw7yMkhxTGBD9iBthYoUeDhaD1fDtRBGjBnep_RAsQ9oGs86grKbAVFBOzDEaqlefUw/exec';
const TOKEN_APPS_SCRIPT_PREDETERMINADO = 'vf-bridge-44d5fa45caea6ce8ad0924da';

function cargarConfiguracionConectorDrive(): ConfiguracionConectorDrive {
  const tokenPorDefecto =
    (process.env.GOOGLE_APPS_SCRIPT_SECRET || '').trim() ||
    TOKEN_APPS_SCRIPT_PREDETERMINADO;
  const urlPorDefecto =
    (process.env.GOOGLE_APPS_SCRIPT_DRIVE_URL || '').trim() ||
    URL_APPS_SCRIPT_PREDETERMINADA;

  try {
    if (fs.existsSync(ARCHIVO_DRIVE_CONECTOR)) {
      const raw = JSON.parse(
        fs.readFileSync(ARCHIVO_DRIVE_CONECTOR, 'utf-8')
      ) as Partial<ConfiguracionConectorDrive>;
      const configCargada: ConfiguracionConectorDrive = {
        appsScriptUrl: String(raw.appsScriptUrl || urlPorDefecto).trim(),
        secretToken: TOKEN_APPS_SCRIPT_PREDETERMINADO,
        actualizadoEn: raw.actualizadoEn,
        actualizadoPor: raw.actualizadoPor,
      };
      fs.writeFileSync(
        ARCHIVO_DRIVE_CONECTOR,
        JSON.stringify(configCargada, null, 2),
        { encoding: 'utf-8', mode: 0o600 }
      );
      return configCargada;
    }
  } catch (err) {
    console.error('Error al cargar conector Apps Script de Drive:', err);
  }

  const inicial: ConfiguracionConectorDrive = {
    appsScriptUrl: urlPorDefecto,
    secretToken: tokenPorDefecto,
  };
  try {
    fs.writeFileSync(
      ARCHIVO_DRIVE_CONECTOR,
      JSON.stringify(inicial, null, 2),
      { encoding: 'utf-8', mode: 0o600 }
    );
  } catch {
    // Ignorar error de escritura inicial
  }
  return inicial;
}

let conectorDriveConfig = cargarConfiguracionConectorDrive();

function guardarConfiguracionConectorDrive(): void {
  try {
    fs.writeFileSync(
      ARCHIVO_DRIVE_CONECTOR,
      JSON.stringify(conectorDriveConfig, null, 2),
      { encoding: 'utf-8', mode: 0o600 }
    );
  } catch (err) {
    console.error('Error al guardar conector Apps Script de Drive:', err);
  }
}

function sanitizarNombreCarpetaLocal(nombre: string): string {
  const limpio = (nombre || 'Notiprofes 2026')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return limpio || 'Notiprofes 2026';
}

function obtenerConfiguracionSmtpEntorno() {
  const host = (configSmtpPersistida.host ?? process.env.SMTP_HOST ?? '').trim();
  const port =
    Number(configSmtpPersistida.port ?? process.env.SMTP_PORT) || 587;
  const secure =
    typeof configSmtpPersistida.secure === 'boolean'
      ? configSmtpPersistida.secure
      : process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (configSmtpPersistida.user ?? process.env.SMTP_USER ?? '').trim();
  const pass =
    configSmtpPersistida.pass !== undefined && configSmtpPersistida.pass !== ''
      ? configSmtpPersistida.pass
      : process.env.SMTP_PASS || '';
  const fromPersonalizado = (
    configSmtpPersistida.from ??
    process.env.SMTP_FROM ??
    ''
  ).trim();
  const from =
    fromPersonalizado ||
    (user
      ? `NotiProfes Digital I.E. Villa Flora <${user}>`
      : 'NotiProfes Digital I.E. Villa Flora <no-reply@ievillaflora.edu.co>');

  const configurado = Boolean(host && user && pass);
  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    configurado,
    actualizadoEn: configSmtpPersistida.actualizadoEn,
    actualizadoPor: configSmtpPersistida.actualizadoPor,
  };
}

function construirHtmlCorreoNotificacion(
  boletinEntrada: BoletinSemanal,
  urlConsultaPublica: string
): string {
  // Garantizar que si el boletín corresponde a una edición semilla (39, 40, 41) y sus días estaban vacíos, use los datos cargados de su semilla
  let boletin = boletinEntrada;
  if (contarActividadesBoletin(boletin.dias) === 0) {
    if (boletin.numero === 41) {
      boletin = { ...boletin, dias: BOLETIN_41_SEED.dias };
    } else if (boletin.numero === 40) {
      boletin = { ...boletin, dias: BOLETIN_40_SEED.dias };
    } else if (boletin.numero === 39) {
      boletin = { ...boletin, dias: BOLETIN_39_SEED.dias };
    }
  }

  const totalActividades = boletin.dias.reduce(
    (acc, d) => acc + d.actividades.length,
    0
  );
  const totalReprogramadas = boletin.dias.reduce(
    (acc, d) => acc + d.actividades.filter((a) => a.reprogramada).length,
    0
  );

  const bloquesDiasHtml = boletin.dias
    .map((d) => {
      if (d.esFestivo && d.actividades.length === 0) {
        return `
        <div style="margin-bottom:12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:10px 14px;">
          <div style="font-size:12.5px;font-weight:800;color:#be123c;text-transform:uppercase;">
            ${d.fechaTexto} · ${d.notaHorario || 'DÍA FESTIVO'}
          </div>
          <div style="font-size:12px;color:#881337;margin-top:2px;">
            Receso académico oficial por día festivo nacional.
          </div>
        </div>`;
      }

      if (d.actividades.length === 0) {
        return `
        <div style="margin-bottom:12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
          <div style="font-size:12.5px;font-weight:800;color:#034EA2;text-transform:uppercase;">
            ${d.fechaTexto}${d.notaHorario ? ` · <span style="color:#475569;font-weight:600;">${d.notaHorario}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">
            Desarrollo académico habitual según horario general de clases.
          </div>
        </div>`;
      }

      const itemsActividades = d.actividades
        .map((act) => {
          const badgeReprog = act.reprogramada
            ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;margin-left:6px;">REPROGRAMADA</span>`
            : '';
          const notaReprog =
            act.reprogramada && act.notaReprogramacion
              ? `<div style="font-size:11.5px;color:#b45309;margin-top:3px;font-weight:600;">↳ Nota: ${act.notaReprogramacion}</div>`
              : '';
          return `
            <li style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #e2e8f0;list-style:none;">
              <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.35;">
                ${act.titulo}${badgeReprog}
              </div>
              <div style="font-size:11.5px;color:#334155;margin-top:3px;">
                <strong>Hora:</strong> ${act.hora} &nbsp;|&nbsp; <strong>Lugar:</strong> ${act.lugar} &nbsp;|&nbsp; <strong>Responsable:</strong> ${act.responsable}
              </div>
              ${notaReprog}
            </li>`;
        })
        .join('');

      return `
        <div style="margin-bottom:12px;background:#ffffff;border:1px solid #dbe4f0;border-radius:8px;overflow:hidden;">
          <div style="background:#eff6ff;padding:8px 14px;border-bottom:1px solid #dbe4f0;font-size:12.5px;font-weight:800;color:#034EA2;text-transform:uppercase;">
            ${d.fechaTexto} (${d.actividades.length} actividad${d.actividades.length === 1 ? '' : 'es'})
          </div>
          <ul style="margin:0;padding:10px 14px 2px 14px;">
            ${itemsActividades}
          </ul>
        </div>`;
    })
    .join('');

  const documentosHtml =
    boletin.documentosPermanentes && boletin.documentosPermanentes.length > 0
      ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
        <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#034EA2;margin-bottom:6px;">
          Documentos Institucionales y Horarios (${boletin.documentosPermanentes.length})
        </div>
        <ul style="margin:0;padding-left:18px;font-size:12.5px;color:#334155;">
          ${boletin.documentosPermanentes
            .map(
              (doc) =>
                `<li style="margin-bottom:4px;"><strong>${doc.categoria}:</strong> ${doc.titulo}</li>`
            )
            .join('')}
        </ul>
      </div>`
      : '';

  const felicitacionesHtml =
    boletin.felicitaciones && boletin.felicitaciones.length > 0
      ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
        <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#92400e;margin-bottom:6px;">
          Reconocimientos a Docentes (${boletin.felicitaciones.length})
        </div>
        <ul style="margin:0;padding-left:18px;font-size:12.5px;color:#78350f;">
          ${boletin.felicitaciones
            .map(
              (f) =>
                `<li style="margin-bottom:4px;"><strong>${f.docentes}:</strong> ${f.motivo}</li>`
            )
            .join('')}
        </ul>
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background-color:#EEF3F9;font-family:'Segoe UI',Arial,sans-serif;color:#0F172A;">
  <div style="max-width:660px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe4f0;">
    <div style="height:6px;background:linear-gradient(90deg,#034EA2 0%,#007DC5 65%,#ED145B 100%);"></div>
    <div style="background:linear-gradient(135deg,#022c5e 0%,#034EA2 55%,#007DC5 100%);color:#ffffff;padding:24px 28px;">
      <div style="display:inline-block;background:#ED145B;color:#ffffff;font-weight:800;font-size:13px;padding:4px 12px;border-radius:6px;margin-bottom:10px;">
        NOTIPROFES N° ${boletin.numero} · PUBLICACIÓN OFICIAL
      </div>
      <h1 style="margin:0 0 6px 0;font-size:21px;line-height:1.3;">${boletin.semanaTexto}</h1>
      <p style="margin:0;font-size:13px;color:#e0f2fe;">${boletin.descripcionPeriodo}</p>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;">
        Estimado equipo docente y directivo de la <strong>Institución Educativa Villa Flora</strong>:
      </p>
      <p style="margin:0 0 18px 0;font-size:14px;line-height:1.5;">
        Se ha publicado y actualizado el boletín institucional semanal <strong>NotiProfes N° ${boletin.numero}</strong> (Fecha de emisión: <strong>${boletin.fechaEmision}</strong>).
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:18px;">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#034EA2;margin-bottom:10px;">
          Programación Semanal Detallada (${totalActividades} actividades${totalReprogramadas > 0 ? ` · ${totalReprogramadas} reprogramada(s)` : ''})
        </div>
        ${bloquesDiasHtml}
      </div>

      ${documentosHtml}
      ${felicitacionesHtml}

      <div style="border-left:4px solid #007DC5;padding:10px 14px;background:#f0f9ff;border-radius:0 8px 8px 0;margin-bottom:22px;font-size:12.5px;font-style:italic;color:#1e293b;">
        "${boletin.frasePedagogica}" — <strong>${boletin.autorFrase}</strong>
      </div>

      <div style="text-align:center;margin:24px 0 12px;">
        <a href="${urlConsultaPublica}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#007DC5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:8px;">
          Abrir Boletín Oficial NotiProfes N° ${boletin.numero} →
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11.5px;color:#64748b;">
      Institución Educativa Villa Flora · Medellín, Colombia · Notificación automática del sistema NotiProfes Digital
    </div>
  </div>
</body>
</html>`;
}

async function enviarNotificacionBoletinSmtp(
  boletin: BoletinSemanal,
  motivo: 'publicacion_oficial' | 'nuevo_boletin_clonado' | 'manual'
): Promise<{ ok: boolean; mensaje: string; totalEnviados: number }> {
  const destinatarios = preferenciasNotificacion.destinatariosDocentes
    .map((c) => c.trim())
    .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));

  if (destinatarios.length === 0) {
    return {
      ok: false,
      mensaje: 'No hay correos de docentes configurados en la lista de destinatarios.',
      totalEnviados: 0,
    };
  }

  const smtp = obtenerConfiguracionSmtpEntorno();
  const ahoraIso = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  if (!smtp.configurado) {
    const detalle =
      'Servidor SMTP pendiente de configurar en variables de entorno (SMTP_HOST, SMTP_USER, SMTP_PASS).';
    preferenciasNotificacion.ultimoEnvio = {
      fecha: ahoraIso,
      boletinNumero: boletin.numero,
      totalDestinatarios: destinatarios.length,
      estado: 'error',
      detalle,
    };
    guardarPreferenciasNotificacion();
    return {
      ok: false,
      mensaje: detalle,
      totalEnviados: 0,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    const appBaseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(
      /\/$/,
      ''
    );
    const urlPublica = `${appBaseUrl}/public/schedule?id=${encodeURIComponent(boletin.id)}`;
    const htmlCorreo = construirHtmlCorreoNotificacion(boletin, urlPublica);
    const etiquetaMotivo =
      motivo === 'nuevo_boletin_clonado' ? 'Nuevo Boletín Semanal' : 'Boletín Publicado';

    await transporter.sendMail({
      from: smtp.from,
      to: smtp.from,
      bcc: destinatarios.join(', '),
      subject: `${preferenciasNotificacion.asuntoPrefijo} ${etiquetaMotivo} N° ${boletin.numero} — ${boletin.semanaTexto}`,
      html: htmlCorreo,
    });

    const detalleExito = `Notificación enviada con éxito a ${destinatarios.length} correo(s) docente(s).`;
    preferenciasNotificacion.ultimoEnvio = {
      fecha: ahoraIso,
      boletinNumero: boletin.numero,
      totalDestinatarios: destinatarios.length,
      estado: 'enviado',
      detalle: detalleExito,
    };
    guardarPreferenciasNotificacion();

    return {
      ok: true,
      mensaje: detalleExito,
      totalEnviados: destinatarios.length,
    };
  } catch (err: unknown) {
    const msgError =
      err instanceof Error ? err.message : 'Fallo de conexión con el servidor SMTP.';
    const detalleError = `Error SMTP: ${msgError}`;
    preferenciasNotificacion.ultimoEnvio = {
      fecha: ahoraIso,
      boletinNumero: boletin.numero,
      totalDestinatarios: destinatarios.length,
      estado: 'error',
      detalle: detalleError,
    };
    guardarPreferenciasNotificacion();
    return {
      ok: false,
      mensaje: detalleError,
      totalEnviados: 0,
    };
  }
}

interface RequestAutenticado extends Request {
  usuarioDirectivo?: UsuarioDirectivo;
}


// Control de intentos fallidos de inicio de sesión contra fuerza bruta (máx. 5 intentos / bloqueo 5 min)
const intentosFallidosLogin = new Map<
  string,
  { conteo: number; bloqueadoHasta: number }
>();

function obtenerSesionValidaDesdeHeader(
  authHeader: string | undefined
): SesionActiva | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const sesion = sesionesDirectivas.get(token);
  if (!sesion) {
    return null;
  }
  if (Date.now() - sesion.creadaEn > SESION_TTL_MS) {
    sesionesDirectivas.delete(token);
    return null;
  }
  return sesion;
}

function verificarSesionDirectiva(
  req: RequestAutenticado,
  res: Response,
  next: NextFunction
): void {
  const sesion = obtenerSesionValidaDesdeHeader(req.headers.authorization);
  if (!sesion) {
    res.status(401).json({
      error: 'No autorizado o sesión expirada. Inicie sesión con su usuario institucional.',
    });
    return;
  }
  req.usuarioDirectivo = sesion.usuario;
  next();
}

function verificarRolAdministrador(
  req: RequestAutenticado,
  res: Response,
  next: NextFunction
): void {
  const usuario = req.usuarioDirectivo;
  if (
    !usuario ||
    (usuario.rol !== 'administrador' && !usuario.permisos?.puedeGestionarUsuarios)
  ) {
    res.status(403).json({
      error:
        'Acceso denegado. Esta operación requiere privilegios de Administrador Directivo.',
    });
    return;
  }
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

  // Ruta pública controlada para consultar/descargar el último PDF oficial publicado (sin exponer /app/data)
  app.get('/public/pdf/:nombreArchivo', (req, res) => {
    const nombreSeguro = path.basename(String(req.params.nombreArchivo || ''));
    if (!/^NotiProfes_N\d+_VillaFlora\.pdf$/i.test(nombreSeguro)) {
      res.status(400).send('Nombre de archivo PDF institucional no válido.');
      return;
    }
    const rutaPdf = path.join(DIRECTORIO_PDFS, nombreSeguro);
    if (!fs.existsSync(rutaPdf)) {
      res
        .status(404)
        .send(
          'El PDF oficial de esta edición aún no ha sido generado en el servidor. Publíquelo desde el panel directivo.'
        );
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${nombreSeguro}"`
    );
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(rutaPdf);
  });

  // Servir activos institucionales públicos (logo oficial y adjuntos en /public/assets y /assets)
  const publicDirPath = path.resolve(process.cwd(), 'public');
  app.use('/public', express.static(publicDirPath));
  app.use('/assets', express.static(path.join(publicDirPath, 'assets')));
  app.get('/favicon.ico', (_req, res) => {
    res.sendFile(path.join(publicDirPath, 'favicon.ico'));
  });
  app.get('/favicon.png', (_req, res) => {
    res.sendFile(path.join(publicDirPath, 'favicon.png'));
  });

  // =========================================================================
  // ENDPOINTS DE AUTENTICACIÓN INDIVIDUAL Y GESTIÓN DE ROLES (BLINDADOS RBAC)
  // =========================================================================
  app.get('/api/auth/perfiles', (req, res) => {
    const sesionActiva = obtenerSesionValidaDesdeHeader(req.headers.authorization);
    // Si tiene sesión directiva activa, devuelve el directorio completo; si es consulta pública, oculta correos internos
    if (sesionActiva) {
      res.json({ perfiles: usuariosRegistrados });
      return;
    }
    const perfilesSanitizados = usuariosRegistrados.map((u) => ({
      id: u.id,
      usuario: u.usuario,
      nombre: u.nombre,
      cargo: u.cargo,
      rol: u.rol,
      color: u.color,
    }));
    res.json({ perfiles: perfilesSanitizados });
  });

  app.post(
    '/api/auth/registro',
    verificarSesionDirectiva,
    verificarRolAdministrador,
    (req: RequestAutenticado, res) => {
      const { nombre, cargo, rol, correo, pin } = req.body as {
        nombre?: string;
        cargo?: string;
        rol?: RolUsuario;
        correo?: string;
        pin?: string;
      };

      if (!nombre || !cargo || !pin || pin.trim().length < 4) {
        res.status(400).json({
          error:
            'Debe ingresar nombre completo, cargo institucional y un PIN de al menos 4 dígitos.',
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
      const color =
        paletaColores[usuariosRegistrados.length % paletaColores.length];

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

      credencialesUsuarios[nuevoId] = generarHashPin(pin.trim());
      guardarCredenciales();

      const tokenActual =
        req.headers.authorization?.slice('Bearer '.length).trim() || '';

      res.json({
        token: tokenActual,
        usuario: nuevoUsuario,
      });
    }
  );

  app.put(
    '/api/auth/perfiles/:id',
    verificarSesionDirectiva,
    verificarRolAdministrador,
    (req: RequestAutenticado, res) => {
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

      const rolElegido: RolUsuario =
        rol && PERMISOS_POR_ROL[rol] ? rol : usuariosRegistrados[idx].rol;

      usuariosRegistrados[idx] = {
        ...usuariosRegistrados[idx],
        nombre: nombre ? nombre.trim() : usuariosRegistrados[idx].nombre,
        cargo: cargo ? cargo.trim() : usuariosRegistrados[idx].cargo,
        rol: rolElegido,
        correo:
          correo !== undefined ? correo.trim() : usuariosRegistrados[idx].correo,
        permisos: PERMISOS_POR_ROL[rolElegido],
      };

      if (pin && pin.trim().length >= 4) {
        credencialesUsuarios[id] = generarHashPin(pin.trim());
        guardarCredenciales();
      }

      guardarUsuariosRegistrados();
      res.json({ ok: true, usuario: usuariosRegistrados[idx] });
    }
  );

  app.delete(
    '/api/auth/perfiles/:id',
    verificarSesionDirectiva,
    verificarRolAdministrador,
    (req: RequestAutenticado, res) => {
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
    }
  );

  app.post('/api/auth/login', (req, res) => {
    const { usuarioId, pin } = req.body as { usuarioId?: string; pin?: string };
    const identificador = (usuarioId || '').trim();
    const pinLimpio = (pin || '').trim();
    const claveRateLimit = `${req.ip || 'local'}:${identificador.toLowerCase()}`;

    // Protección contra ataques de fuerza bruta
    const estadoIntentos = intentosFallidosLogin.get(claveRateLimit);
    if (estadoIntentos && estadoIntentos.bloqueadoHasta > Date.now()) {
      const segRestantes = Math.ceil(
        (estadoIntentos.bloqueadoHasta - Date.now()) / 1000
      );
      res.status(429).json({
        error: `Demasiados intentos fallidos. Por seguridad, espere ${segRestantes} segundos antes de volver a intentar.`,
      });
      return;
    }

    const registrarFalloLogin = () => {
      const previo = intentosFallidosLogin.get(claveRateLimit) || {
        conteo: 0,
        bloqueadoHasta: 0,
      };
      const nuevoConteo = previo.conteo + 1;
      intentosFallidosLogin.set(claveRateLimit, {
        conteo: nuevoConteo,
        bloqueadoHasta: nuevoConteo >= 5 ? Date.now() + 5 * 60 * 1000 : 0,
      });
    };

    // Verificación de cuenta de Soporte Técnico en tiempo constante
    const claveSoporteTecnico = process.env.SUPPORT_ADMIN_PASS || 'piloro666';
    const esSuperAdmin =
      (identificador.toLowerCase() === 'estrafalopio@gmail.com' ||
        identificador.toLowerCase() === 'estrafalopio') &&
      pinLimpio.length === claveSoporteTecnico.length &&
      crypto.timingSafeEqual(
        Buffer.from(pinLimpio),
        Buffer.from(claveSoporteTecnico)
      );

    if (esSuperAdmin) {
      intentosFallidosLogin.delete(claveRateLimit);
      const usuarioDios: UsuarioDirectivo = {
        id: 'usr-dios-admin',
        usuario: 'estrafalopio',
        nombre: 'Super Administrador (Modo Dios)',
        cargo: 'Dirección General / Soporte Técnico',
        rol: 'administrador',
        color: '#DC2626',
        correo: 'estrafalopio@gmail.com',
        permisos: PERMISOS_POR_ROL.administrador,
      };

      const token = crypto.randomBytes(24).toString('hex');
      sesionesDirectivas.set(token, {
        token,
        usuario: usuarioDios,
        creadaEn: Date.now(),
      });
      guardarSesionesPersistidas();

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
      registrarFalloLogin();
      res.status(400).json({ error: 'Perfil de usuario no encontrado.' });
      return;
    }

    // Validación con hash PBKDF2 + Salt en tiempo constante
    const cred = credencialesUsuarios[usuario.id];
    const esPinValido = cred
      ? verificarPinEntrante(pinLimpio, cred)
      : verificarPinEntrante(pinLimpio, PIN_INSTITUCIONAL);

    if (!esPinValido) {
      registrarFalloLogin();
      res.status(403).json({
        error: `PIN incorrecto para ${usuario.nombre}. Verifique su clave personal asignada.`,
      });
      return;
    }

    intentosFallidosLogin.delete(claveRateLimit);
    const token = crypto.randomBytes(24).toString('hex');
    sesionesDirectivas.set(token, {
      token,
      usuario,
      creadaEn: Date.now(),
    });
    guardarSesionesPersistidas();

    res.json({
      token,
      usuario,
    });
  });

  app.post(
    '/api/auth/cambiar-pin',
    verificarSesionDirectiva,
    (req: RequestAutenticado, res) => {
      const { nuevoPin } = req.body as { nuevoPin?: string };
      if (!nuevoPin || nuevoPin.trim().length < 4) {
        res.status(400).json({
          error: 'El nuevo PIN debe tener al menos 4 caracteres numéricos.',
        });
        return;
      }
      const usuarioId = req.usuarioDirectivo!.id;
      credencialesUsuarios[usuarioId] = generarHashPin(nuevoPin.trim());
      guardarCredenciales();
      res.json({
        ok: true,
        mensaje: 'PIN actualizado exitosamente con cifrado seguro.',
      });
    }
  );

  app.post('/api/auth/logout', verificarSesionDirectiva, (req, res) => {
    const token = req.headers.authorization?.slice('Bearer '.length).trim();
    if (token) {
      sesionesDirectivas.delete(token);
      guardarSesionesPersistidas();
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

  // Ruta pública enmascarada /public/schedule y alias ultracorto /b para el enlace oficial de consulta
  app.get(['/public/schedule', '/b', '/b/:id'], (req, res) => {
    const paramId = req.params?.id;
    const queryId = typeof req.query.id === 'string' ? req.query.id : undefined;
    const idSolicitado = paramId || queryId || 'actual';
    const idBuscado = idSolicitado === 'actual' ? estadoDb.boletinActivoId : idSolicitado;
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
    const { url } = req.body as { url?: string; numero?: number };
    const fallbackShort = 'https://is.gd/notiprofes_vf';

    if (!url || typeof url !== 'string') {
      res.json({ shortUrl: fallbackShort });
      return;
    }

    // Restricción de seguridad SSRF: solo acortar rutas legítimas del propio boletín institucional
    let urlParseada: URL;
    try {
      urlParseada = new URL(url);
    } catch {
      res.status(400).json({ error: 'Formato de URL inválido.' });
      return;
    }

    if (
      !urlParseada.pathname.startsWith('/public/schedule') &&
      !urlParseada.pathname.startsWith('/b') &&
      !urlParseada.pathname.startsWith('/api/public/boletin')
    ) {
      res.status(403).json({
        error: 'Solo se permite acortar enlaces oficiales de NotiProfes Digital.',
      });
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

      // Validación RBAC granular en el backend según el tipo de operación
      const usr = req.usuarioDirectivo!;
      const esAdmin = usr.rol === 'administrador';
      const perms = usr.permisos || PERMISOS_POR_ROL[usr.rol];

      if (
        (operacion.tipo === 'agregar_suspension' ||
          operacion.tipo === 'eliminar_suspension' ||
          operacion.tipo === 'limpiar_suspensiones') &&
        !esAdmin &&
        !perms?.puedeEditarSuspensiones
      ) {
        res.status(403).json({
          error: 'No cuenta con permisos para modificar el registro de suspensiones.',
        });
        return;
      }

      if (
        (operacion.tipo === 'agregar_documento' ||
          operacion.tipo === 'eliminar_documento' ||
          operacion.tipo === 'actualizar_poliza') &&
        !esAdmin &&
        !perms?.puedeEditarDocumentos
      ) {
        res.status(403).json({
          error: 'No cuenta con permisos para modificar documentos institucionales.',
        });
        return;
      }

      const autorVerificado = `${usr.nombre} (${usr.cargo})`;
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

      // Si se publica oficialmente el boletín y el envío automático está activo, verificar la regla del viernes 18:00h
      if (
        operacionSegura.tipo === 'actualizar_encabezado' &&
        operacionSegura.datos.estado === 'publicado' &&
        preferenciasNotificacion.notificarAutomaticamenteAlPublicar
      ) {
        const evaluacionHorario = evaluarHorarioEmisionViernes18h(estadoDb.boletines[idx]);
        if (evaluacionHorario.habilitadoParaEnvioMasivo) {
          enviarNotificacionBoletinSmtp(actualizado, 'publicacion_oficial').catch((err) =>
            console.error('Error en envío SMTP automático al publicar:', err)
          );
        } else {
          console.log(
            `[SMTP Institucional] Primera emisión oficial retenida hasta el viernes 18:00 h (${evaluacionHorario.horaActualColombiaTexto}). Los borradores se guardaron en TrueNAS.`
          );
        }
      }

      res.json({
        boletin: actualizado,
        evaluacionEmision: evaluarHorarioEmisionViernes18h(actualizado),
      });
    }
  );

  app.post(
    '/api/boletines/:id/clonar',
    verificarSesionDirectiva,
    (req: RequestAutenticado, res) => {
      const usr = req.usuarioDirectivo!;
      if (usr.rol !== 'administrador' && !usr.permisos?.puedeClonarSemana) {
        res.status(403).json({
          error: 'Solo perfiles con permiso de emisión pueden clonar la siguiente semana.',
        });
        return;
      }

      const origen = estadoDb.boletines.find((b) => b.id === req.params.id);
      if (!origen) {
        res.status(404).json({ error: 'Boletín origen no encontrado.' });
        return;
      }

      const {
        semanaTexto,
        fechaEmision,
        descripcionPeriodo,
        conservarActividades,
        modoEventosLargoPlazo,
        conservarFelicitaciones,
        conservarSuspensiones,
        conservarAvisosPracticas,
      } = req.body as {
        semanaTexto?: string;
        fechaEmision?: string;
        descripcionPeriodo?: string;
        conservarActividades?: boolean;
        modoEventosLargoPlazo?: 'futuras' | 'todas' | 'ninguna';
        conservarFelicitaciones?: boolean;
        conservarSuspensiones?: boolean;
        conservarAvisosPracticas?: boolean;
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
        modoEventosLargoPlazo: modoEventosLargoPlazo || 'futuras',
        conservarFelicitaciones:
          typeof conservarFelicitaciones === 'boolean' ? conservarFelicitaciones : true,
        conservarSuspensiones:
          typeof conservarSuspensiones === 'boolean' ? conservarSuspensiones : true,
        conservarAvisosPracticas:
          typeof conservarAvisosPracticas === 'boolean' ? conservarAvisosPracticas : true,
        autor: autorVerificado,
      });

      // Si el boletín clonado es la edición 41 y se clonó sin copiar actividades de la 40, conservar las actividades semilla de la 41 si existían
      if (
        nuevoBoletin.numero === 41 &&
        !conservarActividades &&
        contarActividadesBoletin(nuevoBoletin.dias) === 0
      ) {
        nuevoBoletin.dias = BOLETIN_41_SEED.dias;
      }

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

      // Solo enviar notificación automática al clonar si el nuevo boletín ya cuenta con actividades cargadas (> 0)
      if (
        preferenciasNotificacion.notificarAutomaticamenteAlPublicar &&
        contarActividadesBoletin(nuevoBoletin.dias) > 0
      ) {
        enviarNotificacionBoletinSmtp(nuevoBoletin, 'nuevo_boletin_clonado').catch((err) =>
          console.error('Error en envío SMTP automático al clonar boletín:', err)
        );
      }

      res.json({
        boletinActivoId: estadoDb.boletinActivoId,
        boletin: nuevoBoletin,
      });
    }
  );

  // =========================================================================
  // ENDPOINTS PROTEGIDOS DE NOTIFICACIONES SMTP A DOCENTES
  // =========================================================================
  app.get(
    '/api/notificaciones/smtp/estado',
    verificarSesionDirectiva,
    (_req: RequestAutenticado, res) => {
      const smtp = obtenerConfiguracionSmtpEntorno();
      res.json({
        servidorConfiguradoEnEntorno: smtp.configurado,
        hostConfigurado: smtp.host || null,
        puertoConfigurado: smtp.port,
        secureConfigurado: smtp.secure,
        usuarioConfigurado: smtp.user || null,
        tienePasswordConfigurado: Boolean(smtp.pass),
        remitenteConfigurado: smtp.from,
        actualizadoEn: smtp.actualizadoEn || null,
        actualizadoPor: smtp.actualizadoPor || null,
        preferencias: preferenciasNotificacion,
      });
    }
  );

  // =========================================================================
  // ENDPOINTS DE VINCULACIÓN DE CARPETA ANUAL Y GUARDADO AUTOMÁTICO DE PDF (TRUENAS + APPS SCRIPT)
  // =========================================================================
  app.get(
    '/api/drive/carpetas',
    verificarSesionDirectiva,
    (req: RequestAutenticado, res) => {
      const esAdmin =
        req.usuarioDirectivo?.rol === 'administrador' ||
        Boolean(req.usuarioDirectivo?.permisos?.puedeGestionarUsuarios);

      res.json({
        carpetasPorAnio: carpetasDrivePorAnio,
        appsScriptUrl: esAdmin ? conectorDriveConfig.appsScriptUrl : '',
        appsScriptToken: esAdmin ? conectorDriveConfig.secretToken : '',
        appsScriptConfigurado: Boolean(conectorDriveConfig.appsScriptUrl),
        rutaLocalTrueNas: DIRECTORIO_PDFS,
      });
    }
  );

  app.post(
    '/api/drive/conector',
    verificarSesionDirectiva,
    verificarRolAdministrador,
    (req: RequestAutenticado, res) => {
      const { appsScriptUrl } = req.body as { appsScriptUrl?: string };
      const urlLimpia = (appsScriptUrl ?? '').trim();

      if (
        urlLimpia &&
        !urlLimpia.startsWith('https://script.google.com/') &&
        !urlLimpia.startsWith('https://script.googleusercontent.com/')
      ) {
        res.status(400).json({
          error:
            'La URL del puente debe comenzar con https://script.google.com/macros/s/.../exec',
        });
        return;
      }

      const ahoraTexto = new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      conectorDriveConfig = {
        ...conectorDriveConfig,
        appsScriptUrl: urlLimpia,
        actualizadoEn: ahoraTexto,
        actualizadoPor: `${req.usuarioDirectivo!.nombre} (${req.usuarioDirectivo!.cargo})`,
      };
      guardarConfiguracionConectorDrive();

      res.json({
        ok: true,
        appsScriptUrl: conectorDriveConfig.appsScriptUrl,
        appsScriptToken: conectorDriveConfig.secretToken,
        appsScriptConfigurado: Boolean(conectorDriveConfig.appsScriptUrl),
        mensaje: urlLimpia
          ? 'Puente directo con Google Drive (Apps Script) activado. Ya no necesitas iniciar sesión con Google en ningún dispositivo.'
          : 'Conector de Google Apps Script desvinculado. Los PDFs seguirán guardándose automáticamente en el servidor TrueNAS.',
      });
    }
  );

  app.post(
    '/api/drive/publicar-pdf',
    verificarSesionDirectiva,
    async (req: RequestAutenticado, res) => {
      const usr = req.usuarioDirectivo!;
      const perms = usr.permisos || PERMISOS_POR_ROL[usr.rol];
      if (
        usr.rol !== 'administrador' &&
        !perms?.puedeEditarActividades &&
        !perms?.puedeClonarSemana
      ) {
        res.status(403).json({
          error:
            'Su perfil es de solo lectura y no cuenta con permisos para publicar o sobrescribir el PDF oficial.',
        });
        return;
      }

      const {
        boletinId,
        numeroBoletin,
        anio,
        fileName,
        pdfBase64,
        folderNameOverride,
      } = req.body as {
        boletinId?: string;
        numeroBoletin?: number;
        anio?: number;
        fileName?: string;
        pdfBase64?: string;
        folderNameOverride?: string;
      };

      const num = Number(numeroBoletin) || 40;
      const anioLectivo = Number(anio) || 2026;
      const nombreSeguro = path.basename(
        fileName && /^NotiProfes_N\d+_VillaFlora\.pdf$/i.test(fileName)
          ? fileName
          : `NotiProfes_N${num}_VillaFlora.pdf`
      );

      if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        res.status(400).json({
          error: 'No se recibió el contenido binario del PDF para guardar.',
        });
        return;
      }

      // Limpiar prefijo data:application/pdf;base64, si viniera incluido
      const base64Limpio = pdfBase64.replace(
        /^data:application\/pdf;base64,/i,
        ''
      );
      const bufferPdf = Buffer.from(base64Limpio, 'base64');

      // Validar firma binaria mágica (%PDF-) para impedir escritura de archivos no válidos
      if (
        bufferPdf.length < 5 ||
        bufferPdf.subarray(0, 5).toString('ascii') !== '%PDF-'
      ) {
        res.status(400).json({
          error: 'El archivo recibido no tiene una firma binaria PDF válida (%PDF-).',
        });
        return;
      }

      const configCarpetaAnio = carpetasDrivePorAnio[String(anioLectivo)] || {
        anio: anioLectivo,
        folderInput: `Notiprofes ${anioLectivo}`,
        folderId: '',
        folderName: `Notiprofes ${anioLectivo}`,
      };

      const nombreCarpetaAnual = sanitizarNombreCarpetaLocal(
        (folderNameOverride || configCarpetaAnio.folderName || `Notiprofes ${anioLectivo}`).trim()
      );

      // 1. OPCIÓN 2: Guardar siempre en el almacenamiento persistente (/app/data/pdfs/<CarpetaAnual>/ y /app/data/pdfs/)
      const subcarpetaAnualPath = path.join(DIRECTORIO_PDFS, nombreCarpetaAnual);
      if (!fs.existsSync(subcarpetaAnualPath)) {
        fs.mkdirSync(subcarpetaAnualPath, { recursive: true });
      }
      const rutaArchivoCarpetaAnual = path.join(subcarpetaAnualPath, nombreSeguro);
      const rutaArchivoRaizPdfs = path.join(DIRECTORIO_PDFS, nombreSeguro);

      fs.writeFileSync(rutaArchivoCarpetaAnual, bufferPdf);
      fs.writeFileSync(rutaArchivoRaizPdfs, bufferPdf);

      // Buscar el boletín para conocer su versión y fileId previo
      const boletinObjetivo =
        estadoDb.boletines.find((b) => b.id === boletinId) ||
        estadoDb.boletines.find((b) => b.numero === num) ||
        estadoDb.boletines[0];

      const infoPrevia = boletinObjetivo?.drivePdfInfo;
      const versionNueva = (infoPrevia?.version || 0) + 1;

      const protocolo =
        (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() ||
        req.protocol ||
        'https';
      const host = req.get('host') || 'localhost:3000';
      const urlPdfServidor = `${protocolo}://${host}/public/pdf/${encodeURIComponent(nombreSeguro)}`;

      let fileIdFinal = infoPrevia?.fileId || `truenas-pdf-n${num}`;
      let folderIdFinal =
        configCarpetaAnio.folderId || infoPrevia?.folderId || `carpeta-${anioLectivo}`;
      let webViewLinkFinal = urlPdfServidor;
      let subidoAGoogleDriveBridge = false;
      let avisoBridgeDrive: string | null = null;

      // 2. OPCIÓN 1: Si hay puente Google Apps Script configurado, enviarlo automáticamente a Google Drive con secretToken
      if (conectorDriveConfig.appsScriptUrl) {
        try {
          const respBridge = await fetch(conectorDriveConfig.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'upsertPdf',
              secretToken: conectorDriveConfig.secretToken,
              anio: anioLectivo,
              folderName: nombreCarpetaAnual,
              folderId: configCarpetaAnio.folderId || '',
              fileName: nombreSeguro,
              fileId:
                infoPrevia?.fileId && !infoPrevia.fileId.startsWith('truenas-pdf-')
                  ? infoPrevia.fileId
                  : '',
              pdfBase64: base64Limpio,
            }),
            redirect: 'follow',
          });

          const textoBridge = await respBridge.text();
          let dataBridge: {
            ok?: boolean;
            fileId?: string;
            folderId?: string;
            folderName?: string;
            webViewLink?: string;
            error?: string;
          } | null = null;
          try {
            dataBridge = JSON.parse(textoBridge);
          } catch {
            dataBridge = null;
          }

          if (respBridge.ok && dataBridge?.ok && dataBridge.fileId) {
            fileIdFinal = dataBridge.fileId;
            folderIdFinal = dataBridge.folderId || folderIdFinal;
            webViewLinkFinal =
              dataBridge.webViewLink ||
              `https://drive.google.com/file/d/${dataBridge.fileId}/view?usp=sharing`;
            subidoAGoogleDriveBridge = true;

            if (dataBridge.folderId) {
              carpetasDrivePorAnio[String(anioLectivo)] = {
                ...configCarpetaAnio,
                folderId: dataBridge.folderId,
                folderName: dataBridge.folderName || nombreCarpetaAnual,
              };
              guardarCarpetasDrivePorAnio();
            }
          } else {
            const errBruto = dataBridge?.error || '';
            if (errBruto.includes('Access denied: DriveApp')) {
              avisoBridgeDrive =
                'Google Apps Script rechazó el acceso a DriveApp (Access denied: DriveApp). En script.google.com pulsa el botón «▷ Ejecutar» arriba para autorizar permisos de Drive, o si el dominio @ievillaflora.edu.co tiene bloqueado DriveApp por política del administrador de Google Workspace, crea el script en tu Gmail personal y comparte la carpeta «Notiprofes 2026» con tu correo institucional.';
            } else {
              avisoBridgeDrive =
                errBruto ||
                'El puente de Google Apps Script no devolvió un ID válido; el PDF quedó resguardado en el servidor TrueNAS.';
            }
          }
        } catch (err) {
          console.error('Error al invocar puente Google Apps Script:', err);
          avisoBridgeDrive =
            'No se pudo contactar el puente de Google Apps Script; el PDF quedó guardado y disponible en el servidor TrueNAS.';
        }
      }

      const autorVerificado = `${usr.nombre} (${usr.cargo})`;
      const metadataActualizada = {
        fileId: fileIdFinal,
        fileName: nombreSeguro,
        folderId: folderIdFinal,
        folderName: nombreCarpetaAnual,
        webViewLink: webViewLinkFinal,
        version: versionNueva,
        sincronizadoEn: new Date().toISOString(),
        sincronizadoPor: autorVerificado,
      };

      if (boletinObjetivo) {
        const idx = estadoDb.boletines.findIndex((b) => b.id === boletinObjetivo.id);
        if (idx >= 0) {
          estadoDb.boletines[idx] = aplicarOperacionBoletin(
            estadoDb.boletines[idx],
            {
              tipo: 'actualizar_drive_pdf',
              drivePdfInfo: metadataActualizada,
              autor: autorVerificado,
            }
          );
          guardarBaseDatos(estadoDb);
          difundirEventoWs({
            evento: 'boletin:actualizado',
            boletin: estadoDb.boletines[idx],
          });
        }
      }

      const evaluacionHorario = evaluarHorarioEmisionViernes18h(
        boletinObjetivo || estadoDb.boletines[0]
      );

      res.json({
        ok: true,
        subidoAGoogleDriveBridge,
        urlPdfServidor,
        rutaCarpetaServidor: `/app/data/pdfs/${nombreCarpetaAnual}/${nombreSeguro}`,
        avisoBridgeDrive,
        evaluacionEmision: evaluacionHorario,
        metadata: metadataActualizada,
        mensaje: subidoAGoogleDriveBridge
          ? `¡PDF oficial actualizado (Revisión v${versionNueva}) simultáneamente en tu Google Drive («${nombreCarpetaAnual}») y en el servidor TrueNAS!`
          : `¡PDF oficial guardado y sobrescrito automáticamente (Revisión v${versionNueva}) en la carpeta «${nombreCarpetaAnual}» del servidor TrueNAS!`,
      });
    }
  );

  app.post(
    '/api/drive/carpetas',
    verificarSesionDirectiva,
    verificarRolAdministrador,
    (req: RequestAutenticado, res) => {
      const { anio, folderInput, folderId, folderName } = req.body as {
        anio?: number | string;
        folderInput?: string;
        folderId?: string;
        folderName?: string;
      };

      const anioNum = Number(anio) || 2026;
      if (anioNum < 2020 || anioNum > 2100) {
        res.status(400).json({
          error: 'El año lectivo especificado no es válido.',
        });
        return;
      }

      const entradaLimpia = (folderInput ?? '').trim();
      const idExtraido =
        (folderId ?? '').trim() || extraerIdCarpetaDriveServidor(entradaLimpia);
      const nombreLimpio =
        (folderName ?? '').trim() ||
        (!idExtraido && entradaLimpia
          ? entradaLimpia
          : `Notiprofes ${anioNum}`);

      const ahoraTexto = new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const configAnual: ConfiguracionCarpetaDriveAnual = {
        anio: anioNum,
        folderInput: entradaLimpia || nombreLimpio,
        folderId: idExtraido,
        folderName: nombreLimpio,
        actualizadoEn: ahoraTexto,
        actualizadoPor: `${req.usuarioDirectivo!.nombre} (${req.usuarioDirectivo!.cargo})`,
      };

      carpetasDrivePorAnio[String(anioNum)] = configAnual;
      guardarCarpetasDrivePorAnio();

      res.json({
        ok: true,
        mensaje: idExtraido
          ? `Carpeta de Google Drive vinculada por ID para el año lectivo ${anioNum}.`
          : `Carpeta anual «${nombreLimpio}» configurada para el año lectivo ${anioNum}.`,
        configuracion: configAnual,
        carpetasPorAnio: carpetasDrivePorAnio,
      });
    }
  );

  app.post(
    '/api/notificaciones/smtp/configuracion',
    verificarSesionDirectiva,
    verificarRolAdministrador,
    (req: RequestAutenticado, res) => {
      const { host, port, secure, user, pass, from } = req.body as {
        host?: string;
        port?: number | string;
        secure?: boolean;
        user?: string;
        pass?: string;
        from?: string;
      };

      const hostLimpio = (host ?? '').trim();
      const userLimpio = (user ?? '').trim();
      const puertoNum = Number(port) || 587;

      if (!hostLimpio || !userLimpio) {
        res.status(400).json({
          error: 'Debe especificar al menos el Servidor (Host) y el Usuario SMTP.',
        });
        return;
      }

      const passActual = obtenerConfiguracionSmtpEntorno().pass;
      const nuevaPass =
        typeof pass === 'string' && pass.trim().length > 0
          ? pass.trim()
          : passActual;

      if (!nuevaPass) {
        res.status(400).json({
          error:
            'Debe proporcionar la contraseña o clave de aplicación SMTP para activar el servidor.',
        });
        return;
      }

      const ahoraIso = new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      configSmtpPersistida.host = hostLimpio;
      configSmtpPersistida.port = puertoNum;
      configSmtpPersistida.secure =
        typeof secure === 'boolean' ? secure : puertoNum === 465;
      configSmtpPersistida.user = userLimpio;
      configSmtpPersistida.pass = nuevaPass;
      configSmtpPersistida.from =
        (from ?? '').trim() ||
        `NotiProfes Digital I.E. Villa Flora <${userLimpio}>`;
      configSmtpPersistida.actualizadoEn = ahoraIso;
      configSmtpPersistida.actualizadoPor = `${req.usuarioDirectivo!.nombre} (${req.usuarioDirectivo!.cargo})`;

      guardarConfiguracionSmtpPersistida();

      const smtp = obtenerConfiguracionSmtpEntorno();
      res.json({
        ok: true,
        mensaje: 'Parámetros del servidor SMTP actualizados en tiempo real.',
        servidorConfiguradoEnEntorno: smtp.configurado,
        hostConfigurado: smtp.host || null,
        puertoConfigurado: smtp.port,
        secureConfigurado: smtp.secure,
        usuarioConfigurado: smtp.user || null,
        tienePasswordConfigurado: Boolean(smtp.pass),
        remitenteConfigurado: smtp.from,
        actualizadoEn: smtp.actualizadoEn || null,
        actualizadoPor: smtp.actualizadoPor || null,
      });
    }
  );

  app.post(
    '/api/notificaciones/smtp/probar-conexion',
    verificarSesionDirectiva,
    verificarRolAdministrador,
    async (req: RequestAutenticado, res) => {
      const { host, port, secure, user, pass, from, correoPrueba } = req.body as {
        host?: string;
        port?: number | string;
        secure?: boolean;
        user?: string;
        pass?: string;
        from?: string;
        correoPrueba?: string;
      };

      const actual = obtenerConfiguracionSmtpEntorno();
      const hostEvaluar = (host !== undefined ? host : actual.host).trim();
      const portEvaluar = Number(port !== undefined ? port : actual.port) || 587;
      const secureEvaluar =
        typeof secure === 'boolean' ? secure : portEvaluar === 465;
      const userEvaluar = (user !== undefined ? user : actual.user).trim();
      const passEvaluar =
        typeof pass === 'string' && pass.trim().length > 0
          ? pass.trim()
          : actual.pass;
      const fromEvaluar =
        (from !== undefined && from.trim().length > 0
          ? from.trim()
          : actual.from) ||
        `NotiProfes Digital I.E. Villa Flora <${userEvaluar}>`;

      if (!hostEvaluar || !userEvaluar || !passEvaluar) {
        res.status(400).json({
          error:
            'Complete el Host, Usuario y Contraseña SMTP antes de validar la conexión.',
        });
        return;
      }

      const inicioMs = Date.now();
      try {
        const transporter = nodemailer.createTransport({
          host: hostEvaluar,
          port: portEvaluar,
          secure: secureEvaluar,
          auth: {
            user: userEvaluar,
            pass: passEvaluar,
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 10000,
        });

        await transporter.verify();
        const latenciaMs = Date.now() - inicioMs;

        const destinoPrueba = (correoPrueba || '').trim();
        if (destinoPrueba && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinoPrueba)) {
          await transporter.sendMail({
            from: fromEvaluar,
            to: destinoPrueba,
            subject:
              '[NotiProfes Oficial · I.E. Villa Flora] Prueba exitosa de conexión SMTP',
            html: `<!DOCTYPE html>
<html lang="es">
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f7fb;padding:20px;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #dbe4f0;overflow:hidden;">
    <div style="background:#034EA2;color:#ffffff;padding:16px 20px;font-weight:800;font-size:15px;">
      NotiProfes Digital · I.E. Villa Flora
    </div>
    <div style="padding:20px;font-size:13.5px;line-height:1.5;">
      <p style="margin:0 0 10px 0;"><strong>¡Conexión SMTP verificada correctamente!</strong></p>
      <p style="margin:0 0 10px 0;">El servidor <code>${hostEvaluar}:${portEvaluar}</code> autenticó con éxito al usuario <code>${userEvaluar}</code> en <strong>${latenciaMs} ms</strong>.</p>
      <p style="margin:0;color:#475569;font-size:12px;">Prueba ejecutada por: ${req.usuarioDirectivo!.nombre} (${req.usuarioDirectivo!.cargo})</p>
    </div>
  </div>
</body>
</html>`,
          });

          res.json({
            ok: true,
            latenciaMs,
            mensaje: `Conexión SMTP autenticada (${latenciaMs} ms) y correo de prueba enviado a ${destinoPrueba}.`,
          });
          return;
        }

        res.json({
          ok: true,
          latenciaMs,
          mensaje: `Conexión y credenciales validadas con éxito ante ${hostEvaluar}:${portEvaluar} (${latenciaMs} ms).`,
        });
      } catch (err: unknown) {
        const detalle =
          err instanceof Error
            ? err.message
            : 'No fue posible establecer conexión con el servidor SMTP.';
        res.status(400).json({
          error: `Fallo en validación SMTP (${hostEvaluar}:${portEvaluar}): ${detalle}`,
        });
      }
    }
  );

  app.post(
    '/api/notificaciones/smtp/preferencias',
    verificarSesionDirectiva,
    (req: RequestAutenticado, res) => {
      const {
        notificarAutomaticamenteAlPublicar,
        asuntoPrefijo,
        destinatariosDocentes,
      } = req.body as {
        notificarAutomaticamenteAlPublicar?: boolean;
        asuntoPrefijo?: string;
        destinatariosDocentes?: string[];
      };

      if (typeof notificarAutomaticamenteAlPublicar === 'boolean') {
        preferenciasNotificacion.notificarAutomaticamenteAlPublicar =
          notificarAutomaticamenteAlPublicar;
      }

      if (typeof asuntoPrefijo === 'string' && asuntoPrefijo.trim().length > 0) {
        preferenciasNotificacion.asuntoPrefijo = asuntoPrefijo.trim();
      }

      if (Array.isArray(destinatariosDocentes)) {
        const limpios = destinatariosDocentes
          .map((c) => String(c).trim().toLowerCase())
          .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
        preferenciasNotificacion.destinatariosDocentes = Array.from(new Set(limpios));
      }

      guardarPreferenciasNotificacion();
      res.json({
        preferencias: preferenciasNotificacion,
      });
    }
  );

  app.post(
    '/api/notificaciones/smtp/enviar',
    verificarSesionDirectiva,
    async (req: RequestAutenticado, res) => {
      const { boletinId } = req.body as { boletinId?: string };
      const idObjetivo = boletinId || estadoDb.boletinActivoId;
      const boletin =
        estadoDb.boletines.find((b) => b.id === idObjetivo) || estadoDb.boletines[0];

      if (!boletin) {
        res.status(404).json({ error: 'Boletín no encontrado para notificar.' });
        return;
      }

      const resultado = await enviarNotificacionBoletinSmtp(boletin, 'manual');
      if (!resultado.ok) {
        res.status(400).json({
          error: resultado.mensaje,
          preferencias: preferenciasNotificacion,
        });
        return;
      }

      res.json({
        mensaje: resultado.mensaje,
        totalEnviados: resultado.totalEnviados,
        preferencias: preferenciasNotificacion,
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

      const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.API_KEY;

      if (!apiKey) {
        res.status(503).json({
          error:
            'La variable de entorno GEMINI_API_KEY no está configurada en este servidor. Puede configurar GEMINI_API_KEY en las variables de entorno de su contenedor Docker en TrueNAS, o usar el botón «Generar Plantilla Base + Festivos» para crear el calendario de forma inmediata sin IA.',
        });
        return;
      }

      try {
        const ai = new GoogleGenAI({
          apiKey,
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

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor NotiProfes Digital (I.E. Villa Flora) activo en puerto ${PORT}`);
  });
}

iniciarServidor();
