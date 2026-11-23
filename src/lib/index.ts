// Browser entry: the engine plus everything in ./core.
export * from './core';
export {
  StarDust,
  DEFAULT_PHYSICS,
  DEFAULT_RIPPLE,
  type StarDustOptions,
  type StarDustCallbacks,
  type MotionMetrics,
  type TargetMode,
  type LayoutOverflow,
  type LayoutPadding,
  type LayoutPaddingValue,
  type LayoutPaddingBox,
  type LayoutWindowMode,
  type LayoutBandBounds,
  type MindMapFit,
} from './StarDust';
export { PALETTE_THEMES, type PaletteThemeMeta } from '../engine/dustAtlas';
export { DEFAULT_IMAGE_TUNING } from '../engine/imageSampler';
export { defaultLayoutImageUrl } from '../engine/layoutEngine';
export { AmbientSoundEngine, type AmbientMetrics } from '../engine/ambientSoundEngine';
