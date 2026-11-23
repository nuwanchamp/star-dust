export type CursorMode = 'off' | 'repel' | 'vortex' | 'breeze';
export type DensityPreset = 'sparse' | 'balanced' | 'dense';
export type FontStyle = 'serif' | 'sans' | 'mono';
export type InteractionMode = 'dialogue' | 'sculpt' | 'image' | 'layout';
export type PaletteMode = 'aurora' | 'sunbeam' | 'moonlit' | 'alabaster';
export interface PhysicsConfig {
    cursorMode: CursorMode;
    density: DensityPreset;
    fontStyle: FontStyle;
    turbulence: number;
    cohesion: number;
    autoDissolveSec: number;
    perlinFlow: boolean;
    bloom: boolean;
    constellation: boolean;
}
export interface ImagePreset {
    id: string;
    label: string;
    src: string;
}
export type ImageBlurStyle = 'radial' | 'edge';
export interface ImageTuningConfig {
    blurStyle: ImageBlurStyle;
    edgeBlur: number;
    contrast: number;
    detail: number;
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
    waveLayer: number;
    waveU: number;
    waveV: number;
    depth: number;
    depthPlane: 0 | 1 | 2;
    mass: number;
    colorSeed: number;
    isFringe: boolean;
    gravityBreakUntil: number;
    windReleaseAt: number;
}
export interface DialoguePrompt {
    id: string;
    label: string;
    beats: string[];
}
export type GestureKind = 'fast-swipe' | 'vortex-release' | 'tap-burst' | 'idle';
export type LayoutTagName = 'Col' | 'Row' | 'Heading' | 'Text' | 'Image' | 'Button' | 'Divider' | 'Spacer' | 'List' | 'Item' | 'Table' | 'Tr' | 'Th' | 'Td' | 'Quote' | 'Code' | 'MindMap' | 'Branch';
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
    strength: number;
    speed: number;
    wavelength: number;
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
//# sourceMappingURL=mote.d.ts.map