import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, Layers, X } from 'lucide-react';
import { WOOD_PRESETS } from '../data/woodPresets';
import {
  LaserLayerConfig,
  LayerType,
  OriginMode,
  PolylinePath,
  ToolpathStats,
} from '../types/vector';
import {
  exportToDxf,
  exportToLaserGrblGcode,
  exportToLaserGrblSvg,
  triggerFileDownload,
} from '../utils/exporters';
import { formatDuration } from '../utils/geometry';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectTitle: string;
  paths: PolylinePath[];
  layers: Record<LayerType, LaserLayerConfig>;
  bedWidthMm: number;
  bedHeightMm: number;
  originMode: OriginMode;
  selectedPresetId: string;
  stats: ToolpathStats;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  projectTitle,
  paths,
  layers,
  bedWidthMm,
  bedHeightMm,
  originMode,
  selectedPresetId,
  stats,
}) => {
  const [activeTab, setActiveTab] = useState<'gcode' | 'svg'>('gcode');
  const [hairlineWidthMm, setHairlineWidthMm] = useState<number>(0.01);
  const [copied, setCopied] = useState(false);

  const presetName =
    WOOD_PRESETS.find((p) => p.id === selectedPresetId)?.name || 'Legno personalizzato';

  const safeSlug = projectTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'progetto_legno';

  const gcodeText = useMemo(() => {
    if (!isOpen) return '';
    return exportToLaserGrblGcode(paths, layers, projectTitle, originMode, presetName);
  }, [isOpen, paths, layers, projectTitle, originMode, presetName]);

  const svgText = useMemo(() => {
    if (!isOpen) return '';
    return exportToLaserGrblSvg(
      paths,
      layers,
      projectTitle,
      true,
      bedWidthMm,
      bedHeightMm,
      hairlineWidthMm
    );
  }, [isOpen, paths, layers, projectTitle, bedWidthMm, bedHeightMm, hairlineWidthMm]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const content = activeTab === 'gcode' ? gcodeText : svgText;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadGcode = () => {
    triggerFileDownload(`${safeSlug}_lasergrbl.nc`, gcodeText, 'text/plain;charset=utf-8');
  };

  const handleDownloadSvg = () => {
    triggerFileDownload(`${safeSlug}_vettoriale.svg`, svgText, 'image/svg+xml;charset=utf-8');
  };

  const handleDownloadDxf = () => {
    const dxf = exportToDxf(paths, layers);
    triggerFileDownload(`${safeSlug}_cad.dxf`, dxf, 'application/dxf;charset=utf-8');
  };

  const previewLines = (activeTab === 'gcode' ? gcodeText : svgText).split('\n').slice(0, 120).join('\n');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 id="export-modal-title" className="text-base font-semibold text-slate-900">
              Esporta file per LaserGRBL
            </h2>
            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums">
                {stats.bounds
                  ? `${stats.bounds.width.toFixed(1)} × ${stats.bounds.height.toFixed(1)} mm`
                  : '0 × 0 mm'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{presetName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">~{formatDuration(stats.estimatedSeconds)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">SVG fill=&quot;none&quot; · {hairlineWidthMm} mm</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Download Options Grid */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleDownloadGcode}
              className="flex flex-col items-start p-3.5 rounded-md border border-amber-700 bg-amber-700 text-white hover:bg-amber-800 transition-colors text-left"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="text-xs font-semibold">G-Code LaserGRBL (.nc)</span>
                <Download className="w-4 h-4 shrink-0" />
              </div>
              <span className="text-[11px] text-amber-100 leading-snug">
                Pronto all&apos;uso con velocità, potenza S, passaggi multipli e ordine livelli.
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              className="flex flex-col items-start p-3.5 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="text-xs font-semibold">Vettoriale SVG (.svg)</span>
                <FileCode2 className="w-4 h-4 text-slate-600 shrink-0" />
              </div>
              <span className="text-[11px] text-slate-500 leading-snug">
                Tratto sottile ({hairlineWidthMm} mm), senza riempimento (fill=&quot;none&quot;), soli &lt;path&gt;.
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadDxf}
              className="flex flex-col items-start p-3.5 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="text-xs font-semibold">Disegno CAD (.dxf)</span>
                <Layers className="w-4 h-4 text-slate-600 shrink-0" />
              </div>
              <span className="text-[11px] text-slate-500 leading-snug">
                Formato DXF R12 con livelli separati (INCISIONE, INTAGLIO, TAGLIO).
              </span>
            </button>
          </div>

          {/* Hairline Stroke Setting for SVG */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 border border-slate-200 rounded-md bg-slate-50">
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Spessore tratto SVG per taglio laser:</span>{' '}
              sempre senza riempimento (<span className="font-mono">fill=&quot;none&quot;</span>) a linea singola.
            </div>
            <div className="inline-flex items-center gap-1 bg-slate-200/70 p-0.5 rounded">
              {[0.01, 0.05, 0.1].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setHairlineWidthMm(w)}
                  className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                    hairlineWidthMm === w
                      ? 'bg-white text-slate-900 shadow-xs font-medium'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {w} mm
                </button>
              ))}
            </div>
          </div>

          {/* 3-Step LaserGRBL Guide */}
          <div className="border border-slate-200 rounded-md bg-slate-50 p-3.5">
            <div className="text-xs font-semibold text-slate-900 mb-2">
              Come aprire il file in LaserGRBL senza errori
            </div>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Se usi il file <span className="font-mono text-slate-900">.nc</span>, in LaserGRBL fai{' '}
                <span className="font-medium text-slate-800">File → Apri File</span>: velocità,
                potenza e passaggi sono già configurati (verifica che <span className="font-mono">$30=1000</span>).
              </li>
              <li>
                Posiziona la testa laser su{' '}
                <span className="font-medium text-slate-800">
                  {originMode === 'center' ? 'il centro del pannello' : "l'angolo in basso a sinistra"}
                </span>{' '}
                e premi il tasto <span className="font-medium text-slate-800">Imposta Origine (Globo)</span>.
              </li>
              <li>
                Esegui sempre una prova con il pulsante{' '}
                <span className="font-medium text-slate-800">Cornice (Frame)</span> prima di avviare il taglio su legno.
              </li>
            </ol>
          </div>

          {/* Live Code Inspector */}
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
              <div className="inline-flex items-center gap-1 bg-slate-200/70 p-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setActiveTab('gcode')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    activeTab === 'gcode' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Anteprima G-Code (.nc)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('svg')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    activeTab === 'svg' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Anteprima SVG
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiato' : 'Copia codice'}</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-950 text-slate-200 text-[11px] font-mono leading-relaxed max-h-52 overflow-auto">
              {previewLines}
              {(activeTab === 'gcode' ? gcodeText : svgText).split('\n').length > 120 &&
                '\n... (file completo pronto per il download)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
