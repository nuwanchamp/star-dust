import { type LayoutOverflow, type LayoutPaddingBox } from '../engine/layoutEngine.js';
import { type LayoutBandBounds, type LayoutWindowMode } from '../engine/layoutWindow.js';
import type { MindMapFit } from '../engine/mindMapLayout.js';
import type { GestureKind, ImageTuningConfig, LayoutHitRegion, LayoutNode, PaletteMode, PhysicsConfig, RippleConfig } from '../types/mote.js';
export type TargetMode = 'text' | 'image' | 'layout';
/** A number (all sides) or per-side values; missing sides use the default (32px, 16px below 640px wide). */
export type LayoutPaddingValue = number | Partial<LayoutPaddingBox>;
/** Static padding, or a function of the canvas size (CSS px). */
export type LayoutPadding = LayoutPaddingValue | ((width: number, height: number) => LayoutPaddingValue);
export type { LayoutOverflow, LayoutPaddingBox, LayoutWindowMode, LayoutBandBounds, MindMapFit };
export interface MotionMetrics {
    particleCount: number;
    avgVelocity: number;
    avgEnergy: number;
}
export interface StarDustCallbacks {
    /** A plain click/tap on the canvas that did not trigger a gesture or button. */
    onCanvasClick?: () => void;
    /** A recognised gesture: fast swipe, triple tap burst, or long-press vortex release. */
    onGesture?: (kind: GestureKind) => void;
    /** Fired whenever the particle pool is resized. */
    onParticleCountChange?: (count: number) => void;
    /** A `<Button>` in layout mode was clicked. */
    onLayoutAction?: (action: string, region: LayoutHitRegion) => void;
    /** The pointer entered (region) or left (null) a layout `<Button>`. */
    onHoverChange?: (region: LayoutHitRegion | null) => void;
    /** `imageSrc` failed to load. */
    onImageError?: () => void;
    /** The idle auto-dissolve finished and the formation has melted back into the wave. */
    onAutoDissolvedToWave?: () => void;
    /** The user pressed on the canvas. */
    onUserActivity?: () => void;
    /** The layout scrolled. `top` is the current offset, `max` the largest possible offset. */
    onScroll?: (top: number, max: number) => void;
    /** Aggregate motion stats, roughly every 65 ms (useful for driving audio). */
    onMotionMetrics?: (metrics: MotionMetrics) => void;
    /** A burst-like interaction happened; `normX` is the horizontal position in 0..1. */
    onSoundImpulse?: (intensity: number, normX: number) => void;
}
export interface StarDustOptions extends StarDustCallbacks {
    /** What the particles form: text, an image, or a parsed layout. Default `'text'`. */
    targetMode?: TargetMode;
    /** Text to form when `targetMode` is `'text'`. */
    text?: string;
    /** Image URL (image mode), also the base URL for relative image refs in layout mode. */
    imageSrc?: string | null;
    invertImageContrast?: boolean;
    imageTuning?: ImageTuningConfig;
    /** Layout tree from `parseLayoutMarkup(markup).root` (layout mode). */
    layoutAst?: LayoutNode | null;
    /** Pixels reserved on the left in layout mode (e.g. for a side panel). */
    layoutLeftInset?: number;
    /**
     * Take over mind map expand/collapse: ids toggled relative to the markup's `collapsed` attribute.
     * Leave undefined (default) and the engine manages it: clicking a node opens or closes it, and
     * `mindMapFit` keeps the map readable. When set, your app must handle `mindmap:toggle:<id>` actions.
     */
    collapsedMindMapIds?: Set<string>;
    /**
     * When a mind map is too big to show at a readable size: `'collapse'` (default) collapses its deepest
     * levels (the root and first level always show; `+N` badges open them), closes older branches when a
     * new one needs room, and on narrow screens switches a radial map to a tree. `'shrink'` scales it down
     * to fit instead (the pre-0.3 behavior). Only applies when the engine manages collapse state.
     */
    mindMapFit?: MindMapFit;
    /**
     * A mind map that fits is enlarged to use free space (bigger labels are crisper), up to this factor,
     * using at most ~92% of the width and ~70% of the height so content around it still fits.
     * 1 = keep the natural size. Default 1.6.
     */
    mindMapMaxScale?: number;
    /**
     * What happens when a layout is taller than the canvas. `'scroll'` (default) keeps text at a
     * readable size (see `layoutMinFontSize`) and lets the wheel, trackpad or touch-drag scroll it.
     * `'fit'` shrinks the whole layout to fit, however small that makes it.
     */
    layoutOverflow?: LayoutOverflow;
    /** Smallest font size (px) `'scroll'` mode may shrink layout text to before scrolling. Default 14. */
    layoutMinFontSize?: number;
    /** Space kept clear around a layout. Default 32px (16px below 640px wide). */
    layoutPadding?: LayoutPadding;
    /**
     * Particles spent on one screen of layout content. Higher = crisper text, more CPU/GPU work.
     * Long layouts are windowed, so this is per screen, not per layout. Default by density:
     * 16.5k (sparse), 30k (balanced), 45k (dense).
     */
    layoutParticleBudget?: number;
    /**
     * Which part of a layout gets particles when there aren't enough for all of it.
     * - `'auto'` (default): a clear band from the top of the layout that grows down until
     *   `layoutParticleBudget` is used, ending between two lines. Text is never thinned; content past
     *   the band is not drawn until you scroll it in. Dense content gives a shorter band.
     * - `'screen'`: the whole screen; if it holds more than the budget, all text is thinned evenly.
     * - a number: a band of that many px; thinned if it holds more than the budget.
     */
    layoutWindow?: LayoutWindowMode;
    /**
     * Show particle chevrons when a layout can scroll: below the clear band while more content follows,
     * above it once scrolled down. Clicking one scrolls. Default `true`; turn off to draw your own
     * (see `layoutBand`, `scrollTop`, `scrollHeight`, `onScroll`).
     */
    layoutScrollHint?: boolean;
    /**
     * Let a layout melt into the wave after `physics.autoDissolveSec` of inactivity. Default `false`:
     * layouts are for reading, so they stay formed. Text and image modes always use `autoDissolveSec`.
     */
    layoutAutoDissolve?: boolean;
    /**
     * Open `open:<url>` layout actions (e.g. `<Image action="open:https://…">`) in a new tab. Only
     * http(s), mailto and tel links are opened; `onLayoutAction` still fires either way. Default `true`;
     * set `false` to handle navigation yourself.
     */
    openLinks?: boolean;
    /**
     * How formed text follows a scroll, 0..1. `0` (default): it moves rigidly with the content and stays
     * crisp. `1`: particles trail behind on their springs and catch up (dreamier, blurs while moving).
     * Values in between mix the two. Takes effect immediately.
     */
    layoutScrollTrail?: number;
    /**
     * Maps a layout `<Image src="...">` value to a URL (or null to skip it). Receives the current
     * `imageSrc`. Default: no src / "current" / "uploaded" → `imageSrc`, anything else used as a URL.
     * Changing this function alone does not re-sample; it is picked up on the next content change.
     */
    resolveLayoutImage?: (ref: string | undefined, currentImageSrc: string | null) => string | null;
    /** When true, particles ignore the target and drift freely. Default `false`. */
    freeDrift?: boolean;
    /** Physics tuning; merged over the current/default values. */
    physics?: Partial<PhysicsConfig>;
    /** Ripple tuning; merged over the current/default values. */
    ripple?: Partial<RippleConfig>;
    palette?: PaletteMode;
    /**
     * Size the canvas to fill its parent (`width/height: 100%`, `display: block`).
     * Set to `false` if you size the canvas yourself with CSS. Default `true`.
     * Only read at construction.
     */
    fill?: boolean;
    /** Let the engine set `canvas.style.cursor`. Default `true`. */
    manageCursor?: boolean;
}
type ResolvedOptions = Omit<StarDustOptions, 'physics' | 'ripple'> & {
    targetMode: TargetMode;
    text: string;
    imageSrc: string | null;
    invertImageContrast: boolean;
    imageTuning: ImageTuningConfig;
    layoutAst: LayoutNode | null;
    layoutLeftInset: number;
    layoutOverflow: LayoutOverflow;
    layoutMinFontSize: number;
    layoutScrollTrail: number;
    layoutWindow: LayoutWindowMode;
    layoutScrollHint: boolean;
    layoutAutoDissolve: boolean;
    openLinks: boolean;
    mindMapFit: MindMapFit;
    mindMapMaxScale: number;
    freeDrift: boolean;
    physics: PhysicsConfig;
    ripple: RippleConfig;
    palette: PaletteMode;
    fill: boolean;
    manageCursor: boolean;
};
export declare const DEFAULT_PHYSICS: PhysicsConfig;
export declare const DEFAULT_RIPPLE: RippleConfig;
/**
 * Framework-agnostic interactive dust-particle renderer.
 *
 * ```ts
 * const dust = new StarDust(canvas, { text: 'Hello' });
 * dust.setOptions({ palette: 'moonlit' });
 * dust.scatter();
 * dust.destroy();
 * ```
 */
export declare class StarDust {
    readonly canvas: HTMLCanvasElement;
    /** False when WebGL2 is unavailable; the instance is then inert. */
    readonly supported: boolean;
    private o;
    private pool;
    private vertexData;
    private dissolveOrder;
    private perlinWind;
    private constellation;
    private renderer;
    private shockwaves;
    private wakeNodes;
    private size;
    private parallax;
    private glyphFontSize;
    private imageCellSize;
    private loadedImage;
    private layoutImageCache;
    private hitRegions;
    private rippleRegions;
    private ripplePulses;
    private lastHoverRipple;
    private hoveredRegionId;
    private reportedHoverId;
    private lastActivityAt;
    private dissolveStartedAt;
    private dissolveFired;
    private lastMovePos;
    private lastAudioReportAt;
    private lastSampledTuning;
    private reducedMotion;
    private pointer;
    private scrollPos;
    private scrollGoal;
    private scrollLimit;
    private touchScroll;
    /** Set while a scrollable layout is shown: hands particles to whatever is on screen. */
    private layoutWindow;
    /** "More content" chevrons built from particles. */
    private hints;
    private hintHover;
    /** Layout button focused with the keyboard (its rippleRegionId), or -1. */
    private kbFocusId;
    /** Engine-managed mind map state: nodes the user opened (value: recency) / closed, and what is shown closed. */
    private mmExpanded;
    private mmCollapsed;
    private mmShownCollapsed;
    /** Page shown for branches whose children are paged ("+N more ▸"). */
    private mmPages;
    private mmClock;
    private rafId;
    private startTime;
    private shockUniforms;
    private resizeTimer;
    private targetDebounce;
    private targetToken;
    private destroyed;
    private cleanups;
    constructor(canvas: HTMLCanvasElement, options?: StarDustOptions);
    /** Current resolved options (read-only snapshot). */
    getOptions(): Readonly<ResolvedOptions>;
    /** Current particle count. */
    get particleCount(): number;
    /**
     * Update any subset of options. Only the options that changed trigger work:
     * content/density/font changes re-sample targets; everything else applies next frame.
     */
    setOptions(next: StarDustOptions): void;
    /** Blow the current formation apart with a left-to-right gust of wind. */
    scatter(): void;
    /** Reset the idle auto-dissolve timer, as if the user had just interacted. */
    markActivity(): void;
    /** Current layout scroll offset in px (0 when the layout fits). */
    get scrollTop(): number;
    /** Largest possible layout scroll offset in px (0 when the layout fits). */
    get scrollHeight(): number;
    /**
     * Clickable layout regions (`<Button>`s, collapsible mind-map nodes) in canvas CSS px, at the current
     * scroll position. Useful for overlaying accessible DOM controls.
     */
    get layoutHitRegions(): readonly LayoutHitRegion[];
    /**
     * The on-screen band (canvas px) where layout content is currently drawn, or null when the whole
     * layout is drawn. Useful for placing a scroll hint or fade below it.
     */
    get layoutBand(): LayoutBandBounds | null;
    /**
     * Scroll a layout that overflows the canvas (smooth by default). Formed text moves with the scroll;
     * content leaving the screen dissolves and its particles re-form the content coming in.
     */
    scrollTo(top: number, options?: {
        smooth?: boolean;
    }): void;
    /** Scroll by a relative amount (see `scrollTo`). */
    scrollBy(dy: number, options?: {
        smooth?: boolean;
    }): void;
    /** Stop the animation loop, remove all listeners and release GPU resources. */
    destroy(): void;
    private listen;
    /** Whether a hit region is inside the drawn band (buttons outside it are invisible, so not clickable). */
    private isInBand;
    private canScroll;
    /** Move the content by `dy` px: shift particle targets and hit/ripple regions; particles follow on their springs. */
    private applyScroll;
    private updateScrollHints;
    /** Scroll roughly one band in a direction (used by the hint chevrons). */
    private pageScroll;
    /** A layout button was clicked or pressed: glow, shockwave, sound, then `onLayoutAction`. */
    private activateHit;
    /** `open:<url>` actions open in a new tab (http, https, mailto, tel only). */
    private openLink;
    /**
     * Engine-managed mind maps: `mindmap:toggle:<id>` opens or closes a node; `mindmap:page:<id>:next|prev`
     * shows the next or previous set of a paged branch's children.
     */
    private toggleMindMapNode;
    /** Highlight a layout button for keyboard users (reuses the hover glow); -1 clears it. */
    private setKeyboardFocus;
    /** Scroll just enough that a region sits inside the clear band. */
    private scrollIntoBand;
    private handleKeyDown;
    private handleWheel;
    private toLocal;
    private handleResize;
    private updateCursor;
    /** Called whenever hoveredRegionId may have changed. */
    private syncHover;
    private resolveImage;
    private resetIdleDissolve;
    /** Load whatever the current target needs (image, layout images, fonts), then re-sample. */
    private refreshTargets;
    private assignTargets;
    private renderFrame;
    private handlePointerMove;
    private handlePointerDown;
    private handlePointerUp;
    private handlePointerLeave;
}
//# sourceMappingURL=StarDust.d.ts.map