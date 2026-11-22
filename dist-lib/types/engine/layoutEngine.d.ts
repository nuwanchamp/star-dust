import type { SampledPoint } from './textSampler.js';
import type { DensityPreset, FontStyle, ImageTuningConfig, LayoutHitRegion, LayoutNode, RippleRegion } from '../types/mote.js';
export interface LayoutSceneResult {
    points: SampledPoint[];
    hitRegions: LayoutHitRegion[];
    rippleRegions: RippleRegion[];
    cellSize: number;
    /** How far the content can scroll (0 when it fits). Coordinates are at scroll 0. */
    scrollMax: number;
    /**
     * When scrollable, `points` cover the whole layout untrimmed; the caller should give particles only
     * to what is on screen, at most `screenBudget` per screen, never thinning `priorityRegionIds` (buttons).
     */
    screenBudget: number;
    priorityRegionIds: number[];
}
export interface LayoutPaddingBox {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export type LayoutOverflow = 'scroll' | 'fit';
export interface LayoutSceneOptions {
    /** Extra space reserved on the left (added to padding.left). */
    leftInset?: number;
    collapsedMindMapIds?: Set<string>;
    /** Space kept clear around the layout. Default: 32px (16px below 640px wide). */
    padding?: LayoutPaddingBox;
    /** 'scroll': keep text legible and let it scroll. 'fit': shrink everything to fit. Default 'scroll'. */
    overflow?: LayoutOverflow;
    /** Smallest font size (px) 'scroll' mode may shrink text to. Default 14. */
    minFontSize?: number;
    /** Max particles for one screen of layout. Default by density: 16.5k / 30k / 45k. */
    particleBudget?: number;
    /**
     * Thin points evenly to fit the budget when the layout fits the screen (default true). Pass false
     * when the caller limits by visible height instead (LayoutWindow); points are then never thinned here.
     */
    trim?: boolean;
}
/** Maps a layout `<Image src>` value to a loadable URL, or null to leave the image out. */
export type LayoutImageResolver = (ref: string | undefined) => string | null;
/**
 * Default `<Image src>` resolution: no src, "current" or "uploaded" → the current `imageSrc`;
 * anything else is used as a URL/path as-is.
 */
export declare function defaultLayoutImageUrl(rawSrc: string | undefined, currentImageSrc: string | null): string | null;
/**
 * Resolves a declarative LayoutNode AST into screen coordinates, interactive HitRegions,
 * and unified particle targets across Headings, Texts, Images, Buttons, Markdown blocks, and MindMaps.
 */
export declare function sampleLayoutScene(root: LayoutNode | null, viewportWidth: number, viewportHeight: number, density: DensityPreset, defaultFontStyle: FontStyle, invertContrast: boolean, isDarkTheme: boolean, imageTuning: ImageTuningConfig, imageCache: Map<string, HTMLImageElement>, resolveImage: LayoutImageResolver, sceneOptions?: LayoutSceneOptions): LayoutSceneResult;
//# sourceMappingURL=layoutEngine.d.ts.map