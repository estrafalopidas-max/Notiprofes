import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  FolderCheck,
  FolderOpen,
  Globe,
  Link2,
  Mail,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  BoletinSemanal,
  DrivePdfMetadata,
  UsuarioDirectivo,
} from '../types/notiprofes';
import { generarHtmlPublicoBoletin } from '../utils/boletinLogic';
import {
  extraerIdCarpetaDrive,
  generarPdfBoletinOficial,
  obtenerAnioBoletin,
} from '../services/googleDrivePdfService';

// Genera el código listo para copiar y pegar en https://script.google.com con llave de seguridad integrada
function construirCodigoAppsScriptPuente(secretToken: string): string {
  const tokenSeguro =
    (secretToken || 'vf-bridge-44d5fa45caea6ce8ad0924da').replace(/['"\\]/g, '');
  return `// PUENTE GRATUITO NOTIPROFES -> GOOGLE DRIVE (SIN GOOGLE CLOUD CONSOLE)
// 1. Pega este código en https://script.google.com
// 2. Arriba en la barra, selecciona "autorizarDrive" y pulsa "▷ Ejecutar" para aceptar los permisos de Drive
// 3. Pulsa "Implementar" -> "Nueva implementación" -> Tipo: "Aplicación web"
// 4. Ejecutar como: "Yo" | Quién tiene acceso: "Cualquier persona"

var SECRET_TOKEN = '${tokenSeguro}';

function autorizarDrive() {
  DriveApp.getRootFolder();
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (SECRET_TOKEN && data.secretToken !== SECRET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: 'Acceso rechazado: token de seguridad no autorizado.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var folderName = data.folderName || 'Notiprofes 2026';
    var fileName = data.fileName || 'NotiProfes_VillaFlora.pdf';
    var bytes = Utilities.base64Decode(data.pdfBase64);
    var blob = Utilities.newBlob(bytes, 'application/pdf', fileName);

    // 1. Buscar o crear la carpeta anual (ej. "Notiprofes 2026")
    var folder = null;
    if (data.folderId) {
      try { folder = DriveApp.getFolderById(data.folderId); } catch (err) {}
    }
    if (!folder) {
      var folders = DriveApp.getFoldersByName(folderName);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    }

    // 2. Buscar archivo existente en la carpeta para conservar el mismo enlace/ID
    var existingFiles = folder.getFilesByName(fileName);
    var file = null;
    while (existingFiles.hasNext()) {
      var candidate = existingFiles.next();
      if (!file) {
        file = candidate;
      } else {
        candidate.setTrashed(true);
      }
    }

    // Si existe, actualiza o reemplaza en la misma carpeta y comparte enlace público de lectura
    if (file) {
      file.setTrashed(true);
    }
    var newFile = folder.createFile(blob);
    try {
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      fileId: newFile.getId(),
      fileName: newFile.getName(),
      folderId: folder.getId(),
      folderName: folder.getName(),
      webViewLink: newFile.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
}

function convertirBlobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultado = typeof reader.result === 'string' ? reader.result : '';
      const base64 = resultado.includes(',') ? resultado.split(',')[1] : resultado;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('No se pudo convertir el PDF a Base64.'));
    reader.readAsDataURL(blob);
  });
}

interface ConfigCarpetaAnualUI {
  anio: number;
  folderInput: string;
  folderId: string;
  folderName: string;
  actualizadoEn?: string;
  actualizadoPor?: string;
}

interface ModalPublicacionNubeProps {
  abierto: boolean;
  onCerrar: () => void;
  boletin: BoletinSemanal;
  usuarioActual?: UsuarioDirectivo | null;
  tokenSesion?: string | null;
  onSolicitarLogin?: () => void;
  onAbrirPrevisualizacion: () => void;
  onGuardarMetadataDrivePdf?: (drivePdfInfo: DrivePdfMetadata) => Promise<boolean>;
  onSincronizarPublicacion: () => Promise<boolean>;
}

export const ModalPublicacionNube: React.FC<ModalPublicacionNubeProps> = ({
  abierto,
  onCerrar,
  boletin,
  usuarioActual,
  tokenSesion,
  onSolicitarLogin,
  onAbrirPrevisualizacion,
  onGuardarMetadataDrivePdf,
  onSincronizarPublicacion,
}) => {
  const anioBoletinActual = useMemo(() => obtenerAnioBoletin(boletin), [boletin]);
  const esAdminUsuario =
    usuarioActual?.rol === 'administrador' ||
    Boolean(usuarioActual?.permisos?.puedeGestionarUsuarios);

  const [linkCorto, setLinkCorto] = useState<string>(
    boletin.numero === 40 ? 'https://is.gd/52X1sx' : `https://is.gd/vf26n${boletin.numero}`
  );
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [copiadoIframe, setCopiadoIframe] = useState(false);
  const [copiadoDriveLink, setCopiadoDriveLink] = useState(false);
  const [copiadoServidorPdfLink, setCopiadoServidorPdfLink] = useState(false);
  const [copiadoCodigoScript, setCopiadoCodigoScript] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSincronizado, setMensajeSincronizado] = useState<string | null>(null);

  // Estados simplificados de guardado automático de PDF (TrueNAS + Puente Apps Script sin OAuth)
  const [subiendoDrivePdf, setSubiendoDrivePdf] = useState<boolean>(false);
  const [confirmandoSobrescrituraDrive, setConfirmandoSobrescrituraDrive] =
    useState<boolean>(false);
  const [mostrarAjustesAvanzadosDrive, setMostrarAjustesAvanzadosDrive] =
    useState<boolean>(false);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>('');
  const [appsScriptToken, setAppsScriptToken] = useState<string>('');
  const [appsScriptConfigurado, setAppsScriptConfigurado] =
    useState<boolean>(false);
  const [guardandoConectorScript, setGuardandoConectorScript] =
    useState<boolean>(false);
  const [mensajeDrivePdf, setMensajeDrivePdf] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);

  // Estados de vinculación de carpeta institucional por año lectivo (ej. "Notiprofes 2026", "Notiprofes 2027")
  const [carpetasPorAnio, setCarpetasPorAnio] = useState<
    Record<string, ConfigCarpetaAnualUI>
  >({
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
  });
  const [anioCarpetaSeleccionado, setAnioCarpetaSeleccionado] = useState<number>(
    anioBoletinActual
  );
  const [nombreCarpetaAnual, setNombreCarpetaAnual] = useState<string>(
    `Notiprofes ${anioBoletinActual}`
  );
  const [guardandoCarpetaAnual, setGuardandoCarpetaAnual] = useState<boolean>(false);

  // Estados de notificaciones automáticas por correo SMTP
  const [smtpConfiguradoServidor, setSmtpConfiguradoServidor] = useState(false);
  const [smtpHostInfo, setSmtpHostInfo] = useState<string | null>(null);
  const [notificarAuto, setNotificarAuto] = useState(true);
  const [correosDocentesTexto, setCorreosDocentesTexto] = useState(
    'docentes@ievillaflora.edu.co, coordinacion@ievillaflora.edu.co, rectoria@ievillaflora.edu.co'
  );
  const [ultimoEnvioSmtp, setUltimoEnvioSmtp] = useState<{
    fecha: string;
    boletinNumero: number;
    totalDestinatarios: number;
    estado: 'enviado' | 'error';
    detalle: string;
  } | null>(null);
  const [guardandoSmtp, setGuardandoSmtp] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [mensajeSmtp, setMensajeSmtp] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);

  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>(() => {
    try {
      const fecha = boletin.ultimaActualizacion
        ? new Date(boletin.ultimaActualizacion)
        : new Date();
      return fecha.toLocaleString('es-CO', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '4/11/2026, 6:00 p. m.';
    }
  });

  const urlPublicSchedule = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/public/schedule?id=${encodeURIComponent(boletin.id)}`;
  }, [boletin.id]);

  const nombreArchivoPdfOficial = `NotiProfes_N${boletin.numero}_VillaFlora.pdf`;

  const urlDirectaPdfServidor = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/public/pdf/${nombreArchivoPdfOficial}`;
  }, [nombreArchivoPdfOficial]);

  // Detectar si el boletín tuvo ediciones posteriores a la última sincronización del PDF
  const tieneCambiosPendientesEnPdfDrive = useMemo(() => {
    if (!boletin.drivePdfInfo?.sincronizadoEn || !boletin.ultimaActualizacion) {
      return false;
    }
    const msEdicion = new Date(boletin.ultimaActualizacion).getTime();
    const msDrive = new Date(boletin.drivePdfInfo.sincronizadoEn).getTime();
    return msEdicion - msDrive > 5000;
  }, [boletin.drivePdfInfo?.sincronizadoEn, boletin.ultimaActualizacion]);

  useEffect(() => {
    setAnioCarpetaSeleccionado(anioBoletinActual);
  }, [anioBoletinActual]);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setConfirmandoSobrescrituraDrive(false);
    setMensajeDrivePdf(null);

    const obtenerLinkCorto = async () => {
      try {
        const resp = await fetch('/api/public/acortar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlPublicSchedule,
            numero: boletin.numero,
          }),
        });
        if (resp.ok && !cancelado) {
          const data = (await resp.json()) as { shortUrl?: string };
          if (data.shortUrl) {
            setLinkCorto(data.shortUrl);
          }
        }
      } catch {
        // Mantiene el link corto institucional de respaldo
      }
    };

    const cargarCarpetasDriveConfiguradas = async () => {
      if (!tokenSesion) return;
      try {
        const resp = await fetch('/api/drive/carpetas', {
          headers: {
            Authorization: `Bearer ${tokenSesion}`,
          },
        });
        if (resp.ok && !cancelado) {
          const data = (await resp.json()) as {
            carpetasPorAnio?: Record<string, ConfigCarpetaAnualUI>;
            appsScriptUrl?: string;
            appsScriptToken?: string;
            appsScriptConfigurado?: boolean;
          };
          if (typeof data.appsScriptUrl === 'string') {
            setAppsScriptUrl(data.appsScriptUrl);
          }
          if (typeof data.appsScriptToken === 'string') {
            setAppsScriptToken(data.appsScriptToken);
          }
          setAppsScriptConfigurado(Boolean(data.appsScriptConfigurado));
          if (data.carpetasPorAnio) {
            setCarpetasPorAnio(data.carpetasPorAnio);
            const confActual = data.carpetasPorAnio[String(anioBoletinActual)];
            if (confActual) {
              setNombreCarpetaAnual(
                confActual.folderName || `Notiprofes ${anioBoletinActual}`
              );
            }
          }
        }
      } catch {
        // Silencioso si no hay sesión directiva
      }
    };

    const cargarEstadoSmtp = async () => {
      if (!tokenSesion) return;
      try {
        const resp = await fetch('/api/notificaciones/smtp/estado', {
          headers: {
            Authorization: `Bearer ${tokenSesion}`,
          },
        });
        if (resp.ok && !cancelado) {
          const data = await resp.json();
          setSmtpConfiguradoServidor(Boolean(data.servidorConfiguradoEnEntorno));
          setSmtpHostInfo(
            data.hostConfigurado
              ? `${data.hostConfigurado}:${data.puertoConfigurado || 587}`
              : null
          );
          if (data.preferencias) {
            setNotificarAuto(Boolean(data.preferencias.notificarAutomaticamenteAlPublicar));
            setCorreosDocentesTexto(
              Array.isArray(data.preferencias.destinatariosDocentes)
                ? data.preferencias.destinatariosDocentes.join(', ')
                : ''
            );
            setUltimoEnvioSmtp(data.preferencias.ultimoEnvio || null);
          }
        }
      } catch {
        // Silencioso si no hay sesión directiva
      }
    };

    obtenerLinkCorto();
    cargarCarpetasDriveConfiguradas();
    cargarEstadoSmtp();
    return () => {
      cancelado = true;
    };
  }, [abierto, urlPublicSchedule, boletin.numero, tokenSesion, anioBoletinActual]);

  const handleCambiarAnioCarpeta = (nuevoAnio: number) => {
    setAnioCarpetaSeleccionado(nuevoAnio);
    const conf = carpetasPorAnio[String(nuevoAnio)];
    if (conf) {
      setNombreCarpetaAnual(conf.folderName || `Notiprofes ${nuevoAnio}`);
    } else {
      setNombreCarpetaAnual(`Notiprofes ${nuevoAnio}`);
    }
  };

  useEffect(() => {
    if (!boletin.ultimaActualizacion) return;
    try {
      const fecha = new Date(boletin.ultimaActualizacion);
      if (!isNaN(fecha.getTime())) {
        setUltimaSincronizacion(
          fecha.toLocaleString('es-CO', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        );
      }
    } catch {
      // Ignorar formato inválido
    }
  }, [boletin.ultimaActualizacion]);

  if (!abierto) return null;

  const codigoIframe = `<iframe
  src="${linkCorto}"
  width="100%"
  height="920"
  frameborder="0"
  allowfullscreen>
</iframe>`;

  const handleCopiarLink = () => {
    navigator.clipboard?.writeText(linkCorto);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2500);
  };

  const handleCopiarIframe = () => {
    navigator.clipboard?.writeText(codigoIframe);
    setCopiadoIframe(true);
    setTimeout(() => setCopiadoIframe(false), 2500);
  };

  const handleCopiarDriveLink = () => {
    const link = boletin.drivePdfInfo?.webViewLink || urlDirectaPdfServidor;
    navigator.clipboard?.writeText(link);
    setCopiadoDriveLink(true);
    setTimeout(() => setCopiadoDriveLink(false), 2500);
  };

  const handleCopiarServidorPdfLink = () => {
    navigator.clipboard?.writeText(urlDirectaPdfServidor);
    setCopiadoServidorPdfLink(true);
    setTimeout(() => setCopiadoServidorPdfLink(false), 2500);
  };

  const handleCopiarCodigoAppsScript = () => {
    const codigoFirmado = construirCodigoAppsScriptPuente(appsScriptToken);
    navigator.clipboard?.writeText(codigoFirmado);
    setCopiadoCodigoScript(true);
    setTimeout(() => setCopiadoCodigoScript(false), 3000);
  };

  const handleDescargarHtml = () => {
    const htmlCompleto = generarHtmlPublicoBoletin(boletin);
    const blob = new Blob([htmlCompleto], { type: 'text/html;charset=utf-8' });
    const urlDescarga = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlDescarga;
    a.download = `NotiProfes_N${boletin.numero}_VillaFlora.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlDescarga);
  };

  const handleDescargarPdfLocal = () => {
    const versionActual = boletin.drivePdfInfo?.version || 1;
    const { blob, fileName } = generarPdfBoletinOficial(boletin, versionActual);
    const urlDescarga = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlDescarga;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlDescarga);
  };

  const handleGuardarConectorAppsScript = async () => {
    if (!tokenSesion) {
      if (onSolicitarLogin) onSolicitarLogin();
      return;
    }
    setGuardandoConectorScript(true);
    setMensajeDrivePdf(null);
    try {
      const resp = await fetch('/api/drive/conector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          appsScriptUrl: appsScriptUrl.trim(),
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setAppsScriptConfigurado(Boolean(data.appsScriptConfigurado));
        setMensajeDrivePdf({
          tipo: 'ok',
          texto:
            data.mensaje ||
            'Puente con Google Drive guardado correctamente.',
        });
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: data.error || 'No se pudo guardar la URL del puente.',
        });
      }
    } catch {
      setMensajeDrivePdf({
        tipo: 'error',
        texto: 'Error de red al guardar el puente de Google Apps Script.',
      });
    } finally {
      setGuardandoConectorScript(false);
    }
  };

  const handleGuardarCarpetaAnual = async (
    anioGuardar: number = anioCarpetaSeleccionado
  ) => {
    if (!tokenSesion) {
      if (onSolicitarLogin) onSolicitarLogin();
      return;
    }

    setGuardandoCarpetaAnual(true);
    setMensajeDrivePdf(null);

    const valorNombre =
      nombreCarpetaAnual.trim() || `Notiprofes ${anioGuardar}`;
    const idDetectado = extraerIdCarpetaDrive(valorNombre);

    try {
      const resp = await fetch('/api/drive/carpetas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          anio: anioGuardar,
          folderInput: valorNombre,
          folderId: idDetectado,
          folderName: idDetectado ? `Notiprofes ${anioGuardar}` : valorNombre,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.carpetasPorAnio) {
        setCarpetasPorAnio(data.carpetasPorAnio);
        setMensajeDrivePdf({
          tipo: 'ok',
          texto:
            data.mensaje ||
            `Carpeta anual «${valorNombre}» guardada para los boletines del año ${anioGuardar}.`,
        });
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: data.error || 'No se pudo guardar el nombre de carpeta anual.',
        });
      }
    } catch {
      setMensajeDrivePdf({
        tipo: 'error',
        texto: 'Error de red al guardar la carpeta anual en el servidor.',
      });
    } finally {
      setGuardandoCarpetaAnual(false);
    }
  };

  // Guardado automático unificado (Opción 2: Servidor TrueNAS /app/data/pdfs + Opción 1: Puente Google Apps Script)
  const ejecutarSincronizacionPdfDrive = async () => {
    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: 'Inicie sesión con su cuenta directiva para publicar el PDF.',
        });
      }
      return;
    }

    setSubiendoDrivePdf(true);
    setConfirmandoSobrescrituraDrive(false);
    setMensajeDrivePdf(null);

    try {
      const versionNueva = (boletin.drivePdfInfo?.version || 0) + 1;
      const { blob, fileName } = generarPdfBoletinOficial(boletin, versionNueva);
      const pdfBase64 = await convertirBlobABase64(blob);

      const carpetaObjetivo =
        carpetasPorAnio[String(anioBoletinActual)]?.folderName ||
        `Notiprofes ${anioBoletinActual}`;

      const resp = await fetch('/api/drive/publicar-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          boletinId: boletin.id,
          numeroBoletin: boletin.numero,
          anio: anioBoletinActual,
          fileName,
          pdfBase64,
          folderNameOverride: carpetaObjetivo,
        }),
      });

      const data = await resp.json();
      if (resp.ok && data.metadata) {
        if (onGuardarMetadataDrivePdf) {
          await onGuardarMetadataDrivePdf(data.metadata as DrivePdfMetadata);
        }
        setMensajeDrivePdf({
          tipo: data.avisoBridgeDrive ? 'error' : 'ok',
          texto: data.avisoBridgeDrive
            ? `${data.mensaje} — Nota Drive: ${data.avisoBridgeDrive}`
            : data.mensaje ||
              `¡PDF oficial guardado automáticamente (Revisión v${versionNueva})!`,
        });
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: data.error || 'No fue posible guardar el PDF en el servidor.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setMensajeDrivePdf({
        tipo: 'error',
        texto: msg || 'Error al generar o guardar el PDF oficial.',
      });
    } finally {
      setSubiendoDrivePdf(false);
    }
  };

  const handleSolicitarSincronizacionPdfDrive = () => {
    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      }
      return;
    }

    if (boletin.drivePdfInfo?.fileId) {
      setConfirmandoSobrescrituraDrive(true);
      return;
    }

    ejecutarSincronizacionPdfDrive();
  };

  const handlePublicarYSincronizar = async () => {
    setSincronizando(true);
    setMensajeSincronizado(null);
    try {
      const ok = await onSincronizarPublicacion();
      // Guardar también el PDF oficial automáticamente al publicar
      if (tokenSesion) {
        await ejecutarSincronizacionPdfDrive();
      }
      const ahora = new Date().toLocaleString('es-CO', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      setUltimaSincronizacion(ahora);
      if (ok) {
        setMensajeSincronizado(
          'Boletín y PDF oficial publicados y actualizados automáticamente.'
        );
      } else {
        setMensajeSincronizado(
          'Sincronización completada con la vista pública y PDF actual.'
        );
      }
      setTimeout(() => setMensajeSincronizado(null), 4000);
    } finally {
      setSincronizando(false);
    }
  };

  const handleGuardarPreferenciasSmtp = async (nuevoEstadoAuto?: boolean) => {
    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setMensajeSmtp({
          tipo: 'error',
          texto: 'Inicie sesión con su perfil directivo para guardar la lista de destinatarios.',
        });
      }
      return;
    }
    setGuardandoSmtp(true);
    setMensajeSmtp(null);
    const autoValor =
      typeof nuevoEstadoAuto === 'boolean' ? nuevoEstadoAuto : notificarAuto;
    const listaCorreos = correosDocentesTexto
      .split(/[,;\n]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const resp = await fetch('/api/notificaciones/smtp/preferencias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          notificarAutomaticamenteAlPublicar: autoValor,
          destinatariosDocentes: listaCorreos,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.preferencias) {
        setNotificarAuto(Boolean(data.preferencias.notificarAutomaticamenteAlPublicar));
        setCorreosDocentesTexto(
          (data.preferencias.destinatariosDocentes || []).join(', ')
        );
        setMensajeSmtp({
          tipo: 'ok',
          texto: 'Preferencias y lista de correos de docentes guardadas correctamente.',
        });
      } else {
        setMensajeSmtp({
          tipo: 'error',
          texto: data.error || 'No se pudieron actualizar las preferencias SMTP.',
        });
      }
    } catch {
      setMensajeSmtp({
        tipo: 'error',
        texto: 'Error de conexión al guardar preferencias de notificación.',
      });
    } finally {
      setGuardandoSmtp(false);
    }
  };

  const handleEnviarNotificacionSmtpAhora = async () => {
    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setMensajeSmtp({
          tipo: 'error',
          texto: 'Inicie sesión con su perfil directivo para enviar notificaciones SMTP.',
        });
      }
      return;
    }
    setEnviandoCorreo(true);
    setMensajeSmtp(null);
    try {
      await handleGuardarPreferenciasSmtp();
      const resp = await fetch('/api/notificaciones/smtp/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({ boletinId: boletin.id }),
      });
      const data = await resp.json();
      if (data.preferencias?.ultimoEnvio) {
        setUltimoEnvioSmtp(data.preferencias.ultimoEnvio);
      }
      if (resp.ok) {
        setMensajeSmtp({
          tipo: 'ok',
          texto: data.mensaje || 'Notificación enviada por SMTP a los docentes.',
        });
      } else {
        setMensajeSmtp({
          tipo: 'error',
          texto:
            data.error ||
            'Verifique los parámetros del servidor SMTP en Administración de Usuarios → Servidor SMTP.',
        });
      }
    } catch {
      setMensajeSmtp({
        tipo: 'error',
        texto: 'Error de red al solicitar el envío de correo SMTP.',
      });
    } finally {
      setEnviandoCorreo(false);
    }
  };

  const carpetaActivaBoletin =
    carpetasPorAnio[String(anioBoletinActual)]?.folderName ||
    `Notiprofes ${anioBoletinActual}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-publicacion"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="max-w-2xl w-full bg-[#0F223D] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh] relative">
        {/* CABECERA INSTITUCIONAL */}
        <div className="bg-[#0F223D] px-6 pt-6 pb-4 flex flex-col relative shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal de publicación"
            className="absolute top-4 right-4 z-20 p-2 rounded-full text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-all cursor-pointer shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2 pr-8">
            <div className="w-10 h-10 rounded-xl bg-[#007DC5]/20 border border-[#007DC5]/40 flex items-center justify-center text-[#007DC5] shrink-0">
              <FileCode className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2
                  id="titulo-modal-publicacion"
                  className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight leading-tight"
                >
                  Publicación en la Nube y Enlace Acortado
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <Sparkles className="w-3 h-3" />
                  Sincronización en vivo
                </span>
              </div>
              <p className="text-xs text-sky-200/80 font-medium mt-0.5">
                Enlace corto web, guardado automático de PDF (TrueNAS + Google Drive) y avisos SMTP · I.E. Villa Flora
              </p>
            </div>
          </div>

          {/* Franja dorada divisoria institucional */}
          <div className="w-full h-1 bg-amber-400 rounded-full mt-2" />
        </div>

        {/* CUERPO BLANCO DEL MODAL */}
        <div className="bg-white px-5 sm:px-6 py-5 space-y-4 overflow-y-auto rounded-b-3xl">
          {mensajeSincronizado && (
            <div
              role="status"
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{mensajeSincronizado}</span>
            </div>
          )}

          {/* SECCIÓN 1 SIMPLIFICADA: GUARDADO AUTOMÁTICO DE PDF (TRUENAS + PUENTE GRATUITO GOOGLE DRIVE) */}
          <div className="bg-emerald-50/60 border border-emerald-300/90 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-extrabold text-[#065F46]">
                  <FolderCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    1. Guardado Automático de PDF Oficial (1 Clic · Sin OAuth)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Guarda y sobrescribe automáticamente <code className="font-mono-tabular font-bold">{nombreArchivoPdfOficial}</code> en la carpeta <strong>«{carpetaActivaBoletin}»</strong> de tu servidor TrueNAS {appsScriptConfigurado ? 'y en tu Google Drive' : '(y opcionalmente en Google Drive)'} sin pedir inicios de sesión.
                </p>
              </div>

              {boletin.drivePdfInfo ? (
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    tieneCambiosPendientesEnPdfDrive
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {tieneCambiosPendientesEnPdfDrive
                    ? `Cambios pendientes → Actualizar a v${boletin.drivePdfInfo.version + 1}`
                    : `PDF Alojado · Revisión v${boletin.drivePdfInfo.version}`}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                  Listo para guardar PDF (v1)
                </span>
              )}
            </div>

            {/* Tarjeta limpia de estado automático (lo único que ve el usuario normal) */}
            <div className="bg-white border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>
                    Carpeta anual automática:{' '}
                    <strong className="font-extrabold text-emerald-900">
                      📁 {carpetaActivaBoletin}
                    </strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                    {appsScriptConfigurado
                      ? 'TrueNAS + Google Drive Activos'
                      : 'Almacenamiento TrueNAS Activo'}
                  </span>
                </div>

                {esAdminUsuario && (
                  <button
                    type="button"
                    onClick={() => setMostrarAjustesAvanzadosDrive((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-600" />
                    <span>
                      {mostrarAjustesAvanzadosDrive
                        ? 'Ocultar configuración'
                        : 'Configurar Google Drive / Carpeta'}
                    </span>
                  </button>
                )}
              </div>

              {/* Enlace directo permanente del PDF en el servidor + enlace de Google Drive si existe */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{nombreArchivoPdfOficial}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopiarServidorPdfLink}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiadoServidorPdfLink ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Link PDF copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar link PDF directo</span>
                      </>
                    )}
                  </button>

                  {boletin.drivePdfInfo?.webViewLink &&
                    boletin.drivePdfInfo.webViewLink.includes('drive.google.com') && (
                      <button
                        type="button"
                        onClick={handleCopiarDriveLink}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiadoDriveLink ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Link Google Drive</span>
                          </>
                        )}
                      </button>
                    )}

                  <a
                    href={boletin.drivePdfInfo?.webViewLink || urlDirectaPdfServidor}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Abrir PDF publicado</span>
                  </a>
                </div>
              </div>
            </div>

            {/* PANEL DESPLEGABLE DE ADMINISTRADOR (Cerrado por defecto y exclusivo para Administradores) */}
            {esAdminUsuario && mostrarAjustesAvanzadosDrive && (
              <div className="bg-white border border-emerald-300 rounded-xl p-3.5 space-y-3 text-xs animate-in fade-in duration-150">
                {/* OPCIÓN 1: PUENTE GRATUITO GOOGLE APPS SCRIPT (SIN GOOGLE CLOUD NI TARJETAS) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Opción 1: Puente Gratuito a tu Google Drive (Sin Google Cloud ni Tarjetas)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopiarCodigoAppsScript}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiadoCodigoScript ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>¡Código copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>1. Copiar código conector</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong>Solo se hace una vez:</strong> Pulsa <em>«1. Copiar código conector»</em>, abre{' '}
                    <a
                      href="https://script.google.com/home/start"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#007DC5] underline"
                    >
                      script.google.com
                    </a>{' '}
                    con tu Gmail normal (es 100% gratis y no pide tarjeta), pega el código en un <em>Nuevo proyecto</em>, pulsa{' '}
                    <strong>Implementar → Nueva implementación → Aplicación web</strong> (acceso: <em>Cualquier persona</em>) y pega aquí la URL generada:
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="url"
                      value={appsScriptUrl}
                      onChange={(e) => setAppsScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono-tabular text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      disabled={guardandoConectorScript}
                      onClick={handleGuardarConectorAppsScript}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {guardandoConectorScript ? 'Guardando...' : 'Guardar Puente'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* OPCIÓN 2: CARPETA LOCAL EN TRUENAS + NOMBRE DE CARPETA ANUAL */}
                <div className="pt-2.5 border-t border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Opción 2: Carpeta Anual en TrueNAS (<code>/app/data/pdfs/</code>) y Drive
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {[2026, 2027].map((anioItem) => {
                        const activo = anioCarpetaSeleccionado === anioItem;
                        return (
                          <button
                            key={anioItem}
                            type="button"
                            onClick={() => handleCambiarAnioCarpeta(anioItem)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                              activo
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Año {anioItem}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={nombreCarpetaAnual}
                      onChange={(e) => setNombreCarpetaAnual(e.target.value)}
                      placeholder={`Notiprofes ${anioCarpetaSeleccionado}`}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      disabled={guardandoCarpetaAnual}
                      onClick={() => handleGuardarCarpetaAnual(anioCarpetaSeleccionado)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {guardandoCarpetaAnual
                          ? 'Guardando...'
                          : `Guardar nombre ${anioCarpetaSeleccionado}`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Diálogo de confirmación antes de sobrescribir un archivo existente */}
            {confirmandoSobrescrituraDrive && boletin.drivePdfInfo && (
              <div
                role="alertdialog"
                aria-label="Confirmar actualización de archivo PDF"
                className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5 animate-in fade-in duration-150"
              >
                <div className="flex items-start gap-2.5 text-xs text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      ¿Confirmas actualizar el PDF oficial «{boletin.drivePdfInfo.fileName}»?
                    </p>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Se reemplazará automáticamente dentro de la carpeta <strong>«{carpetaActivaBoletin}»</strong> generando la <strong>Revisión v{boletin.drivePdfInfo.version + 1}</strong> y manteniendo el mismo enlace compartido.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoSobrescrituraDrive(false)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={ejecutarSincronizacionPdfDrive}
                    disabled={subiendoDrivePdf}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      Confirmar y Actualizar PDF (v{boletin.drivePdfInfo.version + 1})
                    </span>
                  </button>
                </div>
              </div>
            )}

            {mensajeDrivePdf && (
              <div
                role="status"
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold border ${
                  mensajeDrivePdf.tipo === 'ok'
                    ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {mensajeDrivePdf.texto}
              </div>
            )}

            {/* Botones de acción PDF: Descargar local o Guardar en 1 clic */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleDescargarPdfLocal}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Descargar PDF en mi equipo</span>
              </button>

              <button
                type="button"
                disabled={subiendoDrivePdf}
                onClick={handleSolicitarSincronizacionPdfDrive}
                className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${subiendoDrivePdf ? 'animate-spin' : ''}`}
                />
                <span>
                  {subiendoDrivePdf
                    ? 'Guardando PDF automáticamente...'
                    : boletin.drivePdfInfo
                      ? `Actualizar PDF en «${carpetaActivaBoletin}» (v${boletin.drivePdfInfo.version + 1})`
                      : `Guardar PDF Oficial en «${carpetaActivaBoletin}» (v1)`}
                </span>
              </button>
            </div>
          </div>

          {/* SECCIÓN 2: LINK ACORTADO OFICIAL */}
          <div className="bg-[#F4F8FF] border border-blue-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#0F172A]">
                <Link2 className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>Link Acortado Oficial Web (Oculta la ruta del enlace)</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-blue-100/80 text-[#1D4ED8] text-[11px] font-semibold">
                Ruta enmascarada automáticamente
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                readOnly
                aria-label="Enlace corto oficial"
                value={linkCorto}
                className="flex-1 rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-mono-tabular font-bold text-[#1D4ED8] focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopiarLink}
                className="px-4 py-2.5 rounded-xl bg-[#007DC5] hover:bg-[#034EA2] text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {copiadoLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link Corto</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SECCIÓN 3: TARJETAS DUALES (VISTA PÚBLICA EN CALIENTE + DESCARGAR HTML ÚNICO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tarjeta Izquierda: Vista Pública en Caliente */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#1D4ED8]">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Vista Pública en Caliente</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Abre la página visual exactamente como la ven padres, estudiantes y docentes con filtros interactivos.
                </p>
              </div>

              <div>
                <a
                  href={`/public/schedule?id=${encodeURIComponent(boletin.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-[#007DC5] hover:bg-[#034EA2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Consulta Pública</span>
                </a>
              </div>
            </div>

            {/* Tarjeta Derecha: Descargar Archivo HTML Único */}
            <div className="bg-white border border-emerald-400/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#047857]">
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Descargar Archivo HTML Único</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Genera el archivo{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono-tabular text-[11px]">
                    .html
                  </code>{' '}
                  autónomo con logo institucional y casillas 60/40 para respaldo offline.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDescargarHtml}
                  className="px-4 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar HTML</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCerrar();
                    onAbrirPrevisualizacion();
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Previsualizar</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: NOTIFICACIONES AUTOMÁTICAS POR CORREO SMTP A DOCENTES */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#0F172A]">
                <Mail className="w-4 h-4 text-[#007DC5] shrink-0" />
                <span>Notificación Automática por Correo (SMTP Docentes)</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                  smtpConfiguradoServidor
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {smtpConfiguradoServidor
                  ? `SMTP Activo (${smtpHostInfo})`
                  : 'Configurable en Administración de Usuarios → Servidor SMTP'}
              </span>
            </div>

            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={notificarAuto}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNotificarAuto(checked);
                  if (tokenSesion) {
                    handleGuardarPreferenciasSmtp(checked);
                  }
                }}
                className="accent-[#007DC5] w-4 h-4 rounded"
              />
              <span>
                Enviar notificación automática a los docentes al publicar o clonar un nuevo boletín oficial
              </span>
            </label>

            <div>
              <label
                htmlFor="smtp-correos-docentes"
                className="block text-[11px] font-bold text-slate-600 mb-1"
              >
                Lista de distribución de correos docentes (separados por coma):
              </label>
              <textarea
                id="smtp-correos-docentes"
                rows={2}
                value={correosDocentesTexto}
                onChange={(e) => setCorreosDocentesTexto(e.target.value)}
                placeholder="docentes@ievillaflora.edu.co, coordinacion@ievillaflora.edu.co..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
              />
            </div>

            {mensajeSmtp && (
              <div
                className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
                  mensajeSmtp.tipo === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {mensajeSmtp.texto}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-slate-500">
                {ultimoEnvioSmtp
                  ? `Último intento (N° ${ultimoEnvioSmtp.boletinNumero}): ${ultimoEnvioSmtp.fecha} · ${ultimoEnvioSmtp.estado === 'enviado' ? 'Enviado' : 'Pendiente SMTP'}`
                  : 'Las credenciales SMTP se gestionan en Administración de Usuarios → Servidor SMTP.'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={guardandoSmtp}
                  onClick={() => handleGuardarPreferenciasSmtp()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {guardandoSmtp ? 'Guardando...' : 'Guardar Destinatarios'}
                </button>
                <button
                  type="button"
                  disabled={enviandoCorreo}
                  onClick={handleEnviarNotificacionSmtpAhora}
                  className="px-3.5 py-1.5 rounded-lg bg-[#007DC5] hover:bg-[#034EA2] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {enviandoCorreo ? 'Enviando...' : 'Notificar Ahora'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: CÓDIGO IFRAME CON LINK CORTO PARA EL SITIO WEB DEL COLEGIO */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-slate-800">
                <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Código Iframe con Link Corto para el Sitio Web del Colegio</span>
              </div>
              <button
                type="button"
                onClick={handleCopiarIframe}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                {copiadoIframe ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">¡Iframe Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar Iframe</span>
                  </>
                )}
              </button>
            </div>

            <pre className="bg-[#0B132B] text-slate-100 rounded-xl p-4 font-mono-tabular text-xs leading-relaxed overflow-x-auto select-all">
              <code>{codigoIframe}</code>
            </pre>
          </div>

          {/* PIE DE SINCRONIZACIÓN Y BOTONES DE ACCIÓN */}
          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between gap-2 text-xs border-t border-slate-100 pt-3">
              <span className="text-slate-500 font-medium">
                Última sincronización en la nube:
              </span>
              <span className="font-mono-tabular font-bold text-slate-800">
                {ultimaSincronizacion}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                disabled={sincronizando}
                onClick={handlePublicarYSincronizar}
                className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <CloudUpload className="w-4 h-4" />
                <span>
                  {sincronizando
                    ? 'Sincronizando...'
                    : 'Publicar y Sincronizar en la Nube'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
