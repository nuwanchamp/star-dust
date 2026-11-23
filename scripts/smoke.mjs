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

  // 8. formStaggerMs: leaving the wave, particles join their shape over time instead of all at once.
  const waiting = () => page.evaluate(() => {
    const p = window.dust.pool, now = performance.now();
    let targeted = 0, later = 0;
    for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) { targeted++; if (p.joinAt[i] > now) later++; }
    return { targeted, later };
  });
  const formFromWave = async (opts) => {
    await page.evaluate((o) => window.make(null, { freeDrift: true, text: 'Hello', ...o }), opts);
    await frames(5);
    await page.evaluate(() => window.dust.setOptions({ freeDrift: false }));
    await page.waitForFunction(() => { const p = window.dust.pool; for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) return true; return false; }, null, { timeout: 10000 });
    return waiting();
  };
  const staggered = await formFromWave({ formStaggerMs: 1500 });
  check('formStaggerMs: most particles wait on the wave at first', staggered.later > staggered.targeted * 0.6, JSON.stringify(staggered));
  await page.waitForTimeout(1700);
  check('formStaggerMs: all have joined after the span', (await waiting()).later === 0);
  const instant = await formFromWave({});
  check('default: everything heads for its place at once', instant.targeted > 0 && instant.later === 0, JSON.stringify(instant));

  // 9. The pour is visible: particles still waiting on the wave keep their wave brightness in a layout.
  const ribbonAlpha = () => page.evaluate(() => {
    const d = window.dust, p = d.pool, v = d.vertexData, now = performance.now();
    let sum = 0, n = 0;
    for (let i = 0; i < p.count; i++) {
      if (p.waveLayer[i] < 0) continue;
      if (p.hasTarget[i] && p.joinAt[i] <= now) continue; // already joined the shape
      sum += v[i * 8 + 5]; n++;
    }
    return n ? sum / n : 0;
  });
  await page.evaluate((m) => window.make(m, { freeDrift: true, formStaggerMs: 4000 }), LINKS);
  await frames(20);
  const onWave = await ribbonAlpha();
  await page.evaluate(() => window.dust.setOptions({ freeDrift: false }));
  await page.waitForFunction(() => { const p = window.dust.pool; for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) return true; return false; }, null, { timeout: 10000 });
  await frames(3);
  const pouring = await ribbonAlpha();
  check('pouring: the wave stays visible while it pours into a layout', pouring > onWave * 0.6, `${onWave.toFixed(3)} -> ${pouring.toFixed(3)}`);

  // 10. formFlowMs: new shapes melt into the Perlin wind, then condense into place.
  const flowStats = () => page.evaluate(() => {
    const p = window.dust.pool;
    let n = 0, far = 0, dist = 0, speed = 0;
    for (let i = 0; i < p.count; i++) {
      if (!p.hasTarget[i]) continue;
      n++;
      const d = Math.hypot(p.x[i] - p.tx[i], p.y[i] - p.ty[i]);
      dist += d; speed += Math.hypot(p.vx[i], p.vy[i]);
      if (d > 20) far++;
    }
    return { n, farShare: n ? far / n : 0, meanDist: n ? dist / n : 0, meanSpeed: n ? speed / n : 0, count: p.count, flowStartedAt: window.dust.flowStartedAt };
  });
  const hasTargets = () => page.waitForFunction(() => { const p = window.dust.pool; for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) return true; return false; }, null, { timeout: 10000 });
  const landed = () => page.waitForFunction(() => {
    const p = window.dust.pool; let n = 0, d = 0;
    for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) { n++; d += Math.hypot(p.x[i] - p.tx[i], p.y[i] - p.ty[i]); }
    return n > 0 && d / n < 8;
  }, null, { timeout: 20000 });

  // Same wave -> text transition with and without flow, measured at the same moment.
  const fromWaveAt800 = async (formFlowMs) => {
    await page.evaluate((f) => window.make(null, { freeDrift: true, text: 'Flow', formFlowMs: f }), formFlowMs);
    await frames(10);
    await page.evaluate(() => window.dust.setOptions({ freeDrift: false }));
    await hasTargets();
    await page.waitForTimeout(800);
    return flowStats();
  };
  const direct = await fromWaveAt800(0);
  const riding = await fromWaveAt800(2500);
  check('formFlowMs: leaving the wave, particles ride the wind first (far more spread than a direct form)',
    riding.flowStartedAt > 0 && riding.meanDist > direct.meanDist * 2 && riding.meanSpeed > 0.3,
    `direct ${direct.meanDist.toFixed(1)}px, flow ${riding.meanDist.toFixed(1)}px`);
  await landed();
  check('formFlowMs: then they condense into the shape', true);

  await page.evaluate((m) => window.make(m, { formFlowMs: 2500 }), LINKS);
  await hasTargets();
  await landed();
  const formedCount = (await flowStats()).count;
  await page.evaluate(() => window.dust.setOptions({ targetMode: 'text', text: 'Next' }));
  await hasTargets();
  const atStart = await flowStats();
  await page.waitForTimeout(400);
  const early = await flowStats();
  check('formFlowMs: the old shape melts first instead of racing to the new one (no double transition)',
    early.meanDist > atStart.meanDist * 0.9, `${atStart.meanDist.toFixed(1)}px -> ${early.meanDist.toFixed(1)}px after 0.4s`);
  await page.waitForTimeout(400);
  const sceneFlow = await flowStats();
  check('formFlowMs: scene to scene flows too, without dropping particles', sceneFlow.flowStartedAt > 0 && sceneFlow.count >= formedCount, `${formedCount} -> ${JSON.stringify(sceneFlow)}`);
  await landed();
  await page.evaluate(() => window.dust.setOptions({ physics: { ...window.dust.o.physics, density: 'sparse' } }));
  await hasTargets();
  await frames(3);
  check('formFlowMs: a re-layout of the same scene is not flowed', (await flowStats()).flowStartedAt === 0);

  // 11. formFlowMs keeps the wave's colours while particles ride the wind (spread of hues, not one tint).
  // Colourfulness: mean (max - min) of each particle's RGB (white ≈ 0, magenta/cyan high).
  const colourSpread = () => page.evaluate(() => {
    const d = window.dust, p = d.pool, v = d.vertexData;
    let n = 0, sum = 0;
    for (let i = 0; i < p.count; i++) {
      if (!d.o.freeDrift && !p.hasTarget[i]) continue;
      const r = v[i * 8 + 2], g = v[i * 8 + 3], b = v[i * 8 + 4];
      n++; sum += Math.max(r, g, b) - Math.min(r, g, b);
    }
    return sum / Math.max(1, n);
  });
  const leaveWaveSpread = async (formFlowMs) => {
    await page.evaluate((f) => window.make('<Col><Heading size="xl">Colour</Heading><Text>Layouts use a narrow, light colour band.</Text></Col>', { freeDrift: true, formFlowMs: f, palette: 'aurora' }), formFlowMs);
    await frames(20);
    await page.evaluate(() => window.dust.setOptions({ freeDrift: false }));
    await hasTargets();
    await frames(5);
    const size = await page.evaluate(() => {
      const d = window.dust, p = d.pool, v = d.vertexData;
      let n = 0, sum = 0;
      for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) { n++; sum += v[i * 8 + 6]; }
      return sum / Math.max(1, n);
    });
    return { colour: await colourSpread(), size };
  };
  const directLook = await leaveWaveSpread(0);
  const ridingLook = await leaveWaveSpread(3000);
  const directSpread = directLook.colour, ridingSpread = ridingLook.colour;
  check('formFlowMs: particles riding the wind keep the wave depth look (size), flattening only as they land',
    ridingLook.size > directLook.size * 1.1, `mean size direct ${directLook.size.toFixed(2)}, riding ${ridingLook.size.toFixed(2)}`);
  check('formFlowMs: particles riding the wind keep the wave colours (not the layout tint yet)', ridingSpread > directSpread * 1.25, `colourfulness direct ${directSpread.toFixed(3)}, riding ${ridingSpread.toFixed(3)}`);

  // 12. formFlowMs scene to scene: the old shape keeps all its dust and erodes grain by grain.
  await page.evaluate((m) => window.make(m, { formFlowMs: 3000 }), LONG);
  await hasTargets();
  await landed();
  const oldShape = await page.evaluate(() => {
    const p = window.dust.pool; const xs = [], ys = [], idx = [];
    for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) { idx.push(i); xs.push(p.x[i]); ys.push(p.y[i]); }
    window.__old = { idx, xs, ys };
    return idx.length;
  });
  // The same particles before and after the switch: everything that was background, including the
  // ones the new scene recruits (they must not flash to full brightness where they sit).
  await page.evaluate(() => {
    const p = window.dust.pool; window.__bg = [];
    for (let i = 0; i < p.count; i++) if (!p.hasTarget[i]) window.__bg.push(i);
  });
  const bgWaveAlpha = () => page.evaluate(() => {
    const v = window.dust.vertexData; let sum = 0;
    for (const i of window.__bg) sum += v[i * 8 + 5];
    return sum / Math.max(1, window.__bg.length);
  });
  const bgBefore = await bgWaveAlpha();
  // Layout to layout (same stage brightness): part of the current tree is a new, smaller scene.
  await page.evaluate(() => { window.__full = window.dust.o.layoutAst; window.dust.setOptions({ layoutAst: window.__full.children[0] }); });
  await hasTargets();
  await frames(2);
  const bgAfter = await bgWaveAlpha();
  check('flow: the background wave doesn\'t light up when one scene flows into another', bgAfter < bgBefore * 1.6, `${bgBefore.toFixed(3)} -> ${bgAfter.toFixed(3)}`);
  const kept = await page.evaluate(() => { const { idx } = window.__old, p = window.dust.pool; let n = 0; for (const i of idx) if (p.hasTarget[i]) n++; return n; });
  check('flow: a smaller new shape doesn\'t make the old one lose a chunk at once', kept >= oldShape * 0.98, `${oldShape} in old shape, ${kept} still in it`);
  await page.waitForTimeout(450);
  const erosion = await page.evaluate(() => {
    const { idx, xs, ys } = window.__old, p = window.dust.pool; let still = 0;
    idx.forEach((i, k) => { if (Math.hypot(p.x[i] - xs[k], p.y[i] - ys[k]) < 2) still++; });
    return still / idx.length;
  });
  check('flow: the old shape erodes grain by grain (some let go, the rest still hold)', erosion > 0.3 && erosion < 0.97, `${(erosion * 100).toFixed(0)}% still in place after ~0.45s`);
  // Growing scene (needs more dust than the old one has): it's built only from the old shape's dust;
  // background dust takes no part, and the extra particles fade in once the old shape has dissolved.
  await landed();
  await page.evaluate(() => {
    const p = window.dust.pool; window.__bg = [];
    for (let i = 0; i < p.count; i++) if (!p.hasTarget[i]) window.__bg.push(i);
  });
  const bgLook = () => page.evaluate(() => {
    const v = window.dust.vertexData; let sum = 0;
    for (const i of window.__bg) sum += v[i * 8 + 5] * (1 + v[i * 8 + 7]);
    return sum / Math.max(1, window.__bg.length);
  });
  const bornLook = () => page.evaluate(() => {
    const p = window.dust.pool, v = window.dust.vertexData; let n = 0, a = 0;
    for (let i = window.__firstBorn; i < p.count; i++) { n++; a += v[i * 8 + 5]; }
    return { n, alpha: a / Math.max(1, n) };
  });
  const lookBefore = await bgLook();
  await page.evaluate(() => { window.__firstBorn = window.dust.pool.count; window.dust.setOptions({ layoutAst: window.__full }); });
  await page.waitForFunction(() => window.dust.flowStartedAt > 0, null, { timeout: 10000 });
  await frames(2);
  // (The scroll hint's chevrons legitimately take free particles when the bigger scene scrolls.)
  const recruited = await page.evaluate(() => { const d = window.dust, p = d.pool; let n = 0; for (const i of window.__bg) if (p.hasTarget[i] && !d.hints.isHint(i)) n++; return n; });
  check('flow: a bigger scene is built only from the old scene\'s dust (no background dust recruited)', recruited === 0, `${recruited} background particles took a place`);
  const bornEarly = await bornLook();
  check('flow: extra particles for a bigger scene are invisible while the old one dissolves', bornEarly.n > 0 && bornEarly.alpha < 0.01, JSON.stringify(bornEarly));
  await page.waitForTimeout(500);
  const lookMid = await bgLook();
  check('flow: the background stays as it was (no bloom or flicker at the edges)', lookMid < lookBefore * 1.25 && lookMid > lookBefore * 0.75, `${lookBefore.toFixed(3)} -> ${lookMid.toFixed(3)}`);
  await landed();
  // Past the span: they start fading in at 70% of it and take ~0.9s (+ up to 0.45s jitter).
  await page.waitForFunction(() => performance.now() > window.dust.flowStartedAt + 3000 * 0.7 + 1500, null, { timeout: 15000 });
  await frames(3);
  const bornLate = await bornLook();
  check('flow: …and they have faded in once the new scene has formed', bornLate.alpha > 0.1, JSON.stringify(bornLate));

  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
