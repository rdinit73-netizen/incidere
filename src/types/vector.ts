export interface Point2D {
  x: number;
  y: number;
}

export type LayerType = 'engrave' | 'carve' | 'cut';

export interface PolylinePath {
  id: string;
  points: Point2D[];
  closed: boolean;
  layerId: LayerType;
  label?: string;
}

export interface LaserLayerConfig {
  id: LayerType;
  name: string;
  description: string;
  color: string;
  visible: boolean;
  speed: number; // mm/min (F)
  power: number; // 0 - 1000 (S for GRBL $30=1000)
  passes: number; // 1 - 10
  laserMode: 'M4' | 'M3';
  airAssist: boolean;
}

export interface WoodPreset {
  id: string;
  name: string;
  thicknessMm: number;
  laserPowerNote: string;
  previewGrain: 'poplar' | 'birch' | 'walnut' | 'mdf' | 'cork';
  cut: { speed: number; power: number; passes: number };
  carve: { speed: number; power: number; passes: number };
  engrave: { speed: number; power: number; passes: number };
}

export type GeneratorMode =
  | 'mandala'
  | 'cutout'
  | 'box'
  | 'hinge'
  | 'sign'
  | 'gear'
  | 'tracer'
  | 'svg_import';

export type BedBackground = 'grid' | 'poplar' | 'birch' | 'walnut' | 'mdf';

export type OriginMode = 'bottom-left' | 'center';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ToolpathStats {
  totalPaths: number;
  cutLengthMm: number;
  rapidLengthMm: number;
  estimatedSeconds: number;
  bounds: BoundingBox | null;
  layerBreakdown: Record<
    LayerType,
    {
      paths: number;
      lengthMm: number;
      estimatedSeconds: number;
    }
  >;
}

export interface MandalaParams {
  diameterMm: number;
  symmetry: number;
  rings: number;
  petalStyle: 'lotus' | 'geometric' | 'floral';
  outerShape: 'circle' | 'scalloped' | 'octagon';
  hangingHole: boolean;
  centerHoleMm: number;
  addCarveHatch: boolean;
}

export interface CutoutParams {
  mode: 'word' | 'shape';
  text: string;
  fontStyle: 'script' | 'bold' | 'serif';
  joinMode: 'base_bar' | 'direct_overlap' | 'bubble_offset';
  fontSizeMm: number;
  letterSpacingMm: number;
  baseBarHeightMm: number;
  offsetMarginMm: number;
  engraveInnerText: boolean;
  attachment: 'none' | 'keyring' | 'topper_stick';
  shapeType: 'heart' | 'star' | 'cloud' | 'shield' | 'tag' | 'hexagon';
  shapeWidthMm: number;
  shapeHole: boolean;
  shapeLabel: string;
}

export interface BoxParams {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  thicknessMm: number;
  kerfMm: number;
  fingerWidthMm: number;
  hasLid: boolean;
  lidStyle: 'flat' | 'slot_handle';
  panelGapMm: number;
}

export interface HingeParams {
  widthMm: number;
  heightMm: number;
  pattern: 'straight' | 'wave' | 'diamond';
  slotSpacingMm: number;
  cutLengthMm: number;
  bridgeMm: number;
  cornerRadiusMm: number;
}

export interface SignParams {
  text: string;
  widthMm: number;
  heightMm: number;
  shape: 'rounded' | 'chamfer' | 'arch' | 'ticket';
  fontSizeMm: number;
  letterSpacing: number;
  lineSpacing: number;
  strokeStyle: 'single' | 'double_bold';
  mountingHoles: 'none' | 'two_side' | 'four_corner';
  holeDiameterMm: number;
  innerBorder: boolean;
  engravingLayer: 'engrave' | 'carve';
}

export interface GearParams {
  mode: 'gear' | 'coaster';
  teeth: number;
  moduleMm: number;
  boreMm: number;
  spokes: number;
  coasterDiameterMm: number;
  coasterPattern: 'hex_grid' | 'celtic_star' | 'concentric_waves';
}

export interface TracerParams {
  threshold: number;
  invert: boolean;
  simplifyEpsilon: number;
  smoothIterations: number;
  minAreaPx: number;
  targetWidthMm: number;
  outlineLayer: LayerType;
  fillMode: 'outline' | 'hatch_0' | 'hatch_45' | 'crosshatch';
  hatchSpacingMm: number;
  addOuterCutFrame: boolean;
  frameMarginMm: number;
}
