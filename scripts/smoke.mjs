// Browser smoke test: `bun run test:smoke`. Starts Vite, drives Chrome via playwright-core.
// Uses the installed Chrome (or set CHROME_PATH). WebGL runs on SwiftShader, so no GPU is needed.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const job = (i) => `<Heading size="sm" align="left">Engineer - Company ${i + 1}</Heading>
<List width="640">
- Led the design and development of a plugin based framework for an enterprise monitoring system
- Architected a real time monitoring module for 5,000+ devices across multiple clusters
- Mentored junior engineers on modular architecture and clean code principles
</List>`;
const LONG = `<Col gap="12" align="start"><Heading size="lg" align="left">Long layout</Heading>
${Array.from({ length: 8 }, (_, i) => job(i)).join('')}
<Row gap="12"><Button action="first">First</Button><Button action="second">Second</Button></Row></Col>`;

// 5 branches × 4 × 3: too big for one screen at a readable size.
const BIG_MAP = `<Col align="center"><MindMap layout="radial">
Career Overview
${Array.from({ length: 5 }, (_, b) => `  - Branch ${b + 1} topic
${Array.from({ length: 4 }, (_, c) => `    - Sub topic ${b + 1}.${c + 1}
${Array.from({ length: 3 }, (_, d) => `      - Detail ${b + 1}.${c + 1}.${d + 1}`).join('\n')}`).join('\n')}`).join('\n')}
</MindMap></Col>`;

// A branch with 19 direct items (nothing below them to fold) above a row of buttons.
const PAGED_MAP = `<Col gap="24" align="center"><MindMap layout="radial">
Profile
  - Experience
${Array.from({ length: 19 }, (_, i) => `    - Role highlight ${i + 1}`).join('\n')}
  - Architecture
    - Pattern 1
    - Pattern 2
  - Skills
    - Skill 1
    - Skill 2
</MindMap>
<Row gap="16"><Button action="back">Back</Button><Button action="gust">Gust</Button></Row></Col>`;

// A 40×40 icon SVG with only a viewBox (no width/height), like many icon sets ship.
const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="9" fill="#2563eb"/></svg>');
const LINKS = `<Col gap="18"><Heading>Links</Heading><Row gap="18">
<Image src="${ICON}" width="40" height="40" action="open:https://example.com/profile" />
<Image src="${ICON}" width="28" height="28" action="open:javascript:alert(1)" />
</Row></Col>`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const frames = (n) =>
    page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

  // 1. Demo app boots.
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await frames(10);
  const demo = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? [c.clientWidth, c.clientHeight] : null; });
  check('demo renders a full-window canvas', demo?.[0] === 1280 && demo?.[1] === 800, JSON.stringify(demo));

  // 2. Long layout: keyboard scrolling and buttons.
  await page.goto(`${base}/tests/smoke/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate((m) => window.make(m), LONG);
  await page.waitForFunction(() => window.dust.scrollHeight > 0, null, { timeout: 15000 });
  await page.focus('#c');
  const max = await page.evaluate(() => window.dust.scrollHeight);
  check('long layout is scrollable', max > 0, `max ${Math.round(max)}`);
  check('scroll hint shows', await page.evaluate(() => !!window.dust.hints.down));

  await page.keyboard.press('End');
  await page.waitForFunction(() => Math.abs(window.dust.scrollTop - window.dust.scrollHeight) < 1);
  check('End scrolls to the end', true);
  await page.keyboard.press('Home');
  await page.waitForFunction(() => window.dust.scrollTop < 1);
  check('Home scrolls to the top', true);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.dust.scrollTop > 40);
  check('ArrowDown scrolls a line', true);

  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.dust.layoutHitRegions.some((r) => r.action === 'first'), null, { timeout: 10000 });
  await page.keyboard.press('Enter');
  check('Tab + Enter activates the first button', (await page.evaluate(() => window.actions)).includes('first'));
  await page.keyboard.press('Tab');
  await page.keyboard.press(' ');
  check('Tab + Space activates the next button', (await page.evaluate(() => window.actions)).includes('second'));

  // 3. Layouts stay formed while being read; opt-in dissolves.
  await page.evaluate((m) => window.make(m, { physics: { cursorMode: 'off', autoDissolveSec: 0.3 } }), LONG);
  await frames(60);
  check('layout does not auto-dissolve by default', await page.evaluate(() => window.dust.dissolveStartedAt === null));
  await page.evaluate((m) => window.make(m, { layoutAutoDissolve: true, physics: { cursorMode: 'off', autoDissolveSec: 0.3 } }), LONG);
  await page.waitForFunction(() => window.dust.dissolveStartedAt !== null, null, { timeout: 10000 });
  check('layoutAutoDissolve: true dissolves', true);

  // 4. Text mode never scrolls or captures the wheel.
  await page.evaluate(() => window.make(null, { text: 'Hello' }));
  await frames(20);
  const text = await page.evaluate(() => {
    const ev = new WheelEvent('wheel', { deltaY: 200, cancelable: true });
    window.dust.canvas.dispatchEvent(ev);
    return { max: window.dust.scrollHeight, prevented: ev.defaultPrevented };
  });
  check('text mode is not scrollable and leaves the wheel alone', text.max === 0 && !text.prevented, JSON.stringify(text));

  // 5. Mind maps: collapse to fit, open on click / Enter (engine-managed state).
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate((m) => window.make(m), BIG_MAP);
    await page.waitForFunction(() => window.dust.layoutHitRegions.length > 0, null, { timeout: 15000 });
    const s = await page.evaluate(() => ({ collapsed: window.dust.mmShownCollapsed.size, nodes: window.dust.layoutHitRegions.length }));
    check(`big mind map collapses to fit at ${w}px`, s.collapsed > 0, JSON.stringify(s));
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate((m) => { window.actions = []; window.make(m); }, BIG_MAP);
  await page.waitForFunction(() => window.dust.layoutHitRegions.length > 0, null, { timeout: 15000 });
  const target = await page.evaluate(() => {
    const r = window.dust.layoutHitRegions.find((h) => window.dust.mmShownCollapsed.has(h.action.slice('mindmap:toggle:'.length)));
    return r && { id: r.action.slice('mindmap:toggle:'.length), x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(target.x, target.y);
  await page.waitForFunction((id) => !window.dust.mmShownCollapsed.has(id), target.id, { timeout: 10000 });
  check('clicking a collapsed node opens it', (await page.evaluate(() => window.actions)).some((a) => a.startsWith('mindmap:toggle:')));
  await page.focus('#c');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => window.dust.kbFocusId);
  const before = await page.evaluate(() => [...window.dust.mmShownCollapsed].sort().join());
  await page.keyboard.press('Enter');
  await page.waitForFunction((b) => [...window.dust.mmShownCollapsed].sort().join() !== b, before, { timeout: 10000 });
  check('Enter on a focused mind map node toggles it', focused >= 0);

  // 6. Mind maps stay within budget and screen: big branches page instead of scrolling.
  await page.setViewportSize({ width: 1400, height: 720 });
  await page.evaluate((m) => window.make(m), PAGED_MAP);
  await page.waitForFunction(() => window.dust.layoutHitRegions.length > 0, null, { timeout: 15000 });
  const clickRegion = async (pred) => {
    const r = await page.evaluate((src) => {
      const f = new Function('h', `return ${src}`);
      const h = window.dust.layoutHitRegions.find((x) => f(x));
      return h && { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    }, pred);
    await page.mouse.click(r.x, r.y);
    await page.mouse.move(2, 2);
  };
  check('mind map loads without scrolling', (await page.evaluate(() => window.dust.scrollHeight)) === 0);
  await clickRegion("h.label === 'Experience'");
  await page.waitForFunction(() => window.dust.layoutHitRegions.some((h) => h.action.endsWith(':next')), null, { timeout: 15000 });
  const opened = await page.evaluate(() => ({ scroll: window.dust.scrollHeight, more: window.dust.layoutHitRegions.find((h) => h.action.endsWith(':next'))?.label }));
  check('opening a 19-item branch pages it instead of scrolling', opened.scroll === 0 && /^\+\d+ more/.test(opened.more ?? ''), JSON.stringify(opened));
  await clickRegion("h.action.endsWith(':next')");
  await page.waitForFunction(() => window.dust.layoutHitRegions.some((h) => h.action.endsWith(':prev')), null, { timeout: 15000 });
  check('"+N more" shows the next page (with "previous")', (await page.evaluate(() => window.dust.scrollHeight)) === 0);
  await clickRegion("h.action.endsWith(':prev')");
  await page.waitForFunction(() => !window.dust.layoutHitRegions.some((h) => h.action.endsWith(':prev')), null, { timeout: 15000 });
  check('"previous" goes back to the first page', true);

  // 7. Icon links: actions on images, open:<url> opens safe links in a new tab.
  await page.evaluate(() => { window.opened = []; window.open = (u, t, f) => { window.opened.push([u, t, f]); return null; }; });
  const iconCenter = (needle) => page.evaluate((n) => {
    const h = window.dust.layoutHitRegions.find((r) => r.action.includes(n));
    return h && { x: h.x + h.width / 2, y: h.y + h.height / 2 };
  }, needle);
  await page.evaluate((m) => { window.actions = []; window.make(m); }, LINKS);
  await page.waitForFunction(() => window.dust.layoutHitRegions.length === 2, null, { timeout: 15000 });
  const icon = await iconCenter('example.com');
  await page.mouse.click(icon.x, icon.y);
  const openCalls = await page.evaluate(() => window.opened);
  check('clicking an icon with action="open:…" opens the link in a new tab',
    openCalls.length === 1 && openCalls[0][0] === 'https://example.com/profile' && openCalls[0][1] === '_blank', JSON.stringify(openCalls));
  check('a 28px icon keeps its size (hit box 28 + 2×4 padding)',
    await page.evaluate(() => window.dust.layoutHitRegions.find((r) => r.action.includes('javascript')).width === 36));
  const bad = await iconCenter('javascript');
  await page.mouse.click(bad.x, bad.y);
  check('javascript: links are not opened (action still reported)',
    (await page.evaluate(() => window.opened.length)) === 1 && (await page.evaluate(() => window.actions.length)) === 2);
  await page.evaluate((m) => { window.opened = []; window.make(m, { openLinks: false }); }, LINKS);
  await page.waitForFunction(() => window.dust.layoutHitRegions.length === 2, null, { timeout: 15000 });
  const again = await iconCenter('example.com');
  await page.mouse.click(again.x, again.y);
  check('openLinks: false leaves navigation to the app', (await page.evaluate(() => window.opened.length)) === 0);
  check('a viewBox-only SVG icon is sampled whole', await page.evaluate(() => {
    const d = window.dust, h = d.layoutHitRegions[0], pool = d.pool;
    let top = 0, bottom = 0;
    for (let i = 0; i < pool.count; i++) {
      if (!pool.hasTarget[i] || pool.regionId[i] !== h.rippleRegionId) continue;
      if (pool.ty[i] < h.y + h.height / 2) top++; else bottom++;
    }
    return top > 50 && bottom > 50 && Math.abs(top - bottom) / (top + bottom) < 0.25;
  }));

  // 8. Per-element density: own attribute, inherited from a container, default from the scene.
  const counts = await page.evaluate(async () => {
    const { parseLayoutMarkup } = await import('/src/engine/layoutParser.ts');
    const { sampleLayoutScene } = await import('/src/engine/layoutEngine.ts');
    const { DEFAULT_IMAGE_TUNING } = await import('/src/engine/imageSampler.ts');
    await document.fonts.ready;
    const h = (d) => `<Heading size="xl"${d ? ` density="${d}"` : ''}>Density</Heading>`;
    const markup = `<Col gap="20">${h()}${h('dense')}${h('sparse')}<Col density="dense">${h()}${h('sparse')}</Col></Col>`;
    const scene = sampleLayoutScene(parseLayoutMarkup(markup).root, 1280, 1400, 'balanced', 'serif', false, true,
      DEFAULT_IMAGE_TUNING, new Map(), () => null, { trim: false, particleBudget: 1e9 });
    const per = new Map();
    for (const p of scene.points) per.set(p.regionId, (per.get(p.regionId) ?? 0) + 1);
    return scene.rippleRegions.filter((r) => r.tag === 'Heading').map((r) => per.get(r.id) ?? 0);
  });
  const [plain, dense, sparse, inherited, overridden] = counts;
  check('density attribute changes an element\'s particle count (dense > default > sparse)',
    dense > plain * 1.5 && sparse < plain * 0.8, counts.join(' / '));
  check('density is inherited from a container and can be overridden inside it',
    Math.abs(inherited - dense) / dense < 0.1 && Math.abs(overridden - sparse) / sparse < 0.1);

  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
