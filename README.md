# @encenlab/star-dust

Interactive WebGL dust-particle typography. Text, images and declarative layouts are formed out of thousands of drifting motes that react to the pointer.

This repo contains two things:

- **The library** (`src/lib/`, `src/engine/`, `src/types/`) published as `@encenlab/star-dust`.
- **The demo app** ("Mote", `src/App.tsx` + `src/components/`), built with Vite + React.

## Using the library

Install a tagged release from GitHub. Each release tag includes the built files, so no build step runs in your project:

```sh
bun add github:nuwanchamp/star-dust#v0.2.0
# or: npm install github:nuwanchamp/star-dust#v0.2.0
```

Then import it as `@encenlab/star-dust`. To upgrade, change the tag. See [CHANGELOG.md](CHANGELOG.md) for what changed.

The package is ESM-only. Rendering needs a browser with WebGL2. Install it with npm/bun and use it in any bundled front-end (Vite, Next.js client components, etc.).

| Import | Runs in | Contents |
|---|---|---|
| `@encenlab/star-dust` | browser | `StarDust` engine, defaults, palettes, `AmbientSoundEngine`, plus everything in `core` |
| `@encenlab/star-dust/react` | browser | `<DustCanvas>` React component (React ≥ 18, optional peer) |
| `@encenlab/star-dust/core` | anywhere, including Node/Bun | layout markup parser, Perlin noise, particle pool, dialogue script, types |

### Vanilla / any framework

```ts
import { StarDust } from '@encenlab/star-dust';

// The canvas fills its parent by default (pass `fill: false` to size it with your own CSS).
const dust = new StarDust(document.querySelector('canvas')!, {
  text: 'Hello',
  palette: 'moonlit',               // 'aurora' | 'sunbeam' | 'moonlit' | 'alabaster'
  physics: { density: 'dense', cursorMode: 'vortex' },
  onGesture: (kind) => console.log(kind),
});

dust.setOptions({ text: 'World' });   // only changed options trigger work
dust.setOptions({ targetMode: 'image', imageSrc: '/logo.png' });
dust.scatter();                       // wind-blow the formation apart
dust.destroy();                       // stop the loop, remove listeners, free GPU resources
```

`dust.supported` is `false` when WebGL2 is unavailable. The instance then does nothing.

### React

```tsx
import { DustCanvas } from '@encenlab/star-dust/react';

<div style={{ height: 480 }}>
  <DustCanvas activeText="Hello" palette="aurora" physics={{ density: 'balanced' }} />
</div>
```

To trigger a scatter, increment `scatterVersion`. To reset the idle auto-dissolve timer, increment `activityVersion`. Use `engineRef` to get the underlying `StarDust` instance.

### Layout mode

```ts
import { parseLayoutMarkup } from '@encenlab/star-dust'; // also available from '@encenlab/star-dust/core'

const { root, error } = parseLayoutMarkup(markup);   // error: { message, line } | null
dust.setOptions({ targetMode: 'layout', layoutAst: root, onLayoutAction: (action) => { /* ... */ } });
```

Layouts stay formed while someone reads them. Text and image modes melt into the wave after `physics.autoDissolveSec` (20s) of inactivity, but layouts only do so with `layoutAutoDissolve: true`.

**Keyboard.** The canvas can take keyboard focus. Tab and Shift+Tab step through the layout's buttons in reading order, scrolling each one into view and highlighting it. Enter or Space activates the highlighted button, and Esc clears it. On a long layout, the arrow keys scroll a line, Page Up/Down and Space scroll a band, and Home/End jump to the start or end. At either end of the layout, keys pass through to the page.

#### Long layouts

When a layout is taller than the canvas, it shrinks only until its smallest text reaches `layoutMinFontSize` (default 14px). Past that point it scrolls: mouse wheel, trackpad or touch-drag move the content. The wheel is only captured while the layout can still move, so the page scrolls normally once the layout reaches either end.

Long layouts are as crisp as short ones, because text is never thinned to fit. When there aren't enough particles for everything, `layoutWindow` decides what gets drawn:

| `layoutWindow` | What gets drawn |
|---|---|
| `'auto'` (default) | A clear band from the top of the layout. It grows down until `layoutParticleBudget` is used and ends between two lines. Dense content gives a shorter band. Nothing is thinned, and content below the band appears as you scroll it in. |
| `'screen'` | The whole screen. If that holds more than the budget, all text is thinned evenly (less crisp). |
| a number, e.g. `420` | A band of that height in pixels, thinned only if it holds more than the budget. |

As you scroll, text in the band moves with the page (or trails behind it, with `layoutScrollTrail`). Content that leaves dissolves, and its particles stream over to form the content coming in. When there's more to scroll, a small dust chevron (⌄⌄) forms under the band, and one (⌃⌃) forms at the top once you've scrolled down. Clicking a chevron scrolls by about one band. To draw your own indicator instead, set `layoutScrollHint: false` and use `dust.layoutBand` (the band's position on screen), `scrollTop`, `scrollHeight` and `onScroll`.

```ts
dust.setOptions({
  layoutOverflow: 'scroll',          // default; 'fit' = old behavior (shrink to fit, however small)
  layoutMinFontSize: 14,
  layoutWindow: 'auto',              // 'auto' | 'screen' | band height in px
  layoutScrollHint: true,            // particle chevrons when there's more to scroll
  layoutParticleBudget: 30000,       // particles per band/screen; default 16.5k / 30k / 45k by density
  layoutScrollTrail: 0,              // 0 = text moves rigidly with the scroll (crisp), 1 = trails behind on springs
  layoutPadding: { top: 72, bottom: 120 },  // number | per-side | (width, height) => …; default 32px (16px under 640px)
  onScroll: (top, max) => updateMyScrollbar(top / max),
});
dust.scrollTo(0);                    // also scrollBy(dy), scrollTop, scrollHeight (max offset)
dust.layoutHitRegions;               // button rects at the current scroll, e.g. for accessible overlays
```

A higher budget means crisper text and more work per frame. On low-end phones, `physics: { density: 'sparse' }` or a lower `layoutParticleBudget` keeps long layouts smooth.

`<Image src="...">` values in layout markup are used as URLs. `src="current"`, or no `src`, uses the instance's `imageSrc`. To map your own names to images, pass `resolveLayoutImage`:

```ts
const images: Record<string, string> = { logo: '/img/logo.png', hero: '/img/hero.jpg' };
dust.setOptions({ resolveLayoutImage: (ref, current) => (ref && images[ref]) || ref || current });
```

### Releasing

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Commit the source, then tag a commit that also contains the build. `dist-lib/` is gitignored, so it's added with `-f` on a detached commit and stays out of the branches:

```sh
bun run lint && bun run test && bun run build:lib
git checkout --detach
git add -f dist-lib && git commit -m "build: dist for vX.Y.Z"
git tag vX.Y.Z && git checkout -   # back to your branch
git push origin vX.Y.Z
```

### Building and testing

```sh
bun run build:lib    # → dist-lib/ (ESM + .d.ts)
bun run lint         # typecheck app, library and tests
bun run test         # unit tests (layout parser, layout window, scroll hints)
bun run test:smoke   # browser smoke test: starts Vite, drives your installed Chrome
                     # (set CHROME_PATH to use another Chromium)
```

## Running the demo app

The demo's image and layout presets live in `src/demo/presets.ts` and are not part of the package.

```sh
bun install
bun run dev         # http://localhost:3000
```

## License

[MIT](LICENSE) © encenlab
