export interface ParticlePool {
    capacity: number;
    count: number;
    x: Float32Array;
    y: Float32Array;
    vx: Float32Array;
    vy: Float32Array;
    tx: Float32Array;
    ty: Float32Array;
    hasTarget: Uint8Array;
    size: Float32Array;
    baseAlpha: Float32Array;
    phase: Float32Array;
    wanderSpeed: Float32Array;
    energy: Float32Array;
    waveLayer: Int8Array;
    waveU: Float32Array;
    waveV: Float32Array;
    depth: Float32Array;
    depthPlane: Uint8Array;
    mass: Float32Array;
    colorSeed: Float32Array;
    isFringe: Uint8Array;
    regionId: Int16Array;
    gravityBreakUntil: Float64Array;
    windReleaseAt: Float64Array;
    /** performance.now() time a targeted particle leaves the wave for its target; 0 = straight away. */
    joinAt: Float64Array;
    /** formFlowMs: performance.now() time a particle riding the Perlin wind starts condensing into its place. */
    condenseAt: Float64Array;
    /** formFlowMs: time a particle lets go of the old shape and starts riding the wind. */
    releaseAt: Float64Array;
    /** formFlowMs: 1 = part of the old shape the new one doesn't use; it dissolves into ambient dust. */
    flowPhantom: Uint8Array;
    /** formFlowMs: 1 = was background dust (or the wave) before this flow recruited it into the new shape. */
    flowRecruit: Uint8Array;
    /** formFlowMs: a recruit's own brightness from before it was given a target. */
    flowBaseAlpha: Float32Array;
    /** formFlowMs: for particles added because the new shape needs more than the old had, the time they
     * start fading in at their place (after the old shape has dissolved); 0 = not such a particle. */
    flowBornAt: Float64Array;
}
export declare function computeWavePoint(u: number, v: number, layer: number, phaseOffset: number, time: number, width: number, height: number): {
    x: number;
    y: number;
};
export declare function createParticlePool(initialCapacity: number): ParticlePool;
export declare function resizeParticlePool(pool: ParticlePool, desiredCount: number, width: number, height: number): void;
//# sourceMappingURL=particlePool.d.ts.map