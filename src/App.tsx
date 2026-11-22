import { useCallback, useEffect, useRef, useState } from 'react';
import { ComposerDock } from './components/ComposerDock';
import { DEFAULT_PHYSICS, DEFAULT_RIPPLE } from './lib/StarDust';
import { DustCanvas } from './lib/react';
import { LayoutEditorDrawer } from './components/LayoutEditorDrawer';
import { TopBar } from './components/TopBar';
import { AmbientSoundEngine } from './engine/ambientSoundEngine';
import {
  CLICK_CYCLE_BEATS,
  OPENING_MESSAGE,
  generateDialogueReply,
  pickGestureReply,
} from './engine/dialogueScript';
import { PALETTE_THEMES } from './engine/dustAtlas';
import { DEFAULT_IMAGE_TUNING } from './engine/imageSampler';
import { parseLayoutMarkup } from './engine/layoutParser';
import { IMAGE_PRESETS, LAYOUT_PRESETS, resolveDemoLayoutImage } from './demo/presets';
import type {
  DialoguePrompt,
  GestureKind,
  ImagePreset,
  ImageTuningConfig,
  InteractionMode,
  LayoutDiagnostic,
  LayoutHitRegion,
  LayoutNode,
  LayoutPreset,
  PaletteMode,
  PhysicsConfig,
  RippleConfig,
  RipplePattern,
} from './types/mote';

const PALETTE_ORDER: PaletteMode[] = ['aurora', 'sunbeam', 'moonlit', 'alabaster'];

export default function App() {
  const [palette, setPalette] = useState<PaletteMode>('aurora');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('dialogue');
  const [isFreeDrift, setIsFreeDrift] = useState(true);
  const [activeText, setActiveText] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(IMAGE_PRESETS[0].src);
  const [activeImageLabel, setActiveImageLabel] = useState<string>(IMAGE_PRESETS[0].label);
  const [activePresetId, setActivePresetId] = useState<string | null>(IMAGE_PRESETS[0].id);
  const [invertImageContrast, setInvertImageContrast] = useState(false);
  const [imageTuning, setImageTuning] = useState<ImageTuningConfig>(DEFAULT_IMAGE_TUNING);
  const [layoutMarkup, setLayoutMarkup] = useState<string>(LAYOUT_PRESETS[0].markup);
  const [activeLayoutPresetId, setActiveLayoutPresetId] = useState<string | null>(
    LAYOUT_PRESETS[0].id
  );
  const [activeLayoutLabel, setActiveLayoutLabel] = useState<string>(LAYOUT_PRESETS[0].label);
  const [layoutAst, setLayoutAst] = useState<LayoutNode | null>(
    () => parseLayoutMarkup(LAYOUT_PRESETS[0].markup).root
  );
  const [layoutDiagnostic, setLayoutDiagnostic] = useState<LayoutDiagnostic | null>(null);
  const [layoutEditorOpen, setLayoutEditorOpen] = useState<boolean>(false);
  const [collapsedMindMapIds, setCollapsedMindMapIds] = useState<Set<string>>(() => new Set());
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [scatterVersion, setScatterVersion] = useState(0);
  const [particleCount, setParticleCount] = useState(0);
  const [physics, setPhysics] = useState<PhysicsConfig>(DEFAULT_PHYSICS);
  const [ripple, setRipple] = useState<RippleConfig>(DEFAULT_RIPPLE);
  const [chromeDimmed, setChromeDimmed] = useState(false);
  const [activityVersion, setActivityVersion] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const beatTimersRef = useRef<number[]>([]);
  const idleTimerRef = useRef<number | null>(null);
  const chromeTimerRef = useRef<number | null>(null);
  const tuningOpenRef = useRef(false);
  const layoutEditorOpenRef = useRef(false);
  const clickIndexRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const autoDissolvedRef = useRef(false);
  const soundEngineRef = useRef<AmbientSoundEngine | null>(null);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const freeDriftRef = useRef(isFreeDrift);
  freeDriftRef.current = isFreeDrift;

  // Initialize procedural ambient sound engine and unlock cleanly on first user gesture
  useEffect(() => {
    const engine = new AmbientSoundEngine();
    soundEngineRef.current = engine;

    const unlockOnGesture = () => {
      if (!engine.isMuted()) {
        engine.unlock();
      }
    };

    window.addEventListener('pointerdown', unlockOnGesture, { passive: true });
    window.addEventListener('keydown', unlockOnGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
      engine.dispose();
      soundEngineRef.current = null;
    };
  }, []);

  // Sync .dark class on <html> for Tailwind v4 dual-theme variants
  useEffect(() => {
    const root = document.documentElement;
    if (PALETTE_THEMES[palette].isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [palette]);

  const clearBeatTimers = useCallback(() => {
    beatTimersRef.current.forEach((id) => window.clearTimeout(id));
    beatTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!isFreeDrift) {
      autoDissolvedRef.current = false;
    }
  }, [isFreeDrift]);

  const markUserActivity = useCallback(() => {
    setActivityVersion((v) => (v + 1) % 1000000);
  }, []);

  // Auto-dim TopBar and ComposerDock after 4.5s of untouched canvas immersion
  const wakeChrome = useCallback(() => {
    markUserActivity();
    setChromeDimmed(false);
    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
    }
    chromeTimerRef.current = window.setTimeout(() => {
      const activeTag = document.activeElement?.tagName;
      const isEditing =
        document.activeElement === inputRef.current || activeTag === 'TEXTAREA';
      if (!tuningOpenRef.current && !layoutEditorOpenRef.current && !isEditing) {
        setChromeDimmed(true);
      }
    }, 4500);
  }, [markUserActivity]);

  const resetIdleTimer = useCallback(() => {
    markUserActivity();
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (physics.autoDissolveSec > 0) return;
    idleTimerRef.current = window.setTimeout(() => {
      if (interactionMode === 'dialogue' && !isFreeDrift) {
        setActivePromptId(null);
        setActiveText(pickGestureReply('idle'));
      }
    }, 16000);
  }, [interactionMode, isFreeDrift, markUserActivity, physics.autoDissolveSec]);

  // Track responsive viewport width for clean layout centering alongside editor drawer
  useEffect(() => {
    const onResize = () => {
      setIsDesktopViewport(window.innerWidth >= 768);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Debounced live parse of Layout markup (keeps last valid AST on stage while typing)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const { root, error } = parseLayoutMarkup(layoutMarkup);
      if (root) {
        setLayoutAst(root);
        setLayoutDiagnostic(null);
      } else {
        setLayoutDiagnostic(error);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [layoutMarkup]);

  // Initial chrome timer + wake on edge approach, keyboard input, or wheel
  useEffect(() => {
    wakeChrome();
    const handlePointerEdge = (e: PointerEvent) => {
      const h = window.innerHeight;
      if (e.clientY < 110 || e.clientY > h - 180) {
        wakeChrome();
      }
    };
    const handleWindowActivity = () => {
      markUserActivity();
    };
    window.addEventListener('pointermove', handlePointerEdge, { passive: true });
    window.addEventListener('keydown', handleWindowActivity, { passive: true });
    window.addEventListener('wheel', handleWindowActivity, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerEdge);
      window.removeEventListener('keydown', handleWindowActivity);
      window.removeEventListener('wheel', handleWindowActivity);
      clearBeatTimers();
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [clearBeatTimers, markUserActivity, wakeChrome]);

  const playBeats = useCallback(
    (beats: string[], withInitialScatter = true) => {
      clearBeatTimers();
      setIsFreeDrift(false);
      if (withInitialScatter) {
        setScatterVersion((v) => v + 1);
      }

      if (beats.length === 0) return;
      setActiveText(beats[0]);

      let elapsed = 0;
      for (let i = 1; i < beats.length; i++) {
        elapsed += 3600;
        const nextBeat = beats[i];
        const timerId = window.setTimeout(() => {
          setScatterVersion((v) => v + 1);
          setActiveText(nextBeat);
        }, elapsed);
        beatTimersRef.current.push(timerId);
      }
    },
    [clearBeatTimers]
  );

  const loadUploadedImage = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      wakeChrome();
      clearBeatTimers();
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const nextUrl = URL.createObjectURL(file);
      objectUrlRef.current = nextUrl;

      setInteractionMode('image');
      setIsFreeDrift(false);
      setActivePromptId(null);
      setActivePresetId(null);
      setActiveImageSrc(nextUrl);
      setActiveImageLabel(file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Pasted image');
      setScatterVersion((v) => v + 1);
    },
    [clearBeatTimers, wakeChrome]
  );

  // Global clipboard paste listener for any copied image
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            loadUploadedImage(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadUploadedImage]);

  // Global keyboard shortcut: typing anywhere focuses input & sculpts live if in sculpt mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (interactionMode === 'image' || interactionMode === 'layout') return;
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInputFocused) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key.length === 1 && !e.repeat) {
        e.preventDefault();
        wakeChrome();
        inputRef.current?.focus();
        setInputValue((prev) => {
          const next = (prev + e.key).slice(0, 240);
          if (interactionMode === 'sculpt') {
            clearBeatTimers();
            setIsFreeDrift(false);
            setActiveText(next.trim() || 'Shape the air');
          }
          return next;
        });
        resetIdleTimer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearBeatTimers, interactionMode, resetIdleTimer, wakeChrome]);

  const handleSelectMode = (mode: InteractionMode) => {
    wakeChrome();
    if (mode === 'dialogue') {
      resetIdleTimer();
    } else if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    clearBeatTimers();
    setInteractionMode(mode);
    setIsFreeDrift(false);
    setActivePromptId(null);

    if (mode === 'sculpt') {
      const nextText = inputValue.trim() || 'Shape the air';
      setActiveText(nextText);
      inputRef.current?.focus();
    } else if (mode === 'image') {
      setScatterVersion((v) => v + 1);
      if (!activeImageSrc) {
        setActiveImageSrc(IMAGE_PRESETS[0].src);
        setActiveImageLabel(IMAGE_PRESETS[0].label);
        setActivePresetId(IMAGE_PRESETS[0].id);
      }
    } else if (mode === 'layout') {
      const shouldOpen = typeof window !== 'undefined' && window.innerWidth >= 900;
      layoutEditorOpenRef.current = shouldOpen;
      setLayoutEditorOpen(shouldOpen);
      setScatterVersion((v) => v + 1);
    } else {
      layoutEditorOpenRef.current = false;
      setScatterVersion((v) => v + 1);
      setActiveText(OPENING_MESSAGE);
    }
    if (mode !== 'layout') {
      layoutEditorOpenRef.current = false;
    }
  };

  const handleSelectImagePreset = (preset: ImagePreset) => {
    wakeChrome();
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    clearBeatTimers();
    setInteractionMode('image');
    setIsFreeDrift(false);
    setActivePromptId(null);
    setActivePresetId(preset.id);
    setActiveImageSrc(preset.src);
    setActiveImageLabel(preset.label);
    setScatterVersion((v) => v + 1);
  };

  const handleSelectLayoutPreset = (preset: LayoutPreset) => {
    wakeChrome();
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    clearBeatTimers();
    setInteractionMode('layout');
    setIsFreeDrift(false);
    setActivePromptId(null);
    setActiveLayoutPresetId(preset.id);
    setActiveLayoutLabel(preset.label);
    setLayoutMarkup(preset.markup);
    setCollapsedMindMapIds(new Set());
    const parsed = parseLayoutMarkup(preset.markup);
    if (parsed.root) {
      setLayoutAst(parsed.root);
      setLayoutDiagnostic(null);
    }
    setScatterVersion((v) => v + 1);
  };

  const handleChangeLayoutMarkup = (nextMarkup: string) => {
    wakeChrome();
    setLayoutMarkup(nextMarkup);
    const matching = LAYOUT_PRESETS.find((p) => p.markup === nextMarkup);
    if (matching) {
      setActiveLayoutPresetId(matching.id);
      setActiveLayoutLabel(matching.label);
    } else {
      setActiveLayoutPresetId(null);
      setActiveLayoutLabel('Custom layout');
    }
  };

  const handleResetLayoutMarkup = () => {
    const preset =
      LAYOUT_PRESETS.find((p) => p.id === activeLayoutPresetId) || LAYOUT_PRESETS[0];
    handleSelectLayoutPreset(preset);
  };

  const handleToggleLayoutEditor = () => {
    setLayoutEditorOpen((prev) => {
      const next = !prev;
      layoutEditorOpenRef.current = next;
      wakeChrome();
      return next;
    });
  };

  const handleLayoutAction = (action: string, _region: LayoutHitRegion) => {
    wakeChrome();
    const rawTrimmed = action.trim();
    if (rawTrimmed.toLowerCase().startsWith('mindmap:toggle:')) {
      const nodeId = rawTrimmed.slice('mindmap:toggle:'.length);
      if (nodeId) {
        setCollapsedMindMapIds((prev) => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });
      }
      return;
    }
    const clean = rawTrimmed.toLowerCase();
    if (clean === 'scatter') {
      handleScatter();
    } else if (clean === 'wave') {
      handleToggleFreeDrift();
    } else if (clean === 'invert') {
      handleToggleInvertImage();
    } else if (clean.startsWith('palette:')) {
      const target = clean.slice('palette:'.length) as PaletteMode;
      if (PALETTE_ORDER.includes(target)) {
        setPalette(target);
      }
    } else if (clean.startsWith('scene:')) {
      const sceneId = clean.slice('scene:'.length);
      const targetPreset = LAYOUT_PRESETS.find((p) => p.id === sceneId);
      if (targetPreset) {
        handleSelectLayoutPreset(targetPreset);
      }
    } else if (clean.startsWith('ripple:')) {
      const targetPattern = clean.slice('ripple:'.length) as RipplePattern;
      if (
        targetPattern === 'off' ||
        targetPattern === 'ring' ||
        targetPattern === 'sweep' ||
        targetPattern === 'pulse' ||
        targetPattern === 'expand'
      ) {
        setRipple((prev) => ({ ...prev, pattern: targetPattern }));
      }
    } else if (clean.startsWith('mode:')) {
      const nextMode = clean.slice('mode:'.length) as InteractionMode;
      if (
        nextMode === 'dialogue' ||
        nextMode === 'sculpt' ||
        nextMode === 'image' ||
        nextMode === 'layout'
      ) {
        handleSelectMode(nextMode);
      }
    } else {
      handleScatter();
    }
  };

  const handleToggleInvertImage = () => {
    wakeChrome();
    setInvertImageContrast((prev) => !prev);
  };

  const handleAutoDissolvedToWave = useCallback(() => {
    autoDissolvedRef.current = true;
    clearBeatTimers();
    setIsFreeDrift(true);
  }, [clearBeatTimers]);

  const handleToggleFreeDrift = () => {
    wakeChrome();
    resetIdleTimer();
    clearBeatTimers();
    setActivePromptId(null);
    autoDissolvedRef.current = false;
    setIsFreeDrift((prev) => {
      const next = !prev;
      setScatterVersion((v) => v + 1);
      if (next) {
        if (interactionMode !== 'image' && interactionMode !== 'layout') {
          setActiveText('');
        }
      } else if (interactionMode !== 'image' && interactionMode !== 'layout' && !activeText) {
        setActiveText(OPENING_MESSAGE);
      }
      return next;
    });
  };

  const handleScatter = () => {
    wakeChrome();
    resetIdleTimer();
    if (isFreeDrift && autoDissolvedRef.current) {
      autoDissolvedRef.current = false;
      setIsFreeDrift(false);
    }
    soundEngineRef.current?.triggerChime(0.85, 0.5);
    setScatterVersion((v) => v + 1);
  };

  const handleToggleMute = () => {
    wakeChrome();
    setIsMuted((prev) => {
      const next = !prev;
      soundEngineRef.current?.setMuted(next);
      return next;
    });
  };

  const handleMotionMetrics = useCallback(
    (metrics: { particleCount: number; avgVelocity: number; avgEnergy: number }) => {
      soundEngineRef.current?.updateMetrics({
        particleCount: metrics.particleCount,
        avgVelocity: metrics.avgVelocity,
        avgEnergy: metrics.avgEnergy,
        isFreeDrift: freeDriftRef.current,
        palette: paletteRef.current,
      });
    },
    []
  );

  const handleSoundImpulse = useCallback((intensity: number, normX: number) => {
    soundEngineRef.current?.triggerChime(intensity, normX);
  }, []);

  const handleCanvasClick = () => {
    resetIdleTimer();
    if (isFreeDrift && autoDissolvedRef.current) {
      autoDissolvedRef.current = false;
      setIsFreeDrift(false);
      if (interactionMode === 'dialogue' && !activeText) {
        setActiveText(OPENING_MESSAGE);
      }
      return;
    }
    if (interactionMode === 'dialogue') {
      clearBeatTimers();
      setActivePromptId(null);
      if (isFreeDrift) {
        setIsFreeDrift(false);
        clickIndexRef.current = 0;
        setActiveText(CLICK_CYCLE_BEATS[0]);
      } else {
        clickIndexRef.current = (clickIndexRef.current + 1) % CLICK_CYCLE_BEATS.length;
        setActiveText(CLICK_CYCLE_BEATS[clickIndexRef.current]);
      }
    }
  };

  const handleGesture = (kind: GestureKind) => {
    resetIdleTimer();
    if (isFreeDrift || interactionMode !== 'dialogue') return;
    clearBeatTimers();
    setActivePromptId(null);
    setActiveText(pickGestureReply(kind));
  };

  const handleSelectPrompt = (prompt: DialoguePrompt) => {
    wakeChrome();
    resetIdleTimer();
    setInteractionMode('dialogue');
    setActivePromptId(prompt.id);
    playBeats(prompt.beats, true);
  };

  const handleInputChange = (val: string) => {
    wakeChrome();
    resetIdleTimer();
    setInputValue(val);
    if (interactionMode === 'sculpt') {
      clearBeatTimers();
      setIsFreeDrift(false);
      setActiveText(val.trim() || 'Shape the air');
    }
  };

  const handleSubmitText = (text: string) => {
    wakeChrome();
    resetIdleTimer();
    setIsFreeDrift(false);
    setActivePromptId(null);

    if (interactionMode === 'sculpt') {
      setScatterVersion((v) => v + 1);
      setActiveText(text);
    } else {
      const replyBeats = generateDialogueReply(text);
      playBeats(replyBeats, true);
      setInputValue('');
    }
  };

  const handleUpdateImageTuning = (patch: Partial<ImageTuningConfig>) => {
    wakeChrome();
    resetIdleTimer();
    setImageTuning((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdatePhysics = (patch: Partial<PhysicsConfig>) => {
    wakeChrome();
    resetIdleTimer();
    setPhysics((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateRipple = (patch: Partial<RippleConfig>) => {
    wakeChrome();
    resetIdleTimer();
    setRipple((prev) => ({ ...prev, ...patch }));
  };

  const handleResetPhysics = () => {
    wakeChrome();
    resetIdleTimer();
    setPhysics(DEFAULT_PHYSICS);
    setRipple(DEFAULT_RIPPLE);
    setImageTuning(DEFAULT_IMAGE_TUNING);
  };

  const handleCyclePalette = () => {
    wakeChrome();
    setPalette((prev) => {
      const idx = PALETTE_ORDER.indexOf(prev);
      return PALETTE_ORDER[(idx + 1) % PALETTE_ORDER.length];
    });
  };

  const handleSelectPalette = (next: PaletteMode) => {
    wakeChrome();
    setPalette(next);
  };

  const handleTuningOpenChange = (open: boolean) => {
    tuningOpenRef.current = open;
    wakeChrome();
  };

  const bgClass =
    palette === 'sunbeam'
      ? 'bg-[#060504]'
      : palette === 'moonlit'
      ? 'bg-[#04060A]'
      : palette === 'alabaster'
      ? 'bg-[#F7F5F0]'
      : 'bg-[#030306]';

  return (
    <main
      onDragEnter={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          setIsDraggingFile(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingFile(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = Array.from(e.dataTransfer.files || []).find((f) =>
          f.type.startsWith('image/')
        );
        if (file) {
          loadUploadedImage(file);
        }
      }}
      className={`relative h-[100dvh] w-screen overflow-hidden text-[#18181B] dark:text-[#F4F6FF] transition-colors duration-300 ${bgClass}`}
    >
      {/* Full-viewport interactive dust particle stage */}
      <DustCanvas
        activeText={activeText}
        targetMode={
          interactionMode === 'image'
            ? 'image'
            : interactionMode === 'layout'
            ? 'layout'
            : 'text'
        }
        imageSrc={activeImageSrc}
        invertImageContrast={invertImageContrast}
        imageTuning={imageTuning}
        layoutAst={layoutAst}
        layoutLeftInset={
          interactionMode === 'layout' && layoutEditorOpen && isDesktopViewport ? 396 : 0
        }
        collapsedMindMapIds={collapsedMindMapIds}
        isFreeDrift={isFreeDrift}
        scatterVersion={scatterVersion}
        physics={physics}
        ripple={ripple}
        palette={palette}
        activityVersion={activityVersion}
        onCanvasClick={handleCanvasClick}
        onGesture={handleGesture}
        onParticleCountChange={setParticleCount}
        onLayoutAction={handleLayoutAction}
        onAutoDissolvedToWave={handleAutoDissolvedToWave}
        onUserActivity={markUserActivity}
        onMotionMetrics={handleMotionMetrics}
        onSoundImpulse={handleSoundImpulse}
        className="fixed inset-0"
        resolveLayoutImage={resolveDemoLayoutImage}
      />

      {/* Drag-and-drop overlay cue */}
      {isDraggingFile && (
        <div className="pointer-events-none fixed inset-4 z-30 flex items-center justify-center rounded-2xl border border-dashed border-[#4338CA]/50 bg-[#F7F5F0]/75 backdrop-blur-md dark:border-[#38BDF8]/50 dark:bg-[#030306]/75 transition-opacity">
          <p className="font-display text-xl font-medium tracking-tight text-[#18181B] dark:text-[#F4F6FF]">
            Drop image to sculpt in dust
          </p>
        </div>
      )}

      {/* Minimal 3-zone top bar */}
      <TopBar
        interactionMode={interactionMode}
        isFreeDrift={isFreeDrift}
        palette={palette}
        isMuted={isMuted}
        dimmed={chromeDimmed && !(interactionMode === 'layout' && layoutEditorOpen)}
        onSelectMode={handleSelectMode}
        onToggleFreeDrift={handleToggleFreeDrift}
        onCyclePalette={handleCyclePalette}
        onToggleMute={handleToggleMute}
        onScatter={handleScatter}
        onWakeChrome={wakeChrome}
      />

      {/* Live Declarative Layout Markup Editor Drawer */}
      {interactionMode === 'layout' && (
        <LayoutEditorDrawer
          open={layoutEditorOpen}
          markup={layoutMarkup}
          diagnostic={layoutDiagnostic}
          palette={palette}
          onChangeMarkup={handleChangeLayoutMarkup}
          onResetMarkup={handleResetLayoutMarkup}
          onClose={() => {
            layoutEditorOpenRef.current = false;
            setLayoutEditorOpen(false);
          }}
          onWakeChrome={wakeChrome}
        />
      )}

      {/* Screen-reader live region announcing formed particle words, image, or layout */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isFreeDrift
          ? 'Particles drifting freely in wave'
          : interactionMode === 'image'
          ? `Image particle sculpture: ${activeImageLabel}`
          : interactionMode === 'layout'
          ? `Particle layout: ${activeLayoutLabel}`
          : activeText}
      </div>

      {/* Floating bottom dialogue, sculpting, image, & layout dock */}
      <ComposerDock
        interactionMode={interactionMode}
        inputValue={inputValue}
        activePromptId={activePromptId}
        activePresetId={activePresetId}
        activeImageLabel={activeImageLabel}
        invertImageContrast={invertImageContrast}
        imageTuning={imageTuning}
        activeLayoutPresetId={activeLayoutPresetId}
        activeLayoutLabel={activeLayoutLabel}
        layoutEditorOpen={layoutEditorOpen}
        layoutDiagnostic={layoutDiagnostic}
        physics={physics}
        ripple={ripple}
        palette={palette}
        particleCount={particleCount}
        dimmed={chromeDimmed && !(interactionMode === 'layout' && layoutEditorOpen)}
        inputRef={inputRef}
        onInputChange={handleInputChange}
        onSubmitText={handleSubmitText}
        onSelectPrompt={handleSelectPrompt}
        onSelectImagePreset={handleSelectImagePreset}
        onUploadImageFile={loadUploadedImage}
        onToggleInvertImage={handleToggleInvertImage}
        onSelectLayoutPreset={handleSelectLayoutPreset}
        onToggleLayoutEditor={handleToggleLayoutEditor}
        onUpdateImageTuning={handleUpdateImageTuning}
        onUpdatePhysics={handleUpdatePhysics}
        onUpdateRipple={handleUpdateRipple}
        onResetPhysics={handleResetPhysics}
        onSelectPalette={handleSelectPalette}
        onTuningOpenChange={handleTuningOpenChange}
        onWakeChrome={wakeChrome}
      />
    </main>
  );
}
