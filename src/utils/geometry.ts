import {
  BoundingBox,
  LaserLayerConfig,
  LayerType,
  Point2D,
  PolylinePath,
  ToolpathStats,
} from '../types/vector';
import { LAYER_ORDER } from '../data/woodPresets';

export function dist(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function pathLength(points: Point2D[], closed: boolean): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  if (closed) {
    total += dist(points[points.length - 1], points[0]);
  }
  return total;
}

export function computeBounds(paths: PolylinePath[]): BoundingBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasPts = false;

  for (const p of paths) {
    for (const pt of p.points) {
      hasPts = true;
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (!hasPts) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export function translatePaths(paths: PolylinePath[], dx: number, dy: number): PolylinePath[] {
  return paths.map((p) => ({
    ...p,
    points: p.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
  }));
}

export function scalePaths(
  paths: PolylinePath[],
  scaleX: number,
  scaleY: number,
  origin?: Point2D
): PolylinePath[] {
  const b = computeBounds(paths);
  if (!b) return paths;
  const ox = origin ? origin.x : b.centerX;
  const oy = origin ? origin.y : b.centerY;
  return paths.map((p) => ({
    ...p,
    points: p.points.map((pt) => ({
      x: ox + (pt.x - ox) * scaleX,
      y: oy + (pt.y - oy) * scaleY,
    })),
  }));
}

export function rotatePaths(
  paths: PolylinePath[],
  angleDeg: number,
  origin?: Point2D
): PolylinePath[] {
  if (Math.abs(angleDeg) < 1e-6) return paths;
  const b = computeBounds(paths);
  if (!b) return paths;
  const ox = origin ? origin.x : b.centerX;
  const oy = origin ? origin.y : b.centerY;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return paths.map((p) => ({
    ...p,
    points: p.points.map((pt) => {
      const dx = pt.x - ox;
      const dy = pt.y - oy;
      return {
        x: ox + dx * cos - dy * sin,
        y: oy + dx * sin + dy * cos,
      };
    }),
  }));
}

export function centerPathsOnBed(
  paths: PolylinePath[],
  bedWidthMm: number,
  bedHeightMm: number
): PolylinePath[] {
  const b = computeBounds(paths);
  if (!b) return paths;
  const dx = bedWidthMm / 2 - b.centerX;
  const dy = bedHeightMm / 2 - b.centerY;
  return translatePaths(paths, dx, dy);
}

// Ramer-Douglas-Peucker simplification
function perpendicularDistance(pt: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(pt, lineStart);
  const t = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / lenSq;
  const proj = { x: lineStart.x + t * dx, y: lineStart.y + t * dy };
  return dist(pt, proj);
}

export function simplifyRDP(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length < 3 || epsilon <= 0) return points;
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
}

export function smoothChaikin(points: Point2D[], closed: boolean, iterations = 1): Point2D[] {
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (pts.length < 3) break;
    const next: Point2D[] = [];
    if (!closed) {
      next.push(pts[0]);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
        next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
      }
      next.push(pts[pts.length - 1]);
    } else {
      for (let i = 0; i < pts.length; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % pts.length];
        next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
        next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
      }
    }
    pts = next;
  }
  return pts;
}

// Scanline hatch fill across closed polygons (supports islands/holes via even-odd rule!)
export function generateHatchLines(
  polygons: Point2D[][],
  spacingMm: number,
  angleDeg: number
): Point2D[][] {
  if (polygons.length === 0 || spacingMm <= 0.05) return [];

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const invCos = Math.cos(rad);
  const invSin = Math.sin(rad);

  const rotatedPolys = polygons.map((poly) =>
    poly.map((p) => ({
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos,
    }))
  );

  let minY = Infinity;
  let maxY = -Infinity;
  for (const poly of rotatedPolys) {
    for (const p of poly) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const lines: Point2D[][] = [];
  let rowIndex = 0;

  for (let y = minY + spacingMm * 0.5; y <= maxY - spacingMm * 0.1; y += spacingMm) {
    const intersections: number[] = [];

    for (const poly of rotatedPolys) {
      const n = poly.length;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const t = (y - a.y) / (b.y - a.y);
          intersections.push(a.x + t * (b.x - a.x));
        }
      }
    }

    intersections.sort((a, b) => a - b);

    const rowSegments: Point2D[][] = [];
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const x1 = intersections[i];
      const x2 = intersections[i + 1];
      if (x2 - x1 > 0.1) {
        const p1 = { x: x1 * invCos - y * invSin, y: x1 * invSin + y * invCos };
        const p2 = { x: x2 * invCos - y * invSin, y: x2 * invSin + y * invCos };
        rowSegments.push([p1, p2]);
      }
    }

    // Bidirectional zig-zag ordering for faster laser scanning
    if (rowIndex % 2 === 1) {
      rowSegments.reverse().forEach((seg) => seg.reverse());
    }
    lines.push(...rowSegments);
    rowIndex++;
  }

  return lines;
}

function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Nearest-neighbor ordering within each layer; for 'cut' layer, always cuts inner holes before outer perimeters!
export function optimizePathOrder(paths: PolylinePath[]): PolylinePath[] {
  const byLayer: Record<LayerType, PolylinePath[]> = {
    engrave: [],
    carve: [],
    cut: [],
  };

  for (const p of paths) {
    if (p.points.length >= 2) {
      byLayer[p.layerId].push(p);
    }
  }

  const ordered: PolylinePath[] = [];
  let currentPos: Point2D = { x: 0, y: 0 };

  const orderGroup = (group: PolylinePath[]) => {
    const remaining = [...group];
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      let reverseBest = false;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const startPt = candidate.points[0];
        const endPt = candidate.closed ? startPt : candidate.points[candidate.points.length - 1];

        const dStart = dist(currentPos, startPt);
        if (dStart < bestDist) {
          bestDist = dStart;
          bestIdx = i;
          reverseBest = false;
        }
        if (!candidate.closed) {
          const dEnd = dist(currentPos, endPt);
          if (dEnd < bestDist) {
            bestDist = dEnd;
            bestIdx = i;
            reverseBest = true;
          }
        }
      }

      const [chosen] = remaining.splice(bestIdx, 1);
      const finalPts = reverseBest ? [...chosen.points].reverse() : chosen.points;
      ordered.push({ ...chosen, points: finalPts });
      currentPos = chosen.closed ? finalPts[0] : finalPts[finalPts.length - 1];
    }
  };

  for (const layerId of LAYER_ORDER) {
    const layerGroup = byLayer[layerId];
    if (layerGroup.length === 0) continue;

    if (layerId === 'cut' && layerGroup.length > 1) {
      const closedPolys = layerGroup.filter((p) => p.closed && p.points.length >= 3);
      const openPaths = layerGroup.filter((p) => !p.closed || p.points.length < 3);

      // Compute nesting depth for each closed cut polygon (holes have depth >= 1)
      const depthMap = new Map<number, PolylinePath[]>();
      let maxDepth = 0;

      closedPolys.forEach((poly, idx) => {
        const testPt = poly.points[0];
        let depth = 0;
        closedPolys.forEach((other, oIdx) => {
          if (idx !== oIdx && pointInPolygon(testPt, other.points)) {
            depth++;
          }
        });
        if (depth > maxDepth) maxDepth = depth;
        const arr = depthMap.get(depth);
        if (arr) arr.push(poly);
        else depthMap.set(depth, [poly]);
      });

      // Cut inner open slots first, then innermost holes down to outermost perimeter (depth 0)
      if (openPaths.length > 0) orderGroup(openPaths);
      for (let d = maxDepth; d >= 0; d--) {
        const bucket = depthMap.get(d);
        if (bucket && bucket.length > 0) orderGroup(bucket);
      }
    } else {
      orderGroup(layerGroup);
    }
  }

  return ordered;
}

export function computeToolpathStats(
  paths: PolylinePath[],
  layers: Record<LayerType, LaserLayerConfig>
): ToolpathStats {
  const visiblePaths = paths.filter((p) => layers[p.layerId]?.visible && p.points.length >= 2);
  const ordered = optimizePathOrder(visiblePaths);
  const bounds = computeBounds(ordered);

  const breakdown: ToolpathStats['layerBreakdown'] = {
    engrave: { paths: 0, lengthMm: 0, estimatedSeconds: 0 },
    carve: { paths: 0, lengthMm: 0, estimatedSeconds: 0 },
    cut: { paths: 0, lengthMm: 0, estimatedSeconds: 0 },
  };

  let cutLengthMm = 0;
  let rapidLengthMm = 0;
  let estimatedSeconds = 0;
  let cursor: Point2D = { x: 0, y: 0 };
  const rapidSpeedMmPerSec = 3000 / 60;

  for (const layerId of LAYER_ORDER) {
    const layer = layers[layerId];
    const layerPaths = ordered.filter((p) => p.layerId === layerId);
    if (layerPaths.length === 0) continue;

    let layerSinglePassLen = 0;
    let layerRapidLen = 0;

    for (let pass = 0; pass < layer.passes; pass++) {
      for (const p of layerPaths) {
        layerRapidLen += dist(cursor, p.points[0]);
        const len = pathLength(p.points, p.closed);
        if (pass === 0) layerSinglePassLen += len;
        cursor = p.closed ? p.points[0] : p.points[p.points.length - 1];
      }
    }

    const totalLayerBurnLen = layerSinglePassLen * layer.passes;
    const speedMmPerSec = Math.max(1, layer.speed / 60);
    // Include subtle acceleration overhead per path segment (~0.08s per path)
    const burnTime =
      totalLayerBurnLen / speedMmPerSec +
      layerRapidLen / rapidSpeedMmPerSec +
      layerPaths.length * layer.passes * 0.08;

    breakdown[layerId] = {
      paths: layerPaths.length,
      lengthMm: totalLayerBurnLen,
      estimatedSeconds: burnTime,
    };

    cutLengthMm += totalLayerBurnLen;
    rapidLengthMm += layerRapidLen;
    estimatedSeconds += burnTime;
  }

  return {
    totalPaths: ordered.length,
    cutLengthMm,
    rapidLengthMm,
    estimatedSeconds,
    bounds,
    layerBreakdown: breakdown,
  };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins === 0) return `${rem}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  return `${mins}m ${rem.toString().padStart(2, '0')}s`;
}
