import type { PaletteMode } from '../types/mote.js';
export interface AmbientMetrics {
    particleCount: number;
    avgVelocity: number;
    avgEnergy: number;
    isFreeDrift: boolean;
    palette: PaletteMode;
}
export declare class AmbientSoundEngine {
    private ctx;
    private masterGain;
    private dryGain;
    private delayInput;
    private padFilter;
    private airBandpass;
    private airGain;
    private voices;
    private lfoOsc;
    private muted;
    private disposed;
    private lastPalette;
    private lastChimeAt;
    private suspendTimer;
    private latestMetrics;
    isMuted(): boolean;
    private ensureGraph;
    unlock(): void;
    setMuted(nextMuted: boolean): void;
    updateMetrics(metrics: AmbientMetrics): void;
    private applyMetrics;
    triggerChime(intensity?: number, normX?: number): void;
    dispose(): void;
}
//# sourceMappingURL=ambientSoundEngine.d.ts.map