import type { SampledPoint } from './textSampler.js';
import type { DensityPreset, ImageTuningConfig } from '../types/mote.js';
export interface ImageSamplingResult {
    points: SampledPoint[];
    cellSize: number;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
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
export declare function getImageSourceBounds(img: HTMLImageElement): ImageSourceBounds | null;
export declare function loadImageElement(src: string): Promise<HTMLImageElement>;
/**
 * Converts any image into a high-clarity monochrome halftone/contrast particle sculpture:
 * 1. Trims screenshot outer bezels so borders never draw frame lines.
 * 2. Detects uniform wall/studio backdrops via perimeter RGB + flood-fill and isolates the subject.
 * 3. Normalizes subject tonal contrast + signed local relief + Sobel contours.
 * 4. Runs serpentine Floyd-Steinberg error-diffusion stippling at adaptive resolution for clean spacing.
 */
export declare const DEFAULT_IMAGE_TUNING: ImageTuningConfig;
export declare function computeAspectAwareStageBox(aspectRatio: number, viewportWidth: number, viewportHeight: number, edgeBlur?: number): {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function sampleImageTargets(img: HTMLImageElement, viewportWidth: number, viewportHeight: number, density: DensityPreset, invertContrast?: boolean, isDarkTheme?: boolean, tuning?: ImageTuningConfig): ImageSamplingResult;
export declare function sampleImageIntoBox(img: HTMLImageElement, boxX: number, boxY: number, boxW: number, boxH: number, density: DensityPreset, invertContrast?: boolean, isDarkTheme?: boolean, tuning?: ImageTuningConfig, targetCountOverride?: number): ImageSamplingResult;
//# sourceMappingURL=imageSampler.d.ts.map