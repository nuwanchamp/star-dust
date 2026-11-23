import type { ParticlePool } from './particlePool.js';
import { type SampledPoint } from './textSampler.js';
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
export declare class LayoutWindow {
    private readonly screenBudget;
    private readonly viewHeight;
    private readonly mode;
    private readonly bounds;
    readonly targetCount: number;
    /** Horizontal center of the layout content (canvas px). */
    readonly centerX: number;
    private readonly x0;
    private readonly y0;
    private readonly weight;
    private readonly region;
    /** Random keep-rank per target (stable across scrolls so thinning doesn't flicker); -1 = never thin. */
    private readonly rank;
    /** prefixNormal[i] = number of thinnable targets among the first i (sorted) targets. */
    private readonly prefixNormal;
    private readonly targetParticle;
    private particleTarget;
    private active;
    private activeCount;
    private windowScroll;
    constructor(points: SampledPoint[], screenBudget: number, priorityRegionIds: Iterable<number>, viewHeight: number, mode?: LayoutWindowMode, bounds?: LayoutBandBounds);
    /** Particles needed to fill one window; size the pool with this plus the ambient count. */
    get poolNeed(): number;
    /**
     * Smallest scroll offset at which the last line of content is inside the band. For `'screen'`
     * this is 0 (the layout engine's own scroll range already covers it).
     */
    scrollEnd(): number;
    /** The clear band on screen (canvas px) at a scroll offset. */
    band(scroll: number): LayoutBandBounds;
    /** Assign particles from scratch for the given scroll offset (after the pool was resized). */
    assignAll(pool: ParticlePool, scroll: number, width: number, height: number): void;
    /**
     * Move particles to follow the scroll. Call after particle targets were shifted to `scroll`.
     * Returns true when assignments changed.
     */
    update(pool: ParticlePool, scroll: number, now: number): boolean;
    private link;
    private ensureCapacity;
    /** Window [lo, hi) of sorted targets for a scroll offset, and the keep ratio for thinnable ones. */
    private range;
    /** Share of thinnable targets in [lo, hi) that fit the budget (priority targets always kept). */
    private keepRatio;
    /**
     * 'auto': from the band top, take whole lines until the budget is used or the band bottom is
     * reached. Nothing is thinned; the cut lands in the gap between two lines.
     */
    private autoRange;
    private lowerBound;
}
//# sourceMappingURL=layoutWindow.d.ts.map