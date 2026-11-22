import { Volume2, VolumeX } from 'lucide-react';
import { PALETTE_THEMES } from '../engine/dustAtlas';
import type { InteractionMode, PaletteMode } from '../types/mote';

interface TopBarProps {
  interactionMode: InteractionMode;
  isFreeDrift: boolean;
  palette: PaletteMode;
  isMuted: boolean;
  dimmed: boolean;
  onSelectMode: (mode: InteractionMode) => void;
  onToggleFreeDrift: () => void;
  onCyclePalette: () => void;
  onToggleMute: () => void;
  onScatter: () => void;
  onWakeChrome: () => void;
}

export function TopBar({
  interactionMode,
  isFreeDrift,
  palette,
  isMuted,
  dimmed,
  onSelectMode,
  onToggleFreeDrift,
  onCyclePalette,
  onToggleMute,
  onScatter,
  onWakeChrome,
}: TopBarProps) {
  const paletteLabel = PALETTE_THEMES[palette].label;
  const accentUnderline =
    palette === 'sunbeam'
      ? 'bg-[#F59E0B]'
      : palette === 'moonlit'
      ? 'bg-[#CBD5E1]'
      : palette === 'aurora'
      ? 'bg-[#38BDF8]'
      : 'bg-[#4338CA]';

  return (
    <header
      onPointerEnter={onWakeChrome}
      onFocusCapture={onWakeChrome}
      className={`pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-5 py-4 sm:gap-8 sm:px-8 sm:py-5 transition-opacity ${
        dimmed ? 'opacity-25 duration-500 hover:opacity-100' : 'opacity-100 duration-150'
      }`}
    >
      {/* Zone 1: Single-element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectMode('dialogue');
        }}
        className="pointer-events-auto font-display text-xl font-medium tracking-tight text-[#18181B] dark:text-[#F4F6FF] transition-opacity duration-150 hover:opacity-80 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] rounded-sm"
      >
        Mote
      </a>

      {/* Zone 2: Clean single-line text navigation controls */}
      <nav
        aria-label="Canvas mode and atmosphere"
        className="pointer-events-auto flex min-w-0 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-7 text-xs sm:text-sm font-medium"
      >
        <button
          type="button"
          onClick={() => onSelectMode('dialogue')}
          className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] rounded-sm ${
            interactionMode === 'dialogue' && !isFreeDrift
              ? 'text-[#18181B] dark:text-[#F4F6FF]'
              : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
          }`}
        >
          Dialogue
          {interactionMode === 'dialogue' && !isFreeDrift && (
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 -bottom-0.5 h-[1.5px] ${accentUnderline}`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('sculpt')}
          className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] rounded-sm ${
            interactionMode === 'sculpt' && !isFreeDrift
              ? 'text-[#18181B] dark:text-[#F4F6FF]'
              : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
          }`}
        >
          Free Sculpt
          {interactionMode === 'sculpt' && !isFreeDrift && (
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 -bottom-0.5 h-[1.5px] ${accentUnderline}`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('image')}
          className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] rounded-sm ${
            interactionMode === 'image' && !isFreeDrift
              ? 'text-[#18181B] dark:text-[#F4F6FF]'
              : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
          }`}
        >
          Image
          {interactionMode === 'image' && !isFreeDrift && (
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 -bottom-0.5 h-[1.5px] ${accentUnderline}`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('layout')}
          className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] rounded-sm ${
            interactionMode === 'layout' && !isFreeDrift
              ? 'text-[#18181B] dark:text-[#F4F6FF]'
              : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
          }`}
        >
          Layout
          {interactionMode === 'layout' && !isFreeDrift && (
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 -bottom-0.5 h-[1.5px] ${accentUnderline}`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleFreeDrift}
          aria-pressed={isFreeDrift}
          className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] rounded-sm ${
            isFreeDrift
              ? 'text-[#18181B] dark:text-[#F4F6FF]'
              : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
          }`}
        >
          Wave
          {isFreeDrift && (
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 -bottom-0.5 h-[1.5px] ${accentUnderline}`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={onCyclePalette}
          title="Switch dust lighting atmosphere"
          className="hidden sm:inline-block py-1 text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF] whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] rounded-sm"
        >
          {paletteLabel}
        </button>
      </nav>

      {/* Zone 3: Global audio & scatter actions */}
      <div className="pointer-events-auto flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute ambient sound' : 'Mute ambient sound'}
          aria-pressed={!isMuted}
          title={isMuted ? 'Unmute ambient sound' : 'Mute ambient sound'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium rounded-lg border border-black/12 bg-[#ECE8DF]/85 text-[#18181B] hover:bg-[#E3DDD0] dark:border-white/12 dark:bg-[#0B0C14]/80 dark:text-[#F4F6FF] dark:hover:bg-[#141726] backdrop-blur-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8]"
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5 text-[#52525B] dark:text-[#94A3B8]" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Sound'}</span>
        </button>

        <button
          type="button"
          onClick={onScatter}
          className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-medium rounded-lg border border-black/12 bg-[#ECE8DF]/85 text-[#18181B] hover:bg-[#E3DDD0] dark:border-white/12 dark:bg-[#0B0C14]/80 dark:text-[#F4F6FF] dark:hover:bg-[#141726] backdrop-blur-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8]"
        >
          Scatter
        </button>
      </div>
    </header>
  );
}
