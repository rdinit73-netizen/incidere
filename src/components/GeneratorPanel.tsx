import React, { useRef } from 'react';
import {
  AlignCenter,
  FileCode2,
  RotateCw,
  Upload,
} from 'lucide-react';
import {
  BoxParams,
  CutoutParams,
  GearParams,
  GeneratorMode,
  HingeParams,
  MandalaParams,
  SignParams,
  TracerParams,
} from '../types/vector';
import { SampleTemplateId } from '../utils/rasterTracer';

interface GeneratorPanelProps {
  mode: GeneratorMode;
  mandala: MandalaParams;
  onMandalaChange: (next: MandalaParams) => void;
  cutout: CutoutParams;
  onCutoutChange: (next: CutoutParams) => void;
  box: BoxParams;
  onBoxChange: (next: BoxParams) => void;
  hinge: HingeParams;
  onHingeChange: (next: HingeParams) => void;
  sign: SignParams;
  onSignChange: (next: SignParams) => void;
  gear: GearParams;
  onGearChange: (next: GearParams) => void;
  tracer: TracerParams;
  onTracerChange: (next: TracerParams) => void;
  tracerPreviewSrc: string;
  onLoadSampleTemplate: (id: SampleTemplateId) => void;
  onUploadRasterImage: (dataUrl: string) => void;
  svgInputText: string;
  svgTargetWidthMm: number;
  onSvgTargetWidthChange: (w: number) => void;
  onImportSvgText: (svgText: string) => void;
  onCenterOnBed: () => void;
  onRotate90: () => void;
  onScaleFactor: (factor: number) => void;
}

const RangeRow: React.FC<{
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}> = ({ label, value, unit = '', min, max, step = 1, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <label className="font-medium text-slate-700">{label}</label>
      <span className="font-mono text-slate-900 tabular-nums">
        {Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1)}
        {unit && <span className="text-slate-500 ml-0.5">{unit}</span>}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
    />
  </div>
);

export const GeneratorPanel: React.FC<GeneratorPanelProps> = ({
  mode,
  mandala,
  onMandalaChange,
  cutout,
  onCutoutChange,
  box,
  onBoxChange,
  hinge,
  onHingeChange,
  sign,
  onSignChange,
  gear,
  onGearChange,
  tracer,
  onTracerChange,
  tracerPreviewSrc,
  onLoadSampleTemplate,
  onUploadRasterImage,
  svgInputText,
  svgTargetWidthMm,
  onSvgTargetWidthChange,
  onImportSvgText,
  onCenterOnBed,
  onRotate90,
  onScaleFactor,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadRasterImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSvgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportSvgText(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const modeTitles: Record<GeneratorMode, { title: string; desc: string }> = {
    mandala: {
      title: 'Mandala & Rosoni',
      desc: 'Geometria radiale multi-livello per intagli, orologi da parete e decorazioni.',
    },
    cutout: {
      title: 'Ritaglio & Sagome',
      desc: 'Scritte unite in un pezzo unico e sagome bordo-bordo da staccare dal legno.',
    },
    box: {
      title: 'Scatola a Incastro',
      desc: 'Pannelli con denti a pettine compensati per taglio laser (kerf).',
    },
    hinge: {
      title: 'Cerniera Flessibile',
      desc: 'Intagli sfalsati per curvare il compensato senza rotture.',
    },
    sign: {
      title: 'Targhe & Testo CNC',
      desc: 'Testo vettoriale a tratto singolo (nessun font di sistema richiesto da LaserGRBL).',
    },
    gear: {
      title: 'Ingranaggi & Sottobicchieri',
      desc: 'Ruote dentate modulari o sottobicchieri geometrici pronti al taglio.',
    },
    tracer: {
      title: 'Immagine in Vettore',
      desc: 'Vettorizza foto, loghi o silhouette in contorni e intagli a tratteggio.',
    },
    svg_import: {
      title: 'Importa & Converti SVG',
      desc: 'Carica un SVG esistente per ridimensionarlo e generare il G-Code LaserGRBL.',
    },
  };

  return (
    <aside className="w-full h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <h2 className="text-sm font-semibold text-slate-900">{modeTitles[mode].title}</h2>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{modeTitles[mode].desc}</p>
      </div>

      {/* Scrollable Controls */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {mode === 'mandala' && (
          <>
            <RangeRow
              label="Diametro esterno"
              value={mandala.diameterMm}
              unit=" mm"
              min={60}
              max={280}
              step={2}
              onChange={(v) => onMandalaChange({ ...mandala, diameterMm: v })}
            />
            <RangeRow
              label="Simmetria radiale"
              value={mandala.symmetry}
              unit=" assi"
              min={6}
              max={24}
              step={1}
              onChange={(v) => onMandalaChange({ ...mandala, symmetry: v })}
            />
            <RangeRow
              label="Anelli concentrici"
              value={mandala.rings}
              min={2}
              max={6}
              step={1}
              onChange={(v) => onMandalaChange({ ...mandala, rings: v })}
            />
            <RangeRow
              label="Foro centrale (es. orologio)"
              value={mandala.centerHoleMm}
              unit=" mm"
              min={0}
              max={24}
              step={0.5}
              onChange={(v) => onMandalaChange({ ...mandala, centerHoleMm: v })}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Stile petali</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'lotus', label: 'Loto' },
                    { id: 'geometric', label: 'Rombi' },
                    { id: 'floral', label: 'Floreale' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onMandalaChange({ ...mandala, petalStyle: item.id })}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      mandala.petalStyle === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Sagoma taglio</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'circle', label: 'Cerchio' },
                    { id: 'scalloped', label: 'Smerlato' },
                    { id: 'octagon', label: 'Poligono' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onMandalaChange({ ...mandala, outerShape: item.id })}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      mandala.outerShape === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Foro superiore per appendere</span>
                <input
                  type="checkbox"
                  checked={mandala.hangingHole}
                  onChange={(e) => onMandalaChange({ ...mandala, hangingHole: e.target.checked })}
                  className="rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Riempimento a tratteggio (Intaglio)</span>
                <input
                  type="checkbox"
                  checked={mandala.addCarveHatch}
                  onChange={(e) => onMandalaChange({ ...mandala, addCarveHatch: e.target.checked })}
                  className="rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                />
              </label>
            </div>
          </>
        )}

        {mode === 'cutout' && (
          <>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => onCutoutChange({ ...cutout, mode: 'word' })}
                className={`py-1.5 text-xs font-medium rounded transition-colors ${
                  cutout.mode === 'word'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Scritta Unita
              </button>
              <button
                type="button"
                onClick={() => onCutoutChange({ ...cutout, mode: 'shape' })}
                className={`py-1.5 text-xs font-medium rounded transition-colors ${
                  cutout.mode === 'shape'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sagoma Pura
              </button>
            </div>

            {cutout.mode === 'word' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Parola da ritagliare in pezzo unico
                  </label>
                  <input
                    type="text"
                    value={cutout.text}
                    onChange={(e) => onCutoutChange({ ...cutout, text: e.target.value })}
                    placeholder="Es. Marco, Casa, Auguri"
                    className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Come unire le lettere
                  </label>
                  <div className="grid grid-cols-1 gap-1 p-1 bg-slate-100 rounded-md">
                    {(
                      [
                        { id: 'base_bar', label: 'Base di appoggio (tutte su barra)' },
                        { id: 'direct_overlap', label: 'Fusione diretta (corsivo / strette)' },
                        { id: 'bubble_offset', label: 'Sagoma esterna continua (bolla)' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onCutoutChange({ ...cutout, joinMode: item.id })}
                        className={`py-1.5 px-2.5 text-left text-xs font-medium rounded transition-colors ${
                          cutout.joinMode === item.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">Stile carattere</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                    {(
                      [
                        { id: 'script', label: 'Corsivo' },
                        { id: 'bold', label: 'Grassetto' },
                        { id: 'serif', label: 'Classico' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onCutoutChange({ ...cutout, fontStyle: item.id })}
                        className={`py-1.5 text-xs font-medium rounded transition-colors ${
                          cutout.fontStyle === item.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <RangeRow
                  label="Altezza lettere"
                  value={cutout.fontSizeMm}
                  unit=" mm"
                  min={18}
                  max={75}
                  step={1}
                  onChange={(v) => onCutoutChange({ ...cutout, fontSizeMm: v })}
                />

                <RangeRow
                  label="Avvicinamento lettere"
                  value={cutout.letterSpacingMm}
                  unit=" mm"
                  min={-6}
                  max={4}
                  step={0.5}
                  onChange={(v) => onCutoutChange({ ...cutout, letterSpacingMm: v })}
                />

                {cutout.joinMode === 'base_bar' && (
                  <RangeRow
                    label="Spessore barra di base"
                    value={cutout.baseBarHeightMm}
                    unit=" mm"
                    min={4}
                    max={18}
                    step={0.5}
                    onChange={(v) => onCutoutChange({ ...cutout, baseBarHeightMm: v })}
                  />
                )}

                {cutout.joinMode === 'bubble_offset' && (
                  <>
                    <RangeRow
                      label="Margine sagoma esterna"
                      value={cutout.offsetMarginMm}
                      unit=" mm"
                      min={2}
                      max={12}
                      step={0.5}
                      onChange={(v) => onCutoutChange({ ...cutout, offsetMarginMm: v })}
                    />
                    <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                      <span>Incidi anche il testo interno</span>
                      <input
                        type="checkbox"
                        checked={cutout.engraveInnerText}
                        onChange={(e) =>
                          onCutoutChange({ ...cutout, engraveInnerText: e.target.checked })
                        }
                        className="rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                      />
                    </label>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Sagoma da ritagliare
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                    {(
                      [
                        { id: 'heart', label: 'Cuore' },
                        { id: 'star', label: 'Stella' },
                        { id: 'cloud', label: 'Nuvola' },
                        { id: 'shield', label: 'Scudo' },
                        { id: 'tag', label: 'Etichetta' },
                        { id: 'hexagon', label: 'Esagono' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onCutoutChange({ ...cutout, shapeType: item.id })}
                        className={`py-1.5 text-xs font-medium rounded transition-colors ${
                          cutout.shapeType === item.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <RangeRow
                  label="Larghezza sagoma"
                  value={cutout.shapeWidthMm}
                  unit=" mm"
                  min={25}
                  max={220}
                  step={5}
                  onChange={(v) => onCutoutChange({ ...cutout, shapeWidthMm: v })}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Scritta interna incisa (opzionale)
                  </label>
                  <input
                    type="text"
                    value={cutout.shapeLabel}
                    onChange={(e) => onCutoutChange({ ...cutout, shapeLabel: e.target.value })}
                    placeholder="Lascia vuoto per solo ritaglio"
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>

                {cutout.attachment === 'none' && (
                  <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                    <span>Foro interno per appendere</span>
                    <input
                      type="checkbox"
                      checked={cutout.shapeHole}
                      onChange={(e) => onCutoutChange({ ...cutout, shapeHole: e.target.checked })}
                      className="rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                    />
                  </label>
                )}
              </>
            )}

            <div className="space-y-1.5 pt-1 border-t border-slate-200">
              <label className="text-xs font-medium text-slate-700 block">
                Accessorio fuso sul taglio
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'none', label: 'Nessuno' },
                    { id: 'keyring', label: 'Portachiavi' },
                    { id: 'topper_stick', label: 'Cake Topper' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onCutoutChange({ ...cutout, attachment: item.id })}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      cutout.attachment === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                I fori interni (es. o, a, e, portachiavi) vengono tagliati automaticamente prima del bordo esterno.
              </p>
            </div>
          </>
        )}

        {mode === 'box' && (
          <>
            <RangeRow
              label="Larghezza (X)"
              value={box.widthMm}
              unit=" mm"
              min={40}
              max={130}
              step={2}
              onChange={(v) => onBoxChange({ ...box, widthMm: v })}
            />
            <RangeRow
              label="Profondità (Y)"
              value={box.depthMm}
              unit=" mm"
              min={40}
              max={130}
              step={2}
              onChange={(v) => onBoxChange({ ...box, depthMm: v })}
            />
            <RangeRow
              label="Altezza (Z)"
              value={box.heightMm}
              unit=" mm"
              min={30}
              max={110}
              step={2}
              onChange={(v) => onBoxChange({ ...box, heightMm: v })}
            />

            <div className="h-px bg-slate-200" />

            <RangeRow
              label="Spessore legno"
              value={box.thicknessMm}
              unit=" mm"
              min={2}
              max={8}
              step={0.5}
              onChange={(v) => onBoxChange({ ...box, thicknessMm: v })}
            />
            <RangeRow
              label="Compensazione Kerf (taglio laser)"
              value={box.kerfMm}
              unit=" mm"
              min={0}
              max={0.3}
              step={0.02}
              onChange={(v) => onBoxChange({ ...box, kerfMm: v })}
            />
            <RangeRow
              label="Larghezza denti incastro"
              value={box.fingerWidthMm}
              unit=" mm"
              min={6}
              max={24}
              step={1}
              onChange={(v) => onBoxChange({ ...box, fingerWidthMm: v })}
            />

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Includi coperchio superiore</span>
                <input
                  type="checkbox"
                  checked={box.hasLid}
                  onChange={(e) => onBoxChange({ ...box, hasLid: e.target.checked })}
                  className="rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                />
              </label>

              {box.hasLid && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">Stile coperchio</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                    <button
                      type="button"
                      onClick={() => onBoxChange({ ...box, lidStyle: 'flat' })}
                      className={`py-1.5 text-xs font-medium rounded transition-colors ${
                        box.lidStyle === 'flat'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Chiuso pieno
                    </button>
                    <button
                      type="button"
                      onClick={() => onBoxChange({ ...box, lidStyle: 'slot_handle' })}
                      className={`py-1.5 text-xs font-medium rounded transition-colors ${
                        box.lidStyle === 'slot_handle'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Con fessura presa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {mode === 'hinge' && (
          <>
            <RangeRow
              label="Larghezza pannello"
              value={hinge.widthMm}
              unit=" mm"
              min={40}
              max={260}
              step={5}
              onChange={(v) => onHingeChange({ ...hinge, widthMm: v })}
            />
            <RangeRow
              label="Altezza pannello"
              value={hinge.heightMm}
              unit=" mm"
              min={30}
              max={200}
              step={5}
              onChange={(v) => onHingeChange({ ...hinge, heightMm: v })}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Trama flessibile</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'straight', label: 'Lineare' },
                    { id: 'wave', label: 'Onda' },
                    { id: 'diamond', label: 'Rombo' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onHingeChange({ ...hinge, pattern: item.id })}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      hinge.pattern === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <RangeRow
              label="Passo tra colonne"
              value={hinge.slotSpacingMm}
              unit=" mm"
              min={2.2}
              max={8}
              step={0.2}
              onChange={(v) => onHingeChange({ ...hinge, slotSpacingMm: v })}
            />
            <RangeRow
              label="Lunghezza singolo taglio"
              value={hinge.cutLengthMm}
              unit=" mm"
              min={10}
              max={50}
              step={2}
              onChange={(v) => onHingeChange({ ...hinge, cutLengthMm: v })}
            />
            <RangeRow
              label="Ponticello di tenuta"
              value={hinge.bridgeMm}
              unit=" mm"
              min={2}
              max={8}
              step={0.5}
              onChange={(v) => onHingeChange({ ...hinge, bridgeMm: v })}
            />
            <RangeRow
              label="Raggio angoli esterni"
              value={hinge.cornerRadiusMm}
              unit=" mm"
              min={0}
              max={15}
              step={1}
              onChange={(v) => onHingeChange({ ...hinge, cornerRadiusMm: v })}
            />
          </>
        )}

        {mode === 'sign' && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Testo da incidere (multilinea)
              </label>
              <textarea
                rows={3}
                value={sign.text}
                onChange={(e) => onSignChange({ ...sign, text: e.target.value })}
                placeholder="Scrivi qui il testo..."
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Forma targhetta</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'rounded', label: 'Smussata' },
                    { id: 'chamfer', label: 'Ottagonale' },
                    { id: 'ticket', label: 'Vintage' },
                    { id: 'arch', label: 'Ad Arco' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSignChange({ ...sign, shape: item.id })}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      sign.shape === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <RangeRow
              label="Larghezza targa"
              value={sign.widthMm}
              unit=" mm"
              min={60}
              max={280}
              step={5}
              onChange={(v) => onSignChange({ ...sign, widthMm: v })}
            />
            <RangeRow
              label="Altezza targa"
              value={sign.heightMm}
              unit=" mm"
              min={30}
              max={180}
              step={5}
              onChange={(v) => onSignChange({ ...sign, heightMm: v })}
            />
            <RangeRow
              label="Altezza caratteri"
              value={sign.fontSizeMm}
              unit=" mm"
              min={8}
              max={42}
              step={1}
              onChange={(v) => onSignChange({ ...sign, fontSizeMm: v })}
            />
            <RangeRow
              label="Spaziatura lettere"
              value={sign.letterSpacing}
              unit="x"
              min={0.85}
              max={1.6}
              step={0.05}
              onChange={(v) => onSignChange({ ...sign, letterSpacing: v })}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Tratto font CNC</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => onSignChange({ ...sign, strokeStyle: 'single' })}
                  className={`py-1.5 text-xs font-medium rounded transition-colors ${
                    sign.strokeStyle === 'single'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Linea singola
                </button>
                <button
                  type="button"
                  onClick={() => onSignChange({ ...sign, strokeStyle: 'double_bold' })}
                  className={`py-1.5 text-xs font-medium rounded transition-colors ${
                    sign.strokeStyle === 'double_bold'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Doppio tratto
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Livello testo</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => onSignChange({ ...sign, engravingLayer: 'engrave' })}
                  className={`py-1.5 text-xs font-medium rounded transition-colors ${
                    sign.engravingLayer === 'engrave'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Incisione fine
                </button>
                <button
                  type="button"
                  onClick={() => onSignChange({ ...sign, engravingLayer: 'carve' })}
                  className={`py-1.5 text-xs font-medium rounded transition-colors ${
                    sign.engravingLayer === 'carve'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Intaglio marcato
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Fori fissaggio</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'none', label: 'Nessuno' },
                    { id: 'two_side', label: '2 Lati' },
                    { id: 'four_corner', label: '4 Angoli' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSignChange({ ...sign, mountingHoles: item.id })}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      sign.mountingHoles === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
              <span>Cornice decorativa incisa</span>
              <input
                type="checkbox"
                checked={sign.innerBorder}
                onChange={(e) => onSignChange({ ...sign, innerBorder: e.target.checked })}
                className="rounded border-slate-300 text-amber-700 focus:ring-amber-600"
              />
            </label>
          </>
        )}

        {mode === 'gear' && (
          <>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => onGearChange({ ...gear, mode: 'gear' })}
                className={`py-1.5 text-xs font-medium rounded transition-colors ${
                  gear.mode === 'gear'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ingranaggio
              </button>
              <button
                type="button"
                onClick={() => onGearChange({ ...gear, mode: 'coaster' })}
                className={`py-1.5 text-xs font-medium rounded transition-colors ${
                  gear.mode === 'coaster'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sottobicchiere
              </button>
            </div>

            {gear.mode === 'gear' ? (
              <>
                <RangeRow
                  label="Numero denti (Z)"
                  value={gear.teeth}
                  min={10}
                  max={48}
                  step={1}
                  onChange={(v) => onGearChange({ ...gear, teeth: v })}
                />
                <RangeRow
                  label="Modulo dente"
                  value={gear.moduleMm}
                  unit=" mm"
                  min={2}
                  max={8}
                  step={0.5}
                  onChange={(v) => onGearChange({ ...gear, moduleMm: v })}
                />
                <RangeRow
                  label="Diametro foro centrale"
                  value={gear.boreMm}
                  unit=" mm"
                  min={3}
                  max={25}
                  step={0.5}
                  onChange={(v) => onGearChange({ ...gear, boreMm: v })}
                />
                <RangeRow
                  label="Raggi alleggerimento"
                  value={gear.spokes}
                  min={0}
                  max={6}
                  step={1}
                  onChange={(v) => onGearChange({ ...gear, spokes: v })}
                />
              </>
            ) : (
              <>
                <RangeRow
                  label="Diametro sottobicchiere"
                  value={gear.coasterDiameterMm}
                  unit=" mm"
                  min={70}
                  max={140}
                  step={2}
                  onChange={(v) => onGearChange({ ...gear, coasterDiameterMm: v })}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">Motivo inciso</label>
                  <div className="grid grid-cols-1 gap-1 p-1 bg-slate-100 rounded-md">
                    {(
                      [
                        { id: 'hex_grid', label: 'Alveare Esagonale' },
                        { id: 'celtic_star', label: 'Stella Intrecciata' },
                        { id: 'concentric_waves', label: 'Onde Concentriche' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onGearChange({ ...gear, coasterPattern: item.id })}
                        className={`py-1.5 px-2.5 text-left text-xs font-medium rounded transition-colors ${
                          gear.coasterPattern === item.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {mode === 'tracer' && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Carica Immagine (PNG / JPG)</span>
            </button>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-700 block">
                Oppure usa un modello pronto:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'compass', label: 'Rosa dei Venti' },
                    { id: 'tree', label: 'Abete Alpino' },
                    { id: 'leaf', label: 'Foglia Botanica' },
                    { id: 'mountains', label: 'Montagne & Sole' },
                  ] as { id: SampleTemplateId; label: string }[]
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onLoadSampleTemplate(tpl.id)}
                    className="py-1.5 px-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded transition-colors text-left truncate"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {tracerPreviewSrc && (
              <div className="border border-slate-200 rounded-md p-2 bg-slate-50 flex items-center gap-3">
                <img
                  src={tracerPreviewSrc}
                  alt="Sorgente tracciamento"
                  className="w-12 h-12 object-contain bg-white border border-slate-200 rounded"
                />
                <div className="text-xs text-slate-600 leading-snug">
                  <div className="font-medium text-slate-900">Sorgente attiva</div>
                  <div>Regola soglia e riempimento sotto.</div>
                </div>
              </div>
            )}

            <RangeRow
              label="Larghezza finale su legno"
              value={tracer.targetWidthMm}
              unit=" mm"
              min={30}
              max={260}
              step={5}
              onChange={(v) => onTracerChange({ ...tracer, targetWidthMm: v })}
            />
            <RangeRow
              label="Soglia bianco/nero"
              value={tracer.threshold}
              min={20}
              max={235}
              step={5}
              onChange={(v) => onTracerChange({ ...tracer, threshold: v })}
            />
            <RangeRow
              label="Semplificazione punti"
              value={tracer.simplifyEpsilon}
              unit=" mm"
              min={0.05}
              max={1.5}
              step={0.05}
              onChange={(v) => onTracerChange({ ...tracer, simplifyEpsilon: v })}
            />
            <RangeRow
              label="Filtro dettagli minimi"
              value={tracer.minAreaPx}
              unit=" px²"
              min={4}
              max={120}
              step={4}
              onChange={(v) => onTracerChange({ ...tracer, minAreaPx: v })}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Modalità intaglio vettoriale
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'outline', label: 'Solo Contorni' },
                    { id: 'hatch_0', label: 'Tratteggio 0°' },
                    { id: 'hatch_45', label: 'Tratteggio 45°' },
                    { id: 'crosshatch', label: 'Incrociato' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTracerChange({ ...tracer, fillMode: item.id })}
                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                      tracer.fillMode === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {tracer.fillMode === 'outline' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">
                  Livello destinazione contorni
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                  {(
                    [
                      { id: 'cut', label: 'Taglio' },
                      { id: 'carve', label: 'Intaglio' },
                      { id: 'engrave', label: 'Incisione' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTracerChange({ ...tracer, outlineLayer: item.id })}
                      className={`py-1.5 text-xs font-medium rounded transition-colors ${
                        tracer.outlineLayer === item.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <RangeRow
                label="Passo riempimento"
                value={tracer.hatchSpacingMm}
                unit=" mm"
                min={0.35}
                max={2.5}
                step={0.05}
                onChange={(v) => onTracerChange({ ...tracer, hatchSpacingMm: v })}
              />
            )}

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">
                  Taglio esterno attorno al disegno
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                  {(
                    [
                      { id: 'none', label: 'Nessuno' },
                      { id: 'rectangle', label: 'Rettangolo' },
                      { id: 'silhouette', label: 'Sagoma' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const nextOutline =
                          item.id === 'silhouette' && tracer.outlineLayer === 'cut'
                            ? 'engrave'
                            : tracer.outlineLayer;
                        onTracerChange({
                          ...tracer,
                          cutFrameMode: item.id,
                          outlineLayer: nextOutline,
                        });
                      }}
                      className={`py-1.5 text-xs font-medium rounded transition-colors ${
                        tracer.cutFrameMode === item.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {tracer.cutFrameMode !== 'none' && (
                <RangeRow
                  label="Margine taglio esterno"
                  value={tracer.frameMarginMm}
                  unit=" mm"
                  min={2}
                  max={16}
                  step={0.5}
                  onChange={(v) => onTracerChange({ ...tracer, frameMarginMm: v })}
                />
              )}

              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Inverti aree chiare/scure</span>
                <input
                  type="checkbox"
                  checked={tracer.invert}
                  onChange={(e) => onTracerChange({ ...tracer, invert: e.target.checked })}
                  className="rounded border-slate-300 text-amber-700 focus:ring-amber-600"
                />
              </label>
            </div>
          </>
        )}

        {mode === 'svg_import' && (
          <>
            <input
              ref={svgInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handleSvgFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => svgInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Carica file .SVG dal PC</span>
            </button>

            <RangeRow
              label="Scala larghezza su legno"
              value={svgTargetWidthMm}
              unit=" mm"
              min={20}
              max={280}
              step={5}
              onChange={onSvgTargetWidthChange}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Oppure incolla codice SVG
              </label>
              <textarea
                rows={6}
                value={svgInputText}
                onChange={(e) => onImportSvgText(e.target.value)}
                placeholder="<svg viewBox='0 0 100 100'>...</svg>"
                className="w-full rounded-md border border-slate-300 p-2 text-xs font-mono text-slate-800 focus:border-amber-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                I tracciati rossi vengono assegnati al Taglio, quelli arancioni all'Intaglio e gli altri all'Incisione.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Quick Geometry Transforms Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-2">
        <div className="text-[11px] font-medium text-slate-500">Trasformazioni rapide sul piano</div>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={onCenterOnBed}
            className="inline-flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
            title="Centra sul piano"
          >
            <AlignCenter className="w-3.5 h-3.5" />
            <span>Centra</span>
          </button>
          <button
            type="button"
            onClick={onRotate90}
            className="inline-flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
            title="Ruota di 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>90°</span>
          </button>
          <button
            type="button"
            onClick={() => onScaleFactor(0.9)}
            className="py-1.5 px-2 text-xs font-mono font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
            title="Riduci del 10%"
          >
            -10%
          </button>
          <button
            type="button"
            onClick={() => onScaleFactor(1.1)}
            className="py-1.5 px-2 text-xs font-mono font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
            title="Ingrandisci del 10%"
          >
            +10%
          </button>
        </div>
      </div>
    </aside>
  );
};
