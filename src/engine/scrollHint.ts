import type { ParticlePool } from './particlePool';

/** One point of the chevron shape, relative to its center; `a` is the point's brightness. */
interface ShapePoint {
  dx: number;
  dy: number;
  a: number;
}

/** A downward double chevron (⌄⌄) built from short thick strokes, ~300 points. */
function buildChevronShape(): ShapePoint[] {
  const pts: ShapePoint[] = [];
  const chevron = (offsetY: number, halfW: number, depth: number, alpha: number) => {
    const segs: Array<[number, number, number, number]> = [
      [-halfW, offsetY - depth / 2, 0, offsetY + depth / 2],
      [0, offsetY + depth / 2, halfW, offsetY - depth / 2],
    ];
    for (const [x1, y1, x2, y2] of segs) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      for (let s = 0; s <= len; s += 0.7) {
        const t = s / len;
        for (const w of [-1.1, 0, 1.1]) {
          pts.push({ dx: x1 + (x2 - x1) * t + nx * w, dy: y1 + (y2 - y1) * t + ny * w, a: alpha });
        }
      }
    }
  };
  chevron(-4, 13, 8, 0.95);
  chevron(5, 10, 6, 0.6);
  return pts;
}

const SHAPE = buildChevronShape();

/** Where a hint sits and whether it should show. */
export interface ScrollHintState {
  /** Horizontal center of the layout content (canvas px). */
  centerX: number;
  /** Clear band on screen; the down hint goes just below it, the up hint just above it. */
  bandTop: number;
  bandBottom: number;
  canvasHeight: number;
  showDown: boolean;
  showUp: boolean;
}

/**
 * Particle-built "more content" chevrons for scrollable layouts. Hint particles are borrowed from the
 * ambient dust when a hint appears and released (with a soft gust) when it goes away.
 */
export class ScrollHints {
  private down: Int32Array | null = null;
  private up: Int32Array | null = null;
  private mask = new Uint8Array(0);
  private downPos = { x: 0, y: 0 };
  private upPos = { x: 0, y: 0 };

  /** Forget all hint particles (call after the pool was reassigned from scratch). */
  reset(capacity: number): void {
    this.down = null;
    this.up = null;
    if (this.mask.length < capacity) this.mask = new Uint8Array(capacity);
    else this.mask.fill(0);
  }

  /** True if particle i belongs to a hint (so scrolling must not carry it). */
  isHint(i: number): boolean {
    return this.mask[i] === 1;
  }

  /** Which hint (if any) is under a point, with a generous touch-friendly radius. */
  hit(x: number, y: number): 'down' | 'up' | null {
    const r = 26;
    if (this.down && Math.hypot(x - this.downPos.x, y - this.downPos.y) < r) return 'down';
    if (this.up && Math.hypot(x - this.upPos.x, y - this.upPos.y) < r) return 'up';
    return null;
  }

  /** Release everything (hints switched off or layout no longer scrollable). */
  clear(pool: ParticlePool, now: number): void {
    if (this.down) this.release(pool, this.down, now);
    if (this.up) this.release(pool, this.up, now);
    this.down = null;
    this.up = null;
  }

  /** Show/hide and animate the hints for this frame. */
  update(pool: ParticlePool, s: ScrollHintState, time: number, now: number): void {
    if (this.mask.length < pool.capacity) {
      const next = new Uint8Array(pool.capacity);
      next.set(this.mask);
      this.mask = next;
    }
    // Down: just below the band (kept on canvas). Up: just above the band top.
    const bob = Math.sin(time * 2.6) * 3.5;
    const pulse = 0.72 + 0.28 * Math.sin(time * 2.6 + 1.2);
    this.downPos = { x: s.centerX, y: Math.min(s.canvasHeight - 18, s.bandBottom + 26) };
    this.upPos = { x: s.centerX, y: Math.max(16, s.bandTop - 22) };

    if (s.showDown && !this.down) this.down = this.claim(pool);
    else if (!s.showDown && this.down) {
      this.release(pool, this.down, now);
      this.down = null;
    }
    if (s.showUp && !this.up) this.up = this.claim(pool);
    else if (!s.showUp && this.up) {
      this.release(pool, this.up, now);
      this.up = null;
    }

    if (this.down) this.place(pool, this.down, this.downPos.x, this.downPos.y + bob, 1, pulse);
    if (this.up) this.place(pool, this.up, this.upPos.x, this.upPos.y - bob, -1, pulse);
  }

  private place(
    pool: ParticlePool,
    ids: Int32Array,
    cx: number,
    cy: number,
    dir: 1 | -1,
    pulse: number
  ): void {
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k];
      if (i < 0 || this.mask[i] !== 1) continue;
      const pt = SHAPE[k];
      pool.tx[i] = cx + pt.dx;
      pool.ty[i] = cy + pt.dy * dir;
      pool.baseAlpha[i] = pt.a * pulse * 0.8;
    }
  }

  /** Borrow free ambient particles (from the end of the pool, away from layout assignments). */
  private claim(pool: ParticlePool): Int32Array {
    const ids = new Int32Array(SHAPE.length).fill(-1);
    let k = 0;
    for (let i = pool.count - 1; i >= 0 && k < ids.length; i--) {
      if (pool.hasTarget[i] === 0 && this.mask[i] === 0) {
        ids[k++] = i;
        this.mask[i] = 1;
        pool.hasTarget[i] = 1;
        pool.isFringe[i] = 0;
        pool.regionId[i] = -1;
        pool.gravityBreakUntil[i] = 0;
        pool.windReleaseAt[i] = 0;
      }
    }
    return ids;
  }

  private release(pool: ParticlePool, ids: Int32Array, now: number): void {
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k];
      if (i < 0 || this.mask[i] !== 1) continue;
      this.mask[i] = 0;
      pool.hasTarget[i] = 0;
      pool.baseAlpha[i] =
        pool.waveLayer[i] >= 0
          ? 0.24 + (1 - Math.abs(pool.waveV[i])) * 0.52
          : 0.14 + Math.random() * 0.26;
      pool.windReleaseAt[i] = now + Math.random() * 120;
    }
  }
}
