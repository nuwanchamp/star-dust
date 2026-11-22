import type { SampledPoint } from './textSampler';
import type { DensityPreset, ImageTuningConfig } from '../types/mote';


export interface ImageSamplingResult {
  points: SampledPoint[];
  cellSize: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ImageSourceBounds {
  natW: number;
  natH: number;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  hasAlphaEmptySpace: boolean;
  aspectRatio: number;
}

const sourceBoundsCache = new WeakMap<HTMLImageElement, ImageSourceBounds>();

export function getImageSourceBounds(img: HTMLImageElement): ImageSourceBounds | null {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  if (!natW || !natH) return null;

  const cached = sourceBoundsCache.get(img);
  if (cached && cached.natW === natW && cached.natH === natH) {
    return cached;
  }

  const scanScale = Math.min(1, 480 / Math.max(natW, natH));
  const scanW = Math.max(32, Math.round(natW * scanScale));
  const scanH = Math.max(32, Math.round(natH * scanScale));
  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = scanW;
  scanCanvas.height = scanH;
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
  if (!scanCtx) {
    const fallback: ImageSourceBounds = {
      natW,
      natH,
      srcX: 0,
      srcY: 0,
      srcW: natW,
      srcH: natH,
      hasAlphaEmptySpace: false,
      aspectRatio: natW / natH,
    };
    return fallback;
  }

  scanCtx.drawImage(img, 0, 0, scanW, scanH);
  let scanRgba: Uint8ClampedArray;
  try {
    scanRgba = scanCtx.getImageData(0, 0, scanW, scanH).data;
  } catch {
    return null;
  }

  let minSX = scanW;
  let minSY = scanH;
  let maxSX = -1;
  let maxSY = -1;
  let transparentCount = 0;
  const totalScan = scanW * scanH;

  for (let y = 0; y < scanH; y++) {
    const row = y * scanW;
    for (let x = 0; x < scanW; x++) {
      const a = scanRgba[(row + x) * 4 + 3];
      if (a > 12) {
        if (x < minSX) minSX = x;
        if (x > maxSX) maxSX = x;
        if (y < minSY) minSY = y;
        if (y > maxSY) maxSY = y;
      } else {
        transparentCount++;
      }
    }
  }

  if (maxSX < minSX || maxSY < minSY) {
    return null;
  }

  const hasAlphaEmptySpace = transparentCount / totalScan > 0.015;
  let srcX = 0;
  let srcY = 0;
  let srcW = natW;
  let srcH = natH;

  if (hasAlphaEmptySpace) {
    const rawCropW = (maxSX - minSX + 1) / scanScale;
    const rawCropH = (maxSY - minSY + 1) / scanScale;
    const padX = rawCropW * 0.03;
    const padY = rawCropH * 0.03;
    srcX = Math.max(0, Math.floor(minSX / scanScale - padX));
    srcY = Math.max(0, Math.floor(minSY / scanScale - padY));
    const endX = Math.min(natW, Math.ceil((maxSX + 1) / scanScale + padX));
    const endY = Math.min(natH, Math.ceil((maxSY + 1) / scanScale + padY));
    srcW = Math.max(1, endX - srcX);
    srcH = Math.max(1, endY - srcY);
  }

  const resolved: ImageSourceBounds = {
    natW,
    natH,
    srcX,
    srcY,
    srcW,
    srcH,
    hasAlphaEmptySpace,
    aspectRatio: srcW / Math.max(1, srcH),
  };
  sourceBoundsCache.set(img, resolved);
  return resolved;
}

const DENSITY_TARGET_COUNT: Record<DensityPreset, number> = {
  sparse: 14000,
  balanced: 27000,
  dense: 41000,
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Separable box blur on Float32Array grayscale image.
 */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  const invSpan = 1 / (radius * 2 + 1);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = Math.max(0, Math.min(w - 1, dx));
      sum += src[row + sx];
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum * invSpan;
      const outX = Math.max(0, x - radius);
      const inX = Math.min(w - 1, x + radius + 1);
      sum += src[row + inX] - src[row + outX];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      const sy = Math.max(0, Math.min(h - 1, dy));
      sum += tmp[sy * w + x];
    }
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum * invSpan;
      const outY = Math.max(0, y - radius);
      const inY = Math.min(h - 1, y + radius + 1);
      sum += tmp[inY * w + x] - tmp[outY * w + x];
    }
  }

  return dst;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Converts any image into a high-clarity monochrome halftone/contrast particle sculpture:
 * 1. Trims screenshot outer bezels so borders never draw frame lines.
 * 2. Detects uniform wall/studio backdrops via perimeter RGB + flood-fill and isolates the subject.
 * 3. Normalizes subject tonal contrast + signed local relief + Sobel contours.
 * 4. Runs serpentine Floyd-Steinberg error-diffusion stippling at adaptive resolution for clean spacing.
 */
export const DEFAULT_IMAGE_TUNING: ImageTuningConfig = {
  blurStyle: 'radial',
  edgeBlur: 0.45,
  contrast: 1.05,
  detail: 0.85,
};

export function computeAspectAwareStageBox(
  aspectRatio: number,
  viewportWidth: number,
  viewportHeight: number,
  edgeBlur = 0
): { x: number; y: number; width: number; height: number } {
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0.05 ? aspectRatio : 1;
  const isMobile = viewportWidth < 640;
  const isShortViewport = viewportHeight < 560;

  // Dynamic HUD safe margins so neither TopBar nor ComposerDock ever clip tall or wide frames
  const topReserve = Math.min(
    isMobile ? 64 : 78,
    Math.max(44, viewportHeight * (isShortViewport ? 0.12 : 0.13))
  );
  const bottomReserve = Math.min(
    isMobile ? 148 : 164,
    Math.max(88, viewportHeight * (isShortViewport ? 0.24 : 0.27))
  );
  const sideMargin = isMobile ? 14 : 28;

  const availW = Math.max(80, viewportWidth - sideMargin * 2);
  const availH = Math.max(80, viewportHeight - topReserve - bottomReserve);

  // Reserve scatter halo padding inside the safe stage so blurred particles stay on-screen
  const clampedBlur = clamp01(edgeBlur);
  const scatterPad =
    clampedBlur > 0.01
      ? Math.min(Math.min(availW, availH) * 0.12, Math.round(10 + clampedBlur * 22))
      : 4;

  const innerAvailW = Math.max(48, availW - scatterPad * 2);
  const innerAvailH = Math.max(48, availH - scatterPad * 2);

  // Dynamically shape bounding box constraint from the source image's aspect ratio
  let maxBoxW: number;
  let maxBoxH: number;

  if (safeAspect > 1.15) {
    // Horizontal / landscape / panoramic: unlock generous width while keeping vertical clearance
    const widthCapRatio = isMobile ? 0.94 : 0.9;
    maxBoxW = Math.min(innerAvailW, viewportWidth * widthCapRatio);
    maxBoxH = innerAvailH;
  } else if (safeAspect < 0.85) {
    // Vertical / portrait: maximize safe vertical headroom without squeezing narrow screens
    maxBoxH = innerAvailH;
    maxBoxW = Math.min(innerAvailW, Math.max(innerAvailW * 0.72, maxBoxH * safeAspect));
  } else {
    // Square / balanced
    const widthCapRatio = isMobile ? 0.9 : 0.85;
    maxBoxW = Math.min(innerAvailW, viewportWidth * widthCapRatio);
    maxBoxH = innerAvailH;
  }

  return {
    x: (viewportWidth - maxBoxW) * 0.5,
    y: topReserve + scatterPad + (innerAvailH - maxBoxH) * 0.5,
    width: maxBoxW,
    height: maxBoxH,
  };
}

export function sampleImageTargets(
  img: HTMLImageElement,
  viewportWidth: number,
  viewportHeight: number,
  density: DensityPreset,
  invertContrast = false,
  isDarkTheme = true,
  tuning: ImageTuningConfig = DEFAULT_IMAGE_TUNING
): ImageSamplingResult {
  const sourceBounds = getImageSourceBounds(img);
  if (!sourceBounds || viewportWidth < 120 || viewportHeight < 120) {
    return { points: [], cellSize: 2, bounds: { x: 0, y: 0, width: 0, height: 0 } };
  }

  const stageBox = computeAspectAwareStageBox(
    sourceBounds.aspectRatio,
    viewportWidth,
    viewportHeight,
    tuning.edgeBlur
  );

  return sampleImageIntoBox(
    img,
    stageBox.x,
    stageBox.y,
    stageBox.width,
    stageBox.height,
    density,
    invertContrast,
    isDarkTheme,
    tuning
  );
}

export function sampleImageIntoBox(
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  density: DensityPreset,
  invertContrast = false,
  isDarkTheme = true,
  tuning: ImageTuningConfig = DEFAULT_IMAGE_TUNING,
  targetCountOverride?: number
): ImageSamplingResult {
  const sourceBounds = getImageSourceBounds(img);
  if (!sourceBounds || boxW < 24 || boxH < 24) {
    return { points: [], cellSize: 2, bounds: { x: boxX, y: boxY, width: boxW, height: boxH } };
  }

  const { srcX, srcY, srcW, srcH, hasAlphaEmptySpace } = sourceBounds;

  const fitScale = Math.min(boxW / srcW, boxH / srcH);
  const stageW = srcW * fitScale;
  const stageH = srcH * fitScale;
  const stageX = boxX + (boxW - stageW) * 0.5;
  const stageY = boxY + (boxH - stageH) * 0.5;

  // Working analysis resolution (~340px max dimension on the non-empty content, preserving aspect ratio)
  const maxWorkSide = 340;
  const workScale = Math.min(2, maxWorkSide / Math.max(srcW, srcH));
  const w = Math.max(16, Math.round(srcW * workScale));
  const h = Math.max(16, Math.round(srcH * workScale));

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { points: [], cellSize: 2, bounds: { x: stageX, y: stageY, width: stageW, height: stageH } };
  }

  if (hasAlphaEmptySpace) {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }
  let rgba: Uint8ClampedArray;
  try {
    rgba = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return { points: [], cellSize: 2, bounds: { x: stageX, y: stageY, width: stageW, height: stageH } };
  }

  const totalPixels = w * h;
  const rArr = new Float32Array(totalPixels);
  const gArr = new Float32Array(totalPixels);
  const bArr = new Float32Array(totalPixels);
  const premulLum = new Float32Array(totalPixels);
  const alpha = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const p = i * 4;
    const a = rgba[p + 3] / 255;
    const r = rgba[p] / 255;
    const g = rgba[p + 1] / 255;
    const b = rgba[p + 2] / 255;
    rArr[i] = r;
    gArr[i] = g;
    bArr[i] = b;
    alpha[i] = a;
    premulLum[i] = (0.299 * r + 0.587 * g + 0.114 * b) * a;
  }

  // Alpha-normalized blur prevents dark halo bleed from transparent PNG empty space
  const blurLumSmall = boxBlur(premulLum, w, h, 1);
  const blurAlphaSmall = boxBlur(alpha, w, h, 1);
  const wideRadius = Math.max(8, Math.round(Math.max(w, h) * 0.055));
  const blurLumWide = boxBlur(blurLumSmall, w, h, wideRadius);
  const blurAlphaWide = boxBlur(blurAlphaSmall, w, h, wideRadius);

  const blurSmall = new Float32Array(totalPixels);
  const blurWide = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    blurSmall[i] = blurAlphaSmall[i] > 0.04 ? blurLumSmall[i] / blurAlphaSmall[i] : 0;
    blurWide[i] = blurAlphaWide[i] > 0.04 ? blurLumWide[i] / blurAlphaWide[i] : 0;
  }

  // Transparent cutouts keep full edge precision (1px guard); opaque photos strip ~2% outer bezel
  const bezel = hasAlphaEmptySpace ? 1 : Math.max(4, Math.round(Math.min(w, h) * 0.022));
  const sobelArr = new Float32Array(totalPixels);

  for (let y = bezel; y < h - bezel; y++) {
    const row = y * w;
    for (let x = bezel; x < w - bezel; x++) {
      const idx = row + x;
      const tl = blurSmall[idx - w - 1];
      const tc = blurSmall[idx - w];
      const tr = blurSmall[idx - w + 1];
      const ml = blurSmall[idx - 1];
      const mr = blurSmall[idx + 1];
      const bl = blurSmall[idx + w - 1];
      const bc = blurSmall[idx + w];
      const br = blurSmall[idx + w + 1];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const lumEdge = Math.hypot(gx, gy);

      // Alpha silhouette edge ensures dark/black PNG shapes on transparent space also get sharp outlines
      let alphaEdge = 0;
      if (hasAlphaEmptySpace) {
        const atl = alpha[idx - w - 1];
        const atc = alpha[idx - w];
        const atr = alpha[idx - w + 1];
        const aml = alpha[idx - 1];
        const amr = alpha[idx + 1];
        const abl = alpha[idx + w - 1];
        const abc = alpha[idx + w];
        const abr = alpha[idx + w + 1];
        const agx = -atl - 2 * aml - abl + atr + 2 * amr + abr;
        const agy = -atl - 2 * atc - atr + abl + 2 * abc + abr;
        alphaEdge = Math.hypot(agx, agy);
      }

      sobelArr[idx] = Math.max(lumEdge, alphaEdge * 0.88);
    }
  }

  // For opaque images, detect either a baked transparency checkerboard or a uniform wall backdrop
  const subjectMask = new Float32Array(totalPixels).fill(1);
  if (!hasAlphaEmptySpace) {
    const ringStart = bezel + 2;
    const ringDepth = Math.max(4, Math.round(Math.min(w, h) * 0.035));
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumL = 0;
    let sumL2 = 0;
    let ringCount = 0;

    const neutralRingLums: number[] = [];

    for (let y = ringStart; y < h - ringStart; y++) {
      for (let x = ringStart; x < w - ringStart; x++) {
        const inTop = y < ringStart + ringDepth;
        const inSide =
          (x < ringStart + ringDepth || x >= w - ringStart - ringDepth) && y < h * 0.85;
        if (inTop || inSide) {
          const idx = y * w + x;
          const r = rArr[idx];
          const g = gArr[idx];
          const b = bArr[idx];
          const chroma = Math.max(r, g, b) - Math.min(r, g, b);
          const l = 0.299 * r + 0.587 * g + 0.114 * b;

          if (chroma < 0.085 && l > 0.42) {
            neutralRingLums.push(l);
          }

          if (inTop || y < h * 0.65) {
            sumR += r;
            sumG += g;
            sumB += b;
            sumL += blurSmall[idx];
            sumL2 += blurSmall[idx] * blurSmall[idx];
            ringCount++;
          }
        }
      }
    }

    // Check for baked white/gray transparency checkerboard pattern on perimeter
    let isCheckerboard = false;
    let checkerLow = 0.65;
    let checkerHigh = 0.98;

    if (neutralRingLums.length > ringCount * 0.42 && neutralRingLums.length >= 24) {
      neutralRingLums.sort((a, b) => a - b);
      checkerLow = neutralRingLums[Math.floor(neutralRingLums.length * 0.18)];
      checkerHigh = neutralRingLums[Math.floor(neutralRingLums.length * 0.84)];

      if (checkerHigh - checkerLow > 0.08 && checkerHigh > 0.82 && checkerLow > 0.42) {
        const mid = (checkerLow + checkerHigh) * 0.5;
        let alternations = 0;

        const countTransitions = (indices: number[]) => {
          let lastSide = 0;
          for (let k = 0; k < indices.length; k++) {
            const idx = indices[k];
            const r = rArr[idx];
            const g = gArr[idx];
            const b = bArr[idx];
            const chroma = Math.max(r, g, b) - Math.min(r, g, b);
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            if (chroma < 0.085 && l >= checkerLow - 0.1 && l <= checkerHigh + 0.08) {
              const side = l >= mid ? 1 : -1;
              if (lastSide !== 0 && side !== lastSide) {
                alternations++;
              }
              lastSide = side;
            } else {
              lastSide = 0;
            }
          }
        };

        const leftCol: number[] = [];
        const rightCol: number[] = [];
        for (let y = ringStart; y < h - ringStart; y++) {
          leftCol.push(y * w + ringStart + 2);
          rightCol.push(y * w + (w - 1 - ringStart - 2));
        }
        const topRow: number[] = [];
        for (let x = ringStart; x < w - ringStart; x++) {
          topRow.push((ringStart + 2) * w + x);
        }
        countTransitions(leftCol);
        countTransitions(rightCol);
        countTransitions(topRow);

        if (alternations >= 8) {
          isCheckerboard = true;
        }
      }
    }

    if (isCheckerboard) {
      const isWall = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      let qHead = 0;
      let qTail = 0;

      const minCheckerL = checkerLow - 0.12;
      const maxCheckerL = Math.min(1, checkerHigh + 0.06);

      const isCheckerPixel = (idx: number): boolean => {
        const r = rArr[idx];
        const g = gArr[idx];
        const b = bArr[idx];
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        return chroma <= 0.095 && l >= minCheckerL && l <= maxCheckerL;
      };

      const trySeedChecker = (idx: number) => {
        if (!isWall[idx] && isCheckerPixel(idx)) {
          isWall[idx] = 1;
          queue[qTail++] = idx;
        }
      };

      for (let x = ringStart; x < w - ringStart; x++) {
        trySeedChecker(ringStart * w + x);
        trySeedChecker((h - 1 - ringStart) * w + x);
      }
      for (let y = ringStart; y < h - ringStart; y++) {
        trySeedChecker(y * w + ringStart);
        trySeedChecker(y * w + (w - 1 - ringStart));
      }

      while (qHead < qTail) {
        const cur = queue[qHead++];
        const cx = cur % w;
        const cy = (cur - cx) / w;

        const neighbors = [
          cx > 0 ? cur - 1 : -1,
          cx < w - 1 ? cur + 1 : -1,
          cy > 0 ? cur - w : -1,
          cy < h - 1 ? cur + w : -1,
        ];

        for (let n = 0; n < 4; n++) {
          const nIdx = neighbors[n];
          if (nIdx >= 0 && !isWall[nIdx] && isCheckerPixel(nIdx)) {
            isWall[nIdx] = 1;
            queue[qTail++] = nIdx;
          }
        }
      }

      // Clear checkerboard square edges from Sobel before weighting
      for (let i = 0; i < totalPixels; i++) {
        if (isWall[i]) {
          sobelArr[i] = 0;
        }
      }

      const wallFloat = new Float32Array(totalPixels);
      for (let i = 0; i < totalPixels; i++) {
        wallFloat[i] = isWall[i] ? 1 : 0;
      }
      const wallBlurred = boxBlur(wallFloat, w, h, 2);
      for (let i = 0; i < totalPixels; i++) {
        subjectMask[i] = isWall[i] ? 0 : clamp01(1 - wallBlurred[i]);
      }
    } else {
      const meanR = ringCount > 0 ? sumR / ringCount : 0;
      const meanG = ringCount > 0 ? sumG / ringCount : 0;
      const meanB = ringCount > 0 ? sumB / ringCount : 0;
      const meanL = ringCount > 0 ? sumL / ringCount : 0;
      const stdBorder =
        ringCount > 0 ? Math.sqrt(Math.max(0, sumL2 / ringCount - meanL * meanL)) : 1;
      const hasUniformBackdrop = stdBorder < 0.16;

      if (hasUniformBackdrop) {
        const isWall = new Uint8Array(totalPixels);
        const queue = new Int32Array(totalPixels);
        let qHead = 0;
        let qTail = 0;

        const trySeed = (idx: number) => {
          if (isWall[idx]) return;
          const dr = rArr[idx] - meanR;
          const dg = gArr[idx] - meanG;
          const db = bArr[idx] - meanB;
          const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (colorDist < 0.18 && sobelArr[idx] < 0.14) {
            isWall[idx] = 1;
            queue[qTail++] = idx;
          }
        };

        for (let x = ringStart; x < w - ringStart; x++) {
          trySeed(ringStart * w + x);
        }
        for (let y = ringStart; y < Math.floor(h * 0.78); y++) {
          trySeed(y * w + ringStart);
          trySeed(y * w + (w - 1 - ringStart));
        }

        while (qHead < qTail) {
          const cur = queue[qHead++];
          const cx = cur % w;
          const cy = (cur - cx) / w;

          const neighbors = [
            cx > bezel ? cur - 1 : -1,
            cx < w - 1 - bezel ? cur + 1 : -1,
            cy > bezel ? cur - w : -1,
            cy < h - 1 - bezel ? cur + w : -1,
          ];

          for (let n = 0; n < 4; n++) {
            const nIdx = neighbors[n];
            if (nIdx < 0 || isWall[nIdx]) continue;
            const dr = rArr[nIdx] - meanR;
            const dg = gArr[nIdx] - meanG;
            const db = bArr[nIdx] - meanB;
            const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (colorDist < 0.17 && sobelArr[nIdx] < 0.16) {
              isWall[nIdx] = 1;
              queue[qTail++] = nIdx;
            }
          }
        }

        const wallFloat = new Float32Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
          wallFloat[i] = isWall[i] ? 1 : 0;
        }
        const wallBlurred = boxBlur(wallFloat, w, h, 3);
        for (let i = 0; i < totalPixels; i++) {
          subjectMask[i] = clamp01(1 - wallBlurred[i]);
        }
      }
    }
  }

  // Strictly suppress transparent PNG empty space and outer opaque photo bezel
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (alpha[idx] < 0.15) {
        subjectMask[idx] = 0;
      } else if (!hasAlphaEmptySpace && (x < bezel || x >= w - bezel || y < bezel || y >= h - bezel)) {
        subjectMask[idx] = 0;
      }
    }
  }

  // Detect clipped frame borders where subject meets edge (e.g. bottom bust cut) and dissolve smoothly into dust
  const checkBand = 3;
  let topActive = 0;
  let topTotal = 0;
  let botActive = 0;
  let botTotal = 0;
  let leftActive = 0;
  let leftTotal = 0;
  let rightActive = 0;
  let rightTotal = 0;

  for (let d = 1; d <= checkBand; d++) {
    const ty = bezel + d;
    const by = h - 1 - bezel - d;
    for (let x = bezel + 2; x < w - bezel - 2; x++) {
      if (ty < h) {
        topTotal++;
        if (subjectMask[ty * w + x] > 0.35) topActive++;
      }
      if (by >= 0) {
        botTotal++;
        if (subjectMask[by * w + x] > 0.35) botActive++;
      }
    }
    const lx = bezel + d;
    const rx = w - 1 - bezel - d;
    for (let y = bezel + 2; y < h - bezel - 2; y++) {
      if (lx < w) {
        leftTotal++;
        if (subjectMask[y * w + lx] > 0.35) leftActive++;
      }
      if (rx >= 0) {
        rightTotal++;
        if (subjectMask[y * w + rx] > 0.35) rightActive++;
      }
    }
  }

  const touchesTop = topTotal > 0 && topActive / topTotal > 0.06;
  const touchesBottom = botTotal > 0 && botActive / botTotal > 0.06;
  const touchesLeft = leftTotal > 0 && leftActive / leftTotal > 0.06;
  const touchesRight = rightTotal > 0 && rightActive / rightTotal > 0.06;

  const blurStyle = tuning.blurStyle ?? 'radial';
  const edgeBlur = clamp01(tuning.edgeBlur);
  const contrastMult = Math.max(0.5, Math.min(2, tuning.contrast));
  const detailMult = Math.max(0, Math.min(2, tuning.detail));

  // Measure active subject bounds before edge fade so radial blur centers cleanly on the subject
  let minMX = w;
  let maxMX = -1;
  let minMY = h;
  let maxMY = -1;
  const rawBaseMask = new Float32Array(totalPixels);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const m = subjectMask[idx] * (alpha[idx] >= 0.15 ? alpha[idx] : 0);
      rawBaseMask[idx] = m;
      if (m > 0.25) {
        if (x < minMX) minMX = x;
        if (x > maxMX) maxMX = x;
        if (y < minMY) minMY = y;
        if (y > maxMY) maxMY = y;
      }
    }
  }
  if (maxMX < minMX || maxMY < minMY) {
    minMX = bezel;
    maxMX = w - 1 - bezel;
    minMY = bezel;
    maxMY = h - 1 - bezel;
  }

  const subjCenterX = (minMX + maxMX) * 0.5;
  const subjCenterY = (minMY + maxMY) * 0.5;
  const subjRx = Math.max(12, (maxMX - minMX) * 0.5);
  const subjRy = Math.max(12, (maxMY - minMY) * 0.5);

  const edgeFadeMap = new Float32Array(totalPixels).fill(1);
  let baseMask: Float32Array = rawBaseMask;
  let softMask: Float32Array = rawBaseMask;
  let rimLuminance: Float32Array = blurSmall;

  if (blurStyle === 'radial') {
    if (edgeBlur > 0.01) {
      const innerR = 0.86 - edgeBlur * 0.5;
      const outerR = 1.08 - edgeBlur * 0.16;
      const maxRadialStep = (0.015 + edgeBlur * 0.085) * Math.max(w, h);

      const radMask = new Float32Array(totalPixels);
      const radLum = new Float32Array(totalPixels);
      const radEdge = new Float32Array(totalPixels);

      for (let y = 0; y < h; y++) {
        const dyPx = y - subjCenterY;
        const ny = dyPx / subjRy;
        const row = y * w;

        for (let x = 0; x < w; x++) {
          const idx = row + x;
          const dxPx = x - subjCenterX;
          const nx = dxPx / subjRx;
          let r = Math.hypot(nx, ny);

          // Slightly increase radial fade along clipped bottom borders so flat collar cuts dissolve cleanly
          if (touchesBottom && ny > 0.35) {
            r += (ny - 0.35) * (0.08 + edgeBlur * 0.22);
          }

          let f = smoothstep(outerR, innerR, r);
          if (f < 1 && f > 0) {
            const angle = Math.atan2(dyPx, dxPx);
            const wisp =
              0.74 +
              0.26 * Math.sin(angle * 7 + r * 8.5 + Math.cos(angle * 3) * 1.4);
            f = clamp01(Math.pow(f, 1.1) * (f > 0.84 ? 1 : wisp));
          }
          edgeFadeMap[idx] = f;

          const radT = clamp01((r - innerR * 0.82) / Math.max(0.08, outerR - innerR * 0.82));
          if (radT > 0.01 && maxRadialStep > 0.5) {
            const len = Math.hypot(dxPx, dyPx) || 1;
            const ux = dxPx / len;
            const uy = dyPx / len;
            const span = maxRadialStep * radT;

            let mSum = 0;
            let lumSum = 0;
            let alpSum = 0;
            let eSum = 0;
            const taps = 7;

            // Sample radially inward-biased (-1..+5 inward) so subject silhouette radiates soft streaks outward
            for (let k = -1; k <= 5; k++) {
              const t = k / 5;
              const sx = Math.max(0, Math.min(w - 1, Math.round(x - ux * span * t)));
              const sy = Math.max(0, Math.min(h - 1, Math.round(y - uy * span * t)));
              const sIdx = sy * w + sx;
              mSum += rawBaseMask[sIdx];
              lumSum += premulLum[sIdx];
              alpSum += alpha[sIdx];
              eSum += sobelArr[sIdx];
            }

            const blurredM = mSum / taps;
            // Blend crisp core with outward radial halo blur while preventing inner gaps
            const coreM = rawBaseMask[idx];
            radMask[idx] = Math.max(blurredM, coreM * (1 - radT * 0.25)) * f;
            radLum[idx] =
              alpSum > 0.03 ? lumSum / alpSum : alpha[idx] >= 0.15 ? blurSmall[idx] : 0;
            radEdge[idx] =
              eSum / taps * (0.35 + 0.65 * (1 - radT)) + sobelArr[idx] * (1 - radT) * 0.5;
          } else {
            radMask[idx] = rawBaseMask[idx] * f;
            radLum[idx] = blurSmall[idx];
            radEdge[idx] = sobelArr[idx];
          }
        }
      }

      for (let i = 0; i < totalPixels; i++) {
        sobelArr[i] = radEdge[i];
      }
      softMask = radMask;
      rimLuminance = radLum;
    }
  } else {
    const fadeTop = touchesTop && edgeBlur > 0.01 ? Math.round(h * (0.02 + edgeBlur * 0.18)) : 0;
    const fadeBottom = touchesBottom && edgeBlur > 0.01 ? Math.round(h * (0.04 + edgeBlur * 0.3)) : 0;
    const fadeLeft = touchesLeft && edgeBlur > 0.01 ? Math.round(w * (0.02 + edgeBlur * 0.18)) : 0;
    const fadeRight = touchesRight && edgeBlur > 0.01 ? Math.round(w * (0.02 + edgeBlur * 0.18)) : 0;

    if (fadeTop > 0 || fadeBottom > 0 || fadeLeft > 0 || fadeRight > 0) {
      for (let y = 0; y < h; y++) {
        const fTop = fadeTop > 0 ? smoothstep(bezel, bezel + fadeTop, y) : 1;
        const fBot = fadeBottom > 0 ? smoothstep(h - 1 - bezel, h - 1 - bezel - fadeBottom, y) : 1;
        const fY = Math.min(fTop, fBot);

        const row = y * w;
        for (let x = 0; x < w; x++) {
          const fLeft = fadeLeft > 0 ? smoothstep(bezel, bezel + fadeLeft, x) : 1;
          const fRight = fadeRight > 0 ? smoothstep(w - 1 - bezel, w - 1 - bezel - fadeRight, x) : 1;
          let f = Math.min(fY, fLeft, fRight);

          if (f < 1) {
            const wisp = 0.72 + 0.28 * Math.sin(x * 0.13 + Math.cos(y * 0.09) * 2.3);
            f = clamp01(Math.pow(f, 1.15) * (f > 0.82 ? 1 : wisp));
            edgeFadeMap[row + x] = f;
            subjectMask[row + x] *= f;
          }
        }
      }
    }

    // Soft silhouette blur feathers outer subject cutouts outward into hazy dust when edgeBlur > 0
    baseMask = new Float32Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      baseMask[i] = subjectMask[i] * (alpha[i] >= 0.15 ? alpha[i] : 0);
    }

    const silhouetteRadius = edgeBlur > 0.08 ? Math.round(edgeBlur * 7) : 0;
    softMask = silhouetteRadius > 0 ? boxBlur(baseMask, w, h, silhouetteRadius) : baseMask;

    // Keep interior crisp (only soften boundaries) and allow rim pixels to inherit adjacent subject tone
    rimLuminance =
      silhouetteRadius > 0
        ? (() => {
            const rLum = boxBlur(premulLum, w, h, silhouetteRadius + 1);
            const rAlp = boxBlur(alpha, w, h, silhouetteRadius + 1);
            const out = new Float32Array(totalPixels);
            for (let i = 0; i < totalPixels; i++) {
              out[i] =
                alpha[i] >= 0.15
                  ? blurSmall[i]
                  : rAlp[i] > 0.02
                  ? rLum[i] / rAlp[i]
                  : 0;
            }
            return out;
          })()
        : blurSmall;

    for (let i = 0; i < totalPixels; i++) {
      if (baseMask[i] > 0.7 && softMask[i] < baseMask[i]) {
        // Preserve solid interior density against blur erosion; soften outer edges smoothly
        softMask[i] = Math.max(softMask[i], baseMask[i] * (1 - edgeBlur * 0.12));
      }
      if (softMask[i] < edgeFadeMap[i] && baseMask[i] <= 0.1) {
        edgeFadeMap[i] = Math.min(edgeFadeMap[i], softMask[i]);
      }
    }
  }

  // Compute adaptive luminance histogram stretch inside non-empty subject pixels (3rd..97th percentile)
  const hist = new Uint32Array(256);
  let subjectSamples = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (baseMask[i] > 0.35 && alpha[i] > 0.15) {
      const bin = Math.min(255, Math.max(0, Math.round(blurSmall[i] * 255)));
      hist[bin]++;
      subjectSamples++;
    }
  }

  let lumLow = 0.04;
  let lumHigh = 0.96;
  if (subjectSamples > 100) {
    let acc = 0;
    const lowTarget = subjectSamples * 0.03;
    const highTarget = subjectSamples * 0.97;
    for (let b = 0; b < 256; b++) {
      acc += hist[b];
      if (acc >= lowTarget) {
        lumLow = b / 255;
        break;
      }
    }
    acc = 0;
    for (let b = 0; b < 256; b++) {
      acc += hist[b];
      if (acc >= highTarget) {
        lumHigh = b / 255;
        break;
      }
    }
    if (lumHigh - lumLow < 0.18) {
      lumLow = Math.max(0, lumLow - 0.1);
      lumHigh = Math.min(1, lumHigh + 0.1);
    }
  }

  // Build continuous sculpture intensity map T (0..1)
  const toneMap = new Float32Array(totalPixels);
  const edgeMap = new Float32Array(totalPixels);
  const lumSpan = Math.max(0.12, lumHigh - lumLow);
  const lightParticlesOnDark = isDarkTheme ? !invertContrast : invertContrast;
  const bodyFloor = hasAlphaEmptySpace ? 0.24 : 0.12;

  let toneSum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const mask = softMask[i];
    if (mask < 0.025) continue;

    const normL = clamp01((rimLuminance[i] - lumLow) / lumSpan);
    const sCurved = smoothstep(0.02, 0.96, normL);
    const curvedL = clamp01((sCurved - 0.5) * contrastMult + 0.5);
    const localRelief = Math.max(
      -0.36,
      Math.min(0.36, (rimLuminance[i] - blurWide[i]) * 2.5 * contrastMult)
    );
    const edgeSig = Math.pow(clamp01(sobelArr[i] * 2.35), 0.76);

    let val: number;
    if (lightParticlesOnDark) {
      val = curvedL * 0.76 + localRelief * 0.42 + edgeSig * (0.54 * detailMult) + bodyFloor;
    } else {
      val = (1 - curvedL) * 0.78 - localRelief * 0.42 + edgeSig * (0.54 * detailMult) + 0.08;
    }

    const finalT = clamp01(val) * mask;
    toneMap[i] = finalT;
    edgeMap[i] = edgeSig * mask;
    toneSum += finalT;
  }

  if (toneSum <= 1) {
    return { points: [], cellSize: 2, bounds: { x: stageX, y: stageY, width: stageW, height: stageH } };
  }

  // Pick stipple grid dimensions dynamically so error diffusion emits ~targetCount evenly spaced particles
  const targetCount = targetCountOverride ?? DENSITY_TARGET_COUNT[density];
  const avgTone = toneSum / totalPixels;
  const idealTotalCells = targetCount / Math.max(0.06, avgTone);
  const aspect = w / h;
  let gh = Math.round(Math.sqrt(idealTotalCells / aspect));
  let gw = Math.round(gh * aspect);

  const maxGridDim =
    targetCountOverride !== undefined
      ? Math.max(110, Math.min(340, Math.round(Math.sqrt(targetCount * 2.2))))
      : density === 'dense'
      ? 420
      : density === 'balanced'
      ? 350
      : 270;
  const minGridDim = 110;
  if (Math.max(gw, gh) > maxGridDim) {
    const scaleDown = maxGridDim / Math.max(gw, gh);
    gw = Math.round(gw * scaleDown);
    gh = Math.round(gh * scaleDown);
  }
  if (Math.max(gw, gh) < minGridDim) {
    const scaleUp = minGridDim / Math.max(gw, gh);
    gw = Math.round(gw * scaleUp);
    gh = Math.round(gh * scaleUp);
  }
  gw = Math.max(20, gw);
  gh = Math.max(20, gh);

  // Bilinearly resample toneMap, edgeMap, softMask & edgeFade onto (gw, gh)
  const gridT = new Float32Array(gw * gh);
  const gridOrigT = new Float32Array(gw * gh);
  const gridEdge = new Float32Array(gw * gh);
  const gridMask = new Float32Array(gw * gh);
  const gridFade = new Float32Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    const sy = ((gy + 0.5) / gh) * (h - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;

    for (let gx = 0; gx < gw; gx++) {
      const sx = ((gx + 0.5) / gw) * (w - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;

      const i00 = y0 * w + x0;
      const i10 = y0 * w + x1;
      const i01 = y1 * w + x0;
      const i11 = y1 * w + x1;

      const tVal =
        (toneMap[i00] * (1 - fx) + toneMap[i10] * fx) * (1 - fy) +
        (toneMap[i01] * (1 - fx) + toneMap[i11] * fx) * fy;

      const eVal =
        (edgeMap[i00] * (1 - fx) + edgeMap[i10] * fx) * (1 - fy) +
        (edgeMap[i01] * (1 - fx) + edgeMap[i11] * fx) * fy;

      const mVal =
        (softMask[i00] * (1 - fx) + softMask[i10] * fx) * (1 - fy) +
        (softMask[i01] * (1 - fx) + softMask[i11] * fx) * fy;

      const fVal =
        (edgeFadeMap[i00] * (1 - fx) + edgeFadeMap[i10] * fx) * (1 - fy) +
        (edgeFadeMap[i01] * (1 - fx) + edgeFadeMap[i11] * fx) * fy;

      const gIdx = gy * gw + gx;
      gridT[gIdx] = tVal;
      gridOrigT[gIdx] = tVal;
      gridEdge[gIdx] = eVal;
      gridMask[gIdx] = mVal;
      gridFade[gIdx] = fVal;
    }
  }

  // Serpentine Floyd-Steinberg Error Diffusion (strictly masked against empty space)
  const cellW = stageW / gw;
  const cellH = stageH / gh;
  const maxCell = Math.max(cellW, cellH);
  const points: SampledPoint[] = [];

  const stageCenterX = stageX + (subjCenterX / w) * stageW;
  const stageCenterY = stageY + (subjCenterY / h) * stageH;

  for (let gy = 0; gy < gh; gy++) {
    const leftToRight = (gy & 1) === 0;
    const xStart = leftToRight ? 0 : gw - 1;
    const xEnd = leftToRight ? gw : -1;
    const stepX = leftToRight ? 1 : -1;

    for (let gx = xStart; gx !== xEnd; gx += stepX) {
      const idx = gy * gw + gx;
      if (gridMask[idx] < 0.025) continue;

      const oldVal = gridT[idx];
      const origT = gridOrigT[idx];
      if (origT <= 0.01) continue;

      const threshold = 0.5 + (Math.random() - 0.5) * 0.08;
      const emit = oldVal >= threshold && origT > 0.03 ? 1 : 0;
      const err = oldVal - emit;

      if (emit) {
        const fade = Math.min(gridFade[idx], gridMask[idx]);
        const basePx = stageX + (gx + 0.5 + (Math.random() - 0.5) * 0.62) * cellW;
        const basePy = stageY + (gy + 0.5 + (Math.random() - 0.5) * 0.62) * cellH;
        let px = basePx;
        let py = basePy;

        if (edgeBlur > 0.01 && fade < 0.96) {
          if (blurStyle === 'radial') {
            const dxC = basePx - stageCenterX;
            const dyC = basePy - stageCenterY;
            const cDist = Math.hypot(dxC, dyC) || 1;
            const ux = dxC / cDist;
            const uy = dyC / cDist;
            const radScatter = Math.pow(1 - fade, 1.3) * maxCell * (3.5 + edgeBlur * 16);
            const push = (0.2 + Math.random() * 0.85) * radScatter;
            const jitter = (Math.random() - 0.5) * radScatter * 0.45;
            px += ux * push - uy * jitter;
            py += uy * push + ux * jitter;
          } else {
            const edgeScatter = Math.pow(1 - fade, 1.45) * maxCell * (2 + edgeBlur * 11);
            px += (Math.random() - 0.5) * edgeScatter;
            py += (Math.random() - 0.5) * edgeScatter;
          }
        }

        const edgeW = gridEdge[idx];
        const fadeAlpha = 0.18 + 0.82 * fade;
        const weight = clamp01((0.32 + origT * 0.52 + edgeW * 0.28) * fadeAlpha);
        points.push({ x: px, y: py, weight });
      }

      const canReceive = (nIdx: number) =>
        gridMask[nIdx] >= 0.025 && gridOrigT[nIdx] > 0.01;

      const nx1 = gx + stepX;
      if (nx1 >= 0 && nx1 < gw && canReceive(idx + stepX)) {
        gridT[idx + stepX] += err * (7 / 16);
      }
      if (gy + 1 < gh) {
        const nextRow = (gy + 1) * gw;
        const nxb = gx - stepX;
        if (nxb >= 0 && nxb < gw && canReceive(nextRow + nxb)) {
          gridT[nextRow + nxb] += err * (3 / 16);
        }
        if (canReceive(nextRow + gx)) {
          gridT[nextRow + gx] += err * (5 / 16);
        }
        if (nx1 >= 0 && nx1 < gw && canReceive(nextRow + nx1)) {
          gridT[nextRow + nx1] += err * (1 / 16);
        }
      }
    }
  }

  // Shuffle uniformly if cap exceeded (prevents cropping bottom of image)
  const subjectBounds = {
    x: stageX + (minMX / w) * stageW,
    y: stageY + (minMY / h) * stageH,
    width: Math.max(24, ((maxMX - minMX + 1) / w) * stageW),
    height: Math.max(24, ((maxMY - minMY + 1) / h) * stageH),
  };

  if (points.length > targetCount * 1.15) {
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = points[i];
      points[i] = points[j];
      points[j] = tmp;
    }
    return {
      points: points.slice(0, Math.round(targetCount * 1.15)),
      cellSize: Math.max(cellW, cellH),
      bounds: subjectBounds,
    };
  }

  return { points, cellSize: Math.max(cellW, cellH), bounds: subjectBounds };
}
