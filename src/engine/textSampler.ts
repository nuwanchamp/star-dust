import type { ParticlePool } from './particlePool';
import type { DensityPreset, FontStyle } from '../types/mote';

export interface SampledPoint {
  x: number;
  y: number;
  weight?: number;
  regionId?: number;
}

export interface TextSamplingResult {
  points: SampledPoint[];
  fontSize: number;
  isParagraph: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

const FONT_FAMILY_MAP: Record<FontStyle, string> = {
  serif: "'Fraunces', Georgia, serif",
  sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

const DENSITY_STEP_MAP: Record<DensityPreset, number> = {
  sparse: 3,
  balanced: 2,
  dense: 1,
};

const DENSITY_AMBIENT_COUNT: Record<DensityPreset, number> = {
  sparse: 9500,
  balanced: 21000,
  dense: 36000,
};

export function getAmbientCount(density: DensityPreset, width: number, height: number): number {
  const areaFactor = Math.min(1.2, Math.max(0.42, (width * height) / (1440 * 900)));
  return Math.round(DENSITY_AMBIENT_COUNT[density] * areaFactor);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split(/\n+/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const clean = para.replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    const words = clean.split(' ');
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
          currentLine = '';
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Renders a phrase or multi-line paragraph onto an invisible offscreen canvas
 * (2x supersampled for smaller/paragraph text) and extracts crisp gravitational anchor coordinates.
 */
export function sampleTextTargets(
  text: string,
  viewportWidth: number,
  viewportHeight: number,
  fontStyle: FontStyle,
  density: DensityPreset
): TextSamplingResult {
  const trimmed = text.trim();
  if (!trimmed || viewportWidth < 120 || viewportHeight < 120) {
    return {
      points: [],
      fontSize: 72,
      isParagraph: false,
      bounds: { x: 0, y: 0, width: viewportWidth, height: viewportHeight },
    };
  }

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    return {
      points: [],
      fontSize: 72,
      isParagraph: false,
      bounds: { x: 0, y: 0, width: viewportWidth, height: viewportHeight },
    };
  }

  const isParagraph = trimmed.length > 52 || trimmed.includes('\n');
  const horizontalMargin =
    viewportWidth < 640
      ? 28
      : isParagraph
      ? Math.min(240, viewportWidth * 0.16)
      : Math.min(200, viewportWidth * 0.14);
  const maxTextWidth = Math.max(220, viewportWidth - horizontalMargin * 2);

  const topReserve = viewportWidth < 640 ? 64 : 78;
  const bottomReserve = viewportWidth < 640 ? 158 : 170;
  const safeHeight = Math.max(160, viewportHeight - topReserve - bottomReserve);
  const centerY = topReserve + safeHeight / 2;

  const fontFamily = FONT_FAMILY_MAP[fontStyle];
  const fontWeight = fontStyle === 'serif' ? 500 : fontStyle === 'mono' ? 500 : 600;

  const charCount = trimmed.length;
  const lengthScale =
    charCount > 160
      ? 0.38
      : charCount > 100
      ? 0.46
      : charCount > 55
      ? 0.58
      : charCount > 28
      ? 0.78
      : 1;

  let fontSize = Math.round(
    Math.min(
      viewportWidth < 640 ? 50 : 108,
      Math.max(20, viewportWidth * 0.072 * lengthScale)
    )
  );

  if (fontStyle === 'mono') {
    fontSize = Math.round(fontSize * 0.86);
  }

  const maxAllowedLines = isParagraph ? 8 : 4;
  const lineSpacing = isParagraph ? 1.38 : 1.18;

  let lines: string[] = [];
  let widestLine = 0;
  while (fontSize >= 18) {
    measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapLines(measureCtx, trimmed, maxTextWidth);
    const lineHeight = fontSize * lineSpacing;
    const totalHeight = lines.length * lineHeight;
    widestLine = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 0);
    if (
      totalHeight <= safeHeight * 0.9 &&
      widestLine <= maxTextWidth &&
      lines.length <= maxAllowedLines
    ) {
      break;
    }
    fontSize -= 2;
  }

  // 2x supersampling for medium/paragraph font sizes preserves thin serifs and open letter bowls
  const sampleScale = fontSize <= 56 ? 2 : 1;

  const lineHeight = fontSize * lineSpacing;
  const blockHeight = (lines.length - 1) * lineHeight;
  const startY = centerY - blockHeight / 2;

  const textBounds = {
    x: Math.max(0, viewportWidth / 2 - widestLine / 2 - 12),
    y: Math.max(0, startY - fontSize * 0.65),
    width: Math.max(40, widestLine + 24),
    height: Math.max(40, blockHeight + fontSize * 1.3),
  };

  const offscreen = document.createElement('canvas');
  offscreen.width = Math.floor(viewportWidth * sampleScale);
  offscreen.height = Math.floor(viewportHeight * sampleScale);
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { points: [], fontSize, isParagraph, bounds: textBounds };

  ctx.setTransform(sampleScale, 0, 0, sampleScale, 0, 0);
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  lines.forEach((line, index) => {
    ctx.fillText(line, viewportWidth / 2, startY + index * lineHeight);
  });

  // Extract only the tight text bounding box for fast high-res sampling
  const pad = fontSize;
  const minX = Math.max(0, Math.floor((viewportWidth / 2 - widestLine / 2 - pad) * sampleScale));
  const maxX = Math.min(
    offscreen.width - 1,
    Math.ceil((viewportWidth / 2 + widestLine / 2 + pad) * sampleScale)
  );
  const minY = Math.max(0, Math.floor((startY - pad) * sampleScale));
  const maxY = Math.min(
    offscreen.height - 1,
    Math.ceil((startY + blockHeight + pad) * sampleScale)
  );

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW <= 0 || boxH <= 0) {
    return { points: [], fontSize, isParagraph, bounds: textBounds };
  }

  const imageData = ctx.getImageData(minX, minY, boxW, boxH).data;
  const baseStep = DENSITY_STEP_MAP[density];
  const step =
    viewportWidth < 640
      ? Math.max(2, baseStep)
      : fontSize <= 28 && sampleScale === 2
      ? Math.min(2, baseStep)
      : baseStep;

  // Tighter alpha threshold & jitter on smaller/paragraph fonts keeps counters (e, a, o, s) open
  const fontScale = Math.min(1, Math.max(0.26, fontSize / 80));
  const alphaThreshold = fontSize <= 42 ? 120 : 105;
  const jitter = (step / sampleScale) * (0.28 + 0.42 * fontScale);

  const points: SampledPoint[] = [];
  for (let y = 0; y < boxH; y += step) {
    const rowOffset = y * boxW;
    const cssBaseY = (minY + y) / sampleScale;
    for (let x = 0; x < boxW; x += step) {
      const alpha = imageData[(rowOffset + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        const cssBaseX = (minX + x) / sampleScale;
        points.push({
          x: cssBaseX + (Math.random() - 0.5) * jitter,
          y: cssBaseY + (Math.random() - 0.5) * jitter,
        });
      }
    }
  }

  // Shuffle uniformly so any density cap thins evenly without dropping specific lines
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = points[i];
    points[i] = points[j];
    points[j] = tmp;
  }

  const maxGlyphPoints =
    density === 'dense' ? 32000 : density === 'balanced' ? 24000 : 12000;

  return {
    points: points.length > maxGlyphPoints ? points.slice(0, maxGlyphPoints) : points,
    fontSize,
    isParagraph,
    bounds: {
      x: Math.max(0, viewportWidth / 2 - widestLine / 2 - 12),
      y: Math.max(0, startY - fontSize * 0.65),
      width: Math.max(40, widestLine + 24),
      height: Math.max(40, blockHeight + fontSize * 1.3),
    },
  };
}

/**
 * Spatial grid nearest-mote matcher operating directly on typed-array ParticlePool.
 */
export function assignTargetsByProximity(
  pool: ParticlePool,
  targets: SampledPoint[],
  width: number,
  height: number,
  fontSize = 72,
  isImage = false,
  onAssign?: (targetIndex: number, particleIndex: number) => void
): void {
  const count = pool.count;
  const {
    x,
    y,
    tx,
    ty,
    hasTarget,
    isFringe,
    regionId,
    windReleaseAt,
    gravityBreakUntil,
    baseAlpha,
    waveLayer,
    waveV,
  } = pool;

  for (let i = 0; i < count; i++) {
    hasTarget[i] = 0;
    isFringe[i] = 0;
    regionId[i] = -1;
    windReleaseAt[i] = 0;
    baseAlpha[i] =
      waveLayer[i] >= 0
        ? 0.24 + (1 - Math.abs(waveV[i])) * 0.52
        : 0.14 + Math.random() * 0.26;
  }

  if (targets.length === 0 || count === 0) return;

  const cellSize = 48;
  const cols = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const numCells = cols * rows;

  const cellHeads = new Int32Array(numCells).fill(-1);
  const nextInCell = new Int32Array(count);
  const claimed = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(x[i] / cellSize)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y[i] / cellSize)));
    const cellIdx = cy * cols + cx;
    nextInCell[i] = cellHeads[cellIdx];
    cellHeads[cellIdx] = i;
  }

  let fallbackScanIdx = 0;
  // Fewer orbiting fringe motes on compact paragraph fonts; none on image sculptures for crisp facial detail
  const fringeRatio = isImage ? 1 : fontSize <= 38 ? 0.95 : 0.9;
  const fringeStartIdx = Math.floor(targets.length * fringeRatio);

  for (let t = 0; t < targets.length; t++) {
    const anchorX = targets[t].x;
    const anchorY = targets[t].y;
    const tcx = Math.min(cols - 1, Math.max(0, Math.floor(anchorX / cellSize)));
    const tcy = Math.min(rows - 1, Math.max(0, Math.floor(anchorY / cellSize)));

    let bestIdx = -1;
    let bestDistSq = Infinity;

    for (let r = 0; r <= 5; r++) {
      const minX = Math.max(0, tcx - r);
      const maxX = Math.min(cols - 1, tcx + r);
      const minY = Math.max(0, tcy - r);
      const maxY = Math.min(rows - 1, tcy + r);

      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          if (r > 0 && cx !== minX && cx !== maxX && cy !== minY && cy !== maxY) {
            continue;
          }
          let idx = cellHeads[cy * cols + cx];
          while (idx !== -1) {
            if (!claimed[idx]) {
              const dx = x[idx] - anchorX;
              const dy = y[idx] - anchorY;
              const dSq = dx * dx + dy * dy;
              if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestIdx = idx;
              }
            }
            idx = nextInCell[idx];
          }
        }
      }

      if (bestIdx !== -1) break;
    }

    if (bestIdx === -1) {
      while (fallbackScanIdx < count && claimed[fallbackScanIdx]) {
        fallbackScanIdx++;
      }
      if (fallbackScanIdx < count) {
        bestIdx = fallbackScanIdx;
        fallbackScanIdx++;
      }
    }

    if (bestIdx !== -1) {
      claimed[bestIdx] = 1;
      tx[bestIdx] = anchorX;
      ty[bestIdx] = anchorY;
      hasTarget[bestIdx] = 1;
      isFringe[bestIdx] = t >= fringeStartIdx ? 1 : 0;
      regionId[bestIdx] = targets[t].regionId ?? -1;
      gravityBreakUntil[bestIdx] = 0;
      const pointWeight = targets[t].weight;
      baseAlpha[bestIdx] =
        pointWeight !== undefined
          ? pointWeight
          : t >= fringeStartIdx
          ? 0.36 + Math.random() * 0.22
          : 0.72 + Math.random() * 0.22;
      onAssign?.(t, bestIdx);
    }
  }
}
