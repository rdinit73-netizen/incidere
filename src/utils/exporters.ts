import { LAYER_ORDER } from '../data/woodPresets';
import { LaserLayerConfig, LayerType, OriginMode, PolylinePath } from '../types/vector';
import { computeBounds, optimizePathOrder } from './geometry';

function fmt(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, '');
}

// 1. EXPORT LASERGRBL-CLEAN SVG (strictly <path> elements in mm units, fill="none", hairline stroke)
export function exportToLaserGrblSvg(
  paths: PolylinePath[],
  layers: Record<LayerType, LaserLayerConfig>,
  projectTitle: string,
  tightCrop = true,
  bedW = 300,
  bedH = 300,
  hairlineWidthMm = 0.01
): string {
  const visiblePaths = optimizePathOrder(
    paths.filter((p) => layers[p.layerId]?.visible && p.points.length >= 2)
  );
  const bounds = computeBounds(visiblePaths);
  const margin = 2;

  const minX = tightCrop && bounds ? bounds.minX - margin : 0;
  const minY = tightCrop && bounds ? bounds.minY - margin : 0;
  const widthMm = tightCrop && bounds ? Math.max(10, bounds.width + margin * 2) : bedW;
  const heightMm = tightCrop && bounds ? Math.max(10, bounds.height + margin * 2) : bedH;

  const layerNames: Record<LayerType, string> = {
    engrave: 'INCISIONE',
    carve: 'INTAGLIO',
    cut: 'TAGLIO',
  };

  const groups: string[] = [];

  for (const layerId of LAYER_ORDER) {
    const layer = layers[layerId];
    const layerPaths = visiblePaths.filter((p) => p.layerId === layerId);
    if (layerPaths.length === 0) continue;

    const pathNodes = layerPaths
      .map((p) => {
        const dParts = p.points.map(
          (pt, idx) => `${idx === 0 ? 'M' : 'L'}${fmt(pt.x - minX)},${fmt(pt.y - minY)}`
        );
        if (p.closed) dParts.push('Z');
        return `    <path d="${dParts.join(' ')}" fill="none" stroke="${layer.color}" stroke-width="${hairlineWidthMm}" />`;
      })
      .join('\n');

    groups.push(
      `  <g id="${layerNames[layerId]}" stroke="${layer.color}" stroke-width="${hairlineWidthMm}" fill="none">\n${pathNodes}\n  </g>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generato con VettoreLegno per LaserGRBL: ${projectTitle} | fill="none" | stroke-width="${hairlineWidthMm}mm" -->
<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(widthMm)}mm" height="${fmt(heightMm)}mm" viewBox="0 0 ${fmt(widthMm)} ${fmt(heightMm)}" fill="none">
${groups.join('\n')}
</svg>
`;
}

// 2. EXPORT READY-TO-RUN GRBL 1.1 G-CODE (.nc) FOR LASERGRBL
export function exportToLaserGrblGcode(
  paths: PolylinePath[],
  layers: Record<LayerType, LaserLayerConfig>,
  projectTitle: string,
  originMode: OriginMode,
  woodPresetName: string
): string {
  const visiblePaths = optimizePathOrder(
    paths.filter((p) => layers[p.layerId]?.visible && p.points.length >= 2)
  );
  const bounds = computeBounds(visiblePaths);
  if (!bounds) return '; Nessun tracciato attivo\nM2\n';

  // Transform screen-mm (Y down) to GRBL Cartesian mm (Y up):
  // bottom-left origin places minX=0, maxY=0 (everything in +X, +Y quadrant)
  // center origin places centerX=0, centerY=0
  const toGrbl = (x: number, y: number): { gx: number; gy: number } => {
    if (originMode === 'center') {
      return {
        gx: x - bounds.centerX,
        gy: bounds.centerY - y,
      };
    }
    return {
      gx: x - bounds.minX,
      gy: bounds.maxY - y,
    };
  };

  const lines: string[] = [
    `; ============================================================`,
    `; VettoreLegno - G-Code ottimizzato per LaserGRBL (GRBL 1.1)`,
    `; Progetto: ${projectTitle}`,
    `; Materiale: ${woodPresetName}`,
    `; Dimensioni: ${bounds.width.toFixed(1)} x ${bounds.height.toFixed(1)} mm`,
    `; Origine (X0 Y0): ${originMode === 'center' ? 'Centro del pezzo' : 'Angolo Basso-Sinistra'}`,
    `; Ordine lavorazione: Incisione -> Intaglio -> Taglio Passante`,
    `; ============================================================`,
    `G21 ; Unita in millimetri`,
    `G90 ; Coordinate assolute`,
    `G17 ; Piano XY`,
    `M5 ; Laser spento iniziale`,
    `G0 F3000`,
    ``,
  ];

  for (const layerId of LAYER_ORDER) {
    const layer = layers[layerId];
    const layerPaths = visiblePaths.filter((p) => p.layerId === layerId);
    if (layerPaths.length === 0) continue;

    lines.push(`; --- LIVELLO: ${layer.name.toUpperCase()} (${layer.passes}x @ F${layer.speed} S${layer.power}) ---`);
    if (layer.airAssist) {
      lines.push(`M8 ; Air Assist ON`);
    }

    for (let pass = 1; pass <= layer.passes; pass++) {
      lines.push(`; Passaggio ${pass} di ${layer.passes}`);
      // Initialize laser mode with S0
      lines.push(`${layer.laserMode} S0`);

      for (const p of layerPaths) {
        const start = toGrbl(p.points[0].x, p.points[0].y);
        // Rapid move with S0 (laser off)
        lines.push(`G0 X${fmt(start.gx)} Y${fmt(start.gy)} S0`);
        // Turn laser on at configured power and feedrate
        let firstMove = true;
        for (let i = 1; i < p.points.length; i++) {
          const pt = toGrbl(p.points[i].x, p.points[i].y);
          if (firstMove) {
            lines.push(`G1 X${fmt(pt.gx)} Y${fmt(pt.gy)} F${layer.speed} S${layer.power}`);
            firstMove = false;
          } else {
            lines.push(`G1 X${fmt(pt.gx)} Y${fmt(pt.gy)}`);
          }
        }
        if (p.closed) {
          if (firstMove) {
            lines.push(`G1 X${fmt(start.gx)} Y${fmt(start.gy)} F${layer.speed} S${layer.power}`);
          } else {
            lines.push(`G1 X${fmt(start.gx)} Y${fmt(start.gy)}`);
          }
        }
        lines.push(`S0`);
      }
      lines.push(`M5`);
    }

    if (layer.airAssist) {
      lines.push(`M9 ; Air Assist OFF`);
    }
    lines.push(``);
  }

  lines.push(`; Fine lavorazione`);
  lines.push(`M5 ; Spegni laser`);
  lines.push(`M9 ; Spegni Air Assist`);
  lines.push(`G0 X0 Y0 ; Ritorno a origine`);
  lines.push(`M2 ; Fine programma`);

  return lines.join('\n') + '\n';
}

// 3. EXPORT STANDARD ASCII R12 DXF (millimeters, upright +Y)
export function exportToDxf(
  paths: PolylinePath[],
  layers: Record<LayerType, LaserLayerConfig>
): string {
  const visiblePaths = optimizePathOrder(
    paths.filter((p) => layers[p.layerId]?.visible && p.points.length >= 2)
  );
  const bounds = computeBounds(visiblePaths);
  const minX = bounds ? bounds.minX : 0;
  const maxY = bounds ? bounds.maxY : 0;

  const dxfLayerMap: Record<LayerType, { name: string; colorCode: number }> = {
    engrave: { name: 'INCISIONE', colorCode: 5 }, // Blue
    carve: { name: 'INTAGLIO', colorCode: 30 }, // Orange/Amber
    cut: { name: 'TAGLIO', colorCode: 1 }, // Red
  };

  const out: string[] = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '4', // 4 = Millimeters
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '3',
  ];

  for (const lid of LAYER_ORDER) {
    const info = dxfLayerMap[lid];
    out.push('0', 'LAYER', '2', info.name, '70', '0', '62', String(info.colorCode), '6', 'CONTINUOUS');
  }

  out.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');

  for (const p of visiblePaths) {
    const layerName = dxfLayerMap[p.layerId].name;
    out.push('0', 'POLYLINE', '8', layerName, '66', '1', '70', p.closed ? '1' : '0');
    for (const pt of p.points) {
      out.push(
        '0', 'VERTEX', '8', layerName,
        '10', fmt(pt.x - minX),
        '20', fmt(maxY - pt.y),
        '30', '0'
      );
    }
    out.push('0', 'SEQEND');
  }

  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n') + '\n';
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
