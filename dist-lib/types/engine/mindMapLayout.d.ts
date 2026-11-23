export interface TextMeasurer {
    font: string;
    measureText(text: string): {
        width: number;
    };
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
export declare function wrapTextLines(ctx: TextMeasurer, text: string, maxWidth: number): string[];
export declare function countDescendants(item: MindMapTreeItem): number;
/**
 * Share of the particle budget a mind map may use, leaving a margin for estimate error and for other
 * content in the same layout.
 */
export declare const BUDGET_SHARE = 0.85;
/**
 * Fraction of a label's text box (measured width × font size) that is ink above the sampler's alpha
 * threshold. Calibrated against real sampled point counts with tests/smoke/calibrate.html.
 */
export declare const INK = 0.26;
/**
 * Estimate how many particles a laid-out map will sample into, using the same steps as the mind map
 * sampling in layoutEngine.ts (label rasterization spacing, frame/underline/edge steps).
 */
export declare function estimateCost(result: MindMapLayoutResult, density?: MindMapDensity): number;
/**
 * Lay out a mind map. With `ctx.fit === 'collapse'` (and no app-controlled ids) nodes are folded one at a
 * time until the map fits `maxW × maxH` at its natural size and its estimated particle cost fits the
 * budget. Fold order: the side opposite the user's newest opened branch first, then the same side, then
 * inside that branch; automatically opened nodes before user-opened ones (oldest first); deepest first;
 * bigger subtrees first. The root, the first level and the newest opened branch (with its ancestors)
 * always stay visible. A radial map that cannot fit is retried as a (narrower) tree.
 */
export declare function layoutMindMap(tree: MindMapTreeItem, style: MindMapStyle, ctx: MindMapContext, measurer: TextMeasurer): MindMapLayoutResult;
/**
 * Enlarge a laid-out map uniformly. Exact: label wrapping widths scale with the font size, so the
 * same lines result, just bigger.
 */
export declare function scaleResult(result: MindMapLayoutResult, s: number): MindMapLayoutResult;
//# sourceMappingURL=mindMapLayout.d.ts.map