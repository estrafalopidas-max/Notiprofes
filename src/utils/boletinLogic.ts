import {
  ActividadProgramada,
  BoletinSemanal,
  DiaProgramacion,
  OperacionBoletin,
} from '../types/notiprofes';
import {
  calcularEstadoCalendarioBoletin,
  formatearRangoSemanaSegunMeses,
  generarDiasSiguienteSemanaConFestivos,
  obtenerCalendarioOficialBoletin,
} from './calendarioEscolar2026';

export interface CriteriosFiltroBoletin {
  busqueda: string;
  diaId: string; // 'todos' o id del día
  soloReprogramadas: boolean;
}

/**
 * Filtra los días y actividades de un boletín según texto libre (actividad, responsable, lugar),
 * día específico o estado de reprogramación.
 */
export function filtrarDiasBoletin(
  dias: DiaProgramacion[],
  criterios: CriteriosFiltroBoletin
): DiaProgramacion[] {
  const termino = criterios.busqueda.trim().toLowerCase();

  return dias
    .filter((dia) => criterios.diaId === 'todos' || dia.id === criterios.diaId)
    .map((dia) => {
      if (dia.esFestivo && !termino && !criterios.soloReprogramadas) {
        return dia;
      }

      const actividadesFiltradas = dia.actividades.filter((act) => {
        if (criterios.soloReprogramadas && !act.reprogramada) {
          return false;
        }
        if (!termino) {
          return true;
        }
        const coincideTitulo = act.titulo.toLowerCase().includes(termino);
        const coincideResponsable = act.responsable.toLowerCase().includes(termino);
        const coincideLugar = act.lugar.toLowerCase().includes(termino);
        const coincideHora = act.hora.toLowerCase().includes(termino);
        const coincideNota = (act.notaReprogramacion || '').toLowerCase().includes(termino);
        return (
          coincideTitulo ||
          coincideResponsable ||
          coincideLugar ||
          coincideHora ||
          coincideNota
        );
      });

      return {
        ...dia,
        actividades: actividadesFiltradas,
      };
    })
    .filter((dia) => {
      if (!termino && !criterios.soloReprogramadas) {
        return true;
      }
      return dia.actividades.length > 0;
    });
}

/**
 * Valida que una actividad programada tenga todos los campos obligatorios antes de guardarse.
 */
export function validarActividadInput(datos: {
  titulo: string;
  responsable: string;
  hora: string;
  lugar: string;
}): { valido: boolean; error?: string } {
  if (!datos.titulo || datos.titulo.trim().length < 3) {
    return { valido: false, error: 'La descripción de la actividad debe tener al menos 3 caracteres.' };
  }
  if (!datos.responsable || datos.responsable.trim().length < 2) {
    return { valido: false, error: 'El responsable es obligatorio.' };
  }
  if (!datos.hora || datos.hora.trim().length < 2) {
    return { valido: false, error: 'El horario o rango de hora es obligatorio.' };
  }
  if (!datos.lugar || datos.lugar.trim().length < 2) {
    return { valido: false, error: 'El lugar de realización es obligatorio.' };
  }
  return { valido: true };
}

/**
 * Aplica una operación colaborativa de forma idempotente sobre el estado del boletín.
 */
export function aplicarOperacionBoletin(
  boletin: BoletinSemanal,
  op: OperacionBoletin,
  timestampIso: string = new Date().toISOString()
): BoletinSemanal {
  const baseActualizada: BoletinSemanal = {
    ...boletin,
    ultimaActualizacion: timestampIso,
    actualizadoPor: op.autor,
  };

  let boletinModificado: BoletinSemanal;

  switch (op.tipo) {
    case 'agregar_actividad': {
      boletinModificado = {
        ...baseActualizada,
        dias: baseActualizada.dias.map((dia) => {
          if (dia.id !== op.diaId) return dia;
          if (dia.actividades.some((a) => a.id === op.actividad.id)) {
            return dia;
          }
          return {
            ...dia,
            actividades: [...dia.actividades, { ...op.actividad, actualizadoPor: op.autor }],
          };
        }),
      };
      break;
    }

    case 'actualizar_actividad': {
      boletinModificado = {
        ...baseActualizada,
        dias: baseActualizada.dias.map((dia) => {
          if (dia.id !== op.diaId) return dia;
          return {
            ...dia,
            actividades: dia.actividades.map((a) =>
              a.id === op.actividad.id ? { ...op.actividad, actualizadoPor: op.autor } : a
            ),
          };
        }),
      };
      break;
    }

    case 'eliminar_actividad': {
      boletinModificado = {
        ...baseActualizada,
        dias: baseActualizada.dias.map((dia) => {
          if (dia.id !== op.diaId) return dia;
          return {
            ...dia,
            actividades: dia.actividades.filter((a) => a.id !== op.actividadId),
          };
        }),
      };
      break;
    }

    case 'alternar_festivo_dia': {
      boletinModificado = {
        ...baseActualizada,
        dias: baseActualizada.dias.map((dia) =>
          dia.id === op.diaId
            ? {
                ...dia,
                esFestivo: op.esFestivo,
                notaHorario: op.notaHorario !== undefined ? op.notaHorario : dia.notaHorario,
              }
            : dia
        ),
      };
      break;
    }

    case 'agregar_evento_largo_plazo': {
      if (baseActualizada.proyeccionCalendario.some((e) => e.id === op.evento.id)) {
        return baseActualizada;
      }
      boletinModificado = {
        ...baseActualizada,
        proyeccionCalendario: [...baseActualizada.proyeccionCalendario, op.evento],
      };
      break;
    }

    case 'eliminar_evento_largo_plazo': {
      boletinModificado = {
        ...baseActualizada,
        proyeccionCalendario: baseActualizada.proyeccionCalendario.filter(
          (e) => e.id !== op.eventoId
        ),
      };
      break;
    }

    case 'agregar_felicitacion': {
      if (baseActualizada.felicitaciones.some((f) => f.id === op.felicitacion.id)) {
        return baseActualizada;
      }
      boletinModificado = {
        ...baseActualizada,
        felicitaciones: [...baseActualizada.felicitaciones, op.felicitacion],
      };
      break;
    }

    case 'eliminar_felicitacion': {
      boletinModificado = {
        ...baseActualizada,
        felicitaciones: baseActualizada.felicitaciones.filter((f) => f.id !== op.felicitacionId),
      };
      break;
    }

    case 'agregar_aviso_practica': {
      boletinModificado = {
        ...baseActualizada,
        avisosPracticas: [...baseActualizada.avisosPracticas, op.aviso],
      };
      break;
    }

    case 'eliminar_aviso_practica': {
      boletinModificado = {
        ...baseActualizada,
        avisosPracticas: baseActualizada.avisosPracticas.filter((_, idx) => idx !== op.indice),
      };
      break;
    }

    case 'agregar_suspension': {
      if (baseActualizada.suspensiones.some((s) => s.id === op.suspension.id)) {
        return baseActualizada;
      }
      boletinModificado = {
        ...baseActualizada,
        suspensiones: [...baseActualizada.suspensiones, op.suspension],
      };
      break;
    }

    case 'eliminar_suspension': {
      boletinModificado = {
        ...baseActualizada,
        suspensiones: baseActualizada.suspensiones.filter((s) => s.id !== op.suspensionId),
      };
      break;
    }

    case 'actualizar_horario_apoyo': {
      boletinModificado = {
        ...baseActualizada,
        horariosApoyo: baseActualizada.horariosApoyo.map((h) =>
          h.id === op.horario.id ? op.horario : h
        ),
      };
      break;
    }

    case 'agregar_documento': {
      if (baseActualizada.documentosPermanentes.some((d) => d.id === op.documento.id)) {
        return baseActualizada;
      }
      boletinModificado = {
        ...baseActualizada,
        documentosPermanentes: [...baseActualizada.documentosPermanentes, op.documento],
      };
      break;
    }

    case 'eliminar_documento': {
      boletinModificado = {
        ...baseActualizada,
        documentosPermanentes: baseActualizada.documentosPermanentes.filter(
          (d) => d.id !== op.documentoId
        ),
      };
      break;
    }

    case 'actualizar_encabezado': {
      boletinModificado = {
        ...baseActualizada,
        ...op.datos,
      };
      break;
    }

    case 'actualizar_poliza': {
      boletinModificado = {
        ...baseActualizada,
        polizaEscolarDoc: op.poliza,
      };
      break;
    }

    case 'actualizar_calendario_anual': {
      boletinModificado = {
        ...baseActualizada,
        calendarioOficial: {
          ...op.calendario,
          actualizadoEn: timestampIso,
          actualizadoPor: op.autor,
        },
      };
      break;
    }

    case 'actualizar_drive_pdf': {
      boletinModificado = {
        ...boletin,
        drivePdfInfo: op.drivePdfInfo,
      };
      break;
    }
  }

  const nowStr = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  let seccion = 'General';
  let accion: string = op.tipo;
  let descripcion = `Modificación realizada por ${op.autor}`;

  switch (op.tipo) {
    case 'agregar_actividad':
      seccion = 'Programación Semanal';
      accion = 'Agregar Actividad';
      descripcion = `Se agregó la actividad "${op.actividad.titulo}" (${op.actividad.hora}).`;
      break;
    case 'actualizar_actividad':
      seccion = 'Programación Semanal';
      accion = 'Actualizar / Reprogramar';
      descripcion = `Se actualizó la actividad "${op.actividad.titulo}" (${op.actividad.hora}).`;
      break;
    case 'eliminar_actividad':
      seccion = 'Programación Semanal';
      accion = 'Eliminar Actividad';
      descripcion = `Se eliminó una actividad.`;
      break;
    case 'alternar_festivo_dia':
      seccion = 'Programación Semanal';
      accion = 'Cambiar Estado Festivo';
      descripcion = `Se modificó el estado festivo del día ${op.diaId}.`;
      break;
    case 'agregar_evento_largo_plazo':
      seccion = 'Calendario a Largo Plazo';
      accion = 'Agregar Evento';
      descripcion = `Se agregó el evento: "${op.evento.descripcion}".`;
      break;
    case 'eliminar_evento_largo_plazo':
      seccion = 'Calendario a Largo Plazo';
      accion = 'Eliminar Evento';
      descripcion = `Se eliminó un evento del calendario a largo plazo.`;
      break;
    case 'agregar_felicitacion':
      seccion = 'Noti-Prácticas';
      accion = 'Agregar Felicitación';
      descripcion = `Se agregó mención de honor.`;
      break;
    case 'eliminar_felicitacion':
      seccion = 'Noti-Prácticas';
      accion = 'Eliminar Felicitación';
      descripcion = `Se eliminó una mención de honor.`;
      break;
    case 'agregar_aviso_practica':
      seccion = 'Noti-Prácticas';
      accion = 'Agregar Recomendación';
      descripcion = `Se añadió una directriz general.`;
      break;
    case 'eliminar_aviso_practica':
      seccion = 'Noti-Prácticas';
      accion = 'Eliminar Recomendación';
      descripcion = `Se eliminó una directriz general.`;
      break;
    case 'agregar_suspension':
      seccion = 'Noti-Prácticas (Suspensiones)';
      accion = 'Registrar Suspensión';
      descripcion = `Se registró un nuevo reporte de suspensión.`;
      break;
    case 'eliminar_suspension':
      seccion = 'Noti-Prácticas (Suspensiones)';
      accion = 'Eliminar Suspensión';
      descripcion = `Se eliminó un registro de suspensión.`;
      break;
    case 'actualizar_horario_apoyo':
      seccion = 'Horarios Personal de Apoyo';
      accion = 'Actualizar Horario';
      descripcion = `Se actualizó el horario de apoyo.`;
      break;
    case 'agregar_documento':
      seccion = 'Documentos y Enlaces';
      accion = 'Vincular Documento';
      descripcion = `Se vinculó el documento "${op.documento.titulo}".`;
      break;
    case 'eliminar_documento':
      seccion = 'Documentos y Enlaces';
      accion = 'Eliminar Documento';
      descripcion = `Se eliminó un documento vinculado.`;
      break;
    case 'actualizar_encabezado':
      seccion = 'Encabezado / Configuración';
      accion = 'Actualizar Encabezado';
      descripcion = op.datos.frasePedagogica
        ? `Se actualizó la reflexión pedagógica semanal.`
        : `Se actualizaron datos generales del boletín N° ${op.datos.numero || boletin.numero}.`;
      break;
    case 'actualizar_poliza':
      seccion = 'Documentos y Enlaces';
      accion = 'Actualizar Póliza Escolar';
      descripcion = `Se actualizó la póliza escolar oficial: "${op.poliza.titulo}".`;
      break;
    case 'actualizar_calendario_anual':
      seccion = 'Calendario Académico Oficial';
      accion = `Activar Calendario ${op.calendario.anio}`;
      descripcion = `Se actualizó y activó el Calendario Académico Oficial del año ${op.calendario.anio} (${op.calendario.resolucionTexto}).`;
      break;
    case 'actualizar_drive_pdf':
      seccion = 'Publicación en la Nube (Google Drive PDF)';
      accion =
        op.drivePdfInfo.version > 1
          ? `Sobrescritura PDF (v${op.drivePdfInfo.version})`
          : 'Creación PDF en Google Drive (v1)';
      descripcion = `Se sincronizó el archivo oficial «${op.drivePdfInfo.fileName}» sobre el ID único de Google Drive (${op.drivePdfInfo.fileId}).`;
      break;
  }

  const nuevoRegistro = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowStr,
    usuario: op.autor,
    seccion,
    accion,
    descripcion,
  };

  return {
    ...boletinModificado,
    historialCambios: [nuevoRegistro, ...(boletin.historialCambios || [])],
  };
}

/**
 * Clona un boletín existente para generar la edición de la siguiente semana,
 * conservando documentos institucionales, proyección de calendario a largo plazo,
 * horarios de personal de apoyo y firmas directivas.
 */
export function clonarBoletinSiguienteSemana(
  actual: BoletinSemanal,
  datosNuevaSemana: {
    semanaTexto: string;
    fechaEmision: string;
    descripcionPeriodo?: string;
    autor: string;
    conservarActividades?: boolean;
  }
): BoletinSemanal {
  const nuevoNumero = actual.numero + 1;
  const calendarioActivo = obtenerCalendarioOficialBoletin(actual);
  const { diasNuevos, semanaTextoNuevo } = generarDiasSiguienteSemanaConFestivos(
    actual.dias,
    calendarioActivo
  );
  const textoSemanaFinal = datosNuevaSemana.semanaTexto?.trim()
    ? formatearRangoSemanaSegunMeses([], datosNuevaSemana.semanaTexto)
    : semanaTextoNuevo;

  return {
    ...actual,
    id: `notiprofes-${calendarioActivo.anio}-${nuevoNumero}`,
    numero: nuevoNumero,
    fechaEmision: datosNuevaSemana.fechaEmision,
    semanaTexto: textoSemanaFinal,
    descripcionPeriodo: datosNuevaSemana.descripcionPeriodo || actual.descripcionPeriodo,
    ultimaActualizacion: new Date().toISOString(),
    actualizadoPor: datosNuevaSemana.autor,
    drivePdfInfo: undefined,
    dias: actual.dias.map((dia, index) => {
      const metaDia = diasNuevos[index];
      return {
        ...dia,
        fechaTexto: metaDia ? metaDia.fechaTexto : dia.fechaTexto,
        esFestivo: metaDia ? metaDia.esFestivo : false,
        notaHorario: metaDia ? metaDia.notaHorario : undefined,
        incluirDocumentosBase: index === 0,
        actividades: datosNuevaSemana.conservarActividades
          ? dia.actividades.map((a) => ({
              ...a,
              id: `${a.id}-n${nuevoNumero}`,
              reprogramada: false,
              notaReprogramacion: undefined,
            }))
          : [],
      };
    }),
  };
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Calcula las iniciales de 2 letras a partir del nombre del responsable o dependencia.
 */
export function obtenerInicialesResponsable(responsable: string): string {
  const limpio = responsable
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1 && !['de', 'del', 'la', 'las', 'el', 'los', 'y', 'a'].includes(p.toLowerCase()));

  if (limpio.length === 0) return 'VF';
  if (limpio.length === 1) return limpio[0].slice(0, 2).toUpperCase();
  return `${limpio[0][0]}${limpio[1][0]}`.toUpperCase();
}

/**
 * Genera un documento HTML público autónomo, corporativo y auto-actualizable
 * con el logo oficial, la paleta cromática de la I.E. Villa Flora (#007DC5, #034EA2, #ED145B, #231F20, #939598)
 * y la jerarquía tipográfica Outfit + Plus Jakarta Sans + IBM Plex Mono.
 */
export function generarHtmlPublicoBoletin(boletin: BoletinSemanal): string {
  const rutaLogoOficial = '/public/assets/aistudio/logo_html_859fb25c.png';

  const totalActividades = boletin.dias.reduce((acc, d) => acc + d.actividades.length, 0);
  const totalReprogramadas = boletin.dias.reduce(
    (acc, d) => acc + d.actividades.filter((a) => a.reprogramada).length,
    0
  );
  const maxActividadesDia = Math.max(1, ...boletin.dias.map((d) => d.actividades.length));

  const barrasDiasHtml = boletin.dias
    .map((dia) => {
      const nombreCorto = dia.fechaTexto.split(' ')[0];
      const cant = dia.actividades.length;
      const porcentaje = dia.esFestivo
        ? 100
        : Math.max(14, Math.round((cant / maxActividadesDia) * 100));
      const claseBarra = dia.esFestivo
        ? 'barra-fill festivo'
        : cant >= 3
          ? 'barra-fill alta'
          : 'barra-fill normal';

      return `
      <div class="dia-stat">
        <div class="dia-stat-top">
          <span class="dia-stat-name">${escaparHtml(nombreCorto)}</span>
          <span class="dia-stat-count">${dia.esFestivo ? 'FESTIVO' : `${cant} act.`}</span>
        </div>
        <div class="barra-track">
          <div class="${claseBarra}" style="width: ${porcentaje}%"></div>
        </div>
      </div>`;
    })
    .join('');

  const tarjetasDocsHtml = boletin.documentosPermanentes
    .map((doc) => {
      const esLink = doc.tipo === 'link';
      const ext = esLink ? 'LINK' : doc.tipo.toUpperCase();
      const colorBadge =
        doc.tipo === 'xlsx'
          ? '#059669'
          : doc.tipo === 'pdf'
            ? '#ED145B'
            : doc.tipo === 'link'
              ? '#007DC5'
              : '#034EA2';
      const labelPie = esLink ? 'Enlace web / URL' : 'Archivo institucional';
      return `
      <a class="doc-card" href="${escaparHtml(doc.url)}" target="_blank" rel="noopener noreferrer">
        <div class="doc-card-head">
          <span class="doc-cat">${escaparHtml(doc.categoria)}</span>
          <span class="doc-badge" style="background: ${colorBadge}15; color: ${colorBadge}; border: 1px solid ${colorBadge}40;">${escaparHtml(ext)}</span>
        </div>
        <div class="doc-title">${escaparHtml(doc.titulo)}</div>
        <div class="doc-footer">
          <span>${labelPie}</span>
          <span class="doc-cta">Abrir recurso →</span>
        </div>
      </a>`;
    })
    .join('');

  const tarjetasDiasGraficasHtml = boletin.dias
    .map((dia) => {
      if (dia.esFestivo && dia.actividades.length === 0) {
        return `
        <div class="day-card festivo-card">
          <div class="day-card-header">
            <div class="day-title-wrap">
              <span class="day-pill-festivo">JORNADA FESTIVA</span>
              <h4>${escaparHtml(dia.fechaTexto)}</h4>
            </div>
            <span class="day-meta">${escaparHtml(dia.notaHorario || 'DÍA FESTIVO')}</span>
          </div>
          <div class="day-empty">
            Día festivo oficial — Sin actividades académicas presenciales programadas.
          </div>
        </div>`;
      }

      const itemsActHtml =
        dia.actividades.length === 0
          ? `<div class="day-empty">Sin actividades extraordinarias registradas para esta jornada.</div>`
          : `<div class="timeline-list">
              ${dia.actividades
                .map(
                  (act) => `
                <div class="timeline-item ${act.reprogramada ? 'reprogramado' : ''}">
                  <div class="timeline-time">
                    <span class="time-chip">${escaparHtml(act.hora)}</span>
                  </div>
                  <div class="timeline-content">
                    <div class="act-titulo">${escaparHtml(act.titulo)}</div>
                    ${
                      act.reprogramada && act.notaReprogramacion
                        ? `<div class="marca-reprogramada"><span style="margin-right: 4px;">⚠️</span>${escaparHtml(act.notaReprogramacion)}</div>`
                        : ''
                    }
                    <div class="act-meta-row">
                      <span><strong>Responsable:</strong> ${escaparHtml(act.responsable)}</span>
                      <span class="sep">·</span>
                      <span><strong>Lugar:</strong> ${escaparHtml(act.lugar)}</span>
                    </div>
                  </div>
                </div>`
                )
                .join('')}
            </div>`;

      return `
      <div class="day-card">
        <div class="day-card-header">
          <div class="day-title-wrap">
            <span class="day-count-badge">${dia.actividades.length}</span>
            <h4>${escaparHtml(dia.fechaTexto)}</h4>
            ${dia.notaHorario ? `<span class="day-horario-tag">${escaparHtml(dia.notaHorario)}</span>` : ''}
          </div>
          <span class="day-meta">${dia.actividades.length} actividad(es)</span>
        </div>
        ${itemsActHtml}
      </div>`;
    })
    .join('\n');

  const filasDiasTablaHtml = boletin.dias
    .map((dia) => {
      if (dia.esFestivo && dia.actividades.length === 0) {
        return `
        <tr class="fila-festivo">
          <td class="col-fecha">
            <div class="dia-nombre">${escaparHtml(dia.fechaTexto)}</div>
          </td>
          <td colspan="4" class="col-festivo">
            <strong>${escaparHtml(dia.notaHorario || 'DÍA FESTIVO')}</strong>
          </td>
        </tr>`;
      }

      if (dia.actividades.length === 0) {
        return `
        <tr>
          <td class="col-fecha">
            <div class="dia-nombre">${escaparHtml(dia.fechaTexto)}</div>
            ${dia.notaHorario ? `<div class="dia-nota">${escaparHtml(dia.notaHorario)}</div>` : ''}
          </td>
          <td class="col-act"><em>Sin actividades adicionales registradas</em></td>
          <td class="col-resp">-</td>
          <td class="col-hora">-</td>
          <td class="col-lugar">-</td>
        </tr>`;
      }

      return dia.actividades
        .map((act: ActividadProgramada, idx: number) => {
          const celdaFecha =
            idx === 0
              ? `<td class="col-fecha" rowspan="${dia.actividades.length}">
                  <div class="dia-nombre">${escaparHtml(dia.fechaTexto)}</div>
                  ${
                    dia.notaHorario
                      ? `<div class="dia-nota">${escaparHtml(dia.notaHorario)}</div>`
                      : ''
                  }
                </td>`
              : '';

          const badgeReprogramada =
            act.reprogramada && act.notaReprogramacion
              ? `<div class="marca-reprogramada"><span style="margin-right: 4px;">⚠️</span>${escaparHtml(act.notaReprogramacion)}</div>`
              : '';

          return `
          <tr class="${act.reprogramada ? 'fila-reprogramada' : ''}">
            ${celdaFecha}
            <td class="col-act">
              <div class="act-titulo">${escaparHtml(act.titulo)}</div>
              ${badgeReprogramada}
            </td>
            <td class="col-resp">${escaparHtml(act.responsable)}</td>
            <td class="col-hora">${escaparHtml(act.hora)}</td>
            <td class="col-lugar">${escaparHtml(act.lugar)}</td>
          </tr>`;
        })
        .join('\n');
    })
    .join('\n');

  const finalizacionItems = boletin.proyeccionCalendario.filter(
    (e) => e.categoria === 'finalizacion'
  );
  const proximasItems = boletin.proyeccionCalendario.filter(
    (e) => e.categoria !== 'finalizacion'
  );
  const estadoCalendario = calcularEstadoCalendarioBoletin(boletin);
  const calendarioActivo = obtenerCalendarioOficialBoletin(boletin);
  const regexAnioLimpiar = new RegExp(`\\s+de\\s+${calendarioActivo.anio}`, 'gi');

  const renderBloquesCalendarioHtml = (
    bloques: typeof calendarioActivo.semanasLectivas,
    colorTexto: string
  ) =>
    bloques
      .map(
        (b) => `
        <div class="cal-item">
          <span>${escaparHtml(b.desdeTexto.replace(regexAnioLimpiar, ''))} al ${escaparHtml(
            b.hastaTexto.replace(regexAnioLimpiar, '')
          )}</span>
          <strong style="color: ${colorTexto}; flex-shrink: 0;">${b.semanas} sem.</strong>
        </div>`
      )
      .join('');

  const festivosGridHtml = calendarioActivo.festivos.map((fest) => {
    const esDeEstaSemana = estadoCalendario.festivosSemana.some(
      (f) => f.fecha === fest.fecha
    );
    return `
      <div class="festivo-card ${esDeEstaSemana ? 'festivo-activo' : ''}">
        <div class="festivo-top">
          <span class="festivo-dia">${escaparHtml(fest.diaSemana.slice(0, 3))} ${escaparHtml(
            fest.diaMesTexto
          )}</span>
          ${esDeEstaSemana ? '<span class="festivo-tag-hoy">Esta sem.</span>' : ''}
        </div>
        <div class="festivo-nombre">${escaparHtml(fest.nombre)}</div>
      </div>`;
  }).join('');

  const seccionSuspensionesHtml =
    boletin.mostrarSuspensionesPublico && boletin.suspensiones.length > 0
      ? `
      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">Control de Próximas Suspensiones</h3>
          <span class="sec-counter">${boletin.suspensiones.length} estudiante(s)</span>
        </div>
        <table class="tabla-moderna">
          <thead>
            <tr>
              <th style="width: 15%">Grado</th>
              <th style="width: 50%">Nombres y apellidos</th>
              <th style="width: 35%">Fecha de suspensión</th>
            </tr>
          </thead>
          <tbody>
            ${boletin.suspensiones
              .map(
                (s) => `
              <tr>
                <td class="mono"><strong>${escaparHtml(s.grado)}</strong></td>
                <td>${escaparHtml(s.estudiante)}</td>
                <td class="mono">${escaparHtml(s.fechaSuspension)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="60" />
  <title>NOTIPROFES N° ${boletin.numero} - I.E. Villa Flora</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --vf-blue-bright: #007DC5;
      --vf-blue-deep: #034EA2;
      --vf-magenta: #ED145B;
      --vf-dark: #0F172A;
      --vf-gray: #939598;
      --font-sans: 'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--font-sans);
      color: var(--vf-dark);
      background: #EEF3F9;
      margin: 0;
      padding: 24px 16px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .contenedor {
      max-width: 1120px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #dbe4f0;
      box-shadow: 0 16px 40px -12px rgba(3, 78, 162, 0.12);
      overflow: hidden;
    }
    .franja-corporativa {
      height: 6px;
      background: linear-gradient(90deg, #034EA2 0%, #007DC5 65%, #ED145B 100%);
    }
    .barra-superior {
      background: var(--vf-dark);
      color: #f8fafc;
      padding: 12px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
    }
    .acciones-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-modo {
      background: rgba(255,255,255,0.1);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      padding: 6px 12px;
      font-family: var(--font-sans);
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-modo.activo {
      background: var(--vf-blue-bright);
      border-color: var(--vf-blue-bright);
    }
    .btn-imprimir {
      background: var(--vf-magenta);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 7px 14px;
      font-family: var(--font-sans);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .hero-institucional {
      background: linear-gradient(135deg, #022c5e 0%, #034EA2 52%, #007DC5 100%);
      color: #ffffff;
      padding: 18px 28px;
    }
    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .logo-card {
      background: transparent;
      padding: 0;
      border-radius: 0;
      display: inline-flex;
      align-items: center;
      box-shadow: none;
    }
    .logo-card img {
      height: 88px;
      width: auto;
      max-width: 100%;
      display: block;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25));
    }
    .meta-edicion {
      text-align: right;
      font-family: var(--font-sans);
      font-variant-numeric: tabular-nums;
      font-size: 12px;
      font-weight: 500;
      color: #e0f2fe;
    }
    .badge-edicion {
      display: inline-block;
      background: var(--vf-magenta);
      color: #ffffff;
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 20px;
      padding: 6px 18px;
      border-radius: 8px;
      margin-bottom: 6px;
      letter-spacing: 0.03em;
      box-shadow: 0 4px 12px rgba(237, 20, 91, 0.35);
    }
    .hero-grid {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.18);
      display: grid;
      grid-template-columns: 2.1fr 1fr;
      gap: 16px;
      align-items: center;
    }
    @media (max-width: 820px) {
      .hero-grid { grid-template-columns: 1fr; }
    }
    .hero-semana, .cita-box, .cita-texto, .cita-autor {
      overflow-wrap: break-word;
      word-break: break-word;
      max-width: 100%;
    }
    .hero-semana h1 {
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 800;
      margin: 0 0 4px 0;
      line-height: 1.25;
      letter-spacing: -0.015em;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    @media (min-width: 640px) {
      .hero-semana h1 {
        font-size: 22px;
        white-space: nowrap;
      }
    }
    .cita-box {
      background: transparent;
      border: none;
      padding: 4px 8px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
    }
    .cita-bg-quote-open {
      position: absolute;
      top: -18px;
      left: -4px;
      font-size: 58px;
      font-family: 'Arial Black', sans-serif;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.15);
      line-height: 1;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }
    .cita-bg-quote-close {
      position: absolute;
      bottom: -18px;
      right: -2px;
      font-size: 58px;
      font-family: 'Arial Black', sans-serif;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.15);
      line-height: 1;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }
    .cita-kicker {
      font-family: var(--font-sans);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #bae6fd;
      margin-bottom: 3px;
      position: relative;
      z-index: 1;
    }
    .cita-texto {
      font-size: 11px;
      font-style: italic;
      color: rgba(255, 255, 255, 0.95);
      line-height: 1.35;
      position: relative;
      z-index: 1;
      padding: 0 4px;
    }
    .cita-autor {
      margin-top: 4px;
      font-size: 10.5px;
      font-weight: 700;
      color: #e0f2fe;
      text-align: right;
      position: relative;
      z-index: 1;
    }
    .kpi-ribbon {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 20px 36px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .kpi-label {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 600;
    }
    .kpi-val {
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      font-variant-numeric: tabular-nums;
      font-size: 24px;
      font-weight: 800;
      color: var(--vf-blue-deep);
      margin-top: 2px;
    }
    .kpi-val.magenta { color: var(--vf-magenta); }
    .carga-semanal-box {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 36px;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
    }
    @media (max-width: 720px) {
      .carga-semanal-box { grid-template-columns: repeat(2, 1fr); }
    }
    .dia-stat {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .dia-stat-top {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .dia-stat-name { color: var(--vf-dark); }
    .dia-stat-count { font-family: var(--font-sans); font-variant-numeric: tabular-nums; font-weight: 700; color: var(--vf-blue-bright); }
    .barra-track {
      height: 6px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .barra-fill { height: 100%; border-radius: 999px; }
    .barra-fill.normal { background: var(--vf-blue-bright); }
    .barra-fill.alta { background: var(--vf-blue-deep); }
    .barra-fill.festivo { background: var(--vf-magenta); }
    .cuerpo {
      padding: 32px 36px;
    }
    .seccion-bloque {
      margin-bottom: 36px;
    }
    .sec-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .subtitulo-seccion {
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.01em;
      color: var(--vf-blue-deep);
      margin: 0;
    }
    .sec-counter {
      font-family: var(--font-sans);
      font-variant-numeric: tabular-nums;
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }
    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(235px, 1fr));
      gap: 12px;
    }
    .doc-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 14px 16px;
      background: #ffffff;
      border: 1px solid #dbe4f0;
      border-radius: 10px;
      text-decoration: none;
      color: var(--vf-dark);
      transition: border-color 0.15s ease, transform 0.15s ease;
    }
    .doc-card:hover {
      border-color: var(--vf-blue-bright);
      transform: translateY(-1px);
    }
    .doc-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .doc-cat { font-size: 11px; color: #64748b; font-weight: 600; }
    .doc-badge {
      font-family: var(--font-sans);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .doc-title { font-size: 13.5px; font-weight: 700; color: var(--vf-dark); margin-bottom: 10px; }
    .doc-footer {
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
    }
    .doc-cta { color: var(--vf-blue-bright); font-weight: 700; }
    .days-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .day-card {
      border: 1px solid #dbe4f0;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
    }
    .day-card-header {
      background: #f8fafc;
      padding: 12px 18px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .day-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .day-title-wrap h4 {
      margin: 0;
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: var(--vf-dark);
      text-transform: uppercase;
    }
    .day-count-badge {
      background: var(--vf-blue-deep);
      color: #ffffff;
      font-family: var(--font-sans);
      font-variant-numeric: tabular-nums;
      font-size: 11.5px;
      font-weight: 700;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .day-pill-festivo {
      background: var(--vf-magenta);
      color: #ffffff;
      font-family: var(--font-sans);
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .day-horario-tag {
      color: var(--vf-blue-bright);
      font-size: 12px;
      font-weight: 700;
    }
    .day-meta {
      font-family: var(--font-sans);
      font-variant-numeric: tabular-nums;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }
    .day-empty {
      padding: 18px;
      font-size: 13px;
      color: #64748b;
      font-style: italic;
    }
    .timeline-item {
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 16px;
      align-items: start;
      background: #ffffff;
    }
    .timeline-item:nth-child(even) {
      background: #f8fafc;
    }
    .timeline-item:last-child { border-bottom: none; }
    @media (max-width: 640px) {
      .timeline-item { grid-template-columns: 1fr; gap: 6px; }
    }
    .time-chip {
      display: inline-block;
      font-family: var(--font-sans);
      font-variant-numeric: tabular-nums;
      font-size: 12px;
      font-weight: 600;
      color: var(--vf-blue-deep);
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .act-meta-row {
      margin-top: 6px;
      font-size: 12px;
      color: #475569;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sep { color: #cbd5e1; }
    .tabla-moderna {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      border: 1px solid #cbd5e1;
    }
    .tabla-moderna th {
      background: #f8fafc;
      color: var(--vf-blue-deep);
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      font-weight: 700;
      text-align: left;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .tabla-moderna td {
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
      background: #ffffff;
    }
    .tabla-moderna tbody tr:nth-child(even) td:not(.col-fecha) {
      background: #f8fafc;
    }
    .col-fecha { width: 17%; background: #f8fafc; }
    .dia-nombre { font-weight: 700; color: var(--vf-dark); font-size: 12.5px; }
    .dia-nota { font-size: 11px; color: var(--vf-blue-bright); font-weight: 700; margin-top: 4px; }
    .col-act { width: 41%; }
    .act-titulo { font-weight: 700; color: var(--vf-dark); font-size: 13.5px; line-height: 1.35; }
    .col-resp { width: 18%; color: #334155; font-weight: 500; }
    .col-hora { width: 12%; font-family: var(--font-sans); font-variant-numeric: tabular-nums; font-size: 12.5px; font-weight: 600; color: var(--vf-dark); }
    .col-lugar { width: 12%; color: #64748b; font-weight: 500; }
    .fila-festivo td { background: #fff1f2; color: var(--vf-magenta); }
    .timeline-item.reprogramado {
      background: #fffbeb !important;
      border-left: 5px solid #d97706 !important;
    }
    .marca-reprogramada {
      display: inline-block;
      margin-top: 5px;
      background: #fef3c7;
      color: #78350f;
      border: 1px solid #fde68a;
      font-weight: 700;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 5px;
    }
    .fila-reprogramada td:not(.col-fecha) {
      background: #fffbeb !important;
    }
    .fila-reprogramada td.col-act {
      border-left: 4px solid #d97706 !important;
    }
    .banner-notipracticas {
      background: linear-gradient(90deg, #034EA2 0%, #007DC5 100%);
      color: #ffffff;
      padding: 16px 24px;
      border-radius: 10px;
      margin: 32px 0 20px;
      font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.05em;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-transform: uppercase;
    }
    .fel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .fel-card {
      background: #f8fafc;
      border: 1px solid #dbe4f0;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .fel-name { font-weight: 800; color: var(--vf-blue-deep); font-size: 13.5px; margin-bottom: 4px; }
    .fel-desc { font-size: 12.5px; color: #334155; }
    .pasos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin: 12px 0;
    }
    .paso-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12.5px;
      font-weight: 600;
    }
    .paso-num {
      background: var(--vf-magenta);
      color: #ffffff;
      font-family: var(--font-sans);
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      width: 26px;
      height: 26px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .lista-items {
      margin: 0;
      padding-left: 20px;
      font-size: 13.5px;
    }
    .lista-items li { margin-bottom: 6px; }
    .mono { font-family: var(--font-sans); font-variant-numeric: tabular-nums; font-weight: 500; }
    .firmas-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 44px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12.5px;
    }
    .oculto { display: none !important; }
    .calendario-details {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 28px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
    }
    .calendario-summary {
      list-style: none;
      cursor: pointer;
      padding: 16px 20px;
      background: linear-gradient(90deg, #f8fafc 0%, #f0f9ff 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      user-select: none;
      border-bottom: 1px solid transparent;
      transition: background 0.15s ease;
    }
    .calendario-summary::-webkit-details-marker { display: none; }
    .calendario-details[open] .calendario-summary {
      border-bottom-color: #dbe4f0;
    }
    .calendario-summary:hover {
      background: linear-gradient(90deg, #f1f5f9 0%, #e0f2fe 100%);
    }
    .cal-summary-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cal-bar-accent {
      width: 6px;
      height: 28px;
      border-radius: 999px;
      background: var(--vf-blue-bright);
      flex-shrink: 0;
    }
    .cal-summary-sub {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 2px;
      font-weight: 500;
    }
    .cal-summary-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cal-periodo-badge {
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      color: var(--vf-blue-deep);
      font-size: 11px;
      font-weight: 800;
      padding: 5px 11px;
      border-radius: 8px;
      letter-spacing: 0.02em;
    }
    .cal-toggle-pill {
      background: var(--vf-blue-bright);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .calendario-details[open] .cal-toggle-text-closed { display: none; }
    .calendario-details:not([open]) .cal-toggle-text-open { display: none; }
    .calendario-body {
      padding: 20px;
      display: grid;
      grid-template-columns: 7fr 5fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .calendario-body { grid-template-columns: 1fr; }
    }
    .cal-articulos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      align-content: start;
    }
    @media (max-width: 600px) {
      .cal-articulos-grid { grid-template-columns: 1fr; }
    }
    .cal-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
    }
    .cal-box-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .cal-box-title {
      font-family: 'Outfit', sans-serif;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      color: var(--vf-blue-deep);
      margin: 0;
    }
    .cal-badge {
      font-size: 10px;
      font-weight: 800;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 5px;
    }
    .cal-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 7px 10px;
      font-size: 11.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      color: #334155;
      font-weight: 500;
    }
    .cal-item:last-child { margin-bottom: 0; }
    .festivos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 7px;
    }
    @media (max-width: 520px) {
      .festivos-grid { grid-template-columns: 1fr; }
    }
    .festivo-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 7px 10px;
      font-size: 11px;
    }
    .festivo-card.festivo-activo {
      background: #fff1f2;
      border-color: var(--vf-magenta);
    }
    .festivo-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
      font-weight: 800;
      color: var(--vf-blue-deep);
    }
    .festivo-card.festivo-activo .festivo-top {
      color: var(--vf-magenta);
    }
    .festivo-tag-hoy {
      background: var(--vf-magenta);
      color: #ffffff;
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .festivo-nombre {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .barra-superior { display: none; }
      .contenedor { box-shadow: none; border: none; }
    }
  </style>
</head>
<body>
  <div class="contenedor">
    <div class="franja-corporativa"></div>

    <div class="hero-institucional">
      <div class="hero-top">
        <div class="logo-card">
          <img src="${rutaLogoOficial}" alt="Institución Educativa Villa Flora" />
        </div>
        <div class="meta-edicion">
          <div class="badge-edicion">NOTIPROFES N° ${boletin.numero}</div>
          <div>FECHA DE EMISIÓN: <strong>${escaparHtml(boletin.fechaEmision)}</strong></div>
          <div>DE: ${escaparHtml(boletin.remitente)} · PARA: ${escaparHtml(boletin.destinatarios)}</div>
          <div class="acciones-top" style="margin-top: 10px; justify-content: flex-end;">
            <button id="btn-vista-grafica" class="btn-modo activo" onclick="cambiarVista('grafica')">Vista Gráfica</button>
            <button id="btn-vista-tabla" class="btn-modo" onclick="cambiarVista('tabla')">Vista Tabla</button>
            <button class="btn-imprimir" onclick="window.print()">Imprimir</button>
            <button class="btn-imprimir" style="background: var(--vf-blue-deep);" onclick="window.print()">Guardar PDF</button>
          </div>
        </div>
      </div>

      <div class="hero-grid">
        <div class="hero-semana">
          <h1>${escaparHtml(boletin.semanaTexto)}</h1>
          <div style="font-size: 13.5px; color: #e0f2fe; line-height: 1.4;">
            <div>${escaparHtml(boletin.descripcionPeriodo)}</div>
            <div style="margin-top: 2px;">${escaparHtml(boletin.subtituloPeriodo.replace(/\.?$/, '.'))}</div>
          </div>
        </div>

        <div class="cita-box">
          <span class="cita-bg-quote-open">&ldquo;</span>
          <span class="cita-bg-quote-close">&rdquo;</span>
          <div class="cita-kicker">Reflexión Pedagógica</div>
          <div class="cita-texto">${escaparHtml(boletin.frasePedagogica)}</div>
          <div class="cita-autor">— ${escaparHtml(boletin.autorFrase)}</div>
        </div>
      </div>
    </div>

    <div class="kpi-ribbon">
      <div class="kpi-card">
        <div>
          <div class="kpi-label">Actividades de la Semana</div>
          <div class="kpi-val">${totalActividades}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div>
          <div class="kpi-label">Documentos y Horarios</div>
          <div class="kpi-val">${boletin.documentosPermanentes.length}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div>
          <div class="kpi-label">Hitos a Largo Plazo</div>
          <div class="kpi-val">${boletin.proyeccionCalendario.length}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div>
          <div class="kpi-label">Reprogramaciones Activas</div>
          <div class="kpi-val magenta">${totalReprogramadas}</div>
        </div>
      </div>
    </div>

    <div class="carga-semanal-box">
      ${barrasDiasHtml}
    </div>

    <div class="cuerpo">
      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">Documentos, Resoluciones y Horarios de la Semana</h3>
          <span class="sec-counter">${boletin.documentosPermanentes.length} archivos oficiales</span>
        </div>
        <div class="docs-grid">
          ${tarjetasDocsHtml}
        </div>
      </div>

      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">Programación de Actividades de la Semana</h3>
          <span class="sec-counter">${totalActividades} actividades programadas</span>
        </div>

        <div id="contenedor-vista-grafica" class="days-grid">
          ${tarjetasDiasGraficasHtml}
        </div>

        <div id="contenedor-vista-tabla" class="oculto">
          <table class="tabla-moderna">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>ACTIVIDADES</th>
                <th>RESPONSABLE</th>
                <th>HORA</th>
                <th>LUGAR</th>
              </tr>
            </thead>
            <tbody>
              ${filasDiasTablaHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">PROYECCIÓN DE CALENDARIO DE FINALIZACIÓN</h3>
          <span class="sec-counter">${finalizacionItems.length} hitos institucionales</span>
        </div>
        <ul class="lista-items">
          ${finalizacionItems
            .map(
              (item) =>
                `<li><strong>${escaparHtml(item.fechaTexto)}:</strong> ${escaparHtml(
                  item.descripcion
                )}</li>`
            )
            .join('')}
        </ul>
      </div>

      <div class="banner-notipracticas">
        <span>NOTI PRÁCTICAS · RECONOCIMIENTOS Y CONVIVENCIA</span>
      </div>

      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">Felicitaciones y Reconocimientos Docentes</h3>
          <span class="sec-counter">${boletin.felicitaciones.length} menciones de honor</span>
        </div>
        <div class="fel-grid">
          ${boletin.felicitaciones
            .map(
              (f) => `
            <div class="fel-card">
              <div class="fel-name">★ ${escaparHtml(f.docentes)}</div>
              <div class="fel-desc">${escaparHtml(f.motivo)}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>

      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">Directrices Institucionales y Zonas de Acompañamiento</h3>
        </div>
        <ul class="lista-items">
          ${boletin.avisosPracticas.map((aviso) => `<li>${escaparHtml(aviso)}</li>`).join('')}
          ${boletin.zonasAcompanamientoNotas
            .map((nota) => `<li><strong>Zona de acompañamiento:</strong> ${escaparHtml(nota)}</li>`)
            .join('')}
        </ul>
        <div style="margin-top: 18px; padding: 18px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px;">
          <strong style="color: #034EA2;">Ruta obligatoria de atención ante dificultades de salud o lesión escolar:</strong>
          <div class="pasos-grid">
            ${boletin.pasosAccidenteEscolar
              .map(
                (paso, i) => `
              <div class="paso-card">
                <span class="paso-num">${i + 1}</span>
                <span>${escaparHtml(paso.replace(/^\d+\.\s*/, ''))}</span>
              </div>`
              )
              .join('')}
          </div>
          <div style="margin-top: 8px;"><strong>Póliza escolar oficial:</strong> <a style="color: #007DC5; font-weight: 700;" href="${escaparHtml(
            boletin.polizaEscolarDoc.url
          )}" target="_blank" rel="noopener noreferrer">${escaparHtml(
            boletin.polizaEscolarDoc.titulo
          )} →</a></div>
        </div>
      </div>

      ${seccionSuspensionesHtml}

      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">Próximas Actividades y Capacitaciones</h3>
          <span class="sec-counter">${proximasItems.length} eventos</span>
        </div>
        <ul class="lista-items">
          ${proximasItems
            .map(
              (item) =>
                `<li><strong>${escaparHtml(item.fechaTexto)}:</strong> ${escaparHtml(
                  item.descripcion
                )}</li>`
            )
            .join('')}
        </ul>
      </div>

      <details class="calendario-details">
        <summary class="calendario-summary">
          <div class="cal-summary-left">
            <div class="cal-bar-accent"></div>
            <div>
              <h3 class="subtitulo-seccion" style="margin: 0;">Calendario Académico Oficial ${calendarioActivo.anio} (Medellín) y Festivos del Año</h3>
              <div class="cal-summary-sub">${escaparHtml(calendarioActivo.resolucionTexto)}</div>
            </div>
          </div>
          <div class="cal-summary-right">
            <span class="cal-periodo-badge">${estadoCalendario.numeroPeriodo}<sup>${escaparHtml(
              estadoCalendario.ordinalSup
            )}</sup> PERIODO · ${escaparHtml(estadoCalendario.textoSemanaDePeriodo)}</span>
            <span class="cal-toggle-pill">
              <span class="cal-toggle-text-closed">▼ Desplegar Calendario</span>
              <span class="cal-toggle-text-open">▲ Ocultar Calendario</span>
            </span>
          </div>
        </summary>
        <div class="calendario-body">
          <div class="cal-articulos-grid">
            <div class="cal-box">
              <div class="cal-box-head">
                <h4 class="cal-box-title">Art. 2 · Semanas Lectivas</h4>
                <span class="cal-badge" style="background: #034EA2;">${calendarioActivo.semanasLectivas.reduce((acc, b) => acc + b.semanas, 0)} semanas</span>
              </div>
              ${renderBloquesCalendarioHtml(calendarioActivo.semanasLectivas, '#007DC5')}
            </div>

            <div class="cal-box">
              <div class="cal-box-head">
                <h4 class="cal-box-title">Art. 3 · Desarrollo Inst.</h4>
                <span class="cal-badge" style="background: #007DC5;">${calendarioActivo.semanasDesarrollo.reduce((acc, b) => acc + b.semanas, 0)} semanas</span>
              </div>
              ${renderBloquesCalendarioHtml(calendarioActivo.semanasDesarrollo, '#034EA2')}
            </div>

            <div class="cal-box">
              <div class="cal-box-head">
                <h4 class="cal-box-title">Art. 4 · Vacaciones Docentes</h4>
                <span class="cal-badge" style="background: #334155;">${calendarioActivo.vacacionesDocentes.reduce((acc, b) => acc + b.semanas, 0)} semanas</span>
              </div>
              ${renderBloquesCalendarioHtml(calendarioActivo.vacacionesDocentes, '#334155')}
            </div>

            <div class="cal-box">
              <div class="cal-box-head">
                <h4 class="cal-box-title">Art. 5 · Receso Estudiantil</h4>
                <span class="cal-badge" style="background: #047857;">${calendarioActivo.recesoEstudiantil.reduce((acc, b) => acc + b.semanas, 0)} semanas</span>
              </div>
              ${renderBloquesCalendarioHtml(calendarioActivo.recesoEstudiantil, '#047857')}
            </div>
          </div>

          <div class="cal-box">
            <div class="cal-box-head">
              <h4 class="cal-box-title">Festivos Oficiales de Colombia · Año ${calendarioActivo.anio}</h4>
              <span class="cal-badge" style="background: #ED145B;">${calendarioActivo.festivos.length} festivos</span>
            </div>
            <div class="festivos-grid">
              ${festivosGridHtml}
            </div>
          </div>
        </div>
      </details>

      <div class="seccion-bloque">
        <div class="sec-head">
          <h3 class="subtitulo-seccion">Horarios del Personal de Apoyo, Auxiliares y Seguridad</h3>
          <span class="sec-counter">Lunes a Viernes</span>
        </div>
        <table class="tabla-moderna">
          <thead>
            <tr>
              <th>Funcionario / Rol</th>
              <th>Lunes</th>
              <th>Martes</th>
              <th>Miércoles</th>
              <th>Jueves</th>
              <th>Viernes</th>
            </tr>
          </thead>
          <tbody>
            ${boletin.horariosApoyo
              .map(
                (h) => `
              <tr>
                <td><strong style="color: #034EA2;">${escaparHtml(h.rol)}</strong><br/>${escaparHtml(h.nombre)}</td>
                <td class="mono">${escaparHtml(h.lunes)}</td>
                <td class="mono">${escaparHtml(h.martes)}</td>
                <td class="mono">${escaparHtml(h.miercoles)}</td>
                <td class="mono">${escaparHtml(h.jueves)}</td>
                <td class="mono">${escaparHtml(h.viernes)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="firmas-grid">
        ${boletin.firmas
          .map(
            (f) => `
          <div>
            <div style="font-weight: 800; color: #034EA2; font-family: 'Outfit', sans-serif;">${escaparHtml(f.nombre)}</div>
            <div style="color: #64748b; font-weight: 600; font-size: 11.5px; margin-top: 2px;">${escaparHtml(
              f.cargo
            )}</div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  </div>
  <script>
    function cambiarVista(modo) {
      var grafica = document.getElementById('contenedor-vista-grafica');
      var tabla = document.getElementById('contenedor-vista-tabla');
      var btnGrafica = document.getElementById('btn-vista-grafica');
      var btnTabla = document.getElementById('btn-vista-tabla');
      if (modo === 'tabla') {
        grafica.classList.add('oculto');
        tabla.classList.remove('oculto');
        btnGrafica.classList.remove('activo');
        btnTabla.classList.add('activo');
      } else {
        tabla.classList.add('oculto');
        grafica.classList.remove('oculto');
        btnTabla.classList.remove('activo');
        btnGrafica.classList.add('activo');
      }
    }
    try {
      if (window.history && window.history.replaceState && window.location.pathname !== '/') {
        window.history.replaceState({}, document.title, '/');
      }
    } catch (e) {}
  </script>
</body>
</html>`;
}



