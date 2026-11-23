import { type CSSProperties, useEffect, useRef } from 'react';
import {
  StarDust,
  type StarDustCallbacks,
  type LayoutOverflow,
  type LayoutPadding,
  type LayoutWindowMode,
  type MindMapFit,
  type StarDustOptions,
  type TargetMode,
} from './StarDust';
import type {
  ImageTuningConfig,
  LayoutNode,
  PaletteMode,
  PhysicsConfig,
  RippleConfig,
} from '../types/mote';

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
  /** See `StarDustOptions.formFlowMs`. Default `0`. */
  formFlowMs?: number;
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
export function DustCanvas({
  activeText,
  isFreeDrift,
  scatterVersion = 0,
  activityVersion,
  fill,
  className,
  style,
  'aria-label': ariaLabel = 'Interactive dust particle canvas',
  engineRef,
  ...rest
}: DustCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engine = useRef<StarDust | null>(null);

  const options = { ...rest, text: activeText, freeDrift: isFreeDrift };
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const instance = new StarDust(canvas, { ...optionsRef.current, fill });
    engine.current = instance;
    engineRef?.(instance);
    return () => {
      instance.destroy();
      engine.current = null;
      engineRef?.(null);
    };
    // The engine lives for the lifetime of the canvas; later prop changes go through setOptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // setOptions diffs internally, so pushing every render is cheap.
  useEffect(() => {
    engine.current?.setOptions(optionsRef.current);
  });

  useEffect(() => {
    engine.current?.markActivity();
  }, [activityVersion]);

  useEffect(() => {
    if (scatterVersion === 0) return;
    engine.current?.scatter();
  }, [scatterVersion]);

  return <canvas ref={canvasRef} aria-label={ariaLabel} className={className} style={style} />;
}

export { StarDust };
export type { StarDustCallbacks, TargetMode, LayoutOverflow, LayoutPadding, LayoutWindowMode, MindMapFit };
