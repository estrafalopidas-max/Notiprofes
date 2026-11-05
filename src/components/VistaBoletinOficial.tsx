import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Link2,
  MapPin,
  Search,
  ShieldAlert,
  Sparkles,
  Table,
  UserCheck,
  X,
} from 'lucide-react';
import { BoletinSemanal } from '../types/notiprofes';
import { filtrarDiasBoletin } from '../utils/boletinLogic';
import { DropdownPersonalizado } from './DropdownPersonalizado';
import {
  calcularEstadoCalendarioBoletin,
  FESTIVOS_COLOMBIA_2026,
  RECESO_ESTUDIANTIL_2026,
  SEMANAS_DESARROLLO_INSTITUCIONAL_2026,
  SEMANAS_LECTIVAS_2026,
  VACACIONES_DOCENTES_2026,
} from '../utils/calendarioEscolar2026';

interface VistaBoletinOficialProps {
  boletin: BoletinSemanal;
  listaBoletines: {
    id: string;
    numero: number;
    semanaTexto: string;
    fechaEmision: string;
  }[];
  onSeleccionarBoletin: (id: string) => void;
  onIrAEditor: () => void;
  esDirectivoAutenticado: boolean;
}

export const VistaBoletinOficial: React.FC<VistaBoletinOficialProps> = ({
  boletin,
  listaBoletines,
  onSeleccionarBoletin,
  onIrAEditor,
  esDirectivoAutenticado,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [diaId, setDiaId] = useState('todos');
  const [modoVista, setModoVista] = useState<'ejecutiva' | 'tabla'>('ejecutiva');
  const [diasColapsados, setDiasColapsados] = useState<Record<string, boolean>>({});

  // Detecta el día actual de la semana (Lunes a Viernes) para activarlo en la distribución semanal
  const diaActualId = useMemo(() => {
    const hoy = new Date();
    const diaMes = hoy.getDate();
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
    const mesActual = meses[hoy.getMonth()];

    // 1. Intenta coincidir con la fecha exacta del día en el boletín (ej: "MIÉRCOLES 4 DE NOVIEMBRE")
    const porFechaExacta = boletin.dias.find((d) => {
      const txt = d.fechaTexto.toUpperCase();
      const regexDia = new RegExp(`\\b0?${diaMes}\\b`);
      return regexDia.test(txt) && txt.includes(mesActual);
    });
    if (porFechaExacta) return porFechaExacta.id;

    // 2. Respaldo por día de la semana (1 = Lunes ... 5 = Viernes)
    const diaSemana = hoy.getDay();
    const mapaNombres: Record<number, string> = {
      1: 'LUN',
      2: 'MAR',
      3: 'MI',
      4: 'JUE',
      5: 'VIE',
    };
    const prefijo = mapaNombres[diaSemana];
    if (prefijo) {
      const porDiaSemana = boletin.dias.find((d) =>
        d.fechaTexto.toUpperCase().startsWith(prefijo)
      );
      if (porDiaSemana) return porDiaSemana.id;
    }

    return boletin.dias[0]?.id || null;
  }, [boletin.dias]);

  const diasFiltrados = useMemo(
    () =>
      filtrarDiasBoletin(boletin.dias, {
        busqueda,
        diaId,
        soloReprogramadas: false,
      }),
    [boletin.dias, busqueda, diaId]
  );

  const totalActividadesSemana = useMemo(
    () => boletin.dias.reduce((acc, d) => acc + d.actividades.length, 0),
    [boletin.dias]
  );

  const totalReprogramadas = useMemo(
    () =>
      boletin.dias.reduce(
        (acc, d) => acc + d.actividades.filter((a) => a.reprogramada).length,
        0
      ),
    [boletin.dias]
  );

  const finalizacionItems = useMemo(
    () => boletin.proyeccionCalendario.filter((e) => e.categoria === 'finalizacion'),
    [boletin.proyeccionCalendario]
  );

  const proximasItems = useMemo(
    () => boletin.proyeccionCalendario.filter((e) => e.categoria !== 'finalizacion'),
    [boletin.proyeccionCalendario]
  );

  const maxActividadesDia = useMemo(
    () => Math.max(1, ...boletin.dias.map((d) => d.actividades.length)),
    [boletin.dias]
  );

  const estadoCalendario = useMemo(
    () => calcularEstadoCalendarioBoletin(boletin),
    [boletin]
  );

  return (
    <div className="space-y-6">
      {/* HERO COMPACTO INSTITUCIONAL I.E. VILLA FLORA */}
      <section
        aria-label="Encabezado Institucional Noti-Profes"
        className="bg-linear-to-r from-[#022c5e] via-[#034EA2] to-[#007DC5] text-white rounded-2xl border border-[#034EA2] overflow-hidden shadow-xs"
      >
        {/* Franja cromática corporativa superior (#034EA2 -> #007DC5 -> #ED145B) */}
        <div className="h-1 w-full bg-linear-to-r from-[#034EA2] via-[#007DC5] to-[#ED145B]" />

        <div className="px-5 py-3.5 sm:px-6 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Columna Izquierda: Semana, Programación del Periodo y De/Para */}
          <div className="lg:col-span-9 space-y-1.5 min-w-0">
            <h1 className="text-base sm:text-xl lg:text-2xl font-display font-extrabold tracking-tight text-white leading-snug break-words sm:whitespace-nowrap sm:truncate">
              {estadoCalendario.rangoSemanaFormateado}
            </h1>

            <div className="text-xs sm:text-[13px] text-sky-100 leading-snug font-medium space-y-0.5 break-words">
              <p className="break-words">
                Programación {estadoCalendario.semanaActualPeriodo} semana del{' '}
                {estadoCalendario.numeroPeriodo}
                <sup className="text-[9px] font-bold lowercase ml-0.5">
                  {estadoCalendario.ordinalSup}
                </sup>{' '}
                periodo del año lectivo.
              </p>
              <p className="break-words">{estadoCalendario.textoRangoPeriodo.replace(/\.*$/, '')}.</p>
            </div>

            <div className="pt-1.5 border-t border-white/15 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sky-100">
              <div>
                <strong className="text-white font-semibold">De:</strong>{' '}
                {boletin.remitente}
              </div>
              <div>
                <strong className="text-white font-semibold">Para:</strong>{' '}
                {boletin.destinatarios}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Reflexión Pedagógica con comillas cuadradas gigantes tras la frase al 15% de transparencia */}
          <div className="lg:col-span-3 relative flex flex-col justify-center px-2 py-1 select-none overflow-hidden min-w-0">
            {/* Comilla gigante de apertura en el fondo (15% de opacidad) */}
            <span
              aria-hidden="true"
              className="absolute -top-3 -left-1 text-4xl sm:text-6xl font-['Arial_Black',sans-serif] font-black text-white/15 pointer-events-none leading-none select-none z-0"
            >
              “
            </span>

            {/* Comilla gigante de cierre en el fondo (15% de opacidad) */}
            <span
              aria-hidden="true"
              className="absolute -bottom-3 right-0 text-4xl sm:text-6xl font-['Arial_Black',sans-serif] font-black text-white/15 pointer-events-none leading-none select-none z-0"
            >
              ”
            </span>

            <div className="relative z-10 text-[10px] font-bold text-sky-200 uppercase tracking-wide mb-0.5">
              Reflexión Pedagógica
            </div>

            {/* Texto de la reflexión pedagógica sobre las comillas */}
            <blockquote className="relative z-10 text-[11px] text-white/95 italic leading-snug px-1 break-words">
              {boletin.frasePedagogica}
            </blockquote>
            <div className="relative z-10 text-[10px] font-bold text-sky-200 text-right mt-1 break-words">
              — {boletin.autorFrase}
            </div>
          </div>
        </div>
      </section>

      {/* RIBBON GRÁFICO DE INDICADORES Y DISTRIBUCIÓN DE CARGA SEMANAL */}
      <section
        aria-label="Resumen visual de la semana"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
      >
        {/* 4 Tarjetas KPI */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex flex-col items-start gap-1.5">
              <Calendar className="w-4 h-4 text-[#007DC5] shrink-0" />
              <span className="text-xs font-semibold text-slate-500 leading-tight">
                Actividades
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-display font-extrabold text-[#034EA2]">
                {totalActividadesSemana}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Programadas</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex flex-col items-start gap-1.5">
              <FileText className="w-4 h-4 text-[#007DC5] shrink-0" />
              <span className="text-xs font-semibold text-slate-500 leading-tight">
                Documentos
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-display font-extrabold text-[#034EA2]">
                {boletin.documentosPermanentes.length}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Oficiales activos</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex flex-col items-start gap-1.5">
              <Clock className="w-4 h-4 text-[#ED145B] shrink-0" />
              <span className="text-xs font-semibold text-slate-500 leading-tight">
                Reprogramadas
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-display font-extrabold text-[#ED145B]">
                {totalReprogramadas}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Ajustes de agenda</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex flex-col items-start gap-1.5">
              <Award className="w-4 h-4 text-[#007DC5] shrink-0" />
              <span className="text-xs font-semibold text-slate-500 leading-tight">
                Reconocimientos
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-display font-extrabold text-[#034EA2]">
                {boletin.felicitaciones.length}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Noti-Prácticas</div>
            </div>
          </div>
        </div>

        {/* Gráfico visual de densidad diaria (Lunes a Viernes) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-display font-bold uppercase tracking-wider text-[#034EA2]">
              Distribución de Carga Semanal
            </span>
            <span className="text-[11px] font-mono-tabular font-semibold text-slate-500">
              Lunes a Viernes
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2.5 items-end pt-1">
            {boletin.dias.map((d) => {
              const nombreCorto = d.fechaTexto.split(' ')[0].slice(0, 3);
              const cant = d.actividades.length;
              const pct = d.esFestivo
                ? 100
                : Math.max(18, Math.round((cant / maxActividadesDia) * 100));
              const esDiaEnCurso = d.id === diaActualId;
              const activo =
                diaId === d.id || (diaId === 'todos' && esDiaEnCurso);

              return (
                <button
                  key={d.id}
                  type="button"
                  aria-current={esDiaEnCurso ? 'date' : undefined}
                  onClick={() => setDiaId(diaId === d.id ? 'todos' : d.id)}
                  className={`text-left p-2 rounded-lg border transition-all cursor-pointer ${
                    activo
                      ? 'border-2 border-[#034EA2] bg-sky-50/90 shadow-2xs'
                      : 'border-slate-200/80 bg-slate-50/70 hover:border-[#007DC5]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className={activo ? 'text-[#034EA2]' : 'text-[#0F172A]'}>
                      {nombreCorto}
                    </span>
                    <span
                      className={`font-mono-tabular text-[10px] ${
                        activo ? 'text-[#034EA2] font-extrabold' : 'text-[#007DC5]'
                      }`}
                    >
                      {d.esFestivo ? 'FEST' : cant}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        d.esFestivo
                          ? 'bg-[#ED145B]'
                          : activo
                            ? 'bg-[#034EA2]'
                            : cant >= 3
                              ? 'bg-[#034EA2]'
                              : 'bg-[#007DC5]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* BARRA DE HERRAMIENTAS INTERACTIVA: Buscador, Filtro por Día, Selector de Edición y Modo Vista */}
      <section
        aria-label="Controles de exploración del boletín"
        className="no-print bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4"
      >
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar actividad, docente, responsable o lugar..."
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-full text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all shadow-2xs"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <DropdownPersonalizado
            modo="simple"
            ariaLabel="Filtrar por día de la semana"
            icono={<Calendar className="w-4 h-4" />}
            etiquetaBoton={
              diaId === 'todos'
                ? 'Todos los días'
                : boletin.dias.find((d) => d.id === diaId)?.fechaTexto || 'Día'
            }
            valorSeleccionado={diaId}
            onChange={(nuevoDia) => setDiaId(nuevoDia)}
            opciones={[
              { valor: 'todos', etiqueta: 'Todos los días (Lunes a Viernes)' },
              ...boletin.dias.map((d) => ({
                valor: d.id,
                etiqueta: d.fechaTexto,
              })),
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {listaBoletines.length > 1 && (
            <DropdownPersonalizado
              modo="simple"
              ariaLabel="Seleccionar edición de Noti-Profes"
              icono={<FileText className="w-4 h-4" />}
              etiquetaBoton={`Edición N° ${boletin.numero}`}
              valorSeleccionado={boletin.id}
              onChange={(nuevoId) => onSeleccionarBoletin(nuevoId)}
              alineacionMenu="derecha"
              opciones={listaBoletines.map((item) => ({
                valor: item.id,
                etiqueta: `Edición N° ${item.numero} (${item.fechaEmision})`,
              }))}
            />
          )}

          {/* Conmutador Vista Gráfica vs Vista Tabla Clásica */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setModoVista('ejecutiva')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                modoVista === 'ejecutiva'
                  ? 'bg-[#034EA2] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Vista Gráfica
            </button>
            <button
              type="button"
              onClick={() => setModoVista('tabla')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                modoVista === 'tabla'
                  ? 'bg-[#034EA2] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Tabla Clásica
            </button>
          </div>

          <button
            type="button"
            onClick={onIrAEditor}
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#007DC5] hover:bg-[#034EA2] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {esDirectivoAutenticado ? 'Editar Boletín' : 'Modo Edición Directivos'}
          </button>
        </div>
      </section>

      {/* SECCIÓN 1: DOCUMENTOS PERMANENTES Y HORARIOS EN TARJETAS VISUALES */}
      <section
        aria-label="Documentos y Enlaces Permanentes"
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#034EA2]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-6 rounded-full bg-[#007DC5]" />
            <h2 className="text-base sm:text-lg font-display font-extrabold uppercase tracking-tight text-[#034EA2]">
              Documentos, Resoluciones y Horarios de la Semana
            </h2>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-slate-500">
            {boletin.documentosPermanentes.length} documentos activos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {boletin.documentosPermanentes.map((doc) => {
            const esExcel = doc.tipo === 'xlsx';
            const esPdf = doc.tipo === 'pdf';
            const esLink = doc.tipo === 'link';
            const esWord = doc.tipo === 'docx';

            const iconoElemento = esLink ? (
              <Link2 className="w-4 h-4 text-[#007DC5] shrink-0" />
            ) : esExcel ? (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : esPdf ? (
              <FileText className="w-4 h-4 text-[#ED145B] shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-[#034EA2] shrink-0" />
            );

            const badgeClase = esLink
              ? 'bg-sky-50 text-[#007DC5] border border-sky-200'
              : esExcel
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : esPdf
                  ? 'bg-rose-50 text-[#ED145B] border border-rose-200'
                  : 'bg-blue-50 text-[#034EA2] border border-blue-200';

            const etiquetaBadge = esLink ? 'LINK' : doc.tipo.toUpperCase();

            const textoPie = esLink
              ? 'Enlace web / URL'
              : esExcel
                ? 'Hoja de cálculo Excel'
                : esPdf
                  ? 'Documento PDF'
                  : 'Documento Word';

            return (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group min-w-0 overflow-hidden p-4 rounded-xl border border-slate-200/90 bg-white hover:border-[#007DC5] hover:shadow-sm transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    {iconoElemento}
                    <span
                      className={`shrink-0 px-2 py-0.5 text-[10px] font-mono-tabular font-bold uppercase rounded ${badgeClase}`}
                    >
                      {etiquetaBadge}
                    </span>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-500 leading-snug break-words">
                    {doc.categoria}
                  </div>

                  <div className="text-sm font-bold text-[#0F172A] group-hover:text-[#007DC5] transition-colors leading-snug break-words">
                    {doc.titulo}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="truncate">{textoPie}</span>
                  <span className="shrink-0 font-bold text-[#007DC5] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                    Abrir <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* SECCIÓN 2: PROGRAMACIÓN SEMANAL DE ACTIVIDADES */}
      <section
        aria-label="Programación Semanal de Actividades"
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#034EA2]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-6 rounded-full bg-[#ED145B]" />
            <div>
              <h2 className="text-base sm:text-lg font-display font-extrabold uppercase tracking-tight text-[#034EA2]">
                Programación de Actividades de la Semana
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Cronograma operativo para docentes, directivos y personal administrativo
              </p>
            </div>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-slate-500">
            Mostrando {diasFiltrados.reduce((acc, d) => acc + d.actividades.length, 0)} de{' '}
            {totalActividadesSemana} actividades
          </span>
        </div>

        {diasFiltrados.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              No se encontraron actividades con los filtros actuales.
            </p>
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setDiaId('todos');
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-[#034EA2] rounded-lg"
            >
              Restablecer filtros
            </button>
          </div>
        ) : modoVista === 'ejecutiva' ? (
          /* VISTA GRÁFICA EJECUTIVA POR DÍA CON BANDAS DE COLOR, ACORDEÓN, LÍNEA DE TIEMPO Y PÍLDORAS */
          <div className="space-y-4">
            {diasFiltrados.map((dia) => {
              const esDiaActual = dia.id === diaActualId;
              const estaColapsado = Boolean(diasColapsados[dia.id]);

              if (dia.esFestivo && dia.actividades.length === 0) {
                return (
                  <div
                    key={dia.id}
                    className={`rounded-2xl border overflow-hidden border-l-4 border-l-[#ED145B] ${
                      esDiaActual
                        ? 'border-2 border-[#ED145B] bg-rose-50/50 shadow-sm ring-2 ring-rose-100'
                        : 'border-rose-200 bg-rose-50/40'
                    }`}
                  >
                    <div className="px-5 py-3.5 bg-linear-to-r from-rose-100/80 via-rose-50 to-white border-b border-rose-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 text-[11px] font-mono-tabular font-bold uppercase bg-[#ED145B] text-white rounded-lg shadow-2xs">
                          FESTIVO
                        </span>
                        <h3 className="text-sm sm:text-base font-display font-extrabold text-[#0F172A] uppercase">
                          {dia.fechaTexto}
                        </h3>
                        {esDiaActual && (
                          <span className="px-2.5 py-0.5 text-xs font-extrabold bg-[#ED145B] text-white rounded-full">
                            HOY
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#ED145B]">
                        {dia.notaHorario || 'DÍA FESTIVO OFICIAL'}
                      </span>
                    </div>
                    <div className="px-5 py-4 text-xs text-slate-600">
                      Jornada festiva nacional — Sin actividades académicas presenciales.
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={dia.id}
                  className={`rounded-2xl border overflow-hidden transition-all border-l-4 ${
                    esDiaActual
                      ? 'border-2 border-[#034EA2] border-l-4 border-l-[#034EA2] bg-white shadow-md ring-2 ring-sky-100'
                      : 'border-slate-200/90 border-l-[#007DC5] bg-white shadow-xs'
                  }`}
                >
                  {/* Cabecera del día con banda cromática y acordeón */}
                  <div
                    className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
                      esDiaActual
                        ? 'bg-linear-to-r from-[#034EA2]/15 via-sky-50 to-white border-sky-200'
                        : 'bg-linear-to-r from-[#034EA2]/8 via-slate-50 to-white border-slate-200/80'
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
                      className="flex flex-wrap items-center gap-3 text-left cursor-pointer group"
                    >
                      <span className="w-8 h-8 rounded-xl bg-[#034EA2] text-white font-mono-tabular font-extrabold text-xs inline-flex items-center justify-center shadow-2xs shrink-0">
                        {String(dia.actividades.length).padStart(2, '0')}
                      </span>
                      <h3
                        className={`text-sm sm:text-base font-display font-extrabold uppercase group-hover:text-[#007DC5] transition-colors ${
                          esDiaActual ? 'text-[#034EA2]' : 'text-[#0F172A]'
                        }`}
                      >
                        {dia.fechaTexto}
                      </h3>
                      {esDiaActual && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide bg-[#034EA2] text-white rounded-full shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Hoy · Día Activo
                        </span>
                      )}
                      {dia.notaHorario && (
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-sky-100 text-[#034EA2] border border-sky-200 rounded-md">
                          {dia.notaHorario}
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular font-bold ${
                          esDiaActual
                            ? 'bg-sky-100 text-[#034EA2]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {dia.actividades.length} actividad(es)
                      </span>
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

                  {/* Lista de actividades del día con línea de tiempo y píldoras */}
                  {!estaColapsado && (
                    <div className="p-4 sm:p-5">
                      {dia.actividades.length === 0 ? (
                        <div className="rounded-xl bg-slate-50/80 border border-dashed border-slate-200 px-4 py-3.5 text-xs text-slate-500 italic">
                          Sin actividades extraordinarias registradas para este día.
                        </div>
                      ) : (
                        <div className="relative pl-4 sm:pl-5 border-l-2 border-sky-200/90 space-y-3">
                          {dia.actividades.map((act, idx) => (
                            <div
                              key={act.id}
                              className={`relative rounded-xl p-3.5 sm:p-4 border transition-all grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center ${
                                act.reprogramada
                                  ? 'bg-amber-50/90 border-l-4 border-l-amber-500 border-amber-200 hover:bg-amber-100/80'
                                  : esDiaActual
                                    ? idx % 2 === 1
                                      ? 'bg-sky-50/40 border-sky-100 hover:bg-sky-50/80'
                                      : 'bg-white border-slate-200/80 hover:border-sky-200'
                                    : idx % 2 === 1
                                      ? 'bg-slate-50/70 border-slate-200/70 hover:bg-white hover:border-sky-200'
                                      : 'bg-white border-slate-200/80 hover:border-sky-200'
                              }`}
                            >
                              {/* Numeración en la línea de tiempo */}
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

                              {/* Hora en píldora */}
                              <div className="md:col-span-3 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-50 border border-sky-200/90 text-[#034EA2] font-mono-tabular text-xs font-bold shadow-2xs">
                                  <Clock className="w-3.5 h-3.5 text-[#007DC5] shrink-0" />
                                  {act.hora}
                                </span>
                              </div>

                              {/* Actividad + Reprogramación */}
                              <div className="md:col-span-5 space-y-1.5">
                                <div className="text-[14px] font-bold text-[#0F172A] leading-snug">
                                  {act.titulo}
                                </div>
                                {act.reprogramada && act.notaReprogramacion && (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    {act.notaReprogramacion}
                                  </div>
                                )}
                              </div>

                              {/* Píldoras de Responsable y Lugar */}
                              <div className="md:col-span-4 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 text-xs text-slate-700 shadow-2xs">
                                  <UserCheck className="w-3.5 h-3.5 text-[#007DC5] shrink-0" />
                                  <span>
                                    <strong className="text-[#0F172A] font-semibold">
                                      Resp:
                                    </strong>{' '}
                                    {act.responsable}
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-medium">
                                    <strong className="text-emerald-900 font-semibold">
                                      Lugar:
                                    </strong>{' '}
                                    {act.lugar}
                                  </span>
                                </span>
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
        ) : (
          /* VISTA TABLA CLÁSICA (5 COLUMNAS DEL FORMATO INSTITUCIONAL) */
          <div className="overflow-x-auto border border-slate-300 rounded-xl">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-100 text-[#034EA2] border-b border-slate-300 text-xs uppercase font-display font-bold tracking-wider">
                  <th className="py-3 px-4 border-r border-slate-300 w-[18%]">FECHA</th>
                  <th className="py-3 px-4 border-r border-slate-300 w-[40%]">ACTIVIDADES</th>
                  <th className="py-3 px-4 border-r border-slate-300 w-[18%]">RESPONSABLE</th>
                  <th className="py-3 px-4 border-r border-slate-300 w-[12%]">HORA</th>
                  <th className="py-3 px-4 w-[12%]">LUGAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {diasFiltrados.map((dia) => {
                  const esDiaActual = dia.id === diaActualId;

                  if (dia.esFestivo && dia.actividades.length === 0) {
                    return (
                      <tr
                        key={dia.id}
                        className={esDiaActual ? 'bg-rose-100/70 font-semibold' : 'bg-rose-50/70'}
                      >
                        <td className="py-3 px-4 font-bold text-[#0F172A] border-r border-slate-300 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{dia.fechaTexto}</span>
                            {esDiaActual && (
                              <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-[#ED145B] text-white rounded">
                                HOY
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          colSpan={4}
                          className="py-3 px-4 font-bold text-[#ED145B] text-xs"
                        >
                          {dia.notaHorario || 'DÍA FESTIVO'}
                        </td>
                      </tr>
                    );
                  }

                  return dia.actividades.map((act, idx) => (
                    <tr
                      key={act.id}
                      className={`transition-colors ${
                        esDiaActual
                          ? idx % 2 === 1
                            ? 'bg-sky-50/70 hover:bg-sky-100/70'
                            : 'bg-white hover:bg-sky-50/50'
                          : idx % 2 === 1
                            ? 'bg-slate-50/80 hover:bg-slate-100/70'
                            : 'bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      {idx === 0 && (
                        <td
                          rowSpan={dia.actividades.length}
                          className={`py-3.5 px-4 align-top border-r border-slate-300 ${
                            esDiaActual ? 'bg-sky-100/70 font-bold' : 'bg-slate-50/60'
                          }`}
                        >
                          <div className="font-bold text-[#0F172A] text-xs leading-snug flex items-center gap-1.5 flex-wrap">
                            <span>{dia.fechaTexto}</span>
                            {esDiaActual && (
                              <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-[#034EA2] text-white rounded shadow-2xs">
                                HOY
                              </span>
                            )}
                          </div>
                          {dia.notaHorario && (
                            <div className="mt-1.5 inline-block px-2 py-0.5 text-[11px] font-bold bg-sky-100 text-[#034EA2] rounded">
                              {dia.notaHorario}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-4 align-top border-r border-slate-300">
                        <div className="font-bold text-[#0F172A] leading-snug">
                          {act.titulo}
                        </div>
                        {act.reprogramada && act.notaReprogramacion && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            {act.notaReprogramacion}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top border-r border-slate-300 text-slate-700 text-xs font-medium">
                        {act.responsable}
                      </td>
                      <td className="py-3.5 px-4 align-top border-r border-slate-300 font-mono-tabular text-xs text-[#0F172A]">
                        {act.hora}
                      </td>
                      <td className="py-3.5 px-4 align-top text-slate-500 text-xs font-medium">
                        {act.lugar}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECCIÓN 3: PROYECCIÓN DE CALENDARIO DE FINALIZACIÓN Y PRÓXIMAS ACTIVIDADES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section
          aria-label="Proyección de Calendario de Finalización"
          className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#034EA2]/15">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-6 rounded-full bg-[#034EA2]" />
              <h2 className="text-base font-display font-extrabold uppercase tracking-tight text-[#034EA2]">
                Proyección de Calendario de Finalización
              </h2>
            </div>
            <span className="text-xs font-mono-tabular font-semibold text-slate-500">
              {finalizacionItems.length} hitos
            </span>
          </div>

          <div className="space-y-2.5">
            {finalizacionItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <span className="font-mono-tabular font-bold text-[#034EA2] shrink-0">
                  {item.fechaTexto}
                </span>
                <span className="text-[#0F172A] font-medium sm:text-right">
                  {item.descripcion}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-label="Próximas Actividades y Capacitaciones"
          className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#034EA2]/15">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-6 rounded-full bg-[#007DC5]" />
              <h2 className="text-base font-display font-extrabold uppercase tracking-tight text-[#034EA2]">
                Próximas Actividades y Capacitaciones
              </h2>
            </div>
            <span className="text-xs font-mono-tabular font-semibold text-slate-500">
              {proximasItems.length} eventos
            </span>
          </div>

          <div className="space-y-3">
            {proximasItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200/90 bg-white space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tabular text-xs font-bold text-[#007DC5]">
                    {item.fechaTexto}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono-tabular uppercase font-bold rounded bg-sky-50 text-[#034EA2]">
                    {item.categoria}
                  </span>
                </div>
                <p className="text-xs text-[#0F172A] leading-relaxed">
                  {item.descripcion}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* SECCIÓN 3B: CALENDARIO ACADÉMICO OFICIAL 2026 (ALCALDÍA DE MEDELLÍN) Y FESTIVOS DEL AÑO */}
      <section
        aria-label="Calendario Académico Oficial 2026 y Festivos"
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#034EA2]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-6 rounded-full bg-[#007DC5]" />
            <div>
              <h2 className="text-base sm:text-lg font-display font-extrabold uppercase tracking-tight text-[#034EA2]">
                Calendario Académico Oficial 2026 (Medellín) y Festivos del Año
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Resolución Oficial Distrito de Medellín: 40 semanas lectivas, 6 de desarrollo institucional, 7 de vacaciones docentes, 13 de receso estudiantil y 18 festivos
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-sky-50 border border-sky-200 text-xs font-bold text-[#034EA2]">
            {estadoCalendario.numeroPeriodo}
            <sup className="text-[9px] font-extrabold lowercase ml-0.5">
              {estadoCalendario.ordinalSup}
            </sup>{' '}
            PERIODO · {estadoCalendario.textoSemanaDePeriodo}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tablas Oficiales Artículos 2, 3, 4 y 5 */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Art. 2: 40 Semanas Lectivas */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-extrabold uppercase text-[#034EA2]">
                  Art. 2 · Semanas Lectivas
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#034EA2] text-white">
                  40 semanas
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                {SEMANAS_LECTIVAS_2026.map((b) => (
                  <div
                    key={b.id}
                    className="p-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-700 font-medium">
                      {b.desdeTexto.replace(' de 2026', '')} al{' '}
                      {b.hastaTexto.replace(' de 2026', '')}
                    </span>
                    <span className="font-bold text-[#007DC5] shrink-0">
                      {b.semanas} sem.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Art. 3: 6 Semanas Desarrollo Institucional */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-extrabold uppercase text-[#034EA2]">
                  Art. 3 · Desarrollo Inst.
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#007DC5] text-white">
                  6 semanas
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                {SEMANAS_DESARROLLO_INSTITUCIONAL_2026.map((b) => (
                  <div
                    key={b.id}
                    className="p-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-700 font-medium">
                      {b.desdeTexto.replace(' de 2026', '')} al{' '}
                      {b.hastaTexto.replace(' de 2026', '')}
                    </span>
                    <span className="font-bold text-[#034EA2] shrink-0">
                      {b.semanas} sem.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Art. 4: 7 Semanas Vacaciones Docentes */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-extrabold uppercase text-[#034EA2]">
                  Art. 4 · Vacaciones Docentes
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-700 text-white">
                  7 semanas
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                {VACACIONES_DOCENTES_2026.map((b) => (
                  <div
                    key={b.id}
                    className="p-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-700 font-medium">
                      {b.desdeTexto.replace(' de 2026', '')} al{' '}
                      {b.hastaTexto.replace(' de 2026', '')}
                    </span>
                    <span className="font-bold text-slate-700 shrink-0">
                      {b.semanas} sem.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Art. 5: 13 Semanas Receso Estudiantil */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-extrabold uppercase text-[#034EA2]">
                  Art. 5 · Receso Estudiantil
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-700 text-white">
                  13 semanas
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                {RECESO_ESTUDIANTIL_2026.map((b) => (
                  <div
                    key={b.id}
                    className="p-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-700 font-medium">
                      {b.desdeTexto.replace(' de 2026', '')} al{' '}
                      {b.hastaTexto.replace(' de 2026', '')}
                    </span>
                    <span className="font-bold text-emerald-700 shrink-0">
                      {b.semanas} sem.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Festivos Oficiales del Año 2026 (Colombia) */}
          <div className="lg:col-span-5 p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-start gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-display font-extrabold uppercase text-[#034EA2]">
                Festivos Oficiales de Colombia · Año 2026
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#ED145B] text-white">
                {FESTIVOS_COLOMBIA_2026.length} festivos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {FESTIVOS_COLOMBIA_2026.map((fest) => {
                const esDeEstaSemana = estadoCalendario.festivosSemana.some(
                  (f) => f.fecha === fest.fecha
                );
                return (
                  <div
                    key={fest.fecha}
                    className={`p-2 rounded-lg border text-[11px] flex flex-col justify-between ${
                      esDeEstaSemana
                        ? 'bg-rose-50 border-[#ED145B] text-[#0F172A]'
                        : 'bg-white border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-bold">
                      <span
                        className={
                          esDeEstaSemana ? 'text-[#ED145B]' : 'text-[#034EA2]'
                        }
                      >
                        {fest.diaSemana.slice(0, 3)} {fest.diaMesTexto}
                      </span>
                      {esDeEstaSemana && (
                        <span className="px-1.5 py-0.2 bg-[#ED145B] text-white text-[9px] rounded uppercase">
                          Esta semana
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {fest.nombre}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 4: BANNER CORPORATIVO NOTI-PRÁCTICAS, FELICITACIONES Y CONVIVENCIA */}
      <section
        aria-label="Noti-Prácticas y Felicitaciones"
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
      >
        {/* Cabecera gráfica Noti-Prácticas con paleta Villa Flora */}
        <div className="bg-linear-to-r from-[#034EA2] via-[#007DC5] to-[#034EA2] px-6 sm:px-8 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 border border-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-display font-extrabold tracking-wider uppercase">
                NOTI PRÁCTICAS · Reconocimiento y Convivencia
              </h2>
              <p className="text-xs text-sky-100">
                Exaltación a la labor docente, orientaciones pedagógicas y zonas de acompañamiento
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#ED145B] text-white font-mono-tabular text-xs font-bold self-start sm:self-center">
            {boletin.felicitaciones.length} Reconocimientos
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Tarjetas de Felicitaciones Docentes */}
          <div className="space-y-3">
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-[#034EA2] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#ED145B]" />
              Menciones de Honor de la Semana
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {boletin.felicitaciones.map((fel) => (
                <div
                  key={fel.id}
                  className="p-4 rounded-xl bg-sky-50/50 border border-sky-200/80 flex flex-col justify-between gap-2"
                >
                  <div className="text-sm font-bold text-[#034EA2] leading-snug">
                    ★ {fel.docentes}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{fel.motivo}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Directrices y Zonas de Acompañamiento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-display font-bold uppercase tracking-wider text-[#034EA2] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#007DC5]" />
                Orientaciones Pedagógicas y Administrativas
              </h3>
              <ul className="space-y-2 text-xs text-[#0F172A]">
                {boletin.avisosPracticas.map((aviso, i) => (
                  <li
                    key={i}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 leading-relaxed"
                  >
                    {aviso}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-display font-bold uppercase tracking-wider text-[#034EA2] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#ED145B]" />
                  Cuidado en Zonas de Acompañamiento
                </h3>
                <ul className="space-y-2 text-xs text-[#0F172A]">
                  {boletin.zonasAcompanamientoNotas.map((nota, i) => (
                    <li
                      key={i}
                      className="p-3 rounded-lg bg-rose-50/40 border border-rose-200/70 leading-relaxed"
                    >
                      {nota}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ruta de atención en caso de accidente escolar */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-display font-bold uppercase tracking-wider text-sky-300">
                    Ruta Obligatoria ante Accidente o Lesión Escolar
                  </span>
                  <a
                    href={boletin.polizaEscolarDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-[#ED145B] hover:underline inline-flex items-center gap-1"
                  >
                    Póliza <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {boletin.pasosAccidenteEscolar.map((paso, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white/10 border border-white/15 text-xs flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#ED145B] text-white font-mono-tabular font-bold text-[11px] inline-flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">
                        {paso.replace(/^\d+\.\s*/, '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Control de Próximas Suspensiones */}
          {boletin.mostrarSuspensionesPublico && boletin.suspensiones.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-bold uppercase tracking-wider text-[#034EA2]">
                  Control de Próximas Suspensiones
                </h3>
                <span className="text-xs font-mono-tabular text-slate-500">
                  {boletin.suspensiones.length} registros activos
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[#034EA2] border-b border-slate-200 font-display font-bold uppercase">
                      <th className="py-2.5 px-3 border-r border-slate-200 w-24">Grado</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">
                        Nombres y Apellidos
                      </th>
                      <th className="py-2.5 px-3">Fecha de Suspensión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {boletin.suspensiones.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 border-r border-slate-200 font-mono-tabular font-bold text-[#0F172A]">
                          {s.grado}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-medium text-[#0F172A]">
                          {s.estudiante}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-600">
                          {s.fechaSuspension}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECCIÓN 5: HORARIOS DE PERSONAL DE APOYO, AUXILIARES Y SEGURIDAD + FIRMAS */}
      <section
        aria-label="Horarios del Personal de Apoyo"
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#034EA2]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-6 rounded-full bg-[#034EA2]" />
            <div>
              <h2 className="text-base sm:text-lg font-display font-extrabold uppercase tracking-tight text-[#034EA2]">
                Horarios del Personal de Apoyo, Auxiliares y Seguridad
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Atención UAI, Psicología PEEP, PTAFI 3.0, Biblioteca y Administración
              </p>
            </div>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-slate-500">
            Jornada Lunes a Viernes
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[#034EA2] border-b border-slate-200 font-display font-bold uppercase tracking-wider">
                <th className="py-3 px-4 border-r border-slate-200">Funcionario / Rol</th>
                <th className="py-3 px-3 border-r border-slate-200">Lunes</th>
                <th className="py-3 px-3 border-r border-slate-200">Martes</th>
                <th className="py-3 px-3 border-r border-slate-200">Miércoles</th>
                <th className="py-3 px-3 border-r border-slate-200">Jueves</th>
                <th className="py-3 px-3">Viernes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {boletin.horariosApoyo.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 border-r border-slate-200">
                    <div className="font-bold text-[#034EA2]">{h.rol}</div>
                    <div className="text-[#0F172A] font-medium">{h.nombre}</div>
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 font-mono-tabular text-slate-700">
                    {h.lunes}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 font-mono-tabular text-slate-700">
                    {h.martes}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 font-mono-tabular text-slate-700">
                    {h.miercoles}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 font-mono-tabular text-slate-700">
                    {h.jueves}
                  </td>
                  <td className="py-3 px-3 font-mono-tabular text-slate-700">
                    {h.viernes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Firmas del Equipo Directivo */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {boletin.firmas.map((f, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-xs font-display font-extrabold text-[#034EA2] tracking-wide">
                {f.nombre}
              </div>
              <div className="text-[11px] font-mono-tabular uppercase font-semibold text-slate-500">
                {f.cargo}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
