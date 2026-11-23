import type { ParticlePool } from './particlePool.js';
import type { DensityPreset, FontStyle } from '../types/mote.js';
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
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export declare function getAmbientCount(density: DensityPreset, width: number, height: number): number;
/**
 * Renders a phrase or multi-line paragraph onto an invisible offscreen canvas
 * (2x supersampled for smaller/paragraph text) and extracts crisp gravitational anchor coordinates.
 */
export declare function sampleTextTargets(text: string, viewportWidth: number, viewportHeight: number, fontStyle: FontStyle, density: DensityPreset): TextSamplingResult;
/**
 * Spatial grid nearest-mote matcher operating directly on typed-array ParticlePool.
 */
export declare function assignTargetsByProximity(pool: ParticlePool, targets: SampledPoint[], width: number, height: number, fontSize?: number, isImage?: boolean, onAssign?: (targetIndex: number, particleIndex: number) => void): void;
//# sourceMappingURL=textSampler.d.ts.map