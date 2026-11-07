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

// Permisos mínimos requeridos para crear y actualizar los PDFs oficiales en Google Drive
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Caché en memoria para el token OAuth (nunca en localStorage ni sessionStorage por seguridad)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const conectarGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'No se recibió el token de acceso de Google Drive tras iniciar sesión.'
      );
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const obtenerTokenGoogleDrive = (): string | null => {
  return cachedAccessToken;
};

export const desconectarGoogleDrive = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

const NOMBRE_CARPETA_INSTITUCIONAL = 'NotiProfes Oficial - I.E. Villa Flora';

/**
 * Genera el documento PDF oficial del Boletín Semanal con sello de versión/actualización,
 * actividades por día, etiquetas de reprogramación, documentos institucionales y horarios.
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
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const verificarEspacioPagina = (alturaRequerida: number) => {
    if (y + alturaRequerida > pageHeight - 18) {
      doc.addPage();
      y = 16;
    }
  };

  const totalActividades = boletin.dias.reduce(
    (acc, d) => acc + d.actividades.length,
    0
  );
  const totalReprogramadas = boletin.dias.reduce(
    (acc, d) => acc + d.actividades.filter((a) => a.reprogramada).length,
    0
  );

  const ahoraTexto = new Date().toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // 1. FRANJA SUPERIOR TRICOLOR INSTITUCIONAL
  doc.setFillColor(3, 78, 162); // #034EA2
  doc.rect(0, 0, pageWidth * 0.65, 3.5, 'F');
  doc.setFillColor(0, 125, 197); // #007DC5
  doc.rect(pageWidth * 0.65, 0, pageWidth * 0.2, 3.5, 'F');
  doc.setFillColor(237, 20, 91); // #ED145B
  doc.rect(pageWidth * 0.85, 0, pageWidth * 0.15, 3.5, 'F');

  // 2. BLOQUE ENCABEZADO OFICIAL
  doc.setFillColor(15, 34, 61); // #0F223D
  doc.roundedRect(margin, 8, contentWidth, 32, 3, 3, 'F');

  // Badge Edición
  doc.setFillColor(237, 20, 91); // #ED145B
  doc.roundedRect(margin + 5, 12, 46, 6.5, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`NOTIPROFES N° ${boletin.numero}`, margin + 8, 16.5);

  // Sello de Control de Versión / Actualización en la esquina derecha
  const textoSelloVersion =
    versionNumero > 1
      ? `Revisión PDF v${versionNumero} · Actualizado: ${ahoraTexto}`
      : `Emisión Oficial v1 · ${boletin.fechaEmision}`;
  doc.setFillColor(3, 78, 162);
  doc.roundedRect(pageWidth - margin - 78, 12, 73, 6.5, 1.5, 1.5, 'F');
  doc.setFontSize(7.2);
  doc.text(textoSelloVersion, pageWidth - margin - 75, 16.3);

  // Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'INSTITUCIÓN EDUCATIVA VILLA FLORA · NOTIPROFES DIGITAL',
    margin + 5,
    25
  );

  // Semana y Periodo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 242, 254);
  doc.text(
    `${boletin.semanaTexto} · ${boletin.descripcionPeriodo} (${boletin.subtituloPeriodo})`,
    margin + 5,
    31
  );

  doc.setFontSize(7.8);
  doc.setTextColor(186, 230, 253);
  const metaControl =
    totalReprogramadas > 0
      ? `Total actividades: ${totalActividades} (${totalReprogramadas} reprogramada[s]) · Última edición por: ${boletin.actualizadoPor}`
      : `Total actividades: ${totalActividades} · Última edición por: ${boletin.actualizadoPor}`;
  doc.text(metaControl, margin + 5, 36.5);

  y = 45;

  // 3. FRASE PEDAGÓGICA SEMANAL
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  const lineasFrase = doc.splitTextToSize(
    `"${boletin.frasePedagogica}" — ${boletin.autorFrase}`,
    contentWidth - 10
  );
  const altoFrase = Math.max(12, lineasFrase.length * 4.5 + 5);
  doc.roundedRect(margin, y, contentWidth, altoFrase, 2, 2, 'FD');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(lineasFrase, margin + 5, y + 5.5);
  y += altoFrase + 6;

  // 4. SECCIÓN: PROGRAMACIÓN SEMANAL DÍA POR DÍA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(3, 78, 162);
  doc.text('1. PROGRAMACIÓN SEMANAL DE ACTIVIDADES', margin, y);
  y += 5;

  boletin.dias.forEach((dia) => {
    verificarEspacioPagina(22);

    // Cabecera del día
    if (dia.esFestivo) {
      doc.setFillColor(253, 242, 248);
      doc.setDrawColor(244, 114, 182);
    } else {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
    }
    doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(dia.esFestivo ? 190 : 15, dia.esFestivo ? 24 : 23, dia.esFestivo ? 93 : 42);
    const etiquetaDia = dia.notaHorario
      ? `${dia.fechaTexto}  —  ${dia.notaHorario}`
      : dia.fechaTexto;
    doc.text(etiquetaDia, margin + 4, y + 5.4);
    y += 10;

    if (dia.actividades.length === 0) {
      verificarEspacioPagina(9);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        dia.esFestivo
          ? 'Día festivo nacional / Sin actividades académicas presenciales.'
          : 'Sin actividades especiales registradas para esta jornada.',
        margin + 5,
        y + 3
      );
      y += 7;
      return;
    }

    dia.actividades.forEach((act, idx) => {
      const prefijoReprog = act.reprogramada ? '[REPROGRAMADO] ' : '';
      const textoTitulo = `${idx + 1}. ${prefijoReprog}${act.titulo}`;
      const lineasTitulo = doc.splitTextToSize(textoTitulo, contentWidth - 10);
      const metaLinea = `Hora: ${act.hora}   |   Responsable: ${act.responsable}   |   Lugar: ${act.lugar}`;
      const lineasMeta = doc.splitTextToSize(metaLinea, contentWidth - 10);
      const lineasNota = act.notaReprogramacion
        ? doc.splitTextToSize(
            `Nota de reprogramación: ${act.notaReprogramacion}`,
            contentWidth - 10
          )
        : [];

      const altoBloque =
        lineasTitulo.length * 4.2 +
        lineasMeta.length * 4 +
        (lineasNota.length > 0 ? lineasNota.length * 3.8 + 2 : 0) +
        5;

      verificarEspacioPagina(altoBloque + 3);

      if (act.reprogramada) {
        doc.setFillColor(255, 241, 242);
        doc.setDrawColor(253, 164, 175);
      } else {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
      }
      doc.roundedRect(margin + 2, y, contentWidth - 4, altoBloque, 1.5, 1.5, 'FD');

      let cursorActY = y + 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      if (act.reprogramada) {
        doc.setTextColor(190, 18, 60);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(lineasTitulo, margin + 5, cursorActY);
      cursorActY += lineasTitulo.length * 4.2 + 0.8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(lineasMeta, margin + 5, cursorActY);
      cursorActY += lineasMeta.length * 4;

      if (lineasNota.length > 0) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(7.8);
        doc.setTextColor(190, 18, 60);
        doc.text(lineasNota, margin + 5, cursorActY + 0.8);
      }

      y += altoBloque + 2.5;
    });

    y += 2;
  });

  // 5. SECCIÓN: DOCUMENTOS Y CIRCULARES PERMANENTES
  if (boletin.documentosPermanentes.length > 0) {
    verificarEspacioPagina(22);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(3, 78, 162);
    doc.text('2. DOCUMENTOS INSTITUCIONALES Y ENLACES ACTIVOS', margin, y);
    y += 5;

    boletin.documentosPermanentes.forEach((docItem) => {
      verificarEspacioPagina(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.3);
      doc.setTextColor(15, 23, 42);
      const lineaDoc = `• [${docItem.categoria}] ${docItem.titulo}: `;
      doc.text(lineaDoc, margin + 3, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 125, 197);
      const etiquetaEnlace = `${docItem.nombreArchivo} (Abrir enlace)`;
      doc.textWithLink(etiquetaEnlace, margin + 6, y + 3.8, {
        url: docItem.url,
      });
      y += 8.2;
    });
  }

  // 6. SECCIÓN: NOTIPRÁCTICAS Y RECOMENDACIONES DOCENTES
  if (boletin.avisosPracticas.length > 0 || boletin.felicitaciones.length > 0) {
    verificarEspacioPagina(22);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(3, 78, 162);
    doc.text('3. NOTIPRÁCTICAS Y RECONOCIMIENTOS DOCENTES', margin, y);
    y += 5;

    boletin.felicitaciones.forEach((fel) => {
      const textoFel = `★ Reconocimiento a ${fel.docentes}: ${fel.motivo}`;
      const lineasFel = doc.splitTextToSize(textoFel, contentWidth - 8);
      verificarEspacioPagina(lineasFel.length * 4.2 + 3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(4, 120, 87);
      doc.text(lineasFel, margin + 3, y);
      y += lineasFel.length * 4.2 + 2;
    });

    boletin.avisosPracticas.forEach((aviso) => {
      const lineasAviso = doc.splitTextToSize(`• ${aviso}`, contentWidth - 8);
      verificarEspacioPagina(lineasAviso.length * 4 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85);
      doc.text(lineasAviso, margin + 3, y);
      y += lineasAviso.length * 4 + 1.8;
    });
  }

  // 7. SECCIÓN: HORARIOS DEL PERSONAL DE APOYO Y FIRMAS DIRECTIVAS
  if (boletin.horariosApoyo.length > 0) {
    verificarEspacioPagina(28);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(3, 78, 162);
    doc.text('4. HORARIOS DE ATENCIÓN · PERSONAL DE APOYO', margin, y);
    y += 5;

    boletin.horariosApoyo.forEach((h) => {
      const lineaH = `• ${h.rol} (${h.nombre}): Lun ${h.lunes} | Mar ${h.martes} | Mié ${h.miercoles} | Jue ${h.jueves} | Vie ${h.viernes}`;
      const lineasH = doc.splitTextToSize(lineaH, contentWidth - 6);
      verificarEspacioPagina(lineasH.length * 4 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(lineasH, margin + 3, y);
      y += lineasH.length * 4 + 1.8;
    });
  }

  // Firmas Directivas
  if (boletin.firmas.length > 0) {
    verificarEspacioPagina(24);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const textoFirmas = boletin.firmas
      .map((f) => `${f.nombre} (${f.cargo})`)
      .join('   ·   ');
    const lineasFirmas = doc.splitTextToSize(textoFirmas, contentWidth);
    doc.text(lineasFirmas, margin, y);
  }

  // Pie de página numerado en todas las hojas
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Institución Educativa Villa Flora · Medellín · NotiProfes Digital N° ${boletin.numero} (Revisión PDF v${versionNumero})`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Página ${i} de ${totalPaginas}`,
      pageWidth - margin - 22,
      pageHeight - 8
    );
  }

  const fileName = `NotiProfes_N${boletin.numero}_VillaFlora.pdf`;
  const blob = doc.output('blob');
  return { blob, fileName };
}

/**
 * Busca o crea la carpeta institucional «NotiProfes Oficial - I.E. Villa Flora» en Google Drive.
 */
async function obtenerOCrearCarpetaDrive(
  accessToken: string
): Promise<{ id: string; name: string }> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${NOMBRE_CARPETA_INSTITUCIONAL}' and trashed=false`
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

  // Crear carpeta si no existe
  const respCreate = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: NOMBRE_CARPETA_INSTITUCIONAL,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!respCreate.ok) {
    throw new Error(
      'No fue posible crear la carpeta institucional en Google Drive.'
    );
  }

  return (await respCreate.json()) as { id: string; name: string };
}

/**
 * Sincroniza el PDF oficial del boletín en Google Drive aplicando:
 * "1. Sobrescritura inteligente sobre el mismo ID de Google Drive (Enlace único)".
 * Si el boletín ya tiene un `drivePdfInfo.fileId`, actualiza el archivo existente mediante PATCH
 * conservando su mismo enlace único y sumando una revisión al historial de Drive.
 */
export async function sincronizarPdfBoletinEnGoogleDrive(
  boletin: BoletinSemanal,
  autorNombre: string
): Promise<DrivePdfMetadata> {
  const accessToken = obtenerTokenGoogleDrive();
  if (!accessToken) {
    throw new Error('SESION_DRIVE_REQUERIDA');
  }

  const versionPrevia = boletin.drivePdfInfo?.version || 0;
  const nuevaVersion = versionPrevia + 1;
  const { blob, fileName } = generarPdfBoletinOficial(boletin, nuevaVersion);
  const carpeta = await obtenerOCrearCarpetaDrive(accessToken);

  const idExistente = boletin.drivePdfInfo?.fileId;

  // Si ya existe un ID de Google Drive asociado a este boletín, sobrescribir mediante PATCH sobre el mismo ID
  if (idExistente) {
    const metadataUpdate = {
      name: fileName,
      description: `NotiProfes N° ${boletin.numero} (${boletin.semanaTexto}) · Revisión v${nuevaVersion} actualizada por ${autorNombre}`,
    };

    const formPatch = new FormData();
    formPatch.append(
      'metadata',
      new Blob([JSON.stringify(metadataUpdate)], { type: 'application/json' })
    );
    formPatch.append('file', blob, fileName);

    const respPatch = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        idExistente
      )}?uploadType=multipart&fields=id,name,webViewLink`,
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

  // Primera creación del PDF del boletín en Google Drive
  const metadataCreate = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: [carpeta.id],
    description: `NotiProfes N° ${boletin.numero} (${boletin.semanaTexto}) · Emisión Oficial v1 por ${autorNombre}`,
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
