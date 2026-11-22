// DOM-free modules: safe to import in Node/Bun (SSR, CLIs, workers, tests).
export * from '../types/mote';
export {
  parseLayoutMarkup,
  collectLayoutImageRefs,
  type ParseLayoutResult,
} from '../engine/layoutParser';
export { perlin3, PerlinWindField } from '../engine/perlinNoise';
export {
  createParticlePool,
  resizeParticlePool,
  computeWavePoint,
  type ParticlePool,
} from '../engine/particlePool';
export {
  OPENING_MESSAGE,
  DIALOGUE_PROMPTS,
  CLICK_CYCLE_BEATS,
  pickGestureReply,
  generateDialogueReply,
} from '../engine/dialogueScript';
