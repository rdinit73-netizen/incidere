import { CutoutParams, LayerType, Point2D, PolylinePath } from '../types/vector';
import { centerPathsOnBed, simplifyRDP, smoothChaikin } from './geometry';
import { extractBinaryContours } from './rasterTracer';

let cutoutUid = 1;
function nextCutId(prefix: string): string {
  cutoutUid += 1;
  return `${prefix}_${cutoutUid}`;
}

function getCanvasFont(style: CutoutParams['fontStyle'], pxSize: number): string {
  if (style === 'script') {
    return `400 ${pxSize}px "Lobster", "Brush Script MT", "Segoe Script", cursive`;
  }
  if (style === 'serif') {
    return `700 ${pxSize}px Georgia, "Times New Roman", serif`;
  }
  return `400 ${pxSize}px "Archivo Black", "Arial Black", Impact, sans-serif`;
}

function drawTextWithTracking(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  baselineY: number,
  trackingPx: number,
  strokeHaloWidthPx = 0
): { minX: number; maxX: number } {
  const chars = Array.from(text);
  if (chars.length === 0) return { minX: centerX, maxX: centerX };

  // When tracking is ~0 and it's script, draw as a whole string so cursive ligatures connect natively!
  if (Math.abs(trackingPx) < 0.5) {
    const w = ctx.measureText(text).width;
    const x = centerX - w / 2;
    if (strokeHaloWidthPx > 0) {
      ctx.lineWidth = strokeHaloWidthPx;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeText(text, x, baselineY);
    }
    ctx.fillText(text, x, baselineY);
    return { minX: x, maxX: x + w };
  }

  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + trackingPx * Math.max(0, chars.length - 1);
  let cursorX = centerX - totalWidth / 2;
  const minX = cursorX;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (strokeHaloWidthPx > 0) {
      ctx.lineWidth = strokeHaloWidthPx;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeText(ch, cursorX, baselineY);
    }
    ctx.fillText(ch, cursorX, baselineY);
    cursorX += widths[i] + trackingPx;
  }

  return { minX, maxX: cursorX - trackingPx };
}

function canvasToContoursMm(
  canvas: HTMLCanvasElement,
  pxPerMm: number,
  layerId: LayerType,
  labelPrefix: string
): PolylinePath[] {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h).data;

  const gw = w + 2;
  const gh = h + 2;
  const grid = new Uint8Array(gw * gh);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = imgData[idx]; // greyscale / black on white
      grid[(y + 1) * gw + (x + 1)] = lum < 140 ? 1 : 0;
    }
  }

  const rawPolys = extractBinaryContours(grid, gw, gh);
  const paths: PolylinePath[] = [];

  for (const rp of rawPolys) {
    let pts = rp.pts.map((p) => ({
      x: (p.x - 1) / pxPerMm,
      y: (p.y - 1) / pxPerMm,
    }));

    // Check bounding box size in mm to discard tiny speckles
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of pts) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    if ((maxX - minX) * (maxY - minY) < 0.8 || pts.length < 4) continue;

    pts = smoothChaikin(pts, rp.closed, 1);
    pts = simplifyRDP(pts, 0.12);
    if (pts.length < 3) continue;

    paths.push({
      id: nextCutId(labelPrefix),
      points: pts,
      closed: rp.closed,
      layerId,
    });
  }

  return paths;
}

function drawKeyringAttachment(
  ctx: CanvasRenderingContext2D,
  attachX: number,
  attachY: number,
  pxPerMm: number
) {
  const outerR = 6.2 * pxPerMm;
  const innerR = 2.6 * pxPerMm;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(attachX, attachY, outerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(attachX, attachY, innerR, 0, Math.PI * 2);
  ctx.fill();
}

function drawTopperStickAttachment(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  pxPerMm: number
) {
  const stickW = 5.2 * pxPerMm;
  const stickLen = 45 * pxPerMm;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(centerX - stickW / 2, topY - 2 * pxPerMm);
  ctx.lineTo(centerX + stickW / 2, topY - 2 * pxPerMm);
  ctx.lineTo(centerX + stickW * 0.38, topY + stickLen - 6 * pxPerMm);
  ctx.lineTo(centerX, topY + stickLen);
  ctx.lineTo(centerX - stickW * 0.38, topY + stickLen - 6 * pxPerMm);
  ctx.closePath();
  ctx.fill();
}

// Pure mathematical shapes for Sagome & Portachiavi
function generatePureShapePoints(
  shapeType: CutoutParams['shapeType'],
  widthMm: number
): { pts: Point2D[]; topAttachY: number; bottomAttachY: number } {
  const pts: Point2D[] = [];
  const halfW = widthMm / 2;

  if (shapeType === 'heart') {
    const steps = 96;
    const scale = widthMm / 34;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push({ x: hx * scale, y: hy * scale });
    }
    return { pts, topAttachY: -4.5 * scale, bottomAttachY: 16.5 * scale };
  }

  if (shapeType === 'star') {
    const spikes = 5;
    const rOuter = halfW;
    const rInner = halfW * 0.44;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = -Math.PI / 2 + (i * Math.PI) / spikes;
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return { pts, topAttachY: -rOuter + 3, bottomAttachY: rOuter * 0.8 };
  }

  if (shapeType === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
      pts.push({ x: halfW * Math.cos(a), y: halfW * Math.sin(a) });
    }
    return { pts, topAttachY: -halfW + 2, bottomAttachY: halfW - 2 };
  }

  if (shapeType === 'cloud') {
    const steps = 120;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = halfW * (0.72 + 0.14 * Math.cos(6 * a) + 0.08 * Math.sin(3 * a));
      pts.push({ x: r * Math.cos(a) * 1.15, y: r * Math.sin(a) * 0.78 });
    }
    return { pts, topAttachY: -halfW * 0.65, bottomAttachY: halfW * 0.65 };
  }

  if (shapeType === 'shield') {
    const h = widthMm * 1.15;
    const hw = halfW;
    pts.push({ x: -hw, y: -h * 0.45 });
    pts.push({ x: 0, y: -h * 0.52 });
    pts.push({ x: hw, y: -h * 0.45 });
    pts.push({ x: hw, y: h * 0.05 });
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      pts.push({ x: hw * (1 - t), y: h * (0.05 + 0.45 * Math.sin((t * Math.PI) / 2)) });
    }
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      pts.push({ x: -hw * t, y: h * (0.5 - 0.45 * (1 - Math.cos((t * Math.PI) / 2))) });
    }
    return { pts, topAttachY: -h * 0.5, bottomAttachY: h * 0.48 };
  }

  // Tag / Etichetta sagomata
  const h = widthMm * 0.55;
  const hw = halfW;
  const hh = h / 2;
  const ch = Math.min(12, hh * 0.45);
  pts.push({ x: -hw + ch, y: -hh });
  pts.push({ x: hw - ch, y: -hh });
  pts.push({ x: hw, y: -hh + ch });
  pts.push({ x: hw, y: hh - ch });
  pts.push({ x: hw - ch, y: hh });
  pts.push({ x: -hw + ch, y: hh });
  pts.push({ x: -hw, y: hh - ch });
  pts.push({ x: -hw, y: -hh + ch });
  return { pts, topAttachY: -hh + 3, bottomAttachY: hh };
}

export async function generateCutoutVectors(
  params: CutoutParams,
  bedW: number,
  bedH: number
): Promise<PolylinePath[]> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading timeout
    }
  }

  // Resolution: ~5.5 px per mm gives smooth edges & accurate small holes
  const pxPerMm = 5.5;

  if (params.mode === 'shape') {
    const canvas = document.createElement('canvas');
    const padMm = 28;
    const totalW = params.shapeWidthMm + padMm * 2;
    const totalH = params.shapeWidthMm * 1.3 + padMm * 2 + (params.attachment === 'topper_stick' ? 45 : 0);
    canvas.width = Math.round(totalW * pxPerMm);
    canvas.height = Math.round(totalH * pxPerMm);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = Math.round((params.shapeWidthMm * 0.65 + padMm) * pxPerMm);

    const { pts, topAttachY, bottomAttachY } = generatePureShapePoints(
      params.shapeType,
      params.shapeWidthMm
    );

    // Draw main shape in black
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const sx = cx + p.x * pxPerMm;
      const sy = cy + p.y * pxPerMm;
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fill();

    // Attachments fused into shape
    if (params.attachment === 'keyring') {
      drawKeyringAttachment(ctx, cx, cy + topAttachY * pxPerMm - 4 * pxPerMm, pxPerMm);
    } else if (params.attachment === 'topper_stick') {
      drawTopperStickAttachment(ctx, cx, cy + bottomAttachY * pxPerMm, pxPerMm);
    } else if (params.shapeHole) {
      // Internal hole inside top edge
      const holeY =
        params.shapeType === 'tag'
          ? cy
          : cy + topAttachY * pxPerMm + 5.5 * pxPerMm;
      const holeX =
        params.shapeType === 'tag'
          ? cx - (params.shapeWidthMm / 2 - 8) * pxPerMm
          : cx;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(holeX, holeY, 2.3 * pxPerMm, 0, Math.PI * 2);
      ctx.fill();
    }

    const paths = canvasToContoursMm(canvas, pxPerMm, 'cut', 'shape_cut');

    // Optional engraved label inside shape
    if (params.shapeLabel.trim().length > 0) {
      const textCanvas = document.createElement('canvas');
      textCanvas.width = canvas.width;
      textCanvas.height = canvas.height;
      const tctx = textCanvas.getContext('2d')!;
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, textCanvas.width, textCanvas.height);
      tctx.fillStyle = '#000000';
      const labelPx = Math.max(22, Math.min(params.shapeWidthMm * 0.22 * pxPerMm, 90));
      tctx.font = getCanvasFont(params.fontStyle, labelPx);
      tctx.textBaseline = 'alphabetic';
      drawTextWithTracking(tctx, params.shapeLabel.trim(), cx, cy + labelPx * 0.3, 0, 0);
      const labelPaths = canvasToContoursMm(textCanvas, pxPerMm, 'engrave', 'shape_lbl');
      paths.push(...labelPaths);
    }

    return centerPathsOnBed(paths, bedW, bedH);
  }

  // WORD CUTOUT MODE ("Scritta ritagliata unita in un pezzo solo")
  const text = params.text.trim() || 'Legno';
  const fontPx = params.fontSizeMm * pxPerMm;
  const trackingPx = params.letterSpacingMm * pxPerMm;
  const haloPx =
    params.joinMode === 'bubble_offset' ? params.offsetMarginMm * 2 * pxPerMm : 0;

  // Measure width cleanly first
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;
  mctx.font = getCanvasFont(params.fontStyle, fontPx);
  const chars = Array.from(text);
  const measuredW =
    Math.abs(trackingPx) < 0.5
      ? mctx.measureText(text).width
      : chars.reduce((s, c) => s + mctx.measureText(c).width, 0) +
        trackingPx * Math.max(0, chars.length - 1);

  const padPx = Math.round((20 + params.offsetMarginMm) * pxPerMm);
  const topperExtraPx = params.attachment === 'topper_stick' ? Math.round(48 * pxPerMm) : 0;
  const baseExtraPx = params.joinMode === 'base_bar' ? Math.round((params.baseBarHeightMm + 4) * pxPerMm) : 0;
  const keyringExtraPx = params.attachment === 'keyring' ? Math.round(14 * pxPerMm) : 0;

  const canvasW = Math.min(1400, Math.max(200, Math.round(measuredW + padPx * 2)));
  const canvasH = Math.min(
    900,
    Math.max(160, Math.round(fontPx * 1.55 + padPx * 2 + topperExtraPx + baseExtraPx + keyringExtraPx))
  );

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.font = getCanvasFont(params.fontStyle, fontPx);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textBaseline = 'alphabetic';

  const cx = canvasW / 2;
  const baselineY = Math.round(padPx + keyringExtraPx + fontPx * 0.98);

  const { minX, maxX } = drawTextWithTracking(
    ctx,
    text,
    cx,
    baselineY,
    trackingPx,
    haloPx
  );

  let bottomWeldY = baselineY;

  // Base Bar union mode: draws a rounded wooden bar overlapping baseline by 1.4mm so every letter is 1 piece
  if (params.joinMode === 'base_bar') {
    const barPad = 4 * pxPerMm;
    const bx = Math.max(4, minX - barPad);
    const bw = Math.min(canvasW - 8, maxX - minX + barPad * 2);
    const by = baselineY - 1.4 * pxPerMm;
    const bh = params.baseBarHeightMm * pxPerMm;
    const r = Math.min(bh * 0.35, 2.5 * pxPerMm);

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, r);
    ctx.fill();
    bottomWeldY = by + bh;
  } else if (params.joinMode === 'bubble_offset') {
    bottomWeldY = baselineY + params.offsetMarginMm * 0.75 * pxPerMm;
  }

  // Optional Keyring or Cake Topper attachment welded to word
  if (params.attachment === 'keyring') {
    const ringX = Math.max(10 * pxPerMm, minX + 4 * pxPerMm);
    const ringY = baselineY - fontPx * 0.78;
    drawKeyringAttachment(ctx, ringX, ringY, pxPerMm);
  } else if (params.attachment === 'topper_stick') {
    drawTopperStickAttachment(ctx, cx, bottomWeldY, pxPerMm);
  }

  const paths = canvasToContoursMm(canvas, pxPerMm, 'cut', 'word_cut');

  // If bubble_offset and user wants inner crisp text engraved on the wooden cutout
  if (params.joinMode === 'bubble_offset' && params.engraveInnerText) {
    const innerCanvas = document.createElement('canvas');
    innerCanvas.width = canvasW;
    innerCanvas.height = canvasH;
    const ictx = innerCanvas.getContext('2d')!;
    ictx.fillStyle = '#ffffff';
    ictx.fillRect(0, 0, canvasW, canvasH);
    ictx.font = getCanvasFont(params.fontStyle, fontPx);
    ictx.fillStyle = '#000000';
    ictx.textBaseline = 'alphabetic';
    drawTextWithTracking(ictx, text, cx, baselineY, trackingPx, 0);
    const innerPaths = canvasToContoursMm(innerCanvas, pxPerMm, 'engrave', 'word_eng');
    paths.push(...innerPaths);
  }

  return centerPathsOnBed(paths, bedW, bedH);
}
