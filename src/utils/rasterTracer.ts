import { Point2D, PolylinePath, TracerParams } from '../types/vector';
import { generateHatchLines, simplifyRDP, smoothChaikin } from './geometry';

export type SampleTemplateId = 'compass' | 'tree' | 'leaf' | 'mountains';

export function createSampleRasterDataUrl(template: SampleTemplateId): string {
  const size = 280;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  const cx = size / 2;
  const cy = size / 2;

  if (template === 'compass') {
    // Outer ring
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 112, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 94, 0, Math.PI * 2);
    ctx.stroke();

    // 8-point compass star
    const drawStar = (points: number, rOuter: number, rInner: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? rOuter : rInner;
        const a = rot + (i * Math.PI) / points;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };
    drawStar(4, 58, 16, Math.PI / 4);
    drawStar(4, 90, 20, 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (template === 'tree') {
    // Circular frame + stylized pine & roots
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 115, 0, Math.PI * 2);
    ctx.stroke();

    // Trunk
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 88);
    ctx.lineTo(cx - 5, cy - 10);
    ctx.lineTo(cx + 5, cy - 10);
    ctx.lineTo(cx + 10, cy + 88);
    ctx.closePath();
    ctx.fill();

    // Layered pine canopy
    const tiers = [
      { y: cy - 88, w: 36, h: 48 },
      { y: cy - 54, w: 54, h: 52 },
      { y: cy - 18, w: 72, h: 56 },
    ];
    for (const t of tiers) {
      ctx.beginPath();
      ctx.moveTo(cx, t.y);
      ctx.lineTo(cx + t.w, t.y + t.h);
      ctx.lineTo(cx - t.w, t.y + t.h);
      ctx.closePath();
      ctx.fill();
    }

    // Ground hill
    ctx.beginPath();
    ctx.ellipse(cx, cy + 92, 65, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (template === 'leaf') {
    // Botanical silhouette leaf
    ctx.beginPath();
    ctx.moveTo(cx, 30);
    ctx.bezierCurveTo(cx + 95, 70, cx + 85, 195, cx, 232);
    ctx.bezierCurveTo(cx - 85, 195, cx - 95, 70, cx, 30);
    ctx.closePath();
    ctx.fill();

    // White midrib and veins carved inside
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, 52);
    ctx.lineTo(cx, 255);
    ctx.stroke();

    ctx.lineWidth = 4.5;
    for (let i = 0; i < 4; i++) {
      const y = 85 + i * 32;
      const spread = 42 - i * 4;
      ctx.beginPath();
      ctx.moveTo(cx, y + 14);
      ctx.lineTo(cx - spread, y - 10);
      ctx.moveTo(cx, y + 14);
      ctx.lineTo(cx + spread, y - 10);
      ctx.stroke();
    }
    // Stem
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx, 230);
    ctx.lineTo(cx, 258);
    ctx.stroke();
  } else {
    // Mountains + Sun badge
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, 114, 0, Math.PI * 2);
    ctx.stroke();

    // Sun
    ctx.beginPath();
    ctx.arc(cx + 42, cy - 44, 24, 0, Math.PI * 2);
    ctx.fill();

    // Back peak
    ctx.beginPath();
    ctx.moveTo(cx - 95, cy + 62);
    ctx.lineTo(cx - 28, cy - 42);
    ctx.lineTo(cx + 22, cy + 20);
    ctx.lineTo(cx + 52, cy - 18);
    ctx.lineTo(cx + 98, cy + 62);
    ctx.closePath();
    ctx.fill();

    // White snow ridge highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 42);
    ctx.lineTo(cx - 10, cy - 14);
    ctx.lineTo(cx - 26, cy - 6);
    ctx.lineTo(cx - 42, cy - 20);
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function ptKey(x: number, y: number): string {
  return `${Math.round(x * 4)},${Math.round(y * 4)}`;
}

// Marching Squares binary contour extraction + segment chaining
export function extractBinaryContours(
  grid: Uint8Array,
  gw: number,
  gh: number
): { pts: Point2D[]; closed: boolean }[] {
  const segments: Seg[] = [];
  for (let y = 0; y < gh - 1; y++) {
    for (let x = 0; x < gw - 1; x++) {
      const tl = grid[y * gw + x];
      const tr = grid[y * gw + (x + 1)];
      const br = grid[(y + 1) * gw + (x + 1)];
      const bl = grid[(y + 1) * gw + x];
      const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (code === 0 || code === 15) continue;

      const top = { x: x + 0.5, y };
      const right = { x: x + 1, y: y + 0.5 };
      const bottom = { x: x + 0.5, y: y + 1 };
      const left = { x, y: y + 0.5 };

      const pushSeg = (a: Point2D, b: Point2D) => segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

      switch (code) {
        case 1: pushSeg(left, bottom); break;
        case 2: pushSeg(bottom, right); break;
        case 3: pushSeg(left, right); break;
        case 4: pushSeg(top, right); break;
        case 5: pushSeg(left, top); pushSeg(bottom, right); break;
        case 6: pushSeg(top, bottom); break;
        case 7: pushSeg(left, top); break;
        case 8: pushSeg(top, left); break;
        case 9: pushSeg(top, bottom); break;
        case 10: pushSeg(top, right); pushSeg(left, bottom); break;
        case 11: pushSeg(top, right); break;
        case 12: pushSeg(right, left); break;
        case 13: pushSeg(bottom, right); break;
        case 14: pushSeg(left, bottom); break;
      }
    }
  }

  const adj = new Map<string, { idx: number; pt: Point2D; other: Point2D }[]>();
  const addEdge = (k: string, idx: number, pt: Point2D, other: Point2D) => {
    const arr = adj.get(k);
    if (arr) arr.push({ idx, pt, other });
    else adj.set(k, [{ idx, pt, other }]);
  };

  segments.forEach((s, idx) => {
    const p1 = { x: s.x1, y: s.y1 };
    const p2 = { x: s.x2, y: s.y2 };
    addEdge(ptKey(s.x1, s.y1), idx, p1, p2);
    addEdge(ptKey(s.x2, s.y2), idx, p2, p1);
  });

  const used = new Uint8Array(segments.length);
  const rawPolys: { pts: Point2D[]; closed: boolean }[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const s = segments[i];
    const poly: Point2D[] = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];

    let growing = true;
    while (growing) {
      growing = false;
      const tail = poly[poly.length - 1];
      const candidates = adj.get(ptKey(tail.x, tail.y)) || [];
      for (const c of candidates) {
        if (!used[c.idx]) {
          used[c.idx] = 1;
          poly.push(c.other);
          growing = true;
          break;
        }
      }
    }

    const first = poly[0];
    const last = poly[poly.length - 1];
    const isClosed = Math.hypot(first.x - last.x, first.y - last.y) < 1.2;
    if (isClosed && poly.length > 2) {
      poly.pop();
    }
    rawPolys.push({ pts: poly, closed: isClosed });
  }

  return rawPolys;
}

// Marching Squares binary contour extraction + vector cleanup
export async function traceImageToVectors(
  imageSrc: string,
  params: TracerParams,
  bedW: number,
  bedH: number
): Promise<{ paths: PolylinePath[]; previewWidth: number; previewHeight: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Impossibile leggere immagine'));
    el.src = imageSrc;
  });

  // Downsample to crisp working resolution (max 220px) for fast Marching Squares
  const maxDim = 220;
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const w = Math.max(16, Math.round(img.width * ratio));
  const h = Math.max(16, Math.round(img.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h).data;
  // Pad 1px border of "outside" so edge contours close cleanly!
  const gw = w + 2;
  const gh = h + 2;
  const grid = new Uint8Array(gw * gh);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      const alpha = imgData[idx + 3];
      const effectiveLum = alpha < 30 ? 255 : lum;
      const isDark = params.invert ? effectiveLum > params.threshold : effectiveLum < params.threshold;
      grid[(y + 1) * gw + (x + 1)] = isDark ? 1 : 0;
    }
  }

  const rawPolys = extractBinaryContours(grid, gw, gh);

  // Filter small noise contours by bounding area / length
  const scaleMm = params.targetWidthMm / gw;
  const targetHeightMm = gh * scaleMm;
  const ox = (bedW - params.targetWidthMm) / 2;
  const oy = (bedH - targetHeightMm) / 2;

  const outlinePolys: Point2D[][] = [];
  const paths: PolylinePath[] = [];
  let idCounter = 1;

  for (const rp of rawPolys) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of rp.pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const areaPx = (maxX - minX) * (maxY - minY);
    if (areaPx < params.minAreaPx || rp.pts.length < 4) continue;

    let pts = rp.pts.map((p) => ({
      x: ox + p.x * scaleMm,
      y: oy + p.y * scaleMm,
    }));

    if (params.smoothIterations > 0) {
      pts = smoothChaikin(pts, rp.closed, params.smoothIterations);
    }
    if (params.simplifyEpsilon > 0) {
      pts = simplifyRDP(pts, params.simplifyEpsilon);
    }
    if (pts.length < 3) continue;

    outlinePolys.push(pts);
    paths.push({
      id: `trace_${idCounter++}`,
      points: pts,
      closed: rp.closed,
      layerId: params.fillMode === 'outline' ? (params.outlineLayer || 'cut') : 'engrave',
      label: `Contorno ${idCounter - 1}`,
    });
  }

  // Optional Hatch Fill for wood pocket carving
  if (params.fillMode !== 'outline' && outlinePolys.length > 0) {
    const angles =
      params.fillMode === 'hatch_0'
        ? [0]
        : params.fillMode === 'hatch_45'
        ? [45]
        : [45, -45];
    for (const angle of angles) {
      const segs = generateHatchLines(outlinePolys, params.hatchSpacingMm, angle);
      for (const seg of segs) {
        paths.push({
          id: `trace_hatch_${idCounter++}`,
          points: seg,
          closed: false,
          layerId: 'carve',
        });
      }
    }
  }

  // Optional outer cutting frame around traced artwork
  if (params.addOuterCutFrame) {
    const m = params.frameMarginMm;
    const fx = ox - m;
    const fy = oy - m;
    const fw = params.targetWidthMm + m * 2;
    const fh = targetHeightMm + m * 2;
    const r = Math.min(8, fw * 0.1, fh * 0.1);
    const framePts: Point2D[] = [];
    const corners = [
      { cx: fx + fw - r, cy: fy + r, a0: -Math.PI / 2, a1: 0 },
      { cx: fx + fw - r, cy: fy + fh - r, a0: 0, a1: Math.PI / 2 },
      { cx: fx + r, cy: fy + fh - r, a0: Math.PI / 2, a1: Math.PI },
      { cx: fx + r, cy: fy + r, a0: Math.PI, a1: (3 * Math.PI) / 2 },
    ];
    for (const c of corners) {
      for (let i = 0; i <= 5; i++) {
        const a = c.a0 + ((c.a1 - c.a0) * i) / 5;
        framePts.push({ x: c.cx + r * Math.cos(a), y: c.cy + r * Math.sin(a) });
      }
    }
    paths.push({
      id: 'trace_outer_frame',
      points: framePts,
      closed: true,
      layerId: 'cut',
      label: 'Cornice taglio esterno',
    });
  }

  return {
    paths,
    previewWidth: img.width,
    previewHeight: img.height,
  };
}
