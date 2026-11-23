import type { PaletteMode } from '../types/mote.js';
export declare const HUE_STOPS = 12;
export declare const ALPHA_TIERS = 8;
export declare const BUCKET_COUNT: number;
export declare const ATLAS_TILE = 32;
export declare const ALPHA_VALUES_DARK: number[];
export declare const ALPHA_VALUES_LIGHT: number[];
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
export declare const PALETTE_THEMES: Record<PaletteMode, PaletteThemeMeta>;
/**
 * Generates and caches a 12x3 soft radial dust sprite atlas per palette:
 * Row 0 = soft distant mist grain
 * Row 1 = crisp luminous pinpoint core with feathered edge
 * Row 2 = wide out-of-focus foreground bokeh mote
 */
export declare function getDustAtlas(palette: PaletteMode): HTMLCanvasElement;
//# sourceMappingURL=dustAtlas.d.ts.map