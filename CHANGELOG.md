# Changelog

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
