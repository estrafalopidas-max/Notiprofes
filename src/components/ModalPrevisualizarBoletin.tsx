import React, { useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  Globe,
  Monitor,
  Printer,
  Smartphone,
  Download,
  X,
} from 'lucide-react';
import { BoletinSemanal } from '../types/notiprofes';
import { generarHtmlPublicoBoletin } from '../utils/boletinLogic';
import { descargarPdfBoletinDirecto } from '../services/googleDrivePdfService';

interface ModalPrevisualizarBoletinProps {
  abierto: boolean;
  onCerrar: () => void;
  boletin: BoletinSemanal;
}

export const ModalPrevisualizarBoletin: React.FC<ModalPrevisualizarBoletinProps> = ({
  abierto,
  onCerrar,
  boletin,
}) => {
  const [modoVista, setModoVista] = useState<'desktop' | 'movil'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const htmlContenido = useMemo(() => {
    return generarHtmlPublicoBoletin(boletin);
  }, [boletin]);

  if (!abierto) return null;

  const handleImprimirIframe = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const urlHtmlPublico = `/api/public/boletin/${boletin.id}/html`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-previsualizacion"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-150"
    >
      <div className="w-full max-w-6xl h-[92vh] bg-[#0F223D] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/60 flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* ENCABEZADO SUPERIOR CON CONTROLES DE PREVISUALIZACIÓN */}
        <div className="bg-[#0F223D] px-4 sm:px-6 py-3.5 border-b border-slate-700/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#007DC5]/20 border border-[#007DC5]/40 flex items-center justify-center text-[#007DC5] shrink-0">
              <Globe className="w-5 h-5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="titulo-modal-previsualizacion"
                  className="text-sm sm:text-base font-display font-black text-white truncate"
                >
                  Previsualización del Boletín Oficial
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  HTML Público
                </span>
              </div>
              <p className="text-xs text-sky-200/80 truncate">
                Boletín N° {boletin.numero} · {boletin.semanaTexto}
              </p>
            </div>
          </div>

          {/* Botones de acción del encabezado */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Selector de modo de vista: Desktop vs Móvil */}
            <div className="hidden sm:flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/80">
              <button
                type="button"
                onClick={() => setModoVista('desktop')}
                title="Vista de pantalla completa / escritorio"
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  modoVista === 'desktop'
                    ? 'bg-[#007DC5] text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="text-[11px]">Escritorio</span>
              </button>
              <button
                type="button"
                onClick={() => setModoVista('movil')}
                title="Vista en dispositivo móvil"
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  modoVista === 'movil'
                    ? 'bg-[#007DC5] text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px]">Móvil</span>
              </button>
            </div>

            {/* Descargar PDF directo */}
            <button
              type="button"
              onClick={() => descargarPdfBoletinDirecto(boletin)}
              title="Descargar archivo PDF directamente con todos los colores"
              className="px-3 py-1.5 rounded-xl bg-[#034EA2] hover:bg-[#007DC5] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-sky-200" />
              <span>Descargar PDF</span>
            </button>

            {/* Imprimir documento renderizado */}
            <button
              type="button"
              onClick={handleImprimirIframe}
              title="Imprimir boletín previsualizado"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden md:inline">Imprimir</span>
            </button>

            {/* Abrir en pestaña externa */}
            <a
              href={urlHtmlPublico}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir HTML público en una nueva pestaña"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Abrir en pestaña</span>
            </a>

            {/* Cerrar modal */}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar previsualización"
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DEL IFRAME INTERACTIVO */}
        <div className="flex-1 bg-slate-900/60 p-2 sm:p-4 flex items-center justify-center overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 flex flex-col ${
              modoVista === 'movil'
                ? 'w-[390px] max-w-full rounded-2xl shadow-2xl border-4 border-slate-700 overflow-hidden'
                : 'w-full rounded-xl shadow-lg border border-slate-700/50 overflow-hidden'
            }`}
          >
            <iframe
              ref={iframeRef}
              title={`Previsualización Oficial Boletín ${boletin.numero}`}
              srcDoc={htmlContenido}
              className="w-full h-full bg-white border-0"
            />
          </div>
        </div>

        {/* PIE INFERIOR CON INFORMACIÓN DE PUBLICACIÓN */}
        <div className="bg-[#0F223D] px-4 sm:px-6 py-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">
              Previsualización idéntica a la vista que recibirán docentes y directivos antes de publicar.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCerrar}
              className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
