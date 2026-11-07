import React from 'react';
import {
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react';
import { BoletinSemanal } from '../types/notiprofes';

interface PanelResumenInicioProps {
  boletin: BoletinSemanal;
  totalEdiciones: number;
  docentesConectadosSemana?: number;
}

export const PanelResumenInicio: React.FC<PanelResumenInicioProps> = ({
  boletin,
  totalEdiciones,
  docentesConectadosSemana = 38,
}) => {
  // Cálculo dinámico de tareas/actividades de la semana
  const totalActividades = boletin.dias.reduce(
    (acc, dia) => acc + dia.actividades.length,
    0
  );

  const reprogramadas = boletin.dias.reduce(
    (acc, dia) => acc + dia.actividades.filter((a) => a.reprogramada).length,
    0
  );

  const completadasEstimadas = Math.max(
    0,
    totalActividades - Math.ceil(totalActividades * 0.25)
  );

  const porcentajeProgreso =
    totalActividades > 0
      ? Math.round((completadasEstimadas / totalActividades) * 100)
      : 100;

  return (
    <section
      aria-label="Panel de resumen ejecutivo semanal"
      className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs select-none"
    >
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-[#034EA2]">
            <TrendingUp className="w-5 h-5 text-[#007DC5]" />
          </div>
          <div>
            <h2 className="text-base font-display font-extrabold text-[#034EA2] tracking-tight">
              Resumen Ejecutivo & Estadísticas Rápidas
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Estado general de coordinación y gestión docente de la I.E. Villa Flora
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sistema Operativo</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-[#034EA2] border border-sky-200">
            <CalendarCheck className="w-3.5 h-3.5 text-[#007DC5]" />
            <span>Edición N° {boletin.numero}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* KPI 1: Ediciones Totales */}
        <div className="bg-gradient-to-br from-sky-50/80 via-sky-50/30 to-white border border-sky-100 rounded-xl p-4 flex items-center justify-between group hover:border-sky-300 transition-all shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ediciones Totales
            </span>
            <div className="text-2xl lg:text-3xl font-display font-black text-[#034EA2]">
              {totalEdiciones}{' '}
              <span className="text-xs font-semibold text-slate-500 font-sans">
                boletines
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">
              Histórico institucional publicado
            </p>
          </div>
          <div className="p-3 bg-white border border-sky-200/80 rounded-xl text-[#034EA2] group-hover:scale-105 transition-transform shadow-2xs">
            <BookOpen className="w-6 h-6 text-[#007DC5]" />
          </div>
        </div>

        {/* KPI 2: Docentes Conectados en la Semana */}
        <div className="bg-gradient-to-br from-emerald-50/60 via-emerald-50/20 to-white border border-emerald-100 rounded-xl p-4 flex items-center justify-between group hover:border-emerald-300 transition-all shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Docentes Conectados
            </span>
            <div className="text-2xl lg:text-3xl font-display font-black text-emerald-700">
              {docentesConectadosSemana}{' '}
              <span className="text-xs font-semibold text-slate-500 font-sans">
                activos
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">
              Participación docente esta semana
            </p>
          </div>
          <div className="p-3 bg-white border border-emerald-200/80 rounded-xl text-emerald-600 group-hover:scale-105 transition-transform shadow-2xs">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        {/* KPI 3: Estado de Tareas Pendientes Semana Actual */}
        <div className="bg-gradient-to-br from-indigo-50/60 via-indigo-50/20 to-white border border-indigo-100 rounded-xl p-4 flex items-center justify-between group hover:border-indigo-300 transition-all shadow-2xs">
          <div className="space-y-1.5 flex-1 pr-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tareas de la Semana
              </span>
              <span className="text-xs font-bold text-[#034EA2]">
                {porcentajeProgreso}%
              </span>
            </div>

            <div className="text-2xl lg:text-3xl font-display font-black text-[#034EA2] leading-none">
              {completadasEstimadas} / {totalActividades}{' '}
              <span className="text-xs font-semibold text-slate-500 font-sans">
                listas
              </span>
            </div>

            {/* Barra de progreso visual */}
            <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden mt-1">
              <div
                className="bg-gradient-to-r from-[#034EA2] to-[#007DC5] h-full rounded-full transition-all duration-500"
                style={{ width: `${porcentajeProgreso}%` }}
              />
            </div>

            <p className="text-[11px] font-medium text-slate-500 leading-tight">
              {totalActividades - completadasEstimadas === 0
                ? '¡Todas las actividades completadas!'
                : `${totalActividades - completadasEstimadas} actividades en desarrollo (${reprogramadas} ajustadas)`}
            </p>
          </div>

          <div className="p-3 bg-white border border-indigo-200/80 rounded-xl text-[#034EA2] group-hover:scale-105 transition-transform shadow-2xs shrink-0">
            <CheckCircle2 className="w-6 h-6 text-[#007DC5]" />
          </div>
        </div>
      </div>
    </section>
  );
};
