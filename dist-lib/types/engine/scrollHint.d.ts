import type { ParticlePool } from './particlePool.js';
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
export declare class ScrollHints {
    private down;
    private up;
    private mask;
    private downPos;
    private upPos;
    /** Forget all hint particles (call after the pool was reassigned from scratch). */
    reset(capacity: number): void;
    /** True if particle i belongs to a hint (so scrolling must not carry it). */
    isHint(i: number): boolean;
    /** Which hint (if any) is under a point, with a generous touch-friendly radius. */
    hit(x: number, y: number): 'down' | 'up' | null;
    /** Release everything (hints switched off or layout no longer scrollable). */
    clear(pool: ParticlePool, now: number): void;
    /** Show/hide and animate the hints for this frame. */
    update(pool: ParticlePool, s: ScrollHintState, time: number, now: number): void;
    private place;
    /** Borrow free ambient particles (from the end of the pool, away from layout assignments). */
    private claim;
    private release;
}
//# sourceMappingURL=scrollHint.d.ts.map