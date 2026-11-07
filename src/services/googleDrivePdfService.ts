import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { jsPDF } from 'jspdf';
import firebaseConfig from '../../firebase-applet-config.json';
import { BoletinSemanal, DrivePdfMetadata } from '../types/notiprofes';
import {
  calcularEstadoCalendarioBoletin,
  obtenerCalendarioOficialBoletin,
} from '../utils/calendarioEscolar2026';

// Permisos mínimos requeridos para crear y actualizar los PDFs oficiales en Google Drive
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Caché en memoria para el token OAuth y perfil de usuario (nunca en localStorage ni sessionStorage por seguridad)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUserEmail: string | null = null;

export interface PerfilGoogleConectado {
  email: string | null;
  displayName: string | null;
  metodo?: 'firebase' | 'gis';
}

export interface InfoDominioAutorizacion {
  hostname: string;
  origin: string;
  truenasHostname: string;
  truenasOrigin: string;
  projectId: string;
  oAuthClientId: string;
  firebaseAuthSettingsUrl: string;
  googleCloudCredentialsUrl: string;
}

/**
 * Detecta en tiempo real el dominio y origen actual desde el cual se ejecuta la aplicación
 * e incluye la referencia preconfigurada del servidor TrueNAS SCALE (Tailscale HTTPS).
 */
export function obtenerInfoDominioAutorizacion(): InfoDominioAutorizacion {
  const hostname =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'localhost';
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';
  const truenasHostname = 'truenas-scale.tailbc79af.ts.net';
  const truenasOrigin = 'https://truenas-scale.tailbc79af.ts.net:8443';
  const projectId = firebaseConfig.projectId || 'gen-lang-client-0068542424';
  const oAuthClientId =
    (firebaseConfig as { oAuthClientId?: string }).oAuthClientId || '';

  return {
    hostname,
    origin,
    truenasHostname,
    truenasOrigin,
    projectId,
    oAuthClientId,
    firebaseAuthSettingsUrl: `https://console.firebase.google.com/project/${projectId}/authentication/settings`,
    googleCloudCredentialsUrl: `https://console.cloud.google.com/apis/credentials?project=${projectId}`,
  };
}

// Declaración mínima de tipos para Google Identity Services (GIS) en window.google
interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GisTokenResponse) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => GisTokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let promesaScriptGis: Promise<void> | null = null;

function cargarScriptGoogleIdentityServices(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Entorno de navegador no disponible.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (promesaScriptGis) {
    return promesaScriptGis;
  }

  promesaScriptGis = new Promise<void>((resolve, reject) => {
    const scriptExistente = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    ) as HTMLScriptElement | null;

    if (scriptExistente) {
      scriptExistente.addEventListener('load', () => resolve());
      scriptExistente.addEventListener('error', () =>
        reject(new Error('No se pudo cargar Google Identity Services.'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      promesaScriptGis = null;
      reject(new Error('No se pudo cargar el script oficial de Google Identity Services.'));
    };
    document.head.appendChild(script);
  });

  return promesaScriptGis;
}

/**
 * Respaldo directo mediante Google Identity Services (OAuth 2.0 Token Client)
 * cuando Firebase Auth rechaza el dominio actual con auth/unauthorized-domain.
 */
export async function conectarConGoogleIdentityServices(): Promise<{
  user: PerfilGoogleConectado;
  accessToken: string;
}> {
  const { oAuthClientId, hostname } = obtenerInfoDominioAutorizacion();
  if (!oAuthClientId) {
    throw new Error(`DOMINIO_NO_AUTORIZADO:${hostname}`);
  }

  await cargarScriptGoogleIdentityServices();

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error(`DOMINIO_NO_AUTORIZADO:${hostname}`);
  }

  return new Promise((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: oAuthClientId,
      scope: `${SCOPES.join(' ')} email profile`,
      callback: async (resp: GisTokenResponse) => {
        if (resp.error || !resp.access_token) {
          reject(
            new Error(
              `DOMINIO_NO_AUTORIZADO:${hostname}:${resp.error_description || resp.error || 'Acceso OAuth rechazado'}`
            )
          );
          return;
        }

        cachedAccessToken = resp.access_token;

        // Consultar el correo de la cuenta Google autorizada
        let emailDetectado = 'Cuenta Google autorizada (GIS)';
        let nombreDetectado = 'Cuenta Google activa';
        try {
          const infoResp = await fetch(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            {
              headers: {
                Authorization: `Bearer ${resp.access_token}`,
              },
            }
          );
          if (infoResp.ok) {
            const infoData = (await infoResp.json()) as {
              email?: string;
              name?: string;
            };
            if (infoData.email) emailDetectado = infoData.email;
            if (infoData.name) nombreDetectado = infoData.name;
          }
        } catch {
          // Conserva etiqueta por defecto si userinfo no responde
        }

        cachedUserEmail = emailDetectado;
        resolve({
          user: {
            email: emailDetectado,
            displayName: nombreDetectado,
            metodo: 'gis',
          },
          accessToken: resp.access_token,
        });
      },
      error_callback: (err) => {
        reject(
          new Error(
            `DOMINIO_NO_AUTORIZADO:${hostname}:${err?.message || err?.type || 'Popup cerrado o bloqueado'}`
          )
        );
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: PerfilGoogleConectado, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) {
        onAuthSuccess(
          {
            email: user.email,
            displayName: user.displayName,
            metodo: 'firebase',
          },
          cachedAccessToken
        );
      }
    } else if (cachedAccessToken && cachedUserEmail) {
      if (onAuthSuccess) {
        onAuthSuccess(
          {
            email: cachedUserEmail,
            displayName: cachedUserEmail,
            metodo: 'gis',
          },
          cachedAccessToken
        );
      }
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const conectarGoogleDrive = async (): Promise<{
  user: PerfilGoogleConectado;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error(
          'No se recibió el token de acceso de Google Drive tras iniciar sesión.'
        );
      }
      cachedAccessToken = credential.accessToken;
      cachedUserEmail = result.user.email || result.user.displayName || 'Cuenta Google activa';
      return {
        user: {
          email: result.user.email,
          displayName: result.user.displayName,
          metodo: 'firebase',
        },
        accessToken: cachedAccessToken,
      };
    } catch (firebaseErr: unknown) {
      const msgFirebase =
        firebaseErr instanceof Error ? firebaseErr.message : String(firebaseErr);
      const codigoFirebase = (firebaseErr as { code?: string })?.code || '';

      // Si Firebase bloquea por auth/unauthorized-domain (ej. nuevo contenedor TrueNAS o dominio preview),
      // activar automáticamente el respaldo directo con Google Identity Services (GIS)
      if (
        codigoFirebase.includes('unauthorized-domain') ||
        msgFirebase.includes('unauthorized-domain')
      ) {
        try {
          return await conectarConGoogleIdentityServices();
        } catch {
          const { hostname } = obtenerInfoDominioAutorizacion();
          throw new Error(`DOMINIO_NO_AUTORIZADO:${hostname}`);
        }
      }

      throw firebaseErr;
    }
  } finally {
    isSigningIn = false;
  }
};

export const obtenerTokenGoogleDrive = (): string | null => {
  return cachedAccessToken;
};

export const desconectarGoogleDrive = async (): Promise<void> => {
  try {
    if (cachedAccessToken && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(cachedAccessToken);
    }
  } catch {
    // Ignorar error de revocación GIS
  }
  await auth.signOut();
  cachedAccessToken = null;
  cachedUserEmail = null;
};

const NOMBRE_CARPETA_INSTITUCIONAL = 'NotiProfes Oficial - I.E. Villa Flora';

/**
 * Genera el documento PDF oficial completo del Boletín Semanal con todas sus secciones:
 * encabezado institucional, reflexión pedagógica, resumen de indicadores, documentos permanentes,
 * programación semanal, proyección de finalización, felicitaciones, directrices, zonas de acompañamiento,
 * ruta de atención de accidentes y póliza, suspensiones, próximas actividades, calendario oficial,
 * horarios del personal de apoyo y firmas directivas.
 */
export function generarPdfBoletinOficial(
  boletin: BoletinSemanal,
  versionNumero: number
): { blob: Blob; fileName: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  const dibujarFranjaSuperior = () => {
    doc.setFillColor(3, 78, 162); // #034EA2
    doc.rect(0, 0, pageWidth * 0.65, 3, 'F');
    doc.setFillColor(0, 125, 197); // #007DC5
    doc.rect(pageWidth * 0.65, 0, pageWidth * 0.2, 3, 'F');
    doc.setFillColor(237, 20, 91); // #ED145B
    doc.rect(pageWidth * 0.85, 0, pageWidth * 0.15, 3, 'F');
  };

  const verificarEspacioPagina = (alturaRequerida: number) => {
    if (y + alturaRequerida > pageHeight - 16) {
      doc.addPage();
      dibujarFranjaSuperior();
      y = 12;
    }
  };

  const dibujarEncabezadoSeccion = (numero: string, titulo: string, contador?: string) => {
    verificarEspacioPagina(16);
    y += 3;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 8.5, 1.5, 1.5, 'FD');
    doc.setFillColor(3, 78, 162);
    doc.rect(margin, y, 2.5, 8.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(3, 78, 162);
    doc.text(`${numero}. ${titulo.toUpperCase()}`, margin + 5, y + 5.7);

    if (contador) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const anchoContador = doc.getTextWidth(contador);
      doc.text(contador, pageWidth - margin - anchoContador - 3, y + 5.6);
    }
    y += 11.5;
  };

  const totalActividades = boletin.dias.reduce(
    (acc, d) => acc + d.actividades.length,
    0
  );
  const totalReprogramadas = boletin.dias.reduce(
    (acc, d) => acc + d.actividades.filter((a) => a.reprogramada).length,
    0
  );
  const finalizacionItems = boletin.proyeccionCalendario.filter(
    (e) => e.categoria === 'finalizacion'
  );
  const proximasItems = boletin.proyeccionCalendario.filter(
    (e) => e.categoria !== 'finalizacion'
  );
  const estadoCalendario = calcularEstadoCalendarioBoletin(boletin);
  const calendarioActivo = obtenerCalendarioOficialBoletin(boletin);

  const ahoraTexto = new Date().toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // 1. FRANJA SUPERIOR TRICOLOR INSTITUCIONAL
  dibujarFranjaSuperior();

  // 2. BLOQUE ENCABEZADO OFICIAL (CON AJUSTE AUTOMÁTICO DE LÍNEAS)
  const lineasSemana = doc.splitTextToSize(
    boletin.semanaTexto || estadoCalendario.rangoSemanaFormateado,
    contentWidth - 10
  );
  const lineasPeriodo = doc.splitTextToSize(
    `${boletin.descripcionPeriodo} · ${boletin.subtituloPeriodo}`,
    contentWidth - 10
  );
  const lineasDePara = doc.splitTextToSize(
    `DE: ${boletin.remitente}   ·   PARA: ${boletin.destinatarios}`,
    contentWidth - 10
  );

  const altoEncabezado =
    24 +
    lineasSemana.length * 5 +
    lineasPeriodo.length * 4 +
    lineasDePara.length * 3.8;

  doc.setFillColor(15, 34, 61); // #0F223D
  doc.roundedRect(margin, 7, contentWidth, altoEncabezado, 3, 3, 'F');

  // Badge Edición
  doc.setFillColor(237, 20, 91); // #ED145B
  doc.roundedRect(margin + 5, 10.5, 48, 6.5, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text(`NOTIPROFES N° ${boletin.numero}`, margin + 8, 15);

  // Sello de Control de Versión / Fecha de Emisión
  const textoSelloVersion =
    versionNumero > 1
      ? `Revisión PDF v${versionNumero} · ${ahoraTexto}`
      : `FECHA DE EMISIÓN: ${boletin.fechaEmision}`;
  doc.setFillColor(3, 78, 162);
  const anchoSello = Math.min(82, doc.getTextWidth(textoSelloVersion) + 10);
  doc.roundedRect(pageWidth - margin - anchoSello - 5, 10.5, anchoSello, 6.5, 1.5, 1.5, 'F');
  doc.setFontSize(7.4);
  doc.text(textoSelloVersion, pageWidth - margin - anchoSello - 1.5, 14.9);

  let cursorHeaderY = 22.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'INSTITUCIÓN EDUCATIVA VILLA FLORA · NOTIPROFES DIGITAL',
    margin + 5,
    cursorHeaderY
  );
  cursorHeaderY += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(125, 211, 252);
  doc.text(lineasSemana, margin + 5, cursorHeaderY);
  cursorHeaderY += lineasSemana.length * 4.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(224, 242, 254);
  doc.text(lineasPeriodo, margin + 5, cursorHeaderY);
  cursorHeaderY += lineasPeriodo.length * 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(186, 230, 253);
  doc.text(lineasDePara, margin + 5, cursorHeaderY);

  y = 7 + altoEncabezado + 4;

  // 3. FRASE PEDAGÓGICA SEMANAL
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  const lineasFrase = doc.splitTextToSize(
    `REFLEXIÓN PEDAGÓGICA: "${boletin.frasePedagogica}" — ${boletin.autorFrase}`,
    contentWidth - 10
  );
  const altoFrase = Math.max(11, lineasFrase.length * 4.2 + 5);
  doc.roundedRect(margin, y, contentWidth, altoFrase, 2, 2, 'FD');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.4);
  doc.setTextColor(15, 23, 42);
  doc.text(lineasFrase, margin + 5, y + 5.2);
  y += altoFrase + 4;

  // 4. TARJETAS KPI DE RESUMEN SEMANAL
  verificarEspacioPagina(16);
  const kpis = [
    { label: 'ACTIVIDADES SEMANA', val: String(totalActividades), color: [3, 78, 162] },
    { label: 'DOCUMENTOS Y HORARIOS', val: String(boletin.documentosPermanentes.length), color: [0, 125, 197] },
    { label: 'HITOS LARGO PLAZO', val: String(boletin.proyeccionCalendario.length), color: [15, 23, 42] },
    { label: 'REPROGRAMACIONES', val: String(totalReprogramadas), color: [237, 20, 91] },
  ];
  const gapKpi = 3;
  const anchoKpi = (contentWidth - gapKpi * 3) / 4;
  kpis.forEach((k, idx) => {
    const xKpi = margin + idx * (anchoKpi + gapKpi);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(xKpi, y, anchoKpi, 13, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, xKpi + 3, y + 4.5);
    doc.setFontSize(11.5);
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.text(k.val, xKpi + 3, y + 10.5);
  });
  y += 16;

  // 5. SECCIÓN 1: DOCUMENTOS, RESOLUCIONES Y HORARIOS DE LA SEMANA
  if (boletin.documentosPermanentes.length > 0) {
    dibujarEncabezadoSeccion(
      '1',
      'Documentos, Resoluciones y Horarios de la Semana',
      `${boletin.documentosPermanentes.length} archivos oficiales`
    );

    boletin.documentosPermanentes.forEach((docItem) => {
      const textoDoc = `• [${docItem.categoria}] ${docItem.titulo}`;
      const lineasDoc = doc.splitTextToSize(textoDoc, contentWidth - 10);
      const altoItemDoc = lineasDoc.length * 4 + 6.5;
      verificarEspacioPagina(altoItemDoc + 2);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin + 1, y, contentWidth - 2, altoItemDoc, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      doc.text(lineasDoc, margin + 4, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(0, 125, 197);
      const etiquetaEnlace = doc.splitTextToSize(
        `Archivo: ${docItem.nombreArchivo} (Abrir documento)`,
        contentWidth - 14
      )[0];
      const urlCompleta = docItem.url.startsWith('http')
        ? docItem.url
        : `${typeof window !== 'undefined' ? window.location.origin : ''}${docItem.url}`;
      doc.textWithLink(etiquetaEnlace, margin + 6, y + lineasDoc.length * 4 + 4.2, {
        url: urlCompleta,
      });
      y += altoItemDoc + 2;
    });
  }

  // 6. SECCIÓN 2: PROGRAMACIÓN SEMANAL DE ACTIVIDADES DÍA POR DÍA
  dibujarEncabezadoSeccion(
    '2',
    'Programación de Actividades de la Semana',
    `${totalActividades} actividades programadas`
  );

  boletin.dias.forEach((dia) => {
    verificarEspacioPagina(18);

    if (dia.esFestivo) {
      doc.setFillColor(253, 242, 248);
      doc.setDrawColor(244, 114, 182);
    } else {
      doc.setFillColor(3, 78, 162);
      doc.setDrawColor(3, 78, 162);
    }
    doc.roundedRect(margin, y, contentWidth, 7.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    if (dia.esFestivo) {
      doc.setTextColor(190, 24, 93);
    } else {
      doc.setTextColor(255, 255, 255);
    }
    const etiquetaDia = dia.notaHorario
      ? `${dia.fechaTexto}   ·   ${dia.notaHorario}`
      : dia.fechaTexto;
    const lineaEtiquetaDia = doc.splitTextToSize(etiquetaDia, contentWidth - 8)[0];
    doc.text(lineaEtiquetaDia, margin + 4, y + 5.1);
    y += 9;

    if (dia.actividades.length === 0) {
      verificarEspacioPagina(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.2);
      doc.setTextColor(100, 116, 139);
      doc.text(
        dia.esFestivo
          ? 'Día festivo nacional / Sin actividades académicas presenciales.'
          : 'Sin actividades especiales registradas para esta jornada.',
        margin + 5,
        y + 3
      );
      y += 6.5;
      return;
    }

    dia.actividades.forEach((act, idx) => {
      const prefijoReprog = act.reprogramada ? '[REPROGRAMADO] ' : '';
      const textoTitulo = `${idx + 1}. ${prefijoReprog}${act.titulo}`;
      const lineasTitulo = doc.splitTextToSize(textoTitulo, contentWidth - 12);
      const metaLinea = `Hora: ${act.hora}   |   Responsable: ${act.responsable}   |   Lugar: ${act.lugar}`;
      const lineasMeta = doc.splitTextToSize(metaLinea, contentWidth - 12);
      const lineasNota = act.notaReprogramacion
        ? doc.splitTextToSize(
            `Nota de reprogramación: ${act.notaReprogramacion}`,
            contentWidth - 12
          )
        : [];

      const altoBloque =
        lineasTitulo.length * 4 +
        lineasMeta.length * 3.8 +
        (lineasNota.length > 0 ? lineasNota.length * 3.8 + 1.5 : 0) +
        4.5;

      verificarEspacioPagina(altoBloque + 2.5);

      if (act.reprogramada) {
        doc.setFillColor(255, 241, 242);
        doc.setDrawColor(253, 164, 175);
      } else {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
      }
      doc.roundedRect(margin + 1.5, y, contentWidth - 3, altoBloque, 1.5, 1.5, 'FD');

      let cursorActY = y + 4.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      if (act.reprogramada) {
        doc.setTextColor(190, 18, 60);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(lineasTitulo, margin + 4.5, cursorActY);
      cursorActY += lineasTitulo.length * 4 + 0.6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.9);
      doc.setTextColor(51, 65, 85);
      doc.text(lineasMeta, margin + 4.5, cursorActY);
      cursorActY += lineasMeta.length * 3.8;

      if (lineasNota.length > 0) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(7.7);
        doc.setTextColor(190, 18, 60);
        doc.text(lineasNota, margin + 4.5, cursorActY + 0.6);
      }

      y += altoBloque + 2;
    });

    y += 1.5;
  });

  // 7. SECCIÓN 3: PROYECCIÓN DE CALENDARIO DE FINALIZACIÓN
  if (finalizacionItems.length > 0) {
    dibujarEncabezadoSeccion(
      '3',
      'Proyección de Calendario de Finalización',
      `${finalizacionItems.length} hitos institucionales`
    );

    finalizacionItems.forEach((item) => {
      const textoItem = `• ${item.fechaTexto}: ${item.descripcion}`;
      const lineasItem = doc.splitTextToSize(textoItem, contentWidth - 8);
      const altoItem = lineasItem.length * 4 + 2;
      verificarEspacioPagina(altoItem + 1.5);

      doc.setFont('helvetica', item.destacado ? 'bold' : 'normal');
      doc.setFontSize(8.2);
      if (item.destacado) {
        doc.setTextColor(3, 78, 162);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(lineasItem, margin + 3, y + 3.5);
      y += altoItem;
    });
  }

  // 8. SECCIÓN 4: NOTIPRÁCTICAS · FELICITACIONES Y RECONOCIMIENTOS DOCENTES
  if (boletin.felicitaciones.length > 0) {
    dibujarEncabezadoSeccion(
      '4',
      'NotiPrácticas · Felicitaciones y Reconocimientos Docentes',
      `${boletin.felicitaciones.length} menciones de honor`
    );

    boletin.felicitaciones.forEach((fel) => {
      const lineasDocente = doc.splitTextToSize(`★ ${fel.docentes}`, contentWidth - 10);
      const lineasMotivo = doc.splitTextToSize(fel.motivo, contentWidth - 10);
      const altoFel = lineasDocente.length * 4 + lineasMotivo.length * 3.8 + 4.5;
      verificarEspacioPagina(altoFel + 2);

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(margin + 1, y, contentWidth - 2, altoFel, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.4);
      doc.setTextColor(6, 95, 70);
      doc.text(lineasDocente, margin + 4, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(lineasMotivo, margin + 4, y + 4.2 + lineasDocente.length * 4);

      y += altoFel + 2;
    });
  }

  // 9. SECCIÓN 5: DIRECTRICES INSTITUCIONALES, ZONAS DE ACOMPAÑAMIENTO Y RUTA DE ACCIDENTE ESCOLAR
  if (
    boletin.avisosPracticas.length > 0 ||
    boletin.zonasAcompanamientoNotas.length > 0 ||
    boletin.pasosAccidenteEscolar.length > 0
  ) {
    dibujarEncabezadoSeccion(
      '5',
      'Directrices Institucionales, Zonas de Acompañamiento y Póliza Escolar'
    );

    boletin.avisosPracticas.forEach((aviso) => {
      const lineasAviso = doc.splitTextToSize(`• ${aviso}`, contentWidth - 8);
      verificarEspacioPagina(lineasAviso.length * 3.9 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.1);
      doc.setTextColor(30, 41, 59);
      doc.text(lineasAviso, margin + 3, y + 3.2);
      y += lineasAviso.length * 3.9 + 1.5;
    });

    boletin.zonasAcompanamientoNotas.forEach((nota) => {
      const lineasNota = doc.splitTextToSize(
        `• [Zona de Acompañamiento] ${nota}`,
        contentWidth - 8
      );
      verificarEspacioPagina(lineasNota.length * 3.9 + 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.1);
      doc.setTextColor(3, 78, 162);
      doc.text(lineasNota, margin + 3, y + 3.2);
      y += lineasNota.length * 3.9 + 1.5;
    });

    if (boletin.pasosAccidenteEscolar.length > 0) {
      const textoPasos = boletin.pasosAccidenteEscolar.join('   |   ');
      const lineasPasos = doc.splitTextToSize(textoPasos, contentWidth - 10);
      const altoCajaPoliza = lineasPasos.length * 4 + 14;
      verificarEspacioPagina(altoCajaPoliza + 3);

      y += 1.5;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin + 1, y, contentWidth - 2, altoCajaPoliza, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(3, 78, 162);
      doc.text(
        'Ruta obligatoria de atención ante dificultades de salud o lesión escolar:',
        margin + 4,
        y + 4.5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.9);
      doc.setTextColor(15, 23, 42);
      doc.text(lineasPasos, margin + 4, y + 9);

      if (boletin.polizaEscolarDoc?.titulo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.9);
        doc.setTextColor(0, 125, 197);
        const urlPoliza = boletin.polizaEscolarDoc.url.startsWith('http')
          ? boletin.polizaEscolarDoc.url
          : `${typeof window !== 'undefined' ? window.location.origin : ''}${boletin.polizaEscolarDoc.url}`;
        doc.textWithLink(
          `Póliza escolar oficial: ${boletin.polizaEscolarDoc.titulo} (Abrir documento)`,
          margin + 4,
          y + 9.5 + lineasPasos.length * 4,
          { url: urlPoliza }
        );
      }

      y += altoCajaPoliza + 2.5;
    }
  }

  // 10. SECCIÓN 6: ESTUDIANTES CON SUSPENSIÓN (SI ESTÁ HABILITADO)
  if (boletin.mostrarSuspensionesPublico && boletin.suspensiones.length > 0) {
    dibujarEncabezadoSeccion(
      '6',
      'Novedades de Convivencia · Estudiantes con Suspensión',
      `${boletin.suspensiones.length} registros`
    );

    boletin.suspensiones.forEach((s) => {
      const lineaSusp = `• Grado ${s.grado} — ${s.estudiante}   (Fecha de suspensión: ${s.fechaSuspension})`;
      const lineasSusp = doc.splitTextToSize(lineaSusp, contentWidth - 8);
      verificarEspacioPagina(lineasSusp.length * 4 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.1);
      doc.setTextColor(153, 27, 27);
      doc.text(lineasSusp, margin + 3, y + 3.2);
      y += lineasSusp.length * 4 + 1.2;
    });
  }

  // 11. SECCIÓN 7: PRÓXIMAS ACTIVIDADES Y CAPACITACIONES
  if (proximasItems.length > 0) {
    dibujarEncabezadoSeccion(
      '7',
      'Próximas Actividades y Capacitaciones',
      `${proximasItems.length} eventos`
    );

    proximasItems.forEach((item) => {
      const textoProx = `• ${item.fechaTexto}: ${item.descripcion}`;
      const lineasProx = doc.splitTextToSize(textoProx, contentWidth - 8);
      const altoProx = lineasProx.length * 3.9 + 1.8;
      verificarEspacioPagina(altoProx + 1.5);

      doc.setFont('helvetica', item.destacado ? 'bold' : 'normal');
      doc.setFontSize(8.1);
      if (item.destacado) {
        doc.setTextColor(3, 78, 162);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(lineasProx, margin + 3, y + 3.2);
      y += altoProx;
    });
  }

  // 12. SECCIÓN 8: CALENDARIO ACADÉMICO OFICIAL (RESUMEN DE BLOQUES)
  if (calendarioActivo) {
    dibujarEncabezadoSeccion(
      '8',
      `Calendario Académico Oficial ${calendarioActivo.anio} (Medellín)`,
      `${estadoCalendario.numeroPeriodo}° Periodo`
    );

    const bloquesResumen = [
      {
        titulo: 'Semanas Lectivas',
        items: calendarioActivo.semanasLectivas,
      },
      {
        titulo: 'Desarrollo Institucional',
        items: calendarioActivo.semanasDesarrollo,
      },
      {
        titulo: 'Vacaciones Docentes',
        items: calendarioActivo.vacacionesDocentes,
      },
      {
        titulo: 'Receso Estudiantil',
        items: calendarioActivo.recesoEstudiantil,
      },
    ];

    bloquesResumen.forEach((grupo) => {
      const detalle = grupo.items
        .map((b) => `${b.desdeTexto} al ${b.hastaTexto} (${b.duracionTexto})`)
        .join('  ·  ');
      const lineaGrupo = `• ${grupo.titulo}: ${detalle}`;
      const lineasGrupo = doc.splitTextToSize(lineaGrupo, contentWidth - 8);
      verificarEspacioPagina(lineasGrupo.length * 3.9 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.9);
      doc.setTextColor(30, 41, 59);
      doc.text(lineasGrupo, margin + 3, y + 3.2);
      y += lineasGrupo.length * 3.9 + 1.5;
    });
  }

  // 13. SECCIÓN 9: HORARIOS DE ATENCIÓN · PERSONAL DE APOYO, AUXILIARES Y SEGURIDAD
  if (boletin.horariosApoyo.length > 0) {
    dibujarEncabezadoSeccion(
      '9',
      'Horarios del Personal de Apoyo, Auxiliares y Seguridad',
      'Lunes a Viernes'
    );

    boletin.horariosApoyo.forEach((h) => {
      const encabezadoH = `${h.rol} — ${h.nombre}`;
      const detalleDias = `Lunes: ${h.lunes}  |  Martes: ${h.martes}  |  Miércoles: ${h.miercoles}  |  Jueves: ${h.jueves}  |  Viernes: ${h.viernes}`;
      const lineasDias = doc.splitTextToSize(detalleDias, contentWidth - 10);
      const altoFilaH = lineasDias.length * 3.8 + 8;

      verificarEspacioPagina(altoFilaH + 2);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin + 1, y, contentWidth - 2, altoFilaH, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(3, 78, 162);
      doc.text(encabezadoH, margin + 4, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(51, 65, 85);
      doc.text(lineasDias, margin + 4, y + 8);

      y += altoFilaH + 1.8;
    });
  }

  // 14. FIRMAS DIRECTIVAS
  if (boletin.firmas.length > 0) {
    verificarEspacioPagina(22);
    y += 5;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    const anchoColFirma = contentWidth / Math.max(1, boletin.firmas.length);
    boletin.firmas.forEach((f, idx) => {
      const xCentro = margin + idx * anchoColFirma + anchoColFirma / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(3, 78, 162);
      doc.text(f.nombre, xCentro, y, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(100, 116, 139);
      doc.text(f.cargo, xCentro, y + 4, { align: 'center' });
    });
    y += 8;
  }

  // Pie de página numerado en todas las hojas
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Institución Educativa Villa Flora · Medellín · NotiProfes Digital N° ${boletin.numero} (Emisión ${boletin.fechaEmision})`,
      margin,
      pageHeight - 7
    );
    doc.text(
      `Página ${i} de ${totalPaginas}`,
      pageWidth - margin,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  const fileName = `NotiProfes_N${boletin.numero}_VillaFlora.pdf`;
  const blob = doc.output('blob');
  return { blob, fileName };
}

export interface OpcionesCarpetaDriveAnual {
  anio?: number;
  folderId?: string;
  folderName?: string;
}

/**
 * Extrae el ID de una carpeta de Google Drive a partir de un enlace completo o un ID directo.
 */
export function extraerIdCarpetaDrive(entrada: string): string {
  const limpio = (entrada || '').trim();
  if (!limpio) return '';
  const matchFolders = limpio.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (matchFolders?.[1]) return matchFolders[1];
  const matchIdParam = limpio.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (matchIdParam?.[1]) return matchIdParam[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(limpio) && !limpio.includes(' ')) {
    return limpio;
  }
  return '';
}

/**
 * Determina el año lectivo del boletín (ej. 2026 o 2027) a partir del calendario oficial o fecha de emisión.
 */
export function obtenerAnioBoletin(boletin: BoletinSemanal): number {
  if (
    boletin.calendarioOficial?.anio &&
    boletin.calendarioOficial.anio >= 2020 &&
    boletin.calendarioOficial.anio <= 2100
  ) {
    return boletin.calendarioOficial.anio;
  }
  const matchFecha = (boletin.fechaEmision || '').match(/\b(20\d{2})\b/);
  if (matchFecha?.[1]) {
    return Number(matchFecha[1]);
  }
  const matchSemana = (boletin.semanaTexto || '').match(/\b(20\d{2})\b/);
  if (matchSemana?.[1]) {
    return Number(matchSemana[1]);
  }
  return 2026;
}

/**
 * Lista las carpetas de Google Drive disponibles para la cuenta autenticada.
 */
export async function listarCarpetasDriveDisponibles(): Promise<
  Array<{ id: string; name: string }>
> {
  const accessToken = obtenerTokenGoogleDrive();
  if (!accessToken) {
    throw new Error('SESION_DRIVE_REQUERIDA');
  }

  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.folder' and trashed=false"
  );
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=modifiedTime desc&pageSize=30&spaces=drive`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (resp.status === 401) {
    cachedAccessToken = null;
    throw new Error('SESION_DRIVE_EXPIRADA');
  }

  if (!resp.ok) {
    return [];
  }

  const data = (await resp.json()) as {
    files?: Array<{ id: string; name: string }>;
  };
  return data.files || [];
}

/**
 * Busca o crea la carpeta institucional del año lectivo (ej. «Villa Flora 2026» o «Villa Flora 2027»)
 * o utiliza el ID de carpeta específico vinculado por el directivo en Google Drive.
 */
async function obtenerOCrearCarpetaDrive(
  accessToken: string,
  opciones?: OpcionesCarpetaDriveAnual
): Promise<{ id: string; name: string }> {
  const anio = opciones?.anio || 2026;
  const idConfigurado = extraerIdCarpetaDrive(opciones?.folderId || '');
  const nombreObjetivo =
    (opciones?.folderName || '').trim() ||
    `Villa Flora ${anio}` ||
    NOMBRE_CARPETA_INSTITUCIONAL;

  // 1. Si el directivo vinculó un ID o enlace específico de carpeta, verificar acceso en Drive
  if (idConfigurado) {
    const respGetFolder = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        idConfigurado
      )}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (respGetFolder.status === 401) {
      cachedAccessToken = null;
      throw new Error('SESION_DRIVE_EXPIRADA');
    }

    if (respGetFolder.ok) {
      const folderData = (await respGetFolder.json()) as {
        id: string;
        name: string;
        trashed?: boolean;
      };
      if (folderData?.id && !folderData.trashed) {
        return {
          id: folderData.id,
          name: folderData.name || nombreObjetivo,
        };
      }
    }
    // Si el ID provisto pertenece a una carpeta creada desde aquí o compartida, intentamos usar el ID directamente
    // si la búsqueda por nombre no existe, o buscamos por nombre anual como respaldo seguro
  }

  // 2. Buscar carpeta por el nombre anual configurado (ej. "Villa Flora 2026" o "Villa Flora 2027")
  const nombreEscapado = nombreObjetivo.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${nombreEscapado}' and trashed=false`
  );
  const respList = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (respList.status === 401) {
    cachedAccessToken = null;
    throw new Error('SESION_DRIVE_EXPIRADA');
  }

  if (respList.ok) {
    const data = (await respList.json()) as {
      files?: Array<{ id: string; name: string }>;
    };
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
  }

  // 3. Crear la carpeta anual automáticamente con el nombre elegido (ej. "Villa Flora 2026") si aún no existe
  const respCreate = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: nombreObjetivo,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!respCreate.ok) {
    throw new Error(
      `No fue posible crear o acceder a la carpeta «${nombreObjetivo}» en Google Drive.`
    );
  }

  return (await respCreate.json()) as { id: string; name: string };
}

/**
 * Sincroniza el PDF oficial del boletín en Google Drive aplicando:
 * "1. Sobrescritura inteligente sobre el mismo ID de Google Drive (Enlace único)"
 * y ubicándolo en la carpeta anual vinculada para el año lectivo correspondiente (ej. Villa Flora 2026 / Villa Flora 2027).
 */
export async function sincronizarPdfBoletinEnGoogleDrive(
  boletin: BoletinSemanal,
  autorNombre: string,
  opcionesCarpeta?: OpcionesCarpetaDriveAnual
): Promise<DrivePdfMetadata> {
  const accessToken = obtenerTokenGoogleDrive();
  if (!accessToken) {
    throw new Error('SESION_DRIVE_REQUERIDA');
  }

  const anioBoletin = opcionesCarpeta?.anio || obtenerAnioBoletin(boletin);
  const versionPrevia = boletin.drivePdfInfo?.version || 0;
  const nuevaVersion = versionPrevia + 1;
  const { blob, fileName } = generarPdfBoletinOficial(boletin, nuevaVersion);
  const carpeta = await obtenerOCrearCarpetaDrive(accessToken, {
    ...opcionesCarpeta,
    anio: anioBoletin,
  });

  const idExistente = boletin.drivePdfInfo?.fileId;

  // Si ya existe un ID de Google Drive asociado a este boletín, sobrescribir mediante PATCH sobre el mismo ID
  if (idExistente) {
    const metadataUpdate = {
      name: fileName,
      description: `NotiProfes N° ${boletin.numero} (${boletin.semanaTexto}) · Carpeta ${carpeta.name} · Revisión v${nuevaVersion} actualizada por ${autorNombre}`,
    };

    const formPatch = new FormData();
    formPatch.append(
      'metadata',
      new Blob([JSON.stringify(metadataUpdate)], { type: 'application/json' })
    );
    formPatch.append('file', blob, fileName);

    const carpetaPreviaId = boletin.drivePdfInfo?.folderId;
    const queryMoverCarpeta =
      carpetaPreviaId && carpetaPreviaId !== carpeta.id
        ? `&addParents=${encodeURIComponent(carpeta.id)}&removeParents=${encodeURIComponent(carpetaPreviaId)}`
        : '';

    const respPatch = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        idExistente
      )}?uploadType=multipart&fields=id,name,webViewLink${queryMoverCarpeta}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formPatch,
      }
    );

    if (respPatch.status === 401) {
      cachedAccessToken = null;
      throw new Error('SESION_DRIVE_EXPIRADA');
    }

    if (respPatch.ok) {
      const fileData = (await respPatch.json()) as {
        id: string;
        name: string;
        webViewLink?: string;
      };
      return {
        fileId: fileData.id,
        fileName: fileData.name || fileName,
        folderId: carpeta.id,
        folderName: carpeta.name,
        webViewLink:
          fileData.webViewLink ||
          `https://drive.google.com/file/d/${fileData.id}/view`,
        version: nuevaVersion,
        sincronizadoEn: new Date().toISOString(),
        sincronizadoPor: autorNombre,
      };
    }

    // Si el archivo fue eliminado manualmente de Drive (404), continuará abajo para recrearlo
    if (respPatch.status !== 404) {
      const errText = await respPatch.text();
      throw new Error(`Error al actualizar el PDF en Google Drive: ${errText}`);
    }
  }

  // Primera creación del PDF del boletín en Google Drive dentro de la carpeta anual seleccionada
  const metadataCreate = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: [carpeta.id],
    description: `NotiProfes N° ${boletin.numero} (${boletin.semanaTexto}) · Carpeta ${carpeta.name} · Emisión Oficial v1 por ${autorNombre}`,
  };

  const formCreate = new FormData();
  formCreate.append(
    'metadata',
    new Blob([JSON.stringify(metadataCreate)], { type: 'application/json' })
  );
  formCreate.append('file', blob, fileName);

  const respCreate = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formCreate,
    }
  );

  if (respCreate.status === 401) {
    cachedAccessToken = null;
    throw new Error('SESION_DRIVE_EXPIRADA');
  }

  if (!respCreate.ok) {
    const errText = await respCreate.text();
    throw new Error(`Error al subir el PDF a Google Drive: ${errText}`);
  }

  const fileData = (await respCreate.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
  };

  return {
    fileId: fileData.id,
    fileName: fileData.name || fileName,
    folderId: carpeta.id,
    folderName: carpeta.name,
    webViewLink:
      fileData.webViewLink ||
      `https://drive.google.com/file/d/${fileData.id}/view`,
    version: 1,
    sincronizadoEn: new Date().toISOString(),
    sincronizadoPor: autorNombre,
  };
}

/**
 * Descarga el archivo PDF del boletín directamente al dispositivo local del usuario
 * sin abrir el diálogo de impresión de Windows/navegador.
 */
export function descargarPdfBoletinDirecto(boletin: BoletinSemanal): void {
  const version = boletin.drivePdfInfo?.version || 1;
  const { blob, fileName } = generarPdfBoletinOficial(boletin, version);
  const urlDescarga = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = urlDescarga;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(urlDescarga), 1000);
}
