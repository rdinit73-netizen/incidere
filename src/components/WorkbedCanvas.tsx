import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Route,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { LAYER_ORDER } from '../data/woodPresets';
import {
  BedBackground,
  LaserLayerConfig,
  LayerType,
  OriginMode,
  Point2D,
  PolylinePath,
  ToolpathStats,
} from '../types/vector';
import { formatDuration, optimizePathOrder } from '../utils/geometry';

interface WorkbedCanvasProps {
  paths: PolylinePath[];
  layers: Record<LayerType, LaserLayerConfig>;
  bedWidthMm: number;
  bedHeightMm: number;
  bedBackground: BedBackground;
  onBedBackgroundChange: (bg: BedBackground) => void;
  originMode: OriginMode;
  stats: ToolpathStats;
  onFitToBed?: () => void;
}

interface SimSegment {
  from: Point2D;
  to: Point2D;
  isRapid: boolean;
  color: string;
  length: number;
}

export const WorkbedCanvas: React.FC<WorkbedCanvasProps> = ({
  paths,
  layers,
  bedWidthMm,
  bedHeightMm,
  bedBackground,
  onBedBackgroundChange,
  originMode,
  stats,
  onFitToBed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [showRapids, setShowRapids] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0); // 0 to 1
  const [simSpeed, setSimSpeed] = useState(1);

  const orderedPaths = useMemo(
    () => optimizePathOrder(paths.filter((p) => layers[p.layerId]?.visible && p.points.length >= 2)),
    [paths, layers]
  );

  // Build linear segments for toolpath visualization & laser-head simulation
  const { segments, totalSimLength } = useMemo(() => {
    const segs: SimSegment[] = [];
    let cursor: Point2D = { x: 0, y: bedHeightMm };
    if (originMode === 'center' && stats.bounds) {
      cursor = { x: stats.bounds.centerX, y: stats.bounds.centerY };
    } else if (stats.bounds) {
      cursor = { x: stats.bounds.minX, y: stats.bounds.maxY };
    }

    let totalLen = 0;

    for (const layerId of LAYER_ORDER) {
      const layer = layers[layerId];
      const layerPaths = orderedPaths.filter((p) => p.layerId === layerId);
      for (const p of layerPaths) {
        const first = p.points[0];
        const rapidLen = Math.hypot(first.x - cursor.x, first.y - cursor.y);
        if (rapidLen > 0.05) {
          segs.push({
            from: cursor,
            to: first,
            isRapid: true,
            color: '#94A3B8',
            length: rapidLen,
          });
          totalLen += rapidLen * 0.4; // Rapid moves travel faster in sim
        }

        for (let i = 1; i < p.points.length; i++) {
          const a = p.points[i - 1];
          const b = p.points[i];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len > 0.001) {
            segs.push({
              from: a,
              to: b,
              isRapid: false,
              color: layer.color,
              length: len,
            });
            totalLen += len;
          }
        }
        if (p.closed && p.points.length > 2) {
          const a = p.points[p.points.length - 1];
          const b = p.points[0];
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len > 0.001) {
            segs.push({
              from: a,
              to: b,
              isRapid: false,
              color: layer.color,
              length: len,
            });
            totalLen += len;
          }
          cursor = p.points[0];
        } else {
          cursor = p.points[p.points.length - 1];
        }
      }
    }

    return { segments: segs, totalSimLength: Math.max(1, totalLen) };
  }, [orderedPaths, layers, bedHeightMm, originMode, stats.bounds]);

  // Animation loop for laser simulator
  useEffect(() => {
    if (!isSimulating) return;
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setSimProgress((prev) => {
        const next = prev + dt * 0.14 * simSpeed;
        if (next >= 1) {
          setIsSimulating(false);
          return 1;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isSimulating, simSpeed]);

  // Stop simulation when paths change
  useEffect(() => {
    setIsSimulating(false);
    setSimProgress(0);
  }, [paths]);

  // Compute simulated laser head position
  const simLaserHead = useMemo(() => {
    if (simProgress <= 0 || segments.length === 0) return null;
    const targetDist = simProgress * totalSimLength;
    let acc = 0;
    for (const seg of segments) {
      const weight = seg.isRapid ? seg.length * 0.4 : seg.length;
      if (acc + weight >= targetDist) {
        const t = weight > 0 ? (targetDist - acc) / weight : 1;
        return {
          x: seg.from.x + (seg.to.x - seg.from.x) * t,
          y: seg.from.y + (seg.to.y - seg.from.y) * t,
          isRapid: seg.isRapid,
        };
      }
      acc += weight;
    }
    const last = segments[segments.length - 1];
    return { x: last.to.x, y: last.to.y, isRapid: last.isRapid };
  }, [simProgress, segments, totalSimLength]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((z) => Math.min(8, Math.max(0.45, z * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomToArtwork = () => {
    if (!stats.bounds) {
      resetView();
      return;
    }
    const b = stats.bounds;
    const scaleX = bedWidthMm / Math.max(20, b.width * 1.25);
    const scaleY = bedHeightMm / Math.max(20, b.height * 1.25);
    const newZoom = Math.min(5, Math.max(0.8, Math.min(scaleX, scaleY)));
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  };

  const woodBgStyles: Record<BedBackground, { bg: string; strokeMode: 'cad' | 'burned' }> = {
    grid: { bg: '#FFFFFF', strokeMode: 'cad' },
    poplar: { bg: '#EED9B7', strokeMode: 'burned' },
    birch: { bg: '#F4E7CF', strokeMode: 'burned' },
    mdf: { bg: '#B78C61', strokeMode: 'burned' },
    walnut: { bg: '#5C3D28', strokeMode: 'burned' },
  };

  const activeBg = woodBgStyles[bedBackground];
  const originPoint = useMemo(() => {
    if (originMode === 'center' && stats.bounds) {
      return { x: stats.bounds.centerX, y: stats.bounds.centerY };
    }
    if (stats.bounds) {
      return { x: stats.bounds.minX, y: stats.bounds.maxY };
    }
    return { x: 0, y: bedHeightMm };
  }, [originMode, stats.bounds, bedHeightMm]);

  const majorStep = bedWidthMm <= 160 ? 25 : 50;
  const minorStep = 10;
  const xTicks: number[] = [];
  for (let x = 0; x <= bedWidthMm; x += majorStep) xTicks.push(x);
  if (xTicks[xTicks.length - 1] !== bedWidthMm) xTicks.push(bedWidthMm);
  const yTicks: number[] = [];
  for (let y = 0; y <= bedHeightMm; y += majorStep) yTicks.push(y);
  if (yTicks[yTicks.length - 1] !== bedHeightMm) yTicks.push(bedHeightMm);

  const isOutOfBounds = Boolean(
    stats.bounds &&
      (stats.bounds.minX < -0.2 ||
        stats.bounds.minY < -0.2 ||
        stats.bounds.maxX > bedWidthMm + 0.2 ||
        stats.bounds.maxY > bedHeightMm + 0.2)
  );

  return (
    <div className="relative flex-1 flex flex-col bg-slate-100/90 overflow-hidden select-none">
      {/* Top Floating Canvas Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-slate-200 z-10">
        {/* Surface Preview Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1 whitespace-nowrap shrink-0">
            Superficie:
          </span>
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200/80">
            {(
              [
                { id: 'grid', label: 'Griglia CAD' },
                { id: 'poplar', label: 'Pioppo' },
                { id: 'birch', label: 'Betulla' },
                { id: 'mdf', label: 'MDF' },
                { id: 'walnut', label: 'Noce' },
              ] as { id: BedBackground; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onBedBackgroundChange(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  bedBackground === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Simulation & Rapid Moves Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRapids((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              showRapids
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Mostra spostamenti rapidi a laser spento (G0)"
          >
            <Route className="w-3.5 h-3.5" />
            <span>Spostamenti G0</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                if (simProgress >= 1) setSimProgress(0);
                setIsSimulating((s) => !s);
              }}
              disabled={segments.length === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-white text-slate-900 shadow-xs hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulating ? 'Pausa' : 'Simula Laser'}</span>
            </button>
            {simProgress > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsSimulating(false);
                  setSimProgress(0);
                }}
                className="p-1 text-slate-600 hover:text-slate-900 rounded"
                title="Azzera simulazione"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSimSpeed((s) => (s === 1 ? 3 : s === 3 ? 6 : 1))}
              className="px-2 py-1 text-xs font-mono text-slate-600 hover:text-slate-900 tabular-nums whitespace-nowrap shrink-0"
              title="Velocità simulazione"
            >
              {simSpeed}x
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive SVG Bed */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative flex-1 min-h-0 flex items-center justify-center overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="w-full h-full flex items-center justify-center p-3 sm:p-5 md:p-6"
        >
          <svg
            viewBox={`-18 -18 ${bedWidthMm + 36} ${bedHeightMm + 36}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full max-w-[680px] max-h-[680px] drop-shadow-sm"
          >
            <defs>
              {/* Subtle millimeter grid */}
              <pattern id="grid-minor" width={minorStep} height={minorStep} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${minorStep} 0 L 0 0 0 ${minorStep}`}
                  fill="none"
                  stroke={bedBackground === 'walnut' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}
                  strokeWidth={0.35 / Math.sqrt(zoom)}
                />
              </pattern>
              <pattern id="grid-major" width={majorStep} height={majorStep} patternUnits="userSpaceOnUse">
                <rect width={majorStep} height={majorStep} fill="url(#grid-minor)" />
                <path
                  d={`M ${majorStep} 0 L 0 0 0 ${majorStep}`}
                  fill="none"
                  stroke={bedBackground === 'walnut' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.13)'}
                  strokeWidth={0.55 / Math.sqrt(zoom)}
                />
              </pattern>

              {/* Procedural Wood Grain Filter */}
              <filter id="wood-grain" x="0" y="0" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.012 0.14"
                  numOctaves="3"
                  seed="7"
                  result="noise"
                />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0.18 0"
                  in="noise"
                  result="coloredNoise"
                />
                <feComposite operator="in" in2="SourceGraphic" />
              </filter>
            </defs>

            {/* Workbed Sheet */}
            <rect
              x={0}
              y={0}
              width={bedWidthMm}
              height={bedHeightMm}
              fill={activeBg.bg}
              stroke="#CBD5E1"
              strokeWidth={0.8}
              rx={1}
            />

            {bedBackground !== 'grid' && (
              <rect
                x={0}
                y={0}
                width={bedWidthMm}
                height={bedHeightMm}
                fill={activeBg.bg}
                filter="url(#wood-grain)"
                opacity={0.85}
                pointerEvents="none"
              />
            )}

            {/* Millimeter grid overlay */}
            <rect
              x={0}
              y={0}
              width={bedWidthMm}
              height={bedHeightMm}
              fill="url(#grid-major)"
              opacity={bedBackground === 'grid' ? 1 : 0.4}
              pointerEvents="none"
            />

            {/* Ruler labels in mm */}
            {xTicks.map((xt) => (
              <text
                key={`xt-${xt}`}
                x={xt}
                y={bedHeightMm + 8}
                textAnchor="middle"
                fontSize={5.5}
                fontFamily="JetBrains Mono, monospace"
                fill="#64748B"
              >
                {xt}
              </text>
            ))}
            {yTicks.map((yt) => (
              <text
                key={`yt-${yt}`}
                x={-6}
                y={bedHeightMm - yt + 2}
                textAnchor="end"
                fontSize={5.5}
                fontFamily="JetBrains Mono, monospace"
                fill="#64748B"
              >
                {yt}
              </text>
            ))}

            {/* G0 Rapid Travel Overlay */}
            {showRapids &&
              segments
                .filter((s) => s.isRapid)
                .map((s, idx) => (
                  <line
                    key={`rapid-${idx}`}
                    x1={s.from.x}
                    y1={s.from.y}
                    x2={s.to.x}
                    y2={s.to.y}
                    stroke="#64748B"
                    strokeWidth={0.35}
                    strokeDasharray="1.8 1.5"
                    opacity={0.75}
                  />
                ))}

            {/* Artwork Vector Paths ordered by LaserGRBL Layer */}
            {LAYER_ORDER.map((layerId) => {
              const layer = layers[layerId];
              if (!layer.visible) return null;
              const layerPaths = orderedPaths.filter((p) => p.layerId === layerId);

              const strokeColor =
                activeBg.strokeMode === 'cad'
                  ? layer.color
                  : bedBackground === 'walnut'
                  ? layerId === 'cut'
                    ? '#1C0F08'
                    : layerId === 'carve'
                    ? '#D6A97A'
                    : '#E2C6A6'
                  : layerId === 'cut'
                  ? '#1E1108'
                  : layerId === 'carve'
                  ? '#4E2A12'
                  : '#7C4D27';

              const strokeWidth =
                activeBg.strokeMode === 'cad'
                  ? layerId === 'cut'
                    ? 0.35
                    : layerId === 'carve'
                    ? 0.28
                    : 0.22
                  : layerId === 'cut'
                  ? 0.55
                  : layerId === 'carve'
                  ? 0.42
                  : 0.28;

              return (
                <g key={layerId} opacity={simProgress > 0 ? 0.25 : 1}>
                  {layerPaths.map((p) => {
                    const d =
                      p.points
                        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
                        .join(' ') + (p.closed ? ' Z' : '');
                    return (
                      <path
                        key={p.id}
                        d={d}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Progressive Simulation Burn Trail */}
            {simProgress > 0 &&
              (() => {
                const targetDist = simProgress * totalSimLength;
                let acc = 0;
                const drawn: React.ReactNode[] = [];
                for (let i = 0; i < segments.length; i++) {
                  const seg = segments[i];
                  const weight = seg.isRapid ? seg.length * 0.4 : seg.length;
                  if (acc >= targetDist) break;
                  if (acc + weight <= targetDist) {
                    if (!seg.isRapid) {
                      drawn.push(
                        <line
                          key={`sim-${i}`}
                          x1={seg.from.x}
                          y1={seg.from.y}
                          x2={seg.to.x}
                          y2={seg.to.y}
                          stroke={seg.color}
                          strokeWidth={0.7}
                          strokeLinecap="round"
                        />
                      );
                    }
                  } else {
                    const t = weight > 0 ? (targetDist - acc) / weight : 1;
                    if (!seg.isRapid) {
                      drawn.push(
                        <line
                          key={`sim-part-${i}`}
                          x1={seg.from.x}
                          y1={seg.from.y}
                          x2={seg.from.x + (seg.to.x - seg.from.x) * t}
                          y2={seg.from.y + (seg.to.y - seg.from.y) * t}
                          stroke={seg.color}
                          strokeWidth={0.75}
                          strokeLinecap="round"
                        />
                      );
                    }
                    break;
                  }
                  acc += weight;
                }
                return <g>{drawn}</g>;
              })()}

            {/* Active Laser Head Indicator */}
            {simLaserHead && (
              <g transform={`translate(${simLaserHead.x}, ${simLaserHead.y})`}>
                <circle
                  r={3.8}
                  fill="none"
                  stroke={simLaserHead.isRapid ? '#64748B' : '#EA580C'}
                  strokeWidth={0.6}
                  opacity={0.7}
                />
                <circle
                  r={1.6}
                  fill={simLaserHead.isRapid ? '#64748B' : '#F97316'}
                />
              </g>
            )}

            {/* Origin (X0 Y0) Marker */}
            <g transform={`translate(${originPoint.x}, ${originPoint.y})`} pointerEvents="none">
              <circle r={2.2} fill="none" stroke="#0F172A" strokeWidth={0.5} />
              <line x1={-4.5} y1={0} x2={4.5} y2={0} stroke="#0F172A" strokeWidth={0.45} />
              <line x1={0} y1={-4.5} x2={0} y2={4.5} stroke="#0F172A" strokeWidth={0.45} />
              <text
                x={3.5}
                y={-3}
                fontSize={4.8}
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
                fill="#0F172A"
              >
                0,0
              </text>
            </g>
          </svg>
        </div>

        {/* Bottom Overlay Bar (Telemetry + Zoom Controls, non-overlapping on all widths) */}
        <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto bg-white/92 backdrop-blur-xs border border-slate-200 rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[11px] sm:text-xs text-slate-600 shadow-xs">
            <span className="font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
              {stats.bounds
                ? `${stats.bounds.width.toFixed(1)} × ${stats.bounds.height.toFixed(1)} mm`
                : '0.0 × 0.0 mm'}
            </span>
            {isOutOfBounds && onFitToBed && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onFitToBed}
                  className="font-medium text-red-700 hover:text-red-800 underline underline-offset-2 whitespace-nowrap"
                >
                  Fuori piano ({bedWidthMm}×{bedHeightMm}) · Adatta
                </button>
              </>
            )}
            <span aria-hidden="true" className="hidden sm:inline text-slate-300">
              ·
            </span>
            <span className="hidden sm:inline font-mono tabular-nums whitespace-nowrap">
              {stats.totalPaths} tracciati
            </span>
            <span aria-hidden="true" className="hidden md:inline text-slate-300">
              ·
            </span>
            <span className="hidden md:inline font-mono tabular-nums whitespace-nowrap">
              {(stats.cutLengthMm / 1000).toFixed(2)} m taglio
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono font-medium text-amber-700 tabular-nums whitespace-nowrap">
              ~{formatDuration(stats.estimatedSeconds)}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-0.5 bg-white/95 border border-slate-200 rounded-md p-1 shadow-xs ml-auto">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.45, z * 0.85))}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Riduci zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-xs font-mono text-slate-700 tabular-nums min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(8, z * 1.18))}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Aumenta zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={zoomToArtwork}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Adatta al disegno"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
              title="Centra piano lavoro"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Simulation Progress Bar (only visible during or after simulation) */}
      {simProgress > 0 && (
        <div className="h-1 bg-slate-200 w-full">
          <div
            className="h-full bg-amber-600 transition-all duration-75"
            style={{ width: `${Math.round(simProgress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
