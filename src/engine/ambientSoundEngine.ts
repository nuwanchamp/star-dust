import type { PaletteMode } from '../types/mote';

export interface AmbientMetrics {
  particleCount: number;
  avgVelocity: number;
  avgEnergy: number;
  isFreeDrift: boolean;
  palette: PaletteMode;
}

interface PaletteHarmony {
  droneHz: [number, number, number, number, number];
  scaleHz: number[];
}

const PALETTE_HARMONIES: Record<PaletteMode, PaletteHarmony> = {
  aurora: {
    droneHz: [73.42, 110.0, 164.81, 220.0, 277.18], // Dmaj9
    scaleHz: [293.66, 329.63, 369.99, 440.0, 554.37, 587.33, 659.25],
  },
  sunbeam: {
    droneHz: [87.31, 130.81, 196.0, 261.63, 329.63], // Fmaj9
    scaleHz: [349.23, 392.0, 440.0, 523.25, 659.25, 698.46, 783.99],
  },
  moonlit: {
    droneHz: [65.41, 98.0, 146.83, 196.0, 233.08], // Cmin9
    scaleHz: [261.63, 293.66, 311.13, 392.0, 466.16, 523.25, 587.33],
  },
  alabaster: {
    droneHz: [98.0, 146.83, 220.0, 293.66, 369.99], // Gsus2 / Lydian felt warmth
    scaleHz: [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25],
  },
};

interface DroneVoice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

function createPinkNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
      data[i] = sample;
    }

    // Crossfade end into start for seamless loop
    const fadeLen = Math.min(2048, Math.floor(length * 0.05));
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      const tailIdx = length - fadeLen + i;
      data[i] = data[i] * t + data[tailIdx] * (1 - t);
    }
  }

  return buffer;
}

export class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private delayInput: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private airBandpass: BiquadFilterNode | null = null;
  private airGain: GainNode | null = null;
  private voices: DroneVoice[] = [];
  private lfoOsc: OscillatorNode | null = null;

  private muted = false;
  private disposed = false;
  private lastPalette: PaletteMode = 'aurora';
  private lastChimeAt = 0;
  private suspendTimer: number | null = null;
  private latestMetrics: AmbientMetrics = {
    particleCount: 1500,
    avgVelocity: 0.15,
    avgEnergy: 0,
    isFreeDrift: true,
    palette: 'aurora',
  };

  isMuted(): boolean {
    return this.muted;
  }

  private ensureGraph(): AudioContext | null {
    if (this.disposed || typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 24;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.025;
      compressor.release.value = 0.25;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(compressor);
      compressor.connect(ctx.destination);
      this.masterGain = masterGain;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 0.85;
      dryGain.connect(masterGain);
      this.dryGain = dryGain;

      // Stereo organic delay space loop
      const delayInput = ctx.createGain();
      delayInput.gain.value = 0.42;
      this.delayInput = delayInput;

      const delayL = ctx.createDelay(1.0);
      const delayR = ctx.createDelay(1.0);
      delayL.delayTime.value = 0.31;
      delayR.delayTime.value = 0.43;

      const fbFilter = ctx.createBiquadFilter();
      fbFilter.type = 'lowpass';
      fbFilter.frequency.value = 1350;

      const fbGain = ctx.createGain();
      fbGain.gain.value = 0.34;

      const merger = ctx.createChannelMerger(2);
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.44;

      delayInput.connect(delayL);
      delayInput.connect(delayR);
      delayL.connect(fbFilter);
      fbFilter.connect(fbGain);
      fbGain.connect(delayR);
      delayR.connect(delayL);

      delayL.connect(merger, 0, 0);
      delayR.connect(merger, 0, 1);
      merger.connect(wetGain);
      wetGain.connect(masterGain);

      // Warm harmonic drone bed routed through modulated lowpass filter
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 460;
      padFilter.Q.value = 0.85;
      padFilter.connect(dryGain);
      padFilter.connect(delayInput);
      this.padFilter = padFilter;

      const harmony = PALETTE_HARMONIES[this.lastPalette];
      const pans = [0, -0.28, 0.28, -0.45, 0.45];
      const baseGains = [0.16, 0.13, 0.08, 0.04, 0.02];

      for (let i = 0; i < 5; i++) {
        const oscA = ctx.createOscillator();
        const oscB = ctx.createOscillator();
        oscA.type = i === 0 ? 'sine' : 'triangle';
        oscB.type = 'sine';

        const freq = harmony.droneHz[i];
        oscA.frequency.value = freq;
        oscB.frequency.value = freq;
        oscA.detune.value = i % 2 === 0 ? -4 : 4;
        oscB.detune.value = i % 2 === 0 ? 5.5 : -5.5;

        const gain = ctx.createGain();
        gain.gain.value = baseGains[i];

        const panner = ctx.createStereoPanner();
        panner.pan.value = pans[i];

        oscA.connect(gain);
        oscB.connect(gain);
        gain.connect(panner);
        panner.connect(padFilter);

        oscA.start();
        oscB.start();
        this.voices.push({ oscA, oscB, gain, panner });
      }

      // Organic slow breathing LFO
      const lfoOsc = ctx.createOscillator();
      lfoOsc.type = 'sine';
      lfoOsc.frequency.value = 0.085;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 55;
      lfoOsc.connect(lfoDepth);
      lfoDepth.connect(padFilter.frequency);
      lfoOsc.start();
      this.lfoOsc = lfoOsc;

      // Kinetic breath / shimmer noise layer driven by particle velocity
      const noiseBuf = createPinkNoiseBuffer(ctx, 3);
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const airBandpass = ctx.createBiquadFilter();
      airBandpass.type = 'bandpass';
      airBandpass.frequency.value = 340;
      airBandpass.Q.value = 1.25;
      this.airBandpass = airBandpass;

      const airLowpass = ctx.createBiquadFilter();
      airLowpass.type = 'lowpass';
      airLowpass.frequency.value = 2200;

      const airGain = ctx.createGain();
      airGain.gain.value = 0.015;
      this.airGain = airGain;

      noiseSrc.connect(airBandpass);
      airBandpass.connect(airLowpass);
      airLowpass.connect(airGain);
      airGain.connect(dryGain);
      airGain.connect(delayInput);
      noiseSrc.start();

      return ctx;
    } catch {
      return null;
    }
  }

  unlock(): void {
    if (this.disposed || this.muted) return;
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }

    const ctx = this.ensureGraph();
    if (!ctx || !this.masterGain) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(0.19, now, 0.45);
    this.applyMetrics(this.latestMetrics);
  }

  setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }

    if (nextMuted) {
      const ctx = this.ctx;
      const master = this.masterGain;
      if (ctx && master) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        this.suspendTimer = window.setTimeout(() => {
          if (this.muted && this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
          }
        }, 380);
      }
    } else {
      this.unlock();
    }
  }

  updateMetrics(metrics: AmbientMetrics): void {
    this.latestMetrics = metrics;
    if (this.disposed || this.muted || !this.ctx || this.ctx.state !== 'running') {
      return;
    }
    this.applyMetrics(metrics);
  }

  private applyMetrics(metrics: AmbientMetrics): void {
    const ctx = this.ctx;
    if (!ctx || !this.padFilter || !this.airBandpass || !this.airGain) return;

    const now = ctx.currentTime;
    const normCount = Math.max(0, Math.min(1, (metrics.particleCount - 500) / 13500));
    const normVel = Math.max(0, Math.min(1, metrics.avgVelocity / 2.6));
    const normEnergy = Math.max(0, Math.min(1, metrics.avgEnergy * 1.4));
    const activity = Math.max(normVel, normEnergy * 0.85);

    // Retune harmonic voices smoothly when switching atmosphere palettes
    if (metrics.palette !== this.lastPalette) {
      this.lastPalette = metrics.palette;
      const nextHz = PALETTE_HARMONIES[metrics.palette].droneHz;
      for (let i = 0; i < this.voices.length; i++) {
        this.voices[i].oscA.frequency.setTargetAtTime(nextHz[i], now, 0.75);
        this.voices[i].oscB.frequency.setTargetAtTime(nextHz[i], now, 0.75);
      }
    }

    // Particle count governs harmonic density & sub-bass richness
    const voiceTargets = [
      0.13 + normCount * 0.13, // sub root
      0.11 + normCount * 0.11, // fifth
      0.04 + normCount * 0.12 + activity * 0.04, // upper color tone
      0.015 + normCount * 0.11 + activity * 0.05, // octave
      normCount * 0.075 + activity * 0.085, // ninth/seventh shimmer
    ];

    for (let i = 0; i < this.voices.length; i++) {
      this.voices[i].gain.gain.setTargetAtTime(voiceTargets[i], now, 0.35);
    }

    // Velocity opens harmonic filter cutoff & breathes through filtered pink air
    const driftBase = metrics.isFreeDrift ? 410 : 310;
    const targetCutoff = driftBase + normCount * 240 + activity * 1550;
    this.padFilter.frequency.setTargetAtTime(targetCutoff, now, 0.22);

    const airFreq = 260 + normCount * 160 + activity * 1450;
    const airLevel = 0.01 + normCount * 0.015 + activity * 0.135;
    this.airBandpass.frequency.setTargetAtTime(airFreq, now, 0.18);
    this.airGain.gain.setTargetAtTime(airLevel, now, 0.18);
  }

  triggerChime(intensity = 0.6, normX = 0.5): void {
    if (this.disposed || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    if (!this.dryGain || !this.delayInput) return;

    const nowMs = performance.now();
    if (nowMs - this.lastChimeAt < 175) return;
    this.lastChimeAt = nowMs;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const scale = PALETTE_HARMONIES[this.lastPalette].scaleHz;
    const clampedX = Math.max(0, Math.min(1, normX));
    const idx = Math.min(scale.length - 1, Math.floor(clampedX * scale.length));
    const freq = scale[idx];

    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    osc.type = 'sine';
    overtone.type = 'triangle';
    osc.frequency.value = freq;
    overtone.frequency.value = freq * 2.0;

    const env = ctx.createGain();
    const peak = Math.max(0.012, Math.min(0.05, 0.018 + intensity * 0.032));
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.22;

    const panner = ctx.createStereoPanner();
    panner.pan.value = (clampedX - 0.5) * 1.25;

    osc.connect(env);
    overtone.connect(overtoneGain);
    overtoneGain.connect(env);
    env.connect(panner);
    panner.connect(this.dryGain);
    panner.connect(this.delayInput);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 1.9);
    overtone.stop(now + 1.9);
  }

  dispose(): void {
    this.disposed = true;
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    try {
      this.lfoOsc?.stop();
    } catch {
      // ignore if already stopped
    }
    for (const v of this.voices) {
      try {
        v.oscA.stop();
        v.oscB.stop();
      } catch {
        // ignore if already stopped
      }
    }
    this.voices = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
