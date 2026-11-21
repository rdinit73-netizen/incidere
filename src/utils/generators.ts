import {
  BoxParams,
  GearParams,
  HingeParams,
  LayerType,
  MandalaParams,
  Point2D,
  PolylinePath,
  SignParams,
} from '../types/vector';
import { generateHatchLines } from './geometry';
import { layoutVectorText } from './hersheyFont';

let uidCounter = 1;
function nextId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter}`;
}

function createCircle(cx: number, cy: number, r: number, segments = 72): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

// 1. MANDALA & ROSETTE GENERATOR
export function generateMandala(params: MandalaParams, bedW: number, bedH: number): PolylinePath[] {
  const cx = bedW / 2;
  const cy = bedH / 2;
  const maxR = params.diameterMm / 2;
  const paths: PolylinePath[] = [];
  const n = Math.max(4, params.symmetry);

  // Outer cut boundary
  if (params.outerShape === 'circle') {
    paths.push({
      id: nextId('mandala_outer'),
      points: createCircle(cx, cy, maxR, 120),
      closed: true,
      layerId: 'cut',
      label: 'Perimetro esterno',
    });
  } else if (params.outerShape === 'octagon') {
    const sides = Math.max(6, n % 2 === 0 ? n : n * 2);
    const pts: Point2D[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pts.push({ x: cx + maxR * Math.cos(a), y: cy + maxR * Math.sin(a) });
    }
    paths.push({
      id: nextId('mandala_oct'),
      points: pts,
      closed: true,
      layerId: 'cut',
      label: 'Perimetro poligonale',
    });
  } else {
    // Scalloped edge
    const pts: Point2D[] = [];
    const totalSteps = n * 16;
    for (let i = 0; i < totalSteps; i++) {
      const a = (i / totalSteps) * Math.PI * 2;
      const lobe = Math.abs(Math.sin((a * n) / 2));
      const r = maxR * (0.91 + 0.09 * lobe);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    paths.push({
      id: nextId('mandala_scallop'),
      points: pts,
      closed: true,
      layerId: 'cut',
      label: 'Perimetro smerlato',
    });
  }

  // Optional hanging tab hole at top
  if (params.hangingHole) {
    const holeR = 2.5;
    const holeY = cy - maxR + 6.5;
    paths.push({
      id: nextId('mandala_hang'),
      points: createCircle(cx, holeY, holeR, 32),
      closed: true,
      layerId: 'cut',
      label: 'Foro sospensione',
    });
  }

  // Optional center cutout bore (e.g., clock mechanism or ornament)
  if (params.centerHoleMm > 0.5) {
    paths.push({
      id: nextId('mandala_center_hole'),
      points: createCircle(cx, cy, params.centerHoleMm / 2, 48),
      closed: true,
      layerId: 'cut',
      label: 'Foro centrale',
    });
  }

  const innerStartR = Math.max(params.centerHoleMm / 2 + 4, maxR * 0.14);
  const outerRingLimit = maxR * 0.92;
  const ringStep = (outerRingLimit - innerStartR) / params.rings;

  // Decorative concentric guide ring
  paths.push({
    id: nextId('mandala_ring_outer'),
    points: createCircle(cx, cy, outerRingLimit, 108),
    closed: true,
    layerId: 'engrave',
    label: 'Anello guida esterno',
  });

  const hatchPolygons: Point2D[][] = [];

  for (let rIdx = 0; rIdx < params.rings; rIdx++) {
    const r0 = innerStartR + rIdx * ringStep;
    const r1 = r0 + ringStep * 0.92;
    const angleOffset = rIdx % 2 === 1 ? Math.PI / n : 0;

    // Ring separator circle
    paths.push({
      id: nextId('mandala_ring'),
      points: createCircle(cx, cy, r0, 96),
      closed: true,
      layerId: 'engrave',
    });

    for (let k = 0; k < n; k++) {
      const baseAngle = (k / n) * Math.PI * 2 + angleOffset;
      const halfStep = (Math.PI / n) * 0.85;

      if (params.petalStyle === 'lotus') {
        const petal: Point2D[] = [];
        const steps = 14;
        // Left curve from base to tip
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const r = r0 + (r1 - r0) * t;
          const spread = Math.sin(t * Math.PI) * halfStep * (0.72 + 0.15 * Math.sin(t * Math.PI));
          const a = baseAngle - spread;
          petal.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        // Right curve from tip back to base
        for (let s = steps - 1; s >= 0; s--) {
          const t = s / steps;
          const r = r0 + (r1 - r0) * t;
          const spread = Math.sin(t * Math.PI) * halfStep * (0.72 + 0.15 * Math.sin(t * Math.PI));
          const a = baseAngle + spread;
          petal.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        paths.push({
          id: nextId('petal'),
          points: petal,
          closed: true,
          layerId: rIdx % 2 === 0 ? 'carve' : 'engrave',
        });

        // Inner vein
        paths.push({
          id: nextId('vein'),
          points: [
            { x: cx + (r0 + (r1 - r0) * 0.18) * Math.cos(baseAngle), y: cy + (r0 + (r1 - r0) * 0.18) * Math.sin(baseAngle) },
            { x: cx + (r0 + (r1 - r0) * 0.78) * Math.cos(baseAngle), y: cy + (r0 + (r1 - r0) * 0.78) * Math.sin(baseAngle) },
          ],
          closed: false,
          layerId: 'engrave',
        });

        if (params.addCarveHatch && rIdx % 2 === 0) {
          hatchPolygons.push(petal);
        }
      } else if (params.petalStyle === 'geometric') {
        const rMid = (r0 + r1) * 0.52;
        const diamond: Point2D[] = [
          { x: cx + r0 * Math.cos(baseAngle), y: cy + r0 * Math.sin(baseAngle) },
          { x: cx + rMid * Math.cos(baseAngle - halfStep * 0.75), y: cy + rMid * Math.sin(baseAngle - halfStep * 0.75) },
          { x: cx + r1 * Math.cos(baseAngle), y: cy + r1 * Math.sin(baseAngle) },
          { x: cx + rMid * Math.cos(baseAngle + halfStep * 0.75), y: cy + rMid * Math.sin(baseAngle + halfStep * 0.75) },
        ];
        paths.push({
          id: nextId('diamond'),
          points: diamond,
          closed: true,
          layerId: 'carve',
        });
        if (params.addCarveHatch && rIdx % 2 === 1) {
          hatchPolygons.push(diamond);
        }
      } else {
        // Floral arch + inner teardrop
        const arch: Point2D[] = [];
        const steps = 16;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const a = baseAngle - halfStep + t * halfStep * 2;
          const r = r0 + (r1 - r0) * Math.pow(Math.sin(t * Math.PI), 0.65);
          arch.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        paths.push({
          id: nextId('arch'),
          points: arch,
          closed: false,
          layerId: 'engrave',
        });

        const dotR = Math.min(ringStep * 0.16, 3.2);
        const dotDist = r0 + (r1 - r0) * 0.45;
        const dotPoly = createCircle(
          cx + dotDist * Math.cos(baseAngle),
          cy + dotDist * Math.sin(baseAngle),
          dotR,
          20
        );
        paths.push({
          id: nextId('floral_dot'),
          points: dotPoly,
          closed: true,
          layerId: 'carve',
        });
        if (params.addCarveHatch) {
          hatchPolygons.push(dotPoly);
        }
      }
    }
  }

  if (params.addCarveHatch && hatchPolygons.length > 0) {
    const hatchSegs = generateHatchLines(hatchPolygons, 0.9, 45);
    for (const seg of hatchSegs) {
      paths.push({
        id: nextId('mandala_hatch'),
        points: seg,
        closed: false,
        layerId: 'carve',
      });
    }
  }

  return paths;
}

// 2. FINGER-JOINT WOOD BOX GENERATOR
// Generates interlocking edge segments with kerf compensation
function buildFingerEdge(
  pStart: Point2D,
  pEnd: Point2D,
  thickness: number,
  fingerW: number,
  kerf: number,
  outwardTabs: boolean, // true = tabs protrude outward, false = slots indent inward
  skipCorners = false
): Point2D[] {
  const dx = pEnd.x - pStart.x;
  const dy = pEnd.y - pStart.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Normal pointing "outward" (right-hand rule for clockwise rect: +uy, -ux)
  const nx = uy;
  const ny = -ux;

  const usableLen = skipCorners ? len - 2 * thickness : len;
  let count = Math.max(3, Math.round(usableLen / fingerW));
  if (count % 2 === 0) count += 1; // Odd count keeps symmetry
  const step = usableLen / count;

  const pts: Point2D[] = [];
  const startOffset = skipCorners ? thickness : 0;

  if (skipCorners) {
    pts.push({ x: pStart.x + ux * thickness, y: pStart.y + uy * thickness });
  } else {
    pts.push({ ...pStart });
  }

  for (let i = 0; i < count; i++) {
    const isTab = outwardTabs ? i % 2 === 1 : i % 2 === 0;
    const t0 = startOffset + i * step;
    const t1 = startOffset + (i + 1) * step;

    // Kerf compensation: tabs get slightly wider (+kerf/2 each side), slots slightly narrower
    const kAdjust = outwardTabs ? (isTab ? kerf * 0.5 : -kerf * 0.5) : isTab ? -kerf * 0.5 : kerf * 0.5;
    const adj0 = i === 0 ? t0 : t0 - (isTab ? kAdjust : -kAdjust);
    const adj1 = i === count - 1 ? t1 : t1 + (isTab ? kAdjust : -kAdjust);

    const depth = isTab ? (outwardTabs ? thickness : -thickness) : 0;

    if (depth !== 0) {
      pts.push({ x: pStart.x + ux * adj0, y: pStart.y + uy * adj0 });
      pts.push({ x: pStart.x + ux * adj0 + nx * depth, y: pStart.y + uy * adj0 + ny * depth });
      pts.push({ x: pStart.x + ux * adj1 + nx * depth, y: pStart.y + uy * adj1 + ny * depth });
      pts.push({ x: pStart.x + ux * adj1, y: pStart.y + uy * adj1 });
    }
  }

  if (skipCorners) {
    pts.push({ x: pEnd.x - ux * thickness, y: pEnd.y - uy * thickness });
  } else {
    pts.push({ ...pEnd });
  }

  return pts;
}

function buildBoxPanel(
  ox: number,
  oy: number,
  w: number,
  h: number,
  t: number,
  fw: number,
  kerf: number,
  edges: { top: 'flat' | 'out' | 'in'; right: 'flat' | 'out' | 'in'; bottom: 'flat' | 'out' | 'in'; left: 'flat' | 'out' | 'in' }
): Point2D[] {
  const tl = { x: ox, y: oy };
  const tr = { x: ox + w, y: oy };
  const br = { x: ox + w, y: oy + h };
  const bl = { x: ox, y: oy + h };

  const allPts: Point2D[] = [];

  const appendEdge = (a: Point2D, b: Point2D, type: 'flat' | 'out' | 'in') => {
    if (type === 'flat') {
      allPts.push(a);
    } else {
      const segs = buildFingerEdge(a, b, t, fw, kerf, type === 'out', false);
      allPts.push(...segs.slice(0, -1));
    }
  };

  appendEdge(tl, tr, edges.top);
  appendEdge(tr, br, edges.right);
  appendEdge(br, bl, edges.bottom);
  appendEdge(bl, tl, edges.left);

  return allPts;
}

export function generateFingerBox(params: BoxParams, bedW: number, bedH: number): PolylinePath[] {
  const { widthMm: W, depthMm: D, heightMm: H, thicknessMm: T, kerfMm, fingerWidthMm, hasLid, lidStyle, panelGapMm: gap } = params;
  const paths: PolylinePath[] = [];

  // Inner cavity sizes: panels overlap by T at corners
  const innerW = Math.max(20, W - 2 * T);
  const innerD = Math.max(20, D - 2 * T);
  const innerH = Math.max(15, H - (hasLid ? 2 * T : T));

  // Layout 2 rows on bed
  // Row 1: Front (W x innerH), Back (W x innerH), Bottom (innerW x innerD)
  // Row 2: Left (innerD x innerH), Right (innerD x innerH), optional Lid (W x D)
  const panels: { label: string; pts: Point2D[]; extra?: Point2D[][] }[] = [];

  const topEdgeMode = hasLid ? 'in' : 'flat';

  // Front & Back
  const frontPts = buildBoxPanel(0, 0, innerW, innerH, T, fingerWidthMm, kerfMm, {
    top: topEdgeMode,
    right: 'out',
    bottom: 'out',
    left: 'out',
  });
  panels.push({ label: 'Fronte', pts: frontPts });

  const backPts = buildBoxPanel(innerW + gap + 2 * T, 0, innerW, innerH, T, fingerWidthMm, kerfMm, {
    top: topEdgeMode,
    right: 'out',
    bottom: 'out',
    left: 'out',
  });
  panels.push({ label: 'Retro', pts: backPts });

  // Bottom (insets inside all 4 walls)
  const bottomPts = buildBoxPanel(
    2 * (innerW + gap + 2 * T),
    0,
    innerW,
    innerD,
    T,
    fingerWidthMm,
    kerfMm,
    {
      top: 'in',
      right: 'in',
      bottom: 'in',
      left: 'in',
    }
  );
  panels.push({ label: 'Fondo', pts: bottomPts });

  const row2Y = Math.max(innerH, innerD) + gap + 2 * T + 4;

  // Left & Right
  const leftPts = buildBoxPanel(0, row2Y, innerD, innerH, T, fingerWidthMm, kerfMm, {
    top: topEdgeMode,
    right: 'in',
    bottom: 'out',
    left: 'in',
  });
  panels.push({ label: 'Lato SX', pts: leftPts });

  const rightPts = buildBoxPanel(innerD + gap + 2 * T, row2Y, innerD, innerH, T, fingerWidthMm, kerfMm, {
    top: topEdgeMode,
    right: 'in',
    bottom: 'out',
    left: 'in',
  });
  panels.push({ label: 'Lato DX', pts: rightPts });

  if (hasLid) {
    const lidX = 2 * (innerD + gap + 2 * T);
    const lidPts = buildBoxPanel(lidX, row2Y, innerW, innerD, T, fingerWidthMm, kerfMm, {
      top: 'out',
      right: 'out',
      bottom: 'out',
      left: 'out',
    });
    const extra: Point2D[][] = [];
    if (lidStyle === 'slot_handle') {
      const slotW = Math.min(34, innerW * 0.42);
      const slotH = 6;
      const scx = lidX + innerW / 2;
      const scy = row2Y + innerD / 2;
      extra.push([
        { x: scx - slotW / 2, y: scy - slotH / 2 },
        { x: scx + slotW / 2, y: scy - slotH / 2 },
        { x: scx + slotW / 2, y: scy + slotH / 2 },
        { x: scx - slotW / 2, y: scy + slotH / 2 },
      ]);
    }
    panels.push({ label: 'Coperchio', pts: lidPts, extra });
  }

  for (const p of panels) {
    paths.push({
      id: nextId('box_panel'),
      points: p.pts,
      closed: true,
      layerId: 'cut',
      label: p.label,
    });
    if (p.extra) {
      for (const ex of p.extra) {
        paths.push({
          id: nextId('box_slot'),
          points: ex,
          closed: true,
          layerId: 'cut',
          label: `${p.label} fessura`,
        });
      }
    }
  }

  // Center entire box layout on bed
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (const pt of p.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  const dx = bedW / 2 - (minX + maxX) / 2;
  const dy = bedH / 2 - (minY + maxY) / 2;
  return paths.map((p) => ({
    ...p,
    points: p.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
  }));
}

// 3. LIVING HINGE GENERATOR
function createRoundedRect(x: number, y: number, w: number, h: number, r: number): Point2D[] {
  const rad = Math.min(r, w / 2, h / 2);
  if (rad <= 0.2) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  const pts: Point2D[] = [];
  const corners = [
    { cx: x + w - rad, cy: y + rad, start: -Math.PI / 2, end: 0 },
    { cx: x + w - rad, cy: y + h - rad, start: 0, end: Math.PI / 2 },
    { cx: x + rad, cy: y + h - rad, start: Math.PI / 2, end: Math.PI },
    { cx: x + rad, cy: y + rad, start: Math.PI, end: (3 * Math.PI) / 2 },
  ];
  for (const c of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = c.start + ((c.end - c.start) * i) / 6;
      pts.push({ x: c.cx + rad * Math.cos(a), y: c.cy + rad * Math.sin(a) });
    }
  }
  return pts;
}

export function generateLivingHinge(params: HingeParams, bedW: number, bedH: number): PolylinePath[] {
  const { widthMm: W, heightMm: H, pattern, slotSpacingMm: pitch, cutLengthMm: cutLen, bridgeMm: bridge, cornerRadiusMm } = params;
  const ox = (bedW - W) / 2;
  const oy = (bedH - H) / 2;
  const paths: PolylinePath[] = [];

  // Outer perimeter
  paths.push({
    id: nextId('hinge_frame'),
    points: createRoundedRect(ox, oy, W, H, cornerRadiusMm),
    closed: true,
    layerId: 'cut',
    label: 'Perimetro cerniera',
  });

  const marginX = 4;
  const marginY = 3;
  const cols = Math.floor((W - marginX * 2) / pitch);
  const startX = ox + (W - (cols - 1) * pitch) / 2;

  for (let c = 0; c < cols; c++) {
    const x = startX + c * pitch;
    const isStaggered = c % 2 === 1;
    const stepY = cutLen + bridge;
    let yCursor = oy + marginY + (isStaggered ? -cutLen * 0.5 : 0);

    while (yCursor < oy + H - marginY) {
      const y0 = Math.max(oy + marginY, yCursor);
      const y1 = Math.min(oy + H - marginY, yCursor + cutLen);

      if (y1 - y0 >= 3) {
        if (pattern === 'straight') {
          paths.push({
            id: nextId('hinge_cut'),
            points: [{ x, y: y0 }, { x, y: y1 }],
            closed: false,
            layerId: 'cut',
          });
        } else if (pattern === 'wave') {
          const pts: Point2D[] = [];
          const steps = 10;
          const amp = Math.min(pitch * 0.35, 1.4);
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const py = y0 + (y1 - y0) * t;
            const px = x + Math.sin(t * Math.PI * 2) * amp;
            pts.push({ x: px, y: py });
          }
          paths.push({
            id: nextId('hinge_wave'),
            points: pts,
            closed: false,
            layerId: 'cut',
          });
        } else {
          // Diamond / zig-zag kerf
          const amp = Math.min(pitch * 0.35, 1.5);
          const ym = (y0 + y1) / 2;
          paths.push({
            id: nextId('hinge_dia'),
            points: [
              { x, y: y0 },
              { x: x + (isStaggered ? -amp : amp), y: ym },
              { x, y: y1 },
            ],
            closed: false,
            layerId: 'cut',
          });
        }
      }
      yCursor += stepY;
    }
  }

  return paths;
}

// 4. SIGN / PLAQUE & VECTOR TYPOGRAPHY GENERATOR
export function generateSignPlaque(params: SignParams, bedW: number, bedH: number): PolylinePath[] {
  const { widthMm: W, heightMm: H, shape, text, fontSizeMm, letterSpacing, lineSpacing, strokeStyle, mountingHoles, holeDiameterMm, innerBorder, engravingLayer } = params;
  const ox = (bedW - W) / 2;
  const oy = (bedH - H) / 2;
  const cx = bedW / 2;
  const cy = bedH / 2;
  const paths: PolylinePath[] = [];

  const makePlaqueOutline = (inset: number): Point2D[] => {
    const x = ox + inset;
    const y = oy + inset;
    const w = Math.max(10, W - inset * 2);
    const h = Math.max(10, H - inset * 2);

    if (shape === 'rounded') {
      return createRoundedRect(x, y, w, h, Math.max(2, 10 - inset * 0.4));
    }
    if (shape === 'chamfer') {
      const ch = Math.min(12, w * 0.14, h * 0.25);
      return [
        { x: x + ch, y },
        { x: x + w - ch, y },
        { x: x + w, y: y + ch },
        { x: x + w, y: y + h - ch },
        { x: x + w - ch, y: y + h },
        { x: x + ch, y: y + h },
        { x, y: y + h - ch },
        { x, y: y + ch },
      ];
    }
    if (shape === 'ticket') {
      const n = Math.min(9, h * 0.2);
      const pts: Point2D[] = [];
      // Top-left notch, top-right, bottom-right, bottom-left concave arcs
      const corners = [
        { cx: x, cy: y, a0: 0, a1: Math.PI / 2 },
        { cx: x + w, cy: y, a0: Math.PI / 2, a1: Math.PI },
        { cx: x + w, cy: y + h, a0: Math.PI, a1: (3 * Math.PI) / 2 },
        { cx: x, cy: y + h, a0: (3 * Math.PI) / 2, a1: Math.PI * 2 },
      ];
      for (const c of corners) {
        for (let i = 0; i <= 6; i++) {
          const a = c.a0 + ((c.a1 - c.a0) * i) / 6;
          pts.push({ x: c.cx + n * Math.cos(a), y: c.cy + n * Math.sin(a) });
        }
      }
      return pts;
    }
    // Arch plaque
    const archH = Math.min(h * 0.35, 22);
    const pts: Point2D[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const a = Math.PI + t * Math.PI;
      pts.push({
        x: x + w / 2 + (w / 2) * Math.cos(a),
        y: y + archH + archH * Math.sin(a),
      });
    }
    pts.push({ x: x + w, y: y + h - 4 });
    pts.push({ x: x + w - 4, y: y + h });
    pts.push({ x: x + 4, y: y + h });
    pts.push({ x, y: y + h - 4 });
    return pts;
  };

  // Outer cut
  paths.push({
    id: nextId('sign_cut'),
    points: makePlaqueOutline(0),
    closed: true,
    layerId: 'cut',
    label: 'Sagoma targa',
  });

  // Inner decorative border
  if (innerBorder) {
    paths.push({
      id: nextId('sign_border'),
      points: makePlaqueOutline(5.5),
      closed: true,
      layerId: 'engrave',
      label: 'Cornice interna',
    });
  }

  // Mounting holes
  const holeR = holeDiameterMm / 2;
  const holeInset = 10;
  if (mountingHoles === 'two_side') {
    paths.push({
      id: nextId('hole_l'),
      points: createCircle(ox + holeInset, cy, holeR, 28),
      closed: true,
      layerId: 'cut',
      label: 'Foro fissaggio SX',
    });
    paths.push({
      id: nextId('hole_r'),
      points: createCircle(ox + W - holeInset, cy, holeR, 28),
      closed: true,
      layerId: 'cut',
      label: 'Foro fissaggio DX',
    });
  } else if (mountingHoles === 'four_corner') {
    const corners = [
      { x: ox + holeInset, y: oy + holeInset },
      { x: ox + W - holeInset, y: oy + holeInset },
      { x: ox + W - holeInset, y: oy + H - holeInset },
      { x: ox + holeInset, y: oy + H - holeInset },
    ];
    corners.forEach((c, idx) => {
      paths.push({
        id: nextId(`hole_${idx}`),
        points: createCircle(c.x, c.y, holeR, 24),
        closed: true,
        layerId: 'cut',
        label: 'Foro angolo',
      });
    });
  }

  // Single-stroke CNC vector typography
  const textYCenter = shape === 'arch' ? cy + 5 : cy;
  const strokes = layoutVectorText(
    text || 'Legno',
    cx,
    textYCenter,
    fontSizeMm,
    letterSpacing,
    lineSpacing,
    strokeStyle === 'double_bold'
  );

  const targetLayer: LayerType = engravingLayer;
  for (const s of strokes) {
    paths.push({
      id: nextId('sign_text'),
      points: s,
      closed: false,
      layerId: targetLayer,
    });
  }

  return paths;
}

// 5. GEAR & COASTER GENERATOR
export function generateGearOrCoaster(params: GearParams, bedW: number, bedH: number): PolylinePath[] {
  const cx = bedW / 2;
  const cy = bedH / 2;
  const paths: PolylinePath[] = [];

  if (params.mode === 'gear') {
    const z = Math.max(8, params.teeth);
    const m = Math.max(1.5, params.moduleMm);
    const pitchR = (z * m) / 2;
    const outerR = pitchR + m;
    const rootR = Math.max(4, pitchR - 1.25 * m);
    const pts: Point2D[] = [];

    for (let i = 0; i < z; i++) {
      const a0 = (i / z) * Math.PI * 2;
      const step = (Math.PI * 2) / z;
      // 6-point trapezoid-involute tooth profile
      const p1 = a0 + step * 0.08;
      const p2 = a0 + step * 0.22;
      const p3 = a0 + step * 0.32;
      const p4 = a0 + step * 0.52;
      const p5 = a0 + step * 0.62;
      const p6 = a0 + step * 0.78;

      pts.push({ x: cx + rootR * Math.cos(p1), y: cy + rootR * Math.sin(p1) });
      pts.push({ x: cx + pitchR * Math.cos(p2), y: cy + pitchR * Math.sin(p2) });
      pts.push({ x: cx + outerR * Math.cos(p3), y: cy + outerR * Math.sin(p3) });
      pts.push({ x: cx + outerR * Math.cos(p4), y: cy + outerR * Math.sin(p4) });
      pts.push({ x: cx + pitchR * Math.cos(p5), y: cy + pitchR * Math.sin(p5) });
      pts.push({ x: cx + rootR * Math.cos(p6), y: cy + rootR * Math.sin(p6) });
    }

    paths.push({
      id: nextId('gear_teeth'),
      points: pts,
      closed: true,
      layerId: 'cut',
      label: `Ingranaggio Z${z}`,
    });

    // Center bore
    const boreR = Math.max(1.5, params.boreMm / 2);
    paths.push({
      id: nextId('gear_bore'),
      points: createCircle(cx, cy, boreR, 36),
      closed: true,
      layerId: 'cut',
      label: 'Foro asse',
    });

    // Lightening spoke cutouts
    if (params.spokes >= 3 && rootR - boreR > 12) {
      const rIn = boreR + 5;
      const rOut = rootR - 5;
      for (let s = 0; s < params.spokes; s++) {
        const aStart = (s / params.spokes) * Math.PI * 2 + 0.14;
        const aEnd = ((s + 1) / params.spokes) * Math.PI * 2 - 0.14;
        if (aEnd <= aStart + 0.1) continue;
        const spokePts: Point2D[] = [];
        for (let k = 0; k <= 8; k++) {
          const a = aStart + ((aEnd - aStart) * k) / 8;
          spokePts.push({ x: cx + rIn * Math.cos(a), y: cy + rIn * Math.sin(a) });
        }
        for (let k = 8; k >= 0; k--) {
          const a = aStart + ((aEnd - aStart) * k) / 8;
          spokePts.push({ x: cx + rOut * Math.cos(a), y: cy + rOut * Math.sin(a) });
        }
        paths.push({
          id: nextId('gear_spoke'),
          points: spokePts,
          closed: true,
          layerId: 'cut',
        });
      }
    }

    // Pitch circle reference engrave
    paths.push({
      id: nextId('gear_pitch_ref'),
      points: createCircle(cx, cy, pitchR * 0.96, 72),
      closed: true,
      layerId: 'engrave',
      label: 'Anello incisione',
    });
  } else {
    // Coaster generator
    const R = params.coasterDiameterMm / 2;
    paths.push({
      id: nextId('coaster_outer'),
      points: createCircle(cx, cy, R, 96),
      closed: true,
      layerId: 'cut',
      label: 'Perimetro sottobicchiere',
    });

    const innerR = R - 5;
    paths.push({
      id: nextId('coaster_rim'),
      points: createCircle(cx, cy, innerR, 96),
      closed: true,
      layerId: 'engrave',
    });

    if (params.coasterPattern === 'hex_grid') {
      const hexR = Math.max(6, innerR / 4.2);
      const dx = hexR * Math.sqrt(3);
      const dy = hexR * 1.5;
      for (let row = -4; row <= 4; row++) {
        for (let col = -4; col <= 4; col++) {
          const hx = cx + col * dx + (Math.abs(row) % 2 === 1 ? dx / 2 : 0);
          const hy = cy + row * dy;
          if (Math.hypot(hx - cx, hy - cy) + hexR * 0.9 <= innerR) {
            const hex: Point2D[] = [];
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
              hex.push({ x: hx + hexR * 0.86 * Math.cos(a), y: hy + hexR * 0.86 * Math.sin(a) });
            }
            paths.push({
              id: nextId('coaster_hex'),
              points: hex,
              closed: true,
              layerId: (row + col) % 2 === 0 ? 'carve' : 'engrave',
            });
          }
        }
      }
    } else if (params.coasterPattern === 'celtic_star') {
      const rays = 12;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const aNext = (((i + 5) % rays) / rays) * Math.PI * 2;
        paths.push({
          id: nextId('star_chord'),
          points: [
            { x: cx + innerR * 0.95 * Math.cos(a), y: cy + innerR * 0.95 * Math.sin(a) },
            { x: cx + innerR * 0.95 * Math.cos(aNext), y: cy + innerR * 0.95 * Math.sin(aNext) },
          ],
          closed: false,
          layerId: 'carve',
        });
      }
      paths.push({
        id: nextId('star_mid'),
        points: createCircle(cx, cy, innerR * 0.48, 64),
        closed: true,
        layerId: 'engrave',
      });
    } else {
      // Concentric waves
      const rings = 6;
      for (let r = 1; r <= rings; r++) {
        const radius = (innerR * r) / (rings + 0.5);
        const pts: Point2D[] = [];
        const steps = 96;
        for (let s = 0; s < steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const wave = Math.sin(a * 8 + r * 0.8) * 2.2;
          pts.push({
            x: cx + (radius + wave) * Math.cos(a),
            y: cy + (radius + wave) * Math.sin(a),
          });
        }
        paths.push({
          id: nextId('wave_ring'),
          points: pts,
          closed: true,
          layerId: r % 2 === 0 ? 'carve' : 'engrave',
        });
      }
    }
  }

  return paths;
}
