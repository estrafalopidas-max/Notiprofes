import React from 'react';
import { Sparkles, User, X, Activity } from 'lucide-react';

interface ToastNotificacionEditorProps {
  notificacion: {
    id: string;
    usuario: string;
    seccion: string;
    descripcion: string;
    timestamp: string;
  } | null;
  onCerrar: () => void;
}

export const ToastNotificacionEditor: React.FC<ToastNotificacionEditorProps> = ({
  notificacion,
  onCerrar,
}) => {
  if (!notificacion) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 text-white border border-sky-400/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out transform translate-y-0 opacity-100 animate-bounce-once select-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30 shrink-0">
            <Activity className="w-4 h-4 animate-pulse text-sky-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-display font-extrabold text-sky-300 uppercase tracking-wider">
              <span>Edición en Tiempo Real</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10.5px] font-mono-tabular font-medium text-slate-400">
              {notificacion.timestamp}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          aria-label="Cerrar notificación"
          title="Cerrar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <User className="w-3.5 h-3.5 text-[#007DC5] shrink-0" />
          <span className="truncate">{notificacion.usuario}</span>
        </div>

        <p className="text-xs text-slate-300 leading-snug break-words">
          Guardó cambios en la sección{' '}
          <strong className="text-sky-200 font-semibold underline decoration-sky-400/50">
            {notificacion.seccion}
          </strong>
          : {notificacion.descripcion}
        </p>
      </div>
    </div>
  );
};
