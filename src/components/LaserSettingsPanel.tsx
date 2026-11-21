import React from 'react';
import { Eye, EyeOff, Wind } from 'lucide-react';
import { LAYER_ORDER, WOOD_PRESETS } from '../data/woodPresets';
import {
  LaserLayerConfig,
  LayerType,
  OriginMode,
  ToolpathStats,
} from '../types/vector';
import { formatDuration } from '../utils/geometry';

interface LaserSettingsPanelProps {
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  layers: Record<LayerType, LaserLayerConfig>;
  onUpdateLayer: (layerId: LayerType, patch: Partial<LaserLayerConfig>) => void;
  bedWidthMm: number;
  bedHeightMm: number;
  onBedSizeChange: (w: number, h: number) => void;
  originMode: OriginMode;
  onOriginModeChange: (m: OriginMode) => void;
  stats: ToolpathStats;
}

export const LaserSettingsPanel: React.FC<LaserSettingsPanelProps> = ({
  selectedPresetId,
  onSelectPreset,
  layers,
  onUpdateLayer,
  bedWidthMm,
  bedHeightMm,
  onBedSizeChange,
  originMode,
  onOriginModeChange,
  stats,
}) => {
  const activePreset = WOOD_PRESETS.find((p) => p.id === selectedPresetId);

  return (
    <aside className="w-full h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <h2 className="text-sm font-semibold text-slate-900">Parametri LaserGRBL & Legno</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Ordine automatico: Incisione → Intaglio → Taglio
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Wood Material Preset */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 block">
            Profilo legno e spessore
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-900 focus:border-amber-600 focus:outline-none"
          >
            {WOOD_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          {activePreset && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span>{activePreset.laserPowerNote}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Spessore {activePreset.thicknessMm} mm</span>
            </div>
          )}
        </div>

        {/* Bed & Origin Configuration */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-medium text-slate-700 block">Area laser (mm)</label>
            <select
              value={`${bedWidthMm}x${bedHeightMm}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                onBedSizeChange(w, h);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono text-slate-900 focus:border-amber-600 focus:outline-none"
            >
              <option value="200x200">200 × 200</option>
              <option value="300x300">300 × 300</option>
              <option value="400x400">400 × 400</option>
              <option value="420x400">420 × 400</option>
            </select>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-medium text-slate-700 block">Origine X0 Y0</label>
            <select
              value={originMode}
              onChange={(e) => onOriginModeChange(e.target.value as OriginMode)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-amber-600 focus:outline-none"
            >
              <option value="bottom-left">Basso-Sinistra</option>
              <option value="center">Centro Pezzo</option>
            </select>
          </div>
        </div>

        {/* Layers List */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Livelli di lavorazione</span>
            <span className="text-[11px] font-mono text-slate-500">GRBL $30=1000</span>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-md overflow-hidden">
            {LAYER_ORDER.map((layerId, idx) => {
              const layer = layers[layerId];
              const layerStat = stats.layerBreakdown[layerId];

              return (
                <div
                  key={layerId}
                  className={`p-3 space-y-2.5 transition-colors ${
                    layer.visible ? 'bg-white' : 'bg-slate-50/70 opacity-65'
                  }`}
                >
                  {/* Layer Title Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {idx + 1}. {layer.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {layerStat.paths} tr.
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateLayer(layerId, { visible: !layer.visible })}
                        className="p-1 text-slate-500 hover:text-slate-900 rounded"
                        title={layer.visible ? 'Nascondi livello' : 'Mostra livello'}
                      >
                        {layer.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Speed / Power / Passes Inputs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        Vel. (mm/m)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={6000}
                        step={20}
                        value={layer.speed}
                        onChange={(e) =>
                          onUpdateLayer(layerId, {
                            speed: Math.max(50, Number(e.target.value) || 50),
                          })
                        }
                        className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs font-mono text-slate-900 tabular-nums focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        Pot. (S max)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        step={10}
                        value={layer.power}
                        onChange={(e) =>
                          onUpdateLayer(layerId, {
                            power: Math.min(1000, Math.max(10, Number(e.target.value) || 100)),
                          })
                        }
                        className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs font-mono text-slate-900 tabular-nums focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Passaggi</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        step={1}
                        value={layer.passes}
                        onChange={(e) =>
                          onUpdateLayer(layerId, {
                            passes: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                          })
                        }
                        className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs font-mono text-slate-900 tabular-nums focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Mode & Air Assist Row */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLayer(layerId, {
                            laserMode: layer.laserMode === 'M4' ? 'M3' : 'M4',
                          })
                        }
                        className="px-1.5 py-0.5 font-mono rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        title="M4 = Potenza dinamica (consigliata), M3 = Potenza costante"
                      >
                        {layer.laserMode}
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateLayer(layerId, { airAssist: !layer.airAssist })}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                          layer.airAssist
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Attiva comando M8/M9 Air Assist nel G-Code"
                      >
                        <Wind className="w-3 h-3" />
                        <span>Air M8</span>
                      </button>
                    </div>

                    <span className="font-mono text-slate-500 tabular-nums">
                      {(layerStat.lengthMm / 1000).toFixed(2)}m ·{' '}
                      {formatDuration(layerStat.estimatedSeconds)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Summary Table */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Tempo stimato lavorazione</span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {formatDuration(stats.estimatedSeconds)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Spostamenti rapidi (G0)</span>
          <span className="font-mono text-slate-700 tabular-nums">
            {(stats.rapidLengthMm / 1000).toFixed(2)} m
          </span>
        </div>
      </div>
    </aside>
  );
};
