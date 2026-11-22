import type { PaletteMode } from '../types/mote';

export const HUE_STOPS = 12;
export const ALPHA_TIERS = 8;
export const BUCKET_COUNT = HUE_STOPS * ALPHA_TIERS;
export const ATLAS_TILE = 32;

export const ALPHA_VALUES_DARK = [0.06, 0.12, 0.20, 0.30, 0.42, 0.55, 0.68, 0.82];
export const ALPHA_VALUES_LIGHT = [0.08, 0.15, 0.25, 0.38, 0.52, 0.66, 0.78, 0.90];

export interface PaletteThemeMeta {
  id: PaletteMode;
  label: string;
  isDark: boolean;
  bgHex: string;
  mistInner: string;
  mistMid: string;
  shockwaveRgb: string;
  stops: Array<[number, number, number]>;
}

export const PALETTE_THEMES: Record<PaletteMode, PaletteThemeMeta> = {
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    isDark: true,
    bgHex: '#030306',
    mistInner: 'rgba(59, 130, 246, 0.045)',
    mistMid: 'rgba(139, 92, 246, 0.024)',
    shockwaveRgb: '103, 232, 249',
    stops: [
      [192, 38, 211],   // Magenta
      [168, 85, 247],   // Vivid Violet
      [124, 58, 237],   // Deep Violet
      [79, 70, 229],    // Indigo
      [37, 99, 235],    // Cobalt Blue
      [59, 130, 246],   // Electric Blue
      [14, 165, 233],   // Sky Cyan
      [34, 211, 238],   // Luminous Cyan
      [103, 232, 249],  // Pale Cyan
      [186, 230, 253],  // Ice Blue
      [224, 231, 255],  // Lavender Mist
      [244, 246, 255],  // Pearlescent White
    ],
  },
  sunbeam: {
    id: 'sunbeam',
    label: 'Sunbeam',
    isDark: true,
    bgHex: '#060504',
    mistInner: 'rgba(217, 119, 6, 0.048)',
    mistMid: 'rgba(180, 83, 9, 0.022)',
    shockwaveRgb: '252, 211, 77',
    stops: [
      [146, 64, 14],    // Warm Umber
      [180, 83, 9],     // Burnt Amber
      [217, 119, 6],    // Deep Ochre
      [234, 179, 8],    // Honey Gold
      [245, 196, 81],   // Sunlit Gold
      [253, 224, 132],  // Pale Amber
      [254, 243, 199],  // Warm Ivory
      [255, 251, 240],  // Sunlit White
    ],
  },
  moonlit: {
    id: 'moonlit',
    label: 'Moonlit',
    isDark: true,
    bgHex: '#04060A',
    mistInner: 'rgba(148, 163, 184, 0.045)',
    mistMid: 'rgba(71, 85, 105, 0.024)',
    shockwaveRgb: '203, 213, 225',
    stops: [
      [71, 85, 105],    // Deep Slate
      [100, 116, 139],  // Cool Pewter
      [148, 163, 184],  // Silver Mist
      [186, 200, 219],  // Pale Steel
      [219, 230, 244],  // Moonlit Blue
      [241, 245, 249],  // Soft Silver
      [248, 250, 252],  // Crisp White
    ],
  },
  alabaster: {
    id: 'alabaster',
    label: 'Alabaster',
    isDark: false,
    bgHex: '#F7F5F0',
    mistInner: 'rgba(79, 70, 229, 0.03)',
    mistMid: 'rgba(100, 116, 139, 0.015)',
    shockwaveRgb: '67, 56, 202',
    stops: [
      [134, 25, 143],   // Deep Magenta
      [109, 40, 217],   // Deep Violet
      [67, 56, 202],    // Deep Indigo
      [29, 78, 216],    // Cobalt
      [3, 105, 161],    // Deep Cerulean
      [15, 118, 110],   // Teal Ink
      [39, 39, 42],     // Charcoal
      [24, 24, 27],     // Deep Ink
    ],
  },
};

function samplePaletteRgb(
  stops: Array<[number, number, number]>,
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  const a = stops[idx];
  const b = stops[Math.min(stops.length - 1, idx + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

const atlasCache = new Map<PaletteMode, HTMLCanvasElement>();

/**
 * Generates and caches a 12x3 soft radial dust sprite atlas per palette:
 * Row 0 = soft distant mist grain
 * Row 1 = crisp luminous pinpoint core with feathered edge
 * Row 2 = wide out-of-focus foreground bokeh mote
 */
export function getDustAtlas(palette: PaletteMode): HTMLCanvasElement {
  const existing = atlasCache.get(palette);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = HUE_STOPS * ATLAS_TILE;
  canvas.height = 3 * ATLAS_TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const meta = PALETTE_THEMES[palette];
  const half = ATLAS_TILE / 2;

  for (let h = 0; h < HUE_STOPS; h++) {
    const t = h / (HUE_STOPS - 1);
    const [r, g, b] = samplePaletteRgb(meta.stops, t);
    const cx = h * ATLAS_TILE + half;

    // Row 0: Far mist (soft diffuse profile)
    {
      const cy = 0 * ATLAS_TILE + half;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, half * 0.88);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.82)`);
      grad.addColorStop(0.42, `rgba(${r},${g},${b},0.34)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(h * ATLAS_TILE, 0, ATLAS_TILE, ATLAS_TILE);
    }

    // Row 1: Mid-plane core mote (bright pinpoint heart + delicate feather)
    {
      const cy = 1 * ATLAS_TILE + half;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, half * 0.85);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.28, `rgba(${r},${g},${b},0.78)`);
      grad.addColorStop(0.58, `rgba(${r},${g},${b},0.22)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(h * ATLAS_TILE, ATLAS_TILE, ATLAS_TILE, ATLAS_TILE);
    }

    // Row 2: Foreground out-of-focus bokeh dust
    {
      const cy = 2 * ATLAS_TILE + half;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, half * 0.94);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.48)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.26)`);
      grad.addColorStop(0.78, `rgba(${r},${g},${b},0.07)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(h * ATLAS_TILE, 2 * ATLAS_TILE, ATLAS_TILE, ATLAS_TILE);
    }
  }

  atlasCache.set(palette, canvas);
  return canvas;
}
