import React from 'react';
import { LogOut, AlertCircle, X } from 'lucide-react';
import { UsuarioDirectivo } from '../types/notiprofes';

interface ModalConfirmarLogoutProps {
  abierto: boolean;
  usuarioActual: UsuarioDirectivo | null;
  onCerrar: () => void;
  onConfirmarLogout: () => void;
}

export const ModalConfirmarLogout: React.FC<ModalConfirmarLogoutProps> = ({
  abierto,
  usuarioActual,
  onCerrar,
  onConfirmarLogout,
}) => {
  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-confirmar-logout"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 p-6 space-y-5 relative">
        <button
          type="button"
          onClick={onCerrar}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pt-1">
          <div className="p-3 rounded-xl bg-rose-100 border border-rose-200 text-rose-700 shrink-0">
            <LogOut className="w-6 h-6" />
          </div>
          <div className="space-y-1 pr-6">
            <h2
              id="titulo-confirmar-logout"
              className="text-lg font-display font-extrabold text-slate-900"
            >
              Confirmar Cierre de Sesión
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Está seguro de que desea cerrar la sesión activa
              {usuarioActual ? (
                <>
                  {' '}de <strong className="text-slate-900 font-bold">{usuarioActual.nombre}</strong> ({usuarioActual.cargo})
                </>
              ) : null}?
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-950 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Al salir, la mesa de edición cambiará a modo lectura hasta que vuelva a autenticarse.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmarLogout();
              onCerrar();
            }}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sí, Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};
