import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface OpcionDropdown {
  valor: string;
  etiqueta: string;
  descripcion?: string;
  colorPunto?: string;
  icono?: React.ReactNode;
  encabezadoGrupo?: string;
}

interface DropdownBaseProps {
  etiquetaBoton: string;
  icono?: React.ReactNode;
  colorPuntoBoton?: string;
  opciones: OpcionDropdown[];
  ariaLabel?: string;
  anchoCompleto?: boolean;
  alineacionMenu?: 'izquierda' | 'derecha';
  varianteBoton?: 'pastilla' | 'campo';
}

interface DropdownSimpleProps extends DropdownBaseProps {
  modo?: 'simple';
  valorSeleccionado: string;
  onChange: (nuevoValor: string) => void;
}

interface DropdownMultipleProps extends DropdownBaseProps {
  modo: 'multiple';
  valoresSeleccionados: string[];
  onToggleValor: (valor: string) => void;
}

export type DropdownPersonalizadoProps = DropdownSimpleProps | DropdownMultipleProps;

export const DropdownPersonalizado: React.FC<DropdownPersonalizadoProps> = (props) => {
  const {
    etiquetaBoton,
    icono,
    colorPuntoBoton,
    opciones,
    ariaLabel,
    anchoCompleto = false,
    alineacionMenu = 'izquierda',
    varianteBoton = 'pastilla',
  } = props;

  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const manejarClickFuera = (e: MouseEvent) => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    };

    const manejarTeclaEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
      }
    };

    if (abierto) {
      document.addEventListener('mousedown', manejarClickFuera);
      document.addEventListener('keydown', manejarTeclaEscape);
    }

    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarTeclaEscape);
    };
  }, [abierto]);

  const estaSeleccionado = (valor: string): boolean => {
    if (props.modo === 'multiple') {
      return props.valoresSeleccionados.includes(valor);
    }
    return props.valorSeleccionado === valor;
  };

  const manejarSeleccion = (valor: string) => {
    if (props.modo === 'multiple') {
      props.onToggleValor(valor);
    } else {
      props.onChange(valor);
      setAbierto(false);
    }
  };

  const claseBoton =
    varianteBoton === 'campo'
      ? `${
          anchoCompleto ? 'w-full' : 'inline-flex'
        } flex flex-row items-center justify-between gap-2 px-3 py-1.5 min-h-[36px] rounded-lg bg-white hover:bg-slate-50/80 text-xs sm:text-sm font-medium text-slate-800 transition-all cursor-pointer select-none border whitespace-nowrap ${
          abierto
            ? 'border-[#007DC5] ring-1 ring-[#007DC5]/20 shadow-2xs'
            : 'border-slate-200 hover:border-slate-300'
        }`
      : `${
          anchoCompleto ? 'w-full' : 'inline-flex'
        } flex flex-row items-center justify-between gap-2.5 px-3.5 py-1.5 min-h-[36px] rounded-full bg-white hover:bg-slate-50/90 text-xs sm:text-sm font-semibold text-[#0F172A] transition-all cursor-pointer select-none border whitespace-nowrap ${
          abierto
            ? 'border-[#007DC5] ring-1 ring-[#007DC5]/20 shadow-2xs bg-white'
            : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
        }`;

  return (
    <div
      ref={contenedorRef}
      className={`relative inline-block text-left ${anchoCompleto ? 'w-full' : ''}`}
    >
      {/* Botón disparador estilo pastilla o campo con icono a la izquierda y flecha chevron */}
      <button
        type="button"
        aria-label={ariaLabel || etiquetaBoton}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((prev) => !prev)}
        className={claseBoton}
      >
        <span className="flex flex-row items-center gap-2 min-w-0 truncate shrink">
          {colorPuntoBoton && (
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorPuntoBoton}`} />
          )}
          {icono && <span className="text-[#007DC5] shrink-0">{icono}</span>}
          <span className="truncate">{etiquetaBoton}</span>
        </span>
        {abierto ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
        )}
      </button>

      {/* Popover desplegable según la imagen adjunta: bordes redondeados suaves, sin casillas de verificación, punto azul a la derecha del elemento activo */}
      {abierto && (
        <div
          role="listbox"
          aria-label={ariaLabel || etiquetaBoton}
          className={`absolute ${
            alineacionMenu === 'derecha' ? 'right-0' : 'left-0'
          } top-full mt-2 z-50 min-w-[210px] ${
            anchoCompleto ? 'w-full' : 'w-max max-w-[320px]'
          } bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-4px_rgba(15,23,42,0.14)] p-2 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto`}
        >
          {opciones.map((op, idx) => {
            const activo = estaSeleccionado(op.valor);
            const mostrarEncabezado = Boolean(
              op.encabezadoGrupo &&
                (idx === 0 || opciones[idx - 1]?.encabezadoGrupo !== op.encabezadoGrupo)
            );
            return (
              <React.Fragment key={op.valor}>
                {mostrarEncabezado && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-t border-slate-100 first:border-t-0 first:pt-1">
                    {op.encabezadoGrupo}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={activo}
                  onClick={() => manejarSeleccion(op.valor)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activo
                      ? 'bg-sky-50/70 text-[#034EA2] font-bold'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                  {op.colorPunto && (
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${op.colorPunto}`} />
                  )}
                  {op.icono && <span className="shrink-0">{op.icono}</span>}
                  <div className="min-w-0">
                    <div className="text-xs sm:text-[13px] leading-snug truncate">
                      {op.etiqueta}
                    </div>
                    {op.descripcion && (
                      <div className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                        {op.descripcion}
                      </div>
                    )}
                  </div>
                </div>

                {/* Punto sólido azul a la derecha del ítem activo (sin casilla de verificación) */}
                {activo && (
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full bg-[#007DC5] shrink-0"
                  />
                )}
              </button>
            </React.Fragment>
          );
        })}
        </div>
      )}
    </div>
  );
};
