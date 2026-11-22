import { FLOATS_PER_VERTEX } from './webglDustRenderer';

export const FLOATS_PER_LINE_VERTEX = 6; // x, y, r, g, b, a
const MAX_CONSTELLATION_NODES = 1400;
const MAX_CONSTELLATION_SEGMENTS = 4200;
const MAX_PER_CELL = 3;
const MAX_LINKS_PER_NODE = 6;

export class ConstellationBuilder {
  readonly vertexData = new Float32Array(
    MAX_CONSTELLATION_SEGMENTS * 2 * FLOATS_PER_LINE_VERTEX
  );
  vertexCount = 0;

  private cellHead = new Int32Array(0);
  private cellCount = new Uint8Array(0);
  private nodeParticleIdx = new Int32Array(MAX_CONSTELLATION_NODES);
  private nodeCellX = new Int16Array(MAX_CONSTELLATION_NODES);
  private nodeCellY = new Int16Array(MAX_CONSTELLATION_NODES);
  private nodeNext = new Int32Array(MAX_CONSTELLATION_NODES);
  private nodeLinks = new Uint8Array(MAX_CONSTELLATION_NODES);

  build(
    particleVertices: Float32Array,
    particleCount: number,
    width: number,
    height: number,
    isDark: boolean
  ): number {
    this.vertexCount = 0;
    if (particleCount < 2 || width <= 0 || height <= 0) return 0;

    const minDim = Math.min(width, height);
    const maxDist = Math.min(104, Math.max(66, minDim * 0.095));
    const minDist = 11;
    const maxDistSq = maxDist * maxDist;
    const minDistSq = minDist * minDist;

    const cellSize = maxDist * 0.5;
    const cols = Math.max(1, Math.ceil(width / cellSize) + 1);
    const rows = Math.max(1, Math.ceil(height / cellSize) + 1);
    const totalCells = cols * rows;

    if (this.cellHead.length < totalCells) {
      this.cellHead = new Int32Array(totalCells);
      this.cellCount = new Uint8Array(totalCells);
    }
    this.cellHead.fill(-1, 0, totalCells);
    this.cellCount.fill(0, 0, totalCells);

    // Deterministic stride preserves node identity frame-to-frame to avoid line flicker
    const stride = Math.max(1, Math.floor(particleCount / MAX_CONSTELLATION_NODES));
    let nodeCount = 0;

    for (let i = 0; i < particleCount && nodeCount < MAX_CONSTELLATION_NODES; i += stride) {
      const off = i * FLOATS_PER_VERTEX;
      const alpha = particleVertices[off + 5];
      if (alpha < 0.08) continue;

      const x = particleVertices[off + 0];
      const y = particleVertices[off + 1];
      if (x < -maxDist || x > width + maxDist || y < -maxDist || y > height + maxDist) continue;

      const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cellSize)));
      const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cellSize)));
      const cellIdx = cy * cols + cx;

      const existingInCell = this.cellCount[cellIdx];
      if (existingInCell >= MAX_PER_CELL) continue;

      const slot = nodeCount++;
      this.nodeParticleIdx[slot] = i;
      this.nodeCellX[slot] = cx;
      this.nodeCellY[slot] = cy;
      this.nodeNext[slot] = this.cellHead[cellIdx];
      this.cellHead[cellIdx] = slot;
      this.cellCount[cellIdx] = existingInCell + 1;
      this.nodeLinks[slot] = 0;
    }

    if (nodeCount < 2) return 0;

    const lineBuf = this.vertexData;
    const baseOpacity = isDark ? 0.34 : 0.24;
    const maxSegAlpha = isDark ? 0.62 : 0.44;
    let segCount = 0;

    for (let a = 0; a < nodeCount && segCount < MAX_CONSTELLATION_SEGMENTS; a++) {
      if (this.nodeLinks[a] >= MAX_LINKS_PER_NODE) continue;

      const aOff = this.nodeParticleIdx[a] * FLOATS_PER_VERTEX;
      const ax = particleVertices[aOff + 0];
      const ay = particleVertices[aOff + 1];
      const ar = particleVertices[aOff + 2];
      const ag = particleVertices[aOff + 3];
      const ab = particleVertices[aOff + 4];
      const aAlpha = particleVertices[aOff + 5];
      const aMotion = particleVertices[aOff + 7];

      const cx = this.nodeCellX[a];
      const cy = this.nodeCellY[a];
      const xMin = Math.max(0, cx - 2);
      const xMax = Math.min(cols - 1, cx + 2);
      const yMin = Math.max(0, cy - 2);
      const yMax = Math.min(rows - 1, cy + 2);

      for (let ny = yMin; ny <= yMax && segCount < MAX_CONSTELLATION_SEGMENTS; ny++) {
        const rowOffset = ny * cols;
        for (let nx = xMin; nx <= xMax && segCount < MAX_CONSTELLATION_SEGMENTS; nx++) {
          let b = this.cellHead[rowOffset + nx];
          while (b !== -1) {
            if (b > a && this.nodeLinks[b] < MAX_LINKS_PER_NODE) {
              const bOff = this.nodeParticleIdx[b] * FLOATS_PER_VERTEX;
              const bx = particleVertices[bOff + 0];
              const by = particleVertices[bOff + 1];
              const dx = bx - ax;
              const dy = by - ay;
              const d2 = dx * dx + dy * dy;

              if (d2 >= minDistSq && d2 < maxDistSq) {
                const dist = Math.sqrt(d2);
                const falloff = 1 - dist / maxDist;
                const bAlpha = particleVertices[bOff + 5];
                const bMotion = particleVertices[bOff + 7];
                const energyBoost = 1 + Math.min(0.85, (aMotion + bMotion) * 0.35);
                const segAlpha = Math.min(
                  maxSegAlpha,
                  falloff * falloff * baseOpacity * energyBoost * Math.min(aAlpha, bAlpha)
                );

                if (segAlpha > 0.008) {
                  const vOff = segCount * 2 * FLOATS_PER_LINE_VERTEX;
                  lineBuf[vOff + 0] = ax;
                  lineBuf[vOff + 1] = ay;
                  lineBuf[vOff + 2] = ar;
                  lineBuf[vOff + 3] = ag;
                  lineBuf[vOff + 4] = ab;
                  lineBuf[vOff + 5] = segAlpha;

                  lineBuf[vOff + 6] = bx;
                  lineBuf[vOff + 7] = by;
                  lineBuf[vOff + 8] = particleVertices[bOff + 2];
                  lineBuf[vOff + 9] = particleVertices[bOff + 3];
                  lineBuf[vOff + 10] = particleVertices[bOff + 4];
                  lineBuf[vOff + 11] = segAlpha;

                  segCount++;
                  this.nodeLinks[a]++;
                  this.nodeLinks[b]++;
                  if (this.nodeLinks[a] >= MAX_LINKS_PER_NODE || segCount >= MAX_CONSTELLATION_SEGMENTS) {
                    break;
                  }
                }
              }
            }
            b = this.nodeNext[b];
          }
          if (this.nodeLinks[a] >= MAX_LINKS_PER_NODE) break;
        }
      }
    }

    this.vertexCount = segCount * 2;
    return this.vertexCount;
  }
}
