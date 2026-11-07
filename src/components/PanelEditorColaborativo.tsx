import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Bell,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CopyPlus,
  FilePlus,
  FileSpreadsheet,
  FileText,
  History,
  LayoutGrid,
  Link2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  BloqueCalendarioOficial,
  BoletinSemanal,
  ConfiguracionCalendarioAnual,
  DocumentoInstitucional,
  HorarioPersonalApoyo,
  OperacionBoletin,
  PresenciaActiva,
  UsuarioDirectivo,
} from '../types/notiprofes';
import { validarActividadInput } from '../utils/boletinLogic';
import {
  calcularFechaViernesSiguienteSemana,
  formatearFechaIsoATextoLargo,
  obtenerCalendarioOficialBoletin,
} from '../utils/calendarioEscolar2026';
import { DropdownPersonalizado } from './DropdownPersonalizado';

interface PanelEditorColaborativoProps {
  boletin: BoletinSemanal;
  usuarioActual: UsuarioDirectivo | null;
  tokenSesion?: string | null;
  presencia: PresenciaActiva[];
  wsConectado: boolean;
  notificacionEditor?: {
    id: string;
    usuario: string;
    seccion: string;
    descripcion: string;
    timestamp: string;
  } | null;
  onSolicitarLogin: () => void;
  onEjecutarOperacion: (op: OperacionBoletin) => Promise<boolean>;
  onClonarSemana: (datos: {
    semanaTexto: string;
    fechaEmision: string;
    descripcionPeriodo: string;
    conservarActividades: boolean;
  }) => Promise<boolean>;
  onCambiarSeccionActiva: (seccion: string) => void;
  seccionInicial?: SeccionEditor;
}

export type SeccionEditor =
  | 'semanal'
  | 'documentos'
  | 'largo_plazo'
  | 'practicas'
  | 'horarios'
  | 'historial'
  | 'clonar';

function obtenerIconoSeccion(seccion: string) {
  const norm = seccion
    ? seccion
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : '';

  if (norm.includes('semanal') || norm.includes('programacion') || norm.includes('actividades')) {
    return <Calendar className="w-3.5 h-3.5 shrink-0" />;
  }
  if (norm.includes('documento') || norm.includes('enlace') || norm.includes('resolucion') || norm.includes('horarios de la semana')) {
    return <FileText className="w-3.5 h-3.5 shrink-0" />;
  }
  if (norm.includes('practica') || norm.includes('notipractica') || norm.includes('reconocimiento') || norm.includes('felicitaciones')) {
    return <Award className="w-3.5 h-3.5 shrink-0 text-amber-500" />;
  }
  if (norm.includes('largo') || norm.includes('calendario') || norm.includes('decreto')) {
    return <CalendarDays className="w-3.5 h-3.5 shrink-0" />;
  }
  if (norm.includes('horarios') || norm.includes('personal de apoyo')) {
    return <Clock className="w-3.5 h-3.5 shrink-0" />;
  }
  if (norm.includes('historial') || norm.includes('cambio')) {
    return <History className="w-3.5 h-3.5 shrink-0" />;
  }
  if (norm.includes('nueva') || norm.includes('clonar')) {
    return <CopyPlus className="w-3.5 h-3.5 shrink-0" />;
  }
  return <LayoutGrid className="w-3.5 h-3.5 shrink-0" />;
}

export const PanelEditorColaborativo: React.FC<PanelEditorColaborativoProps> = ({
  boletin,
  usuarioActual,
  tokenSesion,
  presencia,
  wsConectado,
  notificacionEditor,
  onSolicitarLogin,
  onEjecutarOperacion,
  onClonarSemana,
  onCambiarSeccionActiva,
  seccionInicial = 'semanal',
}) => {
  const [seccion, setSeccion] = useState<SeccionEditor>(seccionInicial);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(
    boletin.dias[1]?.id || boletin.dias[0]?.id || 'dia-martes'
  );
  const [tituloAct, setTituloAct] = useState('');
  const [responsableAct, setResponsableAct] = useState('');
  const [horaAct, setHoraAct] = useState('');
  const [lugarAct, setLugarAct] = useState('');

  // Estado para la edición y reprogramación de actividades
  const [actividadEnEdicion, setActividadEnEdicion] = useState<{
    diaId: string;
    actividad: BoletinSemanal['dias'][0]['actividades'][0];
  } | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editResponsable, setEditResponsable] = useState('');
  const [editHora, setEditHora] = useState('');
  const [editLugar, setEditLugar] = useState('');
  const [editEsReprogramada, setEditEsReprogramada] = useState(false);
  const [editNotaReprogramacion, setEditNotaReprogramacion] = useState('');

  const [catDoc, setCatDoc] = useState('');
  const [tituloDoc, setTituloDoc] = useState('');
  const [urlDoc, setUrlDoc] = useState(
    '/public/assets/aistudio/_NOTIPROFES_N__39_2026_.docx_a4a84a2d.pdf'
  );
  const [tipoDoc, setTipoDoc] = useState<'docx' | 'xlsx' | 'pdf' | 'link'>('docx');

  const [fechaEventoLP, setFechaEventoLP] = useState('');
  const [descEventoLP, setDescEventoLP] = useState('');
  const [catEventoLP, setCatEventoLP] = useState<
    'finalizacion' | 'proxima_actividad'
  >('proxima_actividad');
  const [destacadoLP, setDestacadoLP] = useState(false);

  const [docenteFel, setDocenteFel] = useState('');
  const [motivoFel, setMotivoFel] = useState('');
  const [nuevoAviso, setNuevoAviso] = useState('');

  const [gradoSusp, setGradoSusp] = useState('');
  const [estudianteSusp, setEstudianteSusp] = useState('');
  const [fechaSusp, setFechaSusp] = useState('');

  const [horarioEditando, setHorarioEditando] = useState<HorarioPersonalApoyo | null>(
    null
  );

  const [nuevaSemanaTexto, setNuevaSemanaTexto] = useState(
    'Semana del 9 de noviembre al 13 de noviembre de 2026.'
  );
  const [nuevaFechaEmision, setNuevaFechaEmision] = useState(() =>
    calcularFechaViernesSiguienteSemana(boletin.dias)
  );
  const [nuevaDescPeriodo, setNuevaDescPeriodo] = useState(
    'Programación de la UNDÉCIMA semana del TERCER periodo del año lectivo.'
  );
  const [conservarActividades, setConservarActividades] = useState(false);

  const [polizaTitulo, setPolizaTitulo] = useState(boletin.polizaEscolarDoc?.titulo || '');
  const [polizaUrl, setPolizaUrl] = useState(boletin.polizaEscolarDoc?.url || '');

  const [frasePedagogicaEdit, setFrasePedagogicaEdit] = useState(boletin.frasePedagogica || '');
  const [autorFraseEdit, setAutorFraseEdit] = useState(boletin.autorFrase || '');

  const [diasColapsados, setDiasColapsados] = useState<Record<string, boolean>>({});
  const [filtroDiaEditor, setFiltroDiaEditor] = useState<string>('todos');

  // Estados para importación de Decreto de Calendario Académico (2027+)
  const calendarioVigente = obtenerCalendarioOficialBoletin(boletin);
  const [anioDecreto, setAnioDecreto] = useState<number>(2027);
  const [archivoDecretoNombre, setArchivoDecretoNombre] = useState<string>('');
  const [archivoDecretoBase64, setArchivoDecretoBase64] = useState<string>('');
  const [archivoDecretoMime, setArchivoDecretoMime] = useState<string>('application/pdf');
  const [textoDecretoOpcional, setTextoDecretoOpcional] = useState<string>('');
  const [analizandoDecreto, setAnalizandoDecreto] = useState<boolean>(false);
  const [borradorCalendarioAnual, setBorradorCalendarioAnual] =
    useState<ConfiguracionCalendarioAnual | null>(null);
  const [origenBorrador, setOrigenBorrador] = useState<'ia_gemini' | 'algoritmico' | null>(
    null
  );

  const notificarGuardado = (texto: string) => {
    setMensajeEstado(texto);
    setTimeout(() => setMensajeEstado(null), 3200);
  };

  const cambiarTab = (nueva: SeccionEditor, etiqueta: string) => {
    setSeccion(nueva);
    setErrorValidacion(null);
    onCambiarSeccionActiva(etiqueta);
  };

  const handleAgregarActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }

    const validacion = validarActividadInput({
      titulo: tituloAct,
      responsable: responsableAct,
      hora: horaAct,
      lugar: lugarAct,
    });

    if (!validacion.valido) {
      setErrorValidacion(validacion.error || 'Datos incompletos');
      return;
    }

    const exito = await onEjecutarOperacion({
      tipo: 'agregar_actividad',
      diaId: diaSeleccionado,
      actividad: {
        id: `act-${Date.now()}`,
        diaId: diaSeleccionado,
        titulo: tituloAct.trim(),
        responsable: responsableAct.trim(),
        hora: horaAct.trim(),
        lugar: lugarAct.trim(),
        reprogramada: false,
      },
      autor: usuarioActual.nombre,
    });

    if (exito) {
      setTituloAct('');
      setResponsableAct('');
      setHoraAct('');
      setLugarAct('');
      notificarGuardado('Actividad programada y publicada en el boletín.');
    }
  };

  const abrirEdicionActividad = (
    diaId: string,
    act: BoletinSemanal['dias'][0]['actividades'][0]
  ) => {
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    setActividadEnEdicion({ diaId, actividad: act });
    setEditTitulo(act.titulo);
    setEditResponsable(act.responsable);
    setEditHora(act.hora);
    setEditLugar(act.lugar);
    setEditEsReprogramada(Boolean(act.reprogramada));
    setEditNotaReprogramacion(act.notaReprogramacion || 'Se reprograma para el martes');
  };

  const handleGuardarEdicionActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actividadEnEdicion || !usuarioActual) return;

    const validacion = validarActividadInput({
      titulo: editTitulo,
      responsable: editResponsable,
      hora: editHora,
      lugar: editLugar,
    });

    if (!validacion.valido) {
      setErrorValidacion(validacion.error || 'Datos incompletos');
      return;
    }

    const exito = await onEjecutarOperacion({
      tipo: 'actualizar_actividad',
      diaId: actividadEnEdicion.diaId,
      actividad: {
        ...actividadEnEdicion.actividad,
        titulo: editTitulo.trim(),
        responsable: editResponsable.trim(),
        hora: editHora.trim(),
        lugar: editLugar.trim(),
        reprogramada: editEsReprogramada,
        notaReprogramacion: editEsReprogramada ? editNotaReprogramacion.trim() : undefined,
      },
      autor: usuarioActual.nombre,
    });

    if (exito) {
      notificarGuardado('Actividad actualizada y resaltada con éxito.');
      setActividadEnEdicion(null);
    }
  };

  const handleEliminarActividad = async (diaId: string, actividadId: string) => {
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    const exito = await onEjecutarOperacion({
      tipo: 'eliminar_actividad',
      diaId,
      actividadId,
      autor: usuarioActual.nombre,
    });
    if (exito) {
      notificarGuardado('Actividad eliminada del boletín.');
    }
  };

  const handleAgregarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!catDoc.trim() || !tituloDoc.trim() || !urlDoc.trim()) {
      setErrorValidacion('Complete la categoría, el nombre del documento y el enlace.');
      return;
    }

    const nuevoDoc: DocumentoInstitucional = {
      id: `doc-${Date.now()}`,
      categoria: catDoc.trim(),
      titulo: tituloDoc.trim(),
      nombreArchivo: tituloDoc.trim(),
      url: urlDoc.trim(),
      tipo: tipoDoc,
    };

    const exito = await onEjecutarOperacion({
      tipo: 'agregar_documento',
      documento: nuevoDoc,
      autor: usuarioActual.nombre,
    });

    if (exito) {
      setCatDoc('');
      setTituloDoc('');
      notificarGuardado('Documento institucional vinculado al boletín.');
    }
  };

  const handleActualizarPoliza = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!polizaTitulo.trim() || !polizaUrl.trim()) {
      setErrorValidacion('Indique el título y la URL de la Póliza escolar oficial.');
      return;
    }

    const exito = await onEjecutarOperacion({
      tipo: 'actualizar_poliza',
      poliza: {
        titulo: polizaTitulo.trim(),
        url: polizaUrl.trim(),
      },
      autor: usuarioActual.nombre,
    });

    if (exito) {
      notificarGuardado('Póliza escolar oficial actualizada con éxito.');
    }
  };

  const handleActualizarReflexion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!frasePedagogicaEdit.trim()) {
      setErrorValidacion('La reflexión pedagógica no puede estar vacía.');
      return;
    }

    const exito = await onEjecutarOperacion({
      tipo: 'actualizar_encabezado',
      datos: {
        frasePedagogica: frasePedagogicaEdit.trim(),
        autorFrase: autorFraseEdit.trim(),
      },
      autor: usuarioActual.nombre,
    });

    if (exito) {
      notificarGuardado('Reflexión pedagógica actualizada con éxito.');
    }
  };

  const handleAgregarEventoLP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!fechaEventoLP.trim() || !descEventoLP.trim()) {
      setErrorValidacion('Ingrese la fecha/rango y la descripción de la actividad a largo plazo.');
      return;
    }

    const exito = await onEjecutarOperacion({
      tipo: 'agregar_evento_largo_plazo',
      evento: {
        id: `cal-${Date.now()}`,
        fechaTexto: fechaEventoLP.trim(),
        descripcion: descEventoLP.trim(),
        categoria: catEventoLP,
        destacado: destacadoLP,
      },
      autor: usuarioActual.nombre,
    });

    if (exito) {
      setFechaEventoLP('');
      setDescEventoLP('');
      setDestacadoLP(false);
      notificarGuardado('Actividad a largo plazo incorporada al calendario.');
    }
  };

  const handleSeleccionarArchivoDecreto = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorValidacion(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorValidacion('El archivo PDF no debe superar los 10 MB.');
      return;
    }

    setArchivoDecretoNombre(file.name);
    setArchivoDecretoMime(file.type || 'application/pdf');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setArchivoDecretoBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalizarDecretoConIA = async () => {
    setErrorValidacion(null);
    if (!usuarioActual || !tokenSesion) {
      onSolicitarLogin();
      return;
    }
    if (!archivoDecretoBase64 && textoDecretoOpcional.trim().length < 20) {
      setErrorValidacion(
        'Seleccione el archivo PDF de la Resolución del Calendario Académico o pegue el texto de los artículos antes de analizar.'
      );
      return;
    }

    setAnalizandoDecreto(true);
    try {
      const resp = await fetch('/api/calendario/analizar-decreto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          pdfBase64: archivoDecretoBase64 || undefined,
          mimeType: archivoDecretoMime,
          textoResolucion: textoDecretoOpcional || undefined,
          anioObjetivo: anioDecreto,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorValidacion(data.error || 'Error al analizar el decreto con IA.');
        return;
      }
      setBorradorCalendarioAnual(data.calendario);
      setOrigenBorrador('ia_gemini');
      notificarGuardado(
        `Decreto analizado con éxito. Revise la vista previa del año ${data.calendario.anio} antes de activarlo.`
      );
    } catch {
      setErrorValidacion('Error de conexión con el servidor al procesar el decreto.');
    } finally {
      setAnalizandoDecreto(false);
    }
  };

  const handleGenerarPlantillaAnual = async () => {
    setErrorValidacion(null);
    if (!usuarioActual || !tokenSesion) {
      onSolicitarLogin();
      return;
    }
    setAnalizandoDecreto(true);
    try {
      const resp = await fetch('/api/calendario/generar-plantilla-anual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({ anio: anioDecreto }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorValidacion(data.error || 'No fue posible generar la plantilla anual.');
        return;
      }
      setBorradorCalendarioAnual(data.calendario);
      setOrigenBorrador('algoritmico');
      notificarGuardado(
        `Plantilla base y 18 festivos oficiales de Colombia generados para el año ${data.calendario.anio}.`
      );
    } catch {
      setErrorValidacion('Error de red al solicitar la plantilla anual.');
    } finally {
      setAnalizandoDecreto(false);
    }
  };

  const handleActualizarBloqueBorrador = (
    seccionBloque:
      | 'semanasLectivas'
      | 'semanasDesarrollo'
      | 'vacacionesDocentes'
      | 'recesoEstudiantil',
    idBloque: string,
    campo: 'desde' | 'hasta' | 'semanas',
    valor: string | number
  ) => {
    if (!borradorCalendarioAnual) return;
    const listaActualizada: BloqueCalendarioOficial[] = borradorCalendarioAnual[
      seccionBloque
    ].map((b) => {
      if (b.id !== idBloque) return b;
      if (campo === 'semanas') {
        const sem = Math.max(1, Number(valor) || 1);
        return { ...b, semanas: sem, duracionTexto: `${sem} semana(s)` };
      }
      if (campo === 'desde') {
        const iso = String(valor);
        return {
          ...b,
          desde: iso,
          desdeTexto: formatearFechaIsoATextoLargo(iso),
        };
      }
      const iso = String(valor);
      return {
        ...b,
        hasta: iso,
        hastaTexto: formatearFechaIsoATextoLargo(iso),
      };
    });

    setBorradorCalendarioAnual({
      ...borradorCalendarioAnual,
      [seccionBloque]: listaActualizada,
    });
  };

  const handleAprobarCalendarioAnual = async () => {
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!borradorCalendarioAnual) return;

    const ok = await onEjecutarOperacion({
      tipo: 'actualizar_calendario_anual',
      calendario: borradorCalendarioAnual,
      autor: usuarioActual.nombre,
    });
    if (ok) {
      setBorradorCalendarioAnual(null);
      setArchivoDecretoNombre('');
      setArchivoDecretoBase64('');
      setTextoDecretoOpcional('');
      notificarGuardado(
        `¡Calendario Académico Oficial ${borradorCalendarioAnual.anio} activado y publicado en el boletín!`
      );
    }
  };

  const handleAgregarFelicitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!docenteFel.trim() || !motivoFel.trim()) {
      setErrorValidacion('Indique el nombre del docente y el motivo de reconocimiento.');
      return;
    }

    const exito = await onEjecutarOperacion({
      tipo: 'agregar_felicitacion',
      felicitacion: {
        id: `fel-${Date.now()}`,
        docentes: docenteFel.trim(),
        motivo: motivoFel.trim(),
      },
      autor: usuarioActual.nombre,
    });

    if (exito) {
      setDocenteFel('');
      setMotivoFel('');
      notificarGuardado('Felicitación docente publicada en Noti-Prácticas.');
    }
  };

  const handleAgregarAvisoPractica = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!nuevoAviso.trim()) {
      setErrorValidacion('Escriba el texto del aviso o directriz institucional.');
      return;
    }
    const exito = await onEjecutarOperacion({
      tipo: 'agregar_aviso_practica',
      aviso: nuevoAviso.trim(),
      autor: usuarioActual.nombre,
    });
    if (exito) {
      setNuevoAviso('');
      notificarGuardado('Directriz agregada a Noti-Prácticas.');
    }
  };

  const handleAgregarSuspension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    if (!gradoSusp.trim() || !estudianteSusp.trim() || !fechaSusp.trim()) {
      setErrorValidacion('Complete grado, nombre del estudiante y fecha de suspensión.');
      return;
    }
    const exito = await onEjecutarOperacion({
      tipo: 'agregar_suspension',
      suspension: {
        id: `susp-${Date.now()}`,
        grado: gradoSusp.trim(),
        estudiante: estudianteSusp.trim(),
        fechaSuspension: fechaSusp.trim(),
      },
      autor: usuarioActual.nombre,
    });
    if (exito) {
      setGradoSusp('');
      setEstudianteSusp('');
      setFechaSusp('');
      notificarGuardado('Registro de suspensión actualizado.');
    }
  };

  const handleGuardarHorarioApoyo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioActual || !horarioEditando) return;
    const exito = await onEjecutarOperacion({
      tipo: 'actualizar_horario_apoyo',
      horario: horarioEditando,
      autor: usuarioActual.nombre,
    });
    if (exito) {
      setHorarioEditando(null);
      notificarGuardado('Horario de personal de apoyo actualizado.');
    }
  };

  const handleClonar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioActual) {
      onSolicitarLogin();
      return;
    }
    const exito = await onClonarSemana({
      semanaTexto: nuevaSemanaTexto,
      fechaEmision: nuevaFechaEmision,
      descripcionPeriodo: nuevaDescPeriodo,
      conservarActividades,
    });
    if (exito) {
      notificarGuardado(
        `Boletín N° ${boletin.numero + 1} creado y activado como edición pública actual.`
      );
      cambiarTab('semanal', 'Programación Semanal');
    }
  };

  return (
    <div className="space-y-6">
      {notificacionEditor && (
        <div
          role="region"
          aria-label="Notificación de cambios en tiempo real"
          className="bg-sky-900 border-2 border-sky-400 text-white rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/30 border border-sky-300/40 text-sky-200 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-bold text-sky-200 tracking-wide uppercase">
                Actualización en vivo detectada ({notificacionEditor.timestamp})
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">
                <strong>{notificacionEditor.usuario}</strong> guardó cambios en la sección{' '}
                <span className="underline decoration-sky-300">{notificacionEditor.seccion}</span>:{' '}
                <span className="font-normal text-sky-100">{notificacionEditor.descripcion}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => cambiarTab('historial', 'Registro Histórico de Cambios')}
            className="px-3.5 py-1.5 text-xs font-bold bg-[#ED145B] hover:bg-[#d41050] text-white rounded-lg shadow-xs whitespace-nowrap shrink-0 transition-colors"
          >
            Ver en Historial
          </button>
        </div>
      )}

      {/* Encabezado Ejecutivo de Colaboración Multi-Equipo */}
      <section
        aria-label="Estado de edición colaborativa en tiempo real"
        className="bg-gradient-to-r from-[#022c5e] via-[#034EA2] to-[#007DC5] text-white rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-[#034EA2] shadow-xs"
      >
        <div className="space-y-1">
          <div className="text-xs text-sky-200 font-mono-tabular font-medium">
            <span>Edición activa: N° {boletin.numero}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-white">
            Mesa de Edición Colaborativa — Equipo Directivo y Administrativo
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3 ml-auto">
          <div className="flex items-center gap-2 text-xs text-sky-100 bg-[#011c3b]/75 border border-white/20 rounded-lg px-3.5 py-2">
            <Users className="w-4 h-4 text-sky-300 shrink-0" />
            <span>
              <strong className="text-white">{presencia.length}</strong> equipo(s) en línea:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 ml-1">
              {presencia.slice(0, 4).map((p) => (
                <span
                  key={p.clienteId}
                  title={`${p.nombre} (${p.cargo}) — Editando: ${p.seccionActiva}`}
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/25 rounded-md px-2 py-0.5 text-xs font-semibold text-white transition-colors cursor-help"
                >
                  <span>{p.nombre.split(' ')[0]}</span>
                  <span className="text-sky-300 flex items-center shrink-0" title={`Sección: ${p.seccionActiva}`}>
                    {obtenerIconoSeccion(p.seccionActiva)}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => cambiarTab('clonar', 'Nueva Semana')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-[#ED145B] hover:bg-[#d41050] rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Crear y activar la edición del boletín de la siguiente semana"
          >
            <CalendarPlus className="w-4 h-4 shrink-0" />
            <span>Programar Siguiente Semana (N° {boletin.numero + 1})</span>
          </button>

          {!usuarioActual && (
            <button
              type="button"
              onClick={onSolicitarLogin}
              className="px-4 py-2 text-xs font-bold bg-white text-[#034EA2] rounded-lg hover:bg-sky-50 transition-colors whitespace-nowrap shrink-0"
            >
              Autenticar Perfil
            </button>
          )}
        </div>
      </section>

      {!usuarioActual && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Está explorando la mesa de edición en modo lectura. Para agregar o modificar
              actividades desde su equipo, inicie sesión con su perfil asignado.
            </span>
          </div>
          <button
            type="button"
            onClick={onSolicitarLogin}
            className="px-3.5 py-1.5 font-semibold bg-[#034EA2] text-white rounded-lg hover:bg-[#007DC5] whitespace-nowrap shrink-0"
          >
            Iniciar Sesión Ahora
          </button>
        </div>
      )}

      {mensajeEstado && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-semibold text-emerald-900 flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-700" />
          {mensajeEstado}
        </div>
      )}

      {errorValidacion && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-900"
        >
          {errorValidacion}
        </div>
      )}



      {/* SECCIÓN 1: PROGRAMACIÓN SEMANAL */}
      {seccion === 'semanal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleAgregarActividad}
              className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-4"
            >
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-700" />
                  Registrar Actividad o Imprevisto Semanal
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Se reflejará al instante en todos los equipos conectados y en el HTML público.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Día de la semana:
                </label>
                <DropdownPersonalizado
                  modo="simple"
                  anchoCompleto
                  ariaLabel="Día de la semana"
                  icono={<Clock className="w-4 h-4" />}
                  etiquetaBoton={
                    boletin.dias.find((d) => d.id === diaSeleccionado)
                      ? `${boletin.dias.find((d) => d.id === diaSeleccionado)?.fechaTexto}${
                          boletin.dias.find((d) => d.id === diaSeleccionado)?.esFestivo
                            ? ' (Festivo)'
                            : ''
                        }`
                      : 'Seleccionar día'
                  }
                  valorSeleccionado={diaSeleccionado}
                  onChange={(nuevoDia) => setDiaSeleccionado(nuevoDia)}
                  opciones={boletin.dias.map((d) => ({
                    valor: d.id,
                    etiqueta: `${d.fechaTexto}${d.esFestivo ? ' (Festivo)' : ''}`,
                  }))}
                />
              </div>

              <div>
                <label
                  htmlFor="input-titulo-actividad"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Actividad a desarrollar:
                </label>
                <textarea
                  id="input-titulo-actividad"
                  rows={2}
                  value={tituloAct}
                  onChange={(e) => setTituloAct(e.target.value)}
                  placeholder="Ej: Reunión extraordinaria de área de Matemáticas o Simulacro..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="input-responsable-actividad"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Responsable(s):
                  </label>
                  <input
                    id="input-responsable-actividad"
                    type="text"
                    value={responsableAct}
                    onChange={(e) => setResponsableAct(e.target.value)}
                    placeholder="Ej: Coordinación Académica"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-hora-actividad"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Hora:
                  </label>
                  <input
                    id="input-hora-actividad"
                    type="text"
                    value={horaAct}
                    onChange={(e) => setHoraAct(e.target.value)}
                    placeholder="Ej: 8:00 a.m. a 10:00 a.m."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-mono-tabular text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-lugar-actividad"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Lugar:
                </label>
                <input
                  id="input-lugar-actividad"
                  type="text"
                  value={lugarAct}
                  onChange={(e) => setLugarAct(e.target.value)}
                  placeholder="Ej: Auditorio / Biblioteca / Rectoría"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg transition-colors mt-3"
              >
                Guardar y Publicar Actividad en el Boletín
              </button>
            </form>

            <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#ED145B]" />
                  Reflexión Pedagógica Semanal
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cambie la cita o mensaje inspirador que aparece destacado en el boletín.
                </p>
              </div>

              <form onSubmit={handleActualizarReflexion} className="space-y-3">
                <div>
                  <label htmlFor="input-frase-pedagogica" className="block text-xs font-semibold text-slate-700 mb-1">
                    Cita / Reflexión:
                  </label>
                  <textarea
                    id="input-frase-pedagogica"
                    rows={3}
                    value={frasePedagogicaEdit}
                    onChange={(e) => setFrasePedagogicaEdit(e.target.value)}
                    placeholder="Escriba la reflexión pedagógica..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="input-autor-frase" className="block text-xs font-semibold text-slate-700 mb-1">
                    Autor / Referencia:
                  </label>
                  <input
                    id="input-autor-frase"
                    type="text"
                    value={autorFraseEdit}
                    onChange={(e) => setAutorFraseEdit(e.target.value)}
                    placeholder="Ej: Equipo Directivo / Paulo Freire"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg transition-colors"
                >
                  Actualizar Reflexión Pedagógica
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {/* Barra superior de filtrado rápido y control de acordeón por día */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFiltroDiaEditor('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filtroDiaEditor === 'todos'
                      ? 'bg-[#007DC5] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({boletin.dias.length})
                </button>
                {boletin.dias.map((d) => {
                  const nombreCorto = d.fechaTexto.split(' ')[0];
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setFiltroDiaEditor(d.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        filtroDiaEditor === d.id
                          ? 'bg-[#007DC5] text-white font-bold shadow-xs'
                          : 'bg-slate-50 text-slate-700 border border-slate-200/80 hover:bg-sky-50 hover:text-[#034EA2]'
                      }`}
                    >
                      <span>{nombreCorto}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-tabular font-bold ${
                          filtroDiaEditor === d.id
                            ? 'bg-white/25 text-white'
                            : d.esFestivo
                              ? 'bg-rose-100 text-[#ED145B]'
                              : 'bg-sky-100 text-[#034EA2]'
                        }`}
                      >
                        {d.esFestivo ? 'F' : d.actividades.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const todosColapsados = boletin.dias.every((d) => diasColapsados[d.id]);
                  const nuevoEstado: Record<string, boolean> = {};
                  boletin.dias.forEach((d) => {
                    nuevoEstado[d.id] = !todosColapsados;
                  });
                  setDiasColapsados(nuevoEstado);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#034EA2] hover:bg-sky-50 rounded-lg border border-sky-200/80 transition-colors cursor-pointer"
              >
                {boletin.dias.every((d) => diasColapsados[d.id])
                  ? 'Expandir todos'
                  : 'Contraer todos'}
              </button>
            </div>

            {boletin.dias
              .filter((dia) => filtroDiaEditor === 'todos' || dia.id === filtroDiaEditor)
              .map((dia) => {
                const estaColapsado = Boolean(diasColapsados[dia.id]);
                return (
                  <div
                    key={dia.id}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all shadow-xs ${
                      dia.esFestivo
                        ? 'border-rose-200 border-l-4 border-l-[#ED145B]'
                        : 'border-slate-200/90 border-l-4 border-l-[#007DC5]'
                    }`}
                  >
                    {/* Cabecera del día con banda de identidad visual y botón de colapso */}
                    <div
                      className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b ${
                        dia.esFestivo
                          ? 'bg-gradient-to-r from-rose-50 via-rose-50/50 to-white border-rose-100'
                          : 'bg-gradient-to-r from-[#034EA2]/10 via-sky-50/60 to-white border-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setDiasColapsados((prev) => ({
                            ...prev,
                            [dia.id]: !prev[dia.id],
                          }))
                        }
                        className="flex items-center gap-3 text-left cursor-pointer group"
                      >
                        <span
                          className={`w-8 h-8 rounded-xl font-mono-tabular font-extrabold text-xs inline-flex items-center justify-center shadow-2xs shrink-0 ${
                            dia.esFestivo
                              ? 'bg-[#ED145B] text-white'
                              : 'bg-[#034EA2] text-white'
                          }`}
                        >
                          {dia.esFestivo
                            ? 'F'
                            : String(dia.actividades.length).padStart(2, '0')}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-display font-extrabold text-[#0F172A] uppercase group-hover:text-[#034EA2] transition-colors">
                              {dia.fechaTexto}
                            </h3>
                            {dia.esFestivo && (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-[#ED145B] text-white">
                                Festivo Oficial
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {dia.esFestivo
                              ? 'Día marcado como FESTIVO — Sin jornada académica'
                              : `${dia.actividades.length} actividad(es) programada(s)`}
                            {dia.notaHorario && !dia.esFestivo ? ` · ${dia.notaHorario}` : ''}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!usuarioActual) {
                              onSolicitarLogin();
                              return;
                            }
                            onEjecutarOperacion({
                              tipo: 'alternar_festivo_dia',
                              diaId: dia.id,
                              esFestivo: !dia.esFestivo,
                              notaHorario: !dia.esFestivo ? 'FESTIVO' : '',
                              autor: usuarioActual.nombre,
                            });
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                            dia.esFestivo
                              ? 'border-rose-300 bg-white text-[#ED145B] hover:bg-rose-50'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {dia.esFestivo ? 'Quitar marca Festivo' : 'Marcar como Festivo'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDiasColapsados((prev) => ({
                              ...prev,
                              [dia.id]: !prev[dia.id],
                            }))
                          }
                          aria-label={estaColapsado ? 'Expandir día' : 'Contraer día'}
                          className="p-1.5 rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:text-[#034EA2] hover:bg-sky-50 transition-colors cursor-pointer"
                        >
                          {estaColapsado ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Cuerpo colapsable con línea de tiempo numerada y píldoras de metadatos */}
                    {!estaColapsado && (
                      <div className="p-4 sm:p-5">
                        {dia.actividades.length === 0 ? (
                          <div className="rounded-xl bg-slate-50/80 border border-dashed border-slate-200 px-4 py-3.5 text-xs text-slate-500 italic">
                            {dia.esFestivo
                              ? 'Día festivo sin actividades académicas.'
                              : 'No hay actividades registradas para este día.'}
                          </div>
                        ) : (
                          <div className="relative pl-4 sm:pl-5 border-l-2 border-sky-200/90 space-y-3.5">
                            {dia.actividades.map((act, idx) => (
                              <div
                                key={act.id}
                                className={`relative rounded-xl p-3.5 sm:p-4 border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 ${
                                  act.reprogramada
                                    ? 'bg-amber-50/90 border-l-4 border-l-amber-500 border-amber-200/90 shadow-2xs'
                                    : 'bg-slate-50/60 hover:bg-white border-slate-200/80 hover:border-sky-200 hover:shadow-2xs'
                                }`}
                              >
                                {/* Indicador numérico en la línea de tiempo */}
                                <span
                                  aria-hidden="true"
                                  className={`absolute -left-[25px] sm:-left-[29px] top-4 w-5 h-5 rounded-full text-[10px] font-mono-tabular font-extrabold flex items-center justify-center ring-4 ring-white ${
                                    act.reprogramada
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-[#007DC5] text-white'
                                  }`}
                                >
                                  {String(idx + 1).padStart(2, '0')}
                                </span>

                                <div className="space-y-2.5 flex-1 min-w-0">
                                  {/* Píldora superior de Hora + Estado Reprogramado */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-sky-50 border border-sky-200/90 text-[#034EA2] font-mono-tabular text-xs font-bold">
                                      <Clock className="w-3.5 h-3.5 text-[#007DC5] shrink-0" />
                                      {act.hora}
                                    </span>

                                    {act.reprogramada && act.notaReprogramacion && (
                                      <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                        {act.notaReprogramacion}
                                      </span>
                                    )}
                                  </div>

                                  {/* Título de la actividad */}
                                  <div className="text-sm font-bold text-[#0F172A] leading-snug">
                                    {act.titulo}
                                  </div>

                                  {/* Píldoras de Metadatos: Responsable y Lugar */}
                                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 text-slate-700 text-xs font-medium shadow-2xs">
                                      <UserCheck className="w-3.5 h-3.5 text-[#007DC5] shrink-0" />
                                      <strong className="text-slate-900 font-semibold">
                                        Resp:
                                      </strong>{' '}
                                      {act.responsable}
                                    </span>

                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 text-xs font-medium">
                                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <strong className="text-emerald-900 font-semibold">
                                        Lugar:
                                      </strong>{' '}
                                      {act.lugar}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                                  <button
                                    type="button"
                                    onClick={() => abrirEdicionActividad(dia.id, act)}
                                    title="Editar datos o reprogramar esta actividad"
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                      act.reprogramada
                                        ? 'bg-amber-100 border-amber-400 text-amber-950 hover:bg-amber-200'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-[#007DC5]/10 hover:border-[#007DC5]/30 hover:text-[#007DC5]'
                                    }`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    {act.reprogramada ? 'Reprogramada / Editar' : 'Reprogramar / Editar'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleEliminarActividad(dia.id, act.id)}
                                    aria-label={`Eliminar actividad ${act.titulo}`}
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SECCIÓN 2: DOCUMENTOS Y ENLACES */}
      {seccion === 'documentos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleAgregarDocumento}
            className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4"
          >
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-blue-700" />
                Adjuntar Documento u Horario Semanal
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Vincule resoluciones, horarios en Excel, distribución de zonas o circulares.
              </p>
            </div>

            <div>
              <label
                htmlFor="doc-categoria"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Categoría o encabezado del enlace:
              </label>
              <input
                id="doc-categoria"
                type="text"
                value={catDoc}
                onChange={(e) => setCatDoc(e.target.value)}
                placeholder="Ej: Ver horario / Zonas de Acompañamiento"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="doc-titulo"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre visible del archivo:
              </label>
              <input
                id="doc-titulo"
                type="text"
                value={tituloDoc}
                onChange={(e) => setTituloDoc(e.target.value)}
                placeholder="Ej: Horario 9 al 13 Noviembre.xlsx"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Formato:
                </label>
                <DropdownPersonalizado
                  modo="simple"
                  anchoCompleto
                  ariaLabel="Formato del documento"
                  icono={<FilePlus className="w-4 h-4" />}
                  etiquetaBoton={
                    tipoDoc === 'xlsx'
                      ? 'Excel (.xlsx)'
                      : tipoDoc === 'docx'
                        ? 'Word (.docx)'
                        : tipoDoc === 'pdf'
                          ? 'PDF (.pdf)'
                          : 'Enlace Web'
                  }
                  valorSeleccionado={tipoDoc}
                  onChange={(val) =>
                    setTipoDoc(val as 'docx' | 'xlsx' | 'pdf' | 'link')
                  }
                  opciones={[
                    { valor: 'xlsx', etiqueta: 'Excel (.xlsx)' },
                    { valor: 'docx', etiqueta: 'Word (.docx)' },
                    { valor: 'pdf', etiqueta: 'PDF (.pdf)' },
                    { valor: 'link', etiqueta: 'Enlace Web' },
                  ]}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="doc-url"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  URL/Google Drive:
                </label>
                <input
                  id="doc-url"
                  type="text"
                  value={urlDoc}
                  onChange={(e) => setUrlDoc(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-tabular text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg"
            >
              Agregar Documento al Boletín
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-display font-bold text-slate-900 border-b border-slate-100 pb-2">
              Documentos Permanentes y Semanales Activos
            </h3>
            <div className="divide-y divide-slate-100">
              {boletin.documentosPermanentes.map((doc) => (
                <div
                  key={doc.id}
                  className="py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                      {doc.tipo === 'link' ? (
                        <Link2 className="w-4 h-4 text-[#007DC5]" />
                      ) : doc.tipo === 'xlsx' ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      ) : doc.tipo === 'pdf' ? (
                        <FileText className="w-4 h-4 text-[#ED145B]" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#034EA2]" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{doc.categoria}</div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-700 underline font-mono-tabular"
                      >
                        {doc.titulo} ({doc.tipo === 'link' ? 'LINK' : doc.tipo.toUpperCase()})
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar documento ${doc.titulo}`}
                    onClick={() => {
                      if (!usuarioActual) {
                        onSolicitarLogin();
                        return;
                      }
                      onEjecutarOperacion({
                        tipo: 'eliminar_documento',
                        documentoId: doc.id,
                        autor: usuarioActual.nombre,
                      });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-12 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#ED145B]" />
                Actualizar Póliza Escolar Oficial (Vigencia Anual)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Modifique el título y enlace de la póliza de seguros escolares vigente para los estudiantes.
              </p>
            </div>

            <form onSubmit={handleActualizarPoliza} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5">
                <label htmlFor="poliza-titulo" className="block text-xs font-semibold text-slate-700 mb-1">
                  Título de la Póliza:
                </label>
                <input
                  id="poliza-titulo"
                  type="text"
                  value={polizaTitulo}
                  onChange={(e) => setPolizaTitulo(e.target.value)}
                  placeholder="Ej: Circular 2026 Póliza Escolar.pdf"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  required
                />
              </div>

              <div className="md:col-span-5">
                <label htmlFor="poliza-url" className="block text-xs font-semibold text-slate-700 mb-1">
                  URL / Google Drive de la Póliza:
                </label>
                <input
                  id="poliza-url"
                  type="text"
                  value={polizaUrl}
                  onChange={(e) => setPolizaUrl(e.target.value)}
                  placeholder="Ej: https://drive.google.com/..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-tabular text-slate-900"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-4 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg shadow-xs transition-colors"
                >
                  Guardar Póliza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: ACTIVIDADES A LARGO PLAZO Y DECRETO DE CALENDARIO ACADÉMICO */}
      {seccion === 'largo_plazo' && (
        <div className="space-y-6">
          {/* IMPORTADOR INTELIGENTE DE DECRETO DE CALENDARIO ACADÉMICO (2027+) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-gradient-to-r from-[#0F223D] via-[#034EA2] to-[#007DC5] px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-base font-display font-extrabold tracking-tight">
                    Importador de Decreto de Calendario Académico (2027+)
                  </h2>
                  <p className="text-xs text-sky-100">
                    Suba el PDF de la Resolución de la Secretaría de Educación para extraer con IA las 40 semanas lectivas, desarrollo institucional, vacaciones, recesos y los 18 festivos de Colombia.
                  </p>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-xs font-bold whitespace-nowrap self-start sm:self-auto">
                Calendario Activo: Año {calendarioVigente.anio}
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Columna 1: Año objetivo y archivo PDF */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="input-anio-decreto"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Año Escolar Objetivo:
                      </label>
                      <input
                        id="input-anio-decreto"
                        type="number"
                        min={2026}
                        max={2035}
                        value={anioDecreto}
                        onChange={(e) => setAnioDecreto(Number(e.target.value) || 2027)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-[#034EA2]"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        disabled={analizandoDecreto}
                        onClick={handleGenerarPlantillaAnual}
                        className="w-full py-2 px-3 text-xs font-bold text-[#034EA2] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Generar Plantilla {anioDecreto} (Sin IA)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      1. Subir PDF de la Resolución Oficial (Alcaldía de Medellín):
                    </label>
                    <label
                      htmlFor="file-decreto-pdf"
                      className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-sky-300 hover:border-[#007DC5] bg-sky-50/50 hover:bg-sky-50 rounded-xl p-4 text-center cursor-pointer transition-colors"
                    >
                      <Upload className="w-5 h-5 text-[#007DC5]" />
                      <div className="text-xs font-bold text-[#034EA2]">
                        {archivoDecretoNombre
                          ? `Archivo cargado: ${archivoDecretoNombre}`
                          : 'Seleccionar archivo PDF de la Resolución (.pdf)'}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Procesamiento multimodal directo en el servidor (máx. 10 MB)
                      </span>
                      <input
                        id="file-decreto-pdf"
                        type="file"
                        accept=".pdf,application/pdf,.txt,text/plain"
                        onChange={handleSeleccionarArchivoDecreto}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Columna 2: Texto opcional y botón de extracción con IA */}
                <div className="lg:col-span-7 space-y-3">
                  <div>
                    <label
                      htmlFor="texto-decreto-opcional"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      2. Opcional: Pegar texto de los artículos del decreto (Art. 2 al 5):
                    </label>
                    <textarea
                      id="texto-decreto-opcional"
                      rows={4}
                      value={textoDecretoOpcional}
                      onChange={(e) => setTextoDecretoOpcional(e.target.value)}
                      placeholder="También puede copiar y pegar aquí el texto de las semanas lectivas, desarrollo institucional, vacaciones docentes y receso estudiantil de la resolución..."
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-500">
                      Los 18 festivos oficiales de Colombia del año {anioDecreto} se calculan automáticamente por Ley Emiliani.
                    </span>
                    <button
                      type="button"
                      disabled={analizandoDecreto}
                      onClick={handleAnalizarDecretoConIA}
                      className="py-2.5 px-5 text-xs font-bold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <Sparkles className="w-4 h-4" />
                      {analizandoDecreto
                        ? 'Analizando Decreto...'
                        : `Extraer Calendario ${anioDecreto} con IA`}
                    </button>
                  </div>
                </div>
              </div>

              {/* VISTA PREVIA Y CONFIRMACIÓN HUMANA DEL DECRETO EXTRAÍDO */}
              {borradorCalendarioAnual && (
                <div className="mt-4 pt-5 border-t-2 border-sky-100 space-y-4 bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-sky-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {origenBorrador === 'ia_gemini'
                            ? 'Extraído con IA Gemini'
                            : 'Plantilla Algorítmica'}
                        </span>
                        <h3 className="text-sm font-display font-extrabold text-[#034EA2]">
                          Vista Previa y Validación · Calendario Académico {borradorCalendarioAnual.anio}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Verifique o ajuste cualquier fecha antes de activar el calendario en el boletín.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBorradorCalendarioAnual(null)}
                        className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        Descartar Borrador
                      </button>
                      <button
                        type="button"
                        onClick={handleAprobarCalendarioAnual}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Aprobar y Activar Calendario {borradorCalendarioAnual.anio}
                      </button>
                    </div>
                  </div>

                  {/* Título de resolución editable */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Descripción Oficial de la Resolución:
                    </label>
                    <input
                      type="text"
                      value={borradorCalendarioAnual.resolucionTexto}
                      onChange={(e) =>
                        setBorradorCalendarioAnual({
                          ...borradorCalendarioAnual,
                          resolucionTexto: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                    />
                  </div>

                  {/* Indicadores de validación de conteo de semanas */}
                  {(() => {
                    const sumLectivas = borradorCalendarioAnual.semanasLectivas.reduce(
                      (a, b) => a + b.semanas,
                      0
                    );
                    const sumDesarrollo = borradorCalendarioAnual.semanasDesarrollo.reduce(
                      (a, b) => a + b.semanas,
                      0
                    );
                    const sumVacaciones = borradorCalendarioAnual.vacacionesDocentes.reduce(
                      (a, b) => a + b.semanas,
                      0
                    );
                    const sumReceso = borradorCalendarioAnual.recesoEstudiantil.reduce(
                      (a, b) => a + b.semanas,
                      0
                    );

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Art. 2 Lectivas:</span>
                          <span
                            className={`font-extrabold ${
                              sumLectivas === 40 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {sumLectivas}/40 sem.
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Art. 3 Desarr.:</span>
                          <span
                            className={`font-extrabold ${
                              sumDesarrollo === 6 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {sumDesarrollo}/6 sem.
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Art. 4 Vacac.:</span>
                          <span
                            className={`font-extrabold ${
                              sumVacaciones === 7 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {sumVacaciones}/7 sem.
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Art. 5 Receso:</span>
                          <span
                            className={`font-extrabold ${
                              sumReceso === 13 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {sumReceso}/13 sem.
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between col-span-2 sm:col-span-1">
                          <span className="font-semibold text-slate-600">Festivos Col.:</span>
                          <span className="font-extrabold text-[#ED145B]">
                            {borradorCalendarioAnual.festivos.length} días
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bloques editables por artículo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(
                      [
                        {
                          key: 'semanasLectivas',
                          titulo: 'Art. 2 · Semanas Lectivas (Estudiantes)',
                        },
                        {
                          key: 'semanasDesarrollo',
                          titulo: 'Art. 3 · Desarrollo Institucional',
                        },
                        {
                          key: 'vacacionesDocentes',
                          titulo: 'Art. 4 · Vacaciones Docentes',
                        },
                        {
                          key: 'recesoEstudiantil',
                          titulo: 'Art. 5 · Receso Estudiantil',
                        },
                      ] as const
                    ).map((grupo) => (
                      <div
                        key={grupo.key}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2"
                      >
                        <h4 className="text-xs font-display font-bold text-[#034EA2] uppercase">
                          {grupo.titulo}
                        </h4>
                        <div className="space-y-1.5">
                          {borradorCalendarioAnual[grupo.key].map((b) => (
                            <div
                              key={b.id}
                              className="grid grid-cols-12 gap-1.5 items-center text-[11px]"
                            >
                              <input
                                type="date"
                                value={b.desde}
                                onChange={(e) =>
                                  handleActualizarBloqueBorrador(
                                    grupo.key,
                                    b.id,
                                    'desde',
                                    e.target.value
                                  )
                                }
                                className="col-span-5 rounded border border-slate-300 px-1.5 py-1 text-[11px] text-slate-800"
                              />
                              <input
                                type="date"
                                value={b.hasta}
                                onChange={(e) =>
                                  handleActualizarBloqueBorrador(
                                    grupo.key,
                                    b.id,
                                    'hasta',
                                    e.target.value
                                  )
                                }
                                className="col-span-5 rounded border border-slate-300 px-1.5 py-1 text-[11px] text-slate-800"
                              />
                              <div className="col-span-2 flex items-center gap-0.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={b.semanas}
                                  onChange={(e) =>
                                    handleActualizarBloqueBorrador(
                                      grupo.key,
                                      b.id,
                                      'semanas',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded border border-slate-300 px-1 py-1 text-center font-bold text-[#034EA2]"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleAgregarEventoLP}
            className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4"
          >
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-blue-700" />
                Agregar Actividad a Largo Plazo
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Estas fechas se conservan automáticamente de una semana a otra al clonar el boletín.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Ubicación en el boletín:
              </label>
              <DropdownPersonalizado
                modo="simple"
                anchoCompleto
                ariaLabel="Ubicación en el boletín"
                icono={<CalendarPlus className="w-4 h-4" />}
                etiquetaBoton={
                  catEventoLP === 'finalizacion'
                    ? 'Proyección de Calendario de Finalización'
                    : 'Próximas Actividades (Sección Inferior)'
                }
                valorSeleccionado={catEventoLP}
                onChange={(val) =>
                  setCatEventoLP(
                    val as
                      | 'finalizacion'
                      | 'proxima_actividad'
                  )
                }
                opciones={[
                  {
                    valor: 'finalizacion',
                    etiqueta: 'Proyección de Calendario de Finalización',
                  },
                  {
                    valor: 'proxima_actividad',
                    etiqueta: 'Próximas Actividades (Sección Inferior)',
                  },
                ]}
              />
            </div>

            <div>
              <label
                htmlFor="lp-fecha"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Fecha o rango de fechas:
              </label>
              <input
                id="lp-fecha"
                type="text"
                value={fechaEventoLP}
                onChange={(e) => setFechaEventoLP(e.target.value)}
                placeholder="Ej: Del 17 al 20 de noviembre / 10 de diciembre"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="lp-descripcion"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Descripción detallada:
              </label>
              <textarea
                id="lp-descripcion"
                rows={3}
                value={descEventoLP}
                onChange={(e) => setDescEventoLP(e.target.value)}
                placeholder="Ej: Entrega de símbolos de 10° a 11° en el Auditorio..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={destacadoLP}
                onChange={(e) => setDestacadoLP(e.target.checked)}
                className="accent-blue-700"
              />
              Destacar fecha clave en el boletín
            </label>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg"
            >
              Guardar en Proyección a Largo Plazo
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-display font-bold text-slate-900 border-b border-slate-100 pb-2">
              Cronograma Anual y Actividades a Largo Plazo ({boletin.proyeccionCalendario.length})
            </h3>
            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto pr-1">
              {boletin.proyeccionCalendario.map((ev) => (
                <div
                  key={ev.id}
                  className="py-3 flex items-start justify-between gap-3 text-sm"
                >
                  <div>
                    <div className="text-xs text-slate-400 font-mono-tabular uppercase">
                      {ev.categoria === 'finalizacion'
                        ? 'Calendario Finalización'
                        : 'Próxima Actividad / Largo Plazo'}
                    </div>
                    <div className="text-slate-900 mt-0.5">
                      <strong className={ev.destacado ? 'text-blue-700' : ''}>
                        {ev.fechaTexto}:
                      </strong>{' '}
                      {ev.descripcion}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar evento ${ev.fechaTexto}`}
                    onClick={() => {
                      if (!usuarioActual) {
                        onSolicitarLogin();
                        return;
                      }
                      onEjecutarOperacion({
                        tipo: 'eliminar_evento_largo_plazo',
                        eventoId: ev.id,
                        autor: usuarioActual.nombre,
                      });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 4: NOTI-PRÁCTICAS Y SUSPENSIONES */}
      {seccion === 'practicas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
            <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Reconocimientos a Docentes y Avisos Pedagógicos
            </h2>

            <form onSubmit={handleAgregarFelicitacion} className="space-y-3">
              <div>
                <label
                  htmlFor="fel-docente"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Docente(s) o integrante(s) felicitado(s):
                </label>
                <input
                  id="fel-docente"
                  type="text"
                  value={docenteFel}
                  onChange={(e) => setDocenteFel(e.target.value)}
                  placeholder="Ej: Profesora Sara Bonilla Casafus"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="fel-motivo"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Motivo de la felicitación:
                </label>
                <input
                  id="fel-motivo"
                  type="text"
                  value={motivoFel}
                  onChange={(e) => setMotivoFel(e.target.value)}
                  placeholder="Ej: Por su destacado trabajo en la media técnica..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg"
              >
                Agregar Reconocimiento Docente
              </button>
            </form>

            <div className="divide-y divide-slate-100 border-t border-slate-100 pt-3">
              {boletin.felicitaciones.map((f) => (
                <div key={f.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                  <div>
                    <strong className="text-slate-900">{f.docentes}:</strong> {f.motivo}
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar felicitación de ${f.docentes}`}
                    onClick={() => {
                      if (!usuarioActual) return onSolicitarLogin();
                      onEjecutarOperacion({
                        tipo: 'eliminar_felicitacion',
                        felicitacionId: f.id,
                        autor: usuarioActual.nombre,
                      });
                    }}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAgregarAvisoPractica}
              className="border-t border-slate-100 pt-4 space-y-3"
            >
              <label
                htmlFor="nuevo-aviso-practica"
                className="block text-xs font-semibold text-slate-700"
              >
                Agregar recomendación general a Noti-Prácticas:
              </label>
              <textarea
                id="nuevo-aviso-practica"
                rows={2}
                value={nuevoAviso}
                onChange={(e) => setNuevoAviso(e.target.value)}
                placeholder="Ej: Recordar reportar a primera hora la asistencia a cita prioritaria..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Añadir Directriz a Noti-Prácticas
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <h2 className="text-base font-display font-bold text-slate-900">
                Próximas Suspensiones (Convivencia)
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={boletin.mostrarSuspensionesPublico}
                  onChange={(e) => {
                    if (!usuarioActual) return onSolicitarLogin();
                    onEjecutarOperacion({
                      tipo: 'actualizar_encabezado',
                      datos: { mostrarSuspensionesPublico: e.target.checked },
                      autor: usuarioActual.nombre,
                    });
                  }}
                  className="accent-blue-700"
                />
                Mostrar en HTML público
              </label>
            </div>

            <form onSubmit={handleAgregarSuspension} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="susp-grado"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Grado:
                </label>
                <input
                  id="susp-grado"
                  type="text"
                  value={gradoSusp}
                  onChange={(e) => setGradoSusp(e.target.value)}
                  placeholder="Ej: 6°2"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="susp-estudiante"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Estudiante:
                </label>
                <input
                  id="susp-estudiante"
                  type="text"
                  value={estudianteSusp}
                  onChange={(e) => setEstudianteSusp(e.target.value)}
                  placeholder="Apellidos y Nombres"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="susp-fecha"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Fecha(s):
                </label>
                <input
                  id="susp-fecha"
                  type="text"
                  value={fechaSusp}
                  onChange={(e) => setFechaSusp(e.target.value)}
                  placeholder="Ej: 5 y 6 de noviembre"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Registrar Suspensión en Tabla
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-100">
              {boletin.suspensiones.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular font-bold text-slate-900 w-10">
                      {s.grado}
                    </span>
                    <span className="font-medium text-slate-900">{s.estudiante}</span>
                    <span className="text-slate-500 font-mono-tabular">({s.fechaSuspension})</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar suspensión de ${s.estudiante}`}
                    onClick={() => {
                      if (!usuarioActual) return onSolicitarLogin();
                      onEjecutarOperacion({
                        tipo: 'eliminar_suspension',
                        suspensionId: s.id,
                        autor: usuarioActual.nombre,
                      });
                    }}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 5: HORARIOS PERSONAL DE APOYO */}
      {seccion === 'horarios' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-700" />
                Matriz de Horarios — Personal de Apoyo, Auxiliares y Guarda de Seguridad
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Haga clic en &ldquo;Editar fila&rdquo; sobre cualquier funcionario para ajustar sus
                turnos de la semana.
              </p>
            </div>
          </div>

          {horarioEditando && (
            <form
              onSubmit={handleGuardarHorarioApoyo}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <div className="text-xs font-bold text-blue-700 uppercase">
                Editando horario de: {horarioEditando.rol} — {horarioEditando.nombre}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const).map((diaKey) => (
                  <div key={diaKey}>
                    <label className="block text-xs font-semibold text-slate-700 capitalize mb-1">
                      {diaKey}:
                    </label>
                    <input
                      type="text"
                      value={horarioEditando[diaKey]}
                      onChange={(e) =>
                        setHorarioEditando({
                          ...horarioEditando,
                          [diaKey]: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono-tabular"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHorarioEditando(null)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#007DC5] hover:bg-[#034EA2] text-white transition-colors"
                >
                  Guardar Horario
                </button>
              </div>
            </form>
          )}

          {/* VISTA MÓVIL (TARJETAS COMPACTAS POR FUNCIONARIO CON BOTÓN DE EDICIÓN) */}
          <div className="block sm:hidden space-y-3">
            {boletin.horariosApoyo.map((h) => (
              <div
                key={h.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#034EA2] text-white inline-block mb-1">
                      {h.rol}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{h.nombre}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHorarioEditando(h)}
                    className="px-3 py-1 text-xs font-bold text-[#034EA2] bg-sky-100 hover:bg-sky-200 rounded-lg shrink-0 cursor-pointer"
                  >
                    Editar fila
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/60">
                    <span className="font-bold text-[#034EA2]">Lunes:</span>
                    <span className="font-mono-tabular font-medium text-slate-800">{h.lunes}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/60">
                    <span className="font-bold text-[#034EA2]">Martes:</span>
                    <span className="font-mono-tabular font-medium text-slate-800">{h.martes}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/60">
                    <span className="font-bold text-[#034EA2]">Miércoles:</span>
                    <span className="font-mono-tabular font-medium text-slate-800">{h.miercoles}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/60">
                    <span className="font-bold text-[#034EA2]">Jueves:</span>
                    <span className="font-mono-tabular font-medium text-slate-800">{h.jueves}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/60">
                    <span className="font-bold text-[#034EA2]">Viernes:</span>
                    <span className="font-mono-tabular font-medium text-slate-800">{h.viernes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* VISTA ESCRITORIO CON ANCHO MÍNIMO Y SCROLL SUAVE */}
          <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full min-w-[680px] border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="p-3 text-left font-semibold">Funcionario / Cargo</th>
                  <th className="p-3 text-left font-semibold">Lunes</th>
                  <th className="p-3 text-left font-semibold">Martes</th>
                  <th className="p-3 text-left font-semibold">Miércoles</th>
                  <th className="p-3 text-left font-semibold">Jueves</th>
                  <th className="p-3 text-left font-semibold">Viernes</th>
                  <th className="p-3 text-center font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boletin.horariosApoyo.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/80">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{h.rol}</div>
                      <div className="text-slate-600">{h.nombre}</div>
                    </td>
                    <td className="p-3 font-mono-tabular">{h.lunes}</td>
                    <td className="p-3 font-mono-tabular">{h.martes}</td>
                    <td className="p-3 font-mono-tabular">{h.miercoles}</td>
                    <td className="p-3 font-mono-tabular">{h.jueves}</td>
                    <td className="p-3 font-mono-tabular">{h.viernes}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setHorarioEditando(h)}
                        className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                      >
                        Editar fila
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECCIÓN 6: CLONAR SIGUIENTE SEMANA */}
      {seccion === 'clonar' && (
        <div className="max-w-2xl bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
              <CopyPlus className="w-5 h-5 text-blue-700" />
              Generar Boletín de la Siguiente Semana (N° {boletin.numero + 1})
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Crea el boletín de la siguiente semana con la fecha de emisión por defecto establecida en el <strong>viernes</strong>. Puede <strong>previsualizar</strong> el resultado en cualquier momento sin afectar la semana anterior; la actualización en vivo se activará a partir de las 18:00 horas tras presionar publicar.
            </p>
          </div>

          <form onSubmit={handleClonar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="clonar-semana-texto"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Rango de la nueva semana:
                </label>
                <input
                  id="clonar-semana-texto"
                  type="text"
                  value={nuevaSemanaTexto}
                  onChange={(e) => setNuevaSemanaTexto(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="clonar-fecha-emision"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Fecha de publicación (DD/MM/AAAA):
                </label>
                <input
                  id="clonar-fecha-emision"
                  type="text"
                  value={nuevaFechaEmision}
                  onChange={(e) => setNuevaFechaEmision(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="clonar-desc-periodo"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Encabezado de semana del periodo lectivo:
              </label>
              <input
                id="clonar-desc-periodo"
                type="text"
                value={nuevaDescPeriodo}
                onChange={(e) => setNuevaDescPeriodo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={conservarActividades}
                onChange={(e) => setConservarActividades(e.target.checked)}
                className="accent-blue-700"
              />
              Copiar también las actividades diarias de la semana actual como base
            </label>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg shadow-2xs transition-colors"
              >
                Crear y Activar NotiProfes N° {boletin.numero + 1}
              </button>
              <button
                type="button"
                onClick={() => cambiarTab('semanal', 'Programación Semanal')}
                className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Volver a la Mesa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECCIÓN REGISTRO HISTÓRICO DE CAMBIOS */}
      {seccion === 'historial' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-[#034EA2]" />
                Registro Histórico de Ediciones y Cambios
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Auditoría en tiempo real de cada modificación, usuario responsable, sección afectada y marca de tiempo.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 text-[#034EA2] text-xs font-semibold">
              <span>Total registros: {boletin.historialCambios?.length || 0}</span>
            </div>
          </div>

          {!boletin.historialCambios || boletin.historialCambios.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs italic">
              No hay registros de cambios en el historial de esta edición todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="p-3 text-left font-bold">Marca de Tiempo</th>
                    <th className="p-3 text-left font-bold">Usuario / Cargo</th>
                    <th className="p-3 text-left font-bold">Sección</th>
                    <th className="p-3 text-left font-bold">Acción</th>
                    <th className="p-3 text-left font-bold">Descripción del Cambio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {boletin.historialCambios.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono-tabular font-semibold text-slate-600 whitespace-nowrap">
                        {h.timestamp}
                      </td>
                      <td className="p-3 font-semibold text-[#0F172A] whitespace-nowrap">
                        {h.usuario}
                      </td>
                      <td className="p-3 text-[#007DC5] font-semibold whitespace-nowrap">
                        {h.seccion}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-[#034EA2] border border-sky-200">
                          {h.accion}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium leading-relaxed">
                        {h.descripcion}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE EDICIÓN Y REPROGRAMACIÓN DE ACTIVIDAD */}
      {actividadEnEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#007DC5]">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Editar / Reprogramar Actividad
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifica detalles o resalta novedades de última hora
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActividadEnEdicion(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicionActividad} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título de la Actividad:
                </label>
                <textarea
                  rows={2}
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Responsable:
                </label>
                <input
                  type="text"
                  value={editResponsable}
                  onChange={(e) => setEditResponsable(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hora / Horario:
                  </label>
                  <input
                    type="text"
                    value={editHora}
                    onChange={(e) => setEditHora(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-mono-tabular text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lugar:
                  </label>
                  <input
                    type="text"
                    value={editLugar}
                    onChange={(e) => setEditLugar(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all"
                    required
                  />
                </div>
              </div>

              {/* SECCIÓN REPROGRAMACIÓN / NOVEDAD DE ÚLTIMA HORA */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEsReprogramada}
                    onChange={(e) => setEditEsReprogramada(e.target.checked)}
                    className="accent-[#ED145B] w-4 h-4 rounded"
                  />
                  <span>Resaltar como Reprogramada o Novedad de última hora</span>
                </label>

                {editEsReprogramada && (
                  <div>
                    <label className="block text-xs font-medium text-rose-700 mb-1">
                      Nota / Aviso de Reprogramación:
                    </label>
                    <input
                      type="text"
                      value={editNotaReprogramacion}
                      onChange={(e) => setEditNotaReprogramacion(e.target.value)}
                      placeholder="Ej: Se reprograma para el martes 10:00 a.m."
                      className="w-full rounded-lg border border-rose-300 bg-rose-50/50 px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#ED145B] focus:ring-1 focus:ring-[#ED145B]/20 transition-all font-medium"
                      required={editEsReprogramada}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActividadEnEdicion(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg shadow-xs transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
