import { useRef } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { LayoutDiagnostic, PaletteMode } from '../types/mote';

interface LayoutEditorDrawerProps {
  open: boolean;
  markup: string;
  diagnostic: LayoutDiagnostic | null;
  palette: PaletteMode;
  onChangeMarkup: (next: string) => void;
  onResetMarkup: () => void;
  onClose: () => void;
  onWakeChrome: () => void;
}

const SNIPPETS: Array<{ label: string; code: string }> = [
  { label: '+ Row', code: '<Row gap="16" align="center">\n  \n</Row>' },
  { label: '+ Col', code: '<Col gap="14" align="center">\n  \n</Col>' },
  { label: '+ Heading', code: '<Heading size="lg">Title</Heading>' },
  { label: '+ Text', code: '<Text width="360">Dust description</Text>' },
  {
    label: '+ List',
    code: '<List width="320">\n  - First point\n  - Second point\n</List>',
  },
  {
    label: '+ Table',
    code: '<Table width="360">\n  | Name | Role |\n  | :--- | :---: |\n  | Dust | Particle |\n  | Wave | Field |\n</Table>',
  },
  { label: '+ Quote', code: '<Quote width="340" cite="Author">Luminous prose.</Quote>' },
  { label: '+ Code', code: '<Code width="340">ripple="expand"</Code>' },
  {
    label: '+ MindMap',
    code: '<MindMap layout="radial">\n  Central Topic\n    - Branch One\n      - Sub-item A\n      - Sub-item B\n    - Branch Two\n      - Sub-item C\n</MindMap>',
  },
  { label: '+ Image', code: '<Image src="cutout" width="220" height="220" blur="0.45" />' },
  { label: '+ Button', code: '<Button action="scatter">Click Me</Button>' },
  { label: '+ Solid Btn', code: '<Button action="scatter" variant="solid">Action</Button>' },
];

export function LayoutEditorDrawer({
  open,
  markup,
  diagnostic,
  palette,
  onChangeMarkup,
  onResetMarkup,
  onClose,
  onWakeChrome,
}: LayoutEditorDrawerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  if (!open) return null;

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChangeMarkup(`${markup.trimEnd()}\n${snippet}`);
      return;
    }
    const start = el.selectionStart ?? markup.length;
    const end = el.selectionEnd ?? markup.length;
    const prefix = markup.slice(0, start);
    const suffix = markup.slice(end);
    const needsLeadingNewline = prefix.length > 0 && !prefix.endsWith('\n');
    const insertion = `${needsLeadingNewline ? '\n' : ''}${snippet}`;
    const next = `${prefix}${insertion}${suffix}`;
    onChangeMarkup(next);

    requestAnimationFrame(() => {
      el.focus();
      const caret = prefix.length + insertion.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const focusBorder =
    palette === 'sunbeam'
      ? 'focus:border-[#F59E0B]/50'
      : palette === 'moonlit'
      ? 'focus:border-[#CBD5E1]/50'
      : palette === 'aurora'
      ? 'focus:border-[#38BDF8]/50'
      : 'focus:border-[#4338CA]/50';

  return (
    <aside
      aria-label="Particle layout markup editor"
      onPointerEnter={onWakeChrome}
      onFocusCapture={onWakeChrome}
      className="pointer-events-auto fixed inset-x-4 bottom-28 z-20 flex max-h-[46dvh] flex-col rounded-xl border border-black/10 bg-[#ECE8DF]/92 p-4 text-[#18181B] shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0C14]/90 dark:text-[#F4F6FF] sm:inset-x-auto sm:top-20 sm:bottom-24 sm:left-6 sm:max-h-none sm:w-[376px]"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-black/8 pb-2.5 dark:border-white/8">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">Layout Markup</h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onResetMarkup}
            title="Reset preset markup"
            aria-label="Reset preset markup"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF] transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Hide editor"
            aria-label="Hide editor"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick tag insert bar */}
      <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SNIPPETS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => insertSnippet(item.code)}
            className="rounded-md border border-black/10 bg-[#F7F5F0]/80 px-2 py-1 text-xs font-medium text-[#52525B] hover:border-black/20 hover:text-[#18181B] dark:border-white/10 dark:bg-[#171A29]/80 dark:text-[#94A3B8] dark:hover:border-white/20 dark:hover:text-[#F4F6FF] whitespace-nowrap shrink-0 transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Monospace code editor */}
      <textarea
        ref={textareaRef}
        value={markup}
        onChange={(e) => onChangeMarkup(e.target.value)}
        spellCheck={false}
        aria-label="Declarative layout markup"
        className={`font-data min-h-[140px] flex-1 resize-none rounded-lg border border-black/10 bg-[#F7F5F0]/85 p-3 text-xs leading-relaxed text-[#18181B] placeholder-[#71717A] focus:outline-none dark:border-white/10 dark:bg-[#05060B]/85 dark:text-[#E2E8F0] dark:placeholder-[#64748B] ${focusBorder}`}
      />

      {/* Diagnostic / Hint footer */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        {diagnostic ? (
          <p className="font-data text-[#B91C1C] dark:text-[#FCA5A5] truncate" role="status">
            Line {diagnostic.line} · {diagnostic.message}
          </p>
        ) : (
          <p className="text-[#52525B] dark:text-[#94A3B8] truncate">
            Supports tags (&lt;MindMap&gt;, &lt;List&gt;, &lt;Table&gt;, &lt;Quote&gt;, &lt;Code&gt;) or Markdown
          </p>
        )}
      </div>
    </aside>
  );
}
