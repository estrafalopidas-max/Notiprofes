import {
  BloqueCalendarioOficial,
  BoletinSemanal,
  ConfiguracionCalendarioAnual,
  DiaProgramacion,
  FestivoColombia,
  PeriodoAcademicoConfig,
} from '../types/notiprofes';

export type {
  BloqueCalendarioOficial,
  ConfiguracionCalendarioAnual,
  FestivoColombia,
  PeriodoAcademicoConfig,
};

/**
 * Artículo 2 - Resolución Calendario Académico 2026 (Alcaldía de Medellín)
 * Cuarenta (40) semanas de trabajo académico con estudiantes.
 */
export const SEMANAS_LECTIVAS_2026: BloqueCalendarioOficial[] = [
  {
    id: 'lectiva-1',
    desde: '2026-01-26',
    hasta: '2026-03-29',
    desdeTexto: '26 de enero de 2026',
    hastaTexto: '29 de marzo de 2026',
    semanas: 9,
    duracionTexto: 'Nueve (09) semanas',
  },
  {
    id: 'lectiva-2',
    desde: '2026-04-06',
    hasta: '2026-06-21',
    desdeTexto: '06 de abril de 2026',
    hastaTexto: '21 de junio de 2026',
    semanas: 11,
    duracionTexto: 'Once (11) semanas',
  },
  {
    id: 'lectiva-3',
    desde: '2026-07-13',
    hasta: '2026-10-04',
    desdeTexto: '13 de julio de 2026',
    hastaTexto: '04 de octubre de 2026',
    semanas: 12,
    duracionTexto: 'Doce (12) semanas',
  },
  {
    id: 'lectiva-4',
    desde: '2026-10-12',
    hasta: '2026-12-06',
    desdeTexto: '12 de octubre de 2026',
    hastaTexto: '06 de diciembre de 2026',
    semanas: 8,
    duracionTexto: 'Ocho (8) semanas',
  },
];

/**
 * Artículo 3 - Seis (6) semanas de Desarrollo Institucional (docentes y directivos).
 */
export const SEMANAS_DESARROLLO_INSTITUCIONAL_2026: BloqueCalendarioOficial[] = [
  {
    id: 'desarrollo-1',
    desde: '2026-01-12',
    hasta: '2026-01-25',
    desdeTexto: '12 de enero de 2026',
    hastaTexto: '25 de enero de 2026',
    semanas: 2,
    duracionTexto: 'Dos (2) semanas',
  },
  {
    id: 'desarrollo-2',
    desde: '2026-03-30',
    hasta: '2026-04-05',
    desdeTexto: '30 de marzo de 2026',
    hastaTexto: '05 de abril de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) semana',
  },
  {
    id: 'desarrollo-3',
    desde: '2026-07-06',
    hasta: '2026-07-12',
    desdeTexto: '06 de julio de 2026',
    hastaTexto: '12 de julio de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) semana',
  },
  {
    id: 'desarrollo-4',
    desde: '2026-10-05',
    hasta: '2026-10-11',
    desdeTexto: '05 de octubre de 2026',
    hastaTexto: '11 de octubre de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) semana',
  },
  {
    id: 'desarrollo-5',
    desde: '2026-12-07',
    hasta: '2026-12-13',
    desdeTexto: '07 de diciembre de 2026',
    hastaTexto: '13 de diciembre de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) semana',
  },
];

/**
 * Artículo 4 - Siete (7) semanas de Vacaciones de Docentes y Directivos Docentes.
 */
export const VACACIONES_DOCENTES_2026: BloqueCalendarioOficial[] = [
  {
    id: 'vac-doc-1',
    desde: '2025-12-22',
    hasta: '2026-01-11',
    desdeTexto: '22 de diciembre de 2025',
    hastaTexto: '11 de enero de 2026',
    semanas: 3,
    duracionTexto: 'Tres (3) semanas',
  },
  {
    id: 'vac-doc-2',
    desde: '2026-06-22',
    hasta: '2026-07-05',
    desdeTexto: '22 de junio de 2026',
    hastaTexto: '05 de julio de 2026',
    semanas: 2,
    duracionTexto: 'Dos (2) semanas',
  },
  {
    id: 'vac-doc-3',
    desde: '2026-12-14',
    hasta: '2026-12-27',
    desdeTexto: '14 de diciembre de 2026',
    hastaTexto: '27 de diciembre de 2026',
    semanas: 2,
    duracionTexto: 'Dos (2) semanas',
  },
];

/**
 * Artículo 5 - Trece (13) semanas de Receso Estudiantil.
 */
export const RECESO_ESTUDIANTIL_2026: BloqueCalendarioOficial[] = [
  {
    id: 'receso-1',
    desde: '2025-12-22',
    hasta: '2026-01-25',
    desdeTexto: '22 de diciembre de 2025',
    hastaTexto: '25 de enero de 2026',
    semanas: 5,
    duracionTexto: 'Cinco (5) semanas',
  },
  {
    id: 'receso-2',
    desde: '2026-03-30',
    hasta: '2026-04-05',
    desdeTexto: '30 de marzo de 2026',
    hastaTexto: '05 de abril de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) semana',
  },
  {
    id: 'receso-3',
    desde: '2026-06-22',
    hasta: '2026-07-12',
    desdeTexto: '22 de junio de 2026',
    hastaTexto: '12 de julio de 2026',
    semanas: 3,
    duracionTexto: 'Tres (3) semanas',
  },
  {
    id: 'receso-4',
    desde: '2026-10-05',
    hasta: '2026-10-11',
    desdeTexto: '05 de octubre de 2026',
    hastaTexto: '11 de octubre de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) semana',
  },
  {
    id: 'receso-5',
    desde: '2026-12-07',
    hasta: '2026-12-27',
    desdeTexto: '07 de diciembre de 2026',
    hastaTexto: '27 de diciembre de 2026',
    semanas: 3,
    duracionTexto: 'Tres (3) semanas',
  },
];

/**
 * Artículo 6 - Semanas Lectivas Adicionales únicamente CLEI V y CLEI VI.
 */
export const SEMANAS_ADICIONALES_CLEI_2026: BloqueCalendarioOficial[] = [
  {
    id: 'clei-1',
    desde: '2026-01-19',
    hasta: '2026-01-25',
    desdeTexto: '19 al 25 de enero',
    hastaTexto: '25 de enero de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) Semana',
  },
  {
    id: 'clei-2',
    desde: '2026-03-30',
    hasta: '2026-04-05',
    desdeTexto: '30 de marzo al 5 de abril',
    hastaTexto: '05 de abril de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) Semana',
  },
  {
    id: 'clei-3',
    desde: '2026-07-06',
    hasta: '2026-07-12',
    desdeTexto: '06 al 12 de julio',
    hastaTexto: '12 de julio de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) Semana',
  },
  {
    id: 'clei-4',
    desde: '2026-12-07',
    hasta: '2026-12-13',
    desdeTexto: '07 al 13 de diciembre',
    hastaTexto: '13 de diciembre de 2026',
    semanas: 1,
    duracionTexto: 'Una (1) Semana',
  },
];

/**
 * Distribución de los 3 Periodos Académicos de la I.E. Villa Flora (13 + 13 + 14 = 40 semanas lectivas).
 */
export const PERIODOS_ACADEMICOS_2026: PeriodoAcademicoConfig[] = [
  {
    numero: 1,
    ordinalSup: 'er',
    nombreCorto: 'Primer Periodo',
    fechaInicio: '2026-01-26',
    fechaFin: '2026-05-03',
    textoRango: 'Este primer período inició el 26 de enero y termina el 1 de mayo',
    totalSemanasLectivas: 13,
  },
  {
    numero: 2,
    ordinalSup: 'do',
    nombreCorto: 'Segundo Periodo',
    fechaInicio: '2026-05-04',
    fechaFin: '2026-08-23',
    textoRango: 'Este segundo período inició el 4 de mayo y termina el 21 de agosto',
    totalSemanasLectivas: 13,
  },
  {
    numero: 3,
    ordinalSup: 'er',
    nombreCorto: 'Tercer Periodo',
    fechaInicio: '2026-08-24',
    fechaFin: '2026-12-06',
    textoRango: 'Este tercer período inició el 24 de agosto y termina el 4 de diciembre',
    totalSemanasLectivas: 14,
  },
];

/**
 * Festivos Oficiales de Colombia en el año 2026 (Ley 51 de 1983 / Ley Emiliani).
 */
export const FESTIVOS_COLOMBIA_2026: FestivoColombia[] = [
  { fecha: '2026-01-01', diaMesTexto: '1 de enero', diaSemana: 'Jueves', nombre: 'Año Nuevo' },
  { fecha: '2026-01-12', diaMesTexto: '12 de enero', diaSemana: 'Lunes', nombre: 'Día de los Reyes Magos' },
  { fecha: '2026-03-23', diaMesTexto: '23 de marzo', diaSemana: 'Lunes', nombre: 'Día de San José' },
  { fecha: '2026-04-02', diaMesTexto: '2 de abril', diaSemana: 'Jueves', nombre: 'Jueves Santo' },
  { fecha: '2026-04-03', diaMesTexto: '3 de abril', diaSemana: 'Viernes', nombre: 'Viernes Santo' },
  { fecha: '2026-05-01', diaMesTexto: '1 de mayo', diaSemana: 'Viernes', nombre: 'Día del Trabajo' },
  { fecha: '2026-05-18', diaMesTexto: '18 de mayo', diaSemana: 'Lunes', nombre: 'Día de la Ascensión' },
  { fecha: '2026-06-08', diaMesTexto: '8 de junio', diaSemana: 'Lunes', nombre: 'Corpus Christi' },
  { fecha: '2026-06-15', diaMesTexto: '15 de junio', diaSemana: 'Lunes', nombre: 'Sagrado Corazón de Jesús' },
  { fecha: '2026-06-29', diaMesTexto: '29 de junio', diaSemana: 'Lunes', nombre: 'San Pedro y San Pablo' },
  { fecha: '2026-07-20', diaMesTexto: '20 de julio', diaSemana: 'Lunes', nombre: 'Día de la Independencia de Colombia' },
  { fecha: '2026-08-07', diaMesTexto: '7 de agosto', diaSemana: 'Viernes', nombre: 'Batalla de Boyacá' },
  { fecha: '2026-08-17', diaMesTexto: '17 de agosto', diaSemana: 'Lunes', nombre: 'La Asunción de la Virgen' },
  { fecha: '2026-10-12', diaMesTexto: '12 de octubre', diaSemana: 'Lunes', nombre: 'Día de la Diversidad Étnica y Cultural' },
  { fecha: '2026-11-02', diaMesTexto: '2 de noviembre', diaSemana: 'Lunes', nombre: 'Día de Todos los Santos' },
  { fecha: '2026-11-16', diaMesTexto: '16 de noviembre', diaSemana: 'Lunes', nombre: 'Independencia de Cartagena' },
  { fecha: '2026-12-08', diaMesTexto: '8 de diciembre', diaSemana: 'Martes', nombre: 'Día de la Inmaculada Concepción' },
  { fecha: '2026-12-25', diaMesTexto: '25 de diciembre', diaSemana: 'Viernes', nombre: 'Navidad' },
];

const MESES_ES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const NOMBRES_MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const NOMBRES_DIAS_SEMANA = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'];

function parsearDiaYMes(texto: string): { dia: number; mesNombre: string; mesIndex: number } | null {
  const limpio = texto.trim().toLowerCase();
  const match = limpio.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
  if (!match) return null;
  const dia = parseInt(match[1], 10);
  const mesNombre = match[2].toLowerCase();
  const mesIndex = MESES_ES[mesNombre];
  if (isNaN(dia) || mesIndex === undefined) return null;
  return { dia, mesNombre: NOMBRES_MESES[mesIndex], mesIndex };
}

/**
 * Formatea el texto del encabezado de la semana según las reglas solicitadas:
 * - Si abarca el mismo mes: "Semana del XX al XX de MM"
 * - Si abarca 2 meses distintos: "Semana del XX de MM al XX de MM"
 */
export function formatearRangoSemanaSegunMeses(
  dias: DiaProgramacion[],
  semanaTextoOriginal?: string
): string {
  if (dias.length >= 2) {
    const primero = parsearDiaYMes(dias[0].fechaTexto);
    const ultimo = parsearDiaYMes(dias[dias.length - 1].fechaTexto);
    if (primero && ultimo) {
      if (primero.mesIndex === ultimo.mesIndex) {
        return `Semana del ${primero.dia} al ${ultimo.dia} de ${ultimo.mesNombre}`;
      }
      return `Semana del ${primero.dia} de ${primero.mesNombre} al ${ultimo.dia} de ${ultimo.mesNombre}`;
    }
  }

  if (semanaTextoOriginal) {
    const regexDosMeses = /semana\s+del\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)/i;
    const matchDos = semanaTextoOriginal.match(regexDosMeses);
    if (matchDos) {
      const d1 = parseInt(matchDos[1], 10);
      const m1 = matchDos[2].toLowerCase();
      const d2 = parseInt(matchDos[3], 10);
      const m2 = matchDos[4].toLowerCase();
      if (m1 === m2) {
        return `Semana del ${d1} al ${d2} de ${m2}`;
      }
      return `Semana del ${d1} de ${m1} al ${d2} de ${m2}`;
    }

    const regexUnMes = /semana\s+del\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)/i;
    const matchUno = semanaTextoOriginal.match(regexUnMes);
    if (matchUno) {
      return `Semana del ${ parseInt(matchUno[1], 10) } al ${ parseInt(matchUno[2], 10) } de ${matchUno[3].toLowerCase()}`;
    }
  }

  return semanaTextoOriginal || 'Semana activa';
}

function aFechaIso(anio: number, mesIndex: number, dia: number): string {
  const m = String(mesIndex + 1).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${anio}-${m}-${d}`;
}

/**
 * Calcula los 18 Festivos Oficiales de Colombia para cualquier año (ej. 2026, 2027, 2028)
 * aplicando el algoritmo de Butcher para Pascua y la Ley 51 de 1983 (Ley Emiliani).
 */
export function generarFestivosColombiaAnio(anio: number): FestivoColombia[] {
  if (anio === 2026) {
    return [...FESTIVOS_COLOMBIA_2026];
  }

  const diasSemanaNombres = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];

  const formatearFestivo = (fechaUtc: Date, nombre: string): FestivoColombia => {
    const iso = fechaUtc.toISOString().slice(0, 10);
    const dia = fechaUtc.getUTCDate();
    const mesTexto = NOMBRES_MESES[fechaUtc.getUTCMonth()];
    const diaSemana = diasSemanaNombres[fechaUtc.getUTCDay()];
    return {
      fecha: iso,
      diaMesTexto: `${dia} de ${mesTexto}`,
      diaSemana,
      nombre,
    };
  };

  // Traslada una fecha al siguiente lunes si no cae en lunes (Ley Emiliani)
  const trasladarALunesEmiliani = (mesIndex: number, dia: number): Date => {
    const d = new Date(Date.UTC(anio, mesIndex, dia));
    const dow = d.getUTCDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
    if (dow === 1) return d;
    const diasSumar = dow === 0 ? 1 : 8 - dow;
    return new Date(d.getTime() + diasSumar * 86400000);
  };

  // Algoritmo de Butcher para Domingo de Pascua
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesPascua = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const diaPascua = ((h + l - 7 * m + 114) % 31) + 1;
  const domingoPascua = new Date(Date.UTC(anio, mesPascua, diaPascua));

  const sumarDiasPascua = (dias: number): Date =>
    new Date(domingoPascua.getTime() + dias * 86400000);

  const lista: FestivoColombia[] = [
    // Fijos inamovibles
    formatearFestivo(new Date(Date.UTC(anio, 0, 1)), 'Año Nuevo'),
    formatearFestivo(new Date(Date.UTC(anio, 4, 1)), 'Día del Trabajo'),
    formatearFestivo(new Date(Date.UTC(anio, 6, 20)), 'Día de la Independencia de Colombia'),
    formatearFestivo(new Date(Date.UTC(anio, 7, 7)), 'Batalla de Boyacá'),
    formatearFestivo(new Date(Date.UTC(anio, 11, 8)), 'Día de la Inmaculada Concepción'),
    formatearFestivo(new Date(Date.UTC(anio, 11, 25)), 'Navidad'),

    // Ley Emiliani (se trasladan al lunes siguiente)
    formatearFestivo(trasladarALunesEmiliani(0, 6), 'Día de los Reyes Magos'),
    formatearFestivo(trasladarALunesEmiliani(2, 19), 'Día de San José'),
    formatearFestivo(trasladarALunesEmiliani(5, 29), 'San Pedro y San Pablo'),
    formatearFestivo(trasladarALunesEmiliani(7, 15), 'La Asunción de la Virgen'),
    formatearFestivo(trasladarALunesEmiliani(9, 12), 'Día de la Diversidad Étnica y Cultural'),
    formatearFestivo(trasladarALunesEmiliani(10, 1), 'Día de Todos los Santos'),
    formatearFestivo(trasladarALunesEmiliani(10, 11), 'Independencia de Cartagena'),

    // Religiosos relativos a Pascua
    formatearFestivo(sumarDiasPascua(-3), 'Jueves Santo'),
    formatearFestivo(sumarDiasPascua(-2), 'Viernes Santo'),
    formatearFestivo(sumarDiasPascua(43), 'Día de la Ascensión'),
    formatearFestivo(sumarDiasPascua(64), 'Corpus Christi'),
    formatearFestivo(sumarDiasPascua(71), 'Sagrado Corazón de Jesús'),
  ];

  return lista.sort((x, y) => x.fecha.localeCompare(y.fecha));
}

export function formatearFechaIsoATextoLargo(iso: string): string {
  const partes = iso.split('-').map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) return iso;
  const [y, m, d] = partes;
  const mes = NOMBRES_MESES[m - 1] || 'enero';
  return `${String(d).padStart(2, '0')} de ${mes} de ${y}`;
}

export const CALENDARIO_OFICIAL_2026_DEFAULT: ConfiguracionCalendarioAnual = {
  anio: 2026,
  resolucionTexto:
    'Resolución Oficial Distrito de Medellín: 40 semanas lectivas, 6 de desarrollo institucional, 7 de vacaciones docentes, 13 de receso estudiantil y 18 festivos',
  semanasLectivas: SEMANAS_LECTIVAS_2026,
  semanasDesarrollo: SEMANAS_DESARROLLO_INSTITUCIONAL_2026,
  vacacionesDocentes: VACACIONES_DOCENTES_2026,
  recesoEstudiantil: RECESO_ESTUDIANTIL_2026,
  periodosAcademicos: PERIODOS_ACADEMICOS_2026,
  festivos: FESTIVOS_COLOMBIA_2026,
};

export function obtenerCalendarioOficialBoletin(
  boletin?: BoletinSemanal
): ConfiguracionCalendarioAnual {
  if (
    boletin?.calendarioOficial &&
    Array.isArray(boletin.calendarioOficial.semanasLectivas) &&
    boletin.calendarioOficial.semanasLectivas.length > 0
  ) {
    return boletin.calendarioOficial;
  }
  return CALENDARIO_OFICIAL_2026_DEFAULT;
}

/**
 * Genera una plantilla base para cualquier año (ej. 2027) proyectando los lunes equivalentes
 * y calculando automáticamente los 18 festivos de Colombia de ese año.
 */
export function generarPlantillaCalendarioAnual(anio: number): ConfiguracionCalendarioAnual {
  if (anio === 2026) {
    return JSON.parse(JSON.stringify(CALENDARIO_OFICIAL_2026_DEFAULT));
  }

  // Encontrar el lunes de la cuarta semana de enero del año objetivo
  const buscarLunesCercano = (mesIdx: number, diaRef: number): Date => {
    const fecha = new Date(Date.UTC(anio, mesIdx, diaRef));
    const dow = fecha.getUTCDay();
    const ajuste = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
    return new Date(fecha.getTime() + ajuste * 86400000);
  };

  const crearBloque = (
    id: string,
    lunesInicio: Date,
    semanas: number,
    etiquetaSemanas: string
  ): BloqueCalendarioOficial => {
    const domingoFin = new Date(lunesInicio.getTime() + (semanas * 7 - 1) * 86400000);
    const desde = lunesInicio.toISOString().slice(0, 10);
    const hasta = domingoFin.toISOString().slice(0, 10);
    return {
      id,
      desde,
      hasta,
      desdeTexto: formatearFechaIsoATextoLargo(desde),
      hastaTexto: formatearFechaIsoATextoLargo(hasta),
      semanas,
      duracionTexto: etiquetaSemanas,
    };
  };

  const l1 = buscarLunesCercano(0, 24);
  const l2 = new Date(l1.getTime() + 10 * 7 * 86400000);
  const l3 = new Date(l2.getTime() + 14 * 7 * 86400000);
  const l4 = new Date(l3.getTime() + 13 * 7 * 86400000);

  const semanasLectivas: BloqueCalendarioOficial[] = [
    crearBloque('lectiva-1', l1, 9, 'Nueve (09) semanas'),
    crearBloque('lectiva-2', l2, 11, 'Once (11) semanas'),
    crearBloque('lectiva-3', l3, 12, 'Doce (12) semanas'),
    crearBloque('lectiva-4', l4, 8, 'Ocho (8) semanas'),
  ];

  const d1 = new Date(l1.getTime() - 2 * 7 * 86400000);
  const d2 = new Date(l1.getTime() + 9 * 7 * 86400000);
  const d3 = new Date(l3.getTime() - 1 * 7 * 86400000);
  const d4 = new Date(l3.getTime() + 12 * 7 * 86400000);
  const d5 = new Date(l4.getTime() + 8 * 7 * 86400000);

  const semanasDesarrollo: BloqueCalendarioOficial[] = [
    crearBloque('desarrollo-1', d1, 2, 'Dos (2) semanas'),
    crearBloque('desarrollo-2', d2, 1, 'Una (1) semana'),
    crearBloque('desarrollo-3', d3, 1, 'Una (1) semana'),
    crearBloque('desarrollo-4', d4, 1, 'Una (1) semana'),
    crearBloque('desarrollo-5', d5, 1, 'Una (1) semana'),
  ];

  const v1 = new Date(d1.getTime() - 2 * 7 * 86400000);
  const v2 = new Date(l2.getTime() + 11 * 7 * 86400000);
  const v3 = new Date(d5.getTime() + 1 * 7 * 86400000);

  const vacacionesDocentes: BloqueCalendarioOficial[] = [
    crearBloque('vac-doc-1', v1, 2, 'Dos (2) semanas'),
    crearBloque('vac-doc-2', v2, 2, 'Dos (2) semanas'),
    crearBloque('vac-doc-3', v3, 3, 'Tres (3) semanas'),
  ];

  const r1 = new Date(l1.getTime() - 4 * 7 * 86400000);
  const r2 = d2;
  const r3 = v2;
  const r4 = d4;
  const r5 = d5;

  const recesoEstudiantil: BloqueCalendarioOficial[] = [
    crearBloque('receso-est-1', r1, 4, 'Cuatro (4) semanas'),
    crearBloque('receso-est-2', r2, 1, 'Una (1) semana'),
    crearBloque('receso-est-3', r3, 3, 'Tres (3) semanas'),
    crearBloque('receso-est-4', r4, 1, 'Una (1) semana'),
    crearBloque('receso-est-5', r5, 4, 'Cuatro (4) semanas'),
  ];

  const p1Fin = new Date(l2.getTime() + 4 * 7 * 86400000 - 86400000);
  const p2Ini = new Date(p1Fin.getTime() + 86400000);
  const p2Fin = new Date(l3.getTime() + 6 * 7 * 86400000 - 86400000);
  const p3Ini = new Date(p2Fin.getTime() + 86400000);
  const p3Fin = new Date(l4.getTime() + 8 * 7 * 86400000 - 86400000);

  const periodosAcademicos: PeriodoAcademicoConfig[] = [
    {
      numero: 1,
      ordinalSup: 'er',
      nombreCorto: 'Primer Periodo',
      fechaInicio: semanasLectivas[0].desde,
      fechaFin: p1Fin.toISOString().slice(0, 10),
      textoRango: `Este primer período inició el ${formatearFechaIsoATextoLargo(
        semanasLectivas[0].desde
      ).replace(` de ${anio}`, '')} y termina el ${formatearFechaIsoATextoLargo(
        p1Fin.toISOString().slice(0, 10)
      ).replace(` de ${anio}`, '')}`,
      totalSemanasLectivas: 13,
    },
    {
      numero: 2,
      ordinalSup: 'do',
      nombreCorto: 'Segundo Periodo',
      fechaInicio: p2Ini.toISOString().slice(0, 10),
      fechaFin: p2Fin.toISOString().slice(0, 10),
      textoRango: `Este segundo período inició el ${formatearFechaIsoATextoLargo(
        p2Ini.toISOString().slice(0, 10)
      ).replace(` de ${anio}`, '')} y termina el ${formatearFechaIsoATextoLargo(
        p2Fin.toISOString().slice(0, 10)
      ).replace(` de ${anio}`, '')}`,
      totalSemanasLectivas: 13,
    },
    {
      numero: 3,
      ordinalSup: 'er',
      nombreCorto: 'Tercer Periodo',
      fechaInicio: p3Ini.toISOString().slice(0, 10),
      fechaFin: p3Fin.toISOString().slice(0, 10),
      textoRango: `Este tercer período inició el ${formatearFechaIsoATextoLargo(
        p3Ini.toISOString().slice(0, 10)
      ).replace(` de ${anio}`, '')} y termina el ${formatearFechaIsoATextoLargo(
        p3Fin.toISOString().slice(0, 10)
      ).replace(` de ${anio}`, '')}`,
      totalSemanasLectivas: 14,
    },
  ];

  return {
    anio,
    resolucionTexto: `Resolución Oficial Distrito de Medellín (${anio}): 40 semanas lectivas, 6 de desarrollo institucional, 7 de vacaciones docentes, 13 de receso estudiantil y 18 festivos`,
    semanasLectivas,
    semanasDesarrollo,
    vacacionesDocentes,
    recesoEstudiantil,
    periodosAcademicos,
    festivos: generarFestivosColombiaAnio(anio),
  };
}

/**
 * Genera la lista de los 40 lunes de las semanas lectivas según la configuración activa.
 */
export function obtenerSemanasLectivasAnuales2026(
  calendario: ConfiguracionCalendarioAnual = CALENDARIO_OFICIAL_2026_DEFAULT
): {
  semanaAnual: number;
  lunesIso: string;
  viernesIso: string;
  periodo: 1 | 2 | 3;
  semanaEnPeriodo: number;
  totalSemanasPeriodo: number;
}[] {
  const resultado: {
    semanaAnual: number;
    lunesIso: string;
    viernesIso: string;
    periodo: 1 | 2 | 3;
    semanaEnPeriodo: number;
    totalSemanasPeriodo: number;
  }[] = [];

  let contadorAnual = 0;
  const contadoresPeriodo: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  const periodos =
    calendario.periodosAcademicos?.length === 3
      ? calendario.periodosAcademicos
      : PERIODOS_ACADEMICOS_2026;

  for (const bloque of calendario.semanasLectivas) {
    const [y, m, d] = bloque.desde.split('-').map(Number);
    const fechaCursor = new Date(Date.UTC(y, m - 1, d));

    for (let i = 0; i < bloque.semanas; i++) {
      contadorAnual += 1;
      const lunesIso = fechaCursor.toISOString().slice(0, 10);
      const viernesDate = new Date(fechaCursor.getTime() + 4 * 86400000);
      const viernesIso = viernesDate.toISOString().slice(0, 10);

      let periodo: 1 | 2 | 3 = 3;
      if (contadorAnual <= 13) {
        periodo = 1;
      } else if (contadorAnual <= 25) {
        periodo = 2;
      } else {
        periodo = 3;
      }

      contadoresPeriodo[periodo] += 1;
      const configPeriodo = periodos.find((p) => p.numero === periodo) || periodos[2];
      const semanaPeriodoAjustada = Math.min(
        configPeriodo.totalSemanasLectivas,
        contadoresPeriodo[periodo]
      );

      resultado.push({
        semanaAnual: contadorAnual,
        lunesIso,
        viernesIso,
        periodo,
        semanaEnPeriodo: semanaPeriodoAjustada,
        totalSemanasPeriodo: configPeriodo.totalSemanasLectivas,
      });

      fechaCursor.setUTCDate(fechaCursor.getUTCDate() + 7);
    }
  }

  return resultado;
}

export interface ResumenCalendarioBoletin {
  numeroPeriodo: 1 | 2 | 3;
  ordinalSup: 'er' | 'do';
  nombrePeriodo: string;
  textoRangoPeriodo: string;
  fechaPublicacionFormateada: string;
  semanaActualPeriodo: number;
  totalSemanasPeriodo: number;
  semanaLectivaAnual: number;
  totalSemanasAnuales: number;
  rangoSemanaFormateado: string;
  textoSemanaDePeriodo: string;
  festivosSemana: FestivoColombia[];
  tipoSemana: 'Lectiva' | 'Desarrollo Institucional' | 'Receso / Vacaciones';
}

function formatearFechaPublicacion(boletin: BoletinSemanal): string {
  return boletin.fechaEmision;
}

/**
 * Calcula automáticamente el periodo, número de semana dentro del periodo ("Semana XX de XX"),
 * semana lectiva anual y los festivos oficiales de la semana usando el calendario oficial del boletín.
 */
export function calcularEstadoCalendarioBoletin(
  boletin: BoletinSemanal
): ResumenCalendarioBoletin {
  const calendario = obtenerCalendarioOficialBoletin(boletin);
  const anioActivo = calendario.anio || 2026;
  const rangoSemanaFormateado = formatearRangoSemanaSegunMeses(
    boletin.dias,
    boletin.semanaTexto
  );
  const fechaPublicacionFormateada = formatearFechaPublicacion(boletin);

  // Intentamos extraer la fecha del lunes del boletín
  const lunesParsed = boletin.dias.length > 0 ? parsearDiaYMes(boletin.dias[0].fechaTexto) : null;
  const lunesIso = lunesParsed
    ? aFechaIso(anioActivo, lunesParsed.mesIndex, lunesParsed.dia)
    : `${anioActivo}-11-02`;

  // Detectar festivos de Colombia dentro de los 5 días (lunes a viernes) de la semana activa
  const [y, m, d] = lunesIso.split('-').map(Number);
  const fechaLunesUtc = new Date(Date.UTC(y, m - 1, d));
  const fechasSemanaIso: string[] = [];
  for (let i = 0; i < 5; i++) {
    const f = new Date(fechaLunesUtc.getTime() + i * 86400000);
    fechasSemanaIso.push(f.toISOString().slice(0, 10));
  }

  const festivosSemana = calendario.festivos.filter((fest) =>
    fechasSemanaIso.includes(fest.fecha)
  );

  // Buscar coincidencia exacta en las semanas lectivas del año activo
  const semanasLectivas = obtenerSemanasLectivasAnuales2026(calendario);
  const encontrada = semanasLectivas.find((s) => s.lunesIso === lunesIso);

  const periodos =
    calendario.periodosAcademicos?.length === 3
      ? calendario.periodosAcademicos
      : PERIODOS_ACADEMICOS_2026;

  if (encontrada) {
    const configPeriodo =
      periodos.find((p) => p.numero === encontrada.periodo) || periodos[2];
    return {
      numeroPeriodo: encontrada.periodo,
      ordinalSup: configPeriodo.ordinalSup,
      nombrePeriodo: configPeriodo.nombreCorto,
      textoRangoPeriodo: `${configPeriodo.textoRango.replace(/\.*$/, '')}.`,
      fechaPublicacionFormateada,
      semanaActualPeriodo: encontrada.semanaEnPeriodo,
      totalSemanasPeriodo: encontrada.totalSemanasPeriodo,
      semanaLectivaAnual: encontrada.semanaAnual,
      totalSemanasAnuales: 40,
      rangoSemanaFormateado,
      textoSemanaDePeriodo: `Semana ${encontrada.semanaEnPeriodo} de ${encontrada.totalSemanasPeriodo}`,
      festivosSemana,
      tipoSemana: 'Lectiva',
    };
  }

  // Verificar si cae en una semana de Desarrollo Institucional
  const enDesarrollo = calendario.semanasDesarrollo.find(
    (b) => lunesIso >= b.desde && lunesIso <= b.hasta
  );
  if (enDesarrollo) {
    return {
      numeroPeriodo: 3,
      ordinalSup: 'er',
      nombrePeriodo: 'Desarrollo Institucional',
      textoRangoPeriodo: `${periodos[2].textoRango.replace(/\.*$/, '')}.`,
      fechaPublicacionFormateada,
      semanaActualPeriodo: 14,
      totalSemanasPeriodo: 14,
      semanaLectivaAnual: 40,
      totalSemanasAnuales: 40,
      rangoSemanaFormateado,
      textoSemanaDePeriodo: 'Semana de Desarrollo Institucional',
      festivosSemana,
      tipoSemana: 'Desarrollo Institucional',
    };
  }

  // Fallback para el 3er periodo según el número de edición (Edición 40 = Semana 11 de 14)
  const semanaEstimada = Math.min(14, Math.max(1, boletin.numero - 29));
  return {
    numeroPeriodo: 3,
    ordinalSup: 'er',
    nombrePeriodo: 'Tercer Periodo',
    textoRangoPeriodo: `${periodos[2].textoRango.replace(/\.*$/, '')}.`,
    fechaPublicacionFormateada,
    semanaActualPeriodo: semanaEstimada,
    totalSemanasPeriodo: 14,
    semanaLectivaAnual: Math.min(40, 25 + semanaEstimada),
    totalSemanasAnuales: 40,
    rangoSemanaFormateado,
    textoSemanaDePeriodo: `Semana ${semanaEstimada} de 14`,
    festivosSemana,
    tipoSemana: 'Lectiva',
  };
}

/**
 * Calcula los 5 días (Lunes a Viernes) de la siguiente semana a partir del boletín actual,
 * marcando automáticamente si alguno de los días es festivo oficial en el calendario activo.
 */
export function generarDiasSiguienteSemanaConFestivos(
  diasActuales: DiaProgramacion[],
  calendario: ConfiguracionCalendarioAnual = CALENDARIO_OFICIAL_2026_DEFAULT
): {
  diasNuevos: Pick<DiaProgramacion, 'id' | 'fechaTexto' | 'esFestivo' | 'notaHorario'>[];
  semanaTextoNuevo: string;
} {
  const anioActivo = calendario.anio || 2026;
  const lunesActual = diasActuales.length > 0 ? parsearDiaYMes(diasActuales[0].fechaTexto) : null;
  const baseDate = lunesActual
    ? new Date(Date.UTC(anioActivo, lunesActual.mesIndex, lunesActual.dia + 7))
    : new Date(Date.UTC(anioActivo, 10, 9));

  const idsDias = ['dia-lunes', 'dia-martes', 'dia-miercoles', 'dia-jueves', 'dia-viernes'];
  const diasNuevos: Pick<DiaProgramacion, 'id' | 'fechaTexto' | 'esFestivo' | 'notaHorario'>[] = [];

  for (let i = 0; i < 5; i++) {
    const fechaDia = new Date(baseDate.getTime() + i * 86400000);
    const iso = fechaDia.toISOString().slice(0, 10);
    const numDia = fechaDia.getUTCDate();
    const nombreMes = NOMBRES_MESES[fechaDia.getUTCMonth()];
    const fechaTexto = `${NOMBRES_DIAS_SEMANA[i]} ${numDia} DE ${nombreMes.toUpperCase()}`;

    const festivoOficial = calendario.festivos.find((f) => f.fecha === iso);

    diasNuevos.push({
      id: idsDias[i] || `dia-${i + 1}`,
      fechaTexto,
      esFestivo: Boolean(festivoOficial),
      notaHorario: festivoOficial ? `FESTIVO — ${festivoOficial.nombre}` : undefined,
    });
  }

  const semanaTextoNuevo = formatearRangoSemanaSegunMeses(
    diasNuevos.map((d) => ({ ...d, actividades: [] }))
  );

  return { diasNuevos, semanaTextoNuevo };
}

/**
 * Calcula la fecha de publicación (Viernes) en la que se emite el boletín de la siguiente semana.
 * Por directriz institucional, el boletín nuevo se publica el viernes inmediatamente anterior al lunes de inicio lectivo.
 */
export function calcularFechaViernesSiguienteSemana(
  diasActuales: DiaProgramacion[],
  anioActivo: number = 2026
): string {
  const lunesActual = diasActuales.length > 0 ? parsearDiaYMes(diasActuales[0].fechaTexto) : null;
  const lunesSiguiente = lunesActual
    ? new Date(Date.UTC(anioActivo, lunesActual.mesIndex, lunesActual.dia + 7))
    : new Date(Date.UTC(anioActivo, 10, 9));
  // El viernes de publicación corresponde al viernes inmediatamente previo al lunes lectivo (-3 días)
  const viernesDate = new Date(lunesSiguiente.getTime() - 3 * 86400000);
  const dd = String(viernesDate.getUTCDate()).padStart(2, '0');
  const mm = String(viernesDate.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = viernesDate.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Calcula la fecha de emisión (Viernes) para la semana presente/actual.
 */
export function calcularFechaViernesSemanaActual(
  diasActuales?: DiaProgramacion[],
  anioActivo: number = 2026
): string {
  if (diasActuales && diasActuales.length > 0) {
    const diaViernes =
      diasActuales.find((d) => d.id === 'dia-viernes') ||
      diasActuales[diasActuales.length - 1];
    if (diaViernes) {
      const parsed = parsearDiaYMes(diaViernes.fechaTexto);
      if (parsed) {
        const dd = String(parsed.dia).padStart(2, '0');
        const mm = String(parsed.mesIndex + 1).padStart(2, '0');
        return `${dd}/${mm}/${anioActivo}`;
      }
    }
  }
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const offsetViernes = 5 - (diaSemana === 0 ? 7 : diaSemana);
  const fechaViernes = new Date(hoy.getTime() + offsetViernes * 86400000);
  const dd = String(fechaViernes.getDate()).padStart(2, '0');
  const mm = String(fechaViernes.getMonth() + 1).padStart(2, '0');
  const yyyy = fechaViernes.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
