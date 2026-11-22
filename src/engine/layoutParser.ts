import type {
  LayoutDiagnostic,
  LayoutNode,
  LayoutTagName,
} from '../types/mote';

const TAG_ALIAS_MAP: Record<string, LayoutTagName> = {
  col: 'Col',
  column: 'Col',
  vstack: 'Col',
  div: 'Col',
  row: 'Row',
  hstack: 'Row',
  heading: 'Heading',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  title: 'Heading',
  text: 'Text',
  p: 'Text',
  span: 'Text',
  image: 'Image',
  img: 'Image',
  button: 'Button',
  btn: 'Button',
  divider: 'Divider',
  hr: 'Divider',
  spacer: 'Spacer',
  list: 'List',
  ul: 'List',
  ol: 'List',
  item: 'Item',
  li: 'Item',
  table: 'Table',
  tr: 'Tr',
  th: 'Th',
  td: 'Td',
  quote: 'Quote',
  blockquote: 'Quote',
  callout: 'Quote',
  code: 'Code',
  pre: 'Code',
  mindmap: 'MindMap',
  'mind-map': 'MindMap',
  mind: 'MindMap',
  branch: 'Branch',
  node: 'Branch',
  topic: 'Branch',
};

const VOID_TAGS = new Set<LayoutTagName>(['Image', 'Divider', 'Spacer']);
const INLINE_TEXT_TAGS = new Set<LayoutTagName>([
  'Heading',
  'Text',
  'Button',
  'Item',
  'Th',
  'Td',
  'Branch',
]);
const MULTILINE_RAW_TAGS = new Set<LayoutTagName>([
  'List',
  'Table',
  'Quote',
  'Code',
  'MindMap',
]);

type StackEntry =
  | { kind: 'node'; node: LayoutNode; rawChunks: string[] }
  | { kind: 'table-section'; tagName: 'thead' | 'tbody'; parentTable: LayoutNode; line: number };

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function dedentMultiline(raw: string): string {
  const normalized = raw.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length === 0) return '';

  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const match = line.match(/^(\s*)/);
    if (match) minIndent = Math.min(minIndent, match[1].length);
  }
  if (!Number.isFinite(minIndent) || minIndent <= 0) {
    return lines.join('\n');
  }
  return lines.map((line) => (line.trim() === '' ? '' : line.slice(minIndent))).join('\n');
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1');
}

function isBulletLine(line: string): boolean {
  return /^\s*[-*•+]\s+/.test(line);
}

function isOrderedListLine(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

function isTablePipeLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.indexOf('|', 1) !== -1;
}

function parseMarkdownBlocks(source: string, baseLine = 1): LayoutNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const nodes: LayoutNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNo = baseLine + i;

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }
      nodes.push({
        tag: 'Code',
        attrs: lang ? { lang } : {},
        children: [],
        text: dedentMultiline(codeLines.join('\n')),
        line: lineNo,
      });
      continue;
    }

    // Horizontal rule --- / *** / ___
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      nodes.push({
        tag: 'Divider',
        attrs: { length: '320' },
        children: [],
        line: lineNo,
      });
      i++;
      continue;
    }

    // ATX Heading # .. ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const size = level === 1 ? 'xl' : level === 2 ? 'lg' : level === 3 ? 'md' : 'sm';
      nodes.push({
        tag: 'Heading',
        attrs: { size, align: 'left' },
        children: [],
        text: cleanInlineMarkdown(headingMatch[2].trim()),
        line: lineNo,
      });
      i++;
      continue;
    }

    // Blockquote > ...
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      nodes.push({
        tag: 'Quote',
        attrs: {},
        children: [],
        text: cleanInlineMarkdown(quoteLines.join(' ').replace(/\s+/g, ' ').trim()),
        line: lineNo,
      });
      continue;
    }

    // Markdown pipe table | A | B |
    if (isTablePipeLine(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTablePipeLine(lines[i])) {
        tableLines.push(lines[i].trim());
        i++;
      }
      nodes.push({
        tag: 'Table',
        attrs: {},
        children: [],
        text: tableLines.join('\n'),
        line: lineNo,
      });
      continue;
    }

    // Bullet or ordered list
    if (isBulletLine(rawLine) || isOrderedListLine(rawLine)) {
      const ordered = isOrderedListLine(rawLine);
      const itemNodes: LayoutNode[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) break;
        if (ordered && isOrderedListLine(cur)) {
          itemNodes.push({
            tag: 'Item',
            attrs: {},
            children: [],
            text: cleanInlineMarkdown(cur.replace(/^\s*\d+[.)]\s+/, '').trim()),
            line: baseLine + i,
          });
          i++;
        } else if (!ordered && isBulletLine(cur)) {
          itemNodes.push({
            tag: 'Item',
            attrs: {},
            children: [],
            text: cleanInlineMarkdown(cur.replace(/^\s*[-*•+]\s+/, '').trim()),
            line: baseLine + i,
          });
          i++;
        } else {
          break;
        }
      }
      nodes.push({
        tag: 'List',
        attrs: { ordered: ordered ? 'true' : 'false' },
        children: itemNodes,
        line: lineNo,
      });
      continue;
    }

    // Paragraph text until blank line or next block syntax
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrim = cur.trim();
      if (
        !curTrim ||
        curTrim.startsWith('```') ||
        /^([-*_])\1{2,}$/.test(curTrim) ||
        /^(#{1,4})\s+/.test(curTrim) ||
        curTrim.startsWith('>') ||
        isTablePipeLine(curTrim) ||
        isBulletLine(cur) ||
        isOrderedListLine(cur)
      ) {
        break;
      }
      paraLines.push(curTrim);
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push({
        tag: 'Text',
        attrs: {},
        children: [],
        text: cleanInlineMarkdown(paraLines.join(' ')),
        line: lineNo,
      });
    }
  }

  return nodes;
}

function parseAttributes(
  attrText: string,
  tagLine: number
): { attrs: Record<string, string>; error: LayoutDiagnostic | null } {
  const attrs: Record<string, string> = {};
  let i = 0;
  const len = attrText.length;

  while (i < len) {
    while (i < len && /\s/.test(attrText[i])) i++;
    if (i >= len) break;

    const keyStart = i;
    while (i < len && /[A-Za-z0-9_-]/.test(attrText[i])) i++;
    const rawKey = attrText.slice(keyStart, i);

    if (!rawKey) {
      return {
        attrs,
        error: {
          message: `Unexpected character "${attrText[i]}" inside tag attributes`,
          line: tagLine,
        },
      };
    }

    const key = rawKey;
    while (i < len && /\s/.test(attrText[i])) i++;

    if (attrText[i] !== '=') {
      attrs[key] = 'true';
      continue;
    }

    i++; // skip '='
    while (i < len && /\s/.test(attrText[i])) i++;

    if (i >= len) {
      return {
        attrs,
        error: { message: `Missing value for attribute "${key}"`, line: tagLine },
      };
    }

    const quote = attrText[i];
    if (quote === '"' || quote === "'") {
      i++;
      const valStart = i;
      while (i < len && attrText[i] !== quote) i++;
      if (i >= len) {
        return {
          attrs,
          error: { message: `Unclosed string for attribute "${key}"`, line: tagLine },
        };
      }
      attrs[key] = decodeBasicEntities(attrText.slice(valStart, i));
      i++; // skip closing quote
    } else {
      const valStart = i;
      while (i < len && !/\s/.test(attrText[i])) i++;
      attrs[key] = decodeBasicEntities(attrText.slice(valStart, i));
    }
  }

  return { attrs, error: null };
}

export interface ParseLayoutResult {
  root: LayoutNode | null;
  error: LayoutDiagnostic | null;
}

const KNOWN_MARKUP_TAG_RE =
  /<\/?(Col|Column|VStack|Div|Row|HStack|Heading|H1|H2|H3|Title|Text|P|Span|Image|Img|Button|Btn|Divider|Hr|Spacer|List|Ul|Ol|Item|Li|Table|Tr|Th|Td|Thead|Tbody|Quote|Blockquote|Callout|Code|Pre|Markdown|Md|MindMap|Mind-Map|Mind|Branch|Node|Topic)\b/i;

/**
 * Lightweight, zero-eval recursive markup & Markdown parser for declarative particle layouts.
 */
export function parseLayoutMarkup(markup: string): ParseLayoutResult {
  const trimmed = markup.trim();
  if (!trimmed) {
    return {
      root: null,
      error: {
        message: 'Add components like <Heading>, <List>, <Table>, or Markdown text to compose a scene',
        line: 1,
      },
    };
  }

  // Strip XML/HTML comments while keeping line count aligned
  const cleanSource = markup.replace(/<!--[\s\S]*?-->/g, (comment) =>
    comment.replace(/[^\n]/g, ' ')
  );

  // Pure Markdown mode when no declarative layout tags are present
  if (!KNOWN_MARKUP_TAG_RE.test(cleanSource)) {
    const mdChildren = parseMarkdownBlocks(cleanSource, 1);
    if (mdChildren.length === 0) {
      return {
        root: null,
        error: { message: 'Layout contains no visible components', line: 1 },
      };
    }
    if (mdChildren.length === 1) {
      return { root: mdChildren[0], error: null };
    }
    return {
      root: {
        tag: 'Col',
        attrs: { gap: '16', align: 'start' },
        children: mdChildren,
        line: 1,
      },
      error: null,
    };
  }

  const syntheticRoot: LayoutNode = {
    tag: 'Col',
    attrs: { gap: '20', align: 'center' },
    children: [],
    line: 1,
  };
  const stack: StackEntry[] = [{ kind: 'node', node: syntheticRoot, rawChunks: [] }];

  let pos = 0;
  const len = cleanSource.length;

  while (pos < len) {
    const ltIdx = cleanSource.indexOf('<', pos);
    const textEnd = ltIdx === -1 ? len : ltIdx;

    if (textEnd > pos) {
      const rawText = cleanSource.slice(pos, textEnd);
      const top = stack[stack.length - 1];
      if (top.kind === 'node') {
        const parent = top.node;
        if (MULTILINE_RAW_TAGS.has(parent.tag)) {
          top.rawChunks.push(decodeBasicEntities(rawText));
        } else {
          const normalized = rawText.replace(/\s+/g, ' ').trim();
          if (normalized) {
            if (parent === syntheticRoot) {
              syntheticRoot.children.push({
                tag: 'Text',
                attrs: {},
                children: [],
                text: decodeBasicEntities(normalized),
                line: lineNumberAt(cleanSource, pos),
              });
            } else if (INLINE_TEXT_TAGS.has(parent.tag)) {
              parent.text = parent.text
                ? `${parent.text} ${decodeBasicEntities(normalized)}`
                : decodeBasicEntities(normalized);
            } else {
              parent.children.push({
                tag: 'Text',
                attrs: {},
                children: [],
                text: decodeBasicEntities(normalized),
                line: lineNumberAt(cleanSource, pos),
              });
            }
          }
        }
      }
    }

    if (ltIdx === -1) break;

    const tagLine = lineNumberAt(cleanSource, ltIdx);

    // Find matching '>' outside quotes
    let gtIdx = -1;
    let activeQuote: string | null = null;
    for (let k = ltIdx + 1; k < len; k++) {
      const ch = cleanSource[k];
      if (activeQuote) {
        if (ch === activeQuote) activeQuote = null;
      } else if (ch === '"' || ch === "'") {
        activeQuote = ch;
      } else if (ch === '>') {
        gtIdx = k;
        break;
      }
    }

    if (gtIdx === -1) {
      return {
        root: null,
        error: { message: 'Unclosed "<" tag missing closing ">"', line: tagLine },
      };
    }

    const inside = cleanSource.slice(ltIdx + 1, gtIdx).trim();
    pos = gtIdx + 1;

    if (!inside) {
      return {
        root: null,
        error: { message: 'Empty "<>" tag', line: tagLine },
      };
    }

    // Closing tag </Tag>
    if (inside.startsWith('/')) {
      const closeName = inside.slice(1).trim();
      const closeLower = closeName.toLowerCase();

      if (closeLower === 'thead' || closeLower === 'tbody') {
        const top = stack[stack.length - 1];
        if (top.kind !== 'table-section' || top.tagName !== closeLower) {
          return {
            root: null,
            error: { message: `Unexpected closing tag "</${closeName}>"`, line: tagLine },
          };
        }
        stack.pop();
        continue;
      }

      const canonical = TAG_ALIAS_MAP[closeLower];
      if (!canonical) {
        return {
          root: null,
          error: { message: `Unknown closing tag "</${closeName}>"`, line: tagLine },
        };
      }
      if (stack.length <= 1) {
        return {
          root: null,
          error: { message: `Unexpected closing tag "</${closeName}>"`, line: tagLine },
        };
      }
      const openEntry = stack[stack.length - 1];
      if (openEntry.kind !== 'node' || openEntry.node.tag !== canonical) {
        const expected =
          openEntry.kind === 'node' ? openEntry.node.tag : openEntry.tagName;
        return {
          root: null,
          error: {
            message: `Expected "</${expected}>" before "</${closeName}>"`,
            line: tagLine,
          },
        };
      }

      if (MULTILINE_RAW_TAGS.has(openEntry.node.tag) && openEntry.rawChunks.length > 0) {
        const joined = dedentMultiline(openEntry.rawChunks.join(''));
        if (joined) {
          if (openEntry.node.tag === 'Quote') {
            openEntry.node.text = joined.replace(/\s+/g, ' ').trim();
          } else {
            openEntry.node.text = joined;
          }
        }
      }

      stack.pop();
      continue;
    }

    // Opening or self-closing tag
    const selfClosing = inside.endsWith('/');
    const tagBody = selfClosing ? inside.slice(0, -1).trim() : inside;

    const nameMatch = tagBody.match(/^([A-Za-z0-9_-]+)([\s\S]*)$/);
    if (!nameMatch) {
      return {
        root: null,
        error: { message: 'Invalid tag syntax', line: tagLine },
      };
    }

    const rawTagName = nameMatch[1];
    const lowerTag = rawTagName.toLowerCase();
    const attrPart = nameMatch[2] || '';

    // Transparent HTML table section wrappers <thead> / <tbody>
    if (lowerTag === 'thead' || lowerTag === 'tbody') {
      const top = stack[stack.length - 1];
      if (top.kind !== 'node' || top.node.tag !== 'Table') {
        return {
          root: null,
          error: { message: `<${rawTagName}> must be placed inside <Table>`, line: tagLine },
        };
      }
      if (!selfClosing) {
        stack.push({
          kind: 'table-section',
          tagName: lowerTag,
          parentTable: top.node,
          line: tagLine,
        });
      }
      continue;
    }

    // Embedded <Markdown> / <Md> block scanned verbatim to </Markdown> or </Md>
    if (lowerTag === 'markdown' || lowerTag === 'md') {
      const { attrs, error: attrErr } = parseAttributes(attrPart, tagLine);
      if (attrErr) return { root: null, error: attrErr };
      if (selfClosing) continue;

      const closePattern = new RegExp(`<\\/${rawTagName}\\s*>`, 'i');
      const rest = cleanSource.slice(pos);
      const closeMatch = closePattern.exec(rest);
      if (!closeMatch) {
        return {
          root: null,
          error: {
            message: `Unclosed <${rawTagName}> opened on line ${tagLine}`,
            line: tagLine,
          },
        };
      }
      const rawMd = dedentMultiline(decodeBasicEntities(rest.slice(0, closeMatch.index)));
      pos += closeMatch.index + closeMatch[0].length;
      const mdChildren = parseMarkdownBlocks(rawMd, tagLine);
      const mdWrapper: LayoutNode = {
        tag: 'Col',
        attrs: { gap: '14', align: 'start', ...attrs },
        children: mdChildren,
        line: tagLine,
      };
      const top = stack[stack.length - 1];
      const hostNode = top.kind === 'node' ? top.node : top.parentTable;
      hostNode.children.push(mdWrapper);
      continue;
    }

    const canonicalTag = TAG_ALIAS_MAP[lowerTag];

    if (!canonicalTag) {
      return {
        root: null,
        error: {
          message: `Unknown tag "<${rawTagName}>". Try Col, Row, Heading, Text, List, Table, Quote, Code, MindMap, Branch, Image, or Button`,
          line: tagLine,
        },
      };
    }

    const { attrs, error: attrErr } = parseAttributes(attrPart, tagLine);
    if (attrErr) {
      return { root: null, error: attrErr };
    }

    // Normalize default Heading size from HTML tag alias (h1/h2/h3) if size not explicitly given
    if (lowerTag === 'h1' && !attrs.size) attrs.size = 'xl';
    if (lowerTag === 'h2' && !attrs.size) attrs.size = 'lg';
    if (lowerTag === 'h3' && !attrs.size) attrs.size = 'md';
    if (lowerTag === 'ol' && !attrs.ordered) attrs.ordered = 'true';

    // Raw literal scan inside <Code> / <Pre> so inline angle brackets like <Button> never trigger XML errors
    if (canonicalTag === 'Code' && !selfClosing) {
      const closePattern = new RegExp(`<\\/${rawTagName}\\s*>`, 'i');
      const rest = cleanSource.slice(pos);
      const closeMatch = closePattern.exec(rest);
      if (!closeMatch) {
        return {
          root: null,
          error: {
            message: `Unclosed <${rawTagName}> opened on line ${tagLine}`,
            line: tagLine,
          },
        };
      }
      const rawCode = dedentMultiline(decodeBasicEntities(rest.slice(0, closeMatch.index)));
      pos += closeMatch.index + closeMatch[0].length;
      const top = stack[stack.length - 1];
      const hostNode = top.kind === 'node' ? top.node : top.parentTable;
      hostNode.children.push({
        tag: 'Code',
        attrs,
        children: [],
        text: rawCode,
        line: tagLine,
      });
      continue;
    }

    const node: LayoutNode = {
      tag: canonicalTag,
      attrs,
      children: [],
      line: tagLine,
    };

    const top = stack[stack.length - 1];
    const hostNode = top.kind === 'node' ? top.node : top.parentTable;
    hostNode.children.push(node);

    const isVoid = selfClosing || VOID_TAGS.has(canonicalTag);
    if (!isVoid) {
      stack.push({ kind: 'node', node, rawChunks: [] });
    }
  }

  if (stack.length > 1) {
    const unclosed = stack[stack.length - 1];
    const label = unclosed.kind === 'node' ? unclosed.node.tag : unclosed.tagName;
    const line = unclosed.kind === 'node' ? unclosed.node.line : unclosed.line;
    return {
      root: null,
      error: {
        message: `Unclosed <${label}> opened on line ${line}`,
        line,
      },
    };
  }

  if (syntheticRoot.children.length === 0) {
    return {
      root: null,
      error: { message: 'Layout contains no visible components', line: 1 },
    };
  }

  const root =
    syntheticRoot.children.length === 1 ? syntheticRoot.children[0] : syntheticRoot;

  return { root, error: null };
}

export function collectLayoutImageRefs(root: LayoutNode | null): string[] {
  if (!root) return [];
  const refs = new Set<string>();
  const walk = (node: LayoutNode) => {
    if (node.tag === 'Image') {
      refs.add(node.attrs.src ?? '');
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(root);
  return Array.from(refs);
}
