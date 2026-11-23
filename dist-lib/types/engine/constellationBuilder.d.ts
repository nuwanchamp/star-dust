export declare const FLOATS_PER_LINE_VERTEX = 6;
export declare class ConstellationBuilder {
    readonly vertexData: Float32Array<ArrayBuffer>;
    vertexCount: number;
    private cellHead;
    private cellCount;
    private nodeParticleIdx;
    private nodeCellX;
    private nodeCellY;
    private nodeNext;
    private nodeLinks;
    build(particleVertices: Float32Array, particleCount: number, width: number, height: number, isDark: boolean): number;
}
//# sourceMappingURL=constellationBuilder.d.ts.map