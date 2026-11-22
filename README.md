# @encenlab/star-dust

Interactive WebGL dust-particle typography. Text, images and declarative layouts are formed out of thousands of drifting motes that react to the pointer.

This repo contains two things:

- **The library** (`src/lib/`, `src/engine/`, `src/types/`) published as `@encenlab/star-dust`.
- **The demo app** ("Mote", `src/App.tsx` + `src/components/`), built with Vite + React.

## Using the library

```sh
npm install @encenlab/star-dust   # or: bun add @encenlab/star-dust
```

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

const { root, diagnostic } = parseLayoutMarkup(markup);
dust.setOptions({ targetMode: 'layout', layoutAst: root, onLayoutAction: (action) => { /* ... */ } });
```

`<Image src="...">` values in layout markup are used as URLs. `src="current"`, or no `src`, uses the instance's `imageSrc`. To map your own names to images, pass `resolveLayoutImage`:

```ts
const images: Record<string, string> = { logo: '/img/logo.png', hero: '/img/hero.jpg' };
dust.setOptions({ resolveLayoutImage: (ref, current) => (ref && images[ref]) || ref || current });
```

### Building the library

```sh
bun run build:lib   # → dist-lib/ (ESM + .d.ts)
```

## Running the demo app

The demo's image and layout presets live in `src/demo/presets.ts` and are not part of the package.

```sh
bun install
bun run dev         # http://localhost:3000
```

## License

[MIT](LICENSE) © encenlab
