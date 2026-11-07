import { jsPDF } from 'jspdf';
import { BoletinSemanal } from '../types/notiprofes';
import {
  calcularEstadoCalendarioBoletin,
  obtenerCalendarioOficialBoletin,
} from '../utils/calendarioEscolar2026';

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
