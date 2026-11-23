# Changelog

## 0.7.1

### Fixed
- **`formFlowMs`: background dust recruited into a new shape no longer flashes.** When a new scene needs more particles than the old one has, it takes some from the faint background. Those were drawn at full shape brightness from the first frame, and started riding the wind at once, so bright clouds bloomed at the edges of the screen as the old shape began to dissolve. Recruits now keep their own faint look; scene to scene they also drift gently until their landing time and brighten only as they arrive. Leaving the wave, they still pour in with the full stream.

## 0.7.0

Shapes can flow into each other through the Perlin wind.

### Added
- **`formFlowMs`** (default `0`). When the dust takes a new shape (leaving the free wave, or a new `layoutAst`, `text`, `imageSrc` or `targetMode`), the old shape melts into the Perlin wind and its particles ride the streams for about this many milliseconds, then each condenses into its new place at its own moment. Particles aren't dropped mid-transition, and the transition stays visible the same way as the `formStaggerMs` pour. Re-layouts of the same scene (resize, mind-map toggles, density) aren't flowed. Takes precedence over `formStaggerMs`.

## 0.6.1

### Fixed
- **The `formStaggerMs` pour is visible.** Particles still waiting on the wave keep its full brightness, and the rest of the wave dims gradually over the pour (plus about 1.2s to settle) instead of dimming at once. Before, the wave went faint as soon as a shape started forming, so in layouts the pour was barely visible.

## 0.6.0

The free wave can pour into a shape.

### Added
- **`formStaggerMs`** (default `0`). When dust drifting as the free wave forms text, an image or a layout, particles leave the wave over this many milliseconds, closest to their place first. The rest keep flowing with the wave until their turn, so the wave pours into the shape.

### Fixed
- The v0.5.0 package reported its version as 0.4.1. The version number is now correct.

## 0.5.0

Particle density per layout element.

### Added
- **`density` attribute on any layout element** (`sparse` | `balanced` | `dense`). It overrides `physics.density` for that element, and containers pass it down to their children. Mind maps use it in their particle budget fit.

## 0.4.1

### Fixed
- `<Image>` no longer has a 48px minimum size, so small icons (e.g. `width="24" height="24"`) are drawn at the size they ask for. The smallest drawable size is 24px.

## 0.4.0

Icons and other elements can be links.

### Added
- **Actions on any layout element.** `<Image>`, `<Text>`, `<Heading>` and so on can take an `action` (e.g. icon links). They get the hover glow, pointer cursor, keyboard focus and `onLayoutAction`.
- **`open:<url>` actions open the link in a new tab** (`openLinks`, default `true`; only http, https, mailto and tel).

### Fixed
- SVGs with only a `viewBox` (no width/height) were cropped, showing only their top-left part. They are now rasterized once on load and render whole.
- Small images and icons (96px or less) no longer turn into blurry blobs: they skip the default edge fade and use a particle count proportional to their size.

## 0.3.0

Mind maps stay readable and whole at any size.

### Added
- **Mind maps stay readable (`mindMapFit`, default `'collapse'`).** A map that doesn't fit the screen at its natural size collapses its deepest levels. The root and first level always show, with `+N` badges on collapsed nodes. If there isn't room, opening a branch closes older ones. On narrow screens, radial maps switch to the tree layout.
- **Mind maps use the free space (`mindMapMaxScale`, default 1.6).** After fitting, a map with room around it is enlarged so its labels are bigger and crisper.
- **Mind maps fit the particle budget and never scroll.** A map folds until it fits both the screen and `layoutParticleBudget`, so the layout's clear band never cuts it. In a column, a map gets only the height its siblings leave.
- **Opening a branch folds the opposite side first**, then the same side, then levels inside the opened branch. Branches keep a stable side as others open and close.
- **Paging.** A branch with more direct children than fit shows one page at a time with `+N more ▸` and `◂ previous` nodes (action `mindmap:page:<id>:next|prev`).
- **Built-in expand/collapse.** Clicking a node (or pressing Enter on it) opens or closes it with no app code. Pass `collapsedMindMapIds` to keep managing it yourself, as before.

### Changed
- Mind map labels are as bright as buttons and headings (they used to be dimmed to 82–96%), and node frames are dense enough to read as solid outlines instead of dotted ones.
- Mind map layout moved to `src/engine/mindMapLayout.ts`, a pure module with unit tests.
- The demo now uses the built-in mind map collapse state.

## 0.2.0

Long layouts are now readable and scrollable.

### Added
- **Scrolling layouts.** A layout taller than the canvas scrolls instead of shrinking until it's unreadable. It works with the wheel, trackpad, touch-drag and keyboard. New API: `scrollTo`, `scrollBy`, `scrollTop`, `scrollHeight`, `onScroll`.
- **Clear band (`layoutWindow`, default `'auto'`).** Text is never thinned to fit the particle budget. A band from the top is drawn at full detail, and content below it forms as you scroll it in. `'screen'` (thin evenly) and a fixed height in pixels are also available.
- **`layoutParticleBudget`** sets the number of particles per band or screen.
- **Scroll chevrons (`layoutScrollHint`, default on).** Particle chevrons show when there's more to scroll. Clicking one scrolls by about one band.
- **`layoutScrollTrail`** (0–1) sets how formed text follows a scroll: rigid (crisp) or trailing.
- **Keyboard.** The canvas can take focus. Tab moves between layout buttons, Enter or Space presses one, the arrow keys, Page Up/Down, Space and Home/End scroll, and Esc clears focus.
- **Other layout options:** `layoutOverflow` (`'scroll'` | `'fit'`), `layoutMinFontSize`, `layoutPadding`.
- **New getters:** `layoutBand` and `layoutHitRegions`.
- **Tests:** unit tests (`bun run test`) and a browser smoke test (`bun run test:smoke`).

### Changed
- Layouts no longer auto-dissolve while someone is reading them. Set `layoutAutoDissolve: true` to bring that back. Text and image modes are unchanged.
- The default layout padding is now 32px (16px on narrow screens), down from the demo's 80px top and 166px bottom.

### Fixed
- README: `parseLayoutMarkup` returns `{ root, error }`, not `{ root, diagnostic }`.

## 0.1.0

- First library release: the `StarDust` engine, the `<DustCanvas>` React wrapper, and DOM-free `core` exports.
