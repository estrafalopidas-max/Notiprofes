// Tipos de datos para la plataforma colaborativa Noti-Profes (I.E. Villa Flora)

export interface EnlaceActividad {
  id: string;
  etiqueta: string;
  nombreArchivo: string;
  url: string;
  tipo: 'docx' | 'xlsx' | 'pdf' | 'link';
}

export interface ActividadProgramada {
  id: string;
  diaId: string;
  titulo: string;
  detalle?: string;
  responsable: string;
  hora: string;
  lugar: string;
  reprogramada?: boolean;
  notaReprogramacion?: string;
  enlaces?: EnlaceActividad[];
  actualizadoPor?: string;
}

export interface DiaProgramacion {
  id: string;
  fechaTexto: string; // Ej: "LUNES 2 DE NOVIEMBRE"
  esFestivo: boolean;
  notaHorario?: string; // Ej: "HORARIO DE LUNES"
  incluirDocumentosBase?: boolean;
  actividades: ActividadProgramada[];
}

export interface DocumentoInstitucional {
  id: string;
  categoria: string;
  titulo: string;
  nombreArchivo: string;
  url: string;
  tipo: 'docx' | 'xlsx' | 'pdf' | 'link';
}

export interface EventoLargoPlazo {
  id: string;
  fechaTexto: string;
  descripcion: string;
  categoria: 'finalizacion' | 'proxima_actividad' | 'capacitacion' | 'institucional';
  detalleAdicional?: string;
  destacado?: boolean;
}

export interface FelicitacionDocente {
  id: string;
  docentes: string;
  motivo: string;
}

export interface SuspensionEstudiante {
  id: string;
  grado: string;
  estudiante: string;
  fechaSuspension: string;
}

export interface HorarioPersonalApoyo {
  id: string;
  rol: string;
  nombre: string;
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
}

export interface FirmaDirectiva {
  nombre: string;
  cargo: string;
}

export interface BoletinSemanal {
  id: string;
  numero: number;
  fechaEmision: string;
  semanaTexto: string;
  remitente: string;
  destinatarios: string;
  descripcionPeriodo: string;
  subtituloPeriodo: string;
  frasePedagogica: string;
  autorFrase: string;
  estado: 'publicado' | 'borrador';
  mostrarSuspensionesPublico: boolean;
  ultimaActualizacion: string;
  actualizadoPor: string;
  documentosPermanentes: DocumentoInstitucional[];
  dias: DiaProgramacion[];
  proyeccionCalendario: EventoLargoPlazo[];
  felicitaciones: FelicitacionDocente[];
  avisosPracticas: string[];
  zonasAcompanamientoNotas: string[];
  pasosAccidenteEscolar: string[];
  polizaEscolarDoc: {
    titulo: string;
    url: string;
  };
  suspensiones: SuspensionEstudiante[];
  horariosApoyo: HorarioPersonalApoyo[];
  firmas: FirmaDirectiva[];
}

export type RolUsuario = 'administrador' | 'editor';

export interface PermisosUsuario {
  puedeEditarActividades: boolean;
  puedeEditarDocumentos: boolean;
  puedeEditarSuspensiones: boolean;
  puedeEditarEventosYFelicitaciones: boolean;
  puedeClonarSemana: boolean;
  puedeGestionarUsuarios: boolean;
}

export interface UsuarioDirectivo {
  id: string;
  usuario?: string;
  nombre: string;
  cargo: string;
  rol: RolUsuario;
  color: string;
  correo?: string;
  permisos?: PermisosUsuario;
}

export interface PresenciaActiva {
  clienteId: string;
  nombre: string;
  cargo: string;
  color: string;
  seccionActiva: string;
  conectadoDesde: string;
  estadoActividad?: 'editando' | 'desatendido';
  ultimoLatido?: number;
}

export type OperacionBoletin =
  | {
      tipo: 'agregar_actividad';
      diaId: string;
      actividad: ActividadProgramada;
      autor: string;
    }
  | {
      tipo: 'actualizar_actividad';
      diaId: string;
      actividad: ActividadProgramada;
      autor: string;
    }
  | {
      tipo: 'eliminar_actividad';
      diaId: string;
      actividadId: string;
      autor: string;
    }
  | {
      tipo: 'alternar_festivo_dia';
      diaId: string;
      esFestivo: boolean;
      notaHorario?: string;
      autor: string;
    }
  | {
      tipo: 'agregar_evento_largo_plazo';
      evento: EventoLargoPlazo;
      autor: string;
    }
  | {
      tipo: 'eliminar_evento_largo_plazo';
      eventoId: string;
      autor: string;
    }
  | {
      tipo: 'agregar_felicitacion';
      felicitacion: FelicitacionDocente;
      autor: string;
    }
  | {
      tipo: 'eliminar_felicitacion';
      felicitacionId: string;
      autor: string;
    }
  | {
      tipo: 'agregar_aviso_practica';
      aviso: string;
      autor: string;
    }
  | {
      tipo: 'eliminar_aviso_practica';
      indice: number;
      autor: string;
    }
  | {
      tipo: 'agregar_suspension';
      suspension: SuspensionEstudiante;
      autor: string;
    }
  | {
      tipo: 'eliminar_suspension';
      suspensionId: string;
      autor: string;
    }
  | {
      tipo: 'actualizar_horario_apoyo';
      horario: HorarioPersonalApoyo;
      autor: string;
    }
  | {
      tipo: 'agregar_documento';
      documento: DocumentoInstitucional;
      autor: string;
    }
  | {
      tipo: 'eliminar_documento';
      documentoId: string;
      autor: string;
    }
  | {
      tipo: 'actualizar_encabezado';
      datos: Partial<
        Pick<
          BoletinSemanal,
          | 'numero'
          | 'fechaEmision'
          | 'semanaTexto'
          | 'descripcionPeriodo'
          | 'subtituloPeriodo'
          | 'frasePedagogica'
          | 'autorFrase'
          | 'mostrarSuspensionesPublico'
          | 'estado'
        >
      >;
      autor: string;
    };
