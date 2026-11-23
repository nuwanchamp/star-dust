import { describe, expect, test } from 'bun:test';
import { ScrollHints } from '../src/engine/scrollHint';
import { pool } from './helpers';

const state = { centerX: 600, bandTop: 32, bandBottom: 600, canvasHeight: 800 };

describe('ScrollHints', () => {
  test('borrows free particles for a visible hint and gives them back', () => {
    const p = pool(3000);
    const hints = new ScrollHints();
    hints.reset(p.capacity);
    hints.update(p, { ...state, showDown: true, showUp: false }, 0, 0);
    const borrowed = Array.from({ length: p.count }, (_, i) => i).filter((i) => hints.isHint(i));
    expect(borrowed.length).toBeGreaterThan(100);
    expect(borrowed.every((i) => p.hasTarget[i] === 1)).toBe(true);
    // The down hint sits just below the band.
    expect(hints.hit(600, 626)).toBe('down');
    expect(hints.hit(600, 300)).toBeNull();

    hints.update(p, { ...state, showDown: false, showUp: false }, 0.1, 100);
    expect(borrowed.every((i) => !hints.isHint(i) && p.hasTarget[i] === 0)).toBe(true);
    expect(hints.hit(600, 626)).toBeNull();
  });

  test('never takes particles that are already forming content', () => {
    const p = pool(1000);
    for (let i = 0; i < p.count; i++) p.hasTarget[i] = 1; // all busy
    const hints = new ScrollHints();
    hints.reset(p.capacity);
    hints.update(p, { ...state, showDown: true, showUp: true }, 0, 0);
    for (let i = 0; i < p.count; i++) expect(hints.isHint(i)).toBe(false);
  });
});
