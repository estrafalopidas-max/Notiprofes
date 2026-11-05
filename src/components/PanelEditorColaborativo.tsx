import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Clock,
  CopyPlus,
  FilePlus,
  FileSpreadsheet,
  FileText,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  BoletinSemanal,
  DocumentoInstitucional,
  HorarioPersonalApoyo,
  OperacionBoletin,
  PresenciaActiva,
  UsuarioDirectivo,
} from '../types/notiprofes';
import { validarActividadInput } from '../utils/boletinLogic';
import { DropdownPersonalizado } from './DropdownPersonalizado';

interface PanelEditorColaborativoProps {
  boletin: BoletinSemanal;
  usuarioActual: UsuarioDirectivo | null;
  presencia: PresenciaActiva[];
  wsConectado: boolean;
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
  | 'clonar';

export const PanelEditorColaborativo: React.FC<PanelEditorColaborativoProps> = ({
  boletin,
  usuarioActual,
  presencia,
  wsConectado,
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
    'finalizacion' | 'proxima_actividad' | 'capacitacion' | 'institucional'
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
  const [nuevaFechaEmision, setNuevaFechaEmision] = useState('06/11/2026');
  const [nuevaDescPeriodo, setNuevaDescPeriodo] = useState(
    'Programación de la UNDÉCIMA semana del TERCER periodo del año lectivo.'
  );
  const [conservarActividades, setConservarActividades] = useState(false);

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
      {/* Encabezado Ejecutivo de Colaboración Multi-Equipo */}
      <section
        aria-label="Estado de edición colaborativa en tiempo real"
        className="bg-linear-to-r from-[#022c5e] via-[#034EA2] to-[#007DC5] text-white rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-[#034EA2] shadow-xs"
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
            <div className="flex items-center gap-2 ml-1">
              {presencia.slice(0, 4).map((p) => (
                <span
                  key={p.clienteId}
                  title={`${p.nombre} (${p.cargo}) — Editando: ${p.seccionActiva}`}
                  className="text-xs font-semibold text-white underline decoration-sky-400"
                >
                  {p.nombre.split(' ')[0]} ({p.seccionActiva})
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
          <form
            onSubmit={handleAgregarActividad}
            className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4"
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
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg transition-colors mt-3"
            >
              Guardar y Publicar Actividad en el Boletín
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {boletin.dias.map((dia) => (
              <div
                key={dia.id}
                className="bg-white border border-slate-200/90 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-display font-bold text-slate-900 uppercase">
                      {dia.fechaTexto}
                    </h3>
                    <div className="text-xs text-slate-500">
                      {dia.esFestivo
                        ? 'Día marcado como FESTIVO'
                        : `${dia.actividades.length} actividad(es) programada(s)`}
                      {dia.notaHorario ? ` · ${dia.notaHorario}` : ''}
                    </div>
                  </div>

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
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    {dia.esFestivo ? 'Quitar marca Festivo' : 'Marcar como Festivo'}
                  </button>
                </div>

                {dia.actividades.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    {dia.esFestivo
                      ? 'Día festivo sin actividades académicas.'
                      : 'No hay actividades registradas para este día.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dia.actividades.map((act) => (
                      <div
                        key={act.id}
                        className={`p-3 rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-all my-1 ${
                          act.reprogramada
                            ? 'bg-amber-50/90 border-l-4 border-l-amber-500 border border-amber-200/90 shadow-2xs'
                            : 'py-3 border-b border-slate-100 last:border-b-0'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-900">
                            {act.titulo}
                            {act.reprogramada && act.notaReprogramacion && (
                              <span className="ml-2 inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold px-2 py-0.5 rounded-md">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                {act.notaReprogramacion}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                            <span>
                              <strong className="text-slate-700">Responsable:</strong>{' '}
                              {act.responsable}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">
                              <strong className="text-slate-700">Hora:</strong> {act.hora}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              <strong className="text-slate-700">Lugar:</strong> {act.lugar}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => abrirEdicionActividad(dia.id, act)}
                            title="Editar datos o reprogramar esta actividad"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                              act.reprogramada
                                ? 'bg-amber-100 border-amber-400 text-amber-950 hover:bg-amber-200'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-[#007DC5]/10 hover:border-[#007DC5]/30 hover:text-[#007DC5]'
                            }`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {act.reprogramada ? 'Reprogramada / Editar' : 'Reprogramar / Editar'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEliminarActividad(dia.id, act.id)}
                            aria-label={`Eliminar actividad ${act.titulo}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg"
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
        </div>
      )}

      {/* SECCIÓN 3: ACTIVIDADES A LARGO PLAZO */}
      {seccion === 'largo_plazo' && (
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
                    : catEventoLP === 'proxima_actividad'
                      ? 'Próximas Actividades (Sección Inferior)'
                      : catEventoLP === 'capacitacion'
                        ? 'Capacitaciones / Icontec ISO 21001'
                        : 'Auditoría / Evento Institucional'
                }
                valorSeleccionado={catEventoLP}
                onChange={(val) =>
                  setCatEventoLP(
                    val as
                      | 'finalizacion'
                      | 'proxima_actividad'
                      | 'capacitacion'
                      | 'institucional'
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
                  {
                    valor: 'capacitacion',
                    etiqueta: 'Capacitaciones / Icontec ISO 21001',
                  },
                  {
                    valor: 'institucional',
                    etiqueta: 'Auditoría / Evento Institucional',
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
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg"
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
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg"
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
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-700 text-white"
                >
                  Guardar Horario
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
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
              Esta herramienta crea el nuevo boletín semanal conservando automáticamente los{' '}
              <strong>documentos permanentes</strong>, el{' '}
              <strong>calendario de finalización a largo plazo</strong>, los{' '}
              <strong>horarios del personal de apoyo</strong> y las{' '}
              <strong>firmas directivas</strong>.
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
                className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg shadow-2xs transition-colors"
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg shadow-xs transition-colors"
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
