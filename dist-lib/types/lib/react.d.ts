import { type CSSProperties } from 'react';
import { StarDust, type StarDustCallbacks, type LayoutOverflow, type LayoutPadding, type LayoutWindowMode, type MindMapFit, type StarDustOptions, type TargetMode } from './StarDust.js';
import type { ImageTuningConfig, LayoutNode, PaletteMode, PhysicsConfig, RippleConfig } from '../types/mote.js';
export interface DustCanvasProps extends StarDustCallbacks {
    activeText?: string;
    targetMode?: TargetMode;
    imageSrc?: string | null;
    invertImageContrast?: boolean;
    imageTuning?: ImageTuningConfig;
    layoutAst?: LayoutNode | null;
    layoutLeftInset?: number;
    collapsedMindMapIds?: Set<string>;
    resolveLayoutImage?: StarDustOptions['resolveLayoutImage'];
    /** See `StarDustOptions.layoutOverflow`. Default `'scroll'`. */
    layoutOverflow?: LayoutOverflow;
    /** See `StarDustOptions.layoutMinFontSize`. Default 14. */
    layoutMinFontSize?: number;
    /** See `StarDustOptions.layoutPadding`. */
    layoutPadding?: LayoutPadding;
    /** See `StarDustOptions.layoutParticleBudget`. */
    layoutParticleBudget?: number;
    /** See `StarDustOptions.layoutScrollTrail`. Default 0 (rigid). */
    layoutScrollTrail?: number;
    /** See `StarDustOptions.layoutWindow`. Default `'auto'`. */
    layoutWindow?: LayoutWindowMode;
    /** See `StarDustOptions.layoutScrollHint`. Default `true`. */
    layoutScrollHint?: boolean;
    /** See `StarDustOptions.layoutAutoDissolve`. Default `false`. */
    layoutAutoDissolve?: boolean;
    /** See `StarDustOptions.openLinks`. Default `true`. */
    openLinks?: boolean;
    /** See `StarDustOptions.formStaggerMs`. Default `0`. */
    formStaggerMs?: number;
    /** See `StarDustOptions.mindMapFit`. Default `'collapse'`. */
    mindMapFit?: MindMapFit;
    /** See `StarDustOptions.mindMapMaxScale`. Default 1.6. */
    mindMapMaxScale?: number;
    isFreeDrift?: boolean;
    physics?: Partial<PhysicsConfig>;
    ripple?: Partial<RippleConfig>;
    palette?: PaletteMode;
    /** Increment to trigger a wind-scatter of the current formation. */
    scatterVersion?: number;
    /** Increment to reset the idle auto-dissolve timer. */
    activityVersion?: number;
    /** See `StarDustOptions.fill`. Default `true`. */
    fill?: boolean;
    className?: string;
    style?: CSSProperties;
    'aria-label'?: string;
    /** Receives the underlying engine instance (or null on unmount). */
    engineRef?: (engine: StarDust | null) => void;
}
/** React wrapper around the framework-agnostic `StarDust` engine. */
export declare function DustCanvas({ activeText, isFreeDrift, scatterVersion, activityVersion, fill, className, style, 'aria-label': ariaLabel, engineRef, ...rest }: DustCanvasProps): import("react").JSX.Element;
export { StarDust };
export type { StarDustCallbacks, TargetMode, LayoutOverflow, LayoutPadding, LayoutWindowMode, MindMapFit };
//# sourceMappingURL=react.d.ts.map