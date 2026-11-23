# @encenlab/star-dust

Interactive WebGL dust-particle typography. Text, images and declarative layouts are formed out of thousands of drifting motes that react to the pointer.

This repo contains two things:

- **The library** (`src/lib/`, `src/engine/`, `src/types/`) published as `@encenlab/star-dust`.
- **The demo app** ("Mote", `src/App.tsx` + `src/components/`), built with Vite + React.

## Using the library

Install a tagged release from GitHub. Each release tag includes the built files, so no build step runs in your project:

```sh
bun add github:nuwanchamp/star-dust#v0.7.2
# or: npm install github:nuwanchamp/star-dust#v0.7.2
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

To have the free wave pour into a shape instead of snapping to it, set `formStaggerMs`. Particles closest to their place leave the wave first:

```ts
dust.setOptions({ freeDrift: true });                        // drift as the wave
dust.setOptions({ freeDrift: false, formStaggerMs: 1500 });  // form over 1.5s
```

Or set `formFlowMs` to have every change of shape flow through the Perlin wind: the old shape (or the wave) melts into swirling streams, which condense into the new shape over about that many milliseconds. It applies to scene changes too (a new `layoutAst`, `text`, `imageSrc` or `targetMode`), not to re-layouts of the same scene:

```ts
dust.setOptions({ formFlowMs: 2200 });                      // every new shape flows in over ~2.2s
dust.setOptions({ layoutAst: nextScene });                  // the current scene streams into the next
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

**Clickable elements and links.** Any element can take an `action`, not just `<Button>`. For example, icon links:

```html
<Row gap="18">
  <Image src="/icons/linkedin.svg" width="40" height="40" action="open:https://linkedin.com/in/you" />
  <Image src="/icons/github.svg" width="40" height="40" action="open:https://github.com/you" />
  <Text action="open:mailto:you@example.com">you@example.com</Text>
</Row>
```

Clickable elements get the hover glow, a pointer cursor, keyboard focus (Tab, then Enter), and `onLayoutAction(action)`. `open:<url>` actions also open the link in a new tab (`noopener`). Only `http`, `https`, `mailto` and `tel` links are opened. Set `openLinks: false` to handle navigation yourself. Small images (96px or less) are drawn without the soft edge fade and with a particle count matched to their size, so icons stay crisp. SVGs with only a `viewBox` (common in icon sets) render whole.

**Particle density per element.** Any element can set `density="sparse" | "balanced" | "dense"`, overriding the instance's `physics.density` for that element. A container (`<Col>`, `<Row>`) passes its density down to its children, and a child can override it:

```html
<Col density="sparse">
  <Heading density="dense">Sharp, bright title</Heading>
  <Text>Light background text</Text>
  <Image src="/hero.jpg" width="320" height="200" />
</Col>
```

Dense elements use more of the particle budget, so in a long layout the `'auto'` band ends sooner. Text of 26px or smaller is never sampled sparser than `balanced`, so it stays readable.

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

#### Mind maps

A `<MindMap>` stays readable and whole however big it gets. It never scrolls and is never cut off. It's limited by both the screen (minus whatever sits next to it in the same column, such as a row of buttons) and the particle budget (`layoutParticleBudget`). When it doesn't fit, branches fold one at a time to a `+N` badge, deepest first, then larger branches before smaller ones. The root and first level stay visible.

- **Opening a branch:** click a node (or Tab to it and press Enter) to open or close it. Opening a branch folds the **opposite side** of the map first, then other branches on its own side, then deeper levels inside the branch itself. The branch you opened, and the path to it, always stay open. Branches keep their side of the map as others open and close.
- **Too many children:** if an opened branch has more direct children than fit, they show a page at a time. A `+N more ▸` node shows the next set and `◂ previous` goes back.
- **Narrow screens:** a radial map switches to a tree, which only grows rightward.

A map that fits with room to spare is enlarged to use it, because bigger particle labels are crisper. It grows up to `mindMapMaxScale` (1.6× by default) and uses at most about 92% of the width and 70% of the height, so content around it still fits.

```ts
dust.setOptions({
  mindMapFit: 'collapse',   // default; 'shrink' = scale the whole map down instead
  mindMapMaxScale: 1.6,     // 1 = keep the natural size
});
```

The engine remembers which nodes are open, and resets that when `layoutAst` changes. To manage it yourself, pass `collapsedMindMapIds`: a set of node ids toggled relative to the markup's `collapsed` attribute. Then handle `onLayoutAction('mindmap:toggle:<id>')` in your app. Auto-collapse is off in that mode.

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
                     # (tests/smoke/calibrate.html compares the mind map particle estimate with real counts)
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
