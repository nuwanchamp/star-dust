import { describe, expect, test } from 'bun:test';
import {
  BUDGET_SHARE,
  estimateCost,
  type MindMapContext,
  type MindMapStyle,
  type MindMapTreeItem,
  type TextMeasurer,
  layoutMindMap,
} from '../src/engine/mindMapLayout';

/** Fake text measurer: each character is 0.55 × the font size wide. */
const measurer: TextMeasurer = {
  font: '',
  measureText(text: string) {
    const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '14');
    return { width: text.length * size * 0.55 };
  },
};

/** A tree with `fan[0]` branches, each with `fan[1]` children, each with `fan[2]` children… */
function tree(fan: number[]): MindMapTreeItem {
  const make = (id: string, depth: number): MindMapTreeItem => ({
    id,
    label: depth === 0 ? 'Center topic' : `Node ${id.split('/').slice(1).join('.')}`,
    depth,
    collapsedAttr: false,
    attrs: {},
    children: depth < fan.length ? Array.from({ length: fan[depth] }, (_, i) => make(`${id}/${i}`, depth + 1)) : [],
  });
  return make('m/0', 0);
}

const style = (layout: 'radial' | 'tree' = 'radial', compact = false): MindMapStyle => ({
  layout,
  fontFamily: 'sans',
  siblingGap: 14,
  levelGap: 54,
  branchGap: 22,
  compact,
});

/** Natural size (no enlarging) unless a test asks for it, so geometry tests compare real sizes. */
function ctx(overrides: Partial<MindMapContext> = {}): MindMapContext {
  return { fit: 'collapse', maxW: 10_000, maxH: 10_000, maxScale: 1, collapsedOut: new Set(), droppedOut: new Set(), ...overrides };
}

const BIG = [5, 4, 3]; // 5 branches × 4 × 3 = 85 nodes
const full = layoutMindMap(tree(BIG), style(), ctx({ fit: 'shrink' }), measurer);
const visibleIds = (r: ReturnType<typeof layoutMindMap>) => new Set(r.data.nodes.map((n) => n.id));

describe('layoutMindMap auto-collapse', () => {
  test('a map that fits is left fully expanded', () => {
    const c = ctx();
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    expect(r.data.nodes.length).toBe(86);
    expect(c.collapsedOut.size).toBe(0);
  });

  test('a map that is too big collapses deep levels until it fits', () => {
    const c = ctx({ maxW: full.width * 0.8, maxH: full.height * 0.5 });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    expect(r.width).toBeLessThanOrEqual(c.maxW);
    expect(r.height).toBeLessThanOrEqual(c.maxH);
    expect(r.data.nodes.length).toBeLessThan(86);
    // Root and all first-level branches are always visible.
    const ids = visibleIds(r);
    for (let i = 0; i < 5; i++) expect(ids.has(`m/0/${i}`)).toBe(true);
    expect(c.collapsedOut.has('m/0')).toBe(false);
    // Collapsed nodes show how much is hidden.
    expect(r.data.nodes.some((n) => n.isCollapsed && n.badgeText.startsWith('+'))).toBe(true);
  });

  test('when nothing fits, every first-level branch stays visible or one pager click away', () => {
    const c = ctx({ maxW: 50, maxH: 50 });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    const ids = visibleIds(r);
    const rootPaged = r.data.nodes.some((n) => n.pagerOf === 'm/0');
    for (let i = 0; i < 5; i++) expect(ids.has(`m/0/${i}`) || rootPaged).toBe(true);
  });

  test('a radial map too wide for a phone switches to the tree layout', () => {
    const radialL1 = layoutMindMap(tree([5]), style('radial', true), ctx({ fit: 'shrink' }), measurer);
    const treeL1 = layoutMindMap(tree([5]), style('tree', true), ctx({ fit: 'shrink' }), measurer);
    expect(treeL1.width).toBeLessThan(radialL1.width);
    const c = ctx({ maxW: (radialL1.width + treeL1.width) / 2, maxH: 2000 });
    const r = layoutMindMap(tree(BIG), style('radial', true), c, measurer);
    expect(r.data.layout).toBe('tree');
    expect(r.width).toBeLessThanOrEqual(c.maxW);
  });

  test('opening a branch closes older ones when there is only room for one', () => {
    // Room for the first level plus roughly one opened branch.
    const l1 = layoutMindMap(tree(BIG), style(), ctx({ maxW: 1, maxH: 1 }), measurer);
    const c = ctx({
      maxW: l1.width * 1.6,
      maxH: l1.height * 1.15,
      expanded: new Map([
        ['m/0/0', 1],
        ['m/0/1', 2], // newest
      ]),
    });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    const ids = visibleIds(r);
    expect(ids.has('m/0/1/0')).toBe(true); // newest stays open
    expect(c.droppedOut.has('m/0/0')).toBe(true); // older one was closed
    expect(ids.has('m/0/0/0')).toBe(false);
  });

  test('a deep expansion keeps its ancestors open', () => {
    const c = ctx({ maxW: full.width * 0.6, maxH: full.height * 0.4, expanded: new Map([['m/0/2/1', 1]]) });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    const ids = visibleIds(r);
    expect(ids.has('m/0/2/1')).toBe(true);
    expect(ids.has('m/0/2/1/0')).toBe(true);
  });

  test('a node the user closed stays closed', () => {
    const c = ctx({ collapsed: new Set(['m/0/3']) });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    expect(visibleIds(r).has('m/0/3/0')).toBe(false);
    expect(c.collapsedOut.has('m/0/3')).toBe(true);
  });
});

describe('layoutMindMap without auto-fit', () => {
  test("fit: 'shrink' never collapses on its own", () => {
    const c = ctx({ fit: 'shrink', maxW: 50, maxH: 50 });
    expect(layoutMindMap(tree(BIG), style(), c, measurer).data.nodes.length).toBe(86);
  });

  test('app-controlled ids keep the old XOR-with-markup behavior and ignore the limits', () => {
    const t = tree(BIG);
    t.children[1].collapsedAttr = true; // markup says collapsed
    const c = ctx({ controlledIds: new Set(['m/0/1', 'm/0/2']), maxW: 50, maxH: 50 });
    const ids = visibleIds(layoutMindMap(t, style(), c, measurer));
    expect(ids.has('m/0/1/0')).toBe(true); // markup collapsed, toggled -> open
    expect(ids.has('m/0/2/0')).toBe(false); // open, toggled -> collapsed
    expect(ids.has('m/0/0/0')).toBe(true); // untouched, limits ignored
  });
});

describe('layoutMindMap when nothing fits', () => {
  test('opening one branch does not open the others (regression)', () => {
    // Too narrow for even one opened branch: every attempt overflows by the same width.
    const l1 = layoutMindMap(tree(BIG), style('tree', true), ctx({ maxW: 1, maxH: 1 }), measurer);
    const c = ctx({ maxW: l1.width, maxH: 5000, expanded: new Map([['m/0/0', 1]]) });
    const r = layoutMindMap(tree(BIG), style('radial', true), c, measurer);
    const ids = visibleIds(r);
    expect(ids.has('m/0/0/0')).toBe(true); // the opened branch
    expect(ids.has('m/0/1/0')).toBe(false); // the others stay closed
    expect(ids.has('m/0/4/0')).toBe(false);
  });
});

describe('layoutMindMap enlarging', () => {
  const small = () => layoutMindMap(tree([3]), style(), ctx(), measurer);

  test('a map with free space around it is enlarged, up to maxScale', () => {
    const natural = small();
    const r = layoutMindMap(tree([3]), style(), ctx({ maxScale: 1.6 }), measurer);
    expect(r.width / natural.width).toBeCloseTo(1.6, 1);
    const root = r.data.nodes.find((n) => n.depth === 0)!;
    expect(root.fontSize).toBeCloseTo(19 * 1.6, 1); // labels grow with it
  });

  test('enlarging leaves room around the map (≤ 92% width, ≤ 70% height)', () => {
    const natural = small();
    const c = ctx({ maxScale: 3, maxW: natural.width * 1.5, maxH: natural.height * 10 });
    const r = layoutMindMap(tree([3]), style(), c, measurer);
    expect(r.width).toBeLessThanOrEqual(Math.ceil(c.maxW * 0.92));
    expect(r.width).toBeGreaterThan(natural.width);
  });

  test('a map that had to collapse is still enlarged into the space left', () => {
    const c = ctx({ maxScale: 1.6, maxW: full.width * 0.8, maxH: full.height * 0.5 });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    expect(r.width).toBeLessThanOrEqual(c.maxW);
    expect(r.height).toBeLessThanOrEqual(c.maxH);
  });

  test('maxScale 1 keeps the natural size', () => {
    expect(layoutMindMap(tree([3]), style(), ctx({ maxScale: 1 }), measurer).width).toBe(small().width);
  });
});

const fullCost = estimateCost(full);

describe('layoutMindMap particle budget', () => {

  test('cost goes down as nodes fold', () => {
    const l1 = layoutMindMap(tree(BIG), style(), ctx({ maxW: 1, maxH: 1 }), measurer);
    expect(estimateCost(l1)).toBeLessThan(fullCost);
  });

  test('a map over budget folds until it fits, even when its size would fit', () => {
    const budget = (fullCost * 0.4) / BUDGET_SHARE;
    const r = layoutMindMap(tree(BIG), style(), ctx({ budget }), measurer);
    expect(estimateCost(r)).toBeLessThanOrEqual(budget * BUDGET_SHARE);
    expect(r.data.nodes.length).toBeLessThan(86);
    for (let i = 0; i < 5; i++) expect(r.data.nodes.some((n) => n.id === `m/0/${i}`)).toBe(true);
  });

  test('enlarging stays within the budget', () => {
    const small = layoutMindMap(tree([3]), style(), ctx(), measurer);
    const budget = (estimateCost(small) * 1.5) / BUDGET_SHARE; // room for ~1.22×, not 3×
    const r = layoutMindMap(tree([3]), style(), ctx({ maxScale: 3, budget }), measurer);
    expect(r.width / small.width).toBeLessThan(1.3);
    expect(estimateCost(r)).toBeLessThanOrEqual(budget * BUDGET_SHARE * 1.02);
  });
});

describe('layoutMindMap folding order', () => {
  // Side of each first-level branch in the radial layout (all first-level collapsed = baseline).
  const firstLevel = new Set(Array.from({ length: 5 }, (_, i) => `m/0/${i}`));
  const baseline = layoutMindMap(tree(BIG), style(), ctx({ fit: 'shrink', collapsed: firstLevel }), measurer);
  const sideOf = new Map(baseline.data.nodes.filter((n) => n.depth === 1).map((n) => [n.id, n.dir]));
  const branchOf = (id: string) => id.split('/').slice(0, 3).join('/');

  test('first-level branches keep their side as branches open', () => {
    for (const open of ['m/0/0', 'm/0/1', 'm/0/3']) {
      const r = layoutMindMap(tree(BIG), style(), ctx({ expanded: new Map([[open, 1]]) }), measurer);
      for (const n of r.data.nodes.filter((x) => x.depth === 1)) expect(n.dir).toBe(sideOf.get(n.id)!);
    }
  });

  test('opening a branch folds the opposite side before its own side', () => {
    const newest = 'm/0/0';
    const mySide = sideOf.get(newest);
    const c = ctx({ budget: (fullCost * 0.55) / BUDGET_SHARE, expanded: new Map([[newest, 1]]) });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    const folded = (n: { isCollapsed: boolean; totalChildCount: number }) => n.isCollapsed && n.totalChildCount > 0;
    const opposite = r.data.nodes.filter((n) => n.depth === 1 && sideOf.get(n.id) !== mySide);
    const sameSideFoldedSomewhere = r.data.nodes.some(
      (n) => n.depth >= 1 && folded(n) && sideOf.get(branchOf(n.id)) === mySide && !n.id.startsWith(newest)
    );
    // If anything on my side had to fold, the whole opposite side must already be folded to +N.
    if (sameSideFoldedSomewhere) for (const n of opposite) expect(folded(n)).toBe(true);
    // And the opposite side did give way.
    expect(opposite.some(folded)).toBe(true);
    // The opened branch shows its children.
    expect(r.data.nodes.some((n) => n.id.startsWith(`${newest}/`))).toBe(true);
  });

  test('the newest opened branch and its ancestors never fold, even on a tiny budget', () => {
    const c = ctx({ budget: 1, expanded: new Map([['m/0/2/1', 1]]) });
    const r = layoutMindMap(tree(BIG), style(), c, measurer);
    const ids = new Set(r.data.nodes.map((n) => n.id));
    expect(ids.has('m/0/2/1/0')).toBe(true);
    expect(c.collapsedOut.has('m/0/2')).toBe(false);
  });
});

describe('layoutMindMap paging', () => {
  // Root with 3 branches; the first has 19 direct leaf children (nothing below them to fold).
  const flat = (): MindMapTreeItem => {
    const t = tree([3, 2]);
    t.children[0].children = Array.from({ length: 19 }, (_, i) => ({
      id: `m/0/0/${i}`,
      label: `Item ${i + 1}`,
      depth: 2,
      collapsedAttr: false,
      attrs: {},
      children: [],
    }));
    return t;
  };
  const opened = new Map([['m/0/0', 1]]);
  const natural = layoutMindMap(flat(), style(), ctx({ expanded: opened }), measurer);
  const limits = { maxW: natural.width * 2, maxH: natural.height * 0.5 }; // too short for 19 rows
  const shownItems = (r: ReturnType<typeof layoutMindMap>) =>
    r.data.nodes.filter((n) => n.id.startsWith('m/0/0/') && !n.pager).map((n) => n.id);

  test('an opened branch with too many children shows one page plus "+N more ▸"', () => {
    const c = ctx({ ...limits, expanded: opened });
    const r = layoutMindMap(flat(), style(), c, measurer);
    expect(r.height).toBeLessThanOrEqual(c.maxH);
    const items = shownItems(r);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(19);
    const more = r.data.nodes.find((n) => n.pager === 'next');
    expect(more?.pagerOf).toBe('m/0/0');
    expect(more?.label).toBe(`+${19 - items.length} more ▸`);
    expect(r.data.nodes.some((n) => n.pager === 'prev')).toBe(false);
  });

  test('every child is reachable by paging forward', () => {
    const seen = new Set<string>();
    for (let page = 0; page < 19; page++) {
      const r = layoutMindMap(flat(), style(), ctx({ ...limits, expanded: opened, pages: new Map([['m/0/0', page]]) }), measurer);
      for (const id of shownItems(r)) seen.add(id);
      if (page > 0) expect(r.data.nodes.some((n) => n.pager === 'prev')).toBe(true);
      if (!r.data.nodes.some((n) => n.pager === 'next')) break;
    }
    expect(seen.size).toBe(19);
  });

  test('a branch that fits is not paged', () => {
    const r = layoutMindMap(flat(), style(), ctx({ expanded: opened }), measurer);
    expect(r.data.nodes.some((n) => n.pager)).toBe(false);
    expect(shownItems(r).length).toBe(19);
  });

  test('paging is not used when only the width is too small', () => {
    const c = ctx({ maxW: 60, maxH: 100_000, expanded: opened });
    const r = layoutMindMap(flat(), style(), c, measurer);
    expect(r.data.nodes.some((n) => n.pager)).toBe(false);
  });
});
