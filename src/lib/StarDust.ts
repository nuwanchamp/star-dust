import { ConstellationBuilder } from '../engine/constellationBuilder';
import { PALETTE_THEMES } from '../engine/dustAtlas';
import {
  DEFAULT_IMAGE_TUNING,
  loadImageElement,
  sampleImageTargets,
} from '../engine/imageSampler';
import {
  type LayoutOverflow,
  type LayoutPaddingBox,
  defaultLayoutImageUrl,
  sampleLayoutScene,
} from '../engine/layoutEngine';
import { collectLayoutImageRefs } from '../engine/layoutParser';
import {
  type ParticlePool,
  computeWavePoint,
  createParticlePool,
  resizeParticlePool,
} from '../engine/particlePool';
import { type LayoutBandBounds, LayoutWindow, type LayoutWindowMode } from '../engine/layoutWindow';
import type { MindMapFit } from '../engine/mindMapLayout';
import { PerlinWindField } from '../engine/perlinNoise';
import { ScrollHints } from '../engine/scrollHint';
import {
  type SampledPoint,
  assignTargetsByProximity,
  getAmbientCount,
  sampleTextTargets,
} from '../engine/textSampler';
import {
  FLOATS_PER_VERTEX,
  type ShockwaveUniform,
  WebGLDustRenderer,
  getPaletteLut,
} from '../engine/webglDustRenderer';
import type {
  GestureKind,
  ImageTuningConfig,
  LayoutHitRegion,
  LayoutNode,
  PaletteMode,
  PhysicsConfig,
  RippleConfig,
  RipplePattern,
  RippleRegion,
} from '../types/mote';

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
   * When dust that was drifting as the free wave forms a shape (text, image or layout), particles leave
   * the wave over this many ms instead of all at once: those closest to their place go first, the rest
   * keep flowing along the wave until their turn, so the wave visibly pours into the shape.
   * Default `0` (everything heads for its place immediately).
   */
  formStaggerMs?: number;
  /**
   * When the dust takes a new shape (leaving the free wave, or a new `layoutAst`, `text`, `imageSrc` or
   * `targetMode`), the old shape melts into the Perlin wind and the particles ride its swirling streams
   * for about this many ms before condensing into the new shape, each at its own moment. Takes
   * precedence over `formStaggerMs`. Re-layouts of the same scene (resize, mind-map toggles, density)
   * are not flowed. Default `0` (off).
   */
  formFlowMs?: number;
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
  formStaggerMs: number;
  formFlowMs: number;
  mindMapFit: MindMapFit;
  mindMapMaxScale: number;
  freeDrift: boolean;
  physics: PhysicsConfig;
  ripple: RippleConfig;
  palette: PaletteMode;
  fill: boolean;
  manageCursor: boolean;
};

export const DEFAULT_PHYSICS: PhysicsConfig = {
  cursorMode: 'repel',
  density: 'balanced',
  fontStyle: 'serif',
  turbulence: 0.75,
  cohesion: 0.065,
  autoDissolveSec: 20,
  perlinFlow: true,
  bloom: true,
  constellation: false,
};

export const DEFAULT_RIPPLE: RippleConfig = {
  pattern: 'off',
  trigger: 'both',
  strength: 0.75,
  speed: 1.0,
  wavelength: 130,
};

/** After the last particle leaves the wave (formStaggerMs), ms until the scene's normal look is fully in. */
const POUR_SETTLE_MS = 1200;
/** formFlowMs: how fast the old shape melts into the wind, and how long each particle takes to land. */
const FLOW_RAMP_IN_MS = 350;
const FLOW_CONDENSE_MS = 700;
/** formFlowMs: strength of the wind while riding it, relative to the idle dissolve's. */
const FLOW_GAIN = 1.6;
/** formFlowMs, shape to shape: particles let go of the old shape over this share of the span. */
const FLOW_RELEASE_SHARE = 0.35;
/** formFlowMs: each particle's own drift on top of the wind, so the dust spreads instead of sliding. */
const FLOW_SPREAD = 0.05;

const DEFAULTS: Omit<ResolvedOptions, keyof StarDustCallbacks> = {
  targetMode: 'text',
  text: '',
  imageSrc: null,
  invertImageContrast: false,
  imageTuning: DEFAULT_IMAGE_TUNING,
  layoutAst: null,
  layoutLeftInset: 0,
  layoutOverflow: 'scroll',
  layoutMinFontSize: 14,
  layoutPadding: undefined,
  layoutParticleBudget: undefined,
  layoutScrollTrail: 0,
  layoutWindow: 'auto',
  layoutScrollHint: true,
  layoutAutoDissolve: false,
  openLinks: true,
  formStaggerMs: 0,
  formFlowMs: 0,
  mindMapFit: 'collapse',
  mindMapMaxScale: 1.6,
  collapsedMindMapIds: undefined,
  freeDrift: false,
  physics: DEFAULT_PHYSICS,
  ripple: DEFAULT_RIPPLE,
  palette: 'aurora',
  fill: true,
  manageCursor: true,
};

function mergeOptions(base: ResolvedOptions, next: StarDustOptions): ResolvedOptions {
  const merged = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(next) as (keyof StarDustOptions)[]) {
    const value = next[key];
    if (key === 'physics') {
      merged.physics = { ...base.physics, ...(value as Partial<PhysicsConfig> | undefined) };
    } else if (key === 'ripple') {
      merged.ripple = { ...base.ripple, ...(value as Partial<RippleConfig> | undefined) };
    } else if (value === undefined && key in DEFAULTS) {
      merged[key] = DEFAULTS[key as keyof typeof DEFAULTS];
    } else {
      merged[key] = value;
    }
  }
  return merged as ResolvedOptions;
}

function sameTuning(a: ImageTuningConfig, b: ImageTuningConfig): boolean {
  return (
    a.blurStyle === b.blurStyle &&
    a.edgeBlur === b.edgeBlur &&
    a.contrast === b.contrast &&
    a.detail === b.detail
  );
}

function resolveLayoutPadding(
  padding: LayoutPadding | undefined,
  width: number,
  height: number
): LayoutPaddingBox {
  const def = width < 640 ? 16 : 32;
  const value = typeof padding === 'function' ? padding(width, height) : padding;
  if (typeof value === 'number') return { top: value, right: value, bottom: value, left: value };
  return {
    top: value?.top ?? def,
    right: value?.right ?? def,
    bottom: value?.bottom ?? def,
    left: value?.left ?? def,
  };
}

function samePadding(a: LayoutPaddingBox, b: LayoutPaddingBox): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

function whenFontsReady(): Promise<unknown> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    return document.fonts.ready;
  }
  return Promise.resolve();
}

interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  down: boolean;
  downAt: number;
  downX: number;
  downY: number;
  swipeCooldownUntil: number;
  recentClicks: number[];
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface WakeNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
}

interface RipplePulse {
  x: number;
  y: number;
  regionId: number;
  pattern: Exclude<RipplePattern, 'off'>;
  bornAt: number;
  power: number;
  speed: number;
  wavelength: number;
}

interface ResolvedRegionRipple {
  region: RippleRegion;
  pattern: RipplePattern;
  allowAmbient: boolean;
  allowHover: boolean;
  allowClick: boolean;
  strength: number;
  speed: number;
  wavelength: number;
}

function resolveRegionRipple(
  region: RippleRegion | undefined,
  globalCfg: RippleConfig
): {
  pattern: RipplePattern;
  allowAmbient: boolean;
  allowHover: boolean;
  allowClick: boolean;
  strength: number;
  speed: number;
  wavelength: number;
} {
  const pattern = region?.pattern ?? globalCfg.pattern;
  const trigger = region?.trigger ?? globalCfg.trigger;
  const strength = region?.strength ?? globalCfg.strength;
  const speed = region?.speed ?? globalCfg.speed;
  const wavelength = region?.wavelength ?? globalCfg.wavelength;
  const active = pattern !== 'off' && strength > 0.01;
  if (pattern === 'expand') {
    return {
      pattern,
      allowAmbient: false,
      allowHover: false,
      allowClick: active,
      strength,
      speed,
      wavelength,
    };
  }
  return {
    pattern,
    allowAmbient: active && (trigger === 'both' || trigger === 'ambient'),
    allowHover:
      active && (trigger === 'both' || trigger === 'interactive' || trigger === 'hover'),
    allowClick:
      active && (trigger === 'both' || trigger === 'interactive' || trigger === 'click'),
    strength,
    speed,
    wavelength,
  };
}

const MAX_WAKE_NODES = 16;
const MAX_RIPPLE_PULSES = 8;

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
export class StarDust {
  readonly canvas: HTMLCanvasElement;
  /** False when WebGL2 is unavailable; the instance is then inert. */
  readonly supported: boolean;

  private o: ResolvedOptions;

  private pool: ParticlePool = createParticlePool(24000);
  private vertexData = new Float32Array(24000 * FLOATS_PER_VERTEX);
  private dissolveOrder = new Float32Array(24000);
  private perlinWind = new PerlinWindField(52, 34);
  private constellation = new ConstellationBuilder();
  private renderer: WebGLDustRenderer | null = null;
  private shockwaves: Shockwave[] = [];
  private wakeNodes: WakeNode[] = [];
  private size = { width: 0, height: 0, dpr: 1 };
  private parallax = { x: 0, y: 0 };
  private glyphFontSize = 72;
  private imageCellSize = 2;
  private loadedImage: { src: string; img: HTMLImageElement } | null = null;
  private layoutImageCache = new Map<string, HTMLImageElement>();
  private hitRegions: LayoutHitRegion[] = [];
  private rippleRegions: RippleRegion[] = [];
  private ripplePulses: RipplePulse[] = [];
  private lastHoverRipple = { time: 0, x: -9999, y: -9999, regionId: -2 };
  private hoveredRegionId = -1;
  private reportedHoverId = -1;
  private lastActivityAt = typeof performance !== 'undefined' ? performance.now() : 0;
  private dissolveStartedAt: number | null = null;
  private dissolveFired = false;
  private lastMovePos = { x: -9999, y: -9999 };
  private lastAudioReportAt = 0;
  private lastSampledTuning: ImageTuningConfig;
  private reducedMotion = false;
  private pointer: PointerState = {
    x: -9999,
    y: -9999,
    vx: 0,
    vy: 0,
    active: false,
    down: false,
    downAt: 0,
    downX: 0,
    downY: 0,
    swipeCooldownUntil: 0,
    recentClicks: [],
  };

  // Layout scrolling: current offset, eased-toward goal, and the largest offset.
  private scrollPos = 0;
  private scrollGoal = 0;
  private scrollLimit = 0;
  private touchScroll: { startY: number; startGoal: number; active: boolean } | null = null;
  /** Set while a scrollable layout is shown: hands particles to whatever is on screen. */
  private layoutWindow: LayoutWindow | null = null;
  /** "More content" chevrons built from particles. */
  private hints = new ScrollHints();
  private hintHover = false;
  /** Layout button focused with the keyboard (its rippleRegionId), or -1. */
  private kbFocusId = -1;
  /** Engine-managed mind map state: nodes the user opened (value: recency) / closed, and what is shown closed. */
  private mmExpanded = new Map<string, number>();
  private mmCollapsed = new Set<string>();
  private mmShownCollapsed = new Set<string>();
  /** Page shown for branches whose children are paged ("+N more ▸"). */
  private mmPages = new Map<string, number>();
  private mmClock = 0;

  private rafId = 0;
  private startTime = 0;
  private shockUniforms: ShockwaveUniform[] = [];
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private targetDebounce: ReturnType<typeof setTimeout> | null = null;
  /** Whether the last target assignment was the free wave (formStaggerMs applies when leaving it). */
  private lastAssignFree = false;
  /** When the wave last started pouring into a shape (formStaggerMs), and over how long; 0 = not. */
  private pourStartedAt = 0;
  /** The shown shape changed (layoutAst, text, imageSrc, targetMode) since the last assignment. */
  private shapeChanged = false;
  /** At least one target assignment has happened (there is a shape to flow from). */
  private hasAssigned = false;
  /** When the current formFlowMs transition started, and its span; 0 = none. */
  private flowStartedAt = 0;
  private flowSpanMs = 0;
  private pourSpanMs = 0;
  private targetToken = 0;
  private destroyed = false;
  private cleanups: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, options: StarDustOptions = {}) {
    this.canvas = canvas;
    this.o = mergeOptions({ ...DEFAULTS } as ResolvedOptions, options);
    this.lastSampledTuning = this.o.imageTuning;

    if (this.o.fill) {
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    this.updateCursor();

    try {
      this.renderer = new WebGLDustRenderer(canvas);
      this.supported = true;
    } catch {
      this.supported = false;
      return;
    }

    this.listen(canvas, 'webglcontextlost', (e) => e.preventDefault());
    this.listen(canvas, 'webglcontextrestored', () => {
      try {
        this.renderer = new WebGLDustRenderer(canvas);
      } catch {
        // Ignore if context restore fails
      }
    });

    if (typeof window !== 'undefined' && window.matchMedia) {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = motionQuery.matches;
      const onMotionChange = (e: MediaQueryListEvent) => {
        this.reducedMotion = e.matches;
      };
      motionQuery.addEventListener('change', onMotionChange);
      this.cleanups.push(() => motionQuery.removeEventListener('change', onMotionChange));
    }

    this.listen(canvas, 'pointermove', (e) => this.handlePointerMove(e as PointerEvent));
    this.listen(canvas, 'pointerdown', (e) => this.handlePointerDown(e as PointerEvent));
    this.listen(canvas, 'pointerup', (e) => this.handlePointerUp(e as PointerEvent));
    this.listen(canvas, 'pointerleave', () => this.handlePointerLeave());
    this.listen(canvas, 'pointercancel', () => this.handlePointerLeave());
    this.listen(canvas, 'wheel', (e) => this.handleWheel(e as WheelEvent), { passive: false });
    this.listen(canvas, 'keydown', (e) => this.handleKeyDown(e as KeyboardEvent));
    this.listen(canvas, 'blur', () => this.setKeyboardFocus(-1));
    // Focusable so keyboard users can scroll and reach layout buttons (keeps an explicit tabindex).
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.handleResize());
      ro.observe(canvas);
      this.cleanups.push(() => ro.disconnect());
    } else {
      this.listen(window, 'resize', () => this.handleResize());
    }

    this.handleResize();
    whenFontsReady().then(() => {
      if (!this.destroyed) this.assignTargets();
    });
    this.refreshTargets();

    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.renderFrame);
  }

  /** Current resolved options (read-only snapshot). */
  getOptions(): Readonly<ResolvedOptions> {
    return this.o;
  }

  /** Current particle count. */
  get particleCount(): number {
    return this.pool.count;
  }

  /**
   * Update any subset of options. Only the options that changed trigger work:
   * content/density/font changes re-sample targets; everything else applies next frame.
   */
  setOptions(next: StarDustOptions): void {
    if (this.destroyed) return;
    const prev = this.o;
    const o = mergeOptions(prev, next);
    this.o = o;

    if (
      o.freeDrift !== prev.freeDrift ||
      o.physics.autoDissolveSec !== prev.physics.autoDissolveSec ||
      o.layoutAutoDissolve !== prev.layoutAutoDissolve
    ) {
      this.resetIdleDissolve();
    }
    if (o.physics.cursorMode !== prev.physics.cursorMode || o.manageCursor !== prev.manageCursor) {
      this.updateCursor();
    }

    const needsRetarget =
      o.text !== prev.text ||
      o.targetMode !== prev.targetMode ||
      o.imageSrc !== prev.imageSrc ||
      o.invertImageContrast !== prev.invertImageContrast ||
      !sameTuning(o.imageTuning, prev.imageTuning) ||
      o.layoutAst !== prev.layoutAst ||
      o.layoutLeftInset !== prev.layoutLeftInset ||
      o.collapsedMindMapIds !== prev.collapsedMindMapIds ||
      PALETTE_THEMES[o.palette].isDark !== PALETTE_THEMES[prev.palette].isDark ||
      o.freeDrift !== prev.freeDrift ||
      o.physics.density !== prev.physics.density ||
      o.physics.fontStyle !== prev.physics.fontStyle ||
      (o.targetMode === 'layout' &&
        (o.layoutOverflow !== prev.layoutOverflow ||
          o.layoutMinFontSize !== prev.layoutMinFontSize ||
          o.layoutParticleBudget !== prev.layoutParticleBudget ||
          o.layoutWindow !== prev.layoutWindow ||
          o.mindMapFit !== prev.mindMapFit ||
          o.mindMapMaxScale !== prev.mindMapMaxScale ||
          !samePadding(
            resolveLayoutPadding(o.layoutPadding, this.size.width, this.size.height),
            resolveLayoutPadding(prev.layoutPadding, this.size.width, this.size.height)
          )));

    if (o.layoutAst !== prev.layoutAst || o.targetMode !== prev.targetMode) {
      this.setKeyboardFocus(-1);
    }
    if (
      o.layoutAst !== prev.layoutAst ||
      o.targetMode !== prev.targetMode ||
      o.text !== prev.text ||
      o.imageSrc !== prev.imageSrc
    ) {
      this.shapeChanged = true;
    }
    if (o.layoutAst !== prev.layoutAst) {
      this.mmExpanded.clear();
      this.mmCollapsed.clear();
      this.mmShownCollapsed.clear();
      this.mmPages.clear();
    }
    if (needsRetarget && this.supported) {
      this.refreshTargets();
    }
  }

  /** Blow the current formation apart with a left-to-right gust of wind. */
  scatter(): void {
    if (!this.supported || this.destroyed) return;
    this.resetIdleDissolve();
    const { width } = this.size;
    const pool = this.pool;
    const now = performance.now();
    const safeW = Math.max(1, width);
    const { x, hasTarget, windReleaseAt, gravityBreakUntil } = pool;

    for (let i = 0; i < pool.count; i++) {
      const normX = Math.max(0, Math.min(1, x[i] / safeW));
      const delay = normX * 260 + Math.random() * 55;
      windReleaseAt[i] = now + delay;
      if (hasTarget[i]) {
        gravityBreakUntil[i] = now + delay + 460 + Math.random() * 320;
      }
    }
  }

  /** Reset the idle auto-dissolve timer, as if the user had just interacted. */
  markActivity(): void {
    this.resetIdleDissolve();
  }

  /** Current layout scroll offset in px (0 when the layout fits). */
  get scrollTop(): number {
    return this.scrollPos;
  }

  /** Largest possible layout scroll offset in px (0 when the layout fits). */
  get scrollHeight(): number {
    return this.scrollLimit;
  }

  /**
   * Clickable layout regions (`<Button>`s, collapsible mind-map nodes) in canvas CSS px, at the current
   * scroll position. Useful for overlaying accessible DOM controls.
   */
  get layoutHitRegions(): readonly LayoutHitRegion[] {
    return this.hitRegions.filter((r) => this.isInBand(r));
  }

  /**
   * The on-screen band (canvas px) where layout content is currently drawn, or null when the whole
   * layout is drawn. Useful for placing a scroll hint or fade below it.
   */
  get layoutBand(): LayoutBandBounds | null {
    return this.layoutWindow ? this.layoutWindow.band(this.scrollPos) : null;
  }

  /**
   * Scroll a layout that overflows the canvas (smooth by default). Formed text moves with the scroll;
   * content leaving the screen dissolves and its particles re-form the content coming in.
   */
  scrollTo(top: number, options: { smooth?: boolean } = {}): void {
    if (this.destroyed) return;
    this.scrollGoal = Math.max(0, Math.min(this.scrollLimit, top));
    if (options.smooth === false) this.applyScroll(this.scrollGoal - this.scrollPos);
  }

  /** Scroll by a relative amount (see `scrollTo`). */
  scrollBy(dy: number, options: { smooth?: boolean } = {}): void {
    this.scrollTo(this.scrollGoal + dy, options);
  }

  /** Stop the animation loop, remove all listeners and release GPU resources. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.targetToken++;
    cancelAnimationFrame(this.rafId);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this.targetDebounce) clearTimeout(this.targetDebounce);
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
    this.renderer?.dispose();
    this.renderer = null;
  }

  // ---------------------------------------------------------------------------

  private listen(
    target: EventTarget,
    type: string,
    fn: (e: Event) => void,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, fn, options);
    this.cleanups.push(() => target.removeEventListener(type, fn, options));
  }

  /** Whether a hit region is inside the drawn band (buttons outside it are invisible, so not clickable). */
  private isInBand(r: LayoutHitRegion): boolean {
    if (!this.layoutWindow) return true;
    const band = this.layoutWindow.band(this.scrollPos);
    const cy = r.y + r.height * 0.5;
    return cy >= band.top - 2 && cy <= band.bottom + 2;
  }

  private canScroll(): boolean {
    return this.o.targetMode === 'layout' && !this.o.freeDrift && this.scrollLimit > 0;
  }

  /** Move the content by `dy` px: shift particle targets and hit/ripple regions; particles follow on their springs. */
  private applyScroll(dy: number): void {
    if (dy === 0) return;
    this.scrollPos += dy;
    // Formed text moves with the scroll (fully when layoutScrollTrail is 0: crisp, like a page) and
    // springs the rest of the way; content entering or leaving the window dissolves and re-forms
    // (LayoutWindow.update below).
    const trail = Math.max(0, Math.min(1, this.o.layoutScrollTrail));
    const carry = dy * (1 - trail);
    const { count, hasTarget, ty, y } = this.pool;
    for (let i = 0; i < count; i++) {
      if (hasTarget[i] === 1 && !this.hints.isHint(i)) {
        ty[i] -= dy;
        y[i] -= carry;
      }
    }
    for (const r of this.hitRegions) r.y -= dy;
    for (const r of this.rippleRegions) {
      r.y -= dy;
      r.cy -= dy;
    }
    this.layoutWindow?.update(this.pool, this.scrollPos, performance.now());
    this.resetIdleDissolve();
    this.o.onScroll?.(this.scrollPos, this.scrollLimit);
  }

  private updateScrollHints(time: number, now: number): void {
    const w = this.layoutWindow;
    if (!this.o.layoutScrollHint || !w || !this.canScroll()) {
      this.hints.clear(this.pool, now);
      return;
    }
    const band = w.band(this.scrollPos);
    this.hints.update(
      this.pool,
      {
        centerX: w.centerX,
        bandTop: band.top,
        bandBottom: band.bottom,
        canvasHeight: this.size.height,
        showDown: this.scrollGoal < this.scrollLimit - 1,
        showUp: this.scrollGoal > 1,
      },
      time,
      now
    );
  }

  /** Scroll roughly one band in a direction (used by the hint chevrons). */
  private pageScroll(dir: 1 | -1): void {
    const band = this.layoutWindow?.band(this.scrollPos);
    const step = band ? Math.max(120, (band.bottom - band.top) * 0.8) : this.size.height * 0.8;
    this.scrollBy(dir * step);
  }

  /** A layout button was clicked or pressed: glow, shockwave, sound, then `onLayoutAction`. */
  private activateHit(hit: LayoutHitRegion): void {
    const pool = this.pool;
    for (let i = 0; i < pool.count; i++) {
      if (pool.regionId[i] === hit.rippleRegionId) {
        pool.energy[i] = 1;
      }
    }
    this.shockwaves.push({
      x: hit.x + hit.width * 0.5,
      y: hit.y + hit.height * 0.5,
      radius: 10,
      maxRadius: Math.max(130, hit.width * 0.9),
      alpha: 0.42,
    });
    this.o.onSoundImpulse?.(0.7, (hit.x + hit.width * 0.5) / Math.max(1, this.size.width));
    this.toggleMindMapNode(hit.action);
    this.o.onLayoutAction?.(hit.action, hit);
    this.openLink(hit.action);
  }

  /** `open:<url>` actions open in a new tab (http, https, mailto, tel only). */
  private openLink(action: string): void {
    if (!this.o.openLinks || !action.startsWith('open:') || typeof window === 'undefined') return;
    let url: URL;
    try {
      url = new URL(action.slice('open:'.length).trim(), window.location.href);
    } catch {
      return;
    }
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return;
    window.open(url.href, '_blank', 'noopener,noreferrer');
  }

  /**
   * Engine-managed mind maps: `mindmap:toggle:<id>` opens or closes a node; `mindmap:page:<id>:next|prev`
   * shows the next or previous set of a paged branch's children.
   */
  private toggleMindMapNode(action: string): void {
    if (this.o.collapsedMindMapIds !== undefined) return;
    const page = /^mindmap:page:(.+):(next|prev)$/.exec(action);
    if (page) {
      const [, id, dir] = page;
      const current = this.mmPages.get(id) ?? 0;
      this.mmPages.set(id, Math.max(0, current + (dir === 'next' ? 1 : -1)));
      if (this.supported) this.refreshTargets();
      return;
    }
    const prefix = 'mindmap:toggle:';
    if (!action.startsWith(prefix)) return;
    const id = action.slice(prefix.length);
    if (!id) return;
    this.mmPages.delete(id); // a re-opened branch starts on its first page
    if (this.mmShownCollapsed.has(id)) {
      this.mmCollapsed.delete(id);
      this.mmExpanded.set(id, ++this.mmClock);
    } else {
      this.mmExpanded.delete(id);
      this.mmCollapsed.add(id);
    }
    if (this.supported) this.refreshTargets();
  }

  /** Highlight a layout button for keyboard users (reuses the hover glow); -1 clears it. */
  private setKeyboardFocus(rippleRegionId: number): void {
    if (this.kbFocusId === rippleRegionId) return;
    const hadFocus = this.kbFocusId >= 0;
    this.kbFocusId = rippleRegionId;
    if (rippleRegionId >= 0 || hadFocus) {
      this.hoveredRegionId = rippleRegionId;
      this.syncHover(rippleRegionId >= 0);
    }
  }

  /** Scroll just enough that a region sits inside the clear band. */
  private scrollIntoBand(r: LayoutHitRegion): void {
    if (!this.canScroll()) return;
    const band = this.layoutWindow?.band(this.scrollPos) ?? { top: 0, bottom: this.size.height };
    const pad = 24;
    if (r.y < band.top + pad) {
      this.scrollTo(this.scrollGoal + r.y - (band.top + pad));
    } else if (r.y + r.height > band.bottom - pad) {
      this.scrollTo(this.scrollGoal + r.y + r.height - (band.bottom - pad));
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const layout = this.o.targetMode === 'layout' && !this.o.freeDrift;
    if (!layout) return;

    // Tab / Shift+Tab: step through layout buttons in reading order; leave the canvas at either end.
    if (e.key === 'Tab') {
      const order = this.hitRegions
        .slice()
        .sort((a, b) => (Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x));
      if (order.length === 0) return;
      const cur = order.findIndex((r) => r.rippleRegionId === this.kbFocusId);
      const next = cur === -1 ? (e.shiftKey ? order.length - 1 : 0) : cur + (e.shiftKey ? -1 : 1);
      if (next < 0 || next >= order.length) {
        this.setKeyboardFocus(-1);
        return;
      }
      e.preventDefault();
      this.setKeyboardFocus(order[next].rippleRegionId);
      this.scrollIntoBand(order[next]);
      return;
    }

    if (e.key === 'Escape') {
      this.setKeyboardFocus(-1);
      return;
    }

    // Enter / Space on a focused button activates it.
    if ((e.key === 'Enter' || e.key === ' ') && this.kbFocusId >= 0) {
      const hit = this.hitRegions.find((r) => r.rippleRegionId === this.kbFocusId);
      if (hit) {
        e.preventDefault();
        this.activateHit(hit);
        return;
      }
    }

    if (!this.canScroll()) return;
    const band = this.layoutWindow?.band(this.scrollPos);
    const page = band ? Math.max(120, (band.bottom - band.top) * 0.85) : this.size.height * 0.85;
    let goal: number | null = null;
    switch (e.key) {
      case 'ArrowDown':
        goal = this.scrollGoal + 48;
        break;
      case 'ArrowUp':
        goal = this.scrollGoal - 48;
        break;
      case 'PageDown':
        goal = this.scrollGoal + page;
        break;
      case 'PageUp':
        goal = this.scrollGoal - page;
        break;
      case ' ':
        goal = this.scrollGoal + (e.shiftKey ? -page : page);
        break;
      case 'Home':
        goal = 0;
        break;
      case 'End':
        goal = this.scrollLimit;
        break;
    }
    if (goal === null) return;
    const clamped = Math.max(0, Math.min(this.scrollLimit, goal));
    // Like the wheel: at either end, let the key through so the host page can scroll.
    if (clamped === this.scrollGoal) return;
    e.preventDefault();
    this.scrollGoal = clamped;
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.canScroll() || e.ctrlKey) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.size.height * 0.9 : 1;
    const next = Math.max(0, Math.min(this.scrollLimit, this.scrollGoal + e.deltaY * unit));
    // At either end, let the event through so the host page can scroll.
    if (next === this.scrollGoal) return;
    e.preventDefault();
    this.scrollGoal = next;
  }

  private toLocal(e: PointerEvent): { lx: number; ly: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { lx: e.clientX - rect.left, ly: e.clientY - rect.top };
  }

  private handleResize(): void {
    if (this.destroyed) return;
    const canvas = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (
      width === this.size.width &&
      height === this.size.height &&
      dpr === this.size.dpr
    ) {
      return;
    }
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    this.size = { width, height, dpr };

    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.assignTargets();
    }, 80);
  }

  private updateCursor(): void {
    if (!this.o.manageCursor) return;
    this.canvas.style.cursor =
      this.hoveredRegionId >= 0 || this.hintHover
        ? 'pointer'
        : this.o.physics.cursorMode === 'off'
        ? 'default'
        : 'crosshair';
  }

  /** Called whenever hoveredRegionId may have changed. */
  private syncHover(_hovering: boolean): void {
    this.updateCursor();
    if (this.hoveredRegionId === this.reportedHoverId) return;
    this.reportedHoverId = this.hoveredRegionId;
    const region =
      this.hoveredRegionId >= 0
        ? this.hitRegions.find((r) => r.rippleRegionId === this.hoveredRegionId) ?? null
        : null;
    this.o.onHoverChange?.(region);
  }

  private resolveImage = (ref: string | undefined): string | null =>
    (this.o.resolveLayoutImage ?? defaultLayoutImageUrl)(ref, this.o.imageSrc);

  private resetIdleDissolve(): void {
    this.lastActivityAt = performance.now();
    this.dissolveStartedAt = null;
    this.dissolveFired = false;
  }

  /** Load whatever the current target needs (image, layout images, fonts), then re-sample. */
  private refreshTargets(): void {
    const token = ++this.targetToken;
    if (this.targetDebounce !== null) {
      clearTimeout(this.targetDebounce);
      this.targetDebounce = null;
    }
    const live = () => token === this.targetToken && !this.destroyed;
    const { targetMode, imageSrc, imageTuning, layoutAst } = this.o;

    const run = async () => {
      if (targetMode === 'image') {
        if (!imageSrc) {
          this.assignTargets();
          return;
        }
        if (this.loadedImage?.src === imageSrc) {
          const tuningChanged = !sameTuning(this.lastSampledTuning, imageTuning);
          this.lastSampledTuning = imageTuning;
          if (tuningChanged) {
            this.targetDebounce = setTimeout(() => {
              this.targetDebounce = null;
              if (live()) this.assignTargets();
            }, 35);
          } else {
            this.assignTargets();
          }
          return;
        }
        this.lastSampledTuning = imageTuning;
        try {
          const img = await loadImageElement(imageSrc);
          if (live()) {
            this.loadedImage = { src: imageSrc, img };
            this.assignTargets();
          }
        } catch {
          if (live()) this.o.onImageError?.();
        }
        return;
      }

      if (targetMode === 'layout') {
        await whenFontsReady();
        const rawRefs = collectLayoutImageRefs(layoutAst);
        const urls = Array.from(
          new Set(
            rawRefs
              .map((ref) => this.resolveImage(ref))
              .filter((url): url is string => !!url)
          )
        );
        const missing = urls.filter((url) => !this.layoutImageCache.has(url));
        if (missing.length > 0) {
          await Promise.all(
            missing.map(async (url) => {
              try {
                const img = await loadImageElement(url);
                this.layoutImageCache.set(url, img);
              } catch {
                // Skip unloadable image URLs gracefully without stalling layout
              }
            })
          );
        }
        if (live()) this.assignTargets();
        return;
      }

      await whenFontsReady();
      if (live()) this.assignTargets();
    };
    void run();
  }

  private assignTargets(): void {
    this.resetIdleDissolve();
    const { width, height } = this.size;
    if (width === 0 || height === 0) return;

    const currentPhysics = this.o.physics;
    const ambientCount = getAmbientCount(currentPhysics.density, width, height);

    let targets: SampledPoint[] = [];
    let fontSize = 72;
    let isImage = false;
    let layoutScrollLimit = 0;
    let windowed: LayoutWindow | null = null;
    this.hitRegions = [];
    this.rippleRegions = [];

    if (!this.o.freeDrift) {
      if (this.o.targetMode === 'image') {
        const cached = this.loadedImage;
        if (cached && cached.src === this.o.imageSrc) {
          const isDarkTheme = PALETTE_THEMES[this.o.palette].isDark;
          const sampledImg = sampleImageTargets(
            cached.img,
            width,
            height,
            currentPhysics.density,
            this.o.invertImageContrast,
            isDarkTheme,
            this.o.imageTuning
          );
          targets = sampledImg.points;
          for (let p = 0; p < targets.length; p++) {
            targets[p].regionId = 0;
          }
          this.rippleRegions = [
            {
              id: 0,
              tag: 'Stage',
              x: sampledImg.bounds.x,
              y: sampledImg.bounds.y,
              width: sampledImg.bounds.width,
              height: sampledImg.bounds.height,
              cx: sampledImg.bounds.x + sampledImg.bounds.width * 0.5,
              cy: sampledImg.bounds.y + sampledImg.bounds.height * 0.5,
            },
          ];
          this.imageCellSize = sampledImg.cellSize;
          isImage = true;
        }
      } else if (this.o.targetMode === 'layout') {
        const isDarkTheme = PALETTE_THEMES[this.o.palette].isDark;
        const sampledLayout = sampleLayoutScene(
          this.o.layoutAst,
          width,
          height,
          currentPhysics.density,
          currentPhysics.fontStyle,
          this.o.invertImageContrast,
          isDarkTheme,
          this.o.imageTuning,
          this.layoutImageCache,
          this.resolveImage,
          {
            leftInset: this.o.layoutLeftInset,
            collapsedMindMapIds: this.o.collapsedMindMapIds,
            mindMapExpanded: this.mmExpanded,
            mindMapCollapsed: this.mmCollapsed,
            mindMapPages: this.mmPages,
            mindMapFit: this.o.mindMapFit,
            mindMapMaxScale: this.o.mindMapMaxScale,
            padding: resolveLayoutPadding(this.o.layoutPadding, width, height),
            overflow: this.o.layoutOverflow,
            minFontSize: this.o.layoutMinFontSize,
            particleBudget: this.o.layoutParticleBudget,
            trim: this.o.layoutWindow === 'screen',
          }
        );
        this.hitRegions = sampledLayout.hitRegions;
        this.rippleRegions = sampledLayout.rippleRegions;
        this.mmShownCollapsed = new Set(sampledLayout.mindMapCollapsedIds);
        for (const id of sampledLayout.mindMapDroppedExpansions) this.mmExpanded.delete(id);
        layoutScrollLimit = sampledLayout.scrollMax;
        const windowMode = this.o.layoutWindow;
        if (windowMode !== 'screen' || layoutScrollLimit > 0) {
          // Particles go only to what is in the band/screen (see LayoutWindow).
          const pad = resolveLayoutPadding(this.o.layoutPadding, width, height);
          windowed = new LayoutWindow(
            sampledLayout.points,
            sampledLayout.screenBudget,
            sampledLayout.priorityRegionIds,
            height,
            typeof windowMode === 'number' ? Math.max(40, windowMode) : windowMode,
            { top: pad.top, bottom: height - pad.bottom }
          );
          layoutScrollLimit = Math.max(layoutScrollLimit, windowed.scrollEnd());
        } else {
          targets = sampledLayout.points;
        }
        // Keep the scroll position across re-samples (clamped to the new range); the scene comes
        // back at scroll 0, so shift its regions to the current offset (the window handles points).
        const off = Math.min(this.scrollPos, layoutScrollLimit);
        if (off > 0) {
          for (const r of this.hitRegions) r.y -= off;
          for (const r of this.rippleRegions) {
            r.y -= off;
            r.cy -= off;
          }
        }
        this.imageCellSize = sampledLayout.cellSize;
        fontSize = 36;
        if (
          this.hoveredRegionId >= 0 &&
          !sampledLayout.hitRegions.some(
            (r) => r.rippleRegionId === this.hoveredRegionId
          )
        ) {
          this.hoveredRegionId = -1;
          this.syncHover(false);
        }
      } else if (this.o.text.trim()) {
        const sampled = sampleTextTargets(
          this.o.text,
          width,
          height,
          currentPhysics.fontStyle,
          currentPhysics.density
        );
        targets = sampled.points;
        for (let p = 0; p < targets.length; p++) {
          targets[p].regionId = 0;
        }
        this.rippleRegions = [
          {
            id: 0,
            tag: 'Stage',
            x: sampled.bounds.x,
            y: sampled.bounds.y,
            width: sampled.bounds.width,
            height: sampled.bounds.height,
            cx: sampled.bounds.x + sampled.bounds.width * 0.5,
            cy: sampled.bounds.y + sampled.bounds.height * 0.5,
          },
        ];
        fontSize = sampled.fontSize;
      }
    } else {
      this.hoveredRegionId = -1;
      this.syncHover(false);
    }

    this.glyphFontSize = fontSize;

    const prevScroll = this.scrollPos;
    this.scrollLimit = layoutScrollLimit;
    this.scrollPos = Math.min(this.scrollPos, layoutScrollLimit);
    this.scrollGoal = Math.min(this.scrollGoal, layoutScrollLimit);
    if (this.scrollPos !== prevScroll) this.o.onScroll?.(this.scrollPos, this.scrollLimit);

    const bgRatio = isImage || this.o.targetMode === 'layout' ? 0.34 : 0.6;
    const targetCount = windowed ? windowed.poolNeed : targets.length;
    const bgCount = targetCount > 0 ? Math.round(ambientCount * bgRatio) : ambientCount;
    const pool = this.pool;
    const fromWave = this.lastAssignFree && !this.o.freeDrift;
    // formFlowMs: a new shape (or leaving the wave) melts into the Perlin wind, then condenses.
    const flow =
      this.o.formFlowMs > 0 &&
      this.hasAssigned &&
      !this.o.freeDrift &&
      (this.lastAssignFree || this.shapeChanged);
    this.shapeChanged = false;
    this.hasAssigned = true;
    // Don't drop particles mid-flow: they're the old shape's dust, now riding the wind.
    const desiredTotal = flow ? Math.max(targetCount + bgCount, pool.count) : targetCount + bgCount;

    resizeParticlePool(pool, desiredTotal, width, height);
    // Scene to scene: remember which particles made up the old shape, and their look, so the ones the
    // new shape doesn't use can dissolve with the rest instead of vanishing at once.
    const oldShape = flow && !fromWave ? pool.hasTarget.slice(0, pool.count) : null;
    const oldAlpha = oldShape ? pool.baseAlpha.slice(0, pool.count) : null;

    if (this.vertexData.length < desiredTotal * FLOATS_PER_VERTEX) {
      this.vertexData = new Float32Array(
        Math.ceil(desiredTotal * 1.25) * FLOATS_PER_VERTEX
      );
    }

    this.layoutWindow = windowed;
    this.hints.reset(pool.capacity);
    if (windowed) {
      windowed.assignAll(pool, this.scrollPos, width, height);
    } else {
      assignTargetsByProximity(
        pool,
        targets,
        width,
        height,
        fontSize,
        isImage || this.o.targetMode === 'layout'
      );
    }
    this.lastAssignFree = this.o.freeDrift;
    const stagger = !flow && fromWave && this.o.formStaggerMs > 0;
    this.staggerJoins(stagger ? this.o.formStaggerMs : 0);
    pool.flowPhantom.fill(0, 0, pool.count);
    if (oldShape && oldAlpha) {
      for (let i = 0; i < oldShape.length; i++) {
        if (!oldShape[i] || pool.hasTarget[i]) continue;
        // Unused by the new shape: hold where it is (a target on itself), then dissolve.
        pool.flowPhantom[i] = 1;
        pool.hasTarget[i] = 1;
        pool.tx[i] = pool.x[i];
        pool.ty[i] = pool.y[i];
        pool.regionId[i] = -1;
        pool.isFringe[i] = 0;
        pool.baseAlpha[i] = oldAlpha[i];
      }
    }
    this.scheduleCondense(flow ? this.o.formFlowMs : 0, fromWave);
    if (stagger || (flow && fromWave)) {
      // Leaving the wave: keep the wave visible and dim it gradually (see pourMix in renderFrame).
      // Scene to scene the background stays at its scene brightness; only particles in flight are
      // kept visible (dimTransit is off while a flow is active).
      this.pourStartedAt = performance.now();
      this.pourSpanMs = flow ? this.o.formFlowMs : this.o.formStaggerMs;
    } else if (!this.o.freeDrift) {
      this.pourStartedAt = 0;
    }
    this.o.onParticleCountChange?.(pool.count);
  }

  /**
   * formFlowMs timing per particle. Leaving a shape, each particle lets go at a random moment in the
   * first part of the span (so the shape erodes grain by grain, not in wind-sized chunks); leaving the
   * wave, all let go at once (the wave is already moving). Each then rides the wind for a while before
   * condensing into its new place, or, for old-shape particles the new one doesn't use, turning into
   * ambient dust. `spanMs` 0 ends any flow.
   */
  private scheduleCondense(spanMs: number, fromWave = false): void {
    const { count, hasTarget, condenseAt, releaseAt } = this.pool;
    if (!(spanMs > 0)) {
      this.flowStartedAt = 0;
      condenseAt.fill(0, 0, count);
      releaseAt.fill(0, 0, count);
      return;
    }
    const now = performance.now();
    this.flowStartedAt = now;
    this.flowSpanMs = spanMs;
    for (let i = 0; i < count; i++) {
      if (!hasTarget[i]) {
        condenseAt[i] = 0;
        releaseAt[i] = 0;
        continue;
      }
      const release = fromWave ? now : now + spanMs * FLOW_RELEASE_SHARE * Math.random();
      releaseAt[i] = release;
      condenseAt[i] = Math.min(now + spanMs, release + spanMs * (0.35 + 0.3 * Math.random()));
    }
  }

  /**
   * Spread out when targeted particles leave the wave (`formStaggerMs`): nearest to their place first,
   * so the shape fills in from where the wave touches it. `spanMs` 0 releases everything now.
   */
  private staggerJoins(spanMs: number): void {
    const { count, hasTarget, joinAt, x, y, tx, ty } = this.pool;
    if (!(spanMs > 0)) {
      joinAt.fill(0, 0, count);
      return;
    }
    const idx: number[] = [];
    const dist: number[] = [];
    for (let i = 0; i < count; i++) {
      joinAt[i] = 0;
      if (!hasTarget[i]) continue;
      idx.push(i);
      // A little noise so the release front is soft rather than a sharp circle.
      dist.push(Math.hypot(x[i] - tx[i], y[i] - ty[i]) * (0.85 + Math.random() * 0.3));
    }
    const order = idx.map((_, k) => k).sort((a, b) => dist[a] - dist[b]);
    const now = performance.now();
    const last = Math.max(1, order.length - 1);
    order.forEach((k, rank) => {
      joinAt[idx[k]] = now + (rank / last) * spanMs;
    });
  }

  private renderFrame = (now: number): void => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.renderFrame);
    const startTime = this.startTime;
    const { width, height, dpr } = this.size;
    const activeRenderer = this.renderer;
    if (width === 0 || height === 0 || !activeRenderer) return;

    const time = (now - startTime) * 0.001;

    if (this.scrollGoal !== this.scrollPos) {
      const remaining = this.scrollGoal - this.scrollPos;
      const ease = this.touchScroll?.active ? 0.5 : 0.22;
      this.applyScroll(Math.abs(remaining) < 0.5 ? remaining : remaining * ease);
    }
    this.updateScrollHints(time, now);
    const currentPhysics = this.o.physics;
    const currentPalette = this.o.palette;
    const themeMeta = PALETTE_THEMES[currentPalette];
    const isDark = themeMeta.isDark;
    const isReduced = this.reducedMotion;
    const isFree = this.o.freeDrift;
    const ptr = this.pointer;

    ptr.vx *= 0.85;
    ptr.vy *= 0.85;

    const targetParX = ptr.active ? (ptr.x / width - 0.5) * 2 : 0;
    const targetParY = ptr.active ? (ptr.y / height - 0.5) * 2 : 0;
    this.parallax.x += (targetParX - this.parallax.x) * 0.045;
    this.parallax.y += (targetParY - this.parallax.y) * 0.045;

    const wakeNodes = this.wakeNodes;
    while (wakeNodes.length > 0 && now - wakeNodes[0].bornAt > 650) {
      wakeNodes.shift();
    }

    // Advance expanding shockwaves
    const waves = this.shockwaves;
    this.shockUniforms.length = 0;
    for (let w = waves.length - 1; w >= 0; w--) {
      const wave = waves[w];
      wave.radius += (wave.maxRadius - wave.radius) * 0.09 + 2.5;
      wave.alpha *= 0.92;
      if (wave.alpha < 0.01 || wave.radius >= wave.maxRadius) {
        waves.splice(w, 1);
        continue;
      }
      this.shockUniforms.push({
        x: wave.x,
        y: wave.y,
        radius: wave.radius,
        alpha: wave.alpha,
      });
    }

    const pool = this.pool;
    const count = pool.count;
    const vData = this.vertexData;
    const lut = getPaletteLut(currentPalette);

    const {
      x,
      y,
      vx,
      vy,
      tx,
      ty,
      hasTarget,
      size,
      baseAlpha,
      phase,
      wanderSpeed,
      energy,
      waveLayer,
      waveU,
      waveV,
      depth,
      depthPlane,
      mass,
      colorSeed,
      isFringe,
      regionId,
      gravityBreakUntil,
      windReleaseAt,
      joinAt,
      condenseAt,
      releaseAt,
      flowPhantom,
    } = pool;

    const turb = (isReduced ? 0.18 : 1) * currentPhysics.turbulence;
    const cohesion = isReduced ? Math.max(0.08, currentPhysics.cohesion) : currentPhysics.cohesion;
    const pointerRadius = currentPhysics.cursorMode === 'breeze' ? 168 : 134;
    const pointerRadiusSq = pointerRadius * pointerRadius;
    const holdEngaged = ptr.down;

    const waveDriftSpeed = (isReduced ? 0.004 : 0.013) * turb;
    const wavePull = isFree ? 0.015 : 0.009;
    const halfWidth = width * 0.5;
    const speedScale = isReduced ? 0.25 : 1;

    // Density-calibrated alpha prevents additive whiteout at 25k-50k particles
    const waveAlphaScale = isDark
      ? currentPhysics.density === 'dense'
        ? 0.34
        : currentPhysics.density === 'balanced'
        ? 0.46
        : 0.68
      : 0.85;

    const isImageStage = this.o.targetMode === 'image' && !isFree;
    const isLayoutStage = this.o.targetMode === 'layout' && !isFree;
    const isCompositeStage = isImageStage || isLayoutStage;
    // Scrollable layouts hand particles across the screen as content scrolls; keep those in transit
    // faint so text re-forms out of a soft drift instead of an additive white flare.
    // While the wave pours into a shape (formStaggerMs) the pour should be seen: particles still waiting
    // keep their wave brightness, the rest of the wave dims gradually instead of at once, and particles
    // in flight stay visible. `pourMix` goes 0 → 1 over the pour plus a short settle.
    const pourMix =
      this.pourStartedAt > 0 && !isFree
        ? Math.min(1, (now - this.pourStartedAt) / (this.pourSpanMs + POUR_SETTLE_MS))
        : 1;
    // formFlowMs: particles in flight must stay visible for the whole flow.
    const flowInProgress =
      this.flowStartedAt > 0 &&
      !isFree &&
      now < this.flowStartedAt + this.flowSpanMs + FLOW_CONDENSE_MS;
    const dimTransit =
      isLayoutStage && this.layoutWindow !== null && pourMix >= 1 && !flowInProgress;
    const hoveredBtnId = this.hoveredRegionId;

    const glyphScale = isImageStage
      ? 0.48
      : isLayoutStage
      ? 0.56
      : Math.min(1, Math.max(0.45, this.glyphFontSize / 72));
    const glyphSizeScale = isImageStage
      ? Math.min(1.08, Math.max(0.76, this.imageCellSize * 0.45))
      : isLayoutStage
      ? 0.82
      : 0.56 + 0.44 * glyphScale;
    const fringeOrbitRadius = 0.7 + 1.9 * glyphScale;
    const smallTextBoost = isCompositeStage ? 1 : 1 + (1 - glyphScale) * 0.24;

    const textAlphaScale =
      (isDark
        ? currentPhysics.density === 'dense'
          ? isCompositeStage
            ? 0.72
            : 0.54
          : currentPhysics.density === 'balanced'
          ? isCompositeStage
            ? 0.86
            : 0.68
          : isCompositeStage
          ? 0.96
          : 0.82
        : isCompositeStage
        ? 0.96
        : 0.94) * smallTextBoost;

    const parX0 = isReduced ? 0 : this.parallax.x * 6;
    const parY0 = isReduced ? 0 : this.parallax.y * 4;
    const parX1 = isReduced ? 0 : this.parallax.x * 14;
    const parY1 = isReduced ? 0 : this.parallax.y * 9;

    const cursorEnabled = currentPhysics.cursorMode !== 'off';
    const wakeLen = isReduced || !cursorEnabled ? 0 : wakeNodes.length;

    // Prune expired interactive ripple pulses and pre-resolve per-region ripple parameters once per frame
    const ripplePulses = this.ripplePulses;
    for (let p = ripplePulses.length - 1; p >= 0; p--) {
      const maxAgeMs = ripplePulses[p].pattern === 'expand' ? 3400 : 2600;
      if (now - ripplePulses[p].bornAt > maxAgeMs) {
        ripplePulses.splice(p, 1);
      }
    }

    const globalRipple = this.o.ripple;
    const rRegions = this.rippleRegions;
    const resolvedRegions: ResolvedRegionRipple[] = [];
    let anyAmbientRipple = false;
    const motionDamp = isReduced ? 0.35 : 1;

    if (!isFree) {
      if (rRegions.length > 0) {
        for (let r = 0; r < rRegions.length; r++) {
          const reg = rRegions[r];
          const res = resolveRegionRipple(reg, globalRipple);
          if (res.allowAmbient) anyAmbientRipple = true;
          resolvedRegions.push({
            region: reg,
            pattern: res.pattern,
            allowAmbient: res.allowAmbient,
            allowHover: res.allowHover,
            allowClick: res.allowClick,
            strength: res.strength * motionDamp,
            speed: res.speed * (isReduced ? 0.45 : 1),
            wavelength: res.wavelength,
          });
        }
      } else {
        const fallbackReg: RippleRegion = {
          id: 0,
          tag: 'Stage',
          x: 0,
          y: 0,
          width,
          height,
          cx: width * 0.5,
          cy: height * 0.5,
        };
        const res = resolveRegionRipple(undefined, globalRipple);
        if (res.allowAmbient) anyAmbientRipple = true;
        resolvedRegions.push({
          region: fallbackReg,
          pattern: res.pattern,
          allowAmbient: res.allowAmbient,
          allowHover: res.allowHover,
          allowClick: res.allowClick,
          strength: res.strength * motionDamp,
          speed: res.speed * (isReduced ? 0.45 : 1),
          wavelength: res.wavelength,
        });
      }
    }
    const hasRippleField = !isFree && (anyAmbientRipple || ripplePulses.length > 0);
    const pulseCount = ripplePulses.length;
    const sweepAxisX = 0.9135;
    const sweepAxisY = 0.4067;

    // Evaluate configurable idle dissolve-into-wave progression
    const autoSec =
      this.o.targetMode === 'layout' && !this.o.layoutAutoDissolve ? 0 : currentPhysics.autoDissolveSec;
    let dissolveProgress = 0;
    if (!isFree && autoSec > 0 && count > 0) {
      if (this.dissolveStartedAt === null) {
        if (now - this.lastActivityAt >= autoSec * 1000) {
          this.dissolveStartedAt = now;
          this.dissolveFired = false;
          if (this.dissolveOrder.length < count) {
            this.dissolveOrder = new Float32Array(Math.ceil(count * 1.25));
          }
          const dOrder = this.dissolveOrder;
          const dCx = width * 0.5;
          const dCy = height * 0.5;
          const invMaxR = 1 / Math.max(120, Math.hypot(width, height) * 0.38);
          for (let k = 0; k < count; k++) {
            if (hasTarget[k] === 1) {
              const rNorm = Math.min(1, Math.hypot(tx[k] - dCx, ty[k] - dCy) * invMaxR);
              const breezeBias =
                (1 - Math.max(0, Math.min(1, tx[k] / Math.max(1, width)))) * 0.22;
              const fringeBias = isFringe[k] === 1 ? -0.16 : 0;
              const raw = (1 - rNorm) * 0.38 + breezeBias + Math.random() * 0.36 + fringeBias;
              dOrder[k] = Math.max(0, Math.min(0.76, raw));
            } else {
              dOrder[k] = 0;
            }
          }
        }
      }
      if (this.dissolveStartedAt !== null) {
        const elapsedSec = (now - this.dissolveStartedAt) / 1000;
        dissolveProgress = Math.min(1, elapsedSec / 4.5);
      }
    } else {
      this.dissolveStartedAt = null;
      this.dissolveFired = false;
    }

    const dOrder = this.dissolveOrder;
    const isDissolving = dissolveProgress > 0;
    const usePerlinWind = currentPhysics.perlinFlow && (isFree || isDissolving);
    const flowActive =
      this.flowStartedAt > 0 &&
      !isFree &&
      now < this.flowStartedAt + this.flowSpanMs + FLOW_CONDENSE_MS;
    const windField = this.perlinWind;
    if (usePerlinWind || flowActive) {
      windField.update(width, height, time);
    }

    let speedSum = 0;
    let energySum = 0;

    for (let i = 0; i < count; i++) {
      let px = x[i];
      let py = y[i];
      let pvx = vx[i];
      let pvy = vy[i];
      let pEnergy = energy[i];
      const pPhase = phase[i];
      const pMass = mass[i];
      const pLayer = waveLayer[i];
      // A targeted particle still waiting its turn (formStaggerMs) keeps moving with the wave.
      const isGlyph = hasTarget[i] === 1 && !isFree && now >= joinAt[i];
      // formFlowMs: how much this particle is still riding the wind (1) vs settled in its shape (0).
      let pFlowMix = 0;

      // Staggered directional wind erosion gust
      const releaseTime = windReleaseAt[i];
      if (releaseTime > 0 && now >= releaseTime) {
        windReleaseAt[i] = 0;
        const gust = ((2.4 + Math.random() * 4.4) * speedScale) / pMass;
        pvx += gust;
        pvy += (-0.55 + Math.sin(py * 0.018 + pPhase) * 1.45) * speedScale;
        pEnergy = Math.min(1, pEnergy + 0.65);
      }

      const flowAngle =
        Math.sin(px * 0.0021 + time * 0.23 + pPhase * 0.1) * 1.7 +
        Math.cos(py * 0.0021 - time * 0.19 + pPhase * 0.08) * 1.7;

      const thermalDriftY = (pMass - 0.98) * 0.0085 * turb;

      let crestShift = 0;
      let meltBlend = 0;

      if (isGlyph) {
        if (isDissolving) {
          const startT = i < dOrder.length ? dOrder[i] : 0;
          const rawM = Math.max(0, Math.min(1, (dissolveProgress - startT) / 0.24));
          meltBlend = rawM * rawM * (3 - 2 * rawM);
        }

        if (now < gravityBreakUntil[i] && meltBlend < 0.5) {
          pvx += Math.cos(flowAngle) * 0.024 * turb;
          pvy += (Math.sin(flowAngle) * 0.024 + thermalDriftY) * turb;
          pvx *= 0.945;
          pvy *= 0.945;
        } else {
          let glyphVx = pvx;
          let glyphVy = pvy;

          if (meltBlend < 0.999) {
            const preMelt = isDissolving
              ? Math.min(1, dissolveProgress / Math.max(0.08, (dOrder[i] ?? 0.2) + 0.08))
              : 0;
            const localCohesion = cohesion * (1 - preMelt * 0.35) * (1 - meltBlend);

            if (isFringe[i] === 1) {
              const haloX = tx[i] + Math.cos(time * 0.52 + pPhase) * fringeOrbitRadius;
              const haloY = ty[i] + Math.sin(time * 0.44 + pPhase) * fringeOrbitRadius;
              const dx = haloX - px;
              const dy = haloY - py;
              const dist = Math.hypot(dx, dy);
              const gain = (localCohesion * 1.25) / (1 + dist * 0.032);
              const damp = 0.82 + 0.08 * (1 - Math.exp(-dist * 0.04));
              glyphVx = (pvx + dx * gain) * damp;
              glyphVy = (pvy + dy * gain) * damp;
            } else {
              let anchorX = tx[i];
              let anchorY = ty[i];

              if (hasRippleField && meltBlend < 0.7) {
                const rIdx =
                  regionId[i] >= 0 && regionId[i] < resolvedRegions.length ? regionId[i] : 0;
                const rCfg = resolvedRegions[rIdx];
                let rx = 0;
                let ry = 0;

                if (rCfg && rCfg.allowAmbient && rCfg.pattern !== 'off') {
                  const { region, pattern, strength, speed, wavelength } = rCfg;
                  const k = (Math.PI * 2) / wavelength;
                  const rdx = anchorX - region.cx;
                  const rdy = anchorY - region.cy;

                  if (pattern === 'ring') {
                    const rDist = Math.hypot(rdx, rdy);
                    const s = Math.sin(rDist * k - time * speed * 3.4);
                    const amp = strength * 3.8;
                    if (rDist > 0.5) {
                      const invD = 1 / rDist;
                      rx += rdx * invD * s * amp;
                      ry += rdy * invD * s * amp;
                    }
                    crestShift += s * Math.min(1.2, strength);
                  } else if (pattern === 'sweep') {
                    const proj = rdx * sweepAxisX + rdy * sweepAxisY;
                    const theta = proj * k - time * speed * 3.6;
                    const s = Math.sin(theta);
                    const amp = strength * 3.6;
                    rx +=
                      -sweepAxisY * s * amp * 0.78 + sweepAxisX * Math.cos(theta) * amp * 0.22;
                    ry +=
                      sweepAxisX * s * amp * 0.78 + sweepAxisY * Math.cos(theta) * amp * 0.22;
                    crestShift += s * Math.min(1.2, strength);
                  } else {
                    const rDist = Math.hypot(rdx, rdy);
                    const maxHalf = Math.max(40, Math.hypot(region.width, region.height) * 0.5);
                    const rNorm = Math.min(1.5, rDist / maxHalf);
                    const s = Math.sin(time * speed * 2.5 - rNorm * 1.55);
                    const amp = strength * 4.0 * (0.28 + 0.72 * Math.min(1, rNorm));
                    if (rDist > 0.5) {
                      const invD = 1 / rDist;
                      rx += rdx * invD * s * amp;
                      ry += rdy * invD * s * amp;
                    }
                    crestShift += s * Math.min(1.2, strength);
                  }
                }

                if (pulseCount > 0 && (!rCfg || rCfg.pattern !== 'off')) {
                  const pId = regionId[i];
                  for (let p = 0; p < pulseCount; p++) {
                    const pulse = ripplePulses[p];
                    if (pulse.regionId !== -1 && pulse.regionId !== pId) continue;

                    const ageSec = (now - pulse.bornAt) * 0.001;
                    const pdx = anchorX - pulse.x;
                    const pdy = anchorY - pulse.y;

                    if (pulse.pattern === 'expand') {
                      const front = ageSec * (245 * pulse.speed);
                      const band = Math.max(38, pulse.wavelength * 0.46);
                      const pDist = Math.hypot(pdx, pdy);
                      const delta = pDist - front;
                      if (Math.abs(delta) < band * 2.4) {
                        const fade = Math.exp(-ageSec * 0.85);
                        const crest = Math.exp(-(delta * delta) / (band * band * 0.44));
                        const echoDist = delta + band * 1.1;
                        const echo =
                          0.32 * Math.exp(-(echoDist * echoDist) / (band * band * 0.55));
                        const wave = crest - echo;
                        const amp = fade * pulse.power * 6.8 * motionDamp;
                        if (pDist > 0.5) {
                          rx += (pdx / pDist) * wave * amp;
                          ry += (pdy / pDist) * wave * amp;
                        }
                        crestShift += Math.max(0, crest) * fade * 1.35;
                      }
                    } else {
                      const front = ageSec * (195 * pulse.speed);
                      const band = Math.max(46, pulse.wavelength * 0.58);
                      const pDist =
                        pulse.pattern === 'sweep'
                          ? Math.abs(pdx * sweepAxisX + pdy * sweepAxisY)
                          : Math.hypot(pdx, pdy);

                      const delta = pDist - front;
                      if (Math.abs(delta) < band * 1.8) {
                        const env =
                          Math.exp(-ageSec * 1.45) *
                          Math.exp(-(delta * delta) / (band * band * 0.54));
                        const wave =
                          pulse.pattern === 'pulse'
                            ? 0.85
                            : Math.sin((delta / pulse.wavelength) * Math.PI * 2);
                        const amp = env * pulse.power * 5.2 * motionDamp;

                        if (pulse.pattern === 'sweep') {
                          rx += -sweepAxisY * wave * amp;
                          ry += sweepAxisX * wave * amp;
                        } else if (pDist > 0.5) {
                          const radDist = Math.hypot(pdx, pdy) || 1;
                          rx += (pdx / radDist) * wave * amp;
                          ry += (pdy / radDist) * wave * amp;
                        }
                        crestShift += Math.max(0, wave) * env * 1.15;
                      }
                    }
                  }
                }

                anchorX += rx * (1 - meltBlend);
                anchorY += ry * (1 - meltBlend);
              }

              const dx = anchorX - px;
              const dy = anchorY - py;
              const distSq = dx * dx + dy * dy;
              const speedSq = pvx * pvx + pvy * pvy;

              if (!hasRippleField && !isDissolving && distSq < 0.16 && speedSq < 0.025) {
                px = anchorX;
                py = anchorY;
                glyphVx = 0;
                glyphVy = 0;
              } else {
                const dist = Math.sqrt(distSq);
                const springMul = hasRippleField ? 2.15 : 1.75;
                const gain = (localCohesion * springMul) / (1 + dist * 0.032);
                const damp = hasRippleField
                  ? 0.72 + 0.1 * (1 - Math.exp(-dist * 0.04))
                  : 0.78 + 0.1 * (1 - Math.exp(-dist * 0.04));
                glyphVx = (pvx + dx * gain) * damp;
                glyphVy = (pvy + dy * gain) * damp;
              }
            }
          }

          if (meltBlend > 0.001) {
            let waveVx = pvx;
            let waveVy = pvy;
            const releaseCurl = meltBlend * (1 - meltBlend) * 0.11;
            const meltWindX = usePerlinWind ? windField.sampleX(px, py) : Math.cos(flowAngle);
            const meltWindY = usePerlinWind ? windField.sampleY(px, py) : Math.sin(flowAngle);
            if (pLayer >= 0) {
              let u = waveU[i] + waveDriftSpeed * 0.016 * (0.65 + depth[i] * 0.55);
              if (u >= 1) u -= 1;
              waveU[i] = u;

              const wavePt = computeWavePoint(u, waveV[i], pLayer, pPhase, time, width, height);
              let dx = wavePt.x - px;
              if (dx > halfWidth) dx -= width;
              else if (dx < -halfWidth) dx += width;

              const invMass = 1 / pMass;
              const activeWavePull = (usePerlinWind ? 0.009 : 0.014) * meltBlend;
              const windScale = usePerlinWind ? 0.068 * invMass : 0.028;
              waveVx += dx * activeWavePull * invMass;
              waveVy += (wavePt.y - py) * activeWavePull * invMass;
              waveVx += meltWindX * windScale * turb + releaseCurl;
              waveVy += meltWindY * windScale * turb + thermalDriftY;
              const airDrag = 0.875 + (pMass - 1) * 0.018;
              waveVx *= airDrag;
              waveVy *= airDrag;
            } else {
              const windScale = usePerlinWind
                ? (0.088 * turb * (0.68 + depth[i] * 0.64)) / pMass
                : (0.032 * turb * wanderSpeed[i]) / pMass;
              waveVx += meltWindX * windScale + releaseCurl;
              waveVy += meltWindY * windScale + thermalDriftY;
              waveVx *= 0.965;
              waveVy *= 0.965;
            }
            pvx = glyphVx * (1 - meltBlend) + waveVx * meltBlend;
            pvy = glyphVy * (1 - meltBlend) + waveVy * meltBlend;
          } else {
            pvx = glyphVx;
            pvy = glyphVy;
          }
        }

        // formFlowMs: ride the Perlin wind until this particle's condense time, then ease into place.
        // The pull to the new place is off from the first frame (otherwise particles start racing to
        // the new shape, overshoot on momentum and get scattered again: a double transition); what
        // ramps in is the wind, so the old shape melts where it stands.
        if (flowActive && releaseAt[i] > 0) {
          if (now < releaseAt[i]) {
            // Still part of the old shape: stay put (no pull to the new place yet).
            pvx = vx[i] * 0.8;
            pvy = vy[i] * 0.8;
          } else {
            const ride = Math.min(1, (now - releaseAt[i]) / FLOW_RAMP_IN_MS);
            const phantom = flowPhantom[i] === 1;
            if (phantom && now >= condenseAt[i]) {
              // An old-shape particle the new shape doesn't use: from here on it's ambient dust.
              flowPhantom[i] = 0;
              hasTarget[i] = 0;
            }
            const landT = phantom
              ? 0
              : Math.max(0, Math.min(1, (now - condenseAt[i]) / FLOW_CONDENSE_MS));
            const land = landT * landT * (3 - 2 * landT);
            const flowMix = 1 - land;
            pFlowMix = ride * flowMix;
            if (flowMix > 0.001) {
              const windScale =
                (ride * FLOW_GAIN * 0.088 * Math.max(0.35, turb) * (0.68 + depth[i] * 0.64)) / pMass;
              // Each particle also drifts its own way, so neighbours don't travel as one block.
              const spread = ride * FLOW_SPREAD;
              const ownX = Math.cos(pPhase * 7.3 + time * 0.6) * spread;
              const ownY = Math.sin(pPhase * 5.1 + time * 0.5) * spread;
              // Riding the wind: last frame's momentum plus the wind, without the pull to the target.
              const flowVx = (vx[i] + windField.sampleX(px, py) * windScale + ownX) * 0.965;
              const flowVy =
                (vy[i] + windField.sampleY(px, py) * windScale + ownY + thermalDriftY) * 0.965;
              pvx = pvx * (1 - flowMix) + flowVx * flowMix;
              pvy = pvy * (1 - flowMix) + flowVy * flowMix;
            }
          }
        }
      } else if (pLayer >= 0) {
        let u = waveU[i] + waveDriftSpeed * 0.016 * (0.65 + depth[i] * 0.55);
        if (u >= 1) u -= 1;
        waveU[i] = u;

        const wavePt = computeWavePoint(u, waveV[i], pLayer, pPhase, time, width, height);
        let dx = wavePt.x - px;
        if (dx > halfWidth) dx -= width;
        else if (dx < -halfWidth) dx += width;

        const invMass = 1 / pMass;
        const activePull = isFree && usePerlinWind ? wavePull * 0.52 : wavePull;
        pvx += dx * activePull * invMass;
        pvy += (wavePt.y - py) * activePull * invMass;
        if (isFree && usePerlinWind) {
          const windGain = 0.072 * turb * invMass;
          pvx += windField.sampleX(px, py) * windGain;
          pvy += windField.sampleY(px, py) * windGain + thermalDriftY;
        } else {
          pvx += Math.cos(flowAngle) * 0.024 * turb;
          pvy += Math.sin(flowAngle) * 0.024 * turb + thermalDriftY;
        }
        const airDrag = 0.865 + (pMass - 1) * 0.018;
        pvx *= airDrag;
        pvy *= airDrag;
      } else {
        if (isFree && usePerlinWind) {
          const depthWeight = 0.68 + depth[i] * 0.64;
          const windGain = (0.095 * turb * depthWeight) / pMass;
          pvx += windField.sampleX(px, py) * windGain;
          pvy += windField.sampleY(px, py) * windGain + thermalDriftY;
        } else {
          const driftForce = (0.028 * turb * wanderSpeed[i]) / pMass;
          pvx += Math.cos(flowAngle) * driftForce;
          pvy += Math.sin(flowAngle) * driftForce + thermalDriftY;
        }
        pvx *= 0.965;
        pvy *= 0.965;
      }

      // Fluid air wake trails from recent pointer sweeps
      if (wakeLen > 0) {
        for (let wn = wakeLen - 1; wn >= 0; wn--) {
          const node = wakeNodes[wn];
          const wdx = px - node.x;
          const wdy = py - node.y;
          const wDistSq = wdx * wdx + wdy * wdy;
          if (wDistSq < 7225) {
            const ageRatio = 1 - (now - node.bornAt) / 650;
            const distRatio = 1 - Math.sqrt(wDistSq) / 85;
            const wakeGain = (ageRatio * distRatio * 0.065) / pMass;
            pvx += node.vx * wakeGain;
            pvy += node.vy * wakeGain;
            pEnergy = Math.min(1, pEnergy + ageRatio * distRatio * 0.08);
          }
        }
      }

      // Pointer interaction forces (preserve hovered button legibility with glow boost instead of scatter)
      const isHoveredButton =
        isLayoutStage && hoveredBtnId >= 0 && regionId[i] === hoveredBtnId;
      if (isHoveredButton) {
        pEnergy = Math.max(pEnergy, 0.56);
      }

      if (ptr.active && cursorEnabled && !isHoveredButton) {
        const pdx = px - ptr.x;
        const pdy = py - ptr.y;
        const distSq = pdx * pdx + pdy * pdy;

        if (distSq < pointerRadiusSq && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const falloff = 1 - dist / pointerRadius;
          const nx = pdx / dist;
          const ny = pdy / dist;

          pEnergy = Math.min(1, pEnergy + falloff * 0.36);
          if (isGlyph) {
            gravityBreakUntil[i] = now + 420 + falloff * 480;
          }

          if (holdEngaged || currentPhysics.cursorMode === 'vortex') {
            const pullStrength = holdEngaged ? 1.5 : 0.72;
            const spinStrength = holdEngaged ? 2.05 : 1.1;
            pvx += (-nx * pullStrength - ny * spinStrength) * falloff;
            pvy += (-ny * pullStrength + nx * spinStrength) * falloff;
          } else if (currentPhysics.cursorMode === 'breeze') {
            const speedMag = Math.min(18, Math.hypot(ptr.vx, ptr.vy));
            const windX = speedMag > 0.5 ? ptr.vx * 0.22 : Math.cos(time * 0.9) * 0.55;
            const windY = speedMag > 0.5 ? ptr.vy * 0.22 : Math.sin(time * 0.9) * 0.55;
            pvx += (windX + nx * 0.52) * falloff;
            pvy += (windY + ny * 0.52) * falloff;
          } else {
            const push = falloff * falloff * 3.4;
            pvx += nx * push - ny * falloff * 0.5;
            pvy += ny * push + nx * falloff * 0.5;
          }
        }
      }

      px += pvx;
      py += pvy;
      pEnergy *= 0.93;

      if (!isGlyph || meltBlend > 0.85) {
        if (px < 0) px += width;
        else if (px >= width) px -= width;
        if (py < -16) py = height + 16;
        else if (py > height + 16) py = -16;
      }

      x[i] = px;
      y[i] = py;
      vx[i] = pvx;
      vy[i] = pvy;
      energy[i] = pEnergy;

      // Luminance twinkle & spectral color lookup
      const twinkle = isReduced
        ? 1
        : 0.8 + 0.2 * Math.sin(time * (0.42 + wanderSpeed[i] * 0.36) + pPhase);

      const normX = Math.max(0, Math.min(1, px / width));
      const ridgeFocus = pLayer >= 0 ? 1 - Math.min(1, Math.abs(waveV[i])) : 0.2;
      const cSeed = colorSeed[i];

      let hueT: number;
      let alphaWeight: number;

      const positiveCrest = crestShift > 0 ? Math.min(1.2, crestShift) : 0;

      // Compute background wave visual properties for non-glyphs and dissolving glyph blend
      const layerShift = pLayer === 0 ? 0.14 : pLayer === 1 ? -0.06 : 0.04;
      const waveHueT =
        pLayer >= 0
          ? Math.max(
              0,
              Math.min(
                1,
                normX * 0.72 +
                  ridgeFocus * 0.26 +
                  layerShift +
                  (cSeed - 0.5) * 0.14 +
                  pEnergy * 0.32
              )
            )
          : Math.max(0, Math.min(1, normX * 0.65 + cSeed * 0.35 + pEnergy * 0.24));

      const stageRibbonDim = isFree ? 1 : isCompositeStage ? 0.18 : 0.32;
      const stageDustDim = isFree ? 1 : isCompositeStage ? 0.42 : 0.65;
      // Waiting to leave the wave (formStaggerMs): still part of the wave, so full wave brightness.
      const waitingOnWave = hasTarget[i] === 1 && !isFree && now < joinAt[i];
      const stageMix = waitingOnWave ? 0 : pourMix;
      const baseRibbonStageDim = 1 + (stageRibbonDim - 1) * stageMix;
      const baseDustStageDim = 1 + (stageDustDim - 1) * stageMix;
      const ribbonStageDim =
        baseRibbonStageDim + (1 - baseRibbonStageDim) * dissolveProgress;
      const dustStageDim = baseDustStageDim + (1 - baseDustStageDim) * dissolveProgress;
      const waveAlpha =
        pLayer >= 0
          ? Math.min(1, (0.2 + ridgeFocus * 0.54 + pEnergy * 0.28) * ribbonStageDim * twinkle) *
            waveAlphaScale
          : Math.min(1, baseAlpha[i] * dustStageDim * twinkle + pEnergy * 0.22) *
            waveAlphaScale;

      if (isGlyph) {
        const isHoveredBtn =
          isLayoutStage && hoveredBtnId >= 0 && regionId[i] === hoveredBtnId;
        const glyphHue = isCompositeStage
          ? Math.min(
              1,
              0.34 +
                baseAlpha[i] * 0.58 +
                cSeed * 0.08 +
                pEnergy * 0.22 +
                positiveCrest * 0.18 +
                (isHoveredBtn ? 0.16 : 0)
            )
          : Math.min(
              1,
              0.54 + normX * 0.26 + cSeed * 0.16 + pEnergy * 0.2 + positiveCrest * 0.18
            );
        const glyphAlpha =
          Math.min(
            1,
            (baseAlpha[i] + pEnergy * 0.22 + positiveCrest * 0.16 + (isHoveredBtn ? 0.18 : 0)) *
              (isCompositeStage
                ? 0.96 + 0.04 * twinkle
                : isFringe[i]
                ? twinkle
                : 0.9 + 0.1 * twinkle)
          ) * textAlphaScale;

        hueT = glyphHue * (1 - meltBlend) + waveHueT * meltBlend;
        // Riding the wind (formFlowMs) it keeps the wave's colours, taking the shape's as it lands.
        if (pFlowMix > 0) hueT += (waveHueT - hueT) * pFlowMix;
        alphaWeight = glyphAlpha * (1 - meltBlend) + waveAlpha * meltBlend;
        // …and the wave's depth-varied brightness (undimmed: the streams are the subject while they
        // fly), flattening into the shape's as it lands.
        if (pFlowMix > 0) {
          const riderAlpha =
            pLayer >= 0
              ? Math.min(1, (0.2 + ridgeFocus * 0.54 + pEnergy * 0.28) * twinkle) * waveAlphaScale
              : Math.min(1, baseAlpha[i] * twinkle + pEnergy * 0.22) * waveAlphaScale;
          alphaWeight += (riderAlpha - alphaWeight) * pFlowMix;
        }
        if (dimTransit) {
          const far = Math.abs(tx[i] - px) + Math.abs(ty[i] - py);
          if (far > 12) alphaWeight *= 1 - 0.95 * Math.min(1, (far - 12) / 90);
        }
      } else {
        hueT = waveHueT;
        alphaWeight = waveAlpha;
      }

      const lutIdx = Math.min(255, Math.max(0, Math.floor(hueT * 255))) * 3;
      // How much a shape particle still looks like the 3D wave (depth layer, size, shimmer): while it
      // melts away, or while it rides the wind into a new shape (formFlowMs). 0 = flat in its shape.
      const waveLook = isGlyph ? Math.max(meltBlend, pFlowMix) : 1;
      const plane = isGlyph && waveLook < 0.5 ? 1 : depthPlane[i];
      const drawX = px + (plane === 0 ? parX0 : parX1);
      const drawY = py + (plane === 0 ? parY0 : parY1);

      const isHoveredBtnSize =
        isGlyph && isLayoutStage && hoveredBtnId >= 0 && regionId[i] === hoveredBtnId;
      const targetParticleScale = isGlyph ? glyphSizeScale * (1 - waveLook) + waveLook : 1;
      const baseOffset = i * FLOATS_PER_VERTEX;
      const speed = Math.hypot(pvx, pvy);
      speedSum += speed;
      energySum += pEnergy;
      const driftShimmer =
        isFree || !isGlyph
          ? 0.16 + positiveCrest * 0.24
          : Math.max(meltBlend * 0.42, pFlowMix * (0.16 + positiveCrest * 0.24));
      const motionGlow = Math.min(
        1.4,
        speed * 0.34 +
          pEnergy * 0.85 +
          positiveCrest * 0.25 +
          driftShimmer +
          (isHoveredBtnSize ? 0.28 * (1 - meltBlend) : 0)
      );
      vData[baseOffset + 0] = drawX;
      vData[baseOffset + 1] = drawY;
      vData[baseOffset + 2] = lut[lutIdx + 0];
      vData[baseOffset + 3] = lut[lutIdx + 1];
      vData[baseOffset + 4] = lut[lutIdx + 2];
      vData[baseOffset + 5] = Math.min(1, alphaWeight);
      vData[baseOffset + 6] =
        size[i] * targetParticleScale +
        pEnergy * 0.12 +
        positiveCrest * 0.22 +
        (isHoveredBtnSize ? 0.26 * (1 - meltBlend) : 0);
      vData[baseOffset + 7] =
        dimTransit && isGlyph ? motionGlow * Math.min(1, alphaWeight * 1.6) : motionGlow;
    }

    let lineVertexCount = 0;
    const constellation = this.constellation;
    if (currentPhysics.constellation) {
      lineVertexCount = constellation.build(
        vData,
        count,
        width,
        height,
        PALETTE_THEMES[currentPalette].isDark
      );
    }

    activeRenderer.render(
      width,
      height,
      dpr,
      currentPalette,
      this.shockUniforms,
      vData,
      count,
      currentPhysics.bloom,
      constellation.vertexData,
      lineVertexCount
    );

    if (now - this.lastAudioReportAt >= 65) {
      this.lastAudioReportAt = now;
      const denom = Math.max(1, count);
      this.o.onMotionMetrics?.({
        particleCount: count,
        avgVelocity: speedSum / denom,
        avgEnergy: energySum / denom,
      });
    }

    if (dissolveProgress >= 1 && !this.dissolveFired && !isFree) {
      this.dissolveFired = true;
      this.o.onAutoDissolvedToWave?.();
    }
  };

  private handlePointerMove(e: PointerEvent): void {
    const { lx, ly } = this.toLocal(e);
    const overHint = this.o.layoutScrollHint && this.hints.hit(lx, ly) !== null;
    if (overHint !== this.hintHover) {
      this.hintHover = overHint;
      this.updateCursor();
    }
    const ts = this.touchScroll;
    if (ts && this.pointer.down) {
      const dy = ly - ts.startY;
      if (!ts.active && Math.abs(dy) > 10) ts.active = true;
      if (ts.active) {
        this.scrollGoal = Math.max(0, Math.min(this.scrollLimit, ts.startGoal - dy));
        this.pointer.active = false; // don't push dust around while dragging to scroll
        return;
      }
    }
    const ptr = this.pointer;
    const x = lx;
    const y = ly;
    const now = performance.now();

    const movedSinceLast = Math.hypot(x - this.lastMovePos.x, y - this.lastMovePos.y);
    if (movedSinceLast > 3) {
      this.lastMovePos.x = x;
      this.lastMovePos.y = y;
      this.resetIdleDissolve();
    }

    if (ptr.active) {
      ptr.vx = x - ptr.x;
      ptr.vy = y - ptr.y;
      const speed = Math.hypot(ptr.vx, ptr.vy);

      if (this.o.physics.cursorMode !== 'off') {
        if (speed > 4.5) {
          const nodes = this.wakeNodes;
          if (nodes.length >= MAX_WAKE_NODES) nodes.shift();
          nodes.push({ x, y, vx: ptr.vx, vy: ptr.vy, bornAt: now });
        }

        if (speed > 58 && now > ptr.swipeCooldownUntil && !this.o.freeDrift) {
          ptr.swipeCooldownUntil = now + 5200;
          this.o.onSoundImpulse?.(
            0.78,
            x / Math.max(1, this.size.width)
          );
          this.o.onGesture?.('fast-swipe');
        }
      }
    }

    if (this.o.targetMode === 'layout' && !this.o.freeDrift) {
      const hit = this.hitRegions.find(
        (r) =>
          x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height && this.isInBand(r)
      );
      const nextId = hit ? hit.rippleRegionId : -1;
      if (nextId !== this.hoveredRegionId && (nextId >= 0 || this.kbFocusId < 0)) {
        this.kbFocusId = -1;
        this.hoveredRegionId = nextId;
        this.syncHover(nextId >= 0);
      }
    } else if (this.hoveredRegionId !== -1) {
      this.hoveredRegionId = -1;
      this.syncHover(false);
    }

    // Spawn throttled hover ripple pulses across matching Image, Heading, Text, or Button components
    if (!this.o.freeDrift) {
      const regions = this.rippleRegions;
      const hoverPad = 14;
      const matched = regions.find(
        (r) =>
          x >= r.x - hoverPad &&
          x <= r.x + r.width + hoverPad &&
          y >= r.y - hoverPad &&
          y <= r.y + r.height + hoverPad
      );
      if (matched) {
        const res = resolveRegionRipple(matched, this.o.ripple);
        if (res.allowHover && res.pattern !== 'off') {
          const last = this.lastHoverRipple;
          const moved = Math.hypot(x - last.x, y - last.y);
          const enteredNew = last.regionId !== matched.id;
          if ((enteredNew && now - last.time > 90) || (moved > 26 && now - last.time > 150)) {
            last.time = now;
            last.x = x;
            last.y = y;
            last.regionId = matched.id;
            const pulses = this.ripplePulses;
            if (pulses.length >= MAX_RIPPLE_PULSES) pulses.shift();
            pulses.push({
              x,
              y,
              regionId: this.o.targetMode === 'layout' ? matched.id : -1,
              pattern: res.pattern,
              bornAt: now,
              power: res.strength * 0.78,
              speed: res.speed,
              wavelength: res.wavelength,
            });
          }
        }
      }
    }

    ptr.x = x;
    ptr.y = y;
    ptr.active = true;
  }

  private handlePointerDown(e: PointerEvent): void {
    const { lx, ly } = this.toLocal(e);
    this.resetIdleDissolve();
    this.o.onUserActivity?.();
    const ptr = this.pointer;
    ptr.x = lx;
    ptr.y = ly;
    ptr.downX = lx;
    ptr.downY = ly;
    ptr.down = true;
    ptr.active = true;
    ptr.downAt = performance.now();
    this.touchScroll =
      e.pointerType === 'touch' && this.canScroll()
        ? { startY: ly, startGoal: this.scrollGoal, active: false }
        : null;
  }

  private handlePointerUp(e: PointerEvent): void {
    const { lx, ly } = this.toLocal(e);
    const ptr = this.pointer;
    if (!ptr.down) return;
    ptr.down = false;
    const wasScrolling = this.touchScroll?.active;
    this.touchScroll = null;
    if (wasScrolling) return; // a scroll drag is not a tap/burst

    const now = performance.now();
    const heldMs = now - ptr.downAt;
    const movedDist = Math.hypot(lx - ptr.downX, ly - ptr.downY);

    // A tap on a scroll hint chevron pages the layout.
    if (movedDist < 16 && this.o.layoutScrollHint) {
      const hint = this.hints.hit(lx, ly);
      if (hint) {
        this.pageScroll(hint === 'down' ? 1 : -1);
        return;
      }
    }

    // Spawn interactive click ripple wave across tapped component (works even with Cursor Force: Off)
    if (!this.o.freeDrift && movedDist < 16) {
      const pad = 20;
      const matched =
        this.rippleRegions.find(
          (r) =>
            lx >= r.x - pad &&
            lx <= r.x + r.width + pad &&
            ly >= r.y - pad &&
            ly <= r.y + r.height + pad
        ) ?? this.rippleRegions[0];

      const res = resolveRegionRipple(matched, this.o.ripple);
      if (res.allowClick && res.pattern !== 'off') {
        const pulses = this.ripplePulses;
        if (pulses.length >= MAX_RIPPLE_PULSES) pulses.shift();
        const isGlobalExpand =
          res.pattern === 'expand' && (!matched || matched.pattern === undefined);
        pulses.push({
          x: lx,
          y: ly,
          regionId:
            isGlobalExpand || this.o.targetMode !== 'layout' || !matched
              ? -1
              : matched.id,
          pattern: res.pattern,
          bornAt: now,
          power: res.strength * 1.28,
          speed: res.speed,
          wavelength: res.wavelength,
        });
      }
    }

    // Check declarative <Button> click before launching radial scatter
    if (
      this.o.targetMode === 'layout' &&
      !this.o.freeDrift &&
      movedDist < 14 &&
      heldMs < 420
    ) {
      const hit = this.hitRegions.find(
        (r) =>
          lx >= r.x &&
          lx <= r.x + r.width &&
          ly >= r.y &&
          ly <= r.y + r.height &&
          this.isInBand(r)
      );
      if (hit) {
        this.activateHit(hit);
        return;
      }
    }

    if (this.o.physics.cursorMode === 'off') {
      if (movedDist < 16) {
        this.o.onCanvasClick?.();
      }
      return;
    }

    const pool = this.pool;
    const burstRadius = heldMs > 360 ? 225 : 148;
    const burstRadiusSq = burstRadius * burstRadius;
    const burstPower = heldMs > 360 ? 9.5 : 5.8;

    const { x, y, vx, vy, energy, hasTarget, gravityBreakUntil } = pool;
    for (let i = 0; i < pool.count; i++) {
      const dx = x[i] - lx;
      const dy = y[i] - ly;
      const distSq = dx * dx + dy * dy;
      if (distSq < burstRadiusSq && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const factor = (1 - dist / burstRadius) * burstPower;
        vx[i] += (dx / dist) * factor;
        vy[i] += (dy / dist) * factor;
        energy[i] = 1;
        if (hasTarget[i] === 1) {
          gravityBreakUntil[i] = now + 520 + (1 - dist / burstRadius) * 420;
        }
      }
    }

    this.shockwaves.push({
      x: lx,
      y: ly,
      radius: 8,
      maxRadius: burstRadius,
      alpha: 0.34,
    });
    this.o.onSoundImpulse?.(
      heldMs > 360 ? 0.92 : 0.58,
      lx / Math.max(1, this.size.width)
    );

    if (heldMs > 420) {
      this.o.onGesture?.('vortex-release');
      return;
    }

    if (movedDist < 16) {
      ptr.recentClicks = ptr.recentClicks.filter((t) => now - t < 1800);
      ptr.recentClicks.push(now);
      if (ptr.recentClicks.length >= 3) {
        ptr.recentClicks = [];
        this.o.onGesture?.('tap-burst');
      } else {
        this.o.onCanvasClick?.();
      }
    }
  }

  private handlePointerLeave(): void {
    this.touchScroll = null;
    this.pointer.active = false;
    this.pointer.down = false;
    if (this.hoveredRegionId !== -1) {
      this.hoveredRegionId = -1;
      this.syncHover(false);
    }
  }
}
