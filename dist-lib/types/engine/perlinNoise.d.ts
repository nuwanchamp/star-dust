export declare function perlin3(x: number, y: number, z: number): number;
/**
 * Coarse spatial flow grid (zero per-frame heap allocations) storing
 * divergence-free curl-Perlin wind + slow prevailing gust modulation.
 */
export declare class PerlinWindField {
    readonly cols: number;
    readonly rows: number;
    readonly vxGrid: Float32Array;
    readonly vyGrid: Float32Array;
    private width;
    private height;
    constructor(cols?: number, rows?: number);
    update(width: number, height: number, time: number): void;
    sampleX(px: number, py: number): number;
    sampleY(px: number, py: number): number;
}
//# sourceMappingURL=perlinNoise.d.ts.map