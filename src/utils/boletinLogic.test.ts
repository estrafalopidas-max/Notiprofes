import test from 'node:test';
import assert from 'node:assert/strict';
import { BOLETIN_40_SEED } from '../data/seedNotiprofes40';
import {
  aplicarOperacionBoletin,
  clonarBoletinSiguienteSemana,
  filtrarDiasBoletin,
  generarHtmlPublicoBoletin,
  validarActividadInput,
} from './boletinLogic';
import {
  calcularEstadoCalendarioBoletin,
  formatearRangoSemanaSegunMeses,
  SEMANAS_LECTIVAS_2026,
} from './calendarioEscolar2026';

test('filtrarDiasBoletin filtra actividades por palabra clave, responsable o reprogramación', () => {
  const todos = filtrarDiasBoletin(BOLETIN_40_SEED.dias, {
    busqueda: '',
    diaId: 'todos',
    soloReprogramadas: false,
  });
  assert.equal(todos.length, 5);

  const iso = filtrarDiasBoletin(BOLETIN_40_SEED.dias, {
    busqueda: 'iso 21001',
    diaId: 'todos',
    soloReprogramadas: false,
  });
  assert.equal(iso.length, 2);
  assert.equal(iso[0].id, 'dia-martes');
  assert.equal(iso[1].id, 'dia-viernes');

  const reprogramadas = filtrarDiasBoletin(BOLETIN_40_SEED.dias, {
    busqueda: '',
    diaId: 'todos',
    soloReprogramadas: true,
  });
  assert.equal(reprogramadas.length, 1);
  assert.equal(reprogramadas[0].id, 'dia-viernes');
  assert.equal(reprogramadas[0].actividades.length, 1);
  assert.equal(reprogramadas[0].actividades[0].responsable, 'Lorena Lopera');
});

test('validarActividadInput rechaza campos vacíos y acepta datos completos', () => {
  const invalido = validarActividadInput({
    titulo: 'Re',
    responsable: 'Rector',
    hora: '8:00 am',
    lugar: 'Rectoría',
  });
  assert.equal(invalido.valido, false);

  const valido = validarActividadInput({
    titulo: 'Comisión de Evaluación 3° Periodo',
    responsable: 'Coordinación Académica',
    hora: '10:00 a.m.',
    lugar: 'Sala de Profesores',
  });
  assert.equal(valido.valido, true);
});

test('aplicarOperacionBoletin agrega y actualiza actividades de forma idempotente', () => {
  const nuevaAct = {
    id: 'act-test-99',
    diaId: 'dia-miercoles',
    titulo: 'Simulacro de Evacuación Institucional',
    responsable: 'Comité Escolar de Gestión del Riesgo',
    hora: '9:30 a.m.',
    lugar: 'Patio Central',
  };

  const paso1 = aplicarOperacionBoletin(BOLETIN_40_SEED, {
    tipo: 'agregar_actividad',
    diaId: 'dia-miercoles',
    actividad: nuevaAct,
    autor: 'Diana Patricia Giraldo',
  });

  const miercoles1 = paso1.dias.find((d) => d.id === 'dia-miercoles')!;
  assert.equal(miercoles1.actividades.length, 5);

  const paso2 = aplicarOperacionBoletin(paso1, {
    tipo: 'agregar_actividad',
    diaId: 'dia-miercoles',
    actividad: nuevaAct,
    autor: 'Diana Patricia Giraldo',
  });
  const miercoles2 = paso2.dias.find((d) => d.id === 'dia-miercoles')!;
  assert.equal(miercoles2.actividades.length, 5);
});

test('formatearRangoSemanaSegunMeses formatea 1 mes como "Semana del XX al XX de MM" y 2 meses como "Semana del XX de MM al XX de MM"', () => {
  // Mismo mes (2 al 6 de noviembre)
  const mismoMes = formatearRangoSemanaSegunMeses(BOLETIN_40_SEED.dias);
  assert.equal(mismoMes, 'Semana del 2 al 6 de noviembre');

  // Dos meses distintos (30 de noviembre al 4 de diciembre)
  const dosMeses = formatearRangoSemanaSegunMeses([
    { id: 'd1', fechaTexto: 'LUNES 30 DE NOVIEMBRE', esFestivo: false, actividades: [] },
    { id: 'd5', fechaTexto: 'VIERNES 4 DE DICIEMBRE', esFestivo: false, actividades: [] },
  ]);
  assert.equal(dosMeses, 'Semana del 30 de noviembre al 4 de diciembre');
});

test('calcularEstadoCalendarioBoletin calcula el periodo, ordinal, Semana XX de XX y festivos según la Resolución 2026', () => {
  // Verificar que las 40 semanas lectivas suman exactamente 40
  const totalSemanas = SEMANAS_LECTIVAS_2026.reduce((acc, b) => acc + b.semanas, 0);
  assert.equal(totalSemanas, 40);

  const estado40 = calcularEstadoCalendarioBoletin(BOLETIN_40_SEED);
  assert.equal(estado40.numeroPeriodo, 3);
  assert.equal(estado40.ordinalSup, 'er');
  assert.equal(estado40.semanaActualPeriodo, 11);
  assert.equal(estado40.totalSemanasPeriodo, 14);
  assert.equal(estado40.textoSemanaDePeriodo, 'Semana 11 de 14');
  assert.equal(estado40.semanaLectivaAnual, 36);
  assert.equal(estado40.rangoSemanaFormateado, 'Semana del 2 al 6 de noviembre');
  assert.equal(estado40.festivosSemana.length, 1);
  assert.equal(estado40.festivosSemana[0].nombre, 'Día de Todos los Santos');
});

test('clonarBoletinSiguienteSemana incrementa el número, avanza fechas y detecta festivos de 2026 automáticamente', () => {
  // Clonar de Edición 40 (2 al 6 nov) -> Edición 41 (9 al 13 nov, sin festivos)
  const boletin41 = clonarBoletinSiguienteSemana(BOLETIN_40_SEED, {
    semanaTexto: '',
    fechaEmision: '06/11/2026',
    autor: 'Elsa Ruby Alarcón Montoya',
    conservarActividades: false,
  });

  assert.equal(boletin41.numero, 41);
  assert.equal(boletin41.semanaTexto, 'Semana del 9 al 13 de noviembre');
  assert.equal(boletin41.dias[0].esFestivo, false);

  // Clonar de Edición 41 (9 al 13 nov) -> Edición 42 (16 al 20 nov, Lunes 16 es Festivo Independencia de Cartagena)
  const boletin42 = clonarBoletinSiguienteSemana(boletin41, {
    semanaTexto: '',
    fechaEmision: '13/11/2026',
    autor: 'Elsa Ruby Alarcón Montoya',
    conservarActividades: false,
  });

  assert.equal(boletin42.numero, 42);
  assert.equal(boletin42.semanaTexto, 'Semana del 16 al 20 de noviembre');
  assert.equal(boletin42.dias[0].esFestivo, true);
  assert.ok(boletin42.dias[0].notaHorario?.includes('Independencia de Cartagena'));
});

test('generarHtmlPublicoBoletin produce HTML válido con logo y paleta corporativa I.E. Villa Flora', () => {
  const html = generarHtmlPublicoBoletin(BOLETIN_40_SEED);
  assert.ok(html.includes('/public/assets/aistudio/logo_html_859fb25c.png'));
  assert.ok(html.includes('#007DC5'));
  assert.ok(html.includes('#034EA2'));
  assert.ok(html.includes('#ED145B'));
  assert.ok(html.includes('N° 40'));
  assert.ok(html.includes('NOTI PRÁCTICAS'));
  assert.ok(html.includes('CARLOS ALBERTO MAZO LOAIZA'));
  assert.ok(html.includes('Se reprograma para el martes'));
});
