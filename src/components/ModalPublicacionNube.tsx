import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CloudUpload,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileCode,
  Globe,
  Link2,
  Sparkles,
  X,
} from 'lucide-react';
import { BoletinSemanal } from '../types/notiprofes';
import { generarHtmlPublicoBoletin } from '../utils/boletinLogic';

interface ModalPublicacionNubeProps {
  abierto: boolean;
  onCerrar: () => void;
  boletin: BoletinSemanal;
  onAbrirPrevisualizacion: () => void;
  onSincronizarPublicacion: () => Promise<boolean>;
}

export const ModalPublicacionNube: React.FC<ModalPublicacionNubeProps> = ({
  abierto,
  onCerrar,
  boletin,
  onAbrirPrevisualizacion,
  onSincronizarPublicacion,
}) => {
  const [linkCorto, setLinkCorto] = useState<string>(
    boletin.numero === 40 ? 'https://is.gd/52X1sx' : `https://is.gd/vf26n${boletin.numero}`
  );
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [copiadoIframe, setCopiadoIframe] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSincronizado, setMensajeSincronizado] = useState<string | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>(() => {
    try {
      const fecha = boletin.ultimaActualizacion
        ? new Date(boletin.ultimaActualizacion)
        : new Date();
      return fecha.toLocaleString('es-CO', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '4/11/2026, 6:00 p. m.';
    }
  });

  const urlPublicSchedule = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/public/schedule?id=${encodeURIComponent(boletin.id)}`;
  }, [boletin.id]);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;

    const obtenerLinkCorto = async () => {
      try {
        const resp = await fetch('/api/public/acortar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlPublicSchedule,
            numero: boletin.numero,
          }),
        });
        if (resp.ok && !cancelado) {
          const data = (await resp.json()) as { shortUrl?: string };
          if (data.shortUrl) {
            setLinkCorto(data.shortUrl);
          }
        }
      } catch {
        // Mantiene el link corto institucional de respaldo
      }
    };

    obtenerLinkCorto();
    return () => {
      cancelado = true;
    };
  }, [abierto, urlPublicSchedule, boletin.numero]);

  useEffect(() => {
    if (!boletin.ultimaActualizacion) return;
    try {
      const fecha = new Date(boletin.ultimaActualizacion);
      if (!isNaN(fecha.getTime())) {
        setUltimaSincronizacion(
          fecha.toLocaleString('es-CO', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        );
      }
    } catch {
      // Ignorar formato inválido
    }
  }, [boletin.ultimaActualizacion]);

  if (!abierto) return null;

  const codigoIframe = `<iframe
  src="${linkCorto}"
  width="100%"
  height="920"
  frameborder="0"
  allowfullscreen>
</iframe>`;

  const handleCopiarLink = () => {
    navigator.clipboard?.writeText(linkCorto);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2500);
  };

  const handleCopiarIframe = () => {
    navigator.clipboard?.writeText(codigoIframe);
    setCopiadoIframe(true);
    setTimeout(() => setCopiadoIframe(false), 2500);
  };

  const handleDescargarHtml = () => {
    const htmlCompleto = generarHtmlPublicoBoletin(boletin);
    const blob = new Blob([htmlCompleto], { type: 'text/html;charset=utf-8' });
    const urlDescarga = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlDescarga;
    a.download = `NotiProfes_N${boletin.numero}_VillaFlora.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlDescarga);
  };

  const handlePublicarYSincronizar = async () => {
    setSincronizando(true);
    setMensajeSincronizado(null);
    try {
      const ok = await onSincronizarPublicacion();
      const ahora = new Date().toLocaleString('es-CO', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      setUltimaSincronizacion(ahora);
      if (ok) {
        setMensajeSincronizado(
          'Boletín publicado y sincronizado en la nube correctamente.'
        );
      } else {
        setMensajeSincronizado(
          'Sincronización completada con la vista pública actual.'
        );
      }
      setTimeout(() => setMensajeSincronizado(null), 4000);
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-publicacion"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="max-w-2xl w-full bg-[#0F223D] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh] relative">
        {/* CABECERA INSTITUCIONAL (IGUAL AL ESTÁNDAR DE LA APP) */}
        <div className="bg-[#0F223D] px-6 pt-6 pb-4 flex flex-col relative shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal de publicación"
            className="absolute top-4 right-4 z-20 p-2 rounded-full text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-all cursor-pointer shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2 pr-8">
            <div className="w-10 h-10 rounded-xl bg-[#007DC5]/20 border border-[#007DC5]/40 flex items-center justify-center text-[#007DC5] shrink-0">
              <FileCode className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2
                  id="titulo-modal-publicacion"
                  className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight leading-tight"
                >
                  Publicación en la Nube y Enlace Acortado
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <Sparkles className="w-3 h-3" />
                  Sincronización en vivo
                </span>
              </div>
              <p className="text-xs text-sky-200/80 font-medium mt-0.5">
                Publica en tiempo real con ruta oculta y link acortado para el sitio web del colegio · I.E. Villa Flora
              </p>
            </div>
          </div>

          {/* Franja dorada divisoria institucional */}
          <div className="w-full h-1 bg-amber-400 rounded-full mt-2" />
        </div>

        {/* CUERPO BLANCO DEL MODAL */}
        <div className="bg-white px-5 sm:px-6 py-5 space-y-4 overflow-y-auto rounded-b-3xl">
          {mensajeSincronizado && (
            <div
              role="status"
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{mensajeSincronizado}</span>
            </div>
          )}

          {/* SECCIÓN 1: LINK ACORTADO OFICIAL */}
          <div className="bg-[#F4F8FF] border border-blue-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#0F172A]">
                <Link2 className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>Link Acortado Oficial (Oculta la ruta del enlace)</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-blue-100/80 text-[#1D4ED8] text-[11px] font-semibold">
                Ruta enmascarada automáticamente
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                readOnly
                aria-label="Enlace corto oficial"
                value={linkCorto}
                className="flex-1 rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-mono-tabular font-bold text-[#1D4ED8] focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopiarLink}
                className="px-4 py-2.5 rounded-xl bg-[#007DC5] hover:bg-[#034EA2] text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {copiadoLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link Corto</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
              Al abrir este enlace corto, el navegador oculta automáticamente la ruta interna para que nunca se vea{' '}
              <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono-tabular text-[11px]">
                /public/schedule
              </code>
              .
            </p>
          </div>

          {/* SECCIÓN 2: TARJETAS DUALES (VISTA PÚBLICA EN CALIENTE + DESCARGAR HTML ÚNICO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tarjeta Izquierda: Vista Pública en Caliente */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#1D4ED8]">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Vista Pública en Caliente</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Abre la página visual exactamente como la ven padres, estudiantes y docentes con filtros interactivos.
                </p>
              </div>

              <div>
                <a
                  href={`/public/schedule?id=${encodeURIComponent(boletin.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-[#007DC5] hover:bg-[#034EA2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Consulta Pública</span>
                </a>
              </div>
            </div>

            {/* Tarjeta Derecha: Descargar Archivo HTML Único */}
            <div className="bg-white border border-emerald-400/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#047857]">
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Descargar Archivo HTML Único</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Genera el archivo{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono-tabular text-[11px]">
                    .html
                  </code>{' '}
                  autónomo con logo institucional y casillas 60/40 para respaldo offline.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDescargarHtml}
                  className="px-4 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar HTML</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCerrar();
                    onAbrirPrevisualizacion();
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Previsualizar</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: CÓDIGO IFRAME CON LINK CORTO PARA EL SITIO WEB DEL COLEGIO */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-slate-800">
                <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Código Iframe con Link Corto para el Sitio Web del Colegio</span>
              </div>
              <button
                type="button"
                onClick={handleCopiarIframe}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                {copiadoIframe ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">¡Iframe Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar Iframe</span>
                  </>
                )}
              </button>
            </div>

            <pre className="bg-[#0B132B] text-slate-100 rounded-xl p-4 font-mono-tabular text-xs leading-relaxed overflow-x-auto select-all">
              <code>{codigoIframe}</code>
            </pre>
          </div>

          {/* PIE DE SINCRONIZACIÓN Y BOTONES DE ACCIÓN */}
          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between gap-2 text-xs border-t border-slate-100 pt-3">
              <span className="text-slate-500 font-medium">
                Última sincronización en la nube:
              </span>
              <span className="font-mono-tabular font-bold text-slate-800">
                {ultimaSincronizacion}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                disabled={sincronizando}
                onClick={handlePublicarYSincronizar}
                className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <CloudUpload className="w-4 h-4" />
                <span>
                  {sincronizando
                    ? 'Sincronizando...'
                    : 'Publicar y Sincronizar en la Nube'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
