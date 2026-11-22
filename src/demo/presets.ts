// Demo-only content: these presets reference this app's /public assets and are not part of the library.
import type { ImagePreset, LayoutPreset } from '../types/mote';

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const CRESCENT_ORB_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="g1" cx="42%" cy="38%" r="52%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#7c7c8a"/>
      <stop offset="100%" stop-color="#0a0a0f"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="#000000"/>
  <circle cx="200" cy="200" r="126" fill="url(#g1)"/>
  <circle cx="248" cy="176" r="102" fill="#000000"/>
  <ellipse cx="200" cy="206" rx="184" ry="44" fill="none" stroke="#ffffff" stroke-width="6" transform="rotate(-18 200 200)"/>
  <ellipse cx="200" cy="206" rx="160" ry="34" fill="none" stroke="#b4b4c4" stroke-width="2.5" transform="rotate(-18 200 200)"/>
  <circle cx="92" cy="108" r="4" fill="#ffffff"/>
  <circle cx="318" cy="278" r="3" fill="#ffffff"/>
  <circle cx="294" cy="96" r="2.5" fill="#d8d8e4"/>
</svg>
`);

const BOTANICAL_LEAF_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#ffffff"/>
  <path d="M200 356 C198 280 200 185 200 54" stroke="#18181b" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M200 52 C292 104 328 196 276 286 C250 328 220 336 200 322 C180 336 150 328 124 286 C72 196 108 104 200 52 Z" fill="#27272a"/>
  <path d="M200 84 L200 326" stroke="#f4f4f5" stroke-width="4.5" fill="none"/>
  <path d="M200 132 Q245 118 272 142 M200 176 Q258 158 292 190 M200 224 Q256 208 286 242 M200 270 Q242 258 264 286" stroke="#e4e4e7" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  <path d="M200 132 Q155 118 128 142 M200 176 Q142 158 108 190 M200 224 Q144 208 114 242 M200 270 Q158 258 136 286" stroke="#e4e4e7" stroke-width="3.4" fill="none" stroke-linecap="round"/>
</svg>
`);

const WAVE_MOUNTAIN_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="pk" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#sky)"/>
  <circle cx="348" cy="96" r="36" fill="#1e293b"/>
  <path d="M0 245 L96 156 L176 220 L272 118 L372 212 L480 148 L480 300 L0 300 Z" fill="url(#pk)"/>
  <path d="M272 118 L308 168 L280 162 L262 184 L240 160 Z" fill="#f8fafc"/>
  <path d="M96 156 L120 186 L98 180 L84 194 L72 178 Z" fill="#f1f5f9"/>
  <path d="M0 282 Q120 264 240 284 T480 280" stroke="#0f172a" stroke-width="3.5" fill="none"/>
  <path d="M0 304 Q120 288 240 306 T480 302" stroke="#334155" stroke-width="2.5" fill="none"/>
  <path d="M0 326 Q120 314 240 328 T480 325" stroke="#64748b" stroke-width="2" fill="none"/>
</svg>
`);

export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'portrait',
    label: 'Portrait',
    src: '/assets/aistudio/image_92889438.png',
  },
  {
    id: 'cutout',
    label: 'Cutout',
    src: '/assets/aistudio/74770a53-e672-4688-bcaf-edd201b4b866_5235893a.jpeg',
  },
  {
    id: 'orb',
    label: 'Ringed Eclipse',
    src: CRESCENT_ORB_SVG,
  },
  {
    id: 'leaf',
    label: 'Botanical',
    src: BOTANICAL_LEAF_SVG,
  },
  {
    id: 'horizon',
    label: 'Peaks',
    src: WAVE_MOUNTAIN_SVG,
  },
];

/** The demo's layout padding: keeps clear of its top bar and the composer dock at the bottom. */
export function demoLayoutPadding(width: number, height: number) {
  const compact = width < 640;
  return {
    top: Math.min(compact ? 66 : 80, Math.max(46, height * 0.13)),
    bottom: Math.min(compact ? 150 : 166, Math.max(92, height * 0.27)),
    left: compact ? 16 : 36,
    right: compact ? 16 : 36,
  };
}

/**
 * Resolves layout `<Image src="...">` values for the demo: preset names ("cutout", "orb", "peaks"…),
 * "uploaded"/"current" for the active image, otherwise a URL. Unknown names fall back to the first preset.
 */
export function resolveDemoLayoutImage(
  rawSrc: string | undefined,
  uploadedSrc: string | null
): string {
  const key = (rawSrc || 'cutout').trim();
  const normalized = key.replace(/^preset:/i, '').toLowerCase();

  if (normalized === 'uploaded' || normalized === 'current') {
    return uploadedSrc || IMAGE_PRESETS[0].src;
  }
  if (normalized === 'peaks') {
    const horizon = IMAGE_PRESETS.find((p) => p.id === 'horizon');
    if (horizon) return horizon.src;
  }
  const byPreset = IMAGE_PRESETS.find((p) => p.id.toLowerCase() === normalized);
  if (byPreset) return byPreset.src;

  if (/^(https?:|data:|blob:|\/)/i.test(key)) {
    return key;
  }

  return IMAGE_PRESETS[0].src;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'hero-card',
    label: 'Hero Card',
    markup: `<Col gap="18" align="center">
  <Heading size="xl">Living Light</Heading>
  <Text width="480" align="center">
    Compose typography, portraits, and interactive buttons directly out of glowing dust particles.
  </Text>
  <Spacer size="6" />
  <Divider length="220" />
  <Spacer size="6" />
  <Row gap="18" align="center">
    <Button action="scatter" variant="solid">Scatter Wind</Button>
    <Button action="palette:sunbeam">Sunbeam Glow</Button>
  </Row>
</Col>`,
  },
  {
    id: 'profile-split',
    label: 'Profile Split',
    markup: `<Row gap="34" align="center" justify="center">
  <Image src="cutout" width="240" height="250" blur="0.55" blurStyle="radial" />
  <Col gap="14" align="start">
    <Heading size="lg">Sculpted Identity</Heading>
    <Text width="360">
      Images, flexbox rows, and crisp paragraphs share one unified WebGL2 particle field.
    </Text>
    <Spacer size="4" />
    <Row gap="14">
      <Button action="invert" variant="solid">Invert Tone</Button>
      <Button action="scene:action-menu">Open Menu</Button>
    </Row>
  </Col>
</Row>`,
  },
  {
    id: 'action-menu',
    label: 'Action Menu',
    markup: `<Col gap="16" align="center">
  <Heading size="lg">Atmosphere & Motion</Heading>
  <Divider length="260" />
  <Row gap="14" justify="center" wrap="true">
    <Button action="palette:aurora">Aurora</Button>
    <Button action="palette:sunbeam">Sunbeam</Button>
    <Button action="palette:moonlit">Moonlit</Button>
    <Button action="palette:alabaster">Alabaster</Button>
  </Row>
  <Spacer size="4" />
  <Row gap="16">
    <Button action="wave" variant="solid">Release to Wave</Button>
    <Button action="scatter">Gust</Button>
  </Row>
</Col>`,
  },
  {
    id: 'editorial-poster',
    label: 'Editorial Poster',
    markup: `<Col gap="14" align="center">
  <Heading size="lg">Eclipse Study</Heading>
  <Image src="orb" width="230" height="230" blur="0.4" blurStyle="radial" />
  <Text width="400" align="center">
    Every particle remembers its place in the grid until your cursor wakes the air.
  </Text>
  <Button action="scene:hero-card" variant="solid">Back to Hero</Button>
</Col>`,
  },
  {
    id: 'ripple-study',
    label: 'Ripple Study',
    markup: `<Row gap="32" align="center" justify="center">
  <Image src="portrait" width="245" height="260" blur="0.5" ripple="ring" rippleStrength="0.85" rippleSpeed="1.05" />
  <Col gap="14" align="start">
    <Heading size="lg" ripple="sweep" rippleStrength="0.7" rippleSpeed="1.15">Harmonic Field</Heading>
    <Text width="350" ripple="off">
      Each component carries its own ripple pattern, speed, and trigger—or stays completely still.
    </Text>
    <Spacer size="4" />
    <Row gap="14">
      <Button action="ripple:pulse" ripple="pulse" variant="solid">Pulse All</Button>
      <Button action="ripple:off" ripple="ring" rippleTrigger="hover">Calm Field</Button>
    </Row>
  </Col>
</Row>`,
  },
  {
    id: 'markdown-doc',
    label: 'Markdown Doc',
    markup: `<Row gap="34" align="start" justify="center">
  <Col gap="14" align="start">
    <Heading size="lg" align="left">Field Notes</Heading>
    <Quote width="330" cite="Mote Spec" ripple="pulse">
      Markdown blocks settle directly into luminous particle typography.
    </Quote>
    <List width="330">
      - Bullet &amp; numbered lists with hanging indents
      - Pipe tables with aligned columns
      - Monospace code &amp; cited callouts
    </List>
  </Col>
  <Col gap="14" align="start">
    <Table width="370" ripple="sweep">
      | Block | Role | Mode |
      | :--- | :--- | :---: |
      | List | Bullets &amp; steps | Auto |
      | Table | Aligned grid | Pipe |
      | Quote | Cited callout | Serif |
    </Table>
    <Code width="370">&lt;Button ripple="expand" variant="solid"&gt;Pulse&lt;/Button&gt;</Code>
    <Row gap="14">
      <Button action="ripple:expand" ripple="expand" variant="solid">Expand Wave</Button>
      <Button action="scatter">Scatter</Button>
    </Row>
  </Col>
</Row>`,
  },
  {
    id: 'mind-map',
    label: 'Mind Map',
    markup: `<Col gap="16" align="center">
  <MindMap layout="radial" ripple="pulse">
    Living Field
      - Physics
        - Repel &amp; Vortex
        - Gentle Breeze
      - Layouts
        - Pipe Tables
        - Bullet Lists
      - Ripples
        - Click Expand
        - Sweep Wave
      - Palettes
        - Aurora
        - Sunbeam
  </MindMap>
  <Row gap="14">
    <Button action="ripple:expand" variant="solid">Expand Ripple</Button>
    <Button action="scatter">Scatter Nodes</Button>
  </Row>
</Col>`,
  },
];
