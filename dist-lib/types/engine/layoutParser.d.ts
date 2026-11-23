import type { LayoutDiagnostic, LayoutNode } from '../types/mote.js';
export interface ParseLayoutResult {
    root: LayoutNode | null;
    error: LayoutDiagnostic | null;
}
/**
 * Lightweight, zero-eval recursive markup & Markdown parser for declarative particle layouts.
 */
export declare function parseLayoutMarkup(markup: string): ParseLayoutResult;
export declare function collectLayoutImageRefs(root: LayoutNode | null): string[];
//# sourceMappingURL=layoutParser.d.ts.map