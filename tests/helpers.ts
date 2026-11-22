import { createParticlePool, resizeParticlePool, type ParticlePool } from '../src/engine/particlePool';
import type { SampledPoint } from '../src/engine/textSampler';

/** `lines` text lines of `perLine` points each: line k spans y in [top + k*pitch, top + k*pitch + 10]. */
export function textLines(lines: number, perLine: number, top = 100, pitch = 24): SampledPoint[] {
  const pts: SampledPoint[] = [];
  for (let k = 0; k < lines; k++) {
    for (let j = 0; j < perLine; j++) {
      pts.push({ x: 200 + (j % 100) * 4, y: top + k * pitch + (j / perLine) * 10, weight: 0.8, regionId: k });
    }
  }
  return pts;
}

export function pool(count: number, width = 1200, height = 800): ParticlePool {
  const p = createParticlePool(count);
  resizeParticlePool(p, count, width, height);
  return p;
}

/** Map particle -> target key, asserting no target position is held by two particles. */
export function assignedTargets(p: ParticlePool): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < p.count; i++) {
    if (!p.hasTarget[i]) continue;
    const key = `${p.tx[i].toFixed(3)},${p.ty[i].toFixed(3)}`;
    if (seen.has(key)) throw new Error(`target ${key} assigned twice`);
    seen.add(key);
  }
  return seen;
}
