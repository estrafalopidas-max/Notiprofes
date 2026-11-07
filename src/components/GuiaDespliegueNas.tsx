import React, { useState } from 'react';
import { Check, Copy, ExternalLink, HardDrive, Server, Shield } from 'lucide-react';
import { BoletinSemanal } from '../types/notiprofes';

interface GuiaDespliegueNasProps {
  boletin: BoletinSemanal;
}

export const GuiaDespliegueNas: React.FC<GuiaDespliegueNasProps> = ({ boletin }) => {
  const [copiadoCompose, setCopiadoCompose] = useState(false);
  const urlHtmlVivo = `${window.location.origin}/api/public/boletin/actual/html`;

  const dockerComposeYaml = `services:
  notiprofes-villaflora:
    build: .
    container_name: notiprofes-villaflora
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - INSTITUTIONAL_PIN=2026
    volumes:
      # Carpeta persistente en su NAS (TrueNAS / Synology / OpenMediaVault)
      # Contiene notiprofes-db.json y genera automáticamente notiprofes-publico.html
      - /mnt/tank/appdata/notiprofes:/app/data`;

  const handleCopiarCompose = () => {
    navigator.clipboard?.writeText(dockerComposeYaml);
    setCopiadoCompose(true);
    setTimeout(() => setCopiadoCompose(false), 2500);
  };

  return (
    <div className="space-y-6">
      <section className="bg-gradient-to-r from-[#022c5e] via-[#034EA2] to-[#007DC5] text-white rounded-2xl border border-[#034EA2] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="border-b border-white/15 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="bg-white px-4 py-2.5 rounded-xl inline-flex items-center self-start shrink-0">
              <img
                src="/public/assets/aistudio/Asset_1_9236e7ca.png"
                alt="Logo Oficial Institución Educativa Villa Flora"
                referrerPolicy="no-referrer"
                className="h-11 w-auto object-contain"
              />
            </div>
            <div>
              <div className="text-xs font-mono-tabular text-sky-200">
                Auto-actualización HTML · Almacenamiento Persistente /app/data · WebSockets LAN
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-0.5">
                Publicación HTML Automática e Instalación en NAS Personal
              </h1>
            </div>
          </div>

          <a
            href="/api/public/boletin/actual/html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#ED145B] hover:bg-[#d41050] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir HTML Público Auto-Actualizable
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#011c3b]/70 border border-white/15 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-white">
              <Server className="w-4 h-4 text-sky-300" />
              1. Edición Multi-Equipo Simultánea
            </div>
            <p className="text-xs text-sky-100 leading-relaxed">
              Rectoría, Coordinación Académica, Convivencia y Secretaría pueden conectarse al mismo
              tiempo desde la red local del colegio o por VPN a su NAS. Cada cambio se sincroniza
              por WebSockets sin sobrescribir el trabajo de los demás.
            </p>
          </div>

          <div className="bg-[#011c3b]/70 border border-white/15 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-white">
              <HardDrive className="w-4 h-4 text-sky-300" />
              2. HTML Público Siempre al Día
            </div>
            <p className="text-xs text-sky-100 leading-relaxed">
              Los docentes consultan siempre el mismo enlace fijo{' '}
              <code className="font-mono-tabular bg-black/30 text-sky-200 px-1.5 py-0.5 rounded-sm">
                /api/public/boletin/actual/html
              </code>
              . Además, el servidor escribe automáticamente el archivo{' '}
              <code className="font-mono-tabular bg-black/30 text-sky-200 px-1.5 py-0.5 rounded-sm">
                notiprofes-publico.html
              </code>{' '}
              en el volumen del NAS tras cada edición.
            </p>
          </div>

          <div className="bg-[#011c3b]/70 border border-white/15 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-white">
              <Shield className="w-4 h-4 text-sky-300" />
              3. Identidad Corporativa Oficial Aplicada
            </div>
            <p className="text-xs text-sky-100 leading-relaxed">
              Tanto la plataforma web como el HTML público incorporan el logo oficial de la{' '}
              <strong>I.E. Villa Flora</strong> y su paleta cromática institucional (
              <code className="font-mono-tabular">#007DC5</code>,{' '}
              <code className="font-mono-tabular">#034EA2</code>,{' '}
              <code className="font-mono-tabular">#ED145B</code>,{' '}
              <code className="font-mono-tabular">#231F20</code>,{' '}
              <code className="font-mono-tabular">#939598</code>).
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-extrabold text-[#034EA2]">
              Configuración Docker Compose para TrueNAS / Synology
            </h2>
            <button
              type="button"
              onClick={handleCopiarCompose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              {copiadoCompose ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar YAML
                </>
              )}
            </button>
          </div>

          <pre className="bg-[#231F20] text-slate-100 p-4 rounded-xl text-xs font-mono-tabular overflow-x-auto leading-relaxed">
            {dockerComposeYaml}
          </pre>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="font-bold text-[#034EA2]">
              Enlace directo del Boletín HTML Público para compartir con los profes:
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono-tabular text-[#231F20] break-all">
              {urlHtmlVivo}
            </div>
          </div>

          {/* Muestra de Paleta Corporativa Oficial */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="text-xs font-bold text-[#231F20]">
              Paleta Corporativa Oficial I.E. Villa Flora activa en el HTML:
            </div>
            <div className="grid grid-cols-5 gap-2 text-[10px] font-mono-tabular text-center">
              <div className="space-y-1">
                <div className="h-7 rounded-md bg-[#007DC5]" />
                <span>#007DC5</span>
              </div>
              <div className="space-y-1">
                <div className="h-7 rounded-md bg-[#034EA2]" />
                <span>#034EA2</span>
              </div>
              <div className="space-y-1">
                <div className="h-7 rounded-md bg-[#ED145B]" />
                <span>#ED145B</span>
              </div>
              <div className="space-y-1">
                <div className="h-7 rounded-md bg-[#231F20]" />
                <span>#231F20</span>
              </div>
              <div className="space-y-1">
                <div className="h-7 rounded-md bg-[#939598]" />
                <span>#939598</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-extrabold text-[#034EA2]">
              Vista Previa en Vivo del HTML Público (N° {boletin.numero})
            </h2>
            <span className="text-xs text-[#939598] font-mono-tabular font-semibold">
              Vista Autónoma Persistente
            </span>
          </div>
          <div className="border border-slate-200 rounded-xl h-[520px] overflow-hidden bg-slate-100">
            <iframe
              title="Vista previa del HTML público NotiProfes"
              src={`/api/public/boletin/${boletin.id}/html`}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
