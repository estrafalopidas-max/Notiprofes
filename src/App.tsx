import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CalendarRange,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  History,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Share2,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Download,
  Award,
  Sparkles,
  X,
} from 'lucide-react';
import { BOLETIN_39_SEED, BOLETIN_40_SEED, BOLETIN_41_SEED } from './data/seedNotiprofes40';
import {
  BoletinSemanal,
  OpcionesClonarBoletin,
  OperacionBoletin,
  PresenciaActiva,
  UsuarioDirectivo,
} from './types/notiprofes';
import { VistaBoletinOficial } from './components/VistaBoletinOficial';
import {
  PanelEditorColaborativo,
  SeccionEditor,
} from './components/PanelEditorColaborativo';
import { GuiaDespliegueNas } from './components/GuiaDespliegueNas';
import { ModalAccesoDirectivo } from './components/ModalAccesoDirectivo';
import { ModalAdministracionUsuarios } from './components/ModalAdministracionUsuarios';
import { ModalConfirmarLogout } from './components/ModalConfirmarLogout';
import { ModalPrevisualizarBoletin } from './components/ModalPrevisualizarBoletin';
import { ModalPublicacionNube } from './components/ModalPublicacionNube';
import { DropdownPersonalizado } from './components/DropdownPersonalizado';
import { calcularEstadoCalendarioBoletin } from './utils/calendarioEscolar2026';
import { descargarPdfBoletinDirecto } from './services/googleDrivePdfService';
import { ToastNotificacionEditor } from './components/ToastNotificacionEditor';

type VistaPrincipal = 'boletin' | 'editor' | 'nas';

interface ResumenBoletin {
  id: string;
  numero: number;
  fechaEmision: string;
  semanaTexto: string;
}

function obtenerIniciales(nombre: string): string {
  if (!nombre) return 'DP';
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'DP';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function App() {
  const [vistaActiva, setVistaActiva] = useState<VistaPrincipal>('boletin');
  const [seccionEditorInicial, setSeccionEditorInicial] =
    useState<SeccionEditor>('semanal');
  const [boletin, setBoletin] = useState<BoletinSemanal>(BOLETIN_40_SEED);
  const [listaBoletines, setListaBoletines] = useState<ResumenBoletin[]>([
    {
      id: BOLETIN_39_SEED.id,
      numero: BOLETIN_39_SEED.numero,
      fechaEmision: BOLETIN_39_SEED.fechaEmision,
      semanaTexto: BOLETIN_39_SEED.semanaTexto,
    },
    {
      id: BOLETIN_40_SEED.id,
      numero: BOLETIN_40_SEED.numero,
      fechaEmision: BOLETIN_40_SEED.fechaEmision,
      semanaTexto: BOLETIN_40_SEED.semanaTexto,
    },
    {
      id: BOLETIN_41_SEED.id,
      numero: BOLETIN_41_SEED.numero,
      fechaEmision: BOLETIN_41_SEED.fechaEmision,
      semanaTexto: BOLETIN_41_SEED.semanaTexto,
    },
  ]);

  const [sidebarColapsado, setSidebarColapsado] = useState<boolean>(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);
  const [copiadoHeader, setCopiadoHeader] = useState<boolean>(false);

  const [tokenSesion, setTokenSesion] = useState<string | null>(() => {
    try {
      return localStorage.getItem('notiprofes_token');
    } catch {
      return null;
    }
  });
  const [usuarioDirectivo, setUsuarioDirectivo] =
    useState<UsuarioDirectivo | null>(() => {
      try {
        const raw = localStorage.getItem('notiprofes_usuario');
        return raw ? (JSON.parse(raw) as UsuarioDirectivo) : null;
      } catch {
        return null;
      }
    });
  const [modalLoginAbierto, setModalLoginAbierto] = useState<boolean>(false);
  const [modalPreviewAbierto, setModalPreviewAbierto] = useState<boolean>(false);
  const [modalPublicacionAbierto, setModalPublicacionAbierto] = useState<boolean>(false);
  const [modalUsuariosAbierto, setModalUsuariosAbierto] = useState<boolean>(false);
  const [modalConfirmarLogoutAbierto, setModalConfirmarLogoutAbierto] = useState<boolean>(false);

  const [presencia, setPresencia] = useState<PresenciaActiva[]>([]);
  const [wsConectado, setWsConectado] = useState<boolean>(false);
  const [notificacionEditor, setNotificacionEditor] = useState<{
    id: string;
    usuario: string;
    seccion: string;
    descripcion: string;
    timestamp: string;
  } | null>(null);
  const ultimoHistorialIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const seccionActivaRef = useRef<string>('Boletín Oficial');
  const tokenRef = useRef<string | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const [alturaHeader, setAlturaHeader] = useState<number>(96);

  // Fecha actual del sistema formateada para el encabezado del menú lateral
  const fechaSistemaTexto = useMemo(() => {
    const hoy = new Date();
    const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const meses = [
      'ENERO',
      'FEBRERO',
      'MARZO',
      'ABRIL',
      'MAYO',
      'JUNIO',
      'JULIO',
      'AGOSTO',
      'SEPTIEMBRE',
      'OCTUBRE',
      'NOVIEMBRE',
      'DICIEMBRE',
    ];
    const nombreDia = diasSemana[hoy.getDay()];
    const diaMes = hoy.getDate();
    const nombreMes = meses[hoy.getMonth()];
    const anio = hoy.getFullYear();
    return `${nombreDia} ${diaMes} DE ${nombreMes} DE ${anio}`;
  }, []);

  useEffect(() => {
    tokenRef.current = tokenSesion;
  }, [tokenSesion]);

  useEffect(() => {
    if (!headerRef.current) return;
    const actualizar = () => {
      if (headerRef.current) {
        setAlturaHeader(headerRef.current.offsetHeight);
      }
    };
    actualizar();
    const observer = new ResizeObserver(actualizar);
    observer.observe(headerRef.current);
    window.addEventListener('resize', actualizar);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', actualizar);
    };
  }, [usuarioDirectivo, tokenSesion]);

  const cargarBoletinesServidor = useCallback(async (idEspecifico?: string) => {
    if (idEspecifico) {
      if (idEspecifico === BOLETIN_39_SEED.id) {
        setBoletin(BOLETIN_39_SEED);
      } else if (idEspecifico === BOLETIN_40_SEED.id) {
        setBoletin(BOLETIN_40_SEED);
      } else if (idEspecifico === BOLETIN_41_SEED.id) {
        setBoletin(BOLETIN_41_SEED);
      }
    }

    try {
      const [respLista, respBoletin] = await Promise.all([
        fetch('/api/public/boletines'),
        fetch(`/api/public/boletin/${idEspecifico || 'actual'}`),
      ]);

      if (respLista.ok) {
        const dataLista = await respLista.json();
        if (Array.isArray(dataLista.boletines)) {
          setListaBoletines(dataLista.boletines);
        }
      }

      if (respBoletin.ok) {
        const dataBoletin = await respBoletin.json();
        if (dataBoletin.boletin) {
          setBoletin(dataBoletin.boletin);
        }
      }
    } catch {
      // Mantiene datos semilla locales si el servidor está reiniciando
    }
  }, []);

  useEffect(() => {
    cargarBoletinesServidor();
  }, [cargarBoletinesServidor]);

  useEffect(() => {
    let cancelado = false;
    let timerReconexion: ReturnType<typeof setTimeout> | null = null;

    const conectarWs = () => {
      if (cancelado) return;
      const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocolo}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (cancelado) return;
        setWsConectado(true);
        socket.send(
          JSON.stringify({
            tipo: 'presencia:actualizar',
            token: tokenRef.current || undefined,
            seccionActiva: seccionActivaRef.current,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.evento === 'presencia:actualizada' && Array.isArray(msg.conectados)) {
            setPresencia(msg.conectados);
          } else if (msg.evento === 'boletin:actualizado' && msg.boletin) {
            setBoletin((prev) =>
              prev.id === msg.boletin.id ? msg.boletin : prev
            );
            if (msg.boletin.historialCambios && msg.boletin.historialCambios.length > 0) {
              const ultimo = msg.boletin.historialCambios[0];
              if (ultimo && ultimo.id !== ultimoHistorialIdRef.current) {
                ultimoHistorialIdRef.current = ultimo.id;
                setNotificacionEditor(ultimo);
                setTimeout(() => {
                  setNotificacionEditor((prev) => (prev?.id === ultimo.id ? null : prev));
                }, 6000);
              }
            }
          } else if (msg.evento === 'boletin:clonado' && msg.boletin) {
            setBoletin(msg.boletin);
            cargarBoletinesServidor(msg.boletin.id);
          }
        } catch {
          // Ignorar mensajes no JSON
        }
      };

      socket.onclose = () => {
        if (cancelado) return;
        setWsConectado(false);
        timerReconexion = setTimeout(conectarWs, 2500);
      };
    };

    conectarWs();

    return () => {
      cancelado = true;
      if (timerReconexion) clearTimeout(timerReconexion);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [cargarBoletinesServidor]);

  const ultimoMovimientoRef = useRef<number>(Date.now());
  const [estadoActividadLocal, setEstadoActividadLocal] = useState<'editando' | 'desatendido'>('editando');
  const estadoActividadLocalRef = useRef<'editando' | 'desatendido'>('editando');

  const emitirPresencia = useCallback(
    (
      nuevaSeccion: string,
      tokenOverride?: string | null,
      estadoOverride?: 'editando' | 'desatendido'
    ) => {
      seccionActivaRef.current = nuevaSeccion;
      const tk = tokenOverride !== undefined ? tokenOverride : tokenRef.current;
      const estado = estadoOverride !== undefined ? estadoOverride : estadoActividadLocalRef.current;
      estadoActividadLocalRef.current = estado;
      setEstadoActividadLocal(estado);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            tipo: 'presencia:actualizar',
            token: tk || undefined,
            seccionActiva: nuevaSeccion,
            estadoActividad: estado,
          })
        );
      }
    },
    []
  );

  const boletinRef = useRef(boletin);
  useEffect(() => {
    boletinRef.current = boletin;
  }, [boletin]);

  const [avisoInactividad, setAvisoInactividad] = useState<string | null>(null);

  const handleCerrarSesion = useCallback(async () => {
    const tk = tokenRef.current;
    if (tk) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}` },
        });
      } catch {
        // Ignorar error de red al cerrar sesión
      }
    }
    try {
      localStorage.removeItem('notiprofes_token');
      localStorage.removeItem('notiprofes_usuario');
    } catch {
      // Ignorar
    }
    setTokenSesion(null);
    setUsuarioDirectivo(null);
    emitirPresencia('Boletín Oficial', null);
  }, [emitirPresencia]);

  useEffect(() => {
    // Al interactuar con el sistema (mouse, teclado, click, scroll, touch), reactivar estado Activo
    const registrarActividad = () => {
      ultimoMovimientoRef.current = Date.now();
      if (estadoActividadLocalRef.current === 'desatendido') {
        estadoActividadLocalRef.current = 'editando';
        setEstadoActividadLocal('editando');
        emitirPresencia(seccionActivaRef.current, undefined, 'editando');
      }
    };

    window.addEventListener('keydown', registrarActividad, { passive: true });
    window.addEventListener('mousemove', registrarActividad, { passive: true });
    window.addEventListener('click', registrarActividad, { passive: true });
    window.addEventListener('scroll', registrarActividad, { passive: true });
    window.addEventListener('touchstart', registrarActividad, { passive: true });

    // Monitor de inactividad:
    // 1) 40s sin movimiento: presencia en tiempo real como 'desatendido'
    // 2) 15 minutos (900.000 ms) sin actividad: auto-logout con resguardo del borrador
    const TIEMPO_AUTO_LOGOUT_MS = 15 * 60 * 1000;

    const timerInactividad = setInterval(() => {
      const msInactivo = Date.now() - ultimoMovimientoRef.current;
      if (msInactivo > 40000 && estadoActividadLocalRef.current === 'editando') {
        estadoActividadLocalRef.current = 'desatendido';
        setEstadoActividadLocal('desatendido');
        emitirPresencia(seccionActivaRef.current, undefined, 'desatendido');
      }

      if (msInactivo >= TIEMPO_AUTO_LOGOUT_MS && tokenRef.current) {
        try {
          if (boletinRef.current) {
            localStorage.setItem(
              'notiprofes_borrador_seguridad',
              JSON.stringify(boletinRef.current)
            );
          }
        } catch {
          // Ignorar fallo de almacenamiento
        }

        handleCerrarSesion();
        setVistaActiva('boletin');
        setAvisoInactividad(
          'Sesión cerrada automáticamente tras 15 minutos de inactividad para proteger los datos institucionales. Tu borrador fue resguardado de forma segura.'
        );
      }
    }, 5000);

    return () => {
      window.removeEventListener('keydown', registrarActividad);
      window.removeEventListener('mousemove', registrarActividad);
      window.removeEventListener('click', registrarActividad);
      window.removeEventListener('scroll', registrarActividad);
      window.removeEventListener('touchstart', registrarActividad);
      clearInterval(timerInactividad);
    };
  }, [emitirPresencia, handleCerrarSesion]);

  const listaConectados = useMemo<PresenciaActiva[]>(() => {
    if (presencia.length > 0) {
      return presencia;
    }
    if (usuarioDirectivo) {
      return [
        {
          clienteId: 'local-dir',
          nombre: usuarioDirectivo.nombre,
          cargo: usuarioDirectivo.cargo,
          color: usuarioDirectivo.color || '#007DC5',
          seccionActiva: seccionActivaRef.current,
          conectadoDesde: new Date().toISOString(),
          estadoActividad: estadoActividadLocal,
        } as PresenciaActiva,
      ];
    }
    return [
      {
        clienteId: 'local-lector',
        nombre: 'Docente en Red',
        cargo: 'Consulta Pública',
        color: '#007DC5',
        seccionActiva: 'Boletín Oficial',
        conectadoDesde: new Date().toISOString(),
        estadoActividad: estadoActividadLocal,
      } as PresenciaActiva,
    ];
  }, [presencia, usuarioDirectivo, estadoActividadLocal]);

  const handleAutenticarExito = (token: string, usuario: UsuarioDirectivo) => {
    try {
      localStorage.setItem('notiprofes_token', token);
      localStorage.setItem('notiprofes_usuario', JSON.stringify(usuario));
    } catch {
      // Ignorar error de cuota local
    }
    setTokenSesion(token);
    setUsuarioDirectivo(usuario);
    setModalLoginAbierto(false);
    emitirPresencia(seccionActivaRef.current, token);
  };

  const handleEjecutarOperacion = async (op: OperacionBoletin): Promise<boolean> => {
    if (!tokenSesion) {
      setModalLoginAbierto(true);
      return false;
    }

    try {
      const resp = await fetch(`/api/boletines/${boletin.id}/operacion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({ operacion: op }),
      });

      if (resp.status === 401) {
        setTokenSesion(null);
        setUsuarioDirectivo(null);
        setModalLoginAbierto(true);
        return false;
      }

      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.boletin) {
        setBoletin(data.boletin);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleClonarSemana = async (datos: OpcionesClonarBoletin): Promise<boolean> => {
    if (!tokenSesion) {
      setModalLoginAbierto(true);
      return false;
    }

    try {
      const resp = await fetch(`/api/boletines/${boletin.id}/clonar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify(datos),
      });

      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.boletin) {
        setBoletin(data.boletin);
        await cargarBoletinesServidor(data.boletin.id);
      }
      return true;
    } catch {
      return false;
    }
  };

  const irASeccionEditor = (seccion: SeccionEditor, nombrePresencia: string) => {
    setSeccionEditorInicial(seccion);
    setVistaActiva('editor');
    setMenuMovilAbierto(false);
    emitirPresencia(nombrePresencia);
  };

  const handleCopiarUrlPublica = () => {
    const url = 'https://is.gd/notiprofes_vf';
    navigator.clipboard?.writeText(url);
    setCopiadoHeader(true);
    setTimeout(() => setCopiadoHeader(false), 2400);
  };

  const estadoCalendario = calcularEstadoCalendarioBoletin(boletin);

  // Pantalla de Login Obligatoria para el Panel de Coordinación (acceso protegido)
  if (!usuarioDirectivo || !tokenSesion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F223D] via-[#034EA2] to-[#007DC5] flex flex-col justify-between p-4 sm:p-6 select-none">
        <header className="flex items-center justify-between max-w-lg w-full mx-auto py-2 text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="font-display font-extrabold text-xs sm:text-sm tracking-wider uppercase text-sky-100">
              Panel Directivo Protegido
            </span>
          </div>
          <a
            href="/b"
            className="flex items-center gap-1.5 text-xs font-bold text-sky-100 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 transition-all cursor-pointer shadow-xs"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-300" />
            <span>Boletín Público (/b)</span>
          </a>
        </header>

        <main className="flex-1 flex items-center justify-center my-4">
          <ModalAccesoDirectivo
            abierto={true}
            esObligatorio={true}
            onCerrar={() => {}}
            onAutenticarExito={handleAutenticarExito}
            onConsultaPublica={() => {
              window.location.href = '/b';
            }}
          />
        </main>

        <footer className="text-center text-xs text-sky-200/80 max-w-md mx-auto space-y-1">
          <p className="font-semibold">
            Institución Educativa Villa Flora · Medellín, Colombia
          </p>
          <p className="text-[11px] text-sky-300/60">
            Canal de Coordinación Institucional · Inicie sesión para acceder al panel.
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div
      style={{ '--header-h': `${alturaHeader}px` } as React.CSSProperties}
      className="min-h-screen flex flex-col bg-[#F4F7FB] text-[#0F172A]"
    >
      {/* BARRA SUPERIOR UNIFICADA: ENCABEZADO DEL MENÚ LATERAL + NAVBAR PRINCIPAL (MISMA ALTURA Y MEDIDA) */}
      <header
        ref={headerRef}
        className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs flex items-stretch min-w-0"
      >
        {/* ENCABEZADO DEL MENÚ LATERAL: A la misma altura y medida del navbar, nunca se contrae ni se oculta */}
        <div className="w-56 sm:w-64 lg:w-68 shrink-0 px-3 sm:px-3.5 py-2 border-r border-slate-200/90 bg-gradient-to-b from-sky-50/85 via-sky-50/35 to-white flex flex-col justify-center select-none">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 text-[#034EA2] font-display font-extrabold text-[11px] sm:text-xs tracking-wider">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#007DC5] shrink-0" />
              <span>
                {estadoCalendario.numeroPeriodo}
                <sup className="text-[10px] font-extrabold lowercase ml-0.5">
                  {estadoCalendario.ordinalSup}
                </sup>{' '}
                PERIODO
              </span>
            </div>
          </div>

          <div className="mt-0.5 space-y-0.5">
            <div className="text-sm sm:text-base lg:text-lg font-display font-black text-[#034EA2] tracking-tight leading-tight">
              Edición Nº {boletin.numero}
            </div>
            <div className="text-[11px] sm:text-xs font-bold text-[#0F172A] leading-tight truncate">
              {estadoCalendario.rangoSemanaFormateado}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 leading-tight truncate">
              {estadoCalendario.textoSemanaDePeriodo}
            </div>
          </div>
        </div>

        {/* NAVBAR PRINCIPAL: Misma altura que el encabezado del menú lateral */}
        <div className="flex-1 flex items-center justify-between px-3 sm:px-6 py-2 gap-2 sm:gap-4 min-w-0">
          {/* Izquierda del Navbar: Botón móvil + Escudo Institucional */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMenuMovilAbierto(true);
                setSidebarColapsado(false);
              }}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-[#034EA2] hover:bg-slate-100 cursor-pointer transition-colors"
              aria-label="Abrir menú principal"
              title="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>

            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                setVistaActiva('boletin');
                emitirPresencia('Boletín Oficial');
              }}
              className="flex items-center group cursor-pointer py-0.5"
              title="Institución Educativa Villa Flora · Ir al inicio"
            >
              <img
                src="/public/assets/aistudio/Lab_2f0276da.png"
                alt="Escudo Institución Educativa Villa Flora"
                referrerPolicy="no-referrer"
                className="h-[64px] sm:h-[80px] md:h-[92px] w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105 drop-shadow-xs"
              />
            </a>
          </div>

          {/* Derecha del Navbar: Título NOTIPROFES DIGITAL y botones de acción */}
          <div className="flex flex-col items-end text-right shrink-0 ml-auto gap-1.5 min-w-0">
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                setVistaActiva('boletin');
                emitirPresencia('Boletín Oficial');
              }}
              className="cursor-pointer group flex flex-col items-end text-right"
            >
              <h1 className="text-lg sm:text-2xl md:text-3xl font-display font-black uppercase tracking-tight text-[#034EA2] group-hover:text-[#007DC5] transition-colors leading-tight">
                NOTIPROFES DIGITAL
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-slate-500 leading-tight mt-0.5 truncate max-w-[200px] sm:max-w-md md:max-w-xl">
                Canal Oficial Docente, Directivo y Administrativo · I.E. Villa Flora
              </p>
            </a>

            {/* Botones de acción en una sola fila protegida contra wrap */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-nowrap shrink-0 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => descargarPdfBoletinDirecto(boletin)}
                title="Descargar PDF oficial con colores completos"
                className="px-2 sm:px-2.5 py-1 rounded-lg border border-sky-300 bg-sky-50 text-[#034EA2] hover:bg-sky-100 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold shadow-2xs whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#007DC5]" />
                <span>Descargar PDF</span>
              </button>

              <button
                type="button"
                onClick={handleCopiarUrlPublica}
                className="px-2 sm:px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50 text-[#034EA2] hover:bg-sky-100 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold shadow-2xs whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 text-[#007DC5]" />
                <span>{copiadoHeader ? 'Enlace copiado' : 'Copiar enlace'}</span>
              </button>

              <button
                type="button"
                onClick={() => setModalPublicacionAbierto(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Publicar boletín</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CUERPO INFERIOR: MENÚ LATERAL (UNIDO AL ENCABEZADO CON 0PX DE SEPARACIÓN) + CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex min-w-0 relative">
        {/* BACKDROP PARA EL MENÚ EN PANTALLAS PEQUEÑAS (DEBAJO DEL ENCABEZADO) */}
        {menuMovilAbierto && (
          <div
            className="no-print fixed inset-x-0 bottom-0 top-[var(--header-h,104px)] z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
            onClick={() => setMenuMovilAbierto(false)}
            aria-hidden="true"
          />
        )}

        {/* MENÚ LATERAL: Unido directamente debajo de su encabezado; cuando se cierra solo se ven los íconos */}
        <aside
          aria-label="Menú de control lateral"
          className={`no-print fixed left-0 top-[var(--header-h,104px)] h-[calc(100vh-var(--header-h,104px))] z-40 lg:sticky lg:top-[var(--header-h,104px)] lg:h-[calc(100vh-var(--header-h,104px))] shrink-0 bg-white border-r border-slate-200/90 flex flex-col justify-between transition-all duration-200 select-none ${
            sidebarColapsado ? 'lg:w-18' : 'lg:w-68'
          } ${
            menuMovilAbierto
              ? 'translate-x-0 w-68 shadow-2xl'
              : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Cabecera del Drawer: Muestra la fecha actual del sistema y el botón para cerrar/expandir a íconos */}
          <div className="px-2.5 py-1.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between min-w-0 shrink-0">
            {!sidebarColapsado && (
              <div
                className="flex items-center gap-1.5 min-w-0 text-[#034EA2]"
                title={`Fecha del sistema: ${fechaSistemaTexto}`}
              >
                <Calendar className="w-3.5 h-3.5 text-[#007DC5] shrink-0" />
                <span className="text-[10px] sm:text-[10.5px] font-display font-extrabold uppercase tracking-wide truncate text-[#034EA2]">
                  {fechaSistemaTexto}
                </span>
              </div>
            )}
            <div
              className={`flex items-center gap-1 shrink-0 ${
                sidebarColapsado ? 'w-full justify-center' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setSidebarColapsado((prev) => !prev)}
                title={
                  sidebarColapsado
                    ? 'Expandir menú lateral'
                    : 'Cerrar menú a íconos'
                }
                className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-[#034EA2] hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                {sidebarColapsado ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMenuMovilAbierto(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
                aria-label="Cerrar menú"
                title="Cerrar menú"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de Módulos del Menú Lateral */}
          <div className="flex flex-col flex-1 overflow-y-auto py-1.5">
            <nav
              aria-label="Navegación principal"
              className="px-2 space-y-0.5 flex-1"
            >
              <button
                type="button"
                title="Boletín Oficial"
                onClick={() => {
                  setVistaActiva('boletin');
                  setMenuMovilAbierto(false);
                  emitirPresencia('Boletín Oficial');
                }}
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  vistaActiva === 'boletin'
                    ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                {!sidebarColapsado && (
                  <span className="truncate">Boletín Oficial</span>
                )}
              </button>

              <button
                type="button"
                title="Programación Semanal"
                onClick={() => irASeccionEditor('semanal', 'Programación Semanal')}
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  vistaActiva === 'editor' && seccionEditorInicial === 'semanal'
                    ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                {!sidebarColapsado && (
                  <span className="truncate">Programación Semanal</span>
                )}
              </button>

              <button
                type="button"
                title="Documentos y Horarios"
                onClick={() =>
                  irASeccionEditor('documentos', 'Documentos y Enlaces')
                }
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  vistaActiva === 'editor' && seccionEditorInicial === 'documentos'
                    ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                {!sidebarColapsado && (
                  <span className="truncate">Documentos y Horarios</span>
                )}
              </button>

              <button
                type="button"
                title="Notiprácticas"
                onClick={() =>
                  irASeccionEditor('practicas', 'Notiprácticas')
                }
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  vistaActiva === 'editor' && seccionEditorInicial === 'practicas'
                    ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]'
                }`}
              >
                <Award className="w-4 h-4 shrink-0 text-amber-500" />
                {!sidebarColapsado && (
                  <span className="truncate">Notiprácticas</span>
                )}
              </button>

              <button
                type="button"
                title="Proyección Calendario"
                onClick={() =>
                  irASeccionEditor('largo_plazo', 'Calendario a Largo Plazo')
                }
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  vistaActiva === 'editor' && seccionEditorInicial === 'largo_plazo'
                    ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]'
                }`}
              >
                <CalendarRange className="w-4 h-4 shrink-0" />
                {!sidebarColapsado && (
                  <span className="truncate">Proyección Calendario</span>
                )}
              </button>

              <button
                type="button"
                title="Horarios de Apoyo"
                onClick={() =>
                  irASeccionEditor('horarios', 'Horarios Personal de Apoyo')
                }
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  vistaActiva === 'editor' && seccionEditorInicial === 'horarios'
                    ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                {!sidebarColapsado && (
                  <span className="truncate">Horarios de Apoyo</span>
                )}
              </button>

              <button
                type="button"
                title="Registro Histórico de Cambios"
                onClick={() =>
                  irASeccionEditor('historial', 'Registro Histórico de Cambios')
                }
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  vistaActiva === 'editor' && seccionEditorInicial === 'historial'
                    ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]'
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                {!sidebarColapsado && (
                  <span className="truncate">Registro Histórico</span>
                )}
              </button>

              <button
                type="button"
                title="Administración de Usuarios Institucionales"
                onClick={() => setModalUsuariosAbierto(true)}
                className={`w-full flex items-center ${
                  sidebarColapsado ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-slate-700 hover:bg-slate-100 hover:text-[#034EA2]`}
              >
                <UserCheck className="w-4 h-4 text-[#007DC5] shrink-0" />
                {!sidebarColapsado && (
                  <span className="truncate">Administración de Usuarios</span>
                )}
              </button>

              <div className="pt-1.5 mt-1.5 border-t border-slate-200/80 space-y-0.5">
                <button
                  type="button"
                  onClick={() => setModalPreviewAbierto(true)}
                  title="Previsualizar HTML Oficial antes de publicar"
                  className={`w-full flex items-center ${
                    sidebarColapsado
                      ? 'justify-center px-2'
                      : 'justify-between gap-2 px-3'
                  } py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-emerald-50/80 hover:text-emerald-800 transition-colors cursor-pointer text-left`}
                >
                  <span className="flex items-center gap-3 truncate">
                    <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                    {!sidebarColapsado && <span>Previsualizar</span>}
                  </span>
                  {!sidebarColapsado && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                      HTML
                    </span>
                  )}
                </button>
              </div>
            </nav>
          </div>

          {/* Pie del Menú Lateral: Monitor de Usuarios Conectados y Sesión */}
          <div className="p-2 border-t border-slate-200/80 space-y-1.5 bg-slate-50/50 shrink-0">
            {/* Monitor de Usuarios Conectados */}
            <div className="bg-[#0F172A] text-white rounded-xl p-2 space-y-1.5 shadow-xs">
              <div
                className={`flex items-center ${
                  sidebarColapsado ? 'justify-center' : 'justify-between'
                } text-[11px] font-bold text-slate-300`}
              >
                {!sidebarColapsado && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#007DC5]" />
                    Conectados ({listaConectados.length})
                  </span>
                )}
                <span
                  title={wsConectado ? 'Conexión WebSocket activa' : 'Modo red local'}
                  className="flex items-center gap-1 text-[10px] text-slate-400"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      wsConectado ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {!sidebarColapsado && (wsConectado ? 'En vivo' : 'Local')}
                </span>
              </div>

              {/* Lista de Avatares */}
              <div
                className={`${
                  sidebarColapsado
                    ? 'flex flex-col items-center gap-2'
                    : 'space-y-1 max-h-28 overflow-y-auto pr-0.5'
                }`}
              >
                {listaConectados.map((u, idx) => {
                  const estaEditando = u.estadoActividad === 'editando';
                  const iniciales = obtenerIniciales(u.nombre);
                  const estadoTexto = estaEditando
                    ? 'Activo en el sistema'
                    : 'Desatendido / Inactivo';

                  if (sidebarColapsado) {
                    return (
                      <div
                        key={u.clienteId || idx}
                        title={`${u.nombre} (${u.cargo || 'Directivo'}) — ${estadoTexto}`}
                        className="relative group cursor-pointer"
                      >
                        <div
                          style={{ backgroundColor: u.color || '#007DC5' }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] shadow-xs ring-2 ${
                            estaEditando ? 'ring-emerald-400' : 'ring-amber-400'
                          }`}
                        >
                          {iniciales}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0F172A] ${
                            estaEditando
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-amber-400'
                          }`}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={u.clienteId || idx}
                      title={`${u.nombre} — ${estadoTexto}`}
                      className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-1.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            style={{ backgroundColor: u.color || '#007DC5' }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] ring-1.5 ${
                              estaEditando ? 'ring-emerald-400' : 'ring-amber-400'
                            }`}
                          >
                            {iniciales}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-slate-800 ${
                              estaEditando
                                ? 'bg-emerald-500 animate-pulse'
                                : 'bg-amber-400'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-white truncate leading-tight">
                            {u.nombre}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate leading-tight">
                            {u.cargo || 'Directivo'}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          estaEditando
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {estaEditando ? 'Activo' : 'Desatendido'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botón Cerrar Sesión Permanente con confirmación */}
            <button
              type="button"
              onClick={() => setModalConfirmarLogoutAbierto(true)}
              title={
                usuarioDirectivo
                  ? `Cerrar sesión de ${usuarioDirectivo.nombre}`
                  : 'Cerrar sesión actual'
              }
              className={`w-full bg-rose-50 hover:bg-rose-100 border border-rose-200/90 rounded-xl py-1.5 px-2.5 flex items-center ${
                sidebarColapsado ? 'justify-center' : 'justify-between gap-2'
              } transition-all cursor-pointer text-left text-rose-700 shadow-xs`}
            >
              {!sidebarColapsado && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-rose-800 truncate leading-tight">
                    Cerrar sesión
                  </div>
                  <div className="text-[10px] font-medium text-rose-600 truncate leading-tight">
                    {usuarioDirectivo ? usuarioDirectivo.nombre : 'Sesión activa'}
                  </div>
                </div>
              )}
              <div className="p-1 rounded-lg bg-rose-100/80 text-rose-700 shrink-0">
                <LogOut className="w-3.5 h-3.5" />
              </div>
            </button>

            {!sidebarColapsado && (
              <div className="text-[10px] text-slate-400 px-1 leading-tight text-center">
                © 2026 Desarrollado y diseñado por
                <br />
                <strong className="font-bold text-slate-600">Reakta Group</strong>
              </div>
            )}
          </div>
        </aside>

        {/* Área de Trabajo Principal */}
        <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 py-6 min-w-0 scroll-smooth">
          {vistaActiva === 'boletin' && (
            <VistaBoletinOficial
              boletin={boletin}
              listaBoletines={listaBoletines}
              onSeleccionarBoletin={(id) => cargarBoletinesServidor(id)}
              onIrAEditor={() => {
                setSeccionEditorInicial('semanal');
                setVistaActiva('editor');
                emitirPresencia('Programación Semanal');
                if (!usuarioDirectivo) {
                  setModalLoginAbierto(true);
                }
              }}
              esDirectivoAutenticado={Boolean(usuarioDirectivo)}
            />
          )}


          {vistaActiva === 'editor' && (
            <PanelEditorColaborativo
              key={seccionEditorInicial}
              boletin={boletin}
              usuarioActual={usuarioDirectivo}
              tokenSesion={tokenSesion}
              presencia={presencia}
              wsConectado={wsConectado}
              notificacionEditor={notificacionEditor}
              onSolicitarLogin={() => setModalLoginAbierto(true)}
              onEjecutarOperacion={handleEjecutarOperacion}
              onClonarSemana={handleClonarSemana}
              onCambiarSeccionActiva={(sec) => emitirPresencia(sec)}
              seccionInicial={seccionEditorInicial}
            />
          )}

          {vistaActiva === 'nas' && <GuiaDespliegueNas boletin={boletin} />}
        </main>
      </div>

      <ModalAccesoDirectivo
        abierto={modalLoginAbierto}
        onCerrar={() => setModalLoginAbierto(false)}
        onAutenticarExito={handleAutenticarExito}
        onConsultaPublica={() => {
          setModalLoginAbierto(false);
          setVistaActiva('boletin');
          emitirPresencia('Boletín Oficial');
        }}
      />

      <ModalPrevisualizarBoletin
        abierto={modalPreviewAbierto}
        onCerrar={() => setModalPreviewAbierto(false)}
        boletin={boletin}
      />

      <ModalPublicacionNube
        abierto={modalPublicacionAbierto}
        onCerrar={() => setModalPublicacionAbierto(false)}
        boletin={boletin}
        usuarioActual={usuarioDirectivo}
        tokenSesion={tokenSesion}
        onSolicitarLogin={() => {
          setModalPublicacionAbierto(false);
          setModalLoginAbierto(true);
        }}
        onAbrirPrevisualizacion={() => setModalPreviewAbierto(true)}
        onGuardarMetadataDrivePdf={async (drivePdfInfo) => {
          return handleEjecutarOperacion({
            tipo: 'actualizar_drive_pdf',
            drivePdfInfo,
            autor: usuarioDirectivo?.nombre || 'Dirección Institucional',
          });
        }}
        onSincronizarPublicacion={async () => {
          if (usuarioDirectivo && tokenSesion) {
            return handleEjecutarOperacion({
              tipo: 'actualizar_encabezado',
              datos: { estado: 'publicado' },
              autor: usuarioDirectivo.nombre,
            });
          }
          await cargarBoletinesServidor(boletin.id);
          return true;
        }}
      />

      <ModalAdministracionUsuarios
        abierto={modalUsuariosAbierto}
        onCerrar={() => setModalUsuariosAbierto(false)}
        usuarioActual={usuarioDirectivo}
        tokenSesion={tokenSesion}
        onSolicitarLogin={() => {
          setModalUsuariosAbierto(false);
          setModalLoginAbierto(true);
        }}
      />

      <ModalConfirmarLogout
        abierto={modalConfirmarLogoutAbierto}
        usuarioActual={usuarioDirectivo}
        onCerrar={() => setModalConfirmarLogoutAbierto(false)}
        onConfirmarLogout={handleCerrarSesion}
      />

      {/* TOAST DE NOTIFICACIÓN DE EDICIÓN EN TIEMPO REAL (ESQUINA INFERIOR DERECHA) */}
      <ToastNotificacionEditor
        notificacion={notificacionEditor}
        onCerrar={() => setNotificacionEditor(null)}
      />

      {/* AVISO DE CIERRE DE SESIÓN POR INACTIVIDAD (15 MINUTOS) */}
      {avisoInactividad && (
        <aside
          role="alert"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)] bg-slate-900/95 backdrop-blur-md text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-amber-400/40 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-0.5">
              Seguridad Institucional · Cierre por Inactividad
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {avisoInactividad}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAvisoInactividad(null);
                  setModalLoginAbierto(true);
                }}
                className="text-xs font-bold px-3 py-1 bg-[#007DC5] hover:bg-[#034EA2] text-white rounded-lg transition-colors cursor-pointer"
              >
                Reanudar Sesión
              </button>
              <button
                type="button"
                onClick={() => setAvisoInactividad(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAvisoInactividad(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0 cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}
    </div>
  );
}
