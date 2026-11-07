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
  LogOut,
  Mail,
  RefreshCw,
  Send,
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
  conectarGoogleDrive,
  desconectarGoogleDrive,
  extraerIdCarpetaDrive,
  generarPdfBoletinOficial,
  initGoogleDriveAuth,
  listarCarpetasDriveDisponibles,
  obtenerAnioBoletin,
  obtenerTokenGoogleDrive,
  sincronizarPdfBoletinEnGoogleDrive,
} from '../services/googleDrivePdfService';

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

  const [linkCorto, setLinkCorto] = useState<string>(
    boletin.numero === 40 ? 'https://is.gd/52X1sx' : `https://is.gd/vf26n${boletin.numero}`
  );
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [copiadoIframe, setCopiadoIframe] = useState(false);
  const [copiadoDriveLink, setCopiadoDriveLink] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSincronizado, setMensajeSincronizado] = useState<string | null>(null);

  // Estados de Google Drive (OAuth + Sobrescritura inteligente de PDF sobre mismo ID)
  const [needsDriveAuth, setNeedsDriveAuth] = useState<boolean>(
    () => !obtenerTokenGoogleDrive()
  );
  const [cuentaGoogleCorreo, setCuentaGoogleCorreo] = useState<string | null>(null);
  const [conectandoDrive, setConectandoDrive] = useState<boolean>(false);
  const [subiendoDrivePdf, setSubiendoDrivePdf] = useState<boolean>(false);
  const [confirmandoSobrescrituraDrive, setConfirmandoSobrescrituraDrive] =
    useState<boolean>(false);
  const [mensajeDrivePdf, setMensajeDrivePdf] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);

  // Estados de vinculación de carpeta institucional por año lectivo (ej. "Villa Flora 2026", "Villa Flora 2027")
  const [carpetasPorAnio, setCarpetasPorAnio] = useState<
    Record<string, ConfigCarpetaAnualUI>
  >({
    '2026': {
      anio: 2026,
      folderInput: 'Villa Flora 2026',
      folderId: '',
      folderName: 'Villa Flora 2026',
    },
    '2027': {
      anio: 2027,
      folderInput: 'Villa Flora 2027',
      folderId: '',
      folderName: 'Villa Flora 2027',
    },
  });
  const [anioCarpetaSeleccionado, setAnioCarpetaSeleccionado] = useState<number>(
    anioBoletinActual
  );
  const [entradaCarpetaAnual, setEntradaCarpetaAnual] = useState<string>(
    `Villa Flora ${anioBoletinActual}`
  );
  const [nombreCarpetaAnual, setNombreCarpetaAnual] = useState<string>(
    `Villa Flora ${anioBoletinActual}`
  );
  const [guardandoCarpetaAnual, setGuardandoCarpetaAnual] = useState<boolean>(false);
  const [explorandoCarpetasDrive, setExplorandoCarpetasDrive] =
    useState<boolean>(false);
  const [carpetasDriveEncontradas, setCarpetasDriveEncontradas] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [mostrarSelectorCarpetasDrive, setMostrarSelectorCarpetasDrive] =
    useState<boolean>(false);

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

  // Detectar si el boletín tuvo ediciones posteriores a la última sincronización del PDF en Drive
  const tieneCambiosPendientesEnPdfDrive = useMemo(() => {
    if (!boletin.drivePdfInfo?.sincronizadoEn || !boletin.ultimaActualizacion) {
      return false;
    }
    const msEdicion = new Date(boletin.ultimaActualizacion).getTime();
    const msDrive = new Date(boletin.drivePdfInfo.sincronizadoEn).getTime();
    return msEdicion - msDrive > 5000;
  }, [boletin.drivePdfInfo?.sincronizadoEn, boletin.ultimaActualizacion]);

  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(
      (user) => {
        setNeedsDriveAuth(false);
        setCuentaGoogleCorreo(user.email || user.displayName || 'Cuenta Google activa');
      },
      () => {
        setNeedsDriveAuth(true);
        setCuentaGoogleCorreo(null);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setAnioCarpetaSeleccionado(anioBoletinActual);
  }, [anioBoletinActual]);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setConfirmandoSobrescrituraDrive(false);
    setMensajeDrivePdf(null);
    setMostrarSelectorCarpetasDrive(false);

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
          };
          if (data.carpetasPorAnio) {
            setCarpetasPorAnio(data.carpetasPorAnio);
            const confActual = data.carpetasPorAnio[String(anioBoletinActual)];
            if (confActual) {
              setEntradaCarpetaAnual(
                confActual.folderInput ||
                  confActual.folderId ||
                  confActual.folderName ||
                  `Villa Flora ${anioBoletinActual}`
              );
              setNombreCarpetaAnual(
                confActual.folderName || `Villa Flora ${anioBoletinActual}`
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

  // Sincronizar los campos del formulario cuando el directivo cambia el año en el selector (ej. 2026 ↔ 2027)
  const handleCambiarAnioCarpeta = (nuevoAnio: number) => {
    setAnioCarpetaSeleccionado(nuevoAnio);
    const conf = carpetasPorAnio[String(nuevoAnio)];
    if (conf) {
      setEntradaCarpetaAnual(
        conf.folderInput || conf.folderId || conf.folderName || `Villa Flora ${nuevoAnio}`
      );
      setNombreCarpetaAnual(conf.folderName || `Villa Flora ${nuevoAnio}`);
    } else {
      setEntradaCarpetaAnual(`Villa Flora ${nuevoAnio}`);
      setNombreCarpetaAnual(`Villa Flora ${nuevoAnio}`);
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
    if (!boletin.drivePdfInfo?.webViewLink) return;
    navigator.clipboard?.writeText(boletin.drivePdfInfo.webViewLink);
    setCopiadoDriveLink(true);
    setTimeout(() => setCopiadoDriveLink(false), 2500);
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

  const handleConectarGoogleDrive = async () => {
    setConectandoDrive(true);
    setMensajeDrivePdf(null);
    try {
      const res = await conectarGoogleDrive();
      if (res) {
        setNeedsDriveAuth(false);
        setCuentaGoogleCorreo(
          res.user.email || res.user.displayName || 'Cuenta Google activa'
        );
        setMensajeDrivePdf({
          tipo: 'ok',
          texto: `Cuenta Google Drive conectada (${res.user.email || 'autorizada'}). Ya puedes sincronizar el PDF oficial.`,
        });
      }
    } catch (err: unknown) {
      const detalle =
        err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión con Google.';
      setMensajeDrivePdf({
        tipo: 'error',
        texto: `Conexión con Google Drive cancelada o fallida: ${detalle}`,
      });
    } finally {
      setConectandoDrive(false);
    }
  };

  const handleDesconectarGoogleDrive = async () => {
    await desconectarGoogleDrive();
    setNeedsDriveAuth(true);
    setCuentaGoogleCorreo(null);
    setConfirmandoSobrescrituraDrive(false);
    setMostrarSelectorCarpetasDrive(false);
  };

  const handleGuardarCarpetaAnual = async (
    anioGuardar: number = anioCarpetaSeleccionado,
    inputPersonalizado?: string,
    idPersonalizado?: string,
    nombrePersonalizado?: string
  ) => {
    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: 'Inicie sesión con su cuenta directiva para guardar la carpeta anual.',
        });
      }
      return;
    }

    setGuardandoCarpetaAnual(true);
    setMensajeDrivePdf(null);

    const valorEntrada = (inputPersonalizado ?? entradaCarpetaAnual).trim();
    const idDetectado =
      (idPersonalizado ?? extraerIdCarpetaDrive(valorEntrada)).trim();
    const valorNombre =
      (nombrePersonalizado ?? nombreCarpetaAnual).trim() ||
      (!idDetectado && valorEntrada ? valorEntrada : `Villa Flora ${anioGuardar}`);

    try {
      const resp = await fetch('/api/drive/carpetas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          anio: anioGuardar,
          folderInput: valorEntrada || valorNombre,
          folderId: idDetectado,
          folderName: valorNombre,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.carpetasPorAnio) {
        setCarpetasPorAnio(data.carpetasPorAnio);
        const confGuardada = data.carpetasPorAnio[String(anioGuardar)];
        if (confGuardada && anioGuardar === anioCarpetaSeleccionado) {
          setEntradaCarpetaAnual(confGuardada.folderInput);
          setNombreCarpetaAnual(confGuardada.folderName);
        }
        setMensajeDrivePdf({
          tipo: 'ok',
          texto:
            data.mensaje ||
            `Carpeta anual «${valorNombre}» guardada para los boletines del año ${anioGuardar}.`,
        });
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: data.error || 'No se pudo guardar la configuración de carpeta anual.',
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

  const handleExplorarCarpetasDrive = async () => {
    if (needsDriveAuth || !obtenerTokenGoogleDrive()) {
      setMensajeDrivePdf({
        tipo: 'error',
        texto: 'Primero conecta tu cuenta de Google Drive para listar tus carpetas disponibles.',
      });
      return;
    }
    setExplorandoCarpetasDrive(true);
    setMensajeDrivePdf(null);
    try {
      const lista = await listarCarpetasDriveDisponibles();
      setCarpetasDriveEncontradas(lista);
      setMostrarSelectorCarpetasDrive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'SESION_DRIVE_EXPIRADA' || msg === 'SESION_DRIVE_REQUERIDA') {
        setNeedsDriveAuth(true);
      }
      setMensajeDrivePdf({
        tipo: 'error',
        texto: 'No fue posible consultar las carpetas de Google Drive. Verifica tu sesión.',
      });
    } finally {
      setExplorandoCarpetasDrive(false);
    }
  };

  const obtenerOpcionesCarpetaBoletinActual = () => {
    const confAnioBoletin = carpetasPorAnio[String(anioBoletinActual)];
    // Si el usuario está editando precisamente el año del boletín actual, usar los valores en pantalla
    if (anioCarpetaSeleccionado === anioBoletinActual) {
      const idEnPantalla = extraerIdCarpetaDrive(entradaCarpetaAnual);
      const nombreEnPantalla =
        nombreCarpetaAnual.trim() ||
        (!idEnPantalla && entradaCarpetaAnual.trim()
          ? entradaCarpetaAnual.trim()
          : `Villa Flora ${anioBoletinActual}`);
      return {
        anio: anioBoletinActual,
        folderId: idEnPantalla || confAnioBoletin?.folderId || '',
        folderName: nombreEnPantalla,
      };
    }
    return {
      anio: anioBoletinActual,
      folderId: confAnioBoletin?.folderId || '',
      folderName: confAnioBoletin?.folderName || `Villa Flora ${anioBoletinActual}`,
    };
  };

  const ejecutarSincronizacionPdfDrive = async () => {
    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: 'Inicie sesión con su cuenta directiva para registrar el PDF en el boletín.',
        });
      }
      return;
    }

    setSubiendoDrivePdf(true);
    setConfirmandoSobrescrituraDrive(false);
    setMensajeDrivePdf(null);

    try {
      const autorNombre =
        usuarioActual?.nombre || boletin.actualizadoPor || 'Dirección Institucional';
      const opcionesCarpeta = obtenerOpcionesCarpetaBoletinActual();
      const metadata = await sincronizarPdfBoletinEnGoogleDrive(
        boletin,
        autorNombre,
        opcionesCarpeta
      );

      // Persistir también el folderId y folderName resueltos para este año lectivo en el servidor
      try {
        const respCarpeta = await fetch('/api/drive/carpetas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenSesion}`,
          },
          body: JSON.stringify({
            anio: anioBoletinActual,
            folderInput:
              anioCarpetaSeleccionado === anioBoletinActual
                ? entradaCarpetaAnual.trim() || metadata.folderName
                : metadata.folderName,
            folderId: metadata.folderId,
            folderName: metadata.folderName,
          }),
        });
        if (respCarpeta.ok) {
          const dataCarpeta = await respCarpeta.json();
          if (dataCarpeta.carpetasPorAnio) {
            setCarpetasPorAnio(dataCarpeta.carpetasPorAnio);
          }
        }
      } catch {
        // Continúa aunque falle el guardado secundario de carpeta
      }

      if (onGuardarMetadataDrivePdf) {
        await onGuardarMetadataDrivePdf(metadata);
      }

      setMensajeDrivePdf({
        tipo: 'ok',
        texto:
          metadata.version > 1
            ? `¡PDF sobrescrito con éxito sobre el mismo ID de Google Drive (Revisión v${metadata.version}) en la carpeta «${metadata.folderName}»!`
            : `¡PDF oficial «${metadata.fileName}» guardado en la carpeta anual «${metadata.folderName}» de Google Drive (v1)!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'SESION_DRIVE_REQUERIDA' || msg === 'SESION_DRIVE_EXPIRADA') {
        setNeedsDriveAuth(true);
        setMensajeDrivePdf({
          tipo: 'error',
          texto: 'Tu sesión de Google Drive expiró. Pulsa «Conectar con Google Drive» para continuar.',
        });
      } else {
        setMensajeDrivePdf({
          tipo: 'error',
          texto: msg || 'No fue posible sincronizar el PDF con Google Drive.',
        });
      }
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

    if (needsDriveAuth || !obtenerTokenGoogleDrive()) {
      setNeedsDriveAuth(true);
      setMensajeDrivePdf({
        tipo: 'error',
        texto: 'Primero conecta tu cuenta de Google Drive usando el botón oficial.',
      });
      return;
    }

    // Si ya existe un archivo en Google Drive para este boletín, pedir confirmación explícita antes de sobrescribirlo
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
          'Boletín publicado y sincronizado en la nube correctamente.'
        );
      } else {
        setMensajeSincronizado(
          'Sincronización completada con la vista pública actual.'
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
    `Villa Flora ${anioBoletinActual}`;

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
                Enlace corto web, repositorio PDF con ID único en Google Drive y avisos SMTP · I.E. Villa Flora
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

          {/* SECCIÓN 1: REPOSITORIO OFICIAL PDF EN GOOGLE DRIVE (SOBRESCRITURA INTELIGENTE MISMO ID) */}
          <div className="bg-emerald-50/60 border border-emerald-300/90 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-extrabold text-[#065F46]">
                  <FolderCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    1. Repositorio PDF en Google Drive (Sobrescritura sobre ID Único)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Genera <code className="font-mono-tabular font-bold">NotiProfes_N{boletin.numero}_VillaFlora.pdf</code> dentro de la carpeta anual <strong>«{carpetaActivaBoletin}»</strong> y actualiza siempre el mismo archivo sin romper el enlace compartido.
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
                    ? `Ediciones pendientes → Actualizar a v${boletin.drivePdfInfo.version + 1}`
                    : `Sincronizado en Drive · Revisión v${boletin.drivePdfInfo.version}`}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                  Primera publicación PDF pendiente (v1)
                </span>
              )}
            </div>

            {/* Estado de autenticación con Google Drive */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-emerald-200/80">
              {needsDriveAuth ? (
                <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                  <span className="text-xs font-medium text-slate-700">
                    Autoriza tu cuenta de Google para crear o actualizar el PDF oficial en tu unidad de Drive:
                  </span>
                  <button
                    type="button"
                    disabled={conectandoDrive}
                    onClick={handleConectarGoogleDrive}
                    className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
                  >
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="w-4 h-4 shrink-0"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    <span>
                      {conectandoDrive ? 'Conectando...' : 'Sign in with Google'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 text-xs text-emerald-900 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Google Drive conectado:</span>
                    <strong className="font-bold">{cuentaGoogleCorreo}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleDesconectarGoogleDrive}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Cambiar cuenta</span>
                  </button>
                </div>
              )}
            </div>

            {/* OPCIÓN 2: VINCULACIÓN DE CARPETA ESPECÍFICA POR AÑO LECTIVO (EJ. VILLA FLORA 2026 / VILLA FLORA 2027) */}
            <div className="bg-white border border-emerald-200/90 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Carpeta Institucional de Google Drive por Año Lectivo
                  </span>
                </div>

                {/* Selector de Año Lectivo (2026 / 2027) */}
                <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {[2026, 2027].map((anioItem) => {
                    const activo = anioCarpetaSeleccionado === anioItem;
                    return (
                      <button
                        key={anioItem}
                        type="button"
                        onClick={() => handleCambiarAnioCarpeta(anioItem)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          activo
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Año {anioItem}
                        {anioItem === anioBoletinActual ? ' (Actual)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Pega el <strong>enlace o ID de la carpeta de Google Drive</strong> o escribe el nombre exacto de la carpeta anual (ej. <code>Villa Flora {anioCarpetaSeleccionado}</code>) para evitar confusiones al cambiar de año escolar:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="drive-nombre-carpeta-anual"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1"
                  >
                    Nombre de carpeta ({anioCarpetaSeleccionado})
                  </label>
                  <input
                    id="drive-nombre-carpeta-anual"
                    type="text"
                    value={nombreCarpetaAnual}
                    onChange={(e) => setNombreCarpetaAnual(e.target.value)}
                    placeholder={`Villa Flora ${anioCarpetaSeleccionado}`}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="sm:col-span-7">
                  <label
                    htmlFor="drive-link-id-carpeta-anual"
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1"
                  >
                    Enlace de Google Drive o ID de Carpeta (Opcional)
                  </label>
                  <input
                    id="drive-link-id-carpeta-anual"
                    type="text"
                    value={entradaCarpetaAnual}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEntradaCarpetaAnual(val);
                      if (!extraerIdCarpetaDrive(val) && val.trim().length > 0) {
                        setNombreCarpetaAnual(val.trim());
                      }
                    }}
                    placeholder={`https://drive.google.com/drive/folders/... o Villa Flora ${anioCarpetaSeleccionado}`}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-mono-tabular focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={explorandoCarpetasDrive}
                    onClick={handleExplorarCarpetasDrive}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      {explorandoCarpetasDrive
                        ? 'Buscando carpetas...'
                        : 'Elegir carpeta de mi Drive'}
                    </span>
                  </button>

                  {carpetasPorAnio[String(anioCarpetaSeleccionado)]?.folderId && (
                    <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ID vinculado: {carpetasPorAnio[String(anioCarpetaSeleccionado)].folderId}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={guardandoCarpetaAnual}
                  onClick={() => handleGuardarCarpetaAnual(anioCarpetaSeleccionado)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {guardandoCarpetaAnual
                      ? 'Guardando...'
                      : `Vincular carpeta ${anioCarpetaSeleccionado}`}
                  </span>
                </button>
              </div>

              {/* Lista desplegable de carpetas encontradas en el Google Drive del directivo */}
              {mostrarSelectorCarpetasDrive && (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>
                      Selecciona una carpeta de tu Google Drive para el año {anioCarpetaSeleccionado}:
                    </span>
                    <button
                      type="button"
                      onClick={() => setMostrarSelectorCarpetasDrive(false)}
                      className="text-slate-500 hover:text-slate-800 text-[11px] cursor-pointer"
                    >
                      Cerrar lista
                    </button>
                  </div>
                  {carpetasDriveEncontradas.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No se encontraron carpetas previas creadas por la aplicación. Al publicar el boletín se creará automáticamente <strong>«{nombreCarpetaAnual || `Villa Flora ${anioCarpetaSeleccionado}`}»</strong>.
                    </p>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {carpetasDriveEncontradas.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => {
                            setNombreCarpetaAnual(folder.name);
                            setEntradaCarpetaAnual(folder.id);
                            setMostrarSelectorCarpetasDrive(false);
                            handleGuardarCarpetaAnual(
                              anioCarpetaSeleccionado,
                              folder.id,
                              folder.id,
                              folder.name
                            );
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-md bg-white hover:bg-emerald-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 truncate">
                            {folder.name}
                          </span>
                          <span className="text-[10px] font-mono-tabular text-slate-500 shrink-0">
                            ID: {folder.id.slice(0, 10)}...
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Metadatos del archivo único en Drive si ya fue creado */}
            {boletin.drivePdfInfo && (
              <div className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{boletin.drivePdfInfo.fileName}</span>
                    <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      ID: {boletin.drivePdfInfo.fileId}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopiarDriveLink}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiadoDriveLink ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Enlace copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar link Drive</span>
                        </>
                      )}
                    </button>
                    <a
                      href={boletin.drivePdfInfo.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Abrir en Drive</span>
                    </a>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  Carpeta vinculada: <strong>{boletin.drivePdfInfo.folderName || carpetaActivaBoletin}</strong> · Última versión subida por {boletin.drivePdfInfo.sincronizadoPor}
                </div>
              </div>
            )}

            {/* Diálogo de confirmación obligatoria antes de sobrescribir un archivo existente en Google Drive */}
            {confirmandoSobrescrituraDrive && boletin.drivePdfInfo && (
              <div
                role="alertdialog"
                aria-label="Confirmar actualización de archivo PDF en Google Drive"
                className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5 animate-in fade-in duration-150"
              >
                <div className="flex items-start gap-2.5 text-xs text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      ¿Confirmas actualizar el archivo existente «{boletin.drivePdfInfo.fileName}» en Google Drive?
                    </p>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Se sobrescribirá el contenido sobre el mismo ID de Google Drive (<code>{boletin.drivePdfInfo.fileId}</code>) dentro de la carpeta anual <strong>«{carpetaActivaBoletin}»</strong> generando la <strong>Revisión v{boletin.drivePdfInfo.version + 1}</strong> y manteniendo intacto el enlace compartido con los docentes.
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
                      Confirmar y Sobrescribir PDF (v{boletin.drivePdfInfo.version + 1})
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

            {/* Botones de acción PDF: Descargar local o Sincronizar en Drive */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleDescargarPdfLocal}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Descargar PDF Local</span>
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
                    ? 'Sincronizando PDF con Google Drive...'
                    : boletin.drivePdfInfo
                      ? `Actualizar PDF en Drive · ${carpetaActivaBoletin} (v${boletin.drivePdfInfo.version + 1})`
                      : `Subir PDF Oficial a «${carpetaActivaBoletin}» (v1)`}
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
