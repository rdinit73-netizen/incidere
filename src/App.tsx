import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Cog,
  Download,
  FileCode2,
  Flower2,
  ImagePlus,
  Scissors,
  ScissorsLineDashed,
  Type,
} from 'lucide-react';
import { ExportModal } from './components/ExportModal';
import { GeneratorPanel } from './components/GeneratorPanel';
import { LaserSettingsPanel } from './components/LaserSettingsPanel';
import { WorkbedCanvas } from './components/WorkbedCanvas';
import { DEFAULT_LAYERS, WOOD_PRESETS } from './data/woodPresets';
import {
  BedBackground,
  BoxParams,
  CutoutParams,
  GearParams,
  GeneratorMode,
  HingeParams,
  LaserLayerConfig,
  LayerType,
  MandalaParams,
  OriginMode,
  PolylinePath,
  SignParams,
  TracerParams,
} from './types/vector';
import { generateCutoutVectors } from './utils/cutoutGenerator';
import { exportToLaserGrblGcode, triggerFileDownload } from './utils/exporters';
import {
  generateFingerBox,
  generateGearOrCoaster,
  generateLivingHinge,
  generateMandala,
  generateSignPlaque,
} from './utils/generators';
import {
  centerPathsOnBed,
  computeToolpathStats,
  rotatePaths,
  scalePaths,
} from './utils/geometry';
import {
  createSampleRasterDataUrl,
  SampleTemplateId,
  traceImageToVectors,
} from './utils/rasterTracer';
import { importSvgStringToPaths } from './utils/svgParser';

const DEFAULT_SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="54" stroke="#DC2626" fill="none" />
  <circle cx="60" cy="60" r="47" stroke="#2563EB" fill="none" />
  <polygon points="60,18 71,47 102,47 77,66 86,96 60,78 34,96 43,66 18,47 49,47" stroke="#D97706" fill="none" />
  <circle cx="60" cy="60" r="10" stroke="#2563EB" fill="none" />
</svg>`;

const MODE_TABS: {
  id: GeneratorMode;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'mandala', label: 'Mandala', title: 'Mandala & Rosoni', icon: Flower2 },
  { id: 'cutout', label: 'Ritaglio & Sagome', title: 'Ritaglio Scritte & Sagome', icon: Scissors },
  { id: 'box', label: 'Scatola Incastro', title: 'Scatola con Incastri a Dita', icon: Box },
  { id: 'hinge', label: 'Cerniera Legno', title: 'Cerniera Flessibile (Living Hinge)', icon: ScissorsLineDashed },
  { id: 'sign', label: 'Targa & Testo', title: 'Targhetta & Testo CNC', icon: Type },
  { id: 'gear', label: 'Ingranaggi', title: 'Ingranaggi & Sottobicchieri', icon: Cog },
  { id: 'tracer', label: 'Foto → Vettore', title: 'Vettorizzazione Immagini', icon: ImagePlus },
  { id: 'svg_import', label: 'Importa SVG', title: 'Importa & Converti SVG', icon: FileCode2 },
];

export default function App() {
  const [mode, setMode] = useState<GeneratorMode>('mandala');
  const [bedWidthMm, setBedWidthMm] = useState(300);
  const [bedHeightMm, setBedHeightMm] = useState(300);
  const [bedBackground, setBedBackground] = useState<BedBackground>('poplar');
  const [originMode, setOriginMode] = useState<OriginMode>('bottom-left');
  const [selectedPresetId, setSelectedPresetId] = useState('poplar-3mm-10w');
  const [layers, setLayers] = useState<Record<LayerType, LaserLayerConfig>>(() =>
    structuredClone(DEFAULT_LAYERS)
  );
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [compactPanelTab, setCompactPanelTab] = useState<'params' | 'laser'>('params');

  // Generator States
  const [mandala, setMandala] = useState<MandalaParams>({
    diameterMm: 160,
    symmetry: 12,
    rings: 4,
    petalStyle: 'lotus',
    outerShape: 'circle',
    hangingHole: false,
    centerHoleMm: 8,
    addCarveHatch: false,
  });

  const [cutout, setCutout] = useState<CutoutParams>({
    mode: 'word',
    text: 'Legno',
    fontStyle: 'script',
    joinMode: 'base_bar',
    fontSizeMm: 36,
    letterSpacingMm: 0,
    baseBarHeightMm: 7,
    offsetMarginMm: 5,
    engraveInnerText: true,
    attachment: 'none',
    shapeType: 'heart',
    shapeWidthMm: 90,
    shapeHole: true,
    shapeLabel: '',
  });

  const [box, setBox] = useState<BoxParams>({
    widthMm: 80,
    depthMm: 64,
    heightMm: 46,
    thicknessMm: 3,
    kerfMm: 0.14,
    fingerWidthMm: 10,
    hasLid: true,
    lidStyle: 'slot_handle',
    panelGapMm: 6,
  });

  const [hinge, setHinge] = useState<HingeParams>({
    widthMm: 120,
    heightMm: 70,
    pattern: 'straight',
    slotSpacingMm: 3.4,
    cutLengthMm: 22,
    bridgeMm: 3.5,
    cornerRadiusMm: 5,
  });

  const [sign, setSign] = useState<SignParams>({
    text: 'Laboratorio\ndel Legno',
    widthMm: 170,
    heightMm: 75,
    shape: 'rounded',
    fontSizeMm: 17,
    letterSpacing: 1.05,
    lineSpacing: 1.45,
    strokeStyle: 'single',
    mountingHoles: 'two_side',
    holeDiameterMm: 4,
    innerBorder: true,
    engravingLayer: 'carve',
  });

  const [gear, setGear] = useState<GearParams>({
    mode: 'gear',
    teeth: 24,
    moduleMm: 4,
    boreMm: 8,
    spokes: 5,
    coasterDiameterMm: 100,
    coasterPattern: 'hex_grid',
  });

  const [tracer, setTracer] = useState<TracerParams>({
    threshold: 135,
    invert: false,
    simplifyEpsilon: 0.25,
    smoothIterations: 1,
    minAreaPx: 16,
    targetWidthMm: 110,
    outlineLayer: 'engrave',
    fillMode: 'outline',
    hatchSpacingMm: 0.9,
    cutFrameMode: 'silhouette',
    frameMarginMm: 5,
  });
  const [tracerImageSrc, setTracerImageSrc] = useState<string>('');

  const [svgInputText, setSvgInputText] = useState<string>(DEFAULT_SAMPLE_SVG);
  const [svgTargetWidthMm, setSvgTargetWidthMm] = useState<number>(150);

  // Active paths displayed on bed & exported
  const [paths, setPaths] = useState<PolylinePath[]>([]);

  // Initialize default sample raster template lazily when needed
  useEffect(() => {
    if (!tracerImageSrc) {
      setTracerImageSrc(createSampleRasterDataUrl('compass'));
    }
  }, [tracerImageSrc]);

  // Regenerate parametric paths when active mode or its params change
  useEffect(() => {
    if (mode === 'mandala') {
      setPaths(generateMandala(mandala, bedWidthMm, bedHeightMm));
    } else if (mode === 'box') {
      setPaths(generateFingerBox(box, bedWidthMm, bedHeightMm));
    } else if (mode === 'hinge') {
      setPaths(generateLivingHinge(hinge, bedWidthMm, bedHeightMm));
    } else if (mode === 'sign') {
      setPaths(generateSignPlaque(sign, bedWidthMm, bedHeightMm));
    } else if (mode === 'gear') {
      setPaths(generateGearOrCoaster(gear, bedWidthMm, bedHeightMm));
    } else if (mode === 'svg_import') {
      setPaths(importSvgStringToPaths(svgInputText, svgTargetWidthMm, bedWidthMm, bedHeightMm));
    }
  }, [mode, mandala, box, hinge, sign, gear, svgInputText, svgTargetWidthMm, bedWidthMm, bedHeightMm]);

  // Async cutout word/shape vector generation
  useEffect(() => {
    if (mode !== 'cutout') return;
    let cancelled = false;
    generateCutoutVectors(cutout, bedWidthMm, bedHeightMm)
      .then((res) => {
        if (!cancelled) setPaths(res);
      })
      .catch(() => {
        if (!cancelled) setPaths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, cutout, bedWidthMm, bedHeightMm]);

  // Async bitmap-to-vector tracing when in tracer mode
  useEffect(() => {
    if (mode !== 'tracer' || !tracerImageSrc) return;
    let cancelled = false;
    traceImageToVectors(tracerImageSrc, tracer, bedWidthMm, bedHeightMm)
      .then((res) => {
        if (!cancelled) {
          setPaths(res.paths);
        }
      })
      .catch(() => {
        if (!cancelled) setPaths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, tracerImageSrc, tracer, bedWidthMm, bedHeightMm]);

  const handleSelectPreset = useCallback((presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = WOOD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setLayers((prev) => ({
      engrave: { ...prev.engrave, ...preset.engrave },
      carve: { ...prev.carve, ...preset.carve },
      cut: { ...prev.cut, ...preset.cut },
    }));

    setBox((b) => ({ ...b, thicknessMm: preset.thicknessMm }));

    if (preset.previewGrain === 'poplar' || preset.previewGrain === 'birch' || preset.previewGrain === 'walnut' || preset.previewGrain === 'mdf') {
      setBedBackground(preset.previewGrain);
    }
  }, []);

  const handleUpdateLayer = useCallback(
    (layerId: LayerType, patch: Partial<LaserLayerConfig>) => {
      setLayers((prev) => ({
        ...prev,
        [layerId]: { ...prev[layerId], ...patch },
      }));
    },
    []
  );

  const handleLoadSampleTemplate = useCallback((id: SampleTemplateId) => {
    setTracerImageSrc(createSampleRasterDataUrl(id));
  }, []);

  const handleBedSizeChange = useCallback((w: number, h: number) => {
    setBedWidthMm(w);
    setBedHeightMm(h);
    const maxDim = Math.min(w, h) - 12;
    setMandala((m) => (m.diameterMm > maxDim ? { ...m, diameterMm: Math.max(60, maxDim) } : m));
    setSign((s) => (s.widthMm > w - 12 ? { ...s, widthMm: Math.max(60, w - 12) } : s));
    setHinge((hg) => (hg.widthMm > w - 12 ? { ...hg, widthMm: Math.max(40, w - 12) } : hg));
    setTracer((t) =>
      t.targetWidthMm > w - 20 ? { ...t, targetWidthMm: Math.max(30, w - 24) } : t
    );
  }, []);

  const handleFitPathsToBed = useCallback(() => {
    setPaths((prev) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of prev) {
        for (const pt of p.points) {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        }
      }
      const w = maxX - minX;
      const h = maxY - minY;
      if (w <= 0 || h <= 0) return prev;
      const availW = bedWidthMm - 8;
      const availH = bedHeightMm - 8;
      const factor = Math.min(availW / w, availH / h, 1);
      const scaled = factor < 1 ? scalePaths(prev, factor, factor) : prev;
      return centerPathsOnBed(scaled, bedWidthMm, bedHeightMm);
    });
  }, [bedWidthMm, bedHeightMm]);

  const stats = useMemo(() => computeToolpathStats(paths, layers), [paths, layers]);

  const activeTabInfo = MODE_TABS.find((t) => t.id === mode)!;

  const handleQuickDownloadGcode = () => {
    const presetName =
      WOOD_PRESETS.find((p) => p.id === selectedPresetId)?.name || 'Legno personalizzato';
    const gcode = exportToLaserGrblGcode(
      paths,
      layers,
      activeTabInfo.title,
      originMode,
      presetName
    );
    triggerFileDownload(`${mode}_lasergrbl.nc`, gcode, 'text/plain;charset=utf-8');
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Top Bar Contract: Breadcrumb Title on left, primary actions on right */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-5 flex items-center justify-between gap-8 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display text-base font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0">
            VettoreLegno
          </span>
          <span aria-hidden="true" className="text-slate-300 text-sm">
            /
          </span>
          <span className="text-sm font-medium text-slate-600 truncate">
            {activeTabInfo.title}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleQuickDownloadGcode}
            disabled={stats.totalPaths === 0}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Scarica .NC</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            disabled={stats.totalPaths === 0}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-md disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="sm:hidden">Esporta</span>
            <span className="hidden sm:inline">Esporta per LaserGRBL</span>
          </button>
        </div>
      </header>

      {/* Workspace Mode Selector Toolbar (Below Top Bar) */}
      <nav
        aria-label="Moduli di creazione vettoriale"
        className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-4 py-1.5 flex items-center gap-1 overflow-x-auto"
      >
        {MODE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Responsive Workbench:
          - Smartphone (<md): Preview always visible on top (44vh) + tabbed controls below
          - Compact PC / Tablet (md..lg): 2 columns (Tabbed sidebar left + Full-height Preview right)
          - Desktop (lg+): 3 columns (GeneratorPanel left + Preview center + LaserSettingsPanel right) */}
      <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Workbed Preview */}
        <div className="order-1 md:order-2 h-[44vh] min-h-[240px] md:h-full md:flex-1 md:min-w-0 flex flex-col border-b md:border-b-0 border-slate-200 overflow-hidden">
          <WorkbedCanvas
            paths={paths}
            layers={layers}
            bedWidthMm={bedWidthMm}
            bedHeightMm={bedHeightMm}
            bedBackground={bedBackground}
            onBedBackgroundChange={setBedBackground}
            originMode={originMode}
            stats={stats}
            onFitToBed={handleFitPathsToBed}
          />
        </div>

        {/* Left Sidebar (Full GeneratorPanel on lg+, Tabbed Generator/Laser on <lg) */}
        <div className="order-2 md:order-1 flex-1 min-h-0 md:flex-none md:w-72 xl:w-80 md:h-full md:border-r border-slate-200 flex flex-col bg-white overflow-hidden">
          <div className="lg:hidden shrink-0 grid grid-cols-2 gap-1 p-1.5 bg-slate-100 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setCompactPanelTab('params')}
              className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                compactPanelTab === 'params'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Parametri Disegno
            </button>
            <button
              type="button"
              onClick={() => setCompactPanelTab('laser')}
              className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                compactPanelTab === 'laser'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Legno &amp; LaserGRBL
            </button>
          </div>

          <div
            className={`flex-1 min-h-0 overflow-hidden ${
              compactPanelTab === 'params' ? 'block' : 'hidden lg:block'
            }`}
          >
            <GeneratorPanel
              mode={mode}
              mandala={mandala}
              onMandalaChange={setMandala}
              cutout={cutout}
              onCutoutChange={setCutout}
              box={box}
              onBoxChange={setBox}
              hinge={hinge}
              onHingeChange={setHinge}
              sign={sign}
              onSignChange={setSign}
              gear={gear}
              onGearChange={setGear}
              tracer={tracer}
              onTracerChange={setTracer}
              tracerPreviewSrc={tracerImageSrc}
              onLoadSampleTemplate={handleLoadSampleTemplate}
              onUploadRasterImage={setTracerImageSrc}
              svgInputText={svgInputText}
              svgTargetWidthMm={svgTargetWidthMm}
              onSvgTargetWidthChange={setSvgTargetWidthMm}
              onImportSvgText={setSvgInputText}
              onCenterOnBed={() => setPaths((p) => centerPathsOnBed(p, bedWidthMm, bedHeightMm))}
              onRotate90={() => setPaths((p) => rotatePaths(p, 90))}
              onScaleFactor={(f) => setPaths((p) => scalePaths(p, f, f))}
            />
          </div>

          <div
            className={`flex-1 min-h-0 overflow-hidden lg:hidden ${
              compactPanelTab === 'laser' ? 'block' : 'hidden'
            }`}
          >
            <LaserSettingsPanel
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
              layers={layers}
              onUpdateLayer={handleUpdateLayer}
              bedWidthMm={bedWidthMm}
              bedHeightMm={bedHeightMm}
              onBedSizeChange={handleBedSizeChange}
              originMode={originMode}
              onOriginModeChange={setOriginMode}
              stats={stats}
            />
          </div>
        </div>

        {/* Right Sidebar (Desktop lg+ only) */}
        <div className="hidden lg:flex lg:order-3 lg:w-72 xl:w-80 shrink-0 h-full border-l border-slate-200 overflow-hidden">
          <LaserSettingsPanel
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            layers={layers}
            onUpdateLayer={handleUpdateLayer}
            bedWidthMm={bedWidthMm}
            bedHeightMm={bedHeightMm}
            onBedSizeChange={handleBedSizeChange}
            originMode={originMode}
            onOriginModeChange={setOriginMode}
            stats={stats}
          />
        </div>
      </main>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        projectTitle={activeTabInfo.title}
        paths={paths}
        layers={layers}
        bedWidthMm={bedWidthMm}
        bedHeightMm={bedHeightMm}
        originMode={originMode}
        selectedPresetId={selectedPresetId}
        stats={stats}
      />
    </div>
  );
}
