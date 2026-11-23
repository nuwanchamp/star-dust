import {
  DEFAULT_IMAGE_TUNING,
  getImageSourceBounds,
  sampleImageIntoBox,
} from './imageSampler';
import {
  type MeasuredMindMapData,
  type MindMapContext,
  type MindMapFit,
  type MindMapTreeItem,
  layoutMindMap,
  wrapTextLines,
} from './mindMapLayout';
import type { SampledPoint } from './textSampler';
import type {
  DensityPreset,
  FontStyle,
  ImageBlurStyle,
  ImageTuningConfig,
  LayoutHitRegion,
  LayoutNode,
  RipplePattern,
  RippleRegion,
  RippleTrigger,
} from '../types/mote';

/** Smallest side an <Image> is laid out at; sampleImageIntoBox draws nothing below 24px. */
const MIN_IMAGE_SIDE = 24;

interface ResolvedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RippleInheritConfig {
  pattern?: RipplePattern;
  trigger?: RippleTrigger;
  strength?: number;
  speed?: number;
  wavelength?: number;
}

interface MeasuredListData {
  items: Array<{ lines: string[]; markerLabel?: string }>;
  ordered: boolean;
  markerStyle: 'bullet' | 'dash' | 'diamond';
  gutterW: number;
  itemGap: number;
}

interface MeasuredTableCell {
  lines: string[];
  align: 'left' | 'center' | 'right';
}

interface MeasuredTableData {
  colWidths: number[];
  colAligns: Array<'left' | 'center' | 'right'>;
  rows: Array<{ isHeader: boolean; height: number; cells: MeasuredTableCell[] }>;
  cellPadX: number;
  cellPadY: number;
  bordered: boolean;
}

interface MeasuredQuoteData {
  barGutter: number;
  cite?: string;
  citeSize?: number;
  citeLineHeight?: number;
  italic: boolean;
}

interface MeasuredCodeData {
  padX: number;
  padY: number;
}

interface MeasuredLayoutNode {
  node: LayoutNode;
  intrinsicWidth: number;
  intrinsicHeight: number;
  lines?: string[];
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  resolvedImg?: HTMLImageElement | null;
  listData?: MeasuredListData;
  tableData?: MeasuredTableData;
  quoteData?: MeasuredQuoteData;
  codeData?: MeasuredCodeData;
  mindMapData?: MeasuredMindMapData;
  children: MeasuredLayoutNode[];
  wrappedRows?: MeasuredLayoutNode[][];
}

export interface LayoutSceneResult {
  points: SampledPoint[];
  hitRegions: LayoutHitRegion[];
  rippleRegions: RippleRegion[];
  cellSize: number;
  /** How far the content can scroll (0 when it fits). Coordinates are at scroll 0. */
  scrollMax: number;
  /**
   * When scrollable, `points` cover the whole layout untrimmed; the caller should give particles only
   * to what is on screen, at most `screenBudget` per screen, never thinning `priorityRegionIds` (buttons).
   */
  screenBudget: number;
  priorityRegionIds: number[];
  /** Mind map nodes shown collapsed (so a click knows whether to open or close). */
  mindMapCollapsedIds: string[];
  /** User-opened mind map nodes that were closed to make room for a newer one. */
  mindMapDroppedExpansions: string[];
}

export interface LayoutPaddingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type LayoutOverflow = 'scroll' | 'fit';

export interface LayoutSceneOptions {
  /** Extra space reserved on the left (added to padding.left). */
  leftInset?: number;
  /** App-controlled mind map toggles (XOR with markup `collapsed`); disables mind map auto-fit. */
  collapsedMindMapIds?: Set<string>;
  /** Mind map nodes the user opened (value: recency) / closed, when the engine manages collapse state. */
  mindMapExpanded?: Map<string, number>;
  mindMapCollapsed?: Set<string>;
  /** 'collapse' (default): collapse levels until a mind map fits at a readable size. 'shrink': old behavior. */
  mindMapFit?: MindMapFit;
  /** Current page of mind map branches whose children are paged (engine-managed). */
  mindMapPages?: Map<string, number>;
  /** Largest factor a mind map that fits may be enlarged by to use free space (1 = never). Default 1.6. */
  mindMapMaxScale?: number;
  /** Space kept clear around the layout. Default: 32px (16px below 640px wide). */
  padding?: LayoutPaddingBox;
  /** 'scroll': keep text legible and let it scroll. 'fit': shrink everything to fit. Default 'scroll'. */
  overflow?: LayoutOverflow;
  /** Smallest font size (px) 'scroll' mode may shrink text to. Default 14. */
  minFontSize?: number;
  /** Max particles for one screen of layout. Default by density: 16.5k / 30k / 45k. */
  particleBudget?: number;
  /**
   * Thin points evenly to fit the budget when the layout fits the screen (default true). Pass false
   * when the caller limits by visible height instead (LayoutWindow); points are then never thinned here.
   */
  trim?: boolean;
}

/** Smallest font size used anywhere in a measured tree (Infinity if none). */
function smallestFontSize(m: MeasuredLayoutNode): number {
  let min = m.fontSize && m.fontSize > 0 ? m.fontSize : Infinity;
  if (m.mindMapData) {
    for (const n of m.mindMapData.nodes) {
      if (n.fontSize > 0) min = Math.min(min, n.fontSize);
    }
  }
  for (const child of m.children) min = Math.min(min, smallestFontSize(child));
  return min;
}

const FONT_FAMILY_MAP: Record<FontStyle, string> = {
  serif: "'Fraunces', Georgia, serif",
  sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

/** Effective sampling density of each node (its own `density` attribute, else its parent's). */
const nodeDensity = new WeakMap<LayoutNode, DensityPreset>();

function parseDensityAttr(value: string | undefined): DensityPreset | null {
  const v = (value || '').trim().toLowerCase();
  return v === 'dense' || v === 'balanced' || v === 'sparse' ? v : null;
}

function assignDensities(node: LayoutNode, inherited: DensityPreset): void {
  const own = parseDensityAttr(node.attrs.density) ?? inherited;
  nodeDensity.set(node, own);
  for (const child of node.children) assignDensities(child, own);
}

const LAYOUT_BUDGET_BY_DENSITY: Record<DensityPreset, number> = {
  sparse: 16500,
  balanced: 30000,
  dense: 45000,
};

function parseNum(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function parseRipplePattern(raw: string | undefined): RipplePattern | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toLowerCase();
  if (clean === 'off' || clean === 'false' || clean === 'none') return 'off';
  if (clean === 'ring' || clean === 'true') return 'ring';
  if (clean === 'sweep' || clean === 'wave') return 'sweep';
  if (clean === 'pulse' || clean === 'breathe') return 'pulse';
  if (clean === 'expand' || clean === 'burst') return 'expand';
  return undefined;
}

function parseRippleTrigger(raw: string | undefined): RippleTrigger | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toLowerCase();
  if (clean === 'both' || clean === 'all') return 'both';
  if (clean === 'ambient' || clean === 'auto') return 'ambient';
  if (clean === 'interactive' || clean === 'touch' || clean === 'pointer') return 'interactive';
  if (clean === 'hover') return 'hover';
  if (clean === 'click' || clean === 'tap') return 'click';
  return undefined;
}

function mergeRippleConfig(
  inherited: RippleInheritConfig,
  attrs: Record<string, string>
): RippleInheritConfig {
  const pattern = parseRipplePattern(attrs.ripple) ?? inherited.pattern;
  const trigger =
    parseRippleTrigger(attrs.rippleTrigger ?? attrs.rippletrigger) ?? inherited.trigger;
  const rawStrength = attrs.rippleStrength ?? attrs.ripplestrength;
  const rawSpeed = attrs.rippleSpeed ?? attrs.ripplespeed;
  const rawWave =
    attrs.rippleWave ?? attrs.ripplewave ?? attrs.rippleWavelength ?? attrs.ripplewavelength;

  const strength =
    rawStrength !== undefined
      ? clamp(parseNum(rawStrength, 0.7), 0, 2)
      : inherited.strength;
  const speed =
    rawSpeed !== undefined ? clamp(parseNum(rawSpeed, 1), 0.2, 3) : inherited.speed;
  const wavelength =
    rawWave !== undefined ? clamp(parseNum(rawWave, 130), 40, 360) : inherited.wavelength;

  return { pattern, trigger, strength, speed, wavelength };
}

/** Maps a layout `<Image src>` value to a loadable URL, or null to leave the image out. */
export type LayoutImageResolver = (ref: string | undefined) => string | null;

/**
 * Default `<Image src>` resolution: no src, "current" or "uploaded" → the current `imageSrc`;
 * anything else is used as a URL/path as-is.
 */
export function defaultLayoutImageUrl(
  rawSrc: string | undefined,
  currentImageSrc: string | null
): string | null {
  const key = (rawSrc ?? '').trim();
  const normalized = key.toLowerCase();
  if (!key || normalized === 'uploaded' || normalized === 'current') {
    return currentImageSrc;
  }
  return key;
}

function wrapCodeLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  for (const rawLine of rawLines) {
    if (rawLine === '') {
      out.push('');
      continue;
    }
    if (ctx.measureText(rawLine).width <= maxWidth) {
      out.push(rawLine);
      continue;
    }

    let current = '';
    for (const ch of rawLine) {
      const next = current + ch;
      if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
        current = next;
      } else {
        out.push(current);
        current = ch;
      }
    }
    if (current) out.push(current);
  }

  return out.length > 0 ? out : [''];
}

function extractListItems(node: LayoutNode): { texts: string[]; detectedOrdered: boolean } {
  const childItems = node.children.filter(
    (c) => c.tag === 'Item' || c.tag === 'Text'
  );
  if (childItems.length > 0) {
    return {
      texts: childItems
        .map((c) => (c.text || '').trim())
        .filter((t) => t.length > 0),
      detectedOrdered: false,
    };
  }

  const lines = (node.text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { texts: ['List item'], detectedOrdered: false };
  }

  let orderedCount = 0;
  const texts = lines.map((line) => {
    if (/^\d+[.)]\s+/.test(line)) {
      orderedCount++;
      return line.replace(/^\d+[.)]\s+/, '').trim();
    }
    return line.replace(/^[-*•+]\s+/, '').trim();
  });

  return {
    texts: texts.filter((t) => t.length > 0),
    detectedOrdered: orderedCount > 0 && orderedCount === lines.length,
  };
}

function splitPipeRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((cell) => cell.trim());
}

function parseSeparatorAlign(cell: string): 'left' | 'center' | 'right' | null {
  const t = cell.trim();
  if (!/^:?-{2,}:?$/.test(t)) return null;
  if (t.startsWith(':') && t.endsWith(':')) return 'center';
  if (t.endsWith(':')) return 'right';
  return 'left';
}

interface ParsedTableCell {
  text: string;
  align?: 'left' | 'center' | 'right';
}

interface ParsedTableRow {
  isHeader: boolean;
  cells: ParsedTableCell[];
}

function extractTableRows(node: LayoutNode): {
  rows: ParsedTableRow[];
  colAligns: Array<'left' | 'center' | 'right'>;
} {
  const trNodes = node.children.filter((c) => c.tag === 'Tr');
  if (trNodes.length > 0) {
    const colAligns: Array<'left' | 'center' | 'right'> = [];
    const rows: ParsedTableRow[] = trNodes.map((tr, rIdx) => {
      const cellNodes = tr.children.filter((c) => c.tag === 'Th' || c.tag === 'Td');
      const hasTh = cellNodes.some((c) => c.tag === 'Th');
      const isHeader =
        node.attrs.header !== 'false' &&
        (hasTh || (rIdx === 0 && tr.attrs.header === 'true'));
      const cells: ParsedTableCell[] = cellNodes.map((cell, cIdx) => {
        const alignAttr = cell.attrs.align?.toLowerCase();
        const align: 'left' | 'center' | 'right' | undefined =
          alignAttr === 'center'
            ? 'center'
            : alignAttr === 'right' || alignAttr === 'end'
            ? 'right'
            : alignAttr === 'left' || alignAttr === 'start'
            ? 'left'
            : undefined;
        if (align && !colAligns[cIdx]) {
          colAligns[cIdx] = align;
        }
        return { text: (cell.text || '').trim(), align };
      });
      return { isHeader, cells };
    });
    return { rows, colAligns };
  }

  const lines = (node.text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      rows: [{ isHeader: true, cells: [{ text: 'Column' }] }],
      colAligns: ['left'],
    };
  }

  const rawRows = lines.map(splitPipeRow);
  const colAligns: Array<'left' | 'center' | 'right'> = [];
  let hasSeparator = false;

  if (rawRows.length >= 2) {
    const maybeAligns = rawRows[1].map(parseSeparatorAlign);
    if (maybeAligns.length > 0 && maybeAligns.every((a) => a !== null)) {
      hasSeparator = true;
      maybeAligns.forEach((a, idx) => {
        colAligns[idx] = a || 'left';
      });
    }
  }

  const rows: ParsedTableRow[] = [];
  rawRows.forEach((cells, idx) => {
    if (hasSeparator && idx === 1) return;
    const isHeader = node.attrs.header !== 'false' && idx === 0;
    rows.push({
      isHeader,
      cells: cells.map((text) => ({ text })),
    });
  });

  return { rows, colAligns };
}

function resolveFontStyle(attr: string | undefined, fallback: FontStyle): FontStyle {
  if (attr === 'serif' || attr === 'sans' || attr === 'mono') return attr;
  return fallback;
}

function resolveHeadingSize(sizeAttr: string | undefined, compact: boolean): number {
  switch ((sizeAttr || 'lg').toLowerCase()) {
    case 'xl':
      return compact ? 42 : 58;
    case 'lg':
      return compact ? 32 : 42;
    case 'md':
      return compact ? 24 : 30;
    case 'sm':
      return compact ? 19 : 22;
    default: {
      const custom = parseNum(sizeAttr, 40);
      return clamp(compact ? custom * 0.78 : custom, 18, 72);
    }
  }
}

function resolveBodySize(sizeAttr: string | undefined, compact: boolean): number {
  switch ((sizeAttr || 'md').toLowerCase()) {
    case 'lg':
      return compact ? 18 : 22;
    case 'md':
      return compact ? 15 : 18;
    case 'sm':
      return compact ? 13 : 15;
    default: {
      const custom = parseNum(sizeAttr, 18);
      return clamp(compact ? custom * 0.85 : custom, 13, 30);
    }
  }
}

function resolveButtonSize(sizeAttr: string | undefined): { fontSize: number; px: number; py: number } {
  switch ((sizeAttr || 'md').toLowerCase()) {
    case 'lg':
      return { fontSize: 18, px: 28, py: 14 };
    case 'sm':
      return { fontSize: 14, px: 18, py: 11 };
    default:
      return { fontSize: 16, px: 24, py: 13 };
  }
}

function assignMindMapIds(item: MindMapTreeItem, path: string, depth: number): void {
  item.id = path;
  item.depth = depth;
  item.children.forEach((child, idx) => {
    assignMindMapIds(child, `${path}/${idx}`, depth + 1);
  });
}

function convertBranchTagNode(branch: LayoutNode): MindMapTreeItem {
  const rawLabel =
    branch.attrs.label ||
    branch.attrs.title ||
    branch.text ||
    'Topic';
  const childBranches = branch.children.filter((c) => c.tag === 'Branch');
  return {
    id: '',
    label: rawLabel.replace(/\s+/g, ' ').trim(),
    depth: 0,
    collapsedAttr: branch.attrs.collapsed === 'true',
    attrs: branch.attrs,
    children: childBranches.map(convertBranchTagNode),
  };
}

function cleanMindMapOutlineLabel(line: string): string {
  return line
    .trim()
    .replace(/^#{1,4}\s+/, '')
    .replace(/^[-*•+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();
}

export function extractMindMapTree(node: LayoutNode): MindMapTreeItem {
  const mapKey = (node.attrs.id || `mm${node.line}`).trim();
  const branchChildren = node.children.filter((c) => c.tag === 'Branch');

  if (branchChildren.length > 0) {
    const rootLabel = (
      node.attrs.title ||
      node.attrs.label ||
      node.attrs.root ||
      node.text?.split('\n')[0] ||
      'Central Topic'
    )
      .replace(/^[-*•+#]+\s*/, '')
      .trim();

    const root: MindMapTreeItem = {
      id: mapKey,
      label: rootLabel,
      depth: 0,
      collapsedAttr: node.attrs.collapsed === 'true',
      attrs: node.attrs,
      children: branchChildren.map(convertBranchTagNode),
    };
    assignMindMapIds(root, `${mapKey}/0`, 0);
    return root;
  }

  const rawLines = (node.text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((raw) => {
      const expanded = raw.replace(/\t/g, '  ');
      const indentMatch = expanded.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      const label = cleanMindMapOutlineLabel(expanded);
      return { indent, label };
    })
    .filter((entry) => entry.label.length > 0);

  if (rawLines.length === 0) {
    const fallbackRoot: MindMapTreeItem = {
      id: `${mapKey}/0`,
      label: (node.attrs.title || node.attrs.label || 'Mind Map').trim(),
      depth: 0,
      collapsedAttr: false,
      attrs: node.attrs,
      children: [],
    };
    return fallbackRoot;
  }

  const minIndent = Math.min(...rawLines.map((l) => l.indent));
  const rootLevelCount = rawLines.filter((l) => l.indent === minIndent).length;
  const hasSingleRootLine =
    rootLevelCount === 1 &&
    rawLines[0].indent === minIndent &&
    !node.attrs.title &&
    !node.attrs.root;

  let root: MindMapTreeItem;
  let startIdx = 0;

  if (hasSingleRootLine) {
    root = {
      id: '',
      label: rawLines[0].label,
      depth: 0,
      collapsedAttr: node.attrs.collapsed === 'true',
      attrs: node.attrs,
      children: [],
    };
    startIdx = 1;
  } else {
    root = {
      id: '',
      label: (node.attrs.title || node.attrs.label || node.attrs.root || 'Mind Map').trim(),
      depth: 0,
      collapsedAttr: node.attrs.collapsed === 'true',
      attrs: node.attrs,
      children: [],
    };
  }

  const stack: Array<{ indent: number; item: MindMapTreeItem }> = [
    { indent: hasSingleRootLine ? rawLines[0].indent : minIndent - 1, item: root },
  ];

  for (let i = startIdx; i < rawLines.length; i++) {
    const { indent, label } = rawLines[i];
    const item: MindMapTreeItem = {
      id: '',
      label,
      depth: 0,
      collapsedAttr: false,
      attrs: {},
      children: [],
    };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    stack[stack.length - 1].item.children.push(item);
    stack.push({ indent, item });
  }

  assignMindMapIds(root, `${mapKey}/0`, 0);
  return root;
}

function measureNode(
  node: LayoutNode,
  measureCtx: CanvasRenderingContext2D,
  maxAvailW: number,
  maxAvailH: number,
  defaultFontStyle: FontStyle,
  imageCache: Map<string, HTMLImageElement>,
  resolveImage: LayoutImageResolver,
  compact: boolean,
  mindMap: MindMapContext
): MeasuredLayoutNode {
  if (node.tag === 'Heading') {
    const fontStyle = resolveFontStyle(node.attrs.font, defaultFontStyle);
    const fontSize = resolveHeadingSize(node.attrs.size, compact);
    const fontFamily = FONT_FAMILY_MAP[fontStyle];
    const fontWeight = fontStyle === 'serif' ? 600 : 600;
    const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, maxAvailW));
    const textAlign =
      node.attrs.align === 'left' || node.attrs.align === 'start'
        ? 'left'
        : node.attrs.align === 'right' || node.attrs.align === 'end'
        ? 'right'
        : 'center';

    measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = wrapTextLines(measureCtx, node.text || 'Heading', Math.max(120, maxW));
    const lineHeight = fontSize * 1.16;
    const widest = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 24);

    return {
      node,
      intrinsicWidth: Math.min(maxW, Math.ceil(widest) + 8),
      intrinsicHeight: Math.ceil(lines.length * lineHeight),
      lines,
      fontSize,
      lineHeight,
      fontFamily,
      fontWeight,
      textAlign,
      children: [],
    };
  }

  if (node.tag === 'Text') {
    const fontStyle = resolveFontStyle(node.attrs.font, 'sans');
    const fontSize = resolveBodySize(node.attrs.size, compact);
    const fontFamily = FONT_FAMILY_MAP[fontStyle];
    const fontWeight = 500;
    const defaultMaxW = Math.min(maxAvailW, compact ? 320 : 440);
    const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
    const textAlign =
      node.attrs.align === 'left' || node.attrs.align === 'start'
        ? 'left'
        : node.attrs.align === 'right' || node.attrs.align === 'end'
        ? 'right'
        : 'left';

    measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = wrapTextLines(measureCtx, node.text || '', Math.max(120, maxW));
    const lineHeight = fontSize * 1.42;
    const widest = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 24);

    return {
      node,
      intrinsicWidth: Math.min(maxW, Math.ceil(widest) + 6),
      intrinsicHeight: Math.ceil(lines.length * lineHeight),
      lines,
      fontSize,
      lineHeight,
      fontFamily,
      fontWeight,
      textAlign,
      children: [],
    };
  }

  if (node.tag === 'Button') {
    const { fontSize, px, py } = resolveButtonSize(node.attrs.size);
    const fontFamily = FONT_FAMILY_MAP.sans;
    const fontWeight = 600;
    const label = (node.text || node.attrs.label || 'Action').trim();
    measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const textW = Math.ceil(measureCtx.measureText(label).width);
    const width = Math.min(maxAvailW, Math.max(88, textW + px * 2));
    const height = Math.max(44, Math.ceil(fontSize * 1.2 + py * 2));

    return {
      node,
      intrinsicWidth: width,
      intrinsicHeight: height,
      lines: [label],
      fontSize,
      lineHeight: fontSize * 1.2,
      fontFamily,
      fontWeight,
      textAlign: 'center',
      children: [],
    };
  }

  if (node.tag === 'Image') {
    const resolvedUrl = resolveImage(node.attrs.src);
    const img = (resolvedUrl && imageCache.get(resolvedUrl)) || null;
    const sourceBounds = img ? getImageSourceBounds(img) : null;
    const naturalRatio =
      sourceBounds?.aspectRatio ??
      (img && img.naturalWidth > 0 && img.naturalHeight > 0
        ? img.naturalWidth / img.naturalHeight
        : 1);

    const reqW = node.attrs.width ? parseNum(node.attrs.width, 220) : undefined;
    const reqH = node.attrs.height ? parseNum(node.attrs.height, 220) : undefined;
    const maxImageH = Math.max(96, maxAvailH * 0.78);

    let w: number;
    let h: number;
    if (reqW !== undefined && reqH !== undefined) {
      w = reqW;
      h = reqH;
    } else if (reqW !== undefined) {
      w = reqW;
      h = reqW / naturalRatio;
    } else if (reqH !== undefined) {
      h = reqH;
      w = reqH * naturalRatio;
    } else {
      const baseDim = compact ? Math.min(185, maxAvailW * 0.76) : 230;
      if (naturalRatio >= 1) {
        w = baseDim * Math.min(1.5, Math.sqrt(naturalRatio));
        h = w / naturalRatio;
      } else {
        h = baseDim * Math.min(1.5, 1 / Math.sqrt(naturalRatio));
        w = h * naturalRatio;
      }
    }

    const clampScale = Math.min(
      1,
      maxAvailW / Math.max(1, w),
      maxImageH / Math.max(1, h)
    );
    if (clampScale < 1) {
      w *= clampScale;
      h *= clampScale;
    }

    return {
      node,
      // 24px is the smallest box the image sampler draws (see sampleImageIntoBox), so small icons
      // keep the size they ask for instead of being pushed up to 48px.
      intrinsicWidth: Math.max(MIN_IMAGE_SIDE, Math.round(w)),
      intrinsicHeight: Math.max(MIN_IMAGE_SIDE, Math.round(h)),
      resolvedImg: img,
      children: [],
    };
  }

  if (node.tag === 'Divider') {
    const vertical = node.attrs.orientation === 'vertical';
    const len = Math.min(maxAvailW, parseNum(node.attrs.length || node.attrs.width, vertical ? 120 : 240));
    return {
      node,
      intrinsicWidth: vertical ? 4 : Math.max(40, len),
      intrinsicHeight: vertical ? Math.max(40, len) : 4,
      children: [],
    };
  }

  if (node.tag === 'Spacer') {
    const size = parseNum(node.attrs.size, 16);
    return {
      node,
      intrinsicWidth: size,
      intrinsicHeight: size,
      children: [],
    };
  }

  if (node.tag === 'Quote') {
    const fontStyle = resolveFontStyle(node.attrs.font, 'serif');
    const fontSize = resolveBodySize(node.attrs.size, compact);
    const fontFamily = FONT_FAMILY_MAP[fontStyle];
    const fontWeight = 500;
    const italic = fontStyle === 'serif' && node.attrs.italic !== 'false';
    const barGutter = 18;
    const defaultMaxW = Math.min(maxAvailW, compact ? 310 : 420);
    const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
    const textMaxW = Math.max(100, maxW - barGutter - 6);

    measureCtx.font = `${italic ? 'italic ' : ''}${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = wrapTextLines(measureCtx, node.text || 'Quote', textMaxW);
    const lineHeight = fontSize * 1.42;
    let widest = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 32);

    const cite = node.attrs.cite?.trim() || undefined;
    let citeSize: number | undefined;
    let citeLineHeight: number | undefined;
    if (cite) {
      citeSize = Math.max(12, Math.round(fontSize * 0.76));
      citeLineHeight = citeSize * 1.35;
      measureCtx.font = `500 ${citeSize}px ${FONT_FAMILY_MAP.sans}`;
      widest = Math.max(widest, measureCtx.measureText(`— ${cite}`).width);
    }

    const totalH =
      lines.length * lineHeight + (cite && citeLineHeight ? citeLineHeight + 6 : 0);

    return {
      node,
      intrinsicWidth: Math.min(maxW, Math.ceil(widest) + barGutter + 8),
      intrinsicHeight: Math.ceil(totalH),
      lines,
      fontSize,
      lineHeight,
      fontFamily,
      fontWeight,
      textAlign: 'left',
      quoteData: { barGutter, cite, citeSize, citeLineHeight, italic },
      children: [],
    };
  }

  if (node.tag === 'Code') {
    const fontStyle = resolveFontStyle(node.attrs.font, 'mono');
    const fontSize = clamp(resolveBodySize(node.attrs.size, compact) - 2, 12, 22);
    const fontFamily = FONT_FAMILY_MAP[fontStyle];
    const fontWeight = 500;
    const padX = 16;
    const padY = 12;
    const defaultMaxW = Math.min(maxAvailW, compact ? 320 : 460);
    const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
    const innerMaxW = Math.max(90, maxW - padX * 2);

    measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = wrapCodeLines(measureCtx, node.text || '', innerMaxW);
    const lineHeight = fontSize * 1.45;
    const widest = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 48);

    return {
      node,
      intrinsicWidth: Math.min(maxW, Math.max(140, Math.ceil(widest) + padX * 2)),
      intrinsicHeight: Math.ceil(lines.length * lineHeight + padY * 2),
      lines,
      fontSize,
      lineHeight,
      fontFamily,
      fontWeight,
      textAlign: 'left',
      codeData: { padX, padY },
      children: [],
    };
  }

  if (node.tag === 'List') {
    const fontStyle = resolveFontStyle(node.attrs.font, 'sans');
    const fontSize = resolveBodySize(node.attrs.size, compact);
    const fontFamily = FONT_FAMILY_MAP[fontStyle];
    const fontWeight = 500;
    const lineHeight = fontSize * 1.4;
    const itemGap = parseNum(node.attrs.gap, Math.round(fontSize * 0.42));

    const { texts, detectedOrdered } = extractListItems(node);
    const ordered =
      node.attrs.ordered === 'true' ||
      (node.attrs.ordered !== 'false' && detectedOrdered);
    const markerAttr = (node.attrs.marker || 'bullet').toLowerCase();
    const markerStyle: 'bullet' | 'dash' | 'diamond' =
      markerAttr === 'dash' ? 'dash' : markerAttr === 'diamond' ? 'diamond' : 'bullet';

    measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    let gutterW = Math.round(fontSize * 1.25);
    if (ordered) {
      const maxIndexW = measureCtx.measureText(`${Math.max(1, texts.length)}.`).width;
      gutterW = Math.max(gutterW, Math.ceil(maxIndexW) + 12);
    }

    const defaultMaxW = Math.min(maxAvailW, compact ? 320 : 440);
    const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
    const contentMaxW = Math.max(100, maxW - gutterW - 6);

    let widest = 32;
    let totalH = 0;
    const items = texts.map((text, idx) => {
      const itemLines = wrapTextLines(measureCtx, text, contentMaxW);
      for (const l of itemLines) {
        widest = Math.max(widest, measureCtx.measureText(l).width);
      }
      totalH += itemLines.length * lineHeight + (idx > 0 ? itemGap : 0);
      return {
        lines: itemLines,
        markerLabel: ordered ? `${idx + 1}.` : undefined,
      };
    });

    return {
      node,
      intrinsicWidth: Math.min(maxW, Math.ceil(gutterW + widest) + 6),
      intrinsicHeight: Math.max(Math.ceil(lineHeight), Math.ceil(totalH)),
      fontSize,
      lineHeight,
      fontFamily,
      fontWeight,
      listData: { items, ordered, markerStyle, gutterW, itemGap },
      children: [],
    };
  }

  if (node.tag === 'Table') {
    const fontStyle = resolveFontStyle(node.attrs.font, 'sans');
    const fontSize = clamp(resolveBodySize(node.attrs.size, compact) - 1, 12, 22);
    const fontFamily = FONT_FAMILY_MAP[fontStyle];
    const lineHeight = fontSize * 1.35;
    const cellPadX = compact ? 10 : 14;
    const cellPadY = compact ? 7 : 9;
    const bordered = node.attrs.bordered === 'true' || node.attrs.grid === 'true';

    const { rows: parsedRows, colAligns } = extractTableRows(node);
    const numCols = Math.max(1, ...parsedRows.map((r) => r.cells.length));
    const normalizedAligns: Array<'left' | 'center' | 'right'> = Array.from(
      { length: numCols },
      (_, idx) => colAligns[idx] || 'left'
    );

    const hasExplicitW = Boolean(node.attrs.width || node.attrs.maxWidth);
    const defaultMaxW = Math.min(maxAvailW, compact ? 340 : 540);
    const maxW = Math.min(
      maxAvailW,
      parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW)
    );

    // Measure natural column widths
    const naturalColW = new Array<number>(numCols).fill(48 + cellPadX * 2);
    for (const row of parsedRows) {
      measureCtx.font = `${row.isHeader ? 600 : 500} ${fontSize}px ${fontFamily}`;
      for (let c = 0; c < numCols; c++) {
        const cellText = row.cells[c]?.text || '';
        const textW = measureCtx.measureText(cellText).width;
        naturalColW[c] = Math.max(naturalColW[c], Math.ceil(textW) + cellPadX * 2 + 4);
      }
    }

    const totalNaturalW = naturalColW.reduce((a, b) => a + b, 0);
    const minColW = Math.min(68, Math.floor(maxW / numCols));
    let colWidths = [...naturalColW];

    if (totalNaturalW > maxW) {
      const scale = maxW / totalNaturalW;
      colWidths = naturalColW.map((w) => Math.max(minColW, Math.floor(w * scale)));
      const diff = maxW - colWidths.reduce((a, b) => a + b, 0);
      if (diff !== 0) {
        colWidths[numCols - 1] = Math.max(minColW, colWidths[numCols - 1] + diff);
      }
    } else if (hasExplicitW && totalNaturalW < maxW) {
      const extra = maxW - totalNaturalW;
      colWidths = naturalColW.map(
        (w) => w + Math.round((w / Math.max(1, totalNaturalW)) * extra)
      );
      const diff = maxW - colWidths.reduce((a, b) => a + b, 0);
      colWidths[numCols - 1] += diff;
    }

    let totalH = 0;
    const measuredRows = parsedRows.map((row) => {
      measureCtx.font = `${row.isHeader ? 600 : 500} ${fontSize}px ${fontFamily}`;
      let maxLines = 1;
      const cells: MeasuredTableCell[] = Array.from({ length: numCols }, (_, c) => {
        const parsedCell = row.cells[c];
        const align = parsedCell?.align || normalizedAligns[c];
        const cellText = parsedCell?.text || '';
        const innerCellW = Math.max(24, colWidths[c] - cellPadX * 2);
        const lines = cellText ? wrapTextLines(measureCtx, cellText, innerCellW) : [''];
        maxLines = Math.max(maxLines, lines.length);
        return { lines, align };
      });
      const height = Math.ceil(maxLines * lineHeight + cellPadY * 2);
      totalH += height;
      return { isHeader: row.isHeader, height, cells };
    });

    const totalW = colWidths.reduce((a, b) => a + b, 0);
    return {
      node,
      intrinsicWidth: Math.ceil(totalW),
      intrinsicHeight: Math.ceil(totalH),
      fontSize,
      lineHeight,
      fontFamily,
      tableData: {
        colWidths,
        colAligns: normalizedAligns,
        rows: measuredRows,
        cellPadX,
        cellPadY,
        bordered,
      },
      children: [],
    };
  }

  if (node.tag === 'MindMap') {
    const result = layoutMindMap(
      extractMindMapTree(node),
      {
        layout: (node.attrs.layout || 'radial').toLowerCase() === 'tree' ? 'tree' : 'radial',
        fontFamily: FONT_FAMILY_MAP[resolveFontStyle(node.attrs.font, 'sans')],
        siblingGap: parseNum(node.attrs.gap, compact ? 10 : 14),
        levelGap: parseNum(node.attrs.levelGap || node.attrs.colGap, compact ? 34 : 54),
        branchGap: parseNum(node.attrs.branchGap, compact ? 16 : 22),
        compact,
      },
      { ...mindMap, density: nodeDensity.get(node) ?? mindMap.density },
      measureCtx
    );
    return {
      node,
      intrinsicWidth: result.width,
      intrinsicHeight: result.height,
      mindMapData: result.data,
      children: [],
    };
  }

  // Container: Col or Row
  const pad = parseNum(node.attrs.padding, 0);
  const gap = parseNum(node.attrs.gap, node.tag === 'Row' ? 20 : 16);
  const containerMaxW = node.attrs.width
    ? Math.min(maxAvailW, parseNum(node.attrs.width, maxAvailW))
    : maxAvailW;
  const innerAvailW = Math.max(80, containerMaxW - pad * 2);

  const innerAvailH = Math.max(96, maxAvailH - pad * 2);
  const measureChild = (child: LayoutNode, mm: MindMapContext) =>
    measureNode(child, measureCtx, innerAvailW, innerAvailH, defaultFontStyle, imageCache, resolveImage, compact, mm);

  // In a column, a mind map gets the height its siblings leave (e.g. a row of buttons below it), so it
  // folds/pages to fit the screen together with them instead of making the layout scroll.
  const mindMapCount = node.tag === 'Row' ? 0 : node.children.filter((c) => c.tag === 'MindMap').length;
  let measuredChildren: MeasuredLayoutNode[];
  if (mindMapCount === 0) {
    measuredChildren = node.children.map((child) => measureChild(child, mindMap));
  } else {
    const others = node.children.map((child) => (child.tag === 'MindMap' ? null : measureChild(child, mindMap)));
    const othersH =
      others.reduce((acc, m) => acc + (m ? m.intrinsicHeight : 0), 0) + Math.max(0, node.children.length - 1) * gap;
    const mapMaxH = Math.max(120, Math.min(mindMap.maxH, (innerAvailH - othersH) / mindMapCount));
    const mapCtx: MindMapContext = { ...mindMap, maxH: mapMaxH };
    measuredChildren = node.children.map((child, i) => others[i] ?? measureChild(child, mapCtx));
  }

  if (node.tag === 'Row') {
    // Auto-wrap if requested or if a wide horizontal row exceeds narrow screens
    const allowWrap = node.attrs.wrap === 'true' || compact;
    const rows: MeasuredLayoutNode[][] = [];
    let currentRow: MeasuredLayoutNode[] = [];
    let currentRowW = 0;

    for (const ch of measuredChildren) {
      const addW = currentRow.length > 0 ? gap + ch.intrinsicWidth : ch.intrinsicWidth;
      if (allowWrap && currentRow.length > 0 && currentRowW + addW > innerAvailW) {
        rows.push(currentRow);
        currentRow = [ch];
        currentRowW = ch.intrinsicWidth;
      } else {
        currentRow.push(ch);
        currentRowW += addW;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    let maxRowW = 0;
    let totalH = 0;
    rows.forEach((r, idx) => {
      const rW =
        r.reduce((acc, item) => acc + item.intrinsicWidth, 0) +
        Math.max(0, r.length - 1) * gap;
      const rH = Math.max(...r.map((item) => item.intrinsicHeight), 0);
      if (rW > maxRowW) maxRowW = rW;
      totalH += rH + (idx > 0 ? gap : 0);
    });

    return {
      node,
      intrinsicWidth: maxRowW + pad * 2,
      intrinsicHeight: totalH + pad * 2,
      children: measuredChildren,
      wrappedRows: rows,
    };
  }

  // Col
  const totalH =
    measuredChildren.reduce((acc, item) => acc + item.intrinsicHeight, 0) +
    Math.max(0, measuredChildren.length - 1) * gap;
  const maxW = Math.max(...measuredChildren.map((item) => item.intrinsicWidth), 0);

  return {
    node,
    intrinsicWidth: maxW + pad * 2,
    intrinsicHeight: totalH + pad * 2,
    children: measuredChildren,
  };
}

interface PlacedLeaf {
  measured: MeasuredLayoutNode;
  rect: ResolvedRect;
  ripple: RippleInheritConfig;
}

function arrangeNode(
  measured: MeasuredLayoutNode,
  rect: ResolvedRect,
  outLeaves: PlacedLeaf[],
  inheritedRipple: RippleInheritConfig = {}
): void {
  const { node } = measured;
  const localRipple = mergeRippleConfig(inheritedRipple, node.attrs);
  if (node.tag !== 'Col' && node.tag !== 'Row') {
    outLeaves.push({ measured, rect, ripple: localRipple });
    return;
  }

  const pad = parseNum(node.attrs.padding, 0);
  const gap = parseNum(node.attrs.gap, node.tag === 'Row' ? 20 : 16);
  const align = (node.attrs.align || 'center').toLowerCase();
  const justify = (node.attrs.justify || 'center').toLowerCase();

  const innerX = rect.x + pad;
  const innerY = rect.y + pad;
  const innerW = Math.max(1, rect.width - pad * 2);
  const innerH = Math.max(1, rect.height - pad * 2);

  if (node.tag === 'Row') {
    const rows = measured.wrappedRows || [measured.children];
    const rowHeights = rows.map((r) => Math.max(...r.map((c) => c.intrinsicHeight), 0));
    const totalRowsH =
      rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, rows.length - 1) * gap;

    let cursorY = innerY + Math.max(0, (innerH - totalRowsH) * 0.5);

    rows.forEach((rowChildren, rIdx) => {
      const rowH = rowHeights[rIdx];
      const contentW =
        rowChildren.reduce((a, c) => a + c.intrinsicWidth, 0) +
        Math.max(0, rowChildren.length - 1) * gap;

      let cursorX = innerX;
      let extraGap = gap;
      if (justify === 'center') {
        cursorX = innerX + Math.max(0, (innerW - contentW) * 0.5);
      } else if (justify === 'end' || justify === 'right') {
        cursorX = innerX + Math.max(0, innerW - contentW);
      } else if (justify === 'between' && rowChildren.length > 1) {
        const sumWidths = rowChildren.reduce((a, c) => a + c.intrinsicWidth, 0);
        extraGap = Math.max(gap, (innerW - sumWidths) / (rowChildren.length - 1));
      }

      for (const ch of rowChildren) {
        let cy = cursorY;
        if (align === 'center') {
          cy = cursorY + (rowH - ch.intrinsicHeight) * 0.5;
        } else if (align === 'end' || align === 'bottom') {
          cy = cursorY + (rowH - ch.intrinsicHeight);
        }

        arrangeNode(
          ch,
          {
            x: cursorX,
            y: cy,
            width: ch.intrinsicWidth,
            height: ch.intrinsicHeight,
          },
          outLeaves,
          localRipple
        );
        cursorX += ch.intrinsicWidth + extraGap;
      }

      cursorY += rowH + gap;
    });
    return;
  }

  // Col
  const contentH =
    measured.children.reduce((a, c) => a + c.intrinsicHeight, 0) +
    Math.max(0, measured.children.length - 1) * gap;

  let cursorY = innerY;
  let extraGap = gap;
  if (justify === 'center') {
    cursorY = innerY + Math.max(0, (innerH - contentH) * 0.5);
  } else if (justify === 'end' || justify === 'bottom') {
    cursorY = innerY + Math.max(0, innerH - contentH);
  } else if (justify === 'between' && measured.children.length > 1) {
    const sumHeights = measured.children.reduce((a, c) => a + c.intrinsicHeight, 0);
    extraGap = Math.max(gap, (innerH - sumHeights) / (measured.children.length - 1));
  }

  for (const ch of measured.children) {
    let cx = innerX;
    if (align === 'center') {
      cx = innerX + (innerW - ch.intrinsicWidth) * 0.5;
    } else if (align === 'end' || align === 'right') {
      cx = innerX + (innerW - ch.intrinsicWidth);
    }

    arrangeNode(
      ch,
      {
        x: cx,
        y: cursorY,
        width: ch.intrinsicWidth,
        height: ch.intrinsicHeight,
      },
      outLeaves,
      localRipple
    );
    cursorY += ch.intrinsicHeight + extraGap;
  }
}

function sampleCanvasRegion(
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  rect: ResolvedRect,
  density: DensityPreset,
  baseFontSize: number,
  regionId?: number,
  stepOverride?: number
): SampledPoint[] {
  const w = Math.max(12, Math.ceil(rect.width));
  const h = Math.max(12, Math.ceil(rect.height));
  const sampleScale = baseFontSize <= 54 ? 2 : 1;

  const offscreen = document.createElement('canvas');
  offscreen.width = w * sampleScale;
  offscreen.height = h * sampleScale;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.setTransform(sampleScale, 0, 0, sampleScale, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawFn(ctx, w, h);

  const data = ctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
  const baseStep = density === 'dense' ? 1 : density === 'balanced' ? 2 : 3;
  const step =
    stepOverride ??
    (baseFontSize <= 26 && sampleScale === 2 ? Math.min(2, baseStep) : baseStep);
  const alphaThreshold = baseFontSize <= 36 ? 105 : 95;
  const jitter = (step / sampleScale) * (baseFontSize <= 26 ? 0.34 : 0.48);

  const points: SampledPoint[] = [];
  for (let y = 0; y < offscreen.height; y += step) {
    const row = y * offscreen.width;
    const pyBase = rect.y + y / sampleScale;
    for (let x = 0; x < offscreen.width; x += step) {
      const a = data[(row + x) * 4 + 3];
      if (a > alphaThreshold) {
        const pxBase = rect.x + x / sampleScale;
        const normA = a / 255;
        points.push({
          x: pxBase + (Math.random() - 0.5) * jitter,
          y: pyBase + (Math.random() - 0.5) * jitter,
          weight: clamp(0.45 + normA * 0.55, 0.35, 1),
          regionId,
        });
      }
    }
  }
  return points;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function emitParticleLine(
  out: SampledPoint[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stepPx: number,
  weight: number,
  jitterPx: number,
  regionId: number
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const count = Math.max(2, Math.round(dist / Math.max(0.8, stepPx)));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    out.push({
      x: x0 + dx * t + (Math.random() - 0.5) * jitterPx,
      y: y0 + dy * t + (Math.random() - 0.5) * jitterPx,
      weight,
      regionId,
    });
  }
}

function emitParticleCubicBezier(
  out: SampledPoint[],
  x0: number,
  y0: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x1: number,
  y1: number,
  stepPx: number,
  weight: number,
  jitterPx: number,
  regionId: number
): void {
  const approxLen =
    (Math.hypot(cx1 - x0, cy1 - y0) +
      Math.hypot(cx2 - cx1, cy2 - cy1) +
      Math.hypot(x1 - cx2, y1 - cy2) +
      Math.hypot(x1 - x0, y1 - y0)) *
    0.65;
  const count = Math.max(10, Math.round(approxLen / Math.max(1, stepPx)));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const u = 1 - t;
    const px =
      u * u * u * x0 +
      3 * u * u * t * cx1 +
      3 * u * t * t * cx2 +
      t * t * t * x1;
    const py =
      u * u * u * y0 +
      3 * u * u * t * cy1 +
      3 * u * t * t * cy2 +
      t * t * t * y1;
    out.push({
      x: px + (Math.random() - 0.5) * jitterPx,
      y: py + (Math.random() - 0.5) * jitterPx,
      weight,
      regionId,
    });
  }
}

function emitParticleRoundedRect(
  out: SampledPoint[],
  x: number,
  y: number,
  w: number,
  h: number,
  stepPx: number,
  weight: number,
  jitterPx: number,
  regionId: number
): void {
  const perim = 2 * (w + h);
  const count = Math.max(24, Math.round(perim / Math.max(1.2, stepPx)));
  for (let i = 0; i < count; i++) {
    const d = (i / count) * perim;
    let bx = x;
    let by = y;
    if (d < w) {
      bx = x + d;
      by = y;
    } else if (d < w + h) {
      bx = x + w;
      by = y + (d - w);
    } else if (d < w * 2 + h) {
      bx = x + w - (d - w - h);
      by = y + h;
    } else {
      bx = x;
      by = y + h - (d - w * 2 - h);
    }
    out.push({
      x: bx + (Math.random() - 0.5) * jitterPx,
      y: by + (Math.random() - 0.5) * jitterPx,
      weight,
      regionId,
    });
  }
}

/**
 * Resolves a declarative LayoutNode AST into screen coordinates, interactive HitRegions,
 * and unified particle targets across Headings, Texts, Images, Buttons, Markdown blocks, and MindMaps.
 */
export function sampleLayoutScene(
  root: LayoutNode | null,
  viewportWidth: number,
  viewportHeight: number,
  sceneDensity: DensityPreset,
  defaultFontStyle: FontStyle,
  invertContrast: boolean,
  isDarkTheme: boolean,
  imageTuning: ImageTuningConfig,
  imageCache: Map<string, HTMLImageElement>,
  resolveImage: LayoutImageResolver,
  sceneOptions: LayoutSceneOptions = {}
): LayoutSceneResult {
  const empty: LayoutSceneResult = {
    points: [],
    hitRegions: [],
    rippleRegions: [],
    cellSize: 2,
    scrollMax: 0,
    screenBudget: 0,
    priorityRegionIds: [],
    mindMapCollapsedIds: [],
    mindMapDroppedExpansions: [],
  };
  if (!root || viewportWidth < 120 || viewportHeight < 120) {
    return empty;
  }

  const density = sceneDensity;
  assignDensities(root, sceneDensity);

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return empty;

  const {
    leftInset = 0,
    collapsedMindMapIds,
    overflow = 'scroll',
    minFontSize = 14,
    particleBudget,
    trim = true,
  } = sceneOptions;
  const compact = viewportWidth < 640;
  const defaultPad = compact ? 16 : 32;
  const padding = sceneOptions.padding ?? {
    top: defaultPad,
    right: defaultPad,
    bottom: defaultPad,
    left: defaultPad,
  };
  const topReserve = padding.top;
  const bottomReserve = padding.bottom;
  const usableLeft = leftInset + padding.left;
  const usableRight = viewportWidth - padding.right;

  const safeW = Math.max(160, usableRight - usableLeft);
  const safeH = Math.max(96, viewportHeight - topReserve - bottomReserve);

  const totalBudget = Math.max(1000, Math.round(particleBudget ?? LAYOUT_BUDGET_BY_DENSITY[density]));
  const mindMap: MindMapContext = {
    controlledIds: collapsedMindMapIds,
    expanded: sceneOptions.mindMapExpanded,
    collapsed: sceneOptions.mindMapCollapsed,
    pages: sceneOptions.mindMapPages,
    fit: sceneOptions.mindMapFit ?? 'collapse',
    maxW: safeW,
    maxH: safeH,
    maxScale: sceneOptions.mindMapMaxScale ?? 1.6,
    budget: totalBudget,
    density,
    collapsedOut: new Set(),
    droppedOut: new Set(),
  };
  const measured = measureNode(
    root,
    measureCtx,
    Math.min(safeW, 920),
    safeH,
    defaultFontStyle,
    imageCache,
    resolveImage,
    compact,
    mindMap
  );

  // Uniformly scale down the scene if it exceeds the safe viewport. In 'scroll' mode the height fit
  // never shrinks text below minFontSize; whatever still overflows becomes scrollable.
  const widthFit = safeW / Math.max(1, measured.intrinsicWidth);
  const heightFit = safeH / Math.max(1, measured.intrinsicHeight);
  let fitScale: number;
  if (overflow === 'fit') {
    fitScale = Math.min(1, widthFit, heightFit);
  } else {
    const smallest = smallestFontSize(measured);
    const legibleFloor = Number.isFinite(smallest) ? Math.min(1, minFontSize / smallest) : 1;
    fitScale = Math.min(1, widthFit, Math.max(heightFit, legibleFloor));
  }

  const rootW = measured.intrinsicWidth;
  const rootH = measured.intrinsicHeight;
  const scaledH = rootH * fitScale;
  const overflows = overflow === 'scroll' && scaledH > safeH + 0.5;
  const scrollMax = overflows ? Math.ceil(scaledH - safeH) : 0;
  const rootX = usableLeft + (safeW - rootW) * 0.5;
  // Overflowing content starts at the top of the safe area (scaled about its top edge); otherwise centered.
  const rootY = overflows ? topReserve : topReserve + (safeH - rootH) * 0.5;

  const placedLeaves: PlacedLeaf[] = [];
  arrangeNode(measured, { x: rootX, y: rootY, width: rootW, height: rootH }, placedLeaves);

  // Apply uniform viewport-fit scaling if needed
  if (fitScale < 0.995) {
    const cx = usableLeft + safeW * 0.5;
    const cy = overflows ? topReserve : topReserve + safeH * 0.5;
    for (const leaf of placedLeaves) {
      leaf.rect = {
        x: cx + (leaf.rect.x - cx) * fitScale,
        y: cy + (leaf.rect.y - cy) * fitScale,
        width: leaf.rect.width * fitScale,
        height: leaf.rect.height * fitScale,
      };
      if (leaf.measured.fontSize) {
        leaf.measured.fontSize *= fitScale;
      }
      if (leaf.measured.lineHeight) {
        leaf.measured.lineHeight *= fitScale;
      }
      if (leaf.measured.quoteData) {
        leaf.measured.quoteData.barGutter *= fitScale;
        if (leaf.measured.quoteData.citeSize) {
          leaf.measured.quoteData.citeSize *= fitScale;
        }
        if (leaf.measured.quoteData.citeLineHeight) {
          leaf.measured.quoteData.citeLineHeight *= fitScale;
        }
      }
      if (leaf.measured.codeData) {
        leaf.measured.codeData.padX *= fitScale;
        leaf.measured.codeData.padY *= fitScale;
      }
      if (leaf.measured.listData) {
        leaf.measured.listData.gutterW *= fitScale;
        leaf.measured.listData.itemGap *= fitScale;
      }
      if (leaf.measured.tableData) {
        leaf.measured.tableData.cellPadX *= fitScale;
        leaf.measured.tableData.cellPadY *= fitScale;
        leaf.measured.tableData.colWidths = leaf.measured.tableData.colWidths.map(
          (cw) => cw * fitScale
        );
        for (const r of leaf.measured.tableData.rows) {
          r.height *= fitScale;
        }
      }
    }
  }

  const hitRegions: LayoutHitRegion[] = [];
  const rippleRegions: RippleRegion[] = [];
  const buttonRegionIds = new Set<number>();
  const textAndControlPoints: SampledPoint[] = [];
  const imageLeaves: Array<{ leaf: PlacedLeaf; regionId: number }> = [];

  for (const leaf of placedLeaves) {
    const { node } = leaf.measured;
    const { rect, ripple } = leaf;
    const density = nodeDensity.get(node) ?? sceneDensity;

    if (node.tag === 'Spacer') {
      continue;
    }

    const regionId = rippleRegions.length;
    rippleRegions.push({
      id: regionId,
      tag: node.tag,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      cx: rect.x + rect.width * 0.5,
      cy: rect.y + rect.height * 0.5,
      pattern: ripple.pattern,
      trigger: ripple.trigger,
      strength: ripple.strength,
      speed: ripple.speed,
      wavelength: ripple.wavelength,
    });

    // Any element (not just <Button>) can be clickable via an `action` attribute, e.g. an icon link:
    // <Image src="/icons/x.svg" action="open:https://…" />. Its particles are never thinned.
    const leafAction = node.attrs.action;
    if (leafAction && node.tag !== 'Button' && node.tag !== 'MindMap') {
      const hitPad = 4;
      hitRegions.push({
        id: hitRegions.length,
        rippleRegionId: regionId,
        x: rect.x - hitPad,
        y: rect.y - hitPad,
        width: rect.width + hitPad * 2,
        height: rect.height + hitPad * 2,
        action: leafAction,
        label: node.attrs.label || node.attrs.alt || node.text || leafAction,
      });
      buttonRegionIds.add(regionId);
    }

    if (node.tag === 'Image') {
      imageLeaves.push({ leaf, regionId });
      continue;
    }

    if (node.tag === 'MindMap' && leaf.measured.mindMapData) {
      // Remove placeholder aggregate MindMap region so each branch owns its own RippleRegion
      rippleRegions.pop();

      const mmData = leaf.measured.mindMapData;
      const sx = rect.width / Math.max(1, leaf.measured.intrinsicWidth);
      const sy = rect.height / Math.max(1, leaf.measured.intrinsicHeight);
      const nodeRegionMap = new Map<string, number>();

      for (const mmNode of mmData.nodes) {
        const nx = rect.x + mmNode.x * sx;
        const ny = rect.y + mmNode.y * sy;
        const nw = mmNode.width * sx;
        const nh = mmNode.height * sy;
        const nFontSize = mmNode.fontSize * sy;
        const nLineHeight = mmNode.lineHeight * sy;
        const nPadX = mmNode.padX * sx;
        const nBadgeW = mmNode.badgeW * sx;

        const mmRipple = mergeRippleConfig(ripple, mmNode.attrs);
        const nodeRegionId = rippleRegions.length;
        nodeRegionMap.set(mmNode.id, nodeRegionId);
        buttonRegionIds.add(nodeRegionId);

        rippleRegions.push({
          id: nodeRegionId,
          tag: mmNode.depth === 0 ? 'MindMap' : 'Branch',
          x: nx,
          y: ny,
          width: nw,
          height: nh,
          cx: nx + nw * 0.5,
          cy: ny + nh * 0.5,
          pattern: mmRipple.pattern,
          trigger: mmRipple.trigger,
          strength: mmRipple.strength,
          speed: mmRipple.speed,
          wavelength: mmRipple.wavelength,
        });

        if (mmNode.totalChildCount > 0 || mmNode.pager) {
          const hitPad = 4;
          hitRegions.push({
            id: hitRegions.length,
            rippleRegionId: nodeRegionId,
            x: nx - hitPad,
            y: ny - hitPad,
            width: nw + hitPad * 2,
            height: nh + hitPad * 2,
            action: mmNode.pager
              ? `mindmap:page:${mmNode.pagerOf}:${mmNode.pager}`
              : `mindmap:toggle:${mmNode.id}`,
            label: mmNode.label,
          });
        }

        const labelPts = sampleCanvasRegion(
          (ctx, w, h) => {
            ctx.fillStyle = '#ffffff';
            ctx.font = `${mmNode.fontWeight} ${nFontSize}px ${mmNode.fontFamily}`;
            ctx.textBaseline = 'middle';

            const contentW = Math.max(16, w - nPadX * 2 - nBadgeW);
            const totalBlock = mmNode.lines.length * nLineHeight;
            const startY = (h - totalBlock) * 0.5 + nLineHeight * 0.5;
            ctx.textAlign = 'center';
            const textAnchorX = nPadX + contentW * 0.5;

            mmNode.lines.forEach((line, idx) => {
              ctx.fillText(line, textAnchorX, startY + idx * nLineHeight);
            });

            if (mmNode.badgeText) {
              const badgeSize = Math.max(9.5, nFontSize * 0.78);
              ctx.fillStyle = mmNode.isCollapsed
                ? '#ffffff'
                : 'rgba(255, 255, 255, 0.72)';
              ctx.font = `600 ${badgeSize}px ${mmNode.fontFamily}`;
              ctx.textAlign = 'right';
              ctx.fillText(mmNode.badgeText, w - nPadX * 0.8, h * 0.5 + 0.5);
            }
          },
          { x: nx, y: ny, width: nw, height: nh },
          density,
          nFontSize,
          nodeRegionId
        );

        // Match button/heading brightness so node labels read as clearly as the rest of the layout.
        const textBoost = mmNode.depth === 0 ? 1 : mmNode.depth === 1 ? 0.97 : 0.92;
        for (const pt of labelPts) {
          pt.weight = clamp((pt.weight ?? 0.84) * textBoost, 0.5, 1);
          textAndControlPoints.push(pt);
        }

        // Tiered node frames: bright capsule rim for root/collapsed hubs, light frame for depth-1, sleek underline for leaves
        if (mmNode.depth <= 1 || mmNode.isCollapsed || mmNode.pager) {
          // Dense enough to read as a solid outline (like buttons), not a dotted one.
          const borderStep =
            mmNode.depth === 0
              ? density === 'dense'
                ? 1.5
                : 1.9
              : density === 'dense'
              ? 1.8
              : 2.2;
          const borderWeight =
            mmNode.depth === 0 ? 0.95 : mmNode.isCollapsed ? 0.92 : 0.8;
          emitParticleRoundedRect(
            textAndControlPoints,
            nx + 1.5,
            ny + 1.5,
            Math.max(8, nw - 3),
            Math.max(8, nh - 3),
            borderStep,
            borderWeight,
            0.9,
            nodeRegionId
          );
        } else {
          const lineStep = density === 'dense' ? 1.8 : 2.2;
          emitParticleLine(
            textAndControlPoints,
            nx + 4,
            ny + nh - 1.5,
            nx + nw - 4,
            ny + nh - 1.5,
            lineStep,
            0.7,
            0.8,
            nodeRegionId
          );
        }
      }

      // Emit organic cubic Bezier splines connecting parent ports to child ports
      const curveStep = density === 'dense' ? 2.0 : density === 'balanced' ? 2.6 : 3.4;
      for (const edge of mmData.edges) {
        const targetRegionId = nodeRegionMap.get(edge.toId) ?? regionId;
        const x0 = rect.x + edge.x0 * sx;
        const y0 = rect.y + edge.y0 * sy;
        const x1 = rect.x + edge.x1 * sx;
        const y1 = rect.y + edge.y1 * sy;
        const dx = x1 - x0;
        const cx1 = x0 + dx * 0.48;
        const cx2 = x1 - dx * 0.48;
        const curveWeight = clamp(0.66 - edge.childDepth * 0.08, 0.46, 0.68);

        emitParticleCubicBezier(
          textAndControlPoints,
          x0,
          y0,
          cx1,
          y0,
          cx2,
          y1,
          x1,
          y1,
          curveStep,
          curveWeight,
          0.95,
          targetRegionId
        );

        // Anchor port node cluster
        for (let d = 0; d < 4; d++) {
          textAndControlPoints.push({
            x: x1 + (Math.random() - 0.5) * 2.2,
            y: y1 + (Math.random() - 0.5) * 2.2,
            weight: 0.85,
            regionId: targetRegionId,
          });
        }
      }

      continue;
    }

    if (node.tag === 'Divider') {
      const vertical = node.attrs.orientation === 'vertical';
      const count = Math.max(
        24,
        Math.round((vertical ? rect.height : rect.width) * (density === 'dense' ? 1.4 : 0.95))
      );
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        const centerGlow = 0.45 + 0.55 * Math.sin(t * Math.PI);
        textAndControlPoints.push({
          x: vertical
            ? rect.x + rect.width * 0.5 + (Math.random() - 0.5) * 1.4
            : rect.x + t * rect.width,
          y: vertical
            ? rect.y + t * rect.height
            : rect.y + rect.height * 0.5 + (Math.random() - 0.5) * 1.4,
          weight: centerGlow * 0.78,
          regionId,
        });
      }
      continue;
    }

    if (node.tag === 'Button') {
      const hitId = hitRegions.length;
      const label = leaf.measured.lines?.[0] || 'Action';
      const action = node.attrs.action || 'scatter';
      buttonRegionIds.add(regionId);
      hitRegions.push({
        id: hitId,
        rippleRegionId: regionId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        action,
        label,
      });

      const isSolid = node.attrs.variant === 'solid' || node.attrs.solid === 'true';
      const fontSize = leaf.measured.fontSize || 16;
      const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP.sans;
      const fontWeight = 600;

      if (isSolid) {
        // Pass 1: Soft frosted solid fill plate with a cleared contrast moat around text & rim
        const plateStep = density === 'dense' ? 5 : density === 'balanced' ? 6 : 7;
        const platePts = sampleCanvasRegion(
          (ctx, w, h) => {
            drawRoundedRectPath(ctx, 4, 4, w - 8, h - 8, 7);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6.5;
            ctx.lineJoin = 'round';
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeText(label, w * 0.5, h * 0.5 + 0.5);
            ctx.fillText(label, w * 0.5, h * 0.5 + 0.5);
            ctx.restore();
          },
          rect,
          density,
          fontSize,
          regionId,
          plateStep
        );
        for (const pt of platePts) {
          pt.weight = 0.34;
          textAndControlPoints.push(pt);
        }
      }

      // Pass 2: High-clarity foreground label and rounded border rim
      const btnPts = sampleCanvasRegion(
        (ctx, w, h) => {
          drawRoundedRectPath(ctx, 2, 2, w - 4, h - 4, 9);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = isSolid ? 2.6 : 2.1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, w * 0.5, h * 0.5 + 0.5);
        },
        rect,
        density,
        fontSize,
        regionId
      );

      // Ensure border outlines always feel crisp even at sparse density
      const perimeterDots = Math.max(44, Math.round((rect.width + rect.height) * 0.7));
      const perim = 2 * (rect.width + rect.height);
      for (let i = 0; i < perimeterDots; i++) {
        const d = (i / perimeterDots) * perim;
        let bx = rect.x;
        let by = rect.y;
        if (d < rect.width) {
          bx = rect.x + d;
          by = rect.y + 2;
        } else if (d < rect.width + rect.height) {
          bx = rect.x + rect.width - 2;
          by = rect.y + (d - rect.width);
        } else if (d < rect.width * 2 + rect.height) {
          bx = rect.x + rect.width - (d - rect.width - rect.height);
          by = rect.y + rect.height - 2;
        } else {
          bx = rect.x + 2;
          by = rect.y + rect.height - (d - rect.width * 2 - rect.height);
        }
        textAndControlPoints.push({
          x: bx + (Math.random() - 0.5) * 1.1,
          y: by + (Math.random() - 0.5) * 1.1,
          weight: isSolid ? 0.96 : 0.78,
          regionId,
        });
      }

      for (const pt of btnPts) {
        if (isSolid) {
          pt.weight = clamp((pt.weight ?? 0.85) * 1.08, 0.72, 1);
        }
        textAndControlPoints.push(pt);
      }
      continue;
    }

    if (node.tag === 'Quote') {
      const qData = leaf.measured.quoteData;
      const lines = leaf.measured.lines || [];
      const fontSize = leaf.measured.fontSize || 18;
      const lineHeight = leaf.measured.lineHeight || fontSize * 1.42;
      const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP.serif;
      const fontWeight = leaf.measured.fontWeight || 500;
      const barGutter = qData?.barGutter ?? 18;
      const italic = qData?.italic ?? true;

      // Glowing vertical accent bar emitted directly as crisp particle dots
      const barStep = density === 'dense' ? 1.5 : density === 'balanced' ? 2.1 : 2.8;
      emitParticleLine(
        textAndControlPoints,
        rect.x + 2,
        rect.y + 3,
        rect.x + 2,
        rect.y + rect.height - 3,
        barStep,
        0.92,
        1.1,
        regionId
      );
      emitParticleLine(
        textAndControlPoints,
        rect.x + 3.6,
        rect.y + 4,
        rect.x + 3.6,
        rect.y + rect.height - 4,
        barStep,
        0.84,
        1.0,
        regionId
      );

      const qPts = sampleCanvasRegion(
        (ctx) => {
          ctx.fillStyle = '#ffffff';
          ctx.font = `${italic ? 'italic ' : ''}${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          lines.forEach((line, idx) => {
            ctx.fillText(line, barGutter, idx * lineHeight + lineHeight * 0.5);
          });

          if (qData?.cite && qData.citeSize && qData.citeLineHeight) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
            ctx.font = `500 ${qData.citeSize}px ${FONT_FAMILY_MAP.sans}`;
            const citeY =
              lines.length * lineHeight + 6 + qData.citeLineHeight * 0.5;
            ctx.fillText(`— ${qData.cite}`, barGutter, citeY);
          }
        },
        rect,
        density,
        fontSize,
        regionId
      );

      const opacityScale = parseNum(node.attrs.opacity, 0.86);
      for (const pt of qPts) {
        pt.weight = clamp((pt.weight ?? 0.84) * opacityScale, 0.35, 1);
        textAndControlPoints.push(pt);
      }
      continue;
    }

    if (node.tag === 'Code') {
      const cData = leaf.measured.codeData;
      const lines = leaf.measured.lines || [];
      const fontSize = leaf.measured.fontSize || 15;
      const lineHeight = leaf.measured.lineHeight || fontSize * 1.45;
      const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP.mono;
      const padX = cData?.padX ?? 16;
      const padY = cData?.padY ?? 12;

      const codePts = sampleCanvasRegion(
        (ctx) => {
          ctx.fillStyle = '#ffffff';
          ctx.font = `500 ${fontSize}px ${fontFamily}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          lines.forEach((line, idx) => {
            if (line) {
              ctx.fillText(line, padX, padY + idx * lineHeight + lineHeight * 0.5);
            }
          });
        },
        rect,
        density,
        fontSize,
        regionId
      );

      const boxStep = density === 'dense' ? 2.2 : density === 'balanced' ? 2.8 : 3.6;
      const x0 = rect.x + 2;
      const y0 = rect.y + 2;
      const x1 = rect.x + rect.width - 2;
      const y1 = rect.y + rect.height - 2;
      emitParticleLine(textAndControlPoints, x0, y0, x1, y0, boxStep, 0.62, 0.9, regionId);
      emitParticleLine(textAndControlPoints, x1, y0, x1, y1, boxStep, 0.62, 0.9, regionId);
      emitParticleLine(textAndControlPoints, x1, y1, x0, y1, boxStep, 0.62, 0.9, regionId);
      emitParticleLine(textAndControlPoints, x0, y1, x0, y0, boxStep, 0.62, 0.9, regionId);

      for (const pt of codePts) {
        pt.weight = clamp((pt.weight ?? 0.85) * 0.92, 0.35, 1);
        textAndControlPoints.push(pt);
      }
      continue;
    }

    if (node.tag === 'List' && leaf.measured.listData) {
      const { items, ordered, markerStyle, gutterW, itemGap } = leaf.measured.listData;
      const fontSize = leaf.measured.fontSize || 18;
      const lineHeight = leaf.measured.lineHeight || fontSize * 1.4;
      const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP.sans;
      const fontWeight = leaf.measured.fontWeight || 500;

      const listPts = sampleCanvasRegion(
        (ctx) => {
          ctx.fillStyle = '#ffffff';
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.textBaseline = 'middle';

          let curY = 0;
          items.forEach((item, idx) => {
            if (ordered && item.markerLabel) {
              ctx.textAlign = 'right';
              ctx.fillText(item.markerLabel, gutterW - 9, curY + lineHeight * 0.5);
            }
            ctx.textAlign = 'left';
            item.lines.forEach((line, lIdx) => {
              ctx.fillText(line, gutterW, curY + lIdx * lineHeight + lineHeight * 0.5);
            });
            curY += item.lines.length * lineHeight + (idx < items.length - 1 ? itemGap : 0);
          });
        },
        rect,
        density,
        fontSize,
        regionId
      );

      if (!ordered) {
        let curY = 0;
        const bulletDots = density === 'dense' ? 12 : density === 'balanced' ? 9 : 6;
        items.forEach((item) => {
          const bx = rect.x + gutterW * 0.44;
          const by = rect.y + curY + lineHeight * 0.5;
          if (markerStyle === 'dash') {
            emitParticleLine(
              textAndControlPoints,
              bx - 4,
              by,
              bx + 4,
              by,
              1.2,
              0.94,
              0.7,
              regionId
            );
          } else if (markerStyle === 'diamond') {
            const r = 3;
            emitParticleLine(textAndControlPoints, bx, by - r, bx + r, by, 1.3, 0.94, 0.5, regionId);
            emitParticleLine(textAndControlPoints, bx + r, by, bx, by + r, 1.3, 0.94, 0.5, regionId);
            emitParticleLine(textAndControlPoints, bx, by + r, bx - r, by, 1.3, 0.94, 0.5, regionId);
            emitParticleLine(textAndControlPoints, bx - r, by, bx, by - r, 1.3, 0.94, 0.5, regionId);
          } else {
            for (let d = 0; d < bulletDots; d++) {
              const ang = (d / bulletDots) * Math.PI * 2;
              const rad = d === 0 ? 0 : 1.1 + Math.random() * 1.4;
              textAndControlPoints.push({
                x: bx + Math.cos(ang) * rad,
                y: by + Math.sin(ang) * rad,
                weight: 0.94,
                regionId,
              });
            }
          }
          curY += item.lines.length * lineHeight + itemGap;
        });
      }

      const opacityScale = parseNum(node.attrs.opacity, 0.84);
      for (const pt of listPts) {
        pt.weight = clamp((pt.weight ?? 0.8) * opacityScale, 0.34, 1);
        textAndControlPoints.push(pt);
      }
      continue;
    }

    if (node.tag === 'Table' && leaf.measured.tableData) {
      const { colWidths, rows, cellPadX, cellPadY, bordered } = leaf.measured.tableData;
      const fontSize = leaf.measured.fontSize || 16;
      const lineHeight = leaf.measured.lineHeight || fontSize * 1.35;
      const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP.sans;

      const tablePts = sampleCanvasRegion(
        (ctx) => {
          ctx.textBaseline = 'middle';
          let rowY = 0;
          for (const row of rows) {
            ctx.fillStyle = row.isHeader ? '#ffffff' : 'rgba(255, 255, 255, 0.82)';
            ctx.font = `${row.isHeader ? 600 : 500} ${fontSize}px ${fontFamily}`;
            let colX = 0;
            row.cells.forEach((cell, cIdx) => {
              const cw = colWidths[cIdx] || 80;
              ctx.textAlign = cell.align;
              const anchorX =
                cell.align === 'center'
                  ? colX + cw * 0.5
                  : cell.align === 'right'
                  ? colX + cw - cellPadX
                  : colX + cellPadX;

              cell.lines.forEach((line, lIdx) => {
                if (line) {
                  ctx.fillText(line, anchorX, rowY + cellPadY + lIdx * lineHeight + lineHeight * 0.5);
                }
              });
              colX += cw;
            });
            rowY += row.height;
          }
        },
        rect,
        density,
        fontSize,
        regionId
      );

      for (const pt of tablePts) {
        pt.weight = clamp((pt.weight ?? 0.82) * 0.9, 0.35, 1);
        textAndControlPoints.push(pt);
      }

      // Emit crisp horizontal rules (stronger under header, lighter between body rows)
      const headerStep = density === 'dense' ? 1.5 : density === 'balanced' ? 2.0 : 2.7;
      const rowStep = density === 'dense' ? 2.4 : density === 'balanced' ? 3.2 : 4.2;
      let ruleY = rect.y;
      rows.forEach((row, rIdx) => {
        ruleY += row.height;
        if (rIdx < rows.length - 1) {
          emitParticleLine(
            textAndControlPoints,
            rect.x + 2,
            ruleY,
            rect.x + rect.width - 2,
            ruleY,
            row.isHeader ? headerStep : rowStep,
            row.isHeader ? 0.84 : 0.46,
            row.isHeader ? 1.1 : 0.8,
            regionId
          );
        }
      });

      if (bordered) {
        const gridStep = density === 'dense' ? 2.2 : 3.0;
        let colX = rect.x;
        for (let c = 0; c < colWidths.length - 1; c++) {
          colX += colWidths[c];
          emitParticleLine(
            textAndControlPoints,
            colX,
            rect.y + 2,
            colX,
            rect.y + rect.height - 2,
            gridStep,
            0.44,
            0.8,
            regionId
          );
        }
        emitParticleLine(textAndControlPoints, rect.x, rect.y, rect.x + rect.width, rect.y, gridStep, 0.62, 0.8, regionId);
        emitParticleLine(textAndControlPoints, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, gridStep, 0.62, 0.8, regionId);
        emitParticleLine(textAndControlPoints, rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height, gridStep, 0.62, 0.8, regionId);
        emitParticleLine(textAndControlPoints, rect.x, rect.y + rect.height, rect.x, rect.y, gridStep, 0.62, 0.8, regionId);
      }

      continue;
    }

    // Heading or Text
    const lines = leaf.measured.lines || [];
    const fontSize = leaf.measured.fontSize || 24;
    const lineHeight = leaf.measured.lineHeight || fontSize * 1.25;
    const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP.sans;
    const fontWeight = leaf.measured.fontWeight || 500;
    const align = leaf.measured.textAlign || 'center';
    const isHeading = node.tag === 'Heading';

    const txtPts = sampleCanvasRegion(
      (ctx, w, h) => {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        const anchorX = align === 'left' ? 2 : align === 'right' ? w - 2 : w * 0.5;
        const totalBlock = lines.length * lineHeight;
        const startY = (h - totalBlock) * 0.5 + lineHeight * 0.5;

        lines.forEach((line, idx) => {
          ctx.fillText(line, anchorX, startY + idx * lineHeight);
        });
      },
      rect,
      density,
      fontSize,
      regionId
    );

    const alphaBoost = isHeading ? 0.92 : parseNum(node.attrs.opacity, 0.78);
    for (const pt of txtPts) {
      pt.weight = clamp((pt.weight ?? 0.8) * alphaBoost, 0.3, 1);
      textAndControlPoints.push(pt);
    }
  }

  // Allocate remaining particle budget evenly across any <Image> components
  const remainingForImages = Math.max(
    4500,
    totalBudget - Math.min(textAndControlPoints.length, Math.round(totalBudget * 0.65))
  );
  const perImageBudget =
    imageLeaves.length > 0 ? Math.max(3800, Math.round(remainingForImages / imageLeaves.length)) : 0;

  let imageCellSize = 2;
  const imagePoints: SampledPoint[] = [];

  for (const { leaf, regionId } of imageLeaves) {
    const img = leaf.measured.resolvedImg;
    if (!img) continue;

    const { attrs } = leaf.measured.node;
    const density = nodeDensity.get(leaf.measured.node) ?? sceneDensity;
    const localInvert =
      attrs.invert === 'true' ? !invertContrast : attrs.invert === 'false' ? false : invertContrast;

    const blurDisabled = attrs.blurStyle === 'none' || attrs.blurStyle === 'off';
    const localBlurStyle: ImageBlurStyle =
      attrs.blurStyle === 'edge' ? 'edge' : attrs.blurStyle === 'radial' ? 'radial' : imageTuning.blurStyle;

    // Icons and other small images: no edge fade by default (it turns a small square into a blob),
    // and a particle count proportional to their area instead of the per-image minimum.
    const isSmall = Math.min(leaf.rect.width, leaf.rect.height) <= 96;
    const spacing = density === 'dense' ? 0.8 : density === 'balanced' ? 1.1 : 1.5;
    const imageTarget = Math.min(
      perImageBudget,
      Math.max(150, Math.round((leaf.rect.width * leaf.rect.height) / (spacing * spacing)))
    );

    const localTuning: ImageTuningConfig = {
      blurStyle: localBlurStyle,
      edgeBlur: blurDisabled
        ? 0
        : attrs.blur !== undefined
        ? parseNum(attrs.blur, imageTuning.edgeBlur)
        : isSmall
        ? 0
        : imageTuning.edgeBlur,
      contrast:
        attrs.contrast !== undefined ? parseNum(attrs.contrast, imageTuning.contrast) : imageTuning.contrast,
      detail: attrs.detail !== undefined ? parseNum(attrs.detail, imageTuning.detail) : imageTuning.detail,
    };

    const res = sampleImageIntoBox(
      img,
      leaf.rect.x,
      leaf.rect.y,
      leaf.rect.width,
      leaf.rect.height,
      density,
      localInvert,
      isDarkTheme,
      localTuning,
      imageTarget
    );

    // Refine ripple center to exact sampled subject silhouette bounds
    const rr = rippleRegions[regionId];
    if (rr && res.bounds.width > 12 && res.bounds.height > 12) {
      rr.x = res.bounds.x;
      rr.y = res.bounds.y;
      rr.width = res.bounds.width;
      rr.height = res.bounds.height;
      rr.cx = res.bounds.x + res.bounds.width * 0.5;
      rr.cy = res.bounds.y + res.bounds.height * 0.5;
    }

    imageCellSize = Math.max(imageCellSize, res.cellSize);
    for (const pt of res.points) {
      pt.regionId = regionId;
      imagePoints.push(pt);
    }
  }

  // If total text points exceed totalBudget cleanly trim text-only (keep buttons intact)
  let finalPoints: SampledPoint[];
  if (scrollMax > 0 || !trim) {
    // Return everything; the caller budgets by what is visible (see LayoutWindow).
    finalPoints = [...textAndControlPoints, ...imagePoints];
  } else if (textAndControlPoints.length + imagePoints.length > totalBudget) {
    const buttonPts = textAndControlPoints.filter(
      (p) => p.regionId !== undefined && buttonRegionIds.has(p.regionId)
    );
    const nonButtonPts = textAndControlPoints.filter(
      (p) => p.regionId === undefined || !buttonRegionIds.has(p.regionId)
    );

    for (let i = nonButtonPts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = nonButtonPts[i];
      nonButtonPts[i] = nonButtonPts[j];
      nonButtonPts[j] = tmp;
    }
    const maxNonBtn = Math.max(1000, totalBudget - buttonPts.length - imagePoints.length);
    finalPoints = [
      ...buttonPts,
      ...nonButtonPts.slice(0, maxNonBtn),
      ...imagePoints,
    ];
  } else {
    finalPoints = [...textAndControlPoints, ...imagePoints];
  }

  return {
    points: finalPoints,
    hitRegions,
    rippleRegions,
    cellSize: imageLeaves.length > 0 ? imageCellSize : 2,
    scrollMax,
    screenBudget: totalBudget,
    priorityRegionIds: Array.from(buttonRegionIds),
    mindMapCollapsedIds: Array.from(mindMap.collapsedOut),
    mindMapDroppedExpansions: Array.from(mindMap.droppedOut),
  };
}
