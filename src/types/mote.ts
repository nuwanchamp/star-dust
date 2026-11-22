export type CursorMode = 'off' | 'repel' | 'vortex' | 'breeze';
export type DensityPreset = 'sparse' | 'balanced' | 'dense';
export type FontStyle = 'serif' | 'sans' | 'mono';
export type InteractionMode = 'dialogue' | 'sculpt' | 'image' | 'layout';
export type PaletteMode = 'aurora' | 'sunbeam' | 'moonlit' | 'alabaster';

export interface PhysicsConfig {
  cursorMode: CursorMode;
  density: DensityPreset;
  fontStyle: FontStyle;
  turbulence: number;      // 0.2 to 1.6
  cohesion: number;        // 0.03 to 0.12
  autoDissolveSec: number; // 0 = off, or seconds of inactivity before dissolving to wave
  perlinFlow: boolean;     // organic curl-Perlin wind field during free drift
  bloom: boolean;          // post-processing bloom & glowing particle motion trails
  constellation: boolean;  // draw fading wireframe edges between nearby particles
}

export interface ImagePreset {
  id: string;
  label: string;
  src: string;
}

export type ImageBlurStyle = 'radial' | 'edge';

export interface ImageTuningConfig {
  blurStyle: ImageBlurStyle;
  edgeBlur: number; // 0 to 1
  contrast: number; // 0.6 to 1.8
  detail: number;   // 0 to 1.5
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number | null;
  ty: number | null;
  size: number;
  baseAlpha: number;
  phase: number;
  wanderSpeed: number;
  energy: number;
  waveLayer: number; // -1 = sparse cosmic dust, 0..2 = undulating wave ribbon layers
  waveU: number;     // 0..1 normalized horizontal coordinate along wave
  waveV: number;     // -1..1 ribbon cross-section offset
  depth: number;     // 0..1 depth-of-field weight
  depthPlane: 0 | 1 | 2; // 0 = far mist, 1 = mid-plane core, 2 = foreground bokeh
  mass: number;      // 0.7..1.4 aerodynamic inertia & thermal lift
  colorSeed: number; // 0..1 subtle hue variance
  isFringe: boolean; // ~10% outer gravitational halo around settled letters
  gravityBreakUntil: number;
  windReleaseAt: number; // staggered directional wind erosion trigger
}

export interface DialoguePrompt {
  id: string;
  label: string;
  beats: string[];
}

export type GestureKind =
  | 'fast-swipe'
  | 'vortex-release'
  | 'tap-burst'
  | 'idle';

export type LayoutTagName =
  | 'Col'
  | 'Row'
  | 'Heading'
  | 'Text'
  | 'Image'
  | 'Button'
  | 'Divider'
  | 'Spacer'
  | 'List'
  | 'Item'
  | 'Table'
  | 'Tr'
  | 'Th'
  | 'Td'
  | 'Quote'
  | 'Code'
  | 'MindMap'
  | 'Branch';

export interface LayoutNode {
  tag: LayoutTagName;
  attrs: Record<string, string>;
  children: LayoutNode[];
  text?: string;
  line: number;
}

export interface LayoutDiagnostic {
  message: string;
  line: number;
}

export type RipplePattern = 'off' | 'ring' | 'sweep' | 'pulse' | 'expand';
export type RippleTrigger = 'both' | 'ambient' | 'interactive' | 'hover' | 'click';
export type GlobalRippleTrigger = 'both' | 'ambient' | 'interactive';

export interface RippleConfig {
  pattern: RipplePattern;
  trigger: GlobalRippleTrigger;
  strength: number;   // 0.1 to 1.5
  speed: number;      // 0.3 to 2.5
  wavelength: number; // 60 to 280 px
}

export interface RippleRegion {
  id: number;
  tag: LayoutTagName | 'Stage';
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  pattern?: RipplePattern;
  trigger?: RippleTrigger;
  strength?: number;
  speed?: number;
  wavelength?: number;
}

export interface LayoutHitRegion {
  id: number;
  rippleRegionId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  label: string;
}

export interface LayoutPreset {
  id: string;
  label: string;
  markup: string;
}
