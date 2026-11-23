import { describe, expect, test } from 'bun:test';
import { LayoutWindow } from '../src/engine/layoutWindow';
import { assignedTargets, pool, textLines } from './helpers';

const VIEW = 800;
const BOUNDS = { top: 32, bottom: VIEW - 32 };

describe('LayoutWindow scroll range', () => {
  test('content that fits the band and the budget needs no scrolling (regression)', () => {
    // 10 lines x 300 points = 3000 targets, budget 30000; content starts well below the band top
    // (centered layout). This used to report a scroll range of ~100-200px.
    const w = new LayoutWindow(textLines(10, 300, 300), 30000, [], VIEW, 'auto', BOUNDS);
    expect(w.scrollEnd()).toBe(0);
  });

  test('auto: content over budget scrolls far enough to reach the last line', () => {
    const w = new LayoutWindow(textLines(60, 1000), 20000, [], VIEW, 'auto', BOUNDS);
    const end = w.scrollEnd();
    expect(end).toBeGreaterThan(0);
    // At the end, the band contains the last line.
    const band = w.band(end);
    const lastLineBottomOnScreen = 100 + 59 * 24 + 10 - end;
    expect(band.bottom).toBeGreaterThanOrEqual(lastLineBottomOnScreen - 1);
  });

  test('fixed band: scrolls until the last point is inside it', () => {
    const w = new LayoutWindow(textLines(60, 200), 30000, [], VIEW, 300, BOUNDS);
    const end = w.scrollEnd();
    expect(100 + 59 * 24 + 10 - end).toBeLessThanOrEqual(BOUNDS.top + 300);
  });
});

describe('LayoutWindow band', () => {
  test('auto: band ends in the gap between two lines and is never thinned', () => {
    const budget = 5000; // 1000 points per line -> 5 lines fit
    const w = new LayoutWindow(textLines(40, 1000), budget, [], VIEW, 'auto', BOUNDS);
    const band = w.band(0);
    // Each line occupies [100 + k*24, 110 + k*24]; the cut must not fall inside a line.
    const rel = (band.bottom - 100) % 24;
    expect(rel === 0 || rel > 10).toBe(true);
    const p = pool(budget + 2000);
    w.assignAll(p, 0, 1200, VIEW);
    const assigned = assignedTargets(p);
    expect(assigned.size).toBeLessThanOrEqual(budget);
    expect(assigned.size % 1000).toBe(0); // whole lines only: nothing thinned
  });

  test('screen mode thins evenly when the screen holds more than the budget', () => {
    const w = new LayoutWindow(textLines(30, 1000), 10000, [], VIEW, 'screen');
    const p = pool(20000);
    w.assignAll(p, 0, 1200, VIEW);
    const assigned = assignedTargets(p).size;
    // ~10000 kept out of the ~28000 visible (plus a small margin band)
    expect(assigned).toBeGreaterThan(8000);
    expect(assigned).toBeLessThan(14000);
  });

  test('priority regions (buttons) are never thinned', () => {
    const pts = textLines(30, 1000);
    const w = new LayoutWindow(pts, 5000, [3], VIEW, 'screen');
    const p = pool(12000);
    w.assignAll(p, 0, 1200, VIEW);
    let button = 0;
    for (let i = 0; i < p.count; i++) if (p.hasTarget[i] && p.regionId[i] === 3) button++;
    expect(button).toBe(1000);
  });
});

describe('LayoutWindow.update', () => {
  test('scrolling hands released particles to incoming content without double-assigning', () => {
    const w = new LayoutWindow(textLines(80, 500), 12000, [], VIEW, 'auto', BOUNDS);
    const p = pool(w.poolNeed + 3000);
    w.assignAll(p, 0, 1200, VIEW);
    const before = assignedTargets(p).size;
    let scroll = 0;
    for (let s = 0; s < 40; s++) {
      scroll += 20;
      // the engine shifts targets of formed particles before calling update
      for (let i = 0; i < p.count; i++) if (p.hasTarget[i]) p.ty[i] -= 20;
      w.update(p, scroll, s * 16);
    }
    const after = assignedTargets(p); // throws on duplicates
    expect(Math.abs(after.size - before) / before).toBeLessThan(0.1);
    // Everything formed lies inside the band at the final scroll.
    const band = w.band(scroll);
    for (let i = 0; i < p.count; i++) {
      if (p.hasTarget[i]) {
        expect(p.ty[i]).toBeGreaterThanOrEqual(band.top - 1);
        expect(p.ty[i]).toBeLessThanOrEqual(band.bottom + 1);
      }
    }
  });
});
