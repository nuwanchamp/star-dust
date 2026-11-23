import { a as perlin3, i as PerlinWindField, n as createParticlePool, o as collectLayoutImageRefs, r as resizeParticlePool, s as parseLayoutMarkup, t as computeWavePoint } from "./particlePool-DJRulufD.js";
import { a as pickGestureReply, i as generateDialogueReply, n as DIALOGUE_PROMPTS, r as OPENING_MESSAGE, t as CLICK_CYCLE_BEATS } from "./core-CBuF0NJu.js";
import { a as DEFAULT_IMAGE_TUNING, i as defaultLayoutImageUrl, n as DEFAULT_RIPPLE, o as PALETTE_THEMES, r as StarDust, t as DEFAULT_PHYSICS } from "./StarDust-CGxkT9aq.js";
// src/engine/ambientSoundEngine.ts
var PALETTE_HARMONIES = {
	aurora: {
		droneHz: [
			73.42,
			110,
			164.81,
			220,
			277.18
		],
		scaleHz: [
			293.66,
			329.63,
			369.99,
			440,
			554.37,
			587.33,
			659.25
		]
	},
	sunbeam: {
		droneHz: [
			87.31,
			130.81,
			196,
			261.63,
			329.63
		],
		scaleHz: [
			349.23,
			392,
			440,
			523.25,
			659.25,
			698.46,
			783.99
		]
	},
	moonlit: {
		droneHz: [
			65.41,
			98,
			146.83,
			196,
			233.08
		],
		scaleHz: [
			261.63,
			293.66,
			311.13,
			392,
			466.16,
			523.25,
			587.33
		]
	},
	alabaster: {
		droneHz: [
			98,
			146.83,
			220,
			293.66,
			369.99
		],
		scaleHz: [
			293.66,
			329.63,
			392,
			440,
			493.88,
			587.33,
			659.25
		]
	}
};
function createPinkNoiseBuffer(ctx, seconds = 3) {
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
			b0 = .99886 * b0 + white * .0555179;
			b1 = .99332 * b1 + white * .0750759;
			b2 = .969 * b2 + white * .153852;
			b3 = .8665 * b3 + white * .3104856;
			b4 = .55 * b4 + white * .5329522;
			b5 = -.7616 * b5 - white * .016898;
			const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * .5362) * .045;
			b6 = white * .115926;
			data[i] = sample;
		}
		const fadeLen = Math.min(2048, Math.floor(length * .05));
		for (let i = 0; i < fadeLen; i++) {
			const t = i / fadeLen;
			const tailIdx = length - fadeLen + i;
			data[i] = data[i] * t + data[tailIdx] * (1 - t);
		}
	}
	return buffer;
}
var AmbientSoundEngine = class {
	constructor() {
		this.ctx = null;
		this.masterGain = null;
		this.dryGain = null;
		this.delayInput = null;
		this.padFilter = null;
		this.airBandpass = null;
		this.airGain = null;
		this.voices = [];
		this.lfoOsc = null;
		this.muted = false;
		this.disposed = false;
		this.lastPalette = "aurora";
		this.lastChimeAt = 0;
		this.suspendTimer = null;
		this.latestMetrics = {
			particleCount: 1500,
			avgVelocity: .15,
			avgEnergy: 0,
			isFreeDrift: true,
			palette: "aurora"
		};
	}
	isMuted() {
		return this.muted;
	}
	ensureGraph() {
		if (this.disposed || typeof window === "undefined") return null;
		if (this.ctx) return this.ctx;
		const AudioCtx = window.AudioContext || window.webkitAudioContext;
		if (!AudioCtx) return null;
		try {
			const ctx = new AudioCtx();
			this.ctx = ctx;
			const compressor = ctx.createDynamicsCompressor();
			compressor.threshold.value = -18;
			compressor.knee.value = 24;
			compressor.ratio.value = 4;
			compressor.attack.value = .025;
			compressor.release.value = .25;
			const masterGain = ctx.createGain();
			masterGain.gain.value = 0;
			masterGain.connect(compressor);
			compressor.connect(ctx.destination);
			this.masterGain = masterGain;
			const dryGain = ctx.createGain();
			dryGain.gain.value = .85;
			dryGain.connect(masterGain);
			this.dryGain = dryGain;
			const delayInput = ctx.createGain();
			delayInput.gain.value = .42;
			this.delayInput = delayInput;
			const delayL = ctx.createDelay(1);
			const delayR = ctx.createDelay(1);
			delayL.delayTime.value = .31;
			delayR.delayTime.value = .43;
			const fbFilter = ctx.createBiquadFilter();
			fbFilter.type = "lowpass";
			fbFilter.frequency.value = 1350;
			const fbGain = ctx.createGain();
			fbGain.gain.value = .34;
			const merger = ctx.createChannelMerger(2);
			const wetGain = ctx.createGain();
			wetGain.gain.value = .44;
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
			const padFilter = ctx.createBiquadFilter();
			padFilter.type = "lowpass";
			padFilter.frequency.value = 460;
			padFilter.Q.value = .85;
			padFilter.connect(dryGain);
			padFilter.connect(delayInput);
			this.padFilter = padFilter;
			const harmony = PALETTE_HARMONIES[this.lastPalette];
			const pans = [
				0,
				-.28,
				.28,
				-.45,
				.45
			];
			const baseGains = [
				.16,
				.13,
				.08,
				.04,
				.02
			];
			for (let i = 0; i < 5; i++) {
				const oscA = ctx.createOscillator();
				const oscB = ctx.createOscillator();
				oscA.type = i === 0 ? "sine" : "triangle";
				oscB.type = "sine";
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
				this.voices.push({
					oscA,
					oscB,
					gain,
					panner
				});
			}
			const lfoOsc = ctx.createOscillator();
			lfoOsc.type = "sine";
			lfoOsc.frequency.value = .085;
			const lfoDepth = ctx.createGain();
			lfoDepth.gain.value = 55;
			lfoOsc.connect(lfoDepth);
			lfoDepth.connect(padFilter.frequency);
			lfoOsc.start();
			this.lfoOsc = lfoOsc;
			const noiseBuf = createPinkNoiseBuffer(ctx, 3);
			const noiseSrc = ctx.createBufferSource();
			noiseSrc.buffer = noiseBuf;
			noiseSrc.loop = true;
			const airBandpass = ctx.createBiquadFilter();
			airBandpass.type = "bandpass";
			airBandpass.frequency.value = 340;
			airBandpass.Q.value = 1.25;
			this.airBandpass = airBandpass;
			const airLowpass = ctx.createBiquadFilter();
			airLowpass.type = "lowpass";
			airLowpass.frequency.value = 2200;
			const airGain = ctx.createGain();
			airGain.gain.value = .015;
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
	unlock() {
		if (this.disposed || this.muted) return;
		if (this.suspendTimer !== null) {
			window.clearTimeout(this.suspendTimer);
			this.suspendTimer = null;
		}
		const ctx = this.ensureGraph();
		if (!ctx || !this.masterGain) return;
		if (ctx.state === "suspended") ctx.resume().catch(() => {});
		const now = ctx.currentTime;
		this.masterGain.gain.setTargetAtTime(.19, now, .45);
		this.applyMetrics(this.latestMetrics);
	}
	setMuted(nextMuted) {
		this.muted = nextMuted;
		if (this.suspendTimer !== null) {
			window.clearTimeout(this.suspendTimer);
			this.suspendTimer = null;
		}
		if (nextMuted) {
			const ctx = this.ctx;
			const master = this.masterGain;
			if (ctx && master) {
				master.gain.setTargetAtTime(0, ctx.currentTime, .08);
				this.suspendTimer = window.setTimeout(() => {
					if (this.muted && this.ctx && this.ctx.state === "running") this.ctx.suspend().catch(() => {});
				}, 380);
			}
		} else this.unlock();
	}
	updateMetrics(metrics) {
		this.latestMetrics = metrics;
		if (this.disposed || this.muted || !this.ctx || this.ctx.state !== "running") return;
		this.applyMetrics(metrics);
	}
	applyMetrics(metrics) {
		const ctx = this.ctx;
		if (!ctx || !this.padFilter || !this.airBandpass || !this.airGain) return;
		const now = ctx.currentTime;
		const normCount = Math.max(0, Math.min(1, (metrics.particleCount - 500) / 13500));
		const normVel = Math.max(0, Math.min(1, metrics.avgVelocity / 2.6));
		const normEnergy = Math.max(0, Math.min(1, metrics.avgEnergy * 1.4));
		const activity = Math.max(normVel, normEnergy * .85);
		if (metrics.palette !== this.lastPalette) {
			this.lastPalette = metrics.palette;
			const nextHz = PALETTE_HARMONIES[metrics.palette].droneHz;
			for (let i = 0; i < this.voices.length; i++) {
				this.voices[i].oscA.frequency.setTargetAtTime(nextHz[i], now, .75);
				this.voices[i].oscB.frequency.setTargetAtTime(nextHz[i], now, .75);
			}
		}
		const voiceTargets = [
			.13 + normCount * .13,
			.11 + normCount * .11,
			.04 + normCount * .12 + activity * .04,
			.015 + normCount * .11 + activity * .05,
			normCount * .075 + activity * .085
		];
		for (let i = 0; i < this.voices.length; i++) this.voices[i].gain.gain.setTargetAtTime(voiceTargets[i], now, .35);
		const targetCutoff = (metrics.isFreeDrift ? 410 : 310) + normCount * 240 + activity * 1550;
		this.padFilter.frequency.setTargetAtTime(targetCutoff, now, .22);
		const airFreq = 260 + normCount * 160 + activity * 1450;
		const airLevel = .01 + normCount * .015 + activity * .135;
		this.airBandpass.frequency.setTargetAtTime(airFreq, now, .18);
		this.airGain.gain.setTargetAtTime(airLevel, now, .18);
	}
	triggerChime(intensity = .6, normX = .5) {
		if (this.disposed || this.muted || !this.ctx || this.ctx.state !== "running") return;
		if (!this.dryGain || !this.delayInput) return;
		const nowMs = performance.now();
		if (nowMs - this.lastChimeAt < 175) return;
		this.lastChimeAt = nowMs;
		const ctx = this.ctx;
		const now = ctx.currentTime;
		const scale = PALETTE_HARMONIES[this.lastPalette].scaleHz;
		const clampedX = Math.max(0, Math.min(1, normX));
		const freq = scale[Math.min(scale.length - 1, Math.floor(clampedX * scale.length))];
		const osc = ctx.createOscillator();
		const overtone = ctx.createOscillator();
		osc.type = "sine";
		overtone.type = "triangle";
		osc.frequency.value = freq;
		overtone.frequency.value = freq * 2;
		const env = ctx.createGain();
		const peak = Math.max(.012, Math.min(.05, .018 + intensity * .032));
		env.gain.setValueAtTime(1e-4, now);
		env.gain.linearRampToValueAtTime(peak, now + .025);
		env.gain.exponentialRampToValueAtTime(1e-4, now + 1.85);
		const overtoneGain = ctx.createGain();
		overtoneGain.gain.value = .22;
		const panner = ctx.createStereoPanner();
		panner.pan.value = (clampedX - .5) * 1.25;
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
	dispose() {
		this.disposed = true;
		if (this.suspendTimer !== null) {
			window.clearTimeout(this.suspendTimer);
			this.suspendTimer = null;
		}
		try {
			this.lfoOsc?.stop();
		} catch {}
		for (const v of this.voices) try {
			v.oscA.stop();
			v.oscB.stop();
		} catch {}
		this.voices = [];
		if (this.ctx) {
			this.ctx.close().catch(() => {});
			this.ctx = null;
		}
	}
};
export { AmbientSoundEngine, CLICK_CYCLE_BEATS, DEFAULT_IMAGE_TUNING, DEFAULT_PHYSICS, DEFAULT_RIPPLE, DIALOGUE_PROMPTS, OPENING_MESSAGE, PALETTE_THEMES, PerlinWindField, StarDust, collectLayoutImageRefs, computeWavePoint, createParticlePool, defaultLayoutImageUrl, generateDialogueReply, parseLayoutMarkup, perlin3, pickGestureReply, resizeParticlePool };

//# sourceMappingURL=index.js.map