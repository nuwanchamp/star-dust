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
}
export declare function computeWavePoint(u: number, v: number, layer: number, phaseOffset: number, time: number, width: number, height: number): {
    x: number;
    y: number;
};
export declare function createParticlePool(initialCapacity: number): ParticlePool;
export declare function resizeParticlePool(pool: ParticlePool, desiredCount: number, width: number, height: number): void;
//# sourceMappingURL=particlePool.d.ts.map