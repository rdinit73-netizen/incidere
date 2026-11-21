import { LayerType, Point2D, PolylinePath } from '../types/vector';
import { centerPathsOnBed, computeBounds, scalePaths } from './geometry';

function sampleCubicBezier(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, steps = 10): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return pts;
}

function sampleQuadBezier(p0: Point2D, p1: Point2D, p2: Point2D, steps = 8): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return pts;
}

function parseSvgPathData(d: string): { points: Point2D[]; closed: boolean }[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return [];

  const subpaths: { points: Point2D[]; closed: boolean }[] = [];
  let current: Point2D[] = [];
  let cursor: Point2D = { x: 0, y: 0 };
  let startPt: Point2D = { x: 0, y: 0 };
  let lastCmd = '';
  let lastCtrl: Point2D | null = null;
  let i = 0;

  const nextNum = (): number => parseFloat(tokens[i++] || '0');
  const isCmd = (tok: string) => /^[a-zA-Z]$/.test(tok);

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (isCmd(cmd)) {
      i++;
    } else {
      cmd = lastCmd === 'M' ? 'L' : lastCmd === 'm' ? 'l' : lastCmd;
    }

    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();

    if (upper === 'M') {
      if (current.length >= 2) {
        subpaths.push({ points: current, closed: false });
      }
      const x = nextNum() + (rel ? cursor.x : 0);
      const y = nextNum() + (rel ? cursor.y : 0);
      cursor = { x, y };
      startPt = { x, y };
      current = [{ x, y }];
      lastCtrl = null;
    } else if (upper === 'L') {
      const x = nextNum() + (rel ? cursor.x : 0);
      const y = nextNum() + (rel ? cursor.y : 0);
      cursor = { x, y };
      current.push(cursor);
      lastCtrl = null;
    } else if (upper === 'H') {
      const x = nextNum() + (rel ? cursor.x : 0);
      cursor = { x, y: cursor.y };
      current.push(cursor);
      lastCtrl = null;
    } else if (upper === 'V') {
      const y = nextNum() + (rel ? cursor.y : 0);
      cursor = { x: cursor.x, y };
      current.push(cursor);
      lastCtrl = null;
    } else if (upper === 'C') {
      const x1 = nextNum() + (rel ? cursor.x : 0);
      const y1 = nextNum() + (rel ? cursor.y : 0);
      const x2 = nextNum() + (rel ? cursor.x : 0);
      const y2 = nextNum() + (rel ? cursor.y : 0);
      const x = nextNum() + (rel ? cursor.x : 0);
      const y = nextNum() + (rel ? cursor.y : 0);
      const pts = sampleCubicBezier(cursor, { x: x1, y: y1 }, { x: x2, y: y2 }, { x, y });
      current.push(...pts);
      lastCtrl = { x: x2, y: y2 };
      cursor = { x, y };
    } else if (upper === 'S') {
      const x1 = lastCtrl && (lastCmd === 'C' || lastCmd === 'c' || lastCmd === 'S' || lastCmd === 's')
        ? 2 * cursor.x - lastCtrl.x
        : cursor.x;
      const y1 = lastCtrl && (lastCmd === 'C' || lastCmd === 'c' || lastCmd === 'S' || lastCmd === 's')
        ? 2 * cursor.y - lastCtrl.y
        : cursor.y;
      const x2 = nextNum() + (rel ? cursor.x : 0);
      const y2 = nextNum() + (rel ? cursor.y : 0);
      const x = nextNum() + (rel ? cursor.x : 0);
      const y = nextNum() + (rel ? cursor.y : 0);
      const pts = sampleCubicBezier(cursor, { x: x1, y: y1 }, { x: x2, y: y2 }, { x, y });
      current.push(...pts);
      lastCtrl = { x: x2, y: y2 };
      cursor = { x, y };
    } else if (upper === 'Q') {
      const x1 = nextNum() + (rel ? cursor.x : 0);
      const y1 = nextNum() + (rel ? cursor.y : 0);
      const x = nextNum() + (rel ? cursor.x : 0);
      const y = nextNum() + (rel ? cursor.y : 0);
      const pts = sampleQuadBezier(cursor, { x: x1, y: y1 }, { x, y });
      current.push(...pts);
      lastCtrl = { x: x1, y: y1 };
      cursor = { x, y };
    } else if (upper === 'A') {
      // Approximate arc endpoint if encountered
      nextNum(); nextNum(); nextNum(); nextNum(); nextNum();
      const x = nextNum() + (rel ? cursor.x : 0);
      const y = nextNum() + (rel ? cursor.y : 0);
      cursor = { x, y };
      current.push(cursor);
      lastCtrl = null;
    } else if (upper === 'Z') {
      if (current.length >= 2) {
        subpaths.push({ points: current, closed: true });
      }
      current = [];
      cursor = { ...startPt };
      lastCtrl = null;
    } else {
      // Unknown command token: avoid infinite loop
      i++;
    }
    lastCmd = cmd;
  }

  if (current.length >= 2) {
    subpaths.push({ points: current, closed: false });
  }

  return subpaths;
}

function classifyStrokeLayer(el: Element): LayerType {
  const stroke = (el.getAttribute('stroke') || el.closest('g')?.getAttribute('stroke') || '').toLowerCase();
  const id = (el.getAttribute('id') || el.closest('g')?.getAttribute('id') || '').toLowerCase();
  if (id.includes('cut') || id.includes('taglio') || stroke.includes('ff0000') || stroke.includes('dc2626') || stroke === 'red') {
    return 'cut';
  }
  if (id.includes('carve') || id.includes('intaglio') || stroke.includes('d97706') || stroke.includes('f59e0b')) {
    return 'carve';
  }
  return 'engrave';
}

export function importSvgStringToPaths(
  svgText: string,
  targetWidthMm: number,
  bedW: number,
  bedH: number
): PolylinePath[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const rawPaths: PolylinePath[] = [];
  let idx = 1;

  doc.querySelectorAll('path').forEach((el) => {
    const d = el.getAttribute('d');
    if (!d) return;
    const layerId = classifyStrokeLayer(el);
    for (const sub of parseSvgPathData(d)) {
      rawPaths.push({
        id: `svg_${idx++}`,
        points: sub.points,
        closed: sub.closed,
        layerId,
      });
    }
  });

  doc.querySelectorAll('rect').forEach((el) => {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    if (w <= 0 || h <= 0) return;
    rawPaths.push({
      id: `svg_rect_${idx++}`,
      points: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      closed: true,
      layerId: classifyStrokeLayer(el),
    });
  });

  doc.querySelectorAll('circle').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const r = parseFloat(el.getAttribute('r') || '0');
    if (r <= 0) return;
    const pts: Point2D[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    rawPaths.push({
      id: `svg_circle_${idx++}`,
      points: pts,
      closed: true,
      layerId: classifyStrokeLayer(el),
    });
  });

  doc.querySelectorAll('ellipse').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    if (rx <= 0 || ry <= 0) return;
    const pts: Point2D[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    rawPaths.push({
      id: `svg_ellipse_${idx++}`,
      points: pts,
      closed: true,
      layerId: classifyStrokeLayer(el),
    });
  });

  doc.querySelectorAll('polygon, polyline').forEach((el) => {
    const raw = (el.getAttribute('points') || '').trim();
    const nums = raw.split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
    const pts: Point2D[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      pts.push({ x: nums[i], y: nums[i + 1] });
    }
    if (pts.length >= 2) {
      rawPaths.push({
        id: `svg_poly_${idx++}`,
        points: pts,
        closed: el.tagName.toLowerCase() === 'polygon',
        layerId: classifyStrokeLayer(el),
      });
    }
  });

  doc.querySelectorAll('line').forEach((el) => {
    const x1 = parseFloat(el.getAttribute('x1') || '0');
    const y1 = parseFloat(el.getAttribute('y1') || '0');
    const x2 = parseFloat(el.getAttribute('x2') || '0');
    const y2 = parseFloat(el.getAttribute('y2') || '0');
    rawPaths.push({
      id: `svg_line_${idx++}`,
      points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
      closed: false,
      layerId: classifyStrokeLayer(el),
    });
  });

  const bounds = computeBounds(rawPaths);
  if (!bounds || bounds.width <= 0) return [];
  const scale = targetWidthMm / bounds.width;
  const scaled = scalePaths(rawPaths, scale, scale);
  return centerPathsOnBed(scaled, bedW, bedH);
}
