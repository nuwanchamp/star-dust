import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Code2, Contrast, RotateCcw, SlidersHorizontal, Upload, X } from 'lucide-react';
import { DIALOGUE_PROMPTS } from '../engine/dialogueScript';
import { PALETTE_THEMES } from '../engine/dustAtlas';
import { IMAGE_PRESETS, LAYOUT_PRESETS } from '../demo/presets';
import type {
  CursorMode,
  DensityPreset,
  DialoguePrompt,
  FontStyle,
  GlobalRippleTrigger,
  ImagePreset,
  ImageTuningConfig,
  InteractionMode,
  LayoutDiagnostic,
  LayoutPreset,
  PaletteMode,
  PhysicsConfig,
  RippleConfig,
  RipplePattern,
} from '../types/mote';

interface ComposerDockProps {
  interactionMode: InteractionMode;
  inputValue: string;
  activePromptId: string | null;
  activePresetId: string | null;
  activeImageLabel: string;
  invertImageContrast: boolean;
  imageTuning: ImageTuningConfig;
  activeLayoutPresetId: string | null;
  activeLayoutLabel: string;
  layoutEditorOpen: boolean;
  layoutDiagnostic: LayoutDiagnostic | null;
  physics: PhysicsConfig;
  ripple: RippleConfig;
  palette: PaletteMode;
  particleCount: number;
  dimmed: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (val: string) => void;
  onSubmitText: (text: string) => void;
  onSelectPrompt: (prompt: DialoguePrompt) => void;
  onSelectImagePreset: (preset: ImagePreset) => void;
  onUploadImageFile: (file: File) => void;
  onToggleInvertImage: () => void;
  onSelectLayoutPreset: (preset: LayoutPreset) => void;
  onToggleLayoutEditor: () => void;
  onUpdateImageTuning: (patch: Partial<ImageTuningConfig>) => void;
  onUpdatePhysics: (patch: Partial<PhysicsConfig>) => void;
  onUpdateRipple: (patch: Partial<RippleConfig>) => void;
  onResetPhysics: () => void;
  onSelectPalette: (palette: PaletteMode) => void;
  onTuningOpenChange: (open: boolean) => void;
  onWakeChrome: () => void;
}

const PALETTE_LIST: PaletteMode[] = ['aurora', 'sunbeam', 'moonlit', 'alabaster'];

export function ComposerDock({
  interactionMode,
  inputValue,
  activePromptId,
  activePresetId,
  activeImageLabel,
  invertImageContrast,
  imageTuning,
  activeLayoutPresetId,
  activeLayoutLabel,
  layoutEditorOpen,
  layoutDiagnostic,
  physics,
  ripple,
  palette,
  particleCount,
  dimmed,
  inputRef,
  onInputChange,
  onSubmitText,
  onSelectPrompt,
  onSelectImagePreset,
  onUploadImageFile,
  onToggleInvertImage,
  onSelectLayoutPreset,
  onToggleLayoutEditor,
  onUpdateImageTuning,
  onUpdatePhysics,
  onUpdateRipple,
  onResetPhysics,
  onSelectPalette,
  onTuningOpenChange,
  onWakeChrome,
}: ComposerDockProps) {
  const [tuningOpen, setTuningOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setTuning = (next: boolean | ((prev: boolean) => boolean)) => {
    setTuningOpen((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      onTuningOpenChange(resolved);
      return resolved;
    });
  };

  useEffect(() => {
    if (!tuningOpen) return;
    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(target)
      ) {
        setTuning(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTuning(false);
    };
    window.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [tuningOpen]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSubmitText(inputValue.trim());
  };

  const accentBg =
    palette === 'sunbeam'
      ? 'bg-[#F59E0B] text-[#060504]'
      : palette === 'moonlit'
      ? 'bg-[#E2E8F0] text-[#04060A]'
      : palette === 'aurora'
      ? 'bg-[#38BDF8] text-[#030306]'
      : 'bg-[#4338CA] text-[#F7F5F0]';

  const sliderAccent =
    palette === 'sunbeam'
      ? 'text-[#F59E0B]'
      : palette === 'moonlit'
      ? 'text-[#CBD5E1]'
      : palette === 'aurora'
      ? 'text-[#38BDF8]'
      : 'text-[#4338CA]';

  return (
    <div
      onPointerEnter={onWakeChrome}
      onFocusCapture={onWakeChrome}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center px-4 pb-4 sm:px-6 sm:pb-6 transition-opacity ${
        dimmed && !tuningOpen
          ? 'opacity-25 duration-500 hover:opacity-100'
          : 'opacity-100 duration-150'
      }`}
    >
      <div className="relative w-full max-w-2xl">
        {/* Compact Physics, Atmosphere & Typography Popover */}
        {tuningOpen && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Particle physics, image sculpture, and atmosphere settings"
            className="pointer-events-auto absolute bottom-full right-0 mb-3 max-h-[calc(100dvh-7.5rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-black/10 bg-[#ECE8DF]/95 p-5 text-[#18181B] shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0C14]/92 dark:text-[#F4F6FF] transition-all duration-150"
          >
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-black/8 pb-3 dark:border-white/8">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  {interactionMode === 'image' ? 'Image & Physics' : 'Particle Physics'}
                </h2>
                <p className="font-data text-xs text-[#52525B] dark:text-[#94A3B8]">
                  {particleCount.toLocaleString()} motes active
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onResetPhysics}
                  title="Reset defaults"
                  aria-label="Reset defaults"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF] transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTuning(false)}
                  aria-label="Close physics panel"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Atmosphere Palette Selector */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                  Atmosphere
                </span>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                  {PALETTE_LIST.map((pId) => (
                    <button
                      key={pId}
                      type="button"
                      onClick={() => onSelectPalette(pId)}
                      className={`rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        palette === pId
                          ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                          : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                      }`}
                    >
                      {PALETTE_THEMES[pId].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cursor Force */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                  Cursor Force
                </span>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                  {(['repel', 'vortex', 'breeze', 'off'] as CursorMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdatePhysics({ cursorMode: mode })}
                      className={`rounded-md px-1.5 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                        physics.cursorMode === mode
                          ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                          : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Density & Blur Mode (Image) or Density & Typeface (Text) */}
              {interactionMode === 'image' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                        Density
                      </span>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                        {(
                          [
                            { id: 'sparse', label: 'Low' },
                            { id: 'balanced', label: 'Med' },
                            { id: 'dense', label: 'High' },
                          ] as Array<{ id: DensityPreset; label: string }>
                        ).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onUpdatePhysics({ density: item.id })}
                            className={`rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              physics.density === item.id
                                ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                                : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                        Blur Style
                      </span>
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                        {(
                          [
                            { id: 'radial', label: 'Radial' },
                            { id: 'edge', label: 'Edge' },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onUpdateImageTuning({ blurStyle: item.id })}
                            className={`rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              imageTuning.blurStyle === item.id
                                ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                                : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Edge Blur Slider */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <label
                        htmlFor="edge-blur-slider"
                        className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                      >
                        Edge Blur
                      </label>
                      <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                        {Math.round(imageTuning.edgeBlur * 100)}%
                      </span>
                    </div>
                    <input
                      id="edge-blur-slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={imageTuning.edgeBlur}
                      onChange={(e) =>
                        onUpdateImageTuning({ edgeBlur: parseFloat(e.target.value) })
                      }
                      className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                    />
                  </div>

                  {/* Contrast Slider */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <label
                        htmlFor="image-contrast-slider"
                        className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                      >
                        Contrast
                      </label>
                      <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                        {imageTuning.contrast.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      id="image-contrast-slider"
                      type="range"
                      min="0.6"
                      max="1.8"
                      step="0.05"
                      value={imageTuning.contrast}
                      onChange={(e) =>
                        onUpdateImageTuning({ contrast: parseFloat(e.target.value) })
                      }
                      className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                    />
                  </div>

                  {/* Edge Detail Slider */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <label
                        htmlFor="image-detail-slider"
                        className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                      >
                        Edge Detail
                      </label>
                      <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                        {Math.round(imageTuning.detail * 100)}%
                      </span>
                    </div>
                    <input
                      id="image-detail-slider"
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={imageTuning.detail}
                      onChange={(e) =>
                        onUpdateImageTuning({ detail: parseFloat(e.target.value) })
                      }
                      className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                      Density
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                      {(
                        [
                          { id: 'sparse', label: 'Low' },
                          { id: 'balanced', label: 'Med' },
                          { id: 'dense', label: 'High' },
                        ] as Array<{ id: DensityPreset; label: string }>
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onUpdatePhysics({ density: item.id })}
                          className={`rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            physics.density === item.id
                              ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                              : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                      Typeface
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                      {(
                        [
                          { id: 'serif', label: 'Serif' },
                          { id: 'sans', label: 'Sans' },
                          { id: 'mono', label: 'Mono' },
                        ] as Array<{ id: FontStyle; label: string }>
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onUpdatePhysics({ fontStyle: item.id })}
                          className={`rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            physics.fontStyle === item.id
                              ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                              : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Turbulence Slider */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="turbulence-slider"
                    className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                  >
                    Ambient Drift
                  </label>
                  <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                    {physics.turbulence.toFixed(2)}×
                  </span>
                </div>
                <input
                  id="turbulence-slider"
                  type="range"
                  min="0.2"
                  max="1.6"
                  step="0.05"
                  value={physics.turbulence}
                  onChange={(e) => onUpdatePhysics({ turbulence: parseFloat(e.target.value) })}
                  className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                />
              </div>

              {/* Gravity Strength Slider */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label
                    htmlFor="cohesion-slider"
                    className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                  >
                    Gravity Strength
                  </label>
                  <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                    {Math.round(physics.cohesion * 1000)}
                  </span>
                </div>
                <input
                  id="cohesion-slider"
                  type="range"
                  min="0.03"
                  max="0.12"
                  step="0.005"
                  value={physics.cohesion}
                  onChange={(e) => onUpdatePhysics({ cohesion: parseFloat(e.target.value) })}
                  className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                />
              </div>

              {/* Idle Dissolve to Wave Timeout */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-[#52525B] dark:text-[#94A3B8]">
                    Idle Dissolve to Wave
                  </span>
                  <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                    {physics.autoDissolveSec === 0 ? 'Off' : `${physics.autoDissolveSec}s`}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                  {[
                    { sec: 0, label: 'Off' },
                    { sec: 10, label: '10s' },
                    { sec: 20, label: '20s' },
                    { sec: 45, label: '45s' },
                    { sec: 90, label: '90s' },
                  ].map((opt) => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => onUpdatePhysics({ autoDissolveSec: opt.sec })}
                      className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        physics.autoDissolveSec === opt.sec
                          ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                          : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Free Drift Perlin Wind Field Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                    Perlin Wind Field
                  </span>
                  <span className="text-[11px] text-[#71717A] dark:text-[#64748B]">
                    Wave free-drift currents
                  </span>
                </div>
                <div className="grid w-28 grid-cols-2 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                  {(
                    [
                      { val: false, label: 'Off' },
                      { val: true, label: 'On' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => onUpdatePhysics({ perlinFlow: opt.val })}
                      aria-pressed={physics.perlinFlow === opt.val}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        physics.perlinFlow === opt.val
                          ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                          : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Post-Processing Bloom & Light Trails Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                    Bloom Trails
                  </span>
                  <span className="text-[11px] text-[#71717A] dark:text-[#64748B]">
                    Soft glow on moving motes
                  </span>
                </div>
                <div className="grid w-28 grid-cols-2 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                  {(
                    [
                      { val: false, label: 'Off' },
                      { val: true, label: 'On' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => onUpdatePhysics({ bloom: opt.val })}
                      aria-pressed={physics.bloom === opt.val}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        physics.bloom === opt.val
                          ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                          : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Constellation Wireframe Web Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                    Constellation
                  </span>
                  <span className="text-[11px] text-[#71717A] dark:text-[#64748B]">
                    Wireframe web between motes
                  </span>
                </div>
                <div className="grid w-28 grid-cols-2 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                  {(
                    [
                      { val: false, label: 'Off' },
                      { val: true, label: 'On' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => onUpdatePhysics({ constellation: opt.val })}
                      aria-pressed={physics.constellation === opt.val}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        physics.constellation === opt.val
                          ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                          : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Configurable Particle Ripple Controls */}
              <div className="space-y-3 border-t border-black/8 pt-3.5 dark:border-white/8">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                    Particle Ripple
                  </span>
                  <div className="grid grid-cols-5 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                    {(
                      [
                        { id: 'off', label: 'Off' },
                        { id: 'ring', label: 'Ring' },
                        { id: 'sweep', label: 'Sweep' },
                        { id: 'pulse', label: 'Pulse' },
                        { id: 'expand', label: 'Expand' },
                      ] as Array<{ id: RipplePattern; label: string }>
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onUpdateRipple({ pattern: item.id })}
                        className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          ripple.pattern === item.id
                            ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                            : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(ripple.pattern !== 'off' || interactionMode === 'layout') && (
                  <>
                    {ripple.pattern !== 'expand' && (
                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-[#52525B] dark:text-[#94A3B8]">
                          Ripple Trigger
                        </span>
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/6">
                          {(
                            [
                              { id: 'both', label: 'Both' },
                              { id: 'ambient', label: 'Ambient' },
                              { id: 'interactive', label: 'Touch' },
                            ] as Array<{ id: GlobalRippleTrigger; label: string }>
                          ).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onUpdateRipple({ trigger: item.id })}
                              className={`rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                                ripple.trigger === item.id
                                  ? 'bg-[#F7F5F0] text-[#18181B] shadow-xs dark:bg-[#171A29] dark:text-[#F4F6FF]'
                                  : 'text-[#52525B] hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:text-[#F4F6FF]'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <label
                          htmlFor="ripple-strength-slider"
                          className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                        >
                          Ripple Strength
                        </label>
                        <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                          {Math.round(ripple.strength * 100)}%
                        </span>
                      </div>
                      <input
                        id="ripple-strength-slider"
                        type="range"
                        min="0.1"
                        max="1.5"
                        step="0.05"
                        value={ripple.strength}
                        onChange={(e) =>
                          onUpdateRipple({ strength: parseFloat(e.target.value) })
                        }
                        className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <label
                          htmlFor="ripple-speed-slider"
                          className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                        >
                          Ripple Speed
                        </label>
                        <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                          {ripple.speed.toFixed(2)}×
                        </span>
                      </div>
                      <input
                        id="ripple-speed-slider"
                        type="range"
                        min="0.3"
                        max="2.5"
                        step="0.05"
                        value={ripple.speed}
                        onChange={(e) =>
                          onUpdateRipple({ speed: parseFloat(e.target.value) })
                        }
                        className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <label
                          htmlFor="ripple-wave-slider"
                          className="font-medium text-[#52525B] dark:text-[#94A3B8]"
                        >
                          Wavelength
                        </label>
                        <span className="font-data text-[#18181B] dark:text-[#F4F6FF]">
                          {Math.round(ripple.wavelength)}px
                        </span>
                      </div>
                      <input
                        id="ripple-wave-slider"
                        type="range"
                        min="60"
                        max="280"
                        step="5"
                        value={ripple.wavelength}
                        onChange={(e) =>
                          onUpdateRipple({ wavelength: parseFloat(e.target.value) })
                        }
                        className={`mote-slider w-full bg-black/15 dark:bg-white/15 ${sliderAccent}`}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Prompts (Dialogue), Image Presets, Layout Presets, or Sculpt Guidance */}
        <div className="pointer-events-auto mb-2.5 flex items-center justify-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {interactionMode === 'dialogue' ? (
            DIALOGUE_PROMPTS.map((prompt) => {
              const isActive = activePromptId === prompt.id;
              return (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 backdrop-blur-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                    isActive
                      ? 'border-[#4338CA]/50 bg-[#4338CA]/12 text-[#18181B] dark:border-white/35 dark:bg-white/12 dark:text-[#F4F6FF]'
                      : 'border-black/10 bg-[#ECE8DF]/75 text-[#52525B] hover:border-black/20 hover:text-[#18181B] dark:border-white/10 dark:bg-[#0B0C14]/75 dark:text-[#94A3B8] dark:hover:border-white/20 dark:hover:text-[#F4F6FF]'
                  }`}
                >
                  {prompt.label}
                </button>
              );
            })
          ) : interactionMode === 'image' ? (
            IMAGE_PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectImagePreset(preset)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 backdrop-blur-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                    isActive
                      ? 'border-[#4338CA]/50 bg-[#4338CA]/12 text-[#18181B] dark:border-white/35 dark:bg-white/12 dark:text-[#F4F6FF]'
                      : 'border-black/10 bg-[#ECE8DF]/75 text-[#52525B] hover:border-black/20 hover:text-[#18181B] dark:border-white/10 dark:bg-[#0B0C14]/75 dark:text-[#94A3B8] dark:hover:border-white/20 dark:hover:text-[#F4F6FF]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })
          ) : interactionMode === 'layout' ? (
            LAYOUT_PRESETS.map((preset) => {
              const isActive = activeLayoutPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectLayoutPreset(preset)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 backdrop-blur-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                    isActive
                      ? 'border-[#4338CA]/50 bg-[#4338CA]/12 text-[#18181B] dark:border-white/35 dark:bg-white/12 dark:text-[#F4F6FF]'
                      : 'border-black/10 bg-[#ECE8DF]/75 text-[#52525B] hover:border-black/20 hover:text-[#18181B] dark:border-white/10 dark:bg-[#0B0C14]/75 dark:text-[#94A3B8] dark:hover:border-white/20 dark:hover:text-[#F4F6FF]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })
          ) : (
            <p className="text-xs text-[#52525B] dark:text-[#94A3B8] whitespace-nowrap">
              Type any phrase below—or press keys anywhere—to sculpt words in dust
            </p>
          )}
        </div>

        {/* Main Floating Composer / Image / Layout Dock */}
        {interactionMode === 'image' ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-black/12 bg-[#ECE8DF]/82 p-1.5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0C14]/82">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onUploadImageFile(file);
                }
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-opacity duration-150 hover:opacity-90 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${accentBg}`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </button>

            <div className="min-w-0 flex-1 px-2 text-xs text-[#52525B] dark:text-[#94A3B8] truncate">
              <span className="font-medium text-[#18181B] dark:text-[#F4F6FF]">
                {activeImageLabel}
              </span>
              <span className="hidden sm:inline"> — drop or paste any image</span>
            </div>

            <button
              type="button"
              onClick={onToggleInvertImage}
              aria-pressed={invertImageContrast}
              title="Flip light/dark tone emphasis"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                invertImageContrast
                  ? 'bg-black/10 text-[#18181B] dark:bg-white/12 dark:text-[#F4F6FF]'
                  : 'text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF]'
              }`}
            >
              <Contrast className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Invert</span>
            </button>

            <button
              ref={toggleBtnRef}
              type="button"
              onClick={() => setTuning((prev) => !prev)}
              aria-expanded={tuningOpen}
              aria-label="Toggle physics and atmosphere settings"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                tuningOpen
                  ? 'bg-black/10 text-[#18181B] dark:bg-white/12 dark:text-[#F4F6FF]'
                  : 'text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tune</span>
            </button>
          </div>
        ) : interactionMode === 'layout' ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-black/12 bg-[#ECE8DF]/82 p-1.5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0C14]/82">
            <button
              type="button"
              onClick={onToggleLayoutEditor}
              aria-expanded={layoutEditorOpen}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-opacity duration-150 hover:opacity-90 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${accentBg}`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>{layoutEditorOpen ? 'Hide Markup' : 'Edit Markup'}</span>
            </button>

            <div className="min-w-0 flex-1 px-2 text-xs text-[#52525B] dark:text-[#94A3B8] truncate">
              <span className="font-medium text-[#18181B] dark:text-[#F4F6FF]">
                {activeLayoutLabel}
              </span>
              {layoutDiagnostic ? (
                <span className="ml-2 text-[#B91C1C] dark:text-[#FCA5A5]">
                  Line {layoutDiagnostic.line}: {layoutDiagnostic.message}
                </span>
              ) : (
                <span className="hidden sm:inline"> — hover and click particle buttons</span>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleInvertImage}
              aria-pressed={invertImageContrast}
              title="Flip light/dark tone emphasis on images"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                invertImageContrast
                  ? 'bg-black/10 text-[#18181B] dark:bg-white/12 dark:text-[#F4F6FF]'
                  : 'text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF]'
              }`}
            >
              <Contrast className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Invert</span>
            </button>

            <button
              ref={toggleBtnRef}
              type="button"
              onClick={() => setTuning((prev) => !prev)}
              aria-expanded={tuningOpen}
              aria-label="Toggle physics and atmosphere settings"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                tuningOpen
                  ? 'bg-black/10 text-[#18181B] dark:bg-white/12 dark:text-[#F4F6FF]'
                  : 'text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Physics</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleFormSubmit}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-black/12 bg-[#ECE8DF]/82 p-1.5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0C14]/82"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              maxLength={240}
              placeholder={
                interactionMode === 'dialogue'
                  ? 'Ask or say something to the dust...'
                  : 'Type words to sculpt in dust...'
              }
              aria-label={
                interactionMode === 'dialogue'
                  ? 'Ask or say something to the dust'
                  : 'Type words to sculpt in dust'
              }
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[#18181B] placeholder-[#71717A] focus:outline-none dark:text-[#F4F6FF] dark:placeholder-[#64748B]"
            />

            <button
              ref={toggleBtnRef}
              type="button"
              onClick={() => setTuning((prev) => !prev)}
              aria-expanded={tuningOpen}
              aria-label="Toggle physics and atmosphere settings"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${
                tuningOpen
                  ? 'bg-black/10 text-[#18181B] dark:bg-white/12 dark:text-[#F4F6FF]'
                  : 'text-[#52525B] hover:bg-black/6 hover:text-[#18181B] dark:text-[#94A3B8] dark:hover:bg-white/8 dark:hover:text-[#F4F6FF]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Physics</span>
            </button>

            <button
              type="submit"
              disabled={!inputValue.trim()}
              aria-label={interactionMode === 'dialogue' ? 'Send message to dust' : 'Form text in dust'}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA] dark:focus-visible:ring-[#38BDF8] ${accentBg}`}
            >
              <span>{interactionMode === 'dialogue' ? 'Speak' : 'Form'}</span>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
