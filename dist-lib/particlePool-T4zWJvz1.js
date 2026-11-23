// src/engine/layoutParser.ts
var TAG_ALIAS_MAP = {
	col: "Col",
	column: "Col",
	vstack: "Col",
	div: "Col",
	row: "Row",
	hstack: "Row",
	heading: "Heading",
	h1: "Heading",
	h2: "Heading",
	h3: "Heading",
	title: "Heading",
	text: "Text",
	p: "Text",
	span: "Text",
	image: "Image",
	img: "Image",
	button: "Button",
	btn: "Button",
	divider: "Divider",
	hr: "Divider",
	spacer: "Spacer",
	list: "List",
	ul: "List",
	ol: "List",
	item: "Item",
	li: "Item",
	table: "Table",
	tr: "Tr",
	th: "Th",
	td: "Td",
	quote: "Quote",
	blockquote: "Quote",
	callout: "Quote",
	code: "Code",
	pre: "Code",
	mindmap: "MindMap",
	"mind-map": "MindMap",
	mind: "MindMap",
	branch: "Branch",
	node: "Branch",
	topic: "Branch"
};
var VOID_TAGS = /* @__PURE__ */ new Set([
	"Image",
	"Divider",
	"Spacer"
]);
var INLINE_TEXT_TAGS = /* @__PURE__ */ new Set([
	"Heading",
	"Text",
	"Button",
	"Item",
	"Th",
	"Td",
	"Branch"
]);
var MULTILINE_RAW_TAGS = /* @__PURE__ */ new Set([
	"List",
	"Table",
	"Quote",
	"Code",
	"MindMap"
]);
function lineNumberAt(source, index) {
	let line = 1;
	for (let i = 0; i < index && i < source.length; i++) if (source.charCodeAt(i) === 10) line++;
	return line;
}
function decodeBasicEntities(text) {
	return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}
function dedentMultiline(raw) {
	const lines = raw.replace(/\r\n?/g, "\n").split("\n");
	while (lines.length > 0 && lines[0].trim() === "") lines.shift();
	while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
	if (lines.length === 0) return "";
	let minIndent = Infinity;
	for (const line of lines) {
		if (line.trim() === "") continue;
		const match = line.match(/^(\s*)/);
		if (match) minIndent = Math.min(minIndent, match[1].length);
	}
	if (!Number.isFinite(minIndent) || minIndent <= 0) return lines.join("\n");
	return lines.map((line) => line.trim() === "" ? "" : line.slice(minIndent)).join("\n");
}
function cleanInlineMarkdown(text) {
	return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
}
function isBulletLine(line) {
	return /^\s*[-*•+]\s+/.test(line);
}
function isOrderedListLine(line) {
	return /^\s*\d+[.)]\s+/.test(line);
}
function isTablePipeLine(line) {
	const t = line.trim();
	return t.startsWith("|") && t.indexOf("|", 1) !== -1;
}
function parseMarkdownBlocks(source, baseLine = 1) {
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	const nodes = [];
	let i = 0;
	while (i < lines.length) {
		const rawLine = lines[i];
		const trimmed = rawLine.trim();
		const lineNo = baseLine + i;
		if (!trimmed) {
			i++;
			continue;
		}
		if (trimmed.startsWith("```")) {
			const lang = trimmed.slice(3).trim();
			i++;
			const codeLines = [];
			while (i < lines.length && !lines[i].trim().startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			if (i < lines.length && lines[i].trim().startsWith("```")) i++;
			nodes.push({
				tag: "Code",
				attrs: lang ? { lang } : {},
				children: [],
				text: dedentMultiline(codeLines.join("\n")),
				line: lineNo
			});
			continue;
		}
		if (/^([-*_])\1{2,}$/.test(trimmed)) {
			nodes.push({
				tag: "Divider",
				attrs: { length: "320" },
				children: [],
				line: lineNo
			});
			i++;
			continue;
		}
		const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			const size = level === 1 ? "xl" : level === 2 ? "lg" : level === 3 ? "md" : "sm";
			nodes.push({
				tag: "Heading",
				attrs: {
					size,
					align: "left"
				},
				children: [],
				text: cleanInlineMarkdown(headingMatch[2].trim()),
				line: lineNo
			});
			i++;
			continue;
		}
		if (trimmed.startsWith(">")) {
			const quoteLines = [];
			while (i < lines.length && lines[i].trim().startsWith(">")) {
				quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
				i++;
			}
			nodes.push({
				tag: "Quote",
				attrs: {},
				children: [],
				text: cleanInlineMarkdown(quoteLines.join(" ").replace(/\s+/g, " ").trim()),
				line: lineNo
			});
			continue;
		}
		if (isTablePipeLine(trimmed)) {
			const tableLines = [];
			while (i < lines.length && isTablePipeLine(lines[i])) {
				tableLines.push(lines[i].trim());
				i++;
			}
			nodes.push({
				tag: "Table",
				attrs: {},
				children: [],
				text: tableLines.join("\n"),
				line: lineNo
			});
			continue;
		}
		if (isBulletLine(rawLine) || isOrderedListLine(rawLine)) {
			const ordered = isOrderedListLine(rawLine);
			const itemNodes = [];
			while (i < lines.length) {
				const cur = lines[i];
				if (!cur.trim()) break;
				if (ordered && isOrderedListLine(cur)) {
					itemNodes.push({
						tag: "Item",
						attrs: {},
						children: [],
						text: cleanInlineMarkdown(cur.replace(/^\s*\d+[.)]\s+/, "").trim()),
						line: baseLine + i
					});
					i++;
				} else if (!ordered && isBulletLine(cur)) {
					itemNodes.push({
						tag: "Item",
						attrs: {},
						children: [],
						text: cleanInlineMarkdown(cur.replace(/^\s*[-*•+]\s+/, "").trim()),
						line: baseLine + i
					});
					i++;
				} else break;
			}
			nodes.push({
				tag: "List",
				attrs: { ordered: ordered ? "true" : "false" },
				children: itemNodes,
				line: lineNo
			});
			continue;
		}
		const paraLines = [];
		while (i < lines.length) {
			const cur = lines[i];
			const curTrim = cur.trim();
			if (!curTrim || curTrim.startsWith("```") || /^([-*_])\1{2,}$/.test(curTrim) || /^(#{1,4})\s+/.test(curTrim) || curTrim.startsWith(">") || isTablePipeLine(curTrim) || isBulletLine(cur) || isOrderedListLine(cur)) break;
			paraLines.push(curTrim);
			i++;
		}
		if (paraLines.length > 0) nodes.push({
			tag: "Text",
			attrs: {},
			children: [],
			text: cleanInlineMarkdown(paraLines.join(" ")),
			line: lineNo
		});
	}
	return nodes;
}
function parseAttributes(attrText, tagLine) {
	const attrs = {};
	let i = 0;
	const len = attrText.length;
	while (i < len) {
		while (i < len && /\s/.test(attrText[i])) i++;
		if (i >= len) break;
		const keyStart = i;
		while (i < len && /[A-Za-z0-9_-]/.test(attrText[i])) i++;
		const rawKey = attrText.slice(keyStart, i);
		if (!rawKey) return {
			attrs,
			error: {
				message: `Unexpected character "${attrText[i]}" inside tag attributes`,
				line: tagLine
			}
		};
		const key = rawKey;
		while (i < len && /\s/.test(attrText[i])) i++;
		if (attrText[i] !== "=") {
			attrs[key] = "true";
			continue;
		}
		i++;
		while (i < len && /\s/.test(attrText[i])) i++;
		if (i >= len) return {
			attrs,
			error: {
				message: `Missing value for attribute "${key}"`,
				line: tagLine
			}
		};
		const quote = attrText[i];
		if (quote === "\"" || quote === "'") {
			i++;
			const valStart = i;
			while (i < len && attrText[i] !== quote) i++;
			if (i >= len) return {
				attrs,
				error: {
					message: `Unclosed string for attribute "${key}"`,
					line: tagLine
				}
			};
			attrs[key] = decodeBasicEntities(attrText.slice(valStart, i));
			i++;
		} else {
			const valStart = i;
			while (i < len && !/\s/.test(attrText[i])) i++;
			attrs[key] = decodeBasicEntities(attrText.slice(valStart, i));
		}
	}
	return {
		attrs,
		error: null
	};
}
var KNOWN_MARKUP_TAG_RE = /<\/?(Col|Column|VStack|Div|Row|HStack|Heading|H1|H2|H3|Title|Text|P|Span|Image|Img|Button|Btn|Divider|Hr|Spacer|List|Ul|Ol|Item|Li|Table|Tr|Th|Td|Thead|Tbody|Quote|Blockquote|Callout|Code|Pre|Markdown|Md|MindMap|Mind-Map|Mind|Branch|Node|Topic)\b/i;
/**
* Lightweight, zero-eval recursive markup & Markdown parser for declarative particle layouts.
*/
function parseLayoutMarkup(markup) {
	if (!markup.trim()) return {
		root: null,
		error: {
			message: "Add components like <Heading>, <List>, <Table>, or Markdown text to compose a scene",
			line: 1
		}
	};
	const cleanSource = markup.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, " "));
	if (!KNOWN_MARKUP_TAG_RE.test(cleanSource)) {
		const mdChildren = parseMarkdownBlocks(cleanSource, 1);
		if (mdChildren.length === 0) return {
			root: null,
			error: {
				message: "Layout contains no visible components",
				line: 1
			}
		};
		if (mdChildren.length === 1) return {
			root: mdChildren[0],
			error: null
		};
		return {
			root: {
				tag: "Col",
				attrs: {
					gap: "16",
					align: "start"
				},
				children: mdChildren,
				line: 1
			},
			error: null
		};
	}
	const syntheticRoot = {
		tag: "Col",
		attrs: {
			gap: "20",
			align: "center"
		},
		children: [],
		line: 1
	};
	const stack = [{
		kind: "node",
		node: syntheticRoot,
		rawChunks: []
	}];
	let pos = 0;
	const len = cleanSource.length;
	while (pos < len) {
		const ltIdx = cleanSource.indexOf("<", pos);
		const textEnd = ltIdx === -1 ? len : ltIdx;
		if (textEnd > pos) {
			const rawText = cleanSource.slice(pos, textEnd);
			const top = stack[stack.length - 1];
			if (top.kind === "node") {
				const parent = top.node;
				if (MULTILINE_RAW_TAGS.has(parent.tag)) top.rawChunks.push(decodeBasicEntities(rawText));
				else {
					const normalized = rawText.replace(/\s+/g, " ").trim();
					if (normalized) {
						if (parent === syntheticRoot) syntheticRoot.children.push({
							tag: "Text",
							attrs: {},
							children: [],
							text: decodeBasicEntities(normalized),
							line: lineNumberAt(cleanSource, pos)
						});
						else if (INLINE_TEXT_TAGS.has(parent.tag)) parent.text = parent.text ? `${parent.text} ${decodeBasicEntities(normalized)}` : decodeBasicEntities(normalized);
						else parent.children.push({
							tag: "Text",
							attrs: {},
							children: [],
							text: decodeBasicEntities(normalized),
							line: lineNumberAt(cleanSource, pos)
						});
					}
				}
			}
		}
		if (ltIdx === -1) break;
		const tagLine = lineNumberAt(cleanSource, ltIdx);
		let gtIdx = -1;
		let activeQuote = null;
		for (let k = ltIdx + 1; k < len; k++) {
			const ch = cleanSource[k];
			if (activeQuote) {
				if (ch === activeQuote) activeQuote = null;
			} else if (ch === "\"" || ch === "'") activeQuote = ch;
			else if (ch === ">") {
				gtIdx = k;
				break;
			}
		}
		if (gtIdx === -1) return {
			root: null,
			error: {
				message: "Unclosed \"<\" tag missing closing \">\"",
				line: tagLine
			}
		};
		const inside = cleanSource.slice(ltIdx + 1, gtIdx).trim();
		pos = gtIdx + 1;
		if (!inside) return {
			root: null,
			error: {
				message: "Empty \"<>\" tag",
				line: tagLine
			}
		};
		if (inside.startsWith("/")) {
			const closeName = inside.slice(1).trim();
			const closeLower = closeName.toLowerCase();
			if (closeLower === "thead" || closeLower === "tbody") {
				const top = stack[stack.length - 1];
				if (top.kind !== "table-section" || top.tagName !== closeLower) return {
					root: null,
					error: {
						message: `Unexpected closing tag "</${closeName}>"`,
						line: tagLine
					}
				};
				stack.pop();
				continue;
			}
			const canonical = TAG_ALIAS_MAP[closeLower];
			if (!canonical) return {
				root: null,
				error: {
					message: `Unknown closing tag "</${closeName}>"`,
					line: tagLine
				}
			};
			if (stack.length <= 1) return {
				root: null,
				error: {
					message: `Unexpected closing tag "</${closeName}>"`,
					line: tagLine
				}
			};
			const openEntry = stack[stack.length - 1];
			if (openEntry.kind !== "node" || openEntry.node.tag !== canonical) return {
				root: null,
				error: {
					message: `Expected "</${openEntry.kind === "node" ? openEntry.node.tag : openEntry.tagName}>" before "</${closeName}>"`,
					line: tagLine
				}
			};
			if (MULTILINE_RAW_TAGS.has(openEntry.node.tag) && openEntry.rawChunks.length > 0) {
				const joined = dedentMultiline(openEntry.rawChunks.join(""));
				if (joined) {
					if (openEntry.node.tag === "Quote") openEntry.node.text = joined.replace(/\s+/g, " ").trim();
					else openEntry.node.text = joined;
				}
			}
			stack.pop();
			continue;
		}
		const selfClosing = inside.endsWith("/");
		const nameMatch = (selfClosing ? inside.slice(0, -1).trim() : inside).match(/^([A-Za-z0-9_-]+)([\s\S]*)$/);
		if (!nameMatch) return {
			root: null,
			error: {
				message: "Invalid tag syntax",
				line: tagLine
			}
		};
		const rawTagName = nameMatch[1];
		const lowerTag = rawTagName.toLowerCase();
		const attrPart = nameMatch[2] || "";
		if (lowerTag === "thead" || lowerTag === "tbody") {
			const top = stack[stack.length - 1];
			if (top.kind !== "node" || top.node.tag !== "Table") return {
				root: null,
				error: {
					message: `<${rawTagName}> must be placed inside <Table>`,
					line: tagLine
				}
			};
			if (!selfClosing) stack.push({
				kind: "table-section",
				tagName: lowerTag,
				parentTable: top.node,
				line: tagLine
			});
			continue;
		}
		if (lowerTag === "markdown" || lowerTag === "md") {
			const { attrs, error: attrErr } = parseAttributes(attrPart, tagLine);
			if (attrErr) return {
				root: null,
				error: attrErr
			};
			if (selfClosing) continue;
			const closePattern = new RegExp(`<\\/${rawTagName}\\s*>`, "i");
			const rest = cleanSource.slice(pos);
			const closeMatch = closePattern.exec(rest);
			if (!closeMatch) return {
				root: null,
				error: {
					message: `Unclosed <${rawTagName}> opened on line ${tagLine}`,
					line: tagLine
				}
			};
			const rawMd = dedentMultiline(decodeBasicEntities(rest.slice(0, closeMatch.index)));
			pos += closeMatch.index + closeMatch[0].length;
			const mdChildren = parseMarkdownBlocks(rawMd, tagLine);
			const mdWrapper = {
				tag: "Col",
				attrs: {
					gap: "14",
					align: "start",
					...attrs
				},
				children: mdChildren,
				line: tagLine
			};
			const top = stack[stack.length - 1];
			(top.kind === "node" ? top.node : top.parentTable).children.push(mdWrapper);
			continue;
		}
		const canonicalTag = TAG_ALIAS_MAP[lowerTag];
		if (!canonicalTag) return {
			root: null,
			error: {
				message: `Unknown tag "<${rawTagName}>". Try Col, Row, Heading, Text, List, Table, Quote, Code, MindMap, Branch, Image, or Button`,
				line: tagLine
			}
		};
		const { attrs, error: attrErr } = parseAttributes(attrPart, tagLine);
		if (attrErr) return {
			root: null,
			error: attrErr
		};
		if (lowerTag === "h1" && !attrs.size) attrs.size = "xl";
		if (lowerTag === "h2" && !attrs.size) attrs.size = "lg";
		if (lowerTag === "h3" && !attrs.size) attrs.size = "md";
		if (lowerTag === "ol" && !attrs.ordered) attrs.ordered = "true";
		if (canonicalTag === "Code" && !selfClosing) {
			const closePattern = new RegExp(`<\\/${rawTagName}\\s*>`, "i");
			const rest = cleanSource.slice(pos);
			const closeMatch = closePattern.exec(rest);
			if (!closeMatch) return {
				root: null,
				error: {
					message: `Unclosed <${rawTagName}> opened on line ${tagLine}`,
					line: tagLine
				}
			};
			const rawCode = dedentMultiline(decodeBasicEntities(rest.slice(0, closeMatch.index)));
			pos += closeMatch.index + closeMatch[0].length;
			const top = stack[stack.length - 1];
			(top.kind === "node" ? top.node : top.parentTable).children.push({
				tag: "Code",
				attrs,
				children: [],
				text: rawCode,
				line: tagLine
			});
			continue;
		}
		const node = {
			tag: canonicalTag,
			attrs,
			children: [],
			line: tagLine
		};
		const top = stack[stack.length - 1];
		(top.kind === "node" ? top.node : top.parentTable).children.push(node);
		if (!(selfClosing || VOID_TAGS.has(canonicalTag))) stack.push({
			kind: "node",
			node,
			rawChunks: []
		});
	}
	if (stack.length > 1) {
		const unclosed = stack[stack.length - 1];
		const label = unclosed.kind === "node" ? unclosed.node.tag : unclosed.tagName;
		const line = unclosed.kind === "node" ? unclosed.node.line : unclosed.line;
		return {
			root: null,
			error: {
				message: `Unclosed <${label}> opened on line ${line}`,
				line
			}
		};
	}
	if (syntheticRoot.children.length === 0) return {
		root: null,
		error: {
			message: "Layout contains no visible components",
			line: 1
		}
	};
	return {
		root: syntheticRoot.children.length === 1 ? syntheticRoot.children[0] : syntheticRoot,
		error: null
	};
}
function collectLayoutImageRefs(root) {
	if (!root) return [];
	const refs = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (node.tag === "Image") refs.add(node.attrs.src ?? "");
		for (const child of node.children) walk(child);
	};
	walk(root);
	return Array.from(refs);
}
// src/engine/perlinNoise.ts
var PERM_BASE = [
	151,
	160,
	137,
	91,
	90,
	15,
	131,
	13,
	201,
	95,
	96,
	53,
	194,
	233,
	7,
	225,
	140,
	36,
	103,
	30,
	69,
	142,
	8,
	99,
	37,
	240,
	21,
	10,
	23,
	190,
	6,
	148,
	247,
	120,
	234,
	75,
	0,
	26,
	197,
	62,
	94,
	252,
	219,
	203,
	117,
	35,
	11,
	32,
	57,
	177,
	33,
	88,
	237,
	149,
	56,
	87,
	174,
	20,
	125,
	136,
	171,
	168,
	68,
	175,
	74,
	165,
	71,
	134,
	139,
	48,
	27,
	166,
	77,
	146,
	158,
	231,
	83,
	111,
	229,
	122,
	60,
	211,
	133,
	230,
	220,
	105,
	92,
	41,
	55,
	46,
	245,
	40,
	244,
	102,
	143,
	54,
	65,
	25,
	63,
	161,
	1,
	216,
	80,
	73,
	209,
	76,
	132,
	187,
	208,
	89,
	18,
	169,
	200,
	196,
	135,
	130,
	116,
	188,
	159,
	86,
	164,
	100,
	109,
	198,
	173,
	186,
	3,
	64,
	52,
	217,
	226,
	250,
	124,
	123,
	5,
	202,
	38,
	147,
	118,
	126,
	255,
	82,
	85,
	212,
	207,
	206,
	59,
	227,
	47,
	16,
	58,
	17,
	182,
	189,
	28,
	42,
	223,
	183,
	170,
	213,
	119,
	248,
	152,
	2,
	44,
	154,
	163,
	70,
	221,
	153,
	101,
	155,
	167,
	43,
	172,
	9,
	129,
	22,
	39,
	253,
	19,
	98,
	108,
	110,
	79,
	113,
	224,
	232,
	178,
	185,
	112,
	104,
	218,
	246,
	97,
	228,
	251,
	34,
	242,
	193,
	238,
	210,
	144,
	12,
	191,
	179,
	162,
	241,
	81,
	51,
	145,
	235,
	249,
	14,
	239,
	107,
	49,
	192,
	214,
	31,
	181,
	199,
	106,
	157,
	184,
	84,
	204,
	176,
	115,
	121,
	50,
	45,
	127,
	4,
	150,
	254,
	138,
	236,
	205,
	93,
	222,
	114,
	67,
	29,
	24,
	72,
	243,
	141,
	128,
	195,
	78,
	66,
	215,
	61,
	156,
	180
];
var PERM = /* @__PURE__ */ new Uint8Array(512);
for (let i = 0; i < 512; i++) PERM[i] = PERM_BASE[i & 255];
function fade(t) {
	return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a, b, t) {
	return a + t * (b - a);
}
function grad3(hash, x, y, z) {
	const h = hash & 15;
	const u = h < 8 ? x : y;
	const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
	return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function perlin3(x, y, z) {
	const X = Math.floor(x) & 255;
	const Y = Math.floor(y) & 255;
	const Z = Math.floor(z) & 255;
	const xf = x - Math.floor(x);
	const yf = y - Math.floor(y);
	const zf = z - Math.floor(z);
	const u = fade(xf);
	const v = fade(yf);
	const w = fade(zf);
	const A = PERM[X] + Y;
	const AA = PERM[A] + Z;
	const AB = PERM[A + 1] + Z;
	const B = PERM[X + 1] + Y;
	const BA = PERM[B] + Z;
	const BB = PERM[B + 1] + Z;
	return lerp(lerp(lerp(grad3(PERM[AA], xf, yf, zf), grad3(PERM[BA], xf - 1, yf, zf), u), lerp(grad3(PERM[AB], xf, yf - 1, zf), grad3(PERM[BB], xf - 1, yf - 1, zf), u), v), lerp(lerp(grad3(PERM[AA + 1], xf, yf, zf - 1), grad3(PERM[BA + 1], xf - 1, yf, zf - 1), u), lerp(grad3(PERM[AB + 1], xf, yf - 1, zf - 1), grad3(PERM[BB + 1], xf - 1, yf - 1, zf - 1), u), v), w);
}
function fbmPerlin(x, y, z) {
	return perlin3(x, y, z) * .68 + perlin3(x * 2.08 + 13.7, y * 2.08 - 7.3, z * 1.45) * .32;
}
/**
* Coarse spatial flow grid (zero per-frame heap allocations) storing
* divergence-free curl-Perlin wind + slow prevailing gust modulation.
*/
var PerlinWindField = class {
	constructor(cols = 52, rows = 34) {
		this.width = 1;
		this.height = 1;
		this.cols = cols;
		this.rows = rows;
		this.vxGrid = new Float32Array(cols * rows);
		this.vyGrid = new Float32Array(cols * rows);
	}
	update(width, height, time) {
		this.width = Math.max(1, width);
		this.height = Math.max(1, height);
		const { cols, rows, vxGrid, vyGrid } = this;
		const freq = 2.65 / Math.max(240, Math.min(this.width, this.height));
		const tSlow = time * .14;
		const eps = .045;
		const invTwoEps = 1 / (2 * eps);
		const gustAngle = perlin3(tSlow * .42, 4.1, 9.3) * 1.1;
		const gustStrength = .34 + .24 * perlin3(7.2, tSlow * .55, 2.8);
		const baseWindX = Math.cos(gustAngle) * gustStrength;
		const baseWindY = Math.sin(gustAngle) * gustStrength * .52;
		const stepX = this.width / (cols - 1);
		const stepY = this.height / (rows - 1);
		for (let gy = 0; gy < rows; gy++) {
			const ny = gy * stepY * freq;
			const rowOffset = gy * cols;
			for (let gx = 0; gx < cols; gx++) {
				const nx = gx * stepX * freq;
				const dNdy = (fbmPerlin(nx, ny + eps, tSlow) - fbmPerlin(nx, ny - eps, tSlow)) * invTwoEps;
				const dNdx = (fbmPerlin(nx + eps, ny, tSlow) - fbmPerlin(nx - eps, ny, tSlow)) * invTwoEps;
				const idx = rowOffset + gx;
				vxGrid[idx] = dNdy * .85 + baseWindX;
				vyGrid[idx] = -dNdx * .85 + baseWindY;
			}
		}
	}
	sampleX(px, py) {
		const gx = Math.max(0, Math.min(this.cols - 1.001, px / this.width * (this.cols - 1)));
		const gy = Math.max(0, Math.min(this.rows - 1.001, py / this.height * (this.rows - 1)));
		const x0 = gx | 0;
		const y0 = gy | 0;
		const fx = gx - x0;
		const fy = gy - y0;
		const i00 = y0 * this.cols + x0;
		const i10 = i00 + 1;
		const i01 = i00 + this.cols;
		const i11 = i01 + 1;
		const a = this.vxGrid[i00] + fx * (this.vxGrid[i10] - this.vxGrid[i00]);
		return a + fy * (this.vxGrid[i01] + fx * (this.vxGrid[i11] - this.vxGrid[i01]) - a);
	}
	sampleY(px, py) {
		const gx = Math.max(0, Math.min(this.cols - 1.001, px / this.width * (this.cols - 1)));
		const gy = Math.max(0, Math.min(this.rows - 1.001, py / this.height * (this.rows - 1)));
		const x0 = gx | 0;
		const y0 = gy | 0;
		const fx = gx - x0;
		const fy = gy - y0;
		const i00 = y0 * this.cols + x0;
		const i10 = i00 + 1;
		const i01 = i00 + this.cols;
		const i11 = i01 + 1;
		const a = this.vyGrid[i00] + fx * (this.vyGrid[i10] - this.vyGrid[i00]);
		return a + fy * (this.vyGrid[i01] + fx * (this.vyGrid[i11] - this.vyGrid[i01]) - a);
	}
};
// src/engine/particlePool.ts
function computeWavePoint(u, v, layer, phaseOffset, time, width, height) {
	const phase = u * Math.PI * 2;
	const crestY = height * (.48 + (layer - 1) * .052) + Math.sin(phase + time * .26 + layer * 1.75) * (height * .092) + Math.cos(phase * 2 - time * .19 + v * 1.45) * (height * .048) + Math.sin(phase * 4 + time * .31 + layer) * (height * .019);
	const ribbonThickness = height * (.09 + Math.sin(phase * 2 + time * .18 + layer) * .036);
	const rawX = (u * width + Math.sin(time * .22 + phaseOffset) * 10) % width;
	return {
		x: rawX < 0 ? rawX + width : rawX,
		y: crestY + v * ribbonThickness
	};
}
function createParticlePool(initialCapacity) {
	const cap = Math.max(1024, initialCapacity);
	return {
		capacity: cap,
		count: 0,
		x: new Float32Array(cap),
		y: new Float32Array(cap),
		vx: new Float32Array(cap),
		vy: new Float32Array(cap),
		tx: new Float32Array(cap),
		ty: new Float32Array(cap),
		hasTarget: new Uint8Array(cap),
		size: new Float32Array(cap),
		baseAlpha: new Float32Array(cap),
		phase: new Float32Array(cap),
		wanderSpeed: new Float32Array(cap),
		energy: new Float32Array(cap),
		waveLayer: new Int8Array(cap),
		waveU: new Float32Array(cap),
		waveV: new Float32Array(cap),
		depth: new Float32Array(cap),
		depthPlane: new Uint8Array(cap),
		mass: new Float32Array(cap),
		colorSeed: new Float32Array(cap),
		isFringe: new Uint8Array(cap),
		regionId: new Int16Array(cap).fill(-1),
		gravityBreakUntil: new Float64Array(cap),
		windReleaseAt: new Float64Array(cap)
	};
}
function growPool(pool, minCapacity) {
	const newCap = Math.max(minCapacity, Math.ceil(pool.capacity * 1.4));
	const growF32 = (old) => {
		const next = new Float32Array(newCap);
		next.set(old);
		return next;
	};
	const growF64 = (old) => {
		const next = new Float64Array(newCap);
		next.set(old);
		return next;
	};
	const growU8 = (old) => {
		const next = new Uint8Array(newCap);
		next.set(old);
		return next;
	};
	const growI8 = (old) => {
		const next = new Int8Array(newCap);
		next.set(old);
		return next;
	};
	const growI16 = (old) => {
		const next = new Int16Array(newCap).fill(-1);
		next.set(old);
		return next;
	};
	pool.x = growF32(pool.x);
	pool.y = growF32(pool.y);
	pool.vx = growF32(pool.vx);
	pool.vy = growF32(pool.vy);
	pool.tx = growF32(pool.tx);
	pool.ty = growF32(pool.ty);
	pool.hasTarget = growU8(pool.hasTarget);
	pool.size = growF32(pool.size);
	pool.baseAlpha = growF32(pool.baseAlpha);
	pool.phase = growF32(pool.phase);
	pool.wanderSpeed = growF32(pool.wanderSpeed);
	pool.energy = growF32(pool.energy);
	pool.waveLayer = growI8(pool.waveLayer);
	pool.waveU = growF32(pool.waveU);
	pool.waveV = growF32(pool.waveV);
	pool.depth = growF32(pool.depth);
	pool.depthPlane = growU8(pool.depthPlane);
	pool.mass = growF32(pool.mass);
	pool.colorSeed = growF32(pool.colorSeed);
	pool.isFringe = growU8(pool.isFringe);
	pool.regionId = growI16(pool.regionId);
	pool.gravityBreakUntil = growF64(pool.gravityBreakUntil);
	pool.windReleaseAt = growF64(pool.windReleaseAt);
	pool.capacity = newCap;
}
function resizeParticlePool(pool, desiredCount, width, height) {
	if (desiredCount > pool.capacity) growPool(pool, desiredCount + 2048);
	for (let i = pool.count; i < desiredCount; i++) {
		const isRibbon = Math.random() < .82;
		const waveLayer = isRibbon ? Math.floor(Math.random() * 3) : -1;
		const rawV = Math.random() * 2 - 1;
		const waveV = Math.sign(rawV) * Math.pow(Math.abs(rawV), 1.65);
		const waveU = Math.random();
		const depth = Math.random();
		const phase = Math.random() * Math.PI * 2;
		const mass = .72 + Math.random() * .68;
		const depthPlane = !isRibbon && Math.random() < .35 ? 0 : Math.random() < .25 ? 0 : 1;
		const size = depthPlane === 0 ? 1.85 + Math.random() * .65 : 2.1 + Math.random() * .75;
		let px = Math.random() * width;
		let py = Math.random() * height;
		if (isRibbon) {
			const pt = computeWavePoint(waveU, waveV, waveLayer, phase, 0, width, height);
			px = pt.x + (Math.random() - .5) * 8;
			py = pt.y + (Math.random() - .5) * 8;
		}
		pool.x[i] = px;
		pool.y[i] = py;
		pool.vx[i] = (Math.random() - .5) * .35;
		pool.vy[i] = (Math.random() - .5) * .35;
		pool.tx[i] = 0;
		pool.ty[i] = 0;
		pool.hasTarget[i] = 0;
		pool.size[i] = size;
		pool.baseAlpha[i] = depthPlane === 0 ? .14 + Math.random() * .18 : .3 + Math.random() * .45;
		pool.phase[i] = phase;
		pool.wanderSpeed[i] = .4 + Math.random() * .85;
		pool.energy[i] = 0;
		pool.waveLayer[i] = waveLayer;
		pool.waveU[i] = waveU;
		pool.waveV[i] = waveV;
		pool.depth[i] = depth;
		pool.depthPlane[i] = depthPlane;
		pool.mass[i] = mass;
		pool.colorSeed[i] = Math.random();
		pool.isFringe[i] = 0;
		pool.regionId[i] = -1;
		pool.gravityBreakUntil[i] = 0;
		pool.windReleaseAt[i] = 0;
	}
	pool.count = desiredCount;
}
export { perlin3 as a, PerlinWindField as i, createParticlePool as n, collectLayoutImageRefs as o, resizeParticlePool as r, parseLayoutMarkup as s, computeWavePoint as t };

//# sourceMappingURL=particlePool-T4zWJvz1.js.map