// Mind map measurement + placement, and the auto-collapse fit loop. DOM-free: text is measured
// through a minimal `TextMeasurer` (a CanvasRenderingContext2D in the engine, a fake in tests).

export interface TextMeasurer {
  font: string;
  measureText(text: string): { width: number };
}

export interface MindMapTreeItem {
  /** Path-based id (`<map>/0/2/1`), so an ancestor's id is a prefix of its descendants' ids. */
  id: string;
  label: string;
  depth: number;
  collapsedAttr: boolean;
  attrs: Record<string, string>;
  children: MindMapTreeItem[];
}

export interface MindMapLaidOutNode {
  id: string;
  label: string;
  lines: string[];
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fontWeight: number;
  padX: number;
  padY: number;
  badgeText: string;
  badgeW: number;
  dir: 1 | -1 | 0;
  totalChildCount: number;
  hiddenDescendantCount: number;
  isCollapsed: boolean;
  attrs: Record<string, string>;
  /** Sum of the label lines' measured widths (px), for the particle cost estimate. */
  textWidth: number;
  /** Set on the synthetic "+N more ▸" / "◂ previous" nodes of a paged branch. */
  pager?: 'next' | 'prev';
  /** For pager nodes: the id of the branch being paged. */
  pagerOf?: string;
}

export interface MindMapEdge {
  fromId: string;
  toId: string;
  childDepth: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MeasuredMindMapData {
  layout: 'radial' | 'tree';
  nodes: MindMapLaidOutNode[];
  edges: MindMapEdge[];
}

export type MindMapFit = 'collapse' | 'shrink';
export type MindMapDensity = 'sparse' | 'balanced' | 'dense';

/** Collapse state + limits for one sampling pass. Outputs are collected into `collapsedOut`/`droppedOut`. */
export interface MindMapContext {
  /** App-controlled toggles (old semantics: XOR with the markup's `collapsed`); disables auto-fit. */
  controlledIds?: Set<string>;
  /** Nodes the user opened, with a recency counter (higher = more recent). */
  expanded?: Map<string, number>;
  /** Nodes the user closed. */
  collapsed?: Set<string>;
  /** Current page (0-based) of branches whose children are paged. */
  pages?: Map<string, number>;
  fit: MindMapFit;
  /** Space a mind map should fit in at its natural (readable) size. */
  maxW: number;
  maxH: number;
  /**
   * After fitting, scale a map that fits up to use the free space (labels get bigger and crisper),
   * at most this much. 1 = never enlarge. Default 1.6.
   */
  maxScale?: number;
  /**
   * Particles the layout may spend per screen. A map folds until its estimated cost fits within
   * `BUDGET_SHARE` of this, so it is never cut by the layout's clear band. Default: no limit.
   */
  budget?: number;
  /** Sampling density, for the cost estimate. Default 'balanced'. */
  density?: MindMapDensity;
  /** Filled while measuring: every node that ended up collapsed. */
  collapsedOut: Set<string>;
  /** Filled while measuring: user expansions closed to make room. */
  droppedOut: Set<string>;
}

export interface MindMapStyle {
  layout: 'radial' | 'tree';
  fontFamily: string;
  siblingGap: number;
  levelGap: number;
  branchGap: number;
  compact: boolean;
}

export interface MindMapLayoutResult {
  data: MeasuredMindMapData;
  width: number;
  height: number;
}

export function wrapTextLines(ctx: TextMeasurer, text: string, maxWidth: number): string[] {
  const paragraphs = text.split(/\n+/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const clean = para.replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    const words = clean.split(' ');
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
          currentLine = '';
        }
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

export function countDescendants(item: MindMapTreeItem): number {
  let count = 0;
  for (const ch of item.children) {
    count += 1 + countDescendants(ch);
  }
  return count;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Decides, per node with children, whether it is shown collapsed in one layout attempt. */
type CollapseRule = (item: MindMapTreeItem) => boolean;

/**
 * Share of the particle budget a mind map may use, leaving a margin for estimate error and for other
 * content in the same layout.
 */
export const BUDGET_SHARE = 0.85;

/**
 * Fraction of a label's text box (measured width × font size) that is ink above the sampler's alpha
 * threshold. Calibrated against real sampled point counts with tests/smoke/calibrate.html.
 */
export const INK = 0.26;

/**
 * Estimate how many particles a laid-out map will sample into, using the same steps as the mind map
 * sampling in layoutEngine.ts (label rasterization spacing, frame/underline/edge steps).
 */
export function estimateCost(result: MindMapLayoutResult, density: MindMapDensity = 'balanced'): number {
  const dense = density === 'dense';
  let cost = 0;
  for (const n of result.data.nodes) {
    // sampleCanvasRegion: 2× raster for fonts ≤ 54px; step 1/2/3 (≤26px: min(2, step)) raster px.
    const rasterStep = dense ? 1 : n.fontSize <= 26 ? 2 : density === 'balanced' ? 2 : 3;
    const spacing = n.fontSize <= 54 ? rasterStep / 2 : rasterStep;
    const badgeTextW = n.badgeW > 0 ? Math.max(0, n.badgeW - 10) : 0;
    cost += ((n.textWidth + badgeTextW * 0.78) * n.fontSize * INK) / (spacing * spacing);
    if (n.depth <= 1 || n.isCollapsed) {
      const step = n.depth === 0 ? (dense ? 1.5 : 1.9) : dense ? 1.8 : 2.2;
      cost += Math.max(24, Math.round((2 * (n.width + n.height)) / Math.max(1.2, step)));
    } else {
      cost += Math.max(0, n.width - 8) / (dense ? 1.8 : 2.2);
    }
  }
  const curveStep = dense ? 2.0 : density === 'balanced' ? 2.6 : 3.4;
  for (const e of result.data.edges) {
    cost += (Math.hypot(e.x1 - e.x0, e.y1 - e.y0) * 1.15) / curveStep + 4;
  }
  return Math.round(cost);
}

/**
 * Lay out a mind map. With `ctx.fit === 'collapse'` (and no app-controlled ids) nodes are folded one at a
 * time until the map fits `maxW × maxH` at its natural size and its estimated particle cost fits the
 * budget. Fold order: the side opposite the user's newest opened branch first, then the same side, then
 * inside that branch; automatically opened nodes before user-opened ones (oldest first); deepest first;
 * bigger subtrees first. The root, the first level and the newest opened branch (with its ancestors)
 * always stay visible. A radial map that cannot fit is retried as a (narrower) tree.
 */
export function layoutMindMap(
  tree: MindMapTreeItem,
  style: MindMapStyle,
  ctx: MindMapContext,
  measurer: TextMeasurer
): MindMapLayoutResult {
  const userCollapsed = ctx.collapsed ?? new Set<string>();

  if (ctx.controlledIds || ctx.fit === 'shrink') {
    const controlled = ctx.controlledIds;
    const expandedIds = new Set(ctx.expanded?.keys() ?? []);
    const rule: CollapseRule = controlled
      ? (item) => item.collapsedAttr !== controlled.has(item.id)
      : (item) => !expandedIds.has(item.id) && (userCollapsed.has(item.id) || item.collapsedAttr);
    return finish(layoutOnce(tree, style, rule, measurer), ctx, []);
  }

  const expanded = ctx.expanded ?? new Map<string, number>();
  const newest = [...expanded.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const isProtected = (id: string) => newest !== undefined && (id === newest || newest.startsWith(`${id}/`));
  const budgetLimit = (ctx.budget ?? Infinity) * BUDGET_SHARE;

  // Per-node facts for the fold priority: first-level ancestor and subtree size.
  const branchOf = new Map<string, string>();
  const sizeOf = new Map<string, number>();
  const index = (item: MindMapTreeItem, branch: string | null) => {
    const b = item.depth === 1 ? item.id : branch;
    if (b) branchOf.set(item.id, b);
    sizeOf.set(item.id, countDescendants(item));
    for (const ch of item.children) index(ch, b);
  };
  index(tree, null);

  const layouts: Array<'radial' | 'tree'> = style.layout === 'radial' ? ['radial', 'tree'] : ['tree'];
  // If nothing fits, keep the attempt that overflows least (worst dimension first, then the others);
  // on a tie prefer fewer visible nodes.
  // Snapshot of the best attempt, so it can be laid out again as the page actually being viewed.
  let best: {
    layout: 'radial' | 'tree';
    sides: Map<string, 1 | -1> | undefined;
    folded: Set<string>;
    pageSize: Map<string, number>;
    focus: Map<string, number>;
    dropped: string[];
    key: number[];
  } | null = null;

  for (const layout of layouts) {
    const layoutStyle = { ...style, layout };
    // Stable sides: decided once from the all-first-level-collapsed map, so branches never jump sides.
    const sides = layout === 'radial' ? radialSides(tree, layoutStyle, measurer) : undefined;
    const sideOf = (id: string) => sides?.get(branchOf.get(id) ?? '') ?? 1;
    const newestSide = newest ? sideOf(newest) : 0;
    const group = (id: string) =>
      newest && (id === newest || id.startsWith(`${newest}/`)) ? 2 : sides && newest && sideOf(id) === newestSide ? 1 : 0;

    const folded = new Set<string>();
    const dropped: string[] = [];
    // Children shown per page for paged branches (only ones that had to be paged).
    const pageSize = new Map<string, number>();
    // Ancestors of the newest opened branch default to the page that shows it.
    const focus = new Map<string, number>();
    if (newest) {
      const parts = newest.split('/');
      for (let i = parts.length - 1; i > 1; i--) focus.set(parts.slice(0, i).join('/'), Number(parts[i]));
    }
    const paging: Paging = { size: pageSize, page: ctx.pages ?? new Map(), focus, probe: false };
    const shrinkPage = (result: MindMapLayoutResult): boolean => {
      let target: MindMapLaidOutNode | null = null;
      let shown = 0;
      for (const n of result.data.nodes) {
        if (n.isCollapsed || n.totalChildCount < 2 || (n.depth > 0 && !isProtected(n.id))) continue;
        const visible = pageSize.get(n.id) ?? n.totalChildCount;
        if (visible > 1 && visible > shown) {
          target = n;
          shown = visible;
        }
      }
      if (!target) return false;
      pageSize.set(target.id, shown - 1);
      return true;
    };
    const rule = makeRule(folded);

    for (;;) {
      paging.probe = pageSize.size > 0;
      const result = layoutOnce(tree, layoutStyle, rule, measurer, sides, paging);
      const cost = estimateCost(result, ctx.density);
      const over = [result.width / ctx.maxW, result.height / ctx.maxH, cost / budgetLimit];
      if (Math.max(...over) <= 1) {
        if (!paging.probe) return finish(result, ctx, dropped, cost);
        // The page size fits the tallest page; now lay out the page actually being viewed.
        paging.probe = false;
        return finish(layoutOnce(tree, layoutStyle, rule, measurer, sides, paging), ctx, dropped);
      }
      // Rounded so tiny differences don't beat "fewer nodes".
      const key = [...over.map((o) => Math.round(Math.max(1, o) * 1000)).sort((a, b) => b - a), result.data.nodes.length];
      if (!best || lexLess(key, best.key)) {
        best = {
          layout,
          sides,
          folded: new Set(folded),
          pageSize: new Map(pageSize),
          focus,
          dropped: [...dropped],
          key,
        };
      }

      // Fold the highest-priority open node.
      let pick: MindMapLaidOutNode | null = null;
      let pickKey: number[] = [];
      for (const n of result.data.nodes) {
        if (n.depth < 1 || n.isCollapsed || n.totalChildCount === 0 || isProtected(n.id)) continue;
        const userOpened = expanded.has(n.id);
        const key = [
          group(n.id),
          userOpened ? 1 : 0,
          userOpened ? expanded.get(n.id)! : -n.depth,
          -(sizeOf.get(n.id) ?? 0),
        ];
        if (!pick || lexLess(key, pickKey)) {
          pick = n;
          pickKey = key;
        }
      }
      if (!pick) {
        // Nothing left to fold: if height or particles are the problem (paging can't fix width), page
        // the opened branch (or its ancestors / the root) with the most children, showing fewer at a
        // time, until the map fits.
        if (over[1] <= 1 && over[2] <= 1) break;
        if (!shrinkPage(result)) break;
        continue;
      }
      folded.add(pick.id);
      // Folding a node closes any user expansions inside it too.
      for (const id of expanded.keys()) {
        if ((id === pick.id || id.startsWith(`${pick.id}/`)) && !dropped.includes(id)) dropped.push(id);
      }
    }
  }
  // Nothing fits at natural size: use the smallest attempt (as the page being viewed); the scene
  // shrinks it the rest of the way.
  const b = best!;
  const final = layoutOnce(tree, { ...style, layout: b.layout }, makeRule(b.folded), measurer, b.sides, {
    size: b.pageSize,
    page: ctx.pages ?? new Map(),
    focus: b.focus,
    probe: false,
  });
  return finish(final, ctx, b.dropped);

  /** Collapse rule for a set of folded nodes: user-closed / folded → closed; user-opened → open. */
  function makeRule(folded: Set<string>): CollapseRule {
    const kept = (id: string) => expanded.has(id) && !folded.has(id);
    const openForUser = (id: string) => {
      for (const k of expanded.keys()) if (kept(k) && (k === id || k.startsWith(`${id}/`))) return true;
      return false;
    };
    return (item) => {
      if (userCollapsed.has(item.id) || folded.has(item.id)) return true;
      if (openForUser(item.id)) return false;
      return item.collapsedAttr;
    };
  }
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Paged branches: children shown per page, and the current page. */
interface Paging {
  size: Map<string, number>;
  page: Map<string, number>;
  /** For ancestors of the newest opened branch: index of the child on that path (its page is the default). */
  focus: Map<string, number>;
  /**
   * While searching for a page size: lay out the first page with both pager nodes, the tallest any page
   * can be, so the size found fits every page.
   */
  probe: boolean;
}

/** Which side each first-level branch goes on, from the map with every first-level branch collapsed. */
function radialSides(tree: MindMapTreeItem, style: MindMapStyle, measurer: TextMeasurer): Map<string, 1 | -1> {
  const baseline = layoutOnce(tree, style, (item) => item.depth >= 1, measurer);
  const sides = new Map<string, 1 | -1>();
  for (const n of baseline.data.nodes) if (n.depth === 1) sides.set(n.id, n.dir === -1 ? -1 : 1);
  return sides;
}

/**
 * Share of the space an enlarged map may use. Columns already give a map only the height its siblings
 * leave, so this is mostly breathing room.
 */
const FILL_W = 0.92;
const FILL_H = 0.88;

function finish(
  result: MindMapLayoutResult,
  ctx: MindMapContext,
  dropped: string[],
  cost?: number
): MindMapLayoutResult {
  for (const n of result.data.nodes) if (n.isCollapsed) ctx.collapsedOut.add(n.id);
  for (const id of dropped) ctx.droppedOut.add(id);
  const c = cost ?? estimateCost(result, ctx.density);
  // Text cost grows with the square of the scale; stay inside the budget when enlarging.
  const budgetScale = ctx.budget && c > 0 ? Math.sqrt((ctx.budget * BUDGET_SHARE) / c) : Infinity;
  const scale = Math.min(
    ctx.maxScale ?? 1.6,
    (ctx.maxW * FILL_W) / result.width,
    (ctx.maxH * FILL_H) / result.height,
    budgetScale
  );
  return scale > 1.02 ? scaleResult(result, scale) : result;
}

/**
 * Enlarge a laid-out map uniformly. Exact: label wrapping widths scale with the font size, so the
 * same lines result, just bigger.
 */
export function scaleResult(result: MindMapLayoutResult, s: number): MindMapLayoutResult {
  for (const n of result.data.nodes) {
    n.x *= s;
    n.y *= s;
    n.width *= s;
    n.height *= s;
    n.fontSize *= s;
    n.lineHeight *= s;
    n.padX *= s;
    n.padY *= s;
    n.badgeW *= s;
    n.textWidth *= s;
  }
  for (const e of result.data.edges) {
    e.x0 *= s;
    e.y0 *= s;
    e.x1 *= s;
    e.y1 *= s;
  }
  return { data: result.data, width: Math.ceil(result.width * s), height: Math.ceil(result.height * s) };
}

/** One layout pass with a fixed collapse rule (the original mind map layout). */
function layoutOnce(
  rootTree: MindMapTreeItem,
  style: MindMapStyle,
  isCollapsedByRule: CollapseRule,
  measureCtx: TextMeasurer,
  sides?: Map<string, 1 | -1>,
  paging?: Paging
): MindMapLayoutResult {
  const { layout: layoutMode, fontFamily, siblingGap, levelGap, branchGap, compact } = style;

  interface WorkingNode {
    item: MindMapTreeItem;
    node: MindMapLaidOutNode;
    subtreeH: number;
    children: WorkingNode[];
  }

  const buildWorking = (item: MindMapTreeItem): WorkingNode => {
    const hasChildren = item.children.length > 0;
    const isCollapsed = hasChildren && isCollapsedByRule(item);
    const hiddenDescendantCount = isCollapsed ? countDescendants(item) : 0;

    const isRoot = item.depth === 0;
    const isPrimary = item.depth === 1;
    const fontSize = isRoot
      ? compact
        ? 16
        : 19
      : isPrimary
      ? compact
        ? 13.5
        : 15
      : compact
      ? 12
      : 13.5;
    const fontWeight = isRoot || isPrimary ? 600 : 500;
    const padX = isRoot ? (compact ? 14 : 18) : isPrimary ? (compact ? 10 : 13) : (compact ? 8 : 10);
    const padY = isRoot ? (compact ? 8 : 10) : isPrimary ? (compact ? 6 : 7) : (compact ? 4 : 5);
    const maxLabelW = isRoot ? (compact ? 145 : 200) : isPrimary ? (compact ? 125 : 175) : (compact ? 115 : 165);

    measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = wrapTextLines(measureCtx, item.label, maxLabelW);
    const lineHeight = fontSize * 1.28;
    const lineWidths = lines.map((l) => measureCtx.measureText(l).width);
    const labelW = Math.max(...lineWidths, 24);
    const textWidth = lineWidths.reduce((a, w) => a + w, 0);

    const badgeText = isCollapsed ? `+${hiddenDescendantCount}` : hasChildren ? '−' : '';
    let badgeW = 0;
    if (badgeText) {
      const badgeFontSize = Math.max(10.5, fontSize * 0.78);
      measureCtx.font = `600 ${badgeFontSize}px ${fontFamily}`;
      badgeW = Math.ceil(measureCtx.measureText(badgeText).width) + 10;
    }

    const width = Math.ceil(labelW + padX * 2 + badgeW);
    const height = Math.ceil(lines.length * lineHeight + padY * 2);

    const visibleChildren = isCollapsed ? [] : pagedChildren(item).map(buildWorking);
    const childrenSumH =
      visibleChildren.reduce((acc, c) => acc + c.subtreeH, 0) +
      Math.max(0, visibleChildren.length - 1) * siblingGap;
    const subtreeH = Math.max(height, childrenSumH);

    return {
      item,
      node: {
        id: item.id,
        label: item.label,
        lines,
        depth: item.depth,
        x: 0,
        y: 0,
        width,
        height,
        fontSize,
        lineHeight,
        fontFamily,
        fontWeight,
        padX,
        padY,
        badgeText,
        badgeW,
        dir: 0,
        totalChildCount: item.children.length,
        hiddenDescendantCount,
        isCollapsed,
        attrs: item.attrs,
        textWidth,
      },
      subtreeH,
      children: visibleChildren,
    };
  };

  /**
   * The children to show for an open item: all of them, or one page plus "◂ previous" / "+N more ▸"
   * pager nodes when the branch is paged.
   */
  const pagedChildren = (item: MindMapTreeItem): MindMapTreeItem[] => {
    const size = paging?.size.get(item.id);
    const n = item.children.length;
    if (!size || size >= n) return item.children;
    const lastPage = Math.floor((n - 1) / size);
    const focusIdx = paging!.focus.get(item.id);
    const defaultPage = focusIdx !== undefined ? Math.floor(focusIdx / size) : 0;
    const page = paging!.probe ? 0 : Math.min(Math.max(0, paging!.page.get(item.id) ?? defaultPage), lastPage);
    const start = page * size;
    const shown = item.children.slice(start, start + size);
    const pager = (kind: 'next' | 'prev', label: string): MindMapTreeItem => {
      const synthetic: MindMapTreeItem = {
        id: `${item.id}/~${kind}`,
        label,
        depth: item.depth + 1,
        collapsedAttr: false,
        attrs: {},
        children: [],
      };
      pagers.set(synthetic.id, { kind, of: item.id });
      return synthetic;
    };
    const out: MindMapTreeItem[] = [];
    if (start > 0 || paging!.probe) out.push(pager('prev', '◂ previous'));
    out.push(...shown);
    const remaining = n - (start + shown.length);
    // While probing, label with the largest count so the pager is as wide as it can ever be.
    if (remaining > 0 || paging!.probe) out.push(pager('next', `+${paging!.probe ? n : remaining} more ▸`));
    return out;
  };
  const pagers = new Map<string, { kind: 'next' | 'prev'; of: string }>();

  const rootW = buildWorking(rootTree);
  for (const n of flatNodesOf(rootW)) {
    const pg = pagers.get(n.id);
    if (pg) {
      n.pager = pg.kind;
      n.pagerOf = pg.of;
    }
  }
  function flatNodesOf(w: WorkingNode): MindMapLaidOutNode[] {
    return [w.node, ...w.children.flatMap(flatNodesOf)];
  }
  const flatNodes: MindMapLaidOutNode[] = [];
  const edges: MindMapEdge[] = [];

  const placeSubtree = (wn: WorkingNode, anchorX: number, centerY: number, dir: 1 | -1): void => {
    wn.node.dir = dir;
    wn.node.x = dir === 1 ? anchorX : anchorX - wn.node.width;
    wn.node.y = centerY - wn.node.height * 0.5;
    flatNodes.push(wn.node);

    if (wn.children.length === 0) return;

    const totalChildrenH =
      wn.children.reduce((acc, c) => acc + c.subtreeH, 0) +
      Math.max(0, wn.children.length - 1) * siblingGap;
    let curY = centerY - totalChildrenH * 0.5;
    const childAnchorX = dir === 1 ? wn.node.x + wn.node.width + levelGap : wn.node.x - levelGap;

    for (const ch of wn.children) {
      const chCenterY = curY + ch.subtreeH * 0.5;
      placeSubtree(ch, childAnchorX, chCenterY, dir);
      edges.push({
        fromId: wn.node.id,
        toId: ch.node.id,
        childDepth: ch.node.depth,
        x0: dir === 1 ? wn.node.x + wn.node.width : wn.node.x,
        y0: wn.node.y + wn.node.height * 0.5,
        x1: dir === 1 ? ch.node.x : ch.node.x + ch.node.width,
        y1: ch.node.y + ch.node.height * 0.5,
      });
      curY += ch.subtreeH + siblingGap;
    }
  };

  if (layoutMode === 'tree') {
    rootW.node.dir = 1;
    placeSubtree(rootW, 0, rootW.subtreeH * 0.5, 1);
  } else {
    rootW.node.dir = 0;
    rootW.node.x = -rootW.node.width * 0.5;
    rootW.node.y = -rootW.node.height * 0.5;
    flatNodes.push(rootW.node);

    const rightBranches: WorkingNode[] = [];
    const leftBranches: WorkingNode[] = [];
    let rightSum = 0;
    let leftSum = 0;

    // Distribute depth-1 branches across right & left hemispheres weighted by subtree height,
    // unless fixed sides were given (so branches don't jump sides as others open and close).
    rootW.children.forEach((branch, idx) => {
      const fixed = sides?.get(branch.item.id);
      const goRight =
        fixed !== undefined
          ? fixed === 1
          : idx % 2 === 0
          ? rightSum <= leftSum + 24
          : rightSum < leftSum - 24;
      if (goRight) {
        rightBranches.push(branch);
        rightSum += branch.subtreeH + branchGap;
      } else {
        leftBranches.push(branch);
        leftSum += branch.subtreeH + branchGap;
      }
    });

    const placeHemisphere = (branches: WorkingNode[], dir: 1 | -1) => {
      if (branches.length === 0) return;
      const totalH =
        branches.reduce((acc, b) => acc + b.subtreeH, 0) + Math.max(0, branches.length - 1) * branchGap;
      let curY = -totalH * 0.5;

      for (const b of branches) {
        const bCenterY = curY + b.subtreeH * 0.5;
        const vNorm = totalH > 1 ? clamp(bCenterY / (totalH * 0.5), -1, 1) : 0;
        const arcGap = levelGap * (1.22 - 0.28 * vNorm * vNorm);
        const anchorX = dir === 1 ? rootW.node.width * 0.5 + arcGap : -rootW.node.width * 0.5 - arcGap;

        placeSubtree(b, anchorX, bCenterY, dir);
        edges.push({
          fromId: rootW.node.id,
          toId: b.node.id,
          childDepth: b.node.depth,
          x0: dir === 1 ? rootW.node.x + rootW.node.width : rootW.node.x,
          y0: clamp(bCenterY * 0.24, -rootW.node.height * 0.26, rootW.node.height * 0.26),
          x1: dir === 1 ? b.node.x : b.node.x + b.node.width,
          y1: b.node.y + b.node.height * 0.5,
        });
        curY += b.subtreeH + branchGap;
      }
    };

    placeHemisphere(rightBranches, 1);
    placeHemisphere(leftBranches, -1);
  }

  // Normalize coordinates so bounding box starts at (0, 0)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of flatNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const padOuter = 4;
  const shiftX = -minX + padOuter;
  const shiftY = -minY + padOuter;
  for (const n of flatNodes) {
    n.x += shiftX;
    n.y += shiftY;
  }
  for (const e of edges) {
    e.x0 += shiftX;
    e.y0 += shiftY;
    e.x1 += shiftX;
    e.y1 += shiftY;
  }

  return {
    data: { layout: layoutMode, nodes: flatNodes, edges },
    width: Math.max(120, Math.ceil(maxX - minX + padOuter * 2)),
    height: Math.max(60, Math.ceil(maxY - minY + padOuter * 2)),
  };
}
