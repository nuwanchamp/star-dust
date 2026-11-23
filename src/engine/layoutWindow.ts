import type { ParticlePool } from './particlePool';
import { type SampledPoint, assignTargetsByProximity } from './textSampler';

/** Extra band above/below the screen (as a fraction of its height) that already holds formed content. */
const MARGIN_RATIO = 0.12;
/** Re-window after the content has moved this many px. */
const REWINDOW_STEP = 12;
/** A vertical gap between consecutive sorted points at least this big separates two text lines. */
const LINE_GAP = 4;
/** How far above the budget cut to look for a line gap before cutting mid-line. */
const GAP_SEARCH = 90;

/**
 * Which part of the layout gets particles:
 * - `'screen'`: the whole visible screen; if it holds more than the budget, text is thinned evenly.
 * - `'auto'`: a band from the top of the content area that grows down until the budget is used,
 *   cut between two lines, never thinned. Content below it stays undrawn until scrolled in.
 * - a number: a band of that height (px) from the top of the content area; thinned if over budget.
 */
export type LayoutWindowMode = 'auto' | 'screen' | number;

/** Where the clear band sits on screen: from `top` down to at most `bottom` (canvas px). */
export interface LayoutBandBounds {
  top: number;
  bottom: number;
}

/**
 * Gives particles only to the part of a scrollable layout that is on screen.
 *
 * Every target of the layout is kept (sorted by y, in content coordinates at scroll 0), but at most
 * `screenBudget` particles are spent per screen, so long content is as crisp as short content. When
 * scrolling, targets that leave the window release their particles; those particles are handed to
 * the targets entering the window (paired by x, so they stream across), and any not needed dissolve
 * into the ambient drift.
 */
export class LayoutWindow {
  readonly targetCount: number;
  /** Horizontal center of the layout content (canvas px). */
  readonly centerX: number;
  private readonly x0: Float32Array;
  private readonly y0: Float32Array;
  private readonly weight: Float32Array;
  private readonly region: Int16Array;
  /** Random keep-rank per target (stable across scrolls so thinning doesn't flicker); -1 = never thin. */
  private readonly rank: Float32Array;
  /** prefixNormal[i] = number of thinnable targets among the first i (sorted) targets. */
  private readonly prefixNormal: Int32Array;
  private readonly targetParticle: Int32Array;
  private particleTarget: Int32Array = new Int32Array(0);
  private active: Int32Array = new Int32Array(0);
  private activeCount = 0;
  private windowScroll = Number.NaN;

  constructor(
    points: SampledPoint[],
    private readonly screenBudget: number,
    priorityRegionIds: Iterable<number>,
    private readonly viewHeight: number,
    private readonly mode: LayoutWindowMode = 'screen',
    private readonly bounds: LayoutBandBounds = { top: 0, bottom: viewHeight }
  ) {
    const sorted = points.slice().sort((a, b) => a.y - b.y);
    const n = sorted.length;
    const priority = new Set(priorityRegionIds);
    this.targetCount = n;
    this.x0 = new Float32Array(n);
    this.y0 = new Float32Array(n);
    this.weight = new Float32Array(n);
    this.region = new Int16Array(n);
    this.rank = new Float32Array(n);
    this.prefixNormal = new Int32Array(n + 1);
    this.targetParticle = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const p = sorted[i];
      const regionId = p.regionId ?? -1;
      this.x0[i] = p.x;
      this.y0[i] = p.y;
      this.weight[i] = p.weight ?? 0.8;
      this.region[i] = regionId;
      const isPriority = regionId >= 0 && priority.has(regionId);
      this.rank[i] = isPriority ? -1 : Math.random();
      this.prefixNormal[i + 1] = this.prefixNormal[i] + (isPriority ? 0 : 1);
    }
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < n; i++) {
      if (this.x0[i] < minX) minX = this.x0[i];
      if (this.x0[i] > maxX) maxX = this.x0[i];
    }
    this.centerX = n > 0 ? (minX + maxX) / 2 : 0;
  }

  /** Particles needed to fill one window; size the pool with this plus the ambient count. */
  get poolNeed(): number {
    const windowShare = this.mode === 'screen' ? 1 + MARGIN_RATIO * 2 : 1;
    return Math.min(this.targetCount, Math.ceil(this.screenBudget * windowShare));
  }

  /**
   * Smallest scroll offset at which the last line of content is inside the band. For `'screen'`
   * this is 0 (the layout engine's own scroll range already covers it).
   */
  scrollEnd(): number {
    const n = this.targetCount;
    if (n === 0 || this.mode === 'screen') return 0;
    const last = this.y0[n - 1];
    let need: number;
    if (this.mode === 'auto') {
      need = last - this.bounds.bottom;
      if (n > this.screenBudget) {
        // The last `screenBudget` targets must start at or below the band top.
        need = Math.max(need, this.y0[n - this.screenBudget] - this.bounds.top);
      }
    } else {
      need = last - (this.bounds.top + this.mode);
    }
    // A little slack so the line-gap cut never strands the final line.
    return need > 0 ? Math.ceil(need + 24) : 0;
  }

  /** The clear band on screen (canvas px) at a scroll offset. */
  band(scroll: number): LayoutBandBounds {
    if (this.mode === 'screen') return { top: 0, bottom: this.viewHeight };
    const { lo, hi } = this.range(scroll);
    const top = this.bounds.top;
    if (this.mode !== 'auto') return { top, bottom: top + this.mode };
    const bottom = hi < this.targetCount ? this.y0[hi] - scroll : this.bounds.bottom;
    return { top, bottom: Math.max(top, hi > lo ? bottom : top) };
  }

  /** Assign particles from scratch for the given scroll offset (after the pool was resized). */
  assignAll(pool: ParticlePool, scroll: number, width: number, height: number): void {
    this.ensureCapacity(pool);
    this.targetParticle.fill(-1);
    this.particleTarget.fill(-1);
    this.activeCount = 0;

    const { lo, hi, ratio } = this.range(scroll);
    const wanted: number[] = [];
    for (let t = lo; t < hi; t++) {
      if (this.rank[t] < ratio) wanted.push(t);
    }
    const targets: SampledPoint[] = wanted.map((t) => ({
      x: this.x0[t],
      y: this.y0[t] - scroll,
      weight: this.weight[t],
      regionId: this.region[t],
    }));
    assignTargetsByProximity(pool, targets, width, height, 36, true, (k, p) => {
      this.link(wanted[k], p);
    });
    this.windowScroll = scroll;
  }

  /**
   * Move particles to follow the scroll. Call after particle targets were shifted to `scroll`.
   * Returns true when assignments changed.
   */
  update(pool: ParticlePool, scroll: number, now: number): boolean {
    if (Math.abs(scroll - this.windowScroll) < REWINDOW_STEP) return false;
    this.windowScroll = scroll;
    this.ensureCapacity(pool);
    const { lo, hi, ratio } = this.range(scroll);
    const { hasTarget, regionId, isFringe, baseAlpha, waveLayer, waveV, windReleaseAt } = pool;

    // 1. Release targets that left the window (or were thinned out).
    const released: number[] = [];
    for (let a = this.activeCount - 1; a >= 0; a--) {
      const t = this.active[a];
      if (t >= lo && t < hi && this.rank[t] < ratio) continue;
      const p = this.targetParticle[t];
      this.targetParticle[t] = -1;
      this.particleTarget[p] = -1;
      this.active[a] = this.active[--this.activeCount];
      hasTarget[p] = 0;
      regionId[p] = -1;
      isFringe[p] = 0;
      baseAlpha[p] =
        waveLayer[p] >= 0 ? 0.24 + (1 - Math.abs(waveV[p])) * 0.52 : 0.14 + Math.random() * 0.26;
      released.push(p);
    }

    // 2. Targets that entered the window and need a particle.
    const incoming: number[] = [];
    for (let t = lo; t < hi; t++) {
      if (this.targetParticle[t] === -1 && this.rank[t] < ratio) incoming.push(t);
    }

    // 3. Hand them released particles first (content flows from what left to what arrived),
    //    then other free ambient particles.
    const donors = released.slice(0, incoming.length);
    if (donors.length < incoming.length) {
      const reused = new Set(released);
      for (let i = 0; i < pool.count && donors.length < incoming.length; i++) {
        if (hasTarget[i] === 0 && !reused.has(i)) donors.push(i);
      }
    }
    const n = Math.min(donors.length, incoming.length);
    if (n > 0) {
      const pickedTargets = incoming.slice(0, n).sort((a, b) => this.x0[a] - this.x0[b]);
      const pickedDonors = donors.slice(0, n).sort((a, b) => pool.x[a] - pool.x[b]);
      for (let k = 0; k < n; k++) {
        const t = pickedTargets[k];
        const p = pickedDonors[k];
        pool.tx[p] = this.x0[t];
        pool.ty[p] = this.y0[t] - scroll;
        hasTarget[p] = 1;
        isFringe[p] = 0;
        regionId[p] = this.region[t];
        pool.gravityBreakUntil[p] = 0;
        windReleaseAt[p] = 0;
        baseAlpha[p] = this.weight[t];
        this.link(t, p);
      }
    }

    // 4. Released particles nobody needed dissolve with a soft gust.
    for (let k = n; k < released.length; k++) {
      windReleaseAt[released[k]] = now + Math.random() * 160;
    }
    return released.length > 0 || n > 0;
  }

  /** Hand the target held by particle `from` to particle `to` (formFlowMs swaps particles around). */
  relink(from: number, to: number, pool: ParticlePool): void {
    this.ensureCapacity(pool);
    const t = this.particleTarget[from];
    if (t === undefined || t < 0) return;
    this.particleTarget[from] = -1;
    this.targetParticle[t] = to;
    this.particleTarget[to] = t;
  }

  private link(t: number, p: number): void {
    this.targetParticle[t] = p;
    this.particleTarget[p] = t;
    this.active[this.activeCount++] = t;
  }

  private ensureCapacity(pool: ParticlePool): void {
    if (this.particleTarget.length < pool.capacity) {
      const next = new Int32Array(pool.capacity).fill(-1);
      next.set(this.particleTarget);
      this.particleTarget = next;
    }
    if (this.active.length < pool.capacity) {
      const next = new Int32Array(pool.capacity);
      next.set(this.active.subarray(0, this.activeCount));
      this.active = next;
    }
  }

  /** Window [lo, hi) of sorted targets for a scroll offset, and the keep ratio for thinnable ones. */
  private range(scroll: number): { lo: number; hi: number; ratio: number } {
    if (this.mode === 'auto') return this.autoRange(scroll);
    if (this.mode !== 'screen') {
      const lo = this.lowerBound(scroll + this.bounds.top);
      const hi = this.lowerBound(scroll + this.bounds.top + this.mode);
      return { lo, hi, ratio: this.keepRatio(lo, hi) };
    }
    const margin = this.viewHeight * MARGIN_RATIO;
    const lo = this.lowerBound(scroll - margin);
    const hi = this.lowerBound(scroll + this.viewHeight + margin);
    // Budget against what is actually visible, so the screen gets the full density.
    const vLo = this.lowerBound(scroll);
    const vHi = this.lowerBound(scroll + this.viewHeight);
    return { lo, hi, ratio: this.keepRatio(vLo, vHi) };
  }

  /** Share of thinnable targets in [lo, hi) that fit the budget (priority targets always kept). */
  private keepRatio(lo: number, hi: number): number {
    const normal = this.prefixNormal[hi] - this.prefixNormal[lo];
    const priority = hi - lo - normal;
    const room = Math.max(0, this.screenBudget - priority);
    return normal > 0 ? Math.min(1, room / normal) : 1;
  }

  /**
   * 'auto': from the band top, take whole lines until the budget is used or the band bottom is
   * reached. Nothing is thinned; the cut lands in the gap between two lines.
   */
  private autoRange(scroll: number): { lo: number; hi: number; ratio: number } {
    const lo = this.lowerBound(scroll + this.bounds.top);
    let hi = this.lowerBound(scroll + this.bounds.bottom);
    const cap = lo + this.screenBudget;
    if (cap < hi) {
      hi = cap;
      const capY = this.y0[cap];
      for (let k = cap; k > lo + 1 && capY - this.y0[k] < GAP_SEARCH; k--) {
        if (this.y0[k] - this.y0[k - 1] >= LINE_GAP) {
          hi = k;
          break;
        }
      }
    }
    return { lo, hi, ratio: 1 };
  }

  private lowerBound(y: number): number {
    let a = 0;
    let b = this.targetCount;
    while (a < b) {
      const m = (a + b) >> 1;
      if (this.y0[m] < y) a = m + 1;
      else b = m;
    }
    return a;
  }
}
