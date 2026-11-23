// Test harness page for scripts/smoke.mjs: exposes the engine on window.
import { StarDust, parseLayoutMarkup, type StarDustOptions } from '../../src/lib/index';

declare global {
  interface Window {
    dust: StarDust;
    actions: string[];
    make: (markup: string | null, options?: StarDustOptions) => StarDust;
  }
}

window.actions = [];
window.make = (markup, options = {}) => {
  window.dust?.destroy();
  window.dust = new StarDust(document.getElementById('c') as HTMLCanvasElement, {
    ...(markup ? { targetMode: 'layout', layoutAst: parseLayoutMarkup(markup).root } : {}),
    physics: { cursorMode: 'off', autoDissolveSec: 0 },
    onLayoutAction: (a) => window.actions.push(a),
    ...options,
  });
  return window.dust;
};
