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

  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
