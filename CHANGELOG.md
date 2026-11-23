# Changelog

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
