import { i as PerlinWindField, n as createParticlePool, o as collectLayoutImageRefs, r as resizeParticlePool, t as computeWavePoint } from "./particlePool-T4zWJvz1.js";
// src/engine/dustAtlas.ts
var PALETTE_THEMES = {
	aurora: {
		id: "aurora",
		label: "Aurora",
		isDark: true,
		bgHex: "#030306",
		mistInner: "rgba(59, 130, 246, 0.045)",
		mistMid: "rgba(139, 92, 246, 0.024)",
		shockwaveRgb: "103, 232, 249",
		stops: [
			[
				192,
				38,
				211
			],
			[
				168,
				85,
				247
			],
			[
				124,
				58,
				237
			],
			[
				79,
				70,
				229
			],
			[
				37,
				99,
				235
			],
			[
				59,
				130,
				246
			],
			[
				14,
				165,
				233
			],
			[
				34,
				211,
				238
			],
			[
				103,
				232,
				249
			],
			[
				186,
				230,
				253
			],
			[
				224,
				231,
				255
			],
			[
				244,
				246,
				255
			]
		]
	},
	sunbeam: {
		id: "sunbeam",
		label: "Sunbeam",
		isDark: true,
		bgHex: "#060504",
		mistInner: "rgba(217, 119, 6, 0.048)",
		mistMid: "rgba(180, 83, 9, 0.022)",
		shockwaveRgb: "252, 211, 77",
		stops: [
			[
				146,
				64,
				14
			],
			[
				180,
				83,
				9
			],
			[
				217,
				119,
				6
			],
			[
				234,
				179,
				8
			],
			[
				245,
				196,
				81
			],
			[
				253,
				224,
				132
			],
			[
				254,
				243,
				199
			],
			[
				255,
				251,
				240
			]
		]
	},
	moonlit: {
		id: "moonlit",
		label: "Moonlit",
		isDark: true,
		bgHex: "#04060A",
		mistInner: "rgba(148, 163, 184, 0.045)",
		mistMid: "rgba(71, 85, 105, 0.024)",
		shockwaveRgb: "203, 213, 225",
		stops: [
			[
				71,
				85,
				105
			],
			[
				100,
				116,
				139
			],
			[
				148,
				163,
				184
			],
			[
				186,
				200,
				219
			],
			[
				219,
				230,
				244
			],
			[
				241,
				245,
				249
			],
			[
				248,
				250,
				252
			]
		]
	},
	alabaster: {
		id: "alabaster",
		label: "Alabaster",
		isDark: false,
		bgHex: "#F7F5F0",
		mistInner: "rgba(79, 70, 229, 0.03)",
		mistMid: "rgba(100, 116, 139, 0.015)",
		shockwaveRgb: "67, 56, 202",
		stops: [
			[
				134,
				25,
				143
			],
			[
				109,
				40,
				217
			],
			[
				67,
				56,
				202
			],
			[
				29,
				78,
				216
			],
			[
				3,
				105,
				161
			],
			[
				15,
				118,
				110
			],
			[
				39,
				39,
				42
			],
			[
				24,
				24,
				27
			]
		]
	}
};
// src/engine/webglDustRenderer.ts
var VERTEX_SHADER_BG = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_quad;
out vec2 v_uv;
void main() {
  v_uv = a_quad * 0.5 + 0.5;
  gl_Position = vec4(a_quad, 0.0, 1.0);
}
`;
var FRAGMENT_SHADER_BG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform vec3 u_bgColor;
uniform vec3 u_mistInner;
uniform vec3 u_mistMid;
uniform float u_mistScale;
uniform vec3 u_shockColor;
uniform vec4 u_shockwaves[4]; // x, y, radius, alpha
out vec4 outColor;

void main() {
  vec2 px = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
  vec2 mistCenter = vec2(u_resolution.x * 0.46, u_resolution.y * 0.48);
  float maxDim = max(u_resolution.x, u_resolution.y) * 0.58;
  float distNorm = clamp(length(px - mistCenter) / max(1.0, maxDim), 0.0, 1.0);

  vec3 col = u_bgColor;
  float w1 = smoothstep(0.5, 0.0, distNorm) * u_mistScale;
  float w2 = smoothstep(1.0, 0.2, distNorm) * (u_mistScale * 0.52);
  col = mix(col, col + u_mistInner, w1);
  col = mix(col, col + u_mistMid, w2);

  for (int i = 0; i < 4; i++) {
    vec4 sw = u_shockwaves[i];
    if (sw.w > 0.005) {
      float d = abs(length(px - sw.xy) - sw.z);
      float ring = smoothstep(1.2, 0.0, d) * sw.w;
      col = mix(col, u_shockColor, clamp(ring, 0.0, 0.6));
    }
  }

  outColor = vec4(col, 1.0);
}
`;
var VERTEX_SHADER_PARTICLES = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec4 a_color;
layout(location = 2) in float a_size;
layout(location = 3) in float a_motion;

uniform vec2 u_resolution;
uniform float u_dpr;
uniform float u_trailMode;

out vec4 v_color;
out float v_motion;

void main() {
  vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_motion = clamp(a_motion, 0.0, 1.5);
  float sizeScale = u_trailMode > 0.5 ? (1.15 + v_motion * 1.15) : 1.0;
  gl_PointSize = clamp(a_size * u_dpr * sizeScale, 1.0, 44.0);
  v_color = a_color;
}
`;
var FRAGMENT_SHADER_PARTICLES = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_motion;
uniform float u_trailMode;
out vec4 outColor;

void main() {
  vec2 cxy = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(cxy, cxy);
  if (r2 > 1.0) discard;

  if (u_trailMode > 0.5) {
    float trailWeight = smoothstep(0.06, 0.72, v_motion);
    if (trailWeight <= 0.002) discard;

    float core = exp(-r2 * 2.35);
    float halo = smoothstep(1.0, 0.05, sqrt(r2)) * 0.34;
    float alpha = clamp((core * 0.68 + halo * 0.32) * v_color.a * trailWeight * 0.62, 0.0, 1.0);
    outColor = vec4(v_color.rgb * alpha, alpha);
    return;
  }

  // Crisp luminous dust core with smooth feathered halo (zero pixel-grid aliasing)
  float core = exp(-r2 * 5.2);
  float halo = smoothstep(1.0, 0.2, sqrt(r2)) * 0.22;
  float alpha = clamp((core + halo) * v_color.a, 0.0, 1.0);

  // Premultiplied alpha output works seamlessly for both additive & light-mode blending
  outColor = vec4(v_color.rgb * alpha, alpha);
}
`;
var FRAGMENT_SHADER_DECAY = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_prevTex;
uniform float u_decay;
out vec4 outColor;

void main() {
  vec4 prev = texture(u_prevTex, v_uv);
  // Subtle subtraction avoids 8-bit quantization ghosting at low intensities
  outColor = max(vec4(0.0), prev * u_decay - vec4(0.0024));
}
`;
var FRAGMENT_SHADER_EXTRACT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_sceneTex;
uniform sampler2D u_trailTex;
uniform float u_isDark;
out vec4 outColor;

void main() {
  vec3 sceneCol = texture(u_sceneTex, v_uv).rgb;
  vec4 trailCol = texture(u_trailTex, v_uv);

  if (u_isDark > 0.5) {
    float lum = dot(sceneCol, vec3(0.2126, 0.7152, 0.0722));
    float highlight = smoothstep(0.16, 0.62, lum);
    vec3 bloomSrc = sceneCol * (highlight * 0.72) + trailCol.rgb * 1.15;
    outColor = vec4(bloomSrc, clamp(trailCol.a + highlight * 0.5, 0.0, 1.0));
  } else {
    // On light parchment, bloom only active pigment trails so the paper stays clean
    outColor = vec4(trailCol.rgb * 0.9, trailCol.a);
  }
}
`;
var FRAGMENT_SHADER_BLUR = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_srcTex;
uniform vec2 u_texelStep;
out vec4 outColor;

void main() {
  vec4 acc = texture(u_srcTex, v_uv) * 0.227027;
  acc += texture(u_srcTex, v_uv + u_texelStep * 1.0) * 0.194595;
  acc += texture(u_srcTex, v_uv - u_texelStep * 1.0) * 0.194595;
  acc += texture(u_srcTex, v_uv + u_texelStep * 2.0) * 0.121622;
  acc += texture(u_srcTex, v_uv - u_texelStep * 2.0) * 0.121622;
  acc += texture(u_srcTex, v_uv + u_texelStep * 3.0) * 0.054054;
  acc += texture(u_srcTex, v_uv - u_texelStep * 3.0) * 0.054054;
  acc += texture(u_srcTex, v_uv + u_texelStep * 4.0) * 0.016216;
  acc += texture(u_srcTex, v_uv - u_texelStep * 4.0) * 0.016216;
  outColor = acc;
}
`;
var FRAGMENT_SHADER_COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_sceneTex;
uniform sampler2D u_trailTex;
uniform sampler2D u_blurTex;
uniform float u_isDark;
out vec4 outColor;

void main() {
  vec3 sceneCol = texture(u_sceneTex, v_uv).rgb;
  vec4 trailCol = texture(u_trailTex, v_uv);
  vec4 blurCol = texture(u_blurTex, v_uv);

  if (u_isDark > 0.5) {
    vec3 glow = trailCol.rgb * 0.46 + blurCol.rgb * 0.94;
    // Soft highlight rolloff prevents harsh clipping while preserving ethereal luminosity
    vec3 outRgb = sceneCol + glow * (1.0 - sceneCol * 0.22);
    outColor = vec4(clamp(outRgb, 0.0, 1.0), 1.0);
  } else {
    float density = clamp(trailCol.a * 0.34 + blurCol.a * 0.42, 0.0, 0.56);
    vec3 accumRgb = trailCol.rgb * 0.45 + blurCol.rgb * 0.78;
    float accumAlpha = max(trailCol.a * 0.45 + blurCol.a * 0.78, 0.001);
    vec3 tint = clamp(accumRgb / accumAlpha, 0.0, 1.0);
    outColor = vec4(mix(sceneCol, tint, density), 1.0);
  }
}
`;
var VERTEX_SHADER_LINES = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec4 a_color;
uniform vec2 u_resolution;
out vec4 v_color;

void main() {
  vec2 ndc = (a_pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_color = a_color;
}
`;
var FRAGMENT_SHADER_LINES = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;

void main() {
  outColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`;
function compileShader(gl, type, source) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Unable to allocate WebGL2 shader");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
		gl.deleteShader(shader);
		throw new Error(info);
	}
	return shader;
}
function createProgram(gl, vsSource, fsSource) {
	const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
	const prog = gl.createProgram();
	if (!prog) throw new Error("Unable to allocate WebGL2 program");
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(prog) || "Unknown program link error";
		gl.deleteProgram(prog);
		throw new Error(info);
	}
	return prog;
}
function createRenderTarget(gl, width, height) {
	const tex = gl.createTexture();
	const fbo = gl.createFramebuffer();
	if (!tex || !fbo) throw new Error("Unable to allocate WebGL2 post-process render target");
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
	gl.viewport(0, 0, width, height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	return {
		fbo,
		tex,
		width,
		height
	};
}
function deleteRenderTarget(gl, target) {
	if (!target) return;
	gl.deleteFramebuffer(target.fbo);
	gl.deleteTexture(target.tex);
}
function hexToVec3(hex) {
	const clean = hex.replace("#", "");
	const num = parseInt(clean, 16);
	return [
		(num >> 16 & 255) / 255,
		(num >> 8 & 255) / 255,
		(num & 255) / 255
	];
}
var paletteLutCache = /* @__PURE__ */ new Map();
function getPaletteLut(palette) {
	const existing = paletteLutCache.get(palette);
	if (existing) return existing;
	const stops = PALETTE_THEMES[palette].stops;
	const lut = /* @__PURE__ */ new Float32Array(768);
	for (let i = 0; i < 256; i++) {
		const scaled = i / 255 * (stops.length - 1);
		const idx = Math.floor(scaled);
		const frac = scaled - idx;
		const a = stops[idx];
		const b = stops[Math.min(stops.length - 1, idx + 1)];
		lut[i * 3 + 0] = (a[0] + (b[0] - a[0]) * frac) / 255;
		lut[i * 3 + 1] = (a[1] + (b[1] - a[1]) * frac) / 255;
		lut[i * 3 + 2] = (a[2] + (b[2] - a[2]) * frac) / 255;
	}
	paletteLutCache.set(palette, lut);
	return lut;
}
var WebGLDustRenderer = class {
	constructor(canvas) {
		this.bufferCapacityFloats = 0;
		this.lineBufferCapacityFloats = 0;
		this.sceneTarget = null;
		this.trailA = null;
		this.trailB = null;
		this.blurA = null;
		this.blurB = null;
		this.targetW = 0;
		this.targetH = 0;
		this.trailIndex = 0;
		this.prevBloomEnabled = false;
		this.lastPalette = null;
		this.shockwaveVec = /* @__PURE__ */ new Float32Array(16);
		const gl = canvas.getContext("webgl2", {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			powerPreference: "high-performance"
		});
		if (!gl) throw new Error("WebGL2 unavailable");
		this.gl = gl;
		this.bgProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_BG);
		this.ptProgram = createProgram(gl, VERTEX_SHADER_PARTICLES, FRAGMENT_SHADER_PARTICLES);
		this.lineProgram = createProgram(gl, VERTEX_SHADER_LINES, FRAGMENT_SHADER_LINES);
		this.decayProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_DECAY);
		this.extractProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_EXTRACT);
		this.blurProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_BLUR);
		this.compositeProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_COMPOSITE);
		this.uBgRes = gl.getUniformLocation(this.bgProgram, "u_resolution");
		this.uBgColor = gl.getUniformLocation(this.bgProgram, "u_bgColor");
		this.uMistInner = gl.getUniformLocation(this.bgProgram, "u_mistInner");
		this.uMistMid = gl.getUniformLocation(this.bgProgram, "u_mistMid");
		this.uMistScale = gl.getUniformLocation(this.bgProgram, "u_mistScale");
		this.uShockColor = gl.getUniformLocation(this.bgProgram, "u_shockColor");
		this.uShockwaves = gl.getUniformLocation(this.bgProgram, "u_shockwaves");
		this.uPtRes = gl.getUniformLocation(this.ptProgram, "u_resolution");
		this.uPtDpr = gl.getUniformLocation(this.ptProgram, "u_dpr");
		this.uPtTrailMode = gl.getUniformLocation(this.ptProgram, "u_trailMode");
		this.uLineRes = gl.getUniformLocation(this.lineProgram, "u_resolution");
		this.uDecayPrevTex = gl.getUniformLocation(this.decayProgram, "u_prevTex");
		this.uDecayFactor = gl.getUniformLocation(this.decayProgram, "u_decay");
		this.uExtractSceneTex = gl.getUniformLocation(this.extractProgram, "u_sceneTex");
		this.uExtractTrailTex = gl.getUniformLocation(this.extractProgram, "u_trailTex");
		this.uExtractIsDark = gl.getUniformLocation(this.extractProgram, "u_isDark");
		this.uBlurSrcTex = gl.getUniformLocation(this.blurProgram, "u_srcTex");
		this.uBlurTexelStep = gl.getUniformLocation(this.blurProgram, "u_texelStep");
		this.uCompSceneTex = gl.getUniformLocation(this.compositeProgram, "u_sceneTex");
		this.uCompTrailTex = gl.getUniformLocation(this.compositeProgram, "u_trailTex");
		this.uCompBlurTex = gl.getUniformLocation(this.compositeProgram, "u_blurTex");
		this.uCompIsDark = gl.getUniformLocation(this.compositeProgram, "u_isDark");
		const bgVao = gl.createVertexArray();
		const bgVbo = gl.createBuffer();
		if (!bgVao || !bgVbo) throw new Error("Unable to create WebGL2 background buffers");
		this.bgVao = bgVao;
		this.bgVbo = bgVbo;
		gl.bindVertexArray(bgVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, bgVbo);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1,
			-1,
			1,
			-1,
			-1,
			1,
			1,
			1
		]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		const ptVao = gl.createVertexArray();
		const ptVbo = gl.createBuffer();
		if (!ptVao || !ptVbo) throw new Error("Unable to create WebGL2 particle buffers");
		this.ptVao = ptVao;
		this.ptVbo = ptVbo;
		const stride = 32;
		gl.bindVertexArray(ptVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, ptVbo);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 8);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);
		gl.enableVertexAttribArray(3);
		gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 28);
		gl.bindVertexArray(null);
		const lineVao = gl.createVertexArray();
		const lineVbo = gl.createBuffer();
		if (!lineVao || !lineVbo) throw new Error("Unable to create WebGL2 constellation buffers");
		this.lineVao = lineVao;
		this.lineVbo = lineVbo;
		const lineStride = 24;
		gl.bindVertexArray(lineVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, lineStride, 0);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, lineStride, 8);
		gl.bindVertexArray(null);
	}
	ensureTargets(pw, ph) {
		if (this.targetW === pw && this.targetH === ph && this.sceneTarget) return;
		const gl = this.gl;
		this.releaseTargets();
		const hw = Math.max(2, pw >> 1);
		const hh = Math.max(2, ph >> 1);
		const qw = Math.max(2, pw >> 2);
		const qh = Math.max(2, ph >> 2);
		this.sceneTarget = createRenderTarget(gl, pw, ph);
		this.trailA = createRenderTarget(gl, hw, hh);
		this.trailB = createRenderTarget(gl, hw, hh);
		this.blurA = createRenderTarget(gl, qw, qh);
		this.blurB = createRenderTarget(gl, qw, qh);
		this.targetW = pw;
		this.targetH = ph;
		this.trailIndex = 0;
	}
	clearTrails() {
		const gl = this.gl;
		for (const target of [this.trailA, this.trailB]) {
			if (!target) continue;
			gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
			gl.viewport(0, 0, target.width, target.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	releaseTargets() {
		const gl = this.gl;
		deleteRenderTarget(gl, this.sceneTarget);
		deleteRenderTarget(gl, this.trailA);
		deleteRenderTarget(gl, this.trailB);
		deleteRenderTarget(gl, this.blurA);
		deleteRenderTarget(gl, this.blurB);
		this.sceneTarget = null;
		this.trailA = null;
		this.trailB = null;
		this.blurA = null;
		this.blurB = null;
		this.targetW = 0;
		this.targetH = 0;
	}
	drawBackground(width, height, palette, shockwaves) {
		const gl = this.gl;
		const meta = PALETTE_THEMES[palette];
		const bg = hexToVec3(meta.bgHex);
		gl.disable(gl.BLEND);
		gl.useProgram(this.bgProgram);
		gl.bindVertexArray(this.bgVao);
		gl.uniform2f(this.uBgRes, width, height);
		gl.uniform3f(this.uBgColor, bg[0], bg[1], bg[2]);
		if (palette === "aurora") {
			gl.uniform3f(this.uMistInner, .23, .51, .96);
			gl.uniform3f(this.uMistMid, .54, .36, .96);
			gl.uniform1f(this.uMistScale, .065);
			gl.uniform3f(this.uShockColor, .4, .91, .98);
		} else if (palette === "sunbeam") {
			gl.uniform3f(this.uMistInner, .85, .47, .02);
			gl.uniform3f(this.uMistMid, .7, .32, .04);
			gl.uniform1f(this.uMistScale, .06);
			gl.uniform3f(this.uShockColor, .98, .82, .3);
		} else if (palette === "moonlit") {
			gl.uniform3f(this.uMistInner, .58, .64, .72);
			gl.uniform3f(this.uMistMid, .28, .33, .41);
			gl.uniform1f(this.uMistScale, .055);
			gl.uniform3f(this.uShockColor, .8, .84, .9);
		} else {
			gl.uniform3f(this.uMistInner, -.02, -.025, .01);
			gl.uniform3f(this.uMistMid, -.01, -.01, 0);
			gl.uniform1f(this.uMistScale, .5);
			gl.uniform3f(this.uShockColor, .26, .22, .79);
		}
		this.shockwaveVec.fill(0);
		const swCount = Math.min(4, shockwaves.length);
		for (let i = 0; i < swCount; i++) {
			this.shockwaveVec[i * 4 + 0] = shockwaves[i].x;
			this.shockwaveVec[i * 4 + 1] = shockwaves[i].y;
			this.shockwaveVec[i * 4 + 2] = shockwaves[i].radius;
			this.shockwaveVec[i * 4 + 3] = shockwaves[i].alpha;
		}
		gl.uniform4fv(this.uShockwaves, this.shockwaveVec);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
	uploadParticles(vertexData, particleCount) {
		if (particleCount <= 0) return;
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.ptVbo);
		const neededFloats = particleCount * 8;
		if (neededFloats > this.bufferCapacityFloats) {
			this.bufferCapacityFloats = Math.ceil(neededFloats * 1.25);
			gl.bufferData(gl.ARRAY_BUFFER, this.bufferCapacityFloats * 4, gl.DYNAMIC_DRAW);
		}
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexData.subarray(0, neededFloats));
	}
	drawParticles(width, height, dpr, particleCount, isDark, trailMode) {
		if (particleCount <= 0) return;
		const gl = this.gl;
		gl.enable(gl.BLEND);
		if (trailMode || isDark) gl.blendFunc(gl.ONE, gl.ONE);
		else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(this.ptProgram);
		gl.bindVertexArray(this.ptVao);
		gl.uniform2f(this.uPtRes, width, height);
		gl.uniform1f(this.uPtDpr, dpr);
		gl.uniform1f(this.uPtTrailMode, trailMode ? 1 : 0);
		gl.drawArrays(gl.POINTS, 0, particleCount);
		gl.bindVertexArray(null);
	}
	uploadLines(lineData, lineVertexCount) {
		if (lineVertexCount <= 0) return;
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
		const neededFloats = lineVertexCount * 6;
		if (neededFloats > this.lineBufferCapacityFloats) {
			this.lineBufferCapacityFloats = Math.ceil(neededFloats * 1.25);
			gl.bufferData(gl.ARRAY_BUFFER, this.lineBufferCapacityFloats * 4, gl.DYNAMIC_DRAW);
		}
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineData.subarray(0, neededFloats));
	}
	drawLines(width, height, lineVertexCount, isDark) {
		if (lineVertexCount <= 0) return;
		const gl = this.gl;
		gl.enable(gl.BLEND);
		if (isDark) gl.blendFunc(gl.ONE, gl.ONE);
		else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(this.lineProgram);
		gl.bindVertexArray(this.lineVao);
		gl.uniform2f(this.uLineRes, width, height);
		gl.drawArrays(gl.LINES, 0, lineVertexCount);
		gl.bindVertexArray(null);
	}
	render(width, height, dpr, palette, shockwaves, vertexData, particleCount, enableBloom = true, lineVertexData, lineVertexCount = 0) {
		const gl = this.gl;
		const meta = PALETTE_THEMES[palette];
		const pw = Math.max(2, Math.floor(width * dpr));
		const ph = Math.max(2, Math.floor(height * dpr));
		this.uploadParticles(vertexData, particleCount);
		if (lineVertexData && lineVertexCount > 0) this.uploadLines(lineVertexData, lineVertexCount);
		if (!enableBloom) {
			this.prevBloomEnabled = false;
			this.lastPalette = palette;
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, pw, ph);
			this.drawBackground(width, height, palette, shockwaves);
			this.drawLines(width, height, lineVertexCount, meta.isDark);
			this.drawParticles(width, height, dpr, particleCount, meta.isDark, false);
			return;
		}
		this.ensureTargets(pw, ph);
		if (!this.prevBloomEnabled || this.lastPalette !== null && this.lastPalette !== palette) this.clearTrails();
		this.prevBloomEnabled = true;
		this.lastPalette = palette;
		const scene = this.sceneTarget;
		const srcTrail = this.trailIndex === 0 ? this.trailA : this.trailB;
		const dstTrail = this.trailIndex === 0 ? this.trailB : this.trailA;
		const blurA = this.blurA;
		const blurB = this.blurB;
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
		gl.viewport(0, 0, scene.width, scene.height);
		this.drawBackground(width, height, palette, shockwaves);
		this.drawLines(width, height, lineVertexCount, meta.isDark);
		this.drawParticles(width, height, dpr, particleCount, meta.isDark, false);
		gl.bindFramebuffer(gl.FRAMEBUFFER, dstTrail.fbo);
		gl.viewport(0, 0, dstTrail.width, dstTrail.height);
		gl.disable(gl.BLEND);
		gl.useProgram(this.decayProgram);
		gl.bindVertexArray(this.bgVao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, srcTrail.tex);
		gl.uniform1i(this.uDecayPrevTex, 0);
		gl.uniform1f(this.uDecayFactor, .875);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		this.drawParticles(width, height, dpr * .5, particleCount, meta.isDark, true);
		this.trailIndex = 1 - this.trailIndex;
		gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fbo);
		gl.viewport(0, 0, blurA.width, blurA.height);
		gl.disable(gl.BLEND);
		gl.useProgram(this.extractProgram);
		gl.bindVertexArray(this.bgVao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, scene.tex);
		gl.uniform1i(this.uExtractSceneTex, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, dstTrail.tex);
		gl.uniform1i(this.uExtractTrailTex, 1);
		gl.uniform1f(this.uExtractIsDark, meta.isDark ? 1 : 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		const runBlurPass = (src, dst, stepX, stepY) => {
			gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
			gl.viewport(0, 0, dst.width, dst.height);
			gl.useProgram(this.blurProgram);
			gl.bindVertexArray(this.bgVao);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, src.tex);
			gl.uniform1i(this.uBlurSrcTex, 0);
			gl.uniform2f(this.uBlurTexelStep, stepX, stepY);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		};
		const invQw = 1 / blurA.width;
		const invQh = 1 / blurA.height;
		runBlurPass(blurA, blurB, 1.35 * invQw, 0);
		runBlurPass(blurB, blurA, 0, 1.35 * invQh);
		runBlurPass(blurA, blurB, 2.75 * invQw, 0);
		runBlurPass(blurB, blurA, 0, 2.75 * invQh);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, pw, ph);
		gl.disable(gl.BLEND);
		gl.useProgram(this.compositeProgram);
		gl.bindVertexArray(this.bgVao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, scene.tex);
		gl.uniform1i(this.uCompSceneTex, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, dstTrail.tex);
		gl.uniform1i(this.uCompTrailTex, 1);
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
		gl.uniform1i(this.uCompBlurTex, 2);
		gl.uniform1f(this.uCompIsDark, meta.isDark ? 1 : 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.bindVertexArray(null);
	}
	dispose() {
		const gl = this.gl;
		this.releaseTargets();
		gl.deleteProgram(this.bgProgram);
		gl.deleteProgram(this.ptProgram);
		gl.deleteProgram(this.lineProgram);
		gl.deleteProgram(this.decayProgram);
		gl.deleteProgram(this.extractProgram);
		gl.deleteProgram(this.blurProgram);
		gl.deleteProgram(this.compositeProgram);
		gl.deleteVertexArray(this.bgVao);
		gl.deleteBuffer(this.bgVbo);
		gl.deleteVertexArray(this.ptVao);
		gl.deleteBuffer(this.ptVbo);
		gl.deleteVertexArray(this.lineVao);
		gl.deleteBuffer(this.lineVbo);
	}
};
var MAX_CONSTELLATION_NODES = 1400;
var MAX_CONSTELLATION_SEGMENTS = 4200;
var MAX_PER_CELL = 3;
var MAX_LINKS_PER_NODE = 6;
var ConstellationBuilder = class {
	constructor() {
		this.vertexData = new Float32Array(MAX_CONSTELLATION_SEGMENTS * 2 * 6);
		this.vertexCount = 0;
		this.cellHead = /* @__PURE__ */ new Int32Array(0);
		this.cellCount = /* @__PURE__ */ new Uint8Array(0);
		this.nodeParticleIdx = new Int32Array(MAX_CONSTELLATION_NODES);
		this.nodeCellX = new Int16Array(MAX_CONSTELLATION_NODES);
		this.nodeCellY = new Int16Array(MAX_CONSTELLATION_NODES);
		this.nodeNext = new Int32Array(MAX_CONSTELLATION_NODES);
		this.nodeLinks = new Uint8Array(MAX_CONSTELLATION_NODES);
	}
	build(particleVertices, particleCount, width, height, isDark) {
		this.vertexCount = 0;
		if (particleCount < 2 || width <= 0 || height <= 0) return 0;
		const maxDist = Math.min(104, Math.max(66, Math.min(width, height) * .095));
		const maxDistSq = maxDist * maxDist;
		const minDistSq = 121;
		const cellSize = maxDist * .5;
		const cols = Math.max(1, Math.ceil(width / cellSize) + 1);
		const rows = Math.max(1, Math.ceil(height / cellSize) + 1);
		const totalCells = cols * rows;
		if (this.cellHead.length < totalCells) {
			this.cellHead = new Int32Array(totalCells);
			this.cellCount = new Uint8Array(totalCells);
		}
		this.cellHead.fill(-1, 0, totalCells);
		this.cellCount.fill(0, 0, totalCells);
		const stride = Math.max(1, Math.floor(particleCount / MAX_CONSTELLATION_NODES));
		let nodeCount = 0;
		for (let i = 0; i < particleCount && nodeCount < MAX_CONSTELLATION_NODES; i += stride) {
			const off = i * 8;
			if (particleVertices[off + 5] < .08) continue;
			const x = particleVertices[off + 0];
			const y = particleVertices[off + 1];
			if (x < -maxDist || x > width + maxDist || y < -maxDist || y > height + maxDist) continue;
			const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cellSize)));
			const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cellSize)));
			const cellIdx = cy * cols + cx;
			const existingInCell = this.cellCount[cellIdx];
			if (existingInCell >= MAX_PER_CELL) continue;
			const slot = nodeCount++;
			this.nodeParticleIdx[slot] = i;
			this.nodeCellX[slot] = cx;
			this.nodeCellY[slot] = cy;
			this.nodeNext[slot] = this.cellHead[cellIdx];
			this.cellHead[cellIdx] = slot;
			this.cellCount[cellIdx] = existingInCell + 1;
			this.nodeLinks[slot] = 0;
		}
		if (nodeCount < 2) return 0;
		const lineBuf = this.vertexData;
		const baseOpacity = isDark ? .34 : .24;
		const maxSegAlpha = isDark ? .62 : .44;
		let segCount = 0;
		for (let a = 0; a < nodeCount && segCount < MAX_CONSTELLATION_SEGMENTS; a++) {
			if (this.nodeLinks[a] >= MAX_LINKS_PER_NODE) continue;
			const aOff = this.nodeParticleIdx[a] * 8;
			const ax = particleVertices[aOff + 0];
			const ay = particleVertices[aOff + 1];
			const ar = particleVertices[aOff + 2];
			const ag = particleVertices[aOff + 3];
			const ab = particleVertices[aOff + 4];
			const aAlpha = particleVertices[aOff + 5];
			const aMotion = particleVertices[aOff + 7];
			const cx = this.nodeCellX[a];
			const cy = this.nodeCellY[a];
			const xMin = Math.max(0, cx - 2);
			const xMax = Math.min(cols - 1, cx + 2);
			const yMin = Math.max(0, cy - 2);
			const yMax = Math.min(rows - 1, cy + 2);
			for (let ny = yMin; ny <= yMax && segCount < MAX_CONSTELLATION_SEGMENTS; ny++) {
				const rowOffset = ny * cols;
				for (let nx = xMin; nx <= xMax && segCount < MAX_CONSTELLATION_SEGMENTS; nx++) {
					let b = this.cellHead[rowOffset + nx];
					while (b !== -1) {
						if (b > a && this.nodeLinks[b] < MAX_LINKS_PER_NODE) {
							const bOff = this.nodeParticleIdx[b] * 8;
							const bx = particleVertices[bOff + 0];
							const by = particleVertices[bOff + 1];
							const dx = bx - ax;
							const dy = by - ay;
							const d2 = dx * dx + dy * dy;
							if (d2 >= minDistSq && d2 < maxDistSq) {
								const falloff = 1 - Math.sqrt(d2) / maxDist;
								const bAlpha = particleVertices[bOff + 5];
								const bMotion = particleVertices[bOff + 7];
								const energyBoost = 1 + Math.min(.85, (aMotion + bMotion) * .35);
								const segAlpha = Math.min(maxSegAlpha, falloff * falloff * baseOpacity * energyBoost * Math.min(aAlpha, bAlpha));
								if (segAlpha > .008) {
									const vOff = segCount * 2 * 6;
									lineBuf[vOff + 0] = ax;
									lineBuf[vOff + 1] = ay;
									lineBuf[vOff + 2] = ar;
									lineBuf[vOff + 3] = ag;
									lineBuf[vOff + 4] = ab;
									lineBuf[vOff + 5] = segAlpha;
									lineBuf[vOff + 6] = bx;
									lineBuf[vOff + 7] = by;
									lineBuf[vOff + 8] = particleVertices[bOff + 2];
									lineBuf[vOff + 9] = particleVertices[bOff + 3];
									lineBuf[vOff + 10] = particleVertices[bOff + 4];
									lineBuf[vOff + 11] = segAlpha;
									segCount++;
									this.nodeLinks[a]++;
									this.nodeLinks[b]++;
									if (this.nodeLinks[a] >= MAX_LINKS_PER_NODE || segCount >= MAX_CONSTELLATION_SEGMENTS) break;
								}
							}
						}
						b = this.nodeNext[b];
					}
					if (this.nodeLinks[a] >= MAX_LINKS_PER_NODE) break;
				}
			}
		}
		this.vertexCount = segCount * 2;
		return this.vertexCount;
	}
};
// src/engine/imageSampler.ts
var sourceBoundsCache = /* @__PURE__ */ new WeakMap();
function getImageSourceBounds(img) {
	const natW = img.naturalWidth || img.width;
	const natH = img.naturalHeight || img.height;
	if (!natW || !natH) return null;
	const cached = sourceBoundsCache.get(img);
	if (cached && cached.natW === natW && cached.natH === natH) return cached;
	const scanScale = Math.min(1, 480 / Math.max(natW, natH));
	const scanW = Math.max(32, Math.round(natW * scanScale));
	const scanH = Math.max(32, Math.round(natH * scanScale));
	const scanCanvas = document.createElement("canvas");
	scanCanvas.width = scanW;
	scanCanvas.height = scanH;
	const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
	if (!scanCtx) return {
		natW,
		natH,
		srcX: 0,
		srcY: 0,
		srcW: natW,
		srcH: natH,
		hasAlphaEmptySpace: false,
		aspectRatio: natW / natH
	};
	scanCtx.drawImage(img, 0, 0, scanW, scanH);
	let scanRgba;
	try {
		scanRgba = scanCtx.getImageData(0, 0, scanW, scanH).data;
	} catch {
		return null;
	}
	let minSX = scanW;
	let minSY = scanH;
	let maxSX = -1;
	let maxSY = -1;
	let transparentCount = 0;
	const totalScan = scanW * scanH;
	for (let y = 0; y < scanH; y++) {
		const row = y * scanW;
		for (let x = 0; x < scanW; x++) if (scanRgba[(row + x) * 4 + 3] > 12) {
			if (x < minSX) minSX = x;
			if (x > maxSX) maxSX = x;
			if (y < minSY) minSY = y;
			if (y > maxSY) maxSY = y;
		} else transparentCount++;
	}
	if (maxSX < minSX || maxSY < minSY) return null;
	const hasAlphaEmptySpace = transparentCount / totalScan > .015;
	let srcX = 0;
	let srcY = 0;
	let srcW = natW;
	let srcH = natH;
	if (hasAlphaEmptySpace) {
		const rawCropW = (maxSX - minSX + 1) / scanScale;
		const rawCropH = (maxSY - minSY + 1) / scanScale;
		const padX = rawCropW * .03;
		const padY = rawCropH * .03;
		srcX = Math.max(0, Math.floor(minSX / scanScale - padX));
		srcY = Math.max(0, Math.floor(minSY / scanScale - padY));
		const endX = Math.min(natW, Math.ceil((maxSX + 1) / scanScale + padX));
		const endY = Math.min(natH, Math.ceil((maxSY + 1) / scanScale + padY));
		srcW = Math.max(1, endX - srcX);
		srcH = Math.max(1, endY - srcY);
	}
	const resolved = {
		natW,
		natH,
		srcX,
		srcY,
		srcW,
		srcH,
		hasAlphaEmptySpace,
		aspectRatio: srcW / Math.max(1, srcH)
	};
	sourceBoundsCache.set(img, resolved);
	return resolved;
}
var DENSITY_TARGET_COUNT = {
	sparse: 14e3,
	balanced: 27e3,
	dense: 41e3
};
function clamp01(v) {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smoothstep(edge0, edge1, x) {
	const t = clamp01((x - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}
/**
* Separable box blur on Float32Array grayscale image.
*/
function boxBlur(src, w, h, radius) {
	const tmp = new Float32Array(w * h);
	const dst = new Float32Array(w * h);
	const invSpan = 1 / (radius * 2 + 1);
	for (let y = 0; y < h; y++) {
		const row = y * w;
		let sum = 0;
		for (let dx = -radius; dx <= radius; dx++) {
			const sx = Math.max(0, Math.min(w - 1, dx));
			sum += src[row + sx];
		}
		for (let x = 0; x < w; x++) {
			tmp[row + x] = sum * invSpan;
			const outX = Math.max(0, x - radius);
			const inX = Math.min(w - 1, x + radius + 1);
			sum += src[row + inX] - src[row + outX];
		}
	}
	for (let x = 0; x < w; x++) {
		let sum = 0;
		for (let dy = -radius; dy <= radius; dy++) {
			const sy = Math.max(0, Math.min(h - 1, dy));
			sum += tmp[sy * w + x];
		}
		for (let y = 0; y < h; y++) {
			dst[y * w + x] = sum * invSpan;
			const outY = Math.max(0, y - radius);
			const inY = Math.min(h - 1, y + radius + 1);
			sum += tmp[inY * w + x] - tmp[outY * w + x];
		}
	}
	return dst;
}
function loadImageElement(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(/* @__PURE__ */ new Error("Failed to load image"));
		img.src = src;
	});
}
/**
* Converts any image into a high-clarity monochrome halftone/contrast particle sculpture:
* 1. Trims screenshot outer bezels so borders never draw frame lines.
* 2. Detects uniform wall/studio backdrops via perimeter RGB + flood-fill and isolates the subject.
* 3. Normalizes subject tonal contrast + signed local relief + Sobel contours.
* 4. Runs serpentine Floyd-Steinberg error-diffusion stippling at adaptive resolution for clean spacing.
*/
var DEFAULT_IMAGE_TUNING = {
	blurStyle: "radial",
	edgeBlur: .45,
	contrast: 1.05,
	detail: .85
};
function computeAspectAwareStageBox(aspectRatio, viewportWidth, viewportHeight, edgeBlur = 0) {
	const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > .05 ? aspectRatio : 1;
	const isMobile = viewportWidth < 640;
	const isShortViewport = viewportHeight < 560;
	const topReserve = Math.min(isMobile ? 64 : 78, Math.max(44, viewportHeight * (isShortViewport ? .12 : .13)));
	const bottomReserve = Math.min(isMobile ? 148 : 164, Math.max(88, viewportHeight * (isShortViewport ? .24 : .27)));
	const availW = Math.max(80, viewportWidth - (isMobile ? 14 : 28) * 2);
	const availH = Math.max(80, viewportHeight - topReserve - bottomReserve);
	const clampedBlur = clamp01(edgeBlur);
	const scatterPad = clampedBlur > .01 ? Math.min(Math.min(availW, availH) * .12, Math.round(10 + clampedBlur * 22)) : 4;
	const innerAvailW = Math.max(48, availW - scatterPad * 2);
	const innerAvailH = Math.max(48, availH - scatterPad * 2);
	let maxBoxW;
	let maxBoxH;
	if (safeAspect > 1.15) {
		maxBoxW = Math.min(innerAvailW, viewportWidth * (isMobile ? .94 : .9));
		maxBoxH = innerAvailH;
	} else if (safeAspect < .85) {
		maxBoxH = innerAvailH;
		maxBoxW = Math.min(innerAvailW, Math.max(innerAvailW * .72, maxBoxH * safeAspect));
	} else {
		maxBoxW = Math.min(innerAvailW, viewportWidth * (isMobile ? .9 : .85));
		maxBoxH = innerAvailH;
	}
	return {
		x: (viewportWidth - maxBoxW) * .5,
		y: topReserve + scatterPad + (innerAvailH - maxBoxH) * .5,
		width: maxBoxW,
		height: maxBoxH
	};
}
function sampleImageTargets(img, viewportWidth, viewportHeight, density, invertContrast = false, isDarkTheme = true, tuning = DEFAULT_IMAGE_TUNING) {
	const sourceBounds = getImageSourceBounds(img);
	if (!sourceBounds || viewportWidth < 120 || viewportHeight < 120) return {
		points: [],
		cellSize: 2,
		bounds: {
			x: 0,
			y: 0,
			width: 0,
			height: 0
		}
	};
	const stageBox = computeAspectAwareStageBox(sourceBounds.aspectRatio, viewportWidth, viewportHeight, tuning.edgeBlur);
	return sampleImageIntoBox(img, stageBox.x, stageBox.y, stageBox.width, stageBox.height, density, invertContrast, isDarkTheme, tuning);
}
function sampleImageIntoBox(img, boxX, boxY, boxW, boxH, density, invertContrast = false, isDarkTheme = true, tuning = DEFAULT_IMAGE_TUNING, targetCountOverride) {
	const sourceBounds = getImageSourceBounds(img);
	if (!sourceBounds || boxW < 24 || boxH < 24) return {
		points: [],
		cellSize: 2,
		bounds: {
			x: boxX,
			y: boxY,
			width: boxW,
			height: boxH
		}
	};
	const { srcX, srcY, srcW, srcH, hasAlphaEmptySpace } = sourceBounds;
	const fitScale = Math.min(boxW / srcW, boxH / srcH);
	const stageW = srcW * fitScale;
	const stageH = srcH * fitScale;
	const stageX = boxX + (boxW - stageW) * .5;
	const stageY = boxY + (boxH - stageH) * .5;
	const workScale = Math.min(2, 340 / Math.max(srcW, srcH));
	const w = Math.max(16, Math.round(srcW * workScale));
	const h = Math.max(16, Math.round(srcH * workScale));
	const offscreen = document.createElement("canvas");
	offscreen.width = w;
	offscreen.height = h;
	const ctx = offscreen.getContext("2d", { willReadFrequently: true });
	if (!ctx) return {
		points: [],
		cellSize: 2,
		bounds: {
			x: stageX,
			y: stageY,
			width: stageW,
			height: stageH
		}
	};
	if (hasAlphaEmptySpace) ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);
	else ctx.drawImage(img, 0, 0, w, h);
	let rgba;
	try {
		rgba = ctx.getImageData(0, 0, w, h).data;
	} catch {
		return {
			points: [],
			cellSize: 2,
			bounds: {
				x: stageX,
				y: stageY,
				width: stageW,
				height: stageH
			}
		};
	}
	const totalPixels = w * h;
	const rArr = new Float32Array(totalPixels);
	const gArr = new Float32Array(totalPixels);
	const bArr = new Float32Array(totalPixels);
	const premulLum = new Float32Array(totalPixels);
	const alpha = new Float32Array(totalPixels);
	for (let i = 0; i < totalPixels; i++) {
		const p = i * 4;
		const a = rgba[p + 3] / 255;
		const r = rgba[p] / 255;
		const g = rgba[p + 1] / 255;
		const b = rgba[p + 2] / 255;
		rArr[i] = r;
		gArr[i] = g;
		bArr[i] = b;
		alpha[i] = a;
		premulLum[i] = (.299 * r + .587 * g + .114 * b) * a;
	}
	const blurLumSmall = boxBlur(premulLum, w, h, 1);
	const blurAlphaSmall = boxBlur(alpha, w, h, 1);
	const wideRadius = Math.max(8, Math.round(Math.max(w, h) * .055));
	const blurLumWide = boxBlur(blurLumSmall, w, h, wideRadius);
	const blurAlphaWide = boxBlur(blurAlphaSmall, w, h, wideRadius);
	const blurSmall = new Float32Array(totalPixels);
	const blurWide = new Float32Array(totalPixels);
	for (let i = 0; i < totalPixels; i++) {
		blurSmall[i] = blurAlphaSmall[i] > .04 ? blurLumSmall[i] / blurAlphaSmall[i] : 0;
		blurWide[i] = blurAlphaWide[i] > .04 ? blurLumWide[i] / blurAlphaWide[i] : 0;
	}
	const bezel = hasAlphaEmptySpace ? 1 : Math.max(4, Math.round(Math.min(w, h) * .022));
	const sobelArr = new Float32Array(totalPixels);
	for (let y = bezel; y < h - bezel; y++) {
		const row = y * w;
		for (let x = bezel; x < w - bezel; x++) {
			const idx = row + x;
			const tl = blurSmall[idx - w - 1];
			const tc = blurSmall[idx - w];
			const tr = blurSmall[idx - w + 1];
			const ml = blurSmall[idx - 1];
			const mr = blurSmall[idx + 1];
			const bl = blurSmall[idx + w - 1];
			const bc = blurSmall[idx + w];
			const br = blurSmall[idx + w + 1];
			const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
			const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
			const lumEdge = Math.hypot(gx, gy);
			let alphaEdge = 0;
			if (hasAlphaEmptySpace) {
				const atl = alpha[idx - w - 1];
				const atc = alpha[idx - w];
				const atr = alpha[idx - w + 1];
				const aml = alpha[idx - 1];
				const amr = alpha[idx + 1];
				const abl = alpha[idx + w - 1];
				const abc = alpha[idx + w];
				const abr = alpha[idx + w + 1];
				const agx = -atl - 2 * aml - abl + atr + 2 * amr + abr;
				const agy = -atl - 2 * atc - atr + abl + 2 * abc + abr;
				alphaEdge = Math.hypot(agx, agy);
			}
			sobelArr[idx] = Math.max(lumEdge, alphaEdge * .88);
		}
	}
	const subjectMask = new Float32Array(totalPixels).fill(1);
	if (!hasAlphaEmptySpace) {
		const ringStart = bezel + 2;
		const ringDepth = Math.max(4, Math.round(Math.min(w, h) * .035));
		let sumR = 0;
		let sumG = 0;
		let sumB = 0;
		let sumL = 0;
		let sumL2 = 0;
		let ringCount = 0;
		const neutralRingLums = [];
		for (let y = ringStart; y < h - ringStart; y++) for (let x = ringStart; x < w - ringStart; x++) {
			const inTop = y < ringStart + ringDepth;
			const inSide = (x < ringStart + ringDepth || x >= w - ringStart - ringDepth) && y < h * .85;
			if (inTop || inSide) {
				const idx = y * w + x;
				const r = rArr[idx];
				const g = gArr[idx];
				const b = bArr[idx];
				const chroma = Math.max(r, g, b) - Math.min(r, g, b);
				const l = .299 * r + .587 * g + .114 * b;
				if (chroma < .085 && l > .42) neutralRingLums.push(l);
				if (inTop || y < h * .65) {
					sumR += r;
					sumG += g;
					sumB += b;
					sumL += blurSmall[idx];
					sumL2 += blurSmall[idx] * blurSmall[idx];
					ringCount++;
				}
			}
		}
		let isCheckerboard = false;
		let checkerLow = .65;
		let checkerHigh = .98;
		if (neutralRingLums.length > ringCount * .42 && neutralRingLums.length >= 24) {
			neutralRingLums.sort((a, b) => a - b);
			checkerLow = neutralRingLums[Math.floor(neutralRingLums.length * .18)];
			checkerHigh = neutralRingLums[Math.floor(neutralRingLums.length * .84)];
			if (checkerHigh - checkerLow > .08 && checkerHigh > .82 && checkerLow > .42) {
				const mid = (checkerLow + checkerHigh) * .5;
				let alternations = 0;
				const countTransitions = (indices) => {
					let lastSide = 0;
					for (let k = 0; k < indices.length; k++) {
						const idx = indices[k];
						const r = rArr[idx];
						const g = gArr[idx];
						const b = bArr[idx];
						const chroma = Math.max(r, g, b) - Math.min(r, g, b);
						const l = .299 * r + .587 * g + .114 * b;
						if (chroma < .085 && l >= checkerLow - .1 && l <= checkerHigh + .08) {
							const side = l >= mid ? 1 : -1;
							if (lastSide !== 0 && side !== lastSide) alternations++;
							lastSide = side;
						} else lastSide = 0;
					}
				};
				const leftCol = [];
				const rightCol = [];
				for (let y = ringStart; y < h - ringStart; y++) {
					leftCol.push(y * w + ringStart + 2);
					rightCol.push(y * w + (w - 1 - ringStart - 2));
				}
				const topRow = [];
				for (let x = ringStart; x < w - ringStart; x++) topRow.push((ringStart + 2) * w + x);
				countTransitions(leftCol);
				countTransitions(rightCol);
				countTransitions(topRow);
				if (alternations >= 8) isCheckerboard = true;
			}
		}
		if (isCheckerboard) {
			const isWall = new Uint8Array(totalPixels);
			const queue = new Int32Array(totalPixels);
			let qHead = 0;
			let qTail = 0;
			const minCheckerL = checkerLow - .12;
			const maxCheckerL = Math.min(1, checkerHigh + .06);
			const isCheckerPixel = (idx) => {
				const r = rArr[idx];
				const g = gArr[idx];
				const b = bArr[idx];
				const chroma = Math.max(r, g, b) - Math.min(r, g, b);
				const l = .299 * r + .587 * g + .114 * b;
				return chroma <= .095 && l >= minCheckerL && l <= maxCheckerL;
			};
			const trySeedChecker = (idx) => {
				if (!isWall[idx] && isCheckerPixel(idx)) {
					isWall[idx] = 1;
					queue[qTail++] = idx;
				}
			};
			for (let x = ringStart; x < w - ringStart; x++) {
				trySeedChecker(ringStart * w + x);
				trySeedChecker((h - 1 - ringStart) * w + x);
			}
			for (let y = ringStart; y < h - ringStart; y++) {
				trySeedChecker(y * w + ringStart);
				trySeedChecker(y * w + (w - 1 - ringStart));
			}
			while (qHead < qTail) {
				const cur = queue[qHead++];
				const cx = cur % w;
				const cy = (cur - cx) / w;
				const neighbors = [
					cx > 0 ? cur - 1 : -1,
					cx < w - 1 ? cur + 1 : -1,
					cy > 0 ? cur - w : -1,
					cy < h - 1 ? cur + w : -1
				];
				for (let n = 0; n < 4; n++) {
					const nIdx = neighbors[n];
					if (nIdx >= 0 && !isWall[nIdx] && isCheckerPixel(nIdx)) {
						isWall[nIdx] = 1;
						queue[qTail++] = nIdx;
					}
				}
			}
			for (let i = 0; i < totalPixels; i++) if (isWall[i]) sobelArr[i] = 0;
			const wallFloat = new Float32Array(totalPixels);
			for (let i = 0; i < totalPixels; i++) wallFloat[i] = isWall[i] ? 1 : 0;
			const wallBlurred = boxBlur(wallFloat, w, h, 2);
			for (let i = 0; i < totalPixels; i++) subjectMask[i] = isWall[i] ? 0 : clamp01(1 - wallBlurred[i]);
		} else {
			const meanR = ringCount > 0 ? sumR / ringCount : 0;
			const meanG = ringCount > 0 ? sumG / ringCount : 0;
			const meanB = ringCount > 0 ? sumB / ringCount : 0;
			const meanL = ringCount > 0 ? sumL / ringCount : 0;
			if ((ringCount > 0 ? Math.sqrt(Math.max(0, sumL2 / ringCount - meanL * meanL)) : 1) < .16) {
				const isWall = new Uint8Array(totalPixels);
				const queue = new Int32Array(totalPixels);
				let qHead = 0;
				let qTail = 0;
				const trySeed = (idx) => {
					if (isWall[idx]) return;
					const dr = rArr[idx] - meanR;
					const dg = gArr[idx] - meanG;
					const db = bArr[idx] - meanB;
					if (Math.sqrt(dr * dr + dg * dg + db * db) < .18 && sobelArr[idx] < .14) {
						isWall[idx] = 1;
						queue[qTail++] = idx;
					}
				};
				for (let x = ringStart; x < w - ringStart; x++) trySeed(ringStart * w + x);
				for (let y = ringStart; y < Math.floor(h * .78); y++) {
					trySeed(y * w + ringStart);
					trySeed(y * w + (w - 1 - ringStart));
				}
				while (qHead < qTail) {
					const cur = queue[qHead++];
					const cx = cur % w;
					const cy = (cur - cx) / w;
					const neighbors = [
						cx > bezel ? cur - 1 : -1,
						cx < w - 1 - bezel ? cur + 1 : -1,
						cy > bezel ? cur - w : -1,
						cy < h - 1 - bezel ? cur + w : -1
					];
					for (let n = 0; n < 4; n++) {
						const nIdx = neighbors[n];
						if (nIdx < 0 || isWall[nIdx]) continue;
						const dr = rArr[nIdx] - meanR;
						const dg = gArr[nIdx] - meanG;
						const db = bArr[nIdx] - meanB;
						if (Math.sqrt(dr * dr + dg * dg + db * db) < .17 && sobelArr[nIdx] < .16) {
							isWall[nIdx] = 1;
							queue[qTail++] = nIdx;
						}
					}
				}
				const wallFloat = new Float32Array(totalPixels);
				for (let i = 0; i < totalPixels; i++) wallFloat[i] = isWall[i] ? 1 : 0;
				const wallBlurred = boxBlur(wallFloat, w, h, 3);
				for (let i = 0; i < totalPixels; i++) subjectMask[i] = clamp01(1 - wallBlurred[i]);
			}
		}
	}
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const idx = y * w + x;
		if (alpha[idx] < .15) subjectMask[idx] = 0;
		else if (!hasAlphaEmptySpace && (x < bezel || x >= w - bezel || y < bezel || y >= h - bezel)) subjectMask[idx] = 0;
	}
	const checkBand = 3;
	let topActive = 0;
	let topTotal = 0;
	let botActive = 0;
	let botTotal = 0;
	let leftActive = 0;
	let leftTotal = 0;
	let rightActive = 0;
	let rightTotal = 0;
	for (let d = 1; d <= checkBand; d++) {
		const ty = bezel + d;
		const by = h - 1 - bezel - d;
		for (let x = bezel + 2; x < w - bezel - 2; x++) {
			if (ty < h) {
				topTotal++;
				if (subjectMask[ty * w + x] > .35) topActive++;
			}
			if (by >= 0) {
				botTotal++;
				if (subjectMask[by * w + x] > .35) botActive++;
			}
		}
		const lx = bezel + d;
		const rx = w - 1 - bezel - d;
		for (let y = bezel + 2; y < h - bezel - 2; y++) {
			if (lx < w) {
				leftTotal++;
				if (subjectMask[y * w + lx] > .35) leftActive++;
			}
			if (rx >= 0) {
				rightTotal++;
				if (subjectMask[y * w + rx] > .35) rightActive++;
			}
		}
	}
	const touchesTop = topTotal > 0 && topActive / topTotal > .06;
	const touchesBottom = botTotal > 0 && botActive / botTotal > .06;
	const touchesLeft = leftTotal > 0 && leftActive / leftTotal > .06;
	const touchesRight = rightTotal > 0 && rightActive / rightTotal > .06;
	const blurStyle = tuning.blurStyle ?? "radial";
	const edgeBlur = clamp01(tuning.edgeBlur);
	const contrastMult = Math.max(.5, Math.min(2, tuning.contrast));
	const detailMult = Math.max(0, Math.min(2, tuning.detail));
	let minMX = w;
	let maxMX = -1;
	let minMY = h;
	let maxMY = -1;
	const rawBaseMask = new Float32Array(totalPixels);
	for (let y = 0; y < h; y++) {
		const row = y * w;
		for (let x = 0; x < w; x++) {
			const idx = row + x;
			const m = subjectMask[idx] * (alpha[idx] >= .15 ? alpha[idx] : 0);
			rawBaseMask[idx] = m;
			if (m > .25) {
				if (x < minMX) minMX = x;
				if (x > maxMX) maxMX = x;
				if (y < minMY) minMY = y;
				if (y > maxMY) maxMY = y;
			}
		}
	}
	if (maxMX < minMX || maxMY < minMY) {
		minMX = bezel;
		maxMX = w - 1 - bezel;
		minMY = bezel;
		maxMY = h - 1 - bezel;
	}
	const subjCenterX = (minMX + maxMX) * .5;
	const subjCenterY = (minMY + maxMY) * .5;
	const subjRx = Math.max(12, (maxMX - minMX) * .5);
	const subjRy = Math.max(12, (maxMY - minMY) * .5);
	const edgeFadeMap = new Float32Array(totalPixels).fill(1);
	let baseMask = rawBaseMask;
	let softMask = rawBaseMask;
	let rimLuminance = blurSmall;
	if (blurStyle === "radial") {
		if (edgeBlur > .01) {
			const innerR = .86 - edgeBlur * .5;
			const outerR = 1.08 - edgeBlur * .16;
			const maxRadialStep = (.015 + edgeBlur * .085) * Math.max(w, h);
			const radMask = new Float32Array(totalPixels);
			const radLum = new Float32Array(totalPixels);
			const radEdge = new Float32Array(totalPixels);
			for (let y = 0; y < h; y++) {
				const dyPx = y - subjCenterY;
				const ny = dyPx / subjRy;
				const row = y * w;
				for (let x = 0; x < w; x++) {
					const idx = row + x;
					const dxPx = x - subjCenterX;
					const nx = dxPx / subjRx;
					let r = Math.hypot(nx, ny);
					if (touchesBottom && ny > .35) r += (ny - .35) * (.08 + edgeBlur * .22);
					let f = smoothstep(outerR, innerR, r);
					if (f < 1 && f > 0) {
						const angle = Math.atan2(dyPx, dxPx);
						const wisp = .74 + .26 * Math.sin(angle * 7 + r * 8.5 + Math.cos(angle * 3) * 1.4);
						f = clamp01(Math.pow(f, 1.1) * (f > .84 ? 1 : wisp));
					}
					edgeFadeMap[idx] = f;
					const radT = clamp01((r - innerR * .82) / Math.max(.08, outerR - innerR * .82));
					if (radT > .01 && maxRadialStep > .5) {
						const len = Math.hypot(dxPx, dyPx) || 1;
						const ux = dxPx / len;
						const uy = dyPx / len;
						const span = maxRadialStep * radT;
						let mSum = 0;
						let lumSum = 0;
						let alpSum = 0;
						let eSum = 0;
						const taps = 7;
						for (let k = -1; k <= 5; k++) {
							const t = k / 5;
							const sx = Math.max(0, Math.min(w - 1, Math.round(x - ux * span * t)));
							const sIdx = Math.max(0, Math.min(h - 1, Math.round(y - uy * span * t))) * w + sx;
							mSum += rawBaseMask[sIdx];
							lumSum += premulLum[sIdx];
							alpSum += alpha[sIdx];
							eSum += sobelArr[sIdx];
						}
						const blurredM = mSum / taps;
						const coreM = rawBaseMask[idx];
						radMask[idx] = Math.max(blurredM, coreM * (1 - radT * .25)) * f;
						radLum[idx] = alpSum > .03 ? lumSum / alpSum : alpha[idx] >= .15 ? blurSmall[idx] : 0;
						radEdge[idx] = eSum / taps * (.35 + .65 * (1 - radT)) + sobelArr[idx] * (1 - radT) * .5;
					} else {
						radMask[idx] = rawBaseMask[idx] * f;
						radLum[idx] = blurSmall[idx];
						radEdge[idx] = sobelArr[idx];
					}
				}
			}
			for (let i = 0; i < totalPixels; i++) sobelArr[i] = radEdge[i];
			softMask = radMask;
			rimLuminance = radLum;
		}
	} else {
		const fadeTop = touchesTop && edgeBlur > .01 ? Math.round(h * (.02 + edgeBlur * .18)) : 0;
		const fadeBottom = touchesBottom && edgeBlur > .01 ? Math.round(h * (.04 + edgeBlur * .3)) : 0;
		const fadeLeft = touchesLeft && edgeBlur > .01 ? Math.round(w * (.02 + edgeBlur * .18)) : 0;
		const fadeRight = touchesRight && edgeBlur > .01 ? Math.round(w * (.02 + edgeBlur * .18)) : 0;
		if (fadeTop > 0 || fadeBottom > 0 || fadeLeft > 0 || fadeRight > 0) for (let y = 0; y < h; y++) {
			const fTop = fadeTop > 0 ? smoothstep(bezel, bezel + fadeTop, y) : 1;
			const fBot = fadeBottom > 0 ? smoothstep(h - 1 - bezel, h - 1 - bezel - fadeBottom, y) : 1;
			const fY = Math.min(fTop, fBot);
			const row = y * w;
			for (let x = 0; x < w; x++) {
				const fLeft = fadeLeft > 0 ? smoothstep(bezel, bezel + fadeLeft, x) : 1;
				const fRight = fadeRight > 0 ? smoothstep(w - 1 - bezel, w - 1 - bezel - fadeRight, x) : 1;
				let f = Math.min(fY, fLeft, fRight);
				if (f < 1) {
					const wisp = .72 + .28 * Math.sin(x * .13 + Math.cos(y * .09) * 2.3);
					f = clamp01(Math.pow(f, 1.15) * (f > .82 ? 1 : wisp));
					edgeFadeMap[row + x] = f;
					subjectMask[row + x] *= f;
				}
			}
		}
		baseMask = new Float32Array(totalPixels);
		for (let i = 0; i < totalPixels; i++) baseMask[i] = subjectMask[i] * (alpha[i] >= .15 ? alpha[i] : 0);
		const silhouetteRadius = edgeBlur > .08 ? Math.round(edgeBlur * 7) : 0;
		softMask = silhouetteRadius > 0 ? boxBlur(baseMask, w, h, silhouetteRadius) : baseMask;
		rimLuminance = silhouetteRadius > 0 ? (() => {
			const rLum = boxBlur(premulLum, w, h, silhouetteRadius + 1);
			const rAlp = boxBlur(alpha, w, h, silhouetteRadius + 1);
			const out = new Float32Array(totalPixels);
			for (let i = 0; i < totalPixels; i++) out[i] = alpha[i] >= .15 ? blurSmall[i] : rAlp[i] > .02 ? rLum[i] / rAlp[i] : 0;
			return out;
		})() : blurSmall;
		for (let i = 0; i < totalPixels; i++) {
			if (baseMask[i] > .7 && softMask[i] < baseMask[i]) softMask[i] = Math.max(softMask[i], baseMask[i] * (1 - edgeBlur * .12));
			if (softMask[i] < edgeFadeMap[i] && baseMask[i] <= .1) edgeFadeMap[i] = Math.min(edgeFadeMap[i], softMask[i]);
		}
	}
	const hist = /* @__PURE__ */ new Uint32Array(256);
	let subjectSamples = 0;
	for (let i = 0; i < totalPixels; i++) if (baseMask[i] > .35 && alpha[i] > .15) {
		const bin = Math.min(255, Math.max(0, Math.round(blurSmall[i] * 255)));
		hist[bin]++;
		subjectSamples++;
	}
	let lumLow = .04;
	let lumHigh = .96;
	if (subjectSamples > 100) {
		let acc = 0;
		const lowTarget = subjectSamples * .03;
		const highTarget = subjectSamples * .97;
		for (let b = 0; b < 256; b++) {
			acc += hist[b];
			if (acc >= lowTarget) {
				lumLow = b / 255;
				break;
			}
		}
		acc = 0;
		for (let b = 0; b < 256; b++) {
			acc += hist[b];
			if (acc >= highTarget) {
				lumHigh = b / 255;
				break;
			}
		}
		if (lumHigh - lumLow < .18) {
			lumLow = Math.max(0, lumLow - .1);
			lumHigh = Math.min(1, lumHigh + .1);
		}
	}
	const toneMap = new Float32Array(totalPixels);
	const edgeMap = new Float32Array(totalPixels);
	const lumSpan = Math.max(.12, lumHigh - lumLow);
	const lightParticlesOnDark = isDarkTheme ? !invertContrast : invertContrast;
	const bodyFloor = hasAlphaEmptySpace ? .24 : .12;
	let toneSum = 0;
	for (let i = 0; i < totalPixels; i++) {
		const mask = softMask[i];
		if (mask < .025) continue;
		const curvedL = clamp01((smoothstep(.02, .96, clamp01((rimLuminance[i] - lumLow) / lumSpan)) - .5) * contrastMult + .5);
		const localRelief = Math.max(-.36, Math.min(.36, (rimLuminance[i] - blurWide[i]) * 2.5 * contrastMult));
		const edgeSig = Math.pow(clamp01(sobelArr[i] * 2.35), .76);
		let val;
		if (lightParticlesOnDark) val = curvedL * .76 + localRelief * .42 + edgeSig * (.54 * detailMult) + bodyFloor;
		else val = (1 - curvedL) * .78 - localRelief * .42 + edgeSig * (.54 * detailMult) + .08;
		const finalT = clamp01(val) * mask;
		toneMap[i] = finalT;
		edgeMap[i] = edgeSig * mask;
		toneSum += finalT;
	}
	if (toneSum <= 1) return {
		points: [],
		cellSize: 2,
		bounds: {
			x: stageX,
			y: stageY,
			width: stageW,
			height: stageH
		}
	};
	const targetCount = targetCountOverride ?? DENSITY_TARGET_COUNT[density];
	const avgTone = toneSum / totalPixels;
	const idealTotalCells = targetCount / Math.max(.06, avgTone);
	const aspect = w / h;
	let gh = Math.round(Math.sqrt(idealTotalCells / aspect));
	let gw = Math.round(gh * aspect);
	const maxGridDim = targetCountOverride !== void 0 ? Math.max(110, Math.min(340, Math.round(Math.sqrt(targetCount * 2.2)))) : density === "dense" ? 420 : density === "balanced" ? 350 : 270;
	const minGridDim = 110;
	if (Math.max(gw, gh) > maxGridDim) {
		const scaleDown = maxGridDim / Math.max(gw, gh);
		gw = Math.round(gw * scaleDown);
		gh = Math.round(gh * scaleDown);
	}
	if (Math.max(gw, gh) < minGridDim) {
		const scaleUp = minGridDim / Math.max(gw, gh);
		gw = Math.round(gw * scaleUp);
		gh = Math.round(gh * scaleUp);
	}
	gw = Math.max(20, gw);
	gh = Math.max(20, gh);
	const gridT = new Float32Array(gw * gh);
	const gridOrigT = new Float32Array(gw * gh);
	const gridEdge = new Float32Array(gw * gh);
	const gridMask = new Float32Array(gw * gh);
	const gridFade = new Float32Array(gw * gh);
	for (let gy = 0; gy < gh; gy++) {
		const sy = (gy + .5) / gh * (h - 1);
		const y0 = Math.floor(sy);
		const y1 = Math.min(h - 1, y0 + 1);
		const fy = sy - y0;
		for (let gx = 0; gx < gw; gx++) {
			const sx = (gx + .5) / gw * (w - 1);
			const x0 = Math.floor(sx);
			const x1 = Math.min(w - 1, x0 + 1);
			const fx = sx - x0;
			const i00 = y0 * w + x0;
			const i10 = y0 * w + x1;
			const i01 = y1 * w + x0;
			const i11 = y1 * w + x1;
			const tVal = (toneMap[i00] * (1 - fx) + toneMap[i10] * fx) * (1 - fy) + (toneMap[i01] * (1 - fx) + toneMap[i11] * fx) * fy;
			const eVal = (edgeMap[i00] * (1 - fx) + edgeMap[i10] * fx) * (1 - fy) + (edgeMap[i01] * (1 - fx) + edgeMap[i11] * fx) * fy;
			const mVal = (softMask[i00] * (1 - fx) + softMask[i10] * fx) * (1 - fy) + (softMask[i01] * (1 - fx) + softMask[i11] * fx) * fy;
			const fVal = (edgeFadeMap[i00] * (1 - fx) + edgeFadeMap[i10] * fx) * (1 - fy) + (edgeFadeMap[i01] * (1 - fx) + edgeFadeMap[i11] * fx) * fy;
			const gIdx = gy * gw + gx;
			gridT[gIdx] = tVal;
			gridOrigT[gIdx] = tVal;
			gridEdge[gIdx] = eVal;
			gridMask[gIdx] = mVal;
			gridFade[gIdx] = fVal;
		}
	}
	const cellW = stageW / gw;
	const cellH = stageH / gh;
	const maxCell = Math.max(cellW, cellH);
	const points = [];
	const stageCenterX = stageX + subjCenterX / w * stageW;
	const stageCenterY = stageY + subjCenterY / h * stageH;
	for (let gy = 0; gy < gh; gy++) {
		const leftToRight = (gy & 1) === 0;
		const xStart = leftToRight ? 0 : gw - 1;
		const xEnd = leftToRight ? gw : -1;
		const stepX = leftToRight ? 1 : -1;
		for (let gx = xStart; gx !== xEnd; gx += stepX) {
			const idx = gy * gw + gx;
			if (gridMask[idx] < .025) continue;
			const oldVal = gridT[idx];
			const origT = gridOrigT[idx];
			if (origT <= .01) continue;
			const emit = oldVal >= .5 + (Math.random() - .5) * .08 && origT > .03 ? 1 : 0;
			const err = oldVal - emit;
			if (emit) {
				const fade = Math.min(gridFade[idx], gridMask[idx]);
				const basePx = stageX + (gx + .5 + (Math.random() - .5) * .62) * cellW;
				const basePy = stageY + (gy + .5 + (Math.random() - .5) * .62) * cellH;
				let px = basePx;
				let py = basePy;
				if (edgeBlur > .01 && fade < .96) {
					if (blurStyle === "radial") {
						const dxC = basePx - stageCenterX;
						const dyC = basePy - stageCenterY;
						const cDist = Math.hypot(dxC, dyC) || 1;
						const ux = dxC / cDist;
						const uy = dyC / cDist;
						const radScatter = Math.pow(1 - fade, 1.3) * maxCell * (3.5 + edgeBlur * 16);
						const push = (.2 + Math.random() * .85) * radScatter;
						const jitter = (Math.random() - .5) * radScatter * .45;
						px += ux * push - uy * jitter;
						py += uy * push + ux * jitter;
					} else {
						const edgeScatter = Math.pow(1 - fade, 1.45) * maxCell * (2 + edgeBlur * 11);
						px += (Math.random() - .5) * edgeScatter;
						py += (Math.random() - .5) * edgeScatter;
					}
				}
				const edgeW = gridEdge[idx];
				const fadeAlpha = .18 + .82 * fade;
				const weight = clamp01((.32 + origT * .52 + edgeW * .28) * fadeAlpha);
				points.push({
					x: px,
					y: py,
					weight
				});
			}
			const canReceive = (nIdx) => gridMask[nIdx] >= .025 && gridOrigT[nIdx] > .01;
			const nx1 = gx + stepX;
			if (nx1 >= 0 && nx1 < gw && canReceive(idx + stepX)) gridT[idx + stepX] += err * (7 / 16);
			if (gy + 1 < gh) {
				const nextRow = (gy + 1) * gw;
				const nxb = gx - stepX;
				if (nxb >= 0 && nxb < gw && canReceive(nextRow + nxb)) gridT[nextRow + nxb] += err * (3 / 16);
				if (canReceive(nextRow + gx)) gridT[nextRow + gx] += err * (5 / 16);
				if (nx1 >= 0 && nx1 < gw && canReceive(nextRow + nx1)) gridT[nextRow + nx1] += err * (1 / 16);
			}
		}
	}
	const subjectBounds = {
		x: stageX + minMX / w * stageW,
		y: stageY + minMY / h * stageH,
		width: Math.max(24, (maxMX - minMX + 1) / w * stageW),
		height: Math.max(24, (maxMY - minMY + 1) / h * stageH)
	};
	if (points.length > targetCount * 1.15) {
		for (let i = points.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = points[i];
			points[i] = points[j];
			points[j] = tmp;
		}
		return {
			points: points.slice(0, Math.round(targetCount * 1.15)),
			cellSize: Math.max(cellW, cellH),
			bounds: subjectBounds
		};
	}
	return {
		points,
		cellSize: Math.max(cellW, cellH),
		bounds: subjectBounds
	};
}
// src/engine/layoutEngine.ts
/** Smallest font size used anywhere in a measured tree (Infinity if none). */
function smallestFontSize(m) {
	let min = m.fontSize && m.fontSize > 0 ? m.fontSize : Infinity;
	if (m.mindMapData) {
		for (const n of m.mindMapData.nodes) if (n.fontSize > 0) min = Math.min(min, n.fontSize);
	}
	for (const child of m.children) min = Math.min(min, smallestFontSize(child));
	return min;
}
var FONT_FAMILY_MAP$1 = {
	serif: "'Fraunces', Georgia, serif",
	sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	mono: "'JetBrains Mono', ui-monospace, monospace"
};
var LAYOUT_BUDGET_BY_DENSITY = {
	sparse: 16500,
	balanced: 3e4,
	dense: 45e3
};
function parseNum(val, fallback) {
	if (!val) return fallback;
	const n = parseFloat(val);
	return Number.isFinite(n) ? n : fallback;
}
function clamp(v, lo, hi) {
	return v < lo ? lo : v > hi ? hi : v;
}
function parseRipplePattern(raw) {
	if (!raw) return void 0;
	const clean = raw.trim().toLowerCase();
	if (clean === "off" || clean === "false" || clean === "none") return "off";
	if (clean === "ring" || clean === "true") return "ring";
	if (clean === "sweep" || clean === "wave") return "sweep";
	if (clean === "pulse" || clean === "breathe") return "pulse";
	if (clean === "expand" || clean === "burst") return "expand";
}
function parseRippleTrigger(raw) {
	if (!raw) return void 0;
	const clean = raw.trim().toLowerCase();
	if (clean === "both" || clean === "all") return "both";
	if (clean === "ambient" || clean === "auto") return "ambient";
	if (clean === "interactive" || clean === "touch" || clean === "pointer") return "interactive";
	if (clean === "hover") return "hover";
	if (clean === "click" || clean === "tap") return "click";
}
function mergeRippleConfig(inherited, attrs) {
	const pattern = parseRipplePattern(attrs.ripple) ?? inherited.pattern;
	const trigger = parseRippleTrigger(attrs.rippleTrigger ?? attrs.rippletrigger) ?? inherited.trigger;
	const rawStrength = attrs.rippleStrength ?? attrs.ripplestrength;
	const rawSpeed = attrs.rippleSpeed ?? attrs.ripplespeed;
	const rawWave = attrs.rippleWave ?? attrs.ripplewave ?? attrs.rippleWavelength ?? attrs.ripplewavelength;
	return {
		pattern,
		trigger,
		strength: rawStrength !== void 0 ? clamp(parseNum(rawStrength, .7), 0, 2) : inherited.strength,
		speed: rawSpeed !== void 0 ? clamp(parseNum(rawSpeed, 1), .2, 3) : inherited.speed,
		wavelength: rawWave !== void 0 ? clamp(parseNum(rawWave, 130), 40, 360) : inherited.wavelength
	};
}
/**
* Default `<Image src>` resolution: no src, "current" or "uploaded" → the current `imageSrc`;
* anything else is used as a URL/path as-is.
*/
function defaultLayoutImageUrl(rawSrc, currentImageSrc) {
	const key = (rawSrc ?? "").trim();
	const normalized = key.toLowerCase();
	if (!key || normalized === "uploaded" || normalized === "current") return currentImageSrc;
	return key;
}
function wrapTextLines(ctx, text, maxWidth) {
	const paragraphs = text.split(/\n+/);
	const lines = [];
	for (const para of paragraphs) {
		const clean = para.replace(/\s+/g, " ").trim();
		if (!clean) continue;
		const words = clean.split(" ");
		let currentLine = "";
		for (const word of words) {
			const candidate = currentLine ? `${currentLine} ${word}` : word;
			if (ctx.measureText(candidate).width <= maxWidth) currentLine = candidate;
			else if (currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				lines.push(word);
				currentLine = "";
			}
		}
		if (currentLine) lines.push(currentLine);
	}
	return lines.length > 0 ? lines : [""];
}
function wrapCodeLines(ctx, text, maxWidth) {
	const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
	const out = [];
	for (const rawLine of rawLines) {
		if (rawLine === "") {
			out.push("");
			continue;
		}
		if (ctx.measureText(rawLine).width <= maxWidth) {
			out.push(rawLine);
			continue;
		}
		let current = "";
		for (const ch of rawLine) {
			const next = current + ch;
			if (ctx.measureText(next).width <= maxWidth || current.length === 0) current = next;
			else {
				out.push(current);
				current = ch;
			}
		}
		if (current) out.push(current);
	}
	return out.length > 0 ? out : [""];
}
function extractListItems(node) {
	const childItems = node.children.filter((c) => c.tag === "Item" || c.tag === "Text");
	if (childItems.length > 0) return {
		texts: childItems.map((c) => (c.text || "").trim()).filter((t) => t.length > 0),
		detectedOrdered: false
	};
	const lines = (node.text || "").split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
	if (lines.length === 0) return {
		texts: ["List item"],
		detectedOrdered: false
	};
	let orderedCount = 0;
	return {
		texts: lines.map((line) => {
			if (/^\d+[.)]\s+/.test(line)) {
				orderedCount++;
				return line.replace(/^\d+[.)]\s+/, "").trim();
			}
			return line.replace(/^[-*•+]\s+/, "").trim();
		}).filter((t) => t.length > 0),
		detectedOrdered: orderedCount > 0 && orderedCount === lines.length
	};
}
function splitPipeRow(line) {
	let trimmed = line.trim();
	if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
	if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
	return trimmed.split("|").map((cell) => cell.trim());
}
function parseSeparatorAlign(cell) {
	const t = cell.trim();
	if (!/^:?-{2,}:?$/.test(t)) return null;
	if (t.startsWith(":") && t.endsWith(":")) return "center";
	if (t.endsWith(":")) return "right";
	return "left";
}
function extractTableRows(node) {
	const trNodes = node.children.filter((c) => c.tag === "Tr");
	if (trNodes.length > 0) {
		const colAligns = [];
		return {
			rows: trNodes.map((tr, rIdx) => {
				const cellNodes = tr.children.filter((c) => c.tag === "Th" || c.tag === "Td");
				const hasTh = cellNodes.some((c) => c.tag === "Th");
				return {
					isHeader: node.attrs.header !== "false" && (hasTh || rIdx === 0 && tr.attrs.header === "true"),
					cells: cellNodes.map((cell, cIdx) => {
						const alignAttr = cell.attrs.align?.toLowerCase();
						const align = alignAttr === "center" ? "center" : alignAttr === "right" || alignAttr === "end" ? "right" : alignAttr === "left" || alignAttr === "start" ? "left" : void 0;
						if (align && !colAligns[cIdx]) colAligns[cIdx] = align;
						return {
							text: (cell.text || "").trim(),
							align
						};
					})
				};
			}),
			colAligns
		};
	}
	const lines = (node.text || "").split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
	if (lines.length === 0) return {
		rows: [{
			isHeader: true,
			cells: [{ text: "Column" }]
		}],
		colAligns: ["left"]
	};
	const rawRows = lines.map(splitPipeRow);
	const colAligns = [];
	let hasSeparator = false;
	if (rawRows.length >= 2) {
		const maybeAligns = rawRows[1].map(parseSeparatorAlign);
		if (maybeAligns.length > 0 && maybeAligns.every((a) => a !== null)) {
			hasSeparator = true;
			maybeAligns.forEach((a, idx) => {
				colAligns[idx] = a || "left";
			});
		}
	}
	const rows = [];
	rawRows.forEach((cells, idx) => {
		if (hasSeparator && idx === 1) return;
		const isHeader = node.attrs.header !== "false" && idx === 0;
		rows.push({
			isHeader,
			cells: cells.map((text) => ({ text }))
		});
	});
	return {
		rows,
		colAligns
	};
}
function resolveFontStyle(attr, fallback) {
	if (attr === "serif" || attr === "sans" || attr === "mono") return attr;
	return fallback;
}
function resolveHeadingSize(sizeAttr, compact) {
	switch ((sizeAttr || "lg").toLowerCase()) {
		case "xl": return compact ? 42 : 58;
		case "lg": return compact ? 32 : 42;
		case "md": return compact ? 24 : 30;
		case "sm": return compact ? 19 : 22;
		default: {
			const custom = parseNum(sizeAttr, 40);
			return clamp(compact ? custom * .78 : custom, 18, 72);
		}
	}
}
function resolveBodySize(sizeAttr, compact) {
	switch ((sizeAttr || "md").toLowerCase()) {
		case "lg": return compact ? 18 : 22;
		case "md": return compact ? 15 : 18;
		case "sm": return compact ? 13 : 15;
		default: {
			const custom = parseNum(sizeAttr, 18);
			return clamp(compact ? custom * .85 : custom, 13, 30);
		}
	}
}
function resolveButtonSize(sizeAttr) {
	switch ((sizeAttr || "md").toLowerCase()) {
		case "lg": return {
			fontSize: 18,
			px: 28,
			py: 14
		};
		case "sm": return {
			fontSize: 14,
			px: 18,
			py: 11
		};
		default: return {
			fontSize: 16,
			px: 24,
			py: 13
		};
	}
}
function assignMindMapIds(item, path, depth) {
	item.id = path;
	item.depth = depth;
	item.children.forEach((child, idx) => {
		assignMindMapIds(child, `${path}/${idx}`, depth + 1);
	});
}
function convertBranchTagNode(branch) {
	const rawLabel = branch.attrs.label || branch.attrs.title || branch.text || "Topic";
	const childBranches = branch.children.filter((c) => c.tag === "Branch");
	return {
		id: "",
		label: rawLabel.replace(/\s+/g, " ").trim(),
		depth: 0,
		collapsedAttr: branch.attrs.collapsed === "true",
		attrs: branch.attrs,
		children: childBranches.map(convertBranchTagNode)
	};
}
function cleanMindMapOutlineLabel(line) {
	return line.trim().replace(/^#{1,4}\s+/, "").replace(/^[-*•+]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
}
function extractMindMapTree(node) {
	const mapKey = (node.attrs.id || `mm${node.line}`).trim();
	const branchChildren = node.children.filter((c) => c.tag === "Branch");
	if (branchChildren.length > 0) {
		const root = {
			id: mapKey,
			label: (node.attrs.title || node.attrs.label || node.attrs.root || node.text?.split("\n")[0] || "Central Topic").replace(/^[-*•+#]+\s*/, "").trim(),
			depth: 0,
			collapsedAttr: node.attrs.collapsed === "true",
			attrs: node.attrs,
			children: branchChildren.map(convertBranchTagNode)
		};
		assignMindMapIds(root, `${mapKey}/0`, 0);
		return root;
	}
	const rawLines = (node.text || "").replace(/\r\n?/g, "\n").split("\n").map((raw) => {
		const expanded = raw.replace(/\t/g, "  ");
		const indentMatch = expanded.match(/^(\s*)/);
		return {
			indent: indentMatch ? indentMatch[1].length : 0,
			label: cleanMindMapOutlineLabel(expanded)
		};
	}).filter((entry) => entry.label.length > 0);
	if (rawLines.length === 0) return {
		id: `${mapKey}/0`,
		label: (node.attrs.title || node.attrs.label || "Mind Map").trim(),
		depth: 0,
		collapsedAttr: false,
		attrs: node.attrs,
		children: []
	};
	const minIndent = Math.min(...rawLines.map((l) => l.indent));
	const hasSingleRootLine = rawLines.filter((l) => l.indent === minIndent).length === 1 && rawLines[0].indent === minIndent && !node.attrs.title && !node.attrs.root;
	let root;
	let startIdx = 0;
	if (hasSingleRootLine) {
		root = {
			id: "",
			label: rawLines[0].label,
			depth: 0,
			collapsedAttr: node.attrs.collapsed === "true",
			attrs: node.attrs,
			children: []
		};
		startIdx = 1;
	} else root = {
		id: "",
		label: (node.attrs.title || node.attrs.label || node.attrs.root || "Mind Map").trim(),
		depth: 0,
		collapsedAttr: node.attrs.collapsed === "true",
		attrs: node.attrs,
		children: []
	};
	const stack = [{
		indent: hasSingleRootLine ? rawLines[0].indent : minIndent - 1,
		item: root
	}];
	for (let i = startIdx; i < rawLines.length; i++) {
		const { indent, label } = rawLines[i];
		const item = {
			id: "",
			label,
			depth: 0,
			collapsedAttr: false,
			attrs: {},
			children: []
		};
		while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
		stack[stack.length - 1].item.children.push(item);
		stack.push({
			indent,
			item
		});
	}
	assignMindMapIds(root, `${mapKey}/0`, 0);
	return root;
}
function countDescendants(item) {
	let count = 0;
	for (const ch of item.children) count += 1 + countDescendants(ch);
	return count;
}
function measureNode(node, measureCtx, maxAvailW, maxAvailH, defaultFontStyle, imageCache, resolveImage, compact, collapsedMindMapIds) {
	if (node.tag === "Heading") {
		const fontStyle = resolveFontStyle(node.attrs.font, defaultFontStyle);
		const fontSize = resolveHeadingSize(node.attrs.size, compact);
		const fontFamily = FONT_FAMILY_MAP$1[fontStyle];
		const fontWeight = fontStyle === "serif" ? 600 : 600;
		const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, maxAvailW));
		const textAlign = node.attrs.align === "left" || node.attrs.align === "start" ? "left" : node.attrs.align === "right" || node.attrs.align === "end" ? "right" : "center";
		measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
		const lines = wrapTextLines(measureCtx, node.text || "Heading", Math.max(120, maxW));
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
			children: []
		};
	}
	if (node.tag === "Text") {
		const fontStyle = resolveFontStyle(node.attrs.font, "sans");
		const fontSize = resolveBodySize(node.attrs.size, compact);
		const fontFamily = FONT_FAMILY_MAP$1[fontStyle];
		const fontWeight = 500;
		const defaultMaxW = Math.min(maxAvailW, compact ? 320 : 440);
		const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
		const textAlign = node.attrs.align === "left" || node.attrs.align === "start" ? "left" : node.attrs.align === "right" || node.attrs.align === "end" ? "right" : "left";
		measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
		const lines = wrapTextLines(measureCtx, node.text || "", Math.max(120, maxW));
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
			children: []
		};
	}
	if (node.tag === "Button") {
		const { fontSize, px, py } = resolveButtonSize(node.attrs.size);
		const fontFamily = FONT_FAMILY_MAP$1.sans;
		const fontWeight = 600;
		const label = (node.text || node.attrs.label || "Action").trim();
		measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
		const textW = Math.ceil(measureCtx.measureText(label).width);
		return {
			node,
			intrinsicWidth: Math.min(maxAvailW, Math.max(88, textW + px * 2)),
			intrinsicHeight: Math.max(44, Math.ceil(fontSize * 1.2 + py * 2)),
			lines: [label],
			fontSize,
			lineHeight: fontSize * 1.2,
			fontFamily,
			fontWeight,
			textAlign: "center",
			children: []
		};
	}
	if (node.tag === "Image") {
		const resolvedUrl = resolveImage(node.attrs.src);
		const img = resolvedUrl && imageCache.get(resolvedUrl) || null;
		const naturalRatio = (img ? getImageSourceBounds(img) : null)?.aspectRatio ?? (img && img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1);
		const reqW = node.attrs.width ? parseNum(node.attrs.width, 220) : void 0;
		const reqH = node.attrs.height ? parseNum(node.attrs.height, 220) : void 0;
		const maxImageH = Math.max(96, maxAvailH * .78);
		let w;
		let h;
		if (reqW !== void 0 && reqH !== void 0) {
			w = reqW;
			h = reqH;
		} else if (reqW !== void 0) {
			w = reqW;
			h = reqW / naturalRatio;
		} else if (reqH !== void 0) {
			h = reqH;
			w = reqH * naturalRatio;
		} else {
			const baseDim = compact ? Math.min(185, maxAvailW * .76) : 230;
			if (naturalRatio >= 1) {
				w = baseDim * Math.min(1.5, Math.sqrt(naturalRatio));
				h = w / naturalRatio;
			} else {
				h = baseDim * Math.min(1.5, 1 / Math.sqrt(naturalRatio));
				w = h * naturalRatio;
			}
		}
		const clampScale = Math.min(1, maxAvailW / Math.max(1, w), maxImageH / Math.max(1, h));
		if (clampScale < 1) {
			w *= clampScale;
			h *= clampScale;
		}
		return {
			node,
			intrinsicWidth: Math.max(48, Math.round(w)),
			intrinsicHeight: Math.max(48, Math.round(h)),
			resolvedImg: img,
			children: []
		};
	}
	if (node.tag === "Divider") {
		const vertical = node.attrs.orientation === "vertical";
		const len = Math.min(maxAvailW, parseNum(node.attrs.length || node.attrs.width, vertical ? 120 : 240));
		return {
			node,
			intrinsicWidth: vertical ? 4 : Math.max(40, len),
			intrinsicHeight: vertical ? Math.max(40, len) : 4,
			children: []
		};
	}
	if (node.tag === "Spacer") {
		const size = parseNum(node.attrs.size, 16);
		return {
			node,
			intrinsicWidth: size,
			intrinsicHeight: size,
			children: []
		};
	}
	if (node.tag === "Quote") {
		const fontStyle = resolveFontStyle(node.attrs.font, "serif");
		const fontSize = resolveBodySize(node.attrs.size, compact);
		const fontFamily = FONT_FAMILY_MAP$1[fontStyle];
		const fontWeight = 500;
		const italic = fontStyle === "serif" && node.attrs.italic !== "false";
		const barGutter = 18;
		const defaultMaxW = Math.min(maxAvailW, compact ? 310 : 420);
		const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
		const textMaxW = Math.max(100, maxW - barGutter - 6);
		measureCtx.font = `${italic ? "italic " : ""}${fontWeight} ${fontSize}px ${fontFamily}`;
		const lines = wrapTextLines(measureCtx, node.text || "Quote", textMaxW);
		const lineHeight = fontSize * 1.42;
		let widest = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 32);
		const cite = node.attrs.cite?.trim() || void 0;
		let citeSize;
		let citeLineHeight;
		if (cite) {
			citeSize = Math.max(12, Math.round(fontSize * .76));
			citeLineHeight = citeSize * 1.35;
			measureCtx.font = `500 ${citeSize}px ${FONT_FAMILY_MAP$1.sans}`;
			widest = Math.max(widest, measureCtx.measureText(`— ${cite}`).width);
		}
		const totalH = lines.length * lineHeight + (cite && citeLineHeight ? citeLineHeight + 6 : 0);
		return {
			node,
			intrinsicWidth: Math.min(maxW, Math.ceil(widest) + barGutter + 8),
			intrinsicHeight: Math.ceil(totalH),
			lines,
			fontSize,
			lineHeight,
			fontFamily,
			fontWeight,
			textAlign: "left",
			quoteData: {
				barGutter,
				cite,
				citeSize,
				citeLineHeight,
				italic
			},
			children: []
		};
	}
	if (node.tag === "Code") {
		const fontStyle = resolveFontStyle(node.attrs.font, "mono");
		const fontSize = clamp(resolveBodySize(node.attrs.size, compact) - 2, 12, 22);
		const fontFamily = FONT_FAMILY_MAP$1[fontStyle];
		const fontWeight = 500;
		const padX = 16;
		const padY = 12;
		const defaultMaxW = Math.min(maxAvailW, compact ? 320 : 460);
		const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
		const innerMaxW = Math.max(90, maxW - 32);
		measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
		const lines = wrapCodeLines(measureCtx, node.text || "", innerMaxW);
		const lineHeight = fontSize * 1.45;
		const widest = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 48);
		return {
			node,
			intrinsicWidth: Math.min(maxW, Math.max(140, Math.ceil(widest) + 32)),
			intrinsicHeight: Math.ceil(lines.length * lineHeight + 24),
			lines,
			fontSize,
			lineHeight,
			fontFamily,
			fontWeight,
			textAlign: "left",
			codeData: {
				padX,
				padY
			},
			children: []
		};
	}
	if (node.tag === "List") {
		const fontStyle = resolveFontStyle(node.attrs.font, "sans");
		const fontSize = resolveBodySize(node.attrs.size, compact);
		const fontFamily = FONT_FAMILY_MAP$1[fontStyle];
		const fontWeight = 500;
		const lineHeight = fontSize * 1.4;
		const itemGap = parseNum(node.attrs.gap, Math.round(fontSize * .42));
		const { texts, detectedOrdered } = extractListItems(node);
		const ordered = node.attrs.ordered === "true" || node.attrs.ordered !== "false" && detectedOrdered;
		const markerAttr = (node.attrs.marker || "bullet").toLowerCase();
		const markerStyle = markerAttr === "dash" ? "dash" : markerAttr === "diamond" ? "diamond" : "bullet";
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
			for (const l of itemLines) widest = Math.max(widest, measureCtx.measureText(l).width);
			totalH += itemLines.length * lineHeight + (idx > 0 ? itemGap : 0);
			return {
				lines: itemLines,
				markerLabel: ordered ? `${idx + 1}.` : void 0
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
			listData: {
				items,
				ordered,
				markerStyle,
				gutterW,
				itemGap
			},
			children: []
		};
	}
	if (node.tag === "Table") {
		const fontStyle = resolveFontStyle(node.attrs.font, "sans");
		const fontSize = clamp(resolveBodySize(node.attrs.size, compact) - 1, 12, 22);
		const fontFamily = FONT_FAMILY_MAP$1[fontStyle];
		const lineHeight = fontSize * 1.35;
		const cellPadX = compact ? 10 : 14;
		const cellPadY = compact ? 7 : 9;
		const bordered = node.attrs.bordered === "true" || node.attrs.grid === "true";
		const { rows: parsedRows, colAligns } = extractTableRows(node);
		const numCols = Math.max(1, ...parsedRows.map((r) => r.cells.length));
		const normalizedAligns = Array.from({ length: numCols }, (_, idx) => colAligns[idx] || "left");
		const hasExplicitW = Boolean(node.attrs.width || node.attrs.maxWidth);
		const defaultMaxW = Math.min(maxAvailW, compact ? 340 : 540);
		const maxW = Math.min(maxAvailW, parseNum(node.attrs.width || node.attrs.maxWidth, defaultMaxW));
		const naturalColW = new Array(numCols).fill(48 + cellPadX * 2);
		for (const row of parsedRows) {
			measureCtx.font = `${row.isHeader ? 600 : 500} ${fontSize}px ${fontFamily}`;
			for (let c = 0; c < numCols; c++) {
				const cellText = row.cells[c]?.text || "";
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
			if (diff !== 0) colWidths[numCols - 1] = Math.max(minColW, colWidths[numCols - 1] + diff);
		} else if (hasExplicitW && totalNaturalW < maxW) {
			const extra = maxW - totalNaturalW;
			colWidths = naturalColW.map((w) => w + Math.round(w / Math.max(1, totalNaturalW) * extra));
			const diff = maxW - colWidths.reduce((a, b) => a + b, 0);
			colWidths[numCols - 1] += diff;
		}
		let totalH = 0;
		const measuredRows = parsedRows.map((row) => {
			measureCtx.font = `${row.isHeader ? 600 : 500} ${fontSize}px ${fontFamily}`;
			let maxLines = 1;
			const cells = Array.from({ length: numCols }, (_, c) => {
				const parsedCell = row.cells[c];
				const align = parsedCell?.align || normalizedAligns[c];
				const cellText = parsedCell?.text || "";
				const innerCellW = Math.max(24, colWidths[c] - cellPadX * 2);
				const lines = cellText ? wrapTextLines(measureCtx, cellText, innerCellW) : [""];
				maxLines = Math.max(maxLines, lines.length);
				return {
					lines,
					align
				};
			});
			const height = Math.ceil(maxLines * lineHeight + cellPadY * 2);
			totalH += height;
			return {
				isHeader: row.isHeader,
				height,
				cells
			};
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
				bordered
			},
			children: []
		};
	}
	if (node.tag === "MindMap") {
		const layoutMode = (node.attrs.layout || "radial").toLowerCase() === "tree" ? "tree" : "radial";
		const fontFamily = FONT_FAMILY_MAP$1[resolveFontStyle(node.attrs.font, "sans")];
		const siblingGap = parseNum(node.attrs.gap, compact ? 10 : 14);
		const levelGap = parseNum(node.attrs.levelGap || node.attrs.colGap, compact ? 34 : 54);
		const branchGap = parseNum(node.attrs.branchGap, compact ? 16 : 22);
		const rootTree = extractMindMapTree(node);
		const buildWorking = (item) => {
			const hasChildren = item.children.length > 0;
			const isCollapsed = hasChildren && item.collapsedAttr !== (collapsedMindMapIds?.has(item.id) ?? false);
			const hiddenDescendantCount = isCollapsed ? countDescendants(item) : 0;
			const isRoot = item.depth === 0;
			const isPrimary = item.depth === 1;
			const fontSize = isRoot ? compact ? 16 : 19 : isPrimary ? compact ? 13.5 : 15 : compact ? 12 : 13.5;
			const fontWeight = isRoot || isPrimary ? 600 : 500;
			const padX = isRoot ? compact ? 14 : 18 : isPrimary ? compact ? 10 : 13 : compact ? 8 : 10;
			const padY = isRoot ? compact ? 8 : 10 : isPrimary ? compact ? 6 : 7 : compact ? 4 : 5;
			const maxLabelW = isRoot ? compact ? 145 : 200 : isPrimary ? compact ? 125 : 175 : compact ? 115 : 165;
			measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
			const lines = wrapTextLines(measureCtx, item.label, maxLabelW);
			const lineHeight = fontSize * 1.28;
			const labelW = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 24);
			const badgeText = isCollapsed ? `+${hiddenDescendantCount}` : hasChildren ? "−" : "";
			let badgeW = 0;
			if (badgeText) {
				measureCtx.font = `600 ${Math.max(10.5, fontSize * .78)}px ${fontFamily}`;
				badgeW = Math.ceil(measureCtx.measureText(badgeText).width) + 10;
			}
			const width = Math.ceil(labelW + padX * 2 + badgeW);
			const height = Math.ceil(lines.length * lineHeight + padY * 2);
			const visibleChildren = isCollapsed ? [] : item.children.map(buildWorking);
			const childrenSumH = visibleChildren.reduce((acc, c) => acc + c.subtreeH, 0) + Math.max(0, visibleChildren.length - 1) * siblingGap;
			const subtreeH = Math.max(height, childrenSumH);
			return {
				item,
				node: {
					id: item.id,
					label: item.label,
					lines,
					depth: item.depth,
					x: 0,
					y: 0,
					width,
					height,
					fontSize,
					lineHeight,
					fontFamily,
					fontWeight,
					padX,
					padY,
					badgeText,
					badgeW,
					dir: 0,
					totalChildCount: item.children.length,
					hiddenDescendantCount,
					isCollapsed,
					attrs: item.attrs
				},
				subtreeH,
				children: visibleChildren
			};
		};
		const rootW = buildWorking(rootTree);
		const flatNodes = [];
		const edges = [];
		const placeSubtree = (wn, anchorX, centerY, dir) => {
			wn.node.dir = dir;
			wn.node.x = dir === 1 ? anchorX : anchorX - wn.node.width;
			wn.node.y = centerY - wn.node.height * .5;
			flatNodes.push(wn.node);
			if (wn.children.length === 0) return;
			let curY = centerY - (wn.children.reduce((acc, c) => acc + c.subtreeH, 0) + Math.max(0, wn.children.length - 1) * siblingGap) * .5;
			const childAnchorX = dir === 1 ? wn.node.x + wn.node.width + levelGap : wn.node.x - levelGap;
			for (const ch of wn.children) {
				const chCenterY = curY + ch.subtreeH * .5;
				placeSubtree(ch, childAnchorX, chCenterY, dir);
				edges.push({
					fromId: wn.node.id,
					toId: ch.node.id,
					childDepth: ch.node.depth,
					x0: dir === 1 ? wn.node.x + wn.node.width : wn.node.x,
					y0: wn.node.y + wn.node.height * .5,
					x1: dir === 1 ? ch.node.x : ch.node.x + ch.node.width,
					y1: ch.node.y + ch.node.height * .5
				});
				curY += ch.subtreeH + siblingGap;
			}
		};
		if (layoutMode === "tree") {
			rootW.node.dir = 1;
			placeSubtree(rootW, 0, rootW.subtreeH * .5, 1);
		} else {
			rootW.node.dir = 0;
			rootW.node.x = -rootW.node.width * .5;
			rootW.node.y = -rootW.node.height * .5;
			flatNodes.push(rootW.node);
			const rightBranches = [];
			const leftBranches = [];
			let rightSum = 0;
			let leftSum = 0;
			rootW.children.forEach((branch, idx) => {
				if (idx % 2 === 0 ? rightSum <= leftSum + 24 : rightSum < leftSum - 24) {
					rightBranches.push(branch);
					rightSum += branch.subtreeH + branchGap;
				} else {
					leftBranches.push(branch);
					leftSum += branch.subtreeH + branchGap;
				}
			});
			const placeHemisphere = (branches, dir) => {
				if (branches.length === 0) return;
				const totalH = branches.reduce((acc, b) => acc + b.subtreeH, 0) + Math.max(0, branches.length - 1) * branchGap;
				let curY = -totalH * .5;
				for (const b of branches) {
					const bCenterY = curY + b.subtreeH * .5;
					const vNorm = totalH > 1 ? clamp(bCenterY / (totalH * .5), -1, 1) : 0;
					const arcGap = levelGap * (1.22 - .28 * vNorm * vNorm);
					const anchorX = dir === 1 ? rootW.node.width * .5 + arcGap : -rootW.node.width * .5 - arcGap;
					placeSubtree(b, anchorX, bCenterY, dir);
					edges.push({
						fromId: rootW.node.id,
						toId: b.node.id,
						childDepth: b.node.depth,
						x0: dir === 1 ? rootW.node.x + rootW.node.width : rootW.node.x,
						y0: clamp(bCenterY * .24, -rootW.node.height * .26, rootW.node.height * .26),
						x1: dir === 1 ? b.node.x : b.node.x + b.node.width,
						y1: b.node.y + b.node.height * .5
					});
					curY += b.subtreeH + branchGap;
				}
			};
			placeHemisphere(rightBranches, 1);
			placeHemisphere(leftBranches, -1);
		}
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const n of flatNodes) {
			minX = Math.min(minX, n.x);
			minY = Math.min(minY, n.y);
			maxX = Math.max(maxX, n.x + n.width);
			maxY = Math.max(maxY, n.y + n.height);
		}
		const padOuter = 4;
		const shiftX = -minX + padOuter;
		const shiftY = -minY + padOuter;
		for (const n of flatNodes) {
			n.x += shiftX;
			n.y += shiftY;
		}
		for (const e of edges) {
			e.x0 += shiftX;
			e.y0 += shiftY;
			e.x1 += shiftX;
			e.y1 += shiftY;
		}
		return {
			node,
			intrinsicWidth: Math.max(120, Math.ceil(maxX - minX + 8)),
			intrinsicHeight: Math.max(60, Math.ceil(maxY - minY + 8)),
			mindMapData: {
				layout: layoutMode,
				nodes: flatNodes,
				edges
			},
			children: []
		};
	}
	const pad = parseNum(node.attrs.padding, 0);
	const gap = parseNum(node.attrs.gap, node.tag === "Row" ? 20 : 16);
	const containerMaxW = node.attrs.width ? Math.min(maxAvailW, parseNum(node.attrs.width, maxAvailW)) : maxAvailW;
	const innerAvailW = Math.max(80, containerMaxW - pad * 2);
	const measuredChildren = node.children.map((child) => measureNode(child, measureCtx, innerAvailW, Math.max(96, maxAvailH - pad * 2), defaultFontStyle, imageCache, resolveImage, compact, collapsedMindMapIds));
	if (node.tag === "Row") {
		const allowWrap = node.attrs.wrap === "true" || compact;
		const rows = [];
		let currentRow = [];
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
			const rW = r.reduce((acc, item) => acc + item.intrinsicWidth, 0) + Math.max(0, r.length - 1) * gap;
			const rH = Math.max(...r.map((item) => item.intrinsicHeight), 0);
			if (rW > maxRowW) maxRowW = rW;
			totalH += rH + (idx > 0 ? gap : 0);
		});
		return {
			node,
			intrinsicWidth: maxRowW + pad * 2,
			intrinsicHeight: totalH + pad * 2,
			children: measuredChildren,
			wrappedRows: rows
		};
	}
	const totalH = measuredChildren.reduce((acc, item) => acc + item.intrinsicHeight, 0) + Math.max(0, measuredChildren.length - 1) * gap;
	return {
		node,
		intrinsicWidth: Math.max(...measuredChildren.map((item) => item.intrinsicWidth), 0) + pad * 2,
		intrinsicHeight: totalH + pad * 2,
		children: measuredChildren
	};
}
function arrangeNode(measured, rect, outLeaves, inheritedRipple = {}) {
	const { node } = measured;
	const localRipple = mergeRippleConfig(inheritedRipple, node.attrs);
	if (node.tag !== "Col" && node.tag !== "Row") {
		outLeaves.push({
			measured,
			rect,
			ripple: localRipple
		});
		return;
	}
	const pad = parseNum(node.attrs.padding, 0);
	const gap = parseNum(node.attrs.gap, node.tag === "Row" ? 20 : 16);
	const align = (node.attrs.align || "center").toLowerCase();
	const justify = (node.attrs.justify || "center").toLowerCase();
	const innerX = rect.x + pad;
	const innerY = rect.y + pad;
	const innerW = Math.max(1, rect.width - pad * 2);
	const innerH = Math.max(1, rect.height - pad * 2);
	if (node.tag === "Row") {
		const rows = measured.wrappedRows || [measured.children];
		const rowHeights = rows.map((r) => Math.max(...r.map((c) => c.intrinsicHeight), 0));
		const totalRowsH = rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, rows.length - 1) * gap;
		let cursorY = innerY + Math.max(0, (innerH - totalRowsH) * .5);
		rows.forEach((rowChildren, rIdx) => {
			const rowH = rowHeights[rIdx];
			const contentW = rowChildren.reduce((a, c) => a + c.intrinsicWidth, 0) + Math.max(0, rowChildren.length - 1) * gap;
			let cursorX = innerX;
			let extraGap = gap;
			if (justify === "center") cursorX = innerX + Math.max(0, (innerW - contentW) * .5);
			else if (justify === "end" || justify === "right") cursorX = innerX + Math.max(0, innerW - contentW);
			else if (justify === "between" && rowChildren.length > 1) {
				const sumWidths = rowChildren.reduce((a, c) => a + c.intrinsicWidth, 0);
				extraGap = Math.max(gap, (innerW - sumWidths) / (rowChildren.length - 1));
			}
			for (const ch of rowChildren) {
				let cy = cursorY;
				if (align === "center") cy = cursorY + (rowH - ch.intrinsicHeight) * .5;
				else if (align === "end" || align === "bottom") cy = cursorY + (rowH - ch.intrinsicHeight);
				arrangeNode(ch, {
					x: cursorX,
					y: cy,
					width: ch.intrinsicWidth,
					height: ch.intrinsicHeight
				}, outLeaves, localRipple);
				cursorX += ch.intrinsicWidth + extraGap;
			}
			cursorY += rowH + gap;
		});
		return;
	}
	const contentH = measured.children.reduce((a, c) => a + c.intrinsicHeight, 0) + Math.max(0, measured.children.length - 1) * gap;
	let cursorY = innerY;
	let extraGap = gap;
	if (justify === "center") cursorY = innerY + Math.max(0, (innerH - contentH) * .5);
	else if (justify === "end" || justify === "bottom") cursorY = innerY + Math.max(0, innerH - contentH);
	else if (justify === "between" && measured.children.length > 1) {
		const sumHeights = measured.children.reduce((a, c) => a + c.intrinsicHeight, 0);
		extraGap = Math.max(gap, (innerH - sumHeights) / (measured.children.length - 1));
	}
	for (const ch of measured.children) {
		let cx = innerX;
		if (align === "center") cx = innerX + (innerW - ch.intrinsicWidth) * .5;
		else if (align === "end" || align === "right") cx = innerX + (innerW - ch.intrinsicWidth);
		arrangeNode(ch, {
			x: cx,
			y: cursorY,
			width: ch.intrinsicWidth,
			height: ch.intrinsicHeight
		}, outLeaves, localRipple);
		cursorY += ch.intrinsicHeight + extraGap;
	}
}
function sampleCanvasRegion(drawFn, rect, density, baseFontSize, regionId, stepOverride) {
	const w = Math.max(12, Math.ceil(rect.width));
	const h = Math.max(12, Math.ceil(rect.height));
	const sampleScale = baseFontSize <= 54 ? 2 : 1;
	const offscreen = document.createElement("canvas");
	offscreen.width = w * sampleScale;
	offscreen.height = h * sampleScale;
	const ctx = offscreen.getContext("2d", { willReadFrequently: true });
	if (!ctx) return [];
	ctx.setTransform(sampleScale, 0, 0, sampleScale, 0, 0);
	ctx.clearRect(0, 0, w, h);
	drawFn(ctx, w, h);
	const data = ctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
	const baseStep = density === "dense" ? 1 : density === "balanced" ? 2 : 3;
	const step = stepOverride ?? (baseFontSize <= 26 && sampleScale === 2 ? Math.min(2, baseStep) : baseStep);
	const alphaThreshold = baseFontSize <= 36 ? 105 : 95;
	const jitter = step / sampleScale * (baseFontSize <= 26 ? .34 : .48);
	const points = [];
	for (let y = 0; y < offscreen.height; y += step) {
		const row = y * offscreen.width;
		const pyBase = rect.y + y / sampleScale;
		for (let x = 0; x < offscreen.width; x += step) {
			const a = data[(row + x) * 4 + 3];
			if (a > alphaThreshold) {
				const pxBase = rect.x + x / sampleScale;
				const normA = a / 255;
				points.push({
					x: pxBase + (Math.random() - .5) * jitter,
					y: pyBase + (Math.random() - .5) * jitter,
					weight: clamp(.45 + normA * .55, .35, 1),
					regionId
				});
			}
		}
	}
	return points;
}
function drawRoundedRectPath(ctx, x, y, w, h, r) {
	const rad = Math.min(r, w * .5, h * .5);
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
function emitParticleLine(out, x0, y0, x1, y1, stepPx, weight, jitterPx, regionId) {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const count = Math.max(2, Math.round(Math.hypot(dx, dy) / Math.max(.8, stepPx)));
	for (let i = 0; i <= count; i++) {
		const t = i / count;
		out.push({
			x: x0 + dx * t + (Math.random() - .5) * jitterPx,
			y: y0 + dy * t + (Math.random() - .5) * jitterPx,
			weight,
			regionId
		});
	}
}
function emitParticleCubicBezier(out, x0, y0, cx1, cy1, cx2, cy2, x1, y1, stepPx, weight, jitterPx, regionId) {
	const approxLen = (Math.hypot(cx1 - x0, cy1 - y0) + Math.hypot(cx2 - cx1, cy2 - cy1) + Math.hypot(x1 - cx2, y1 - cy2) + Math.hypot(x1 - x0, y1 - y0)) * .65;
	const count = Math.max(10, Math.round(approxLen / Math.max(1, stepPx)));
	for (let i = 0; i <= count; i++) {
		const t = i / count;
		const u = 1 - t;
		const px = u * u * u * x0 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x1;
		const py = u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y1;
		out.push({
			x: px + (Math.random() - .5) * jitterPx,
			y: py + (Math.random() - .5) * jitterPx,
			weight,
			regionId
		});
	}
}
function emitParticleRoundedRect(out, x, y, w, h, stepPx, weight, jitterPx, regionId) {
	const perim = 2 * (w + h);
	const count = Math.max(24, Math.round(perim / Math.max(1.2, stepPx)));
	for (let i = 0; i < count; i++) {
		const d = i / count * perim;
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
			x: bx + (Math.random() - .5) * jitterPx,
			y: by + (Math.random() - .5) * jitterPx,
			weight,
			regionId
		});
	}
}
/**
* Resolves a declarative LayoutNode AST into screen coordinates, interactive HitRegions,
* and unified particle targets across Headings, Texts, Images, Buttons, Markdown blocks, and MindMaps.
*/
function sampleLayoutScene(root, viewportWidth, viewportHeight, density, defaultFontStyle, invertContrast, isDarkTheme, imageTuning, imageCache, resolveImage, sceneOptions = {}) {
	const empty = {
		points: [],
		hitRegions: [],
		rippleRegions: [],
		cellSize: 2,
		scrollMax: 0,
		screenBudget: 0,
		priorityRegionIds: []
	};
	if (!root || viewportWidth < 120 || viewportHeight < 120) return empty;
	const measureCtx = document.createElement("canvas").getContext("2d");
	if (!measureCtx) return empty;
	const { leftInset = 0, collapsedMindMapIds, overflow = "scroll", minFontSize = 14, particleBudget, trim = true } = sceneOptions;
	const compact = viewportWidth < 640;
	const defaultPad = compact ? 16 : 32;
	const padding = sceneOptions.padding ?? {
		top: defaultPad,
		right: defaultPad,
		bottom: defaultPad,
		left: defaultPad
	};
	const topReserve = padding.top;
	const bottomReserve = padding.bottom;
	const usableLeft = leftInset + padding.left;
	const usableRight = viewportWidth - padding.right;
	const safeW = Math.max(160, usableRight - usableLeft);
	const safeH = Math.max(96, viewportHeight - topReserve - bottomReserve);
	const measured = measureNode(root, measureCtx, Math.min(safeW, 920), safeH, defaultFontStyle, imageCache, resolveImage, compact, collapsedMindMapIds);
	const widthFit = safeW / Math.max(1, measured.intrinsicWidth);
	const heightFit = safeH / Math.max(1, measured.intrinsicHeight);
	let fitScale;
	if (overflow === "fit") fitScale = Math.min(1, widthFit, heightFit);
	else {
		const smallest = smallestFontSize(measured);
		const legibleFloor = Number.isFinite(smallest) ? Math.min(1, minFontSize / smallest) : 1;
		fitScale = Math.min(1, widthFit, Math.max(heightFit, legibleFloor));
	}
	const rootW = measured.intrinsicWidth;
	const rootH = measured.intrinsicHeight;
	const scaledH = rootH * fitScale;
	const overflows = overflow === "scroll" && scaledH > safeH + .5;
	const scrollMax = overflows ? Math.ceil(scaledH - safeH) : 0;
	const rootX = usableLeft + (safeW - rootW) * .5;
	const rootY = overflows ? topReserve : topReserve + (safeH - rootH) * .5;
	const placedLeaves = [];
	arrangeNode(measured, {
		x: rootX,
		y: rootY,
		width: rootW,
		height: rootH
	}, placedLeaves);
	if (fitScale < .995) {
		const cx = usableLeft + safeW * .5;
		const cy = overflows ? topReserve : topReserve + safeH * .5;
		for (const leaf of placedLeaves) {
			leaf.rect = {
				x: cx + (leaf.rect.x - cx) * fitScale,
				y: cy + (leaf.rect.y - cy) * fitScale,
				width: leaf.rect.width * fitScale,
				height: leaf.rect.height * fitScale
			};
			if (leaf.measured.fontSize) leaf.measured.fontSize *= fitScale;
			if (leaf.measured.lineHeight) leaf.measured.lineHeight *= fitScale;
			if (leaf.measured.quoteData) {
				leaf.measured.quoteData.barGutter *= fitScale;
				if (leaf.measured.quoteData.citeSize) leaf.measured.quoteData.citeSize *= fitScale;
				if (leaf.measured.quoteData.citeLineHeight) leaf.measured.quoteData.citeLineHeight *= fitScale;
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
				leaf.measured.tableData.colWidths = leaf.measured.tableData.colWidths.map((cw) => cw * fitScale);
				for (const r of leaf.measured.tableData.rows) r.height *= fitScale;
			}
		}
	}
	const totalBudget = Math.max(1e3, Math.round(particleBudget ?? LAYOUT_BUDGET_BY_DENSITY[density]));
	const hitRegions = [];
	const rippleRegions = [];
	const buttonRegionIds = /* @__PURE__ */ new Set();
	const textAndControlPoints = [];
	const imageLeaves = [];
	for (const leaf of placedLeaves) {
		const { node } = leaf.measured;
		const { rect, ripple } = leaf;
		if (node.tag === "Spacer") continue;
		const regionId = rippleRegions.length;
		rippleRegions.push({
			id: regionId,
			tag: node.tag,
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			cx: rect.x + rect.width * .5,
			cy: rect.y + rect.height * .5,
			pattern: ripple.pattern,
			trigger: ripple.trigger,
			strength: ripple.strength,
			speed: ripple.speed,
			wavelength: ripple.wavelength
		});
		if (node.tag === "Image") {
			imageLeaves.push({
				leaf,
				regionId
			});
			continue;
		}
		if (node.tag === "MindMap" && leaf.measured.mindMapData) {
			rippleRegions.pop();
			const mmData = leaf.measured.mindMapData;
			const sx = rect.width / Math.max(1, leaf.measured.intrinsicWidth);
			const sy = rect.height / Math.max(1, leaf.measured.intrinsicHeight);
			const nodeRegionMap = /* @__PURE__ */ new Map();
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
					tag: mmNode.depth === 0 ? "MindMap" : "Branch",
					x: nx,
					y: ny,
					width: nw,
					height: nh,
					cx: nx + nw * .5,
					cy: ny + nh * .5,
					pattern: mmRipple.pattern,
					trigger: mmRipple.trigger,
					strength: mmRipple.strength,
					speed: mmRipple.speed,
					wavelength: mmRipple.wavelength
				});
				if (mmNode.totalChildCount > 0) {
					const hitPad = 4;
					hitRegions.push({
						id: hitRegions.length,
						rippleRegionId: nodeRegionId,
						x: nx - hitPad,
						y: ny - hitPad,
						width: nw + 8,
						height: nh + 8,
						action: `mindmap:toggle:${mmNode.id}`,
						label: mmNode.label
					});
				}
				const labelPts = sampleCanvasRegion((ctx, w, h) => {
					ctx.fillStyle = "#ffffff";
					ctx.font = `${mmNode.fontWeight} ${nFontSize}px ${mmNode.fontFamily}`;
					ctx.textBaseline = "middle";
					const contentW = Math.max(16, w - nPadX * 2 - nBadgeW);
					const startY = (h - mmNode.lines.length * nLineHeight) * .5 + nLineHeight * .5;
					ctx.textAlign = "center";
					const textAnchorX = nPadX + contentW * .5;
					mmNode.lines.forEach((line, idx) => {
						ctx.fillText(line, textAnchorX, startY + idx * nLineHeight);
					});
					if (mmNode.badgeText) {
						const badgeSize = Math.max(9.5, nFontSize * .78);
						ctx.fillStyle = mmNode.isCollapsed ? "#ffffff" : "rgba(255, 255, 255, 0.72)";
						ctx.font = `600 ${badgeSize}px ${mmNode.fontFamily}`;
						ctx.textAlign = "right";
						ctx.fillText(mmNode.badgeText, w - nPadX * .8, h * .5 + .5);
					}
				}, {
					x: nx,
					y: ny,
					width: nw,
					height: nh
				}, density, nFontSize, nodeRegionId);
				const textBoost = mmNode.depth === 0 ? .96 : mmNode.depth === 1 ? .88 : .82;
				for (const pt of labelPts) {
					pt.weight = clamp((pt.weight ?? .84) * textBoost, .4, 1);
					textAndControlPoints.push(pt);
				}
				if (mmNode.depth <= 1 || mmNode.isCollapsed) {
					const borderStep = mmNode.depth === 0 ? density === "dense" ? 1.9 : 2.5 : density === "dense" ? 2.4 : 3.1;
					const borderWeight = mmNode.depth === 0 ? .92 : mmNode.isCollapsed ? .88 : .72;
					emitParticleRoundedRect(textAndControlPoints, nx + 1.5, ny + 1.5, Math.max(8, nw - 3), Math.max(8, nh - 3), borderStep, borderWeight, .9, nodeRegionId);
				} else {
					const lineStep = density === "dense" ? 2.1 : 2.8;
					emitParticleLine(textAndControlPoints, nx + 4, ny + nh - 1.5, nx + nw - 4, ny + nh - 1.5, lineStep, .58, .8, nodeRegionId);
				}
			}
			const curveStep = density === "dense" ? 2 : density === "balanced" ? 2.6 : 3.4;
			for (const edge of mmData.edges) {
				const targetRegionId = nodeRegionMap.get(edge.toId) ?? regionId;
				const x0 = rect.x + edge.x0 * sx;
				const y0 = rect.y + edge.y0 * sy;
				const x1 = rect.x + edge.x1 * sx;
				const y1 = rect.y + edge.y1 * sy;
				const dx = x1 - x0;
				emitParticleCubicBezier(textAndControlPoints, x0, y0, x0 + dx * .48, y0, x1 - dx * .48, y1, x1, y1, curveStep, clamp(.66 - edge.childDepth * .08, .46, .68), .95, targetRegionId);
				for (let d = 0; d < 4; d++) textAndControlPoints.push({
					x: x1 + (Math.random() - .5) * 2.2,
					y: y1 + (Math.random() - .5) * 2.2,
					weight: .85,
					regionId: targetRegionId
				});
			}
			continue;
		}
		if (node.tag === "Divider") {
			const vertical = node.attrs.orientation === "vertical";
			const count = Math.max(24, Math.round((vertical ? rect.height : rect.width) * (density === "dense" ? 1.4 : .95)));
			for (let i = 0; i < count; i++) {
				const t = i / Math.max(1, count - 1);
				const centerGlow = .45 + .55 * Math.sin(t * Math.PI);
				textAndControlPoints.push({
					x: vertical ? rect.x + rect.width * .5 + (Math.random() - .5) * 1.4 : rect.x + t * rect.width,
					y: vertical ? rect.y + t * rect.height : rect.y + rect.height * .5 + (Math.random() - .5) * 1.4,
					weight: centerGlow * .78,
					regionId
				});
			}
			continue;
		}
		if (node.tag === "Button") {
			const hitId = hitRegions.length;
			const label = leaf.measured.lines?.[0] || "Action";
			const action = node.attrs.action || "scatter";
			buttonRegionIds.add(regionId);
			hitRegions.push({
				id: hitId,
				rippleRegionId: regionId,
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				action,
				label
			});
			const isSolid = node.attrs.variant === "solid" || node.attrs.solid === "true";
			const fontSize = leaf.measured.fontSize || 16;
			const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP$1.sans;
			const fontWeight = 600;
			if (isSolid) {
				const platePts = sampleCanvasRegion((ctx, w, h) => {
					drawRoundedRectPath(ctx, 4, 4, w - 8, h - 8, 7);
					ctx.fillStyle = "#ffffff";
					ctx.fill();
					ctx.save();
					ctx.globalCompositeOperation = "destination-out";
					ctx.fillStyle = "#ffffff";
					ctx.strokeStyle = "#ffffff";
					ctx.lineWidth = 6.5;
					ctx.lineJoin = "round";
					ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.strokeText(label, w * .5, h * .5 + .5);
					ctx.fillText(label, w * .5, h * .5 + .5);
					ctx.restore();
				}, rect, density, fontSize, regionId, density === "dense" ? 5 : density === "balanced" ? 6 : 7);
				for (const pt of platePts) {
					pt.weight = .34;
					textAndControlPoints.push(pt);
				}
			}
			const btnPts = sampleCanvasRegion((ctx, w, h) => {
				drawRoundedRectPath(ctx, 2, 2, w - 4, h - 4, 9);
				ctx.strokeStyle = "#ffffff";
				ctx.lineWidth = isSolid ? 2.6 : 2.1;
				ctx.stroke();
				ctx.fillStyle = "#ffffff";
				ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(label, w * .5, h * .5 + .5);
			}, rect, density, fontSize, regionId);
			const perimeterDots = Math.max(44, Math.round((rect.width + rect.height) * .7));
			const perim = 2 * (rect.width + rect.height);
			for (let i = 0; i < perimeterDots; i++) {
				const d = i / perimeterDots * perim;
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
					x: bx + (Math.random() - .5) * 1.1,
					y: by + (Math.random() - .5) * 1.1,
					weight: isSolid ? .96 : .78,
					regionId
				});
			}
			for (const pt of btnPts) {
				if (isSolid) pt.weight = clamp((pt.weight ?? .85) * 1.08, .72, 1);
				textAndControlPoints.push(pt);
			}
			continue;
		}
		if (node.tag === "Quote") {
			const qData = leaf.measured.quoteData;
			const lines = leaf.measured.lines || [];
			const fontSize = leaf.measured.fontSize || 18;
			const lineHeight = leaf.measured.lineHeight || fontSize * 1.42;
			const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP$1.serif;
			const fontWeight = leaf.measured.fontWeight || 500;
			const barGutter = qData?.barGutter ?? 18;
			const italic = qData?.italic ?? true;
			const barStep = density === "dense" ? 1.5 : density === "balanced" ? 2.1 : 2.8;
			emitParticleLine(textAndControlPoints, rect.x + 2, rect.y + 3, rect.x + 2, rect.y + rect.height - 3, barStep, .92, 1.1, regionId);
			emitParticleLine(textAndControlPoints, rect.x + 3.6, rect.y + 4, rect.x + 3.6, rect.y + rect.height - 4, barStep, .84, 1, regionId);
			const qPts = sampleCanvasRegion((ctx) => {
				ctx.fillStyle = "#ffffff";
				ctx.font = `${italic ? "italic " : ""}${fontWeight} ${fontSize}px ${fontFamily}`;
				ctx.textAlign = "left";
				ctx.textBaseline = "middle";
				lines.forEach((line, idx) => {
					ctx.fillText(line, barGutter, idx * lineHeight + lineHeight * .5);
				});
				if (qData?.cite && qData.citeSize && qData.citeLineHeight) {
					ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
					ctx.font = `500 ${qData.citeSize}px ${FONT_FAMILY_MAP$1.sans}`;
					const citeY = lines.length * lineHeight + 6 + qData.citeLineHeight * .5;
					ctx.fillText(`— ${qData.cite}`, barGutter, citeY);
				}
			}, rect, density, fontSize, regionId);
			const opacityScale = parseNum(node.attrs.opacity, .86);
			for (const pt of qPts) {
				pt.weight = clamp((pt.weight ?? .84) * opacityScale, .35, 1);
				textAndControlPoints.push(pt);
			}
			continue;
		}
		if (node.tag === "Code") {
			const cData = leaf.measured.codeData;
			const lines = leaf.measured.lines || [];
			const fontSize = leaf.measured.fontSize || 15;
			const lineHeight = leaf.measured.lineHeight || fontSize * 1.45;
			const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP$1.mono;
			const padX = cData?.padX ?? 16;
			const padY = cData?.padY ?? 12;
			const codePts = sampleCanvasRegion((ctx) => {
				ctx.fillStyle = "#ffffff";
				ctx.font = `500 ${fontSize}px ${fontFamily}`;
				ctx.textAlign = "left";
				ctx.textBaseline = "middle";
				lines.forEach((line, idx) => {
					if (line) ctx.fillText(line, padX, padY + idx * lineHeight + lineHeight * .5);
				});
			}, rect, density, fontSize, regionId);
			const boxStep = density === "dense" ? 2.2 : density === "balanced" ? 2.8 : 3.6;
			const x0 = rect.x + 2;
			const y0 = rect.y + 2;
			const x1 = rect.x + rect.width - 2;
			const y1 = rect.y + rect.height - 2;
			emitParticleLine(textAndControlPoints, x0, y0, x1, y0, boxStep, .62, .9, regionId);
			emitParticleLine(textAndControlPoints, x1, y0, x1, y1, boxStep, .62, .9, regionId);
			emitParticleLine(textAndControlPoints, x1, y1, x0, y1, boxStep, .62, .9, regionId);
			emitParticleLine(textAndControlPoints, x0, y1, x0, y0, boxStep, .62, .9, regionId);
			for (const pt of codePts) {
				pt.weight = clamp((pt.weight ?? .85) * .92, .35, 1);
				textAndControlPoints.push(pt);
			}
			continue;
		}
		if (node.tag === "List" && leaf.measured.listData) {
			const { items, ordered, markerStyle, gutterW, itemGap } = leaf.measured.listData;
			const fontSize = leaf.measured.fontSize || 18;
			const lineHeight = leaf.measured.lineHeight || fontSize * 1.4;
			const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP$1.sans;
			const fontWeight = leaf.measured.fontWeight || 500;
			const listPts = sampleCanvasRegion((ctx) => {
				ctx.fillStyle = "#ffffff";
				ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
				ctx.textBaseline = "middle";
				let curY = 0;
				items.forEach((item, idx) => {
					if (ordered && item.markerLabel) {
						ctx.textAlign = "right";
						ctx.fillText(item.markerLabel, gutterW - 9, curY + lineHeight * .5);
					}
					ctx.textAlign = "left";
					item.lines.forEach((line, lIdx) => {
						ctx.fillText(line, gutterW, curY + lIdx * lineHeight + lineHeight * .5);
					});
					curY += item.lines.length * lineHeight + (idx < items.length - 1 ? itemGap : 0);
				});
			}, rect, density, fontSize, regionId);
			if (!ordered) {
				let curY = 0;
				const bulletDots = density === "dense" ? 12 : density === "balanced" ? 9 : 6;
				items.forEach((item) => {
					const bx = rect.x + gutterW * .44;
					const by = rect.y + curY + lineHeight * .5;
					if (markerStyle === "dash") emitParticleLine(textAndControlPoints, bx - 4, by, bx + 4, by, 1.2, .94, .7, regionId);
					else if (markerStyle === "diamond") {
						const r = 3;
						emitParticleLine(textAndControlPoints, bx, by - r, bx + r, by, 1.3, .94, .5, regionId);
						emitParticleLine(textAndControlPoints, bx + r, by, bx, by + r, 1.3, .94, .5, regionId);
						emitParticleLine(textAndControlPoints, bx, by + r, bx - r, by, 1.3, .94, .5, regionId);
						emitParticleLine(textAndControlPoints, bx - r, by, bx, by - r, 1.3, .94, .5, regionId);
					} else for (let d = 0; d < bulletDots; d++) {
						const ang = d / bulletDots * Math.PI * 2;
						const rad = d === 0 ? 0 : 1.1 + Math.random() * 1.4;
						textAndControlPoints.push({
							x: bx + Math.cos(ang) * rad,
							y: by + Math.sin(ang) * rad,
							weight: .94,
							regionId
						});
					}
					curY += item.lines.length * lineHeight + itemGap;
				});
			}
			const opacityScale = parseNum(node.attrs.opacity, .84);
			for (const pt of listPts) {
				pt.weight = clamp((pt.weight ?? .8) * opacityScale, .34, 1);
				textAndControlPoints.push(pt);
			}
			continue;
		}
		if (node.tag === "Table" && leaf.measured.tableData) {
			const { colWidths, rows, cellPadX, cellPadY, bordered } = leaf.measured.tableData;
			const fontSize = leaf.measured.fontSize || 16;
			const lineHeight = leaf.measured.lineHeight || fontSize * 1.35;
			const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP$1.sans;
			const tablePts = sampleCanvasRegion((ctx) => {
				ctx.textBaseline = "middle";
				let rowY = 0;
				for (const row of rows) {
					ctx.fillStyle = row.isHeader ? "#ffffff" : "rgba(255, 255, 255, 0.82)";
					ctx.font = `${row.isHeader ? 600 : 500} ${fontSize}px ${fontFamily}`;
					let colX = 0;
					row.cells.forEach((cell, cIdx) => {
						const cw = colWidths[cIdx] || 80;
						ctx.textAlign = cell.align;
						const anchorX = cell.align === "center" ? colX + cw * .5 : cell.align === "right" ? colX + cw - cellPadX : colX + cellPadX;
						cell.lines.forEach((line, lIdx) => {
							if (line) ctx.fillText(line, anchorX, rowY + cellPadY + lIdx * lineHeight + lineHeight * .5);
						});
						colX += cw;
					});
					rowY += row.height;
				}
			}, rect, density, fontSize, regionId);
			for (const pt of tablePts) {
				pt.weight = clamp((pt.weight ?? .82) * .9, .35, 1);
				textAndControlPoints.push(pt);
			}
			const headerStep = density === "dense" ? 1.5 : density === "balanced" ? 2 : 2.7;
			const rowStep = density === "dense" ? 2.4 : density === "balanced" ? 3.2 : 4.2;
			let ruleY = rect.y;
			rows.forEach((row, rIdx) => {
				ruleY += row.height;
				if (rIdx < rows.length - 1) emitParticleLine(textAndControlPoints, rect.x + 2, ruleY, rect.x + rect.width - 2, ruleY, row.isHeader ? headerStep : rowStep, row.isHeader ? .84 : .46, row.isHeader ? 1.1 : .8, regionId);
			});
			if (bordered) {
				const gridStep = density === "dense" ? 2.2 : 3;
				let colX = rect.x;
				for (let c = 0; c < colWidths.length - 1; c++) {
					colX += colWidths[c];
					emitParticleLine(textAndControlPoints, colX, rect.y + 2, colX, rect.y + rect.height - 2, gridStep, .44, .8, regionId);
				}
				emitParticleLine(textAndControlPoints, rect.x, rect.y, rect.x + rect.width, rect.y, gridStep, .62, .8, regionId);
				emitParticleLine(textAndControlPoints, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, gridStep, .62, .8, regionId);
				emitParticleLine(textAndControlPoints, rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height, gridStep, .62, .8, regionId);
				emitParticleLine(textAndControlPoints, rect.x, rect.y + rect.height, rect.x, rect.y, gridStep, .62, .8, regionId);
			}
			continue;
		}
		const lines = leaf.measured.lines || [];
		const fontSize = leaf.measured.fontSize || 24;
		const lineHeight = leaf.measured.lineHeight || fontSize * 1.25;
		const fontFamily = leaf.measured.fontFamily || FONT_FAMILY_MAP$1.sans;
		const fontWeight = leaf.measured.fontWeight || 500;
		const align = leaf.measured.textAlign || "center";
		const isHeading = node.tag === "Heading";
		const txtPts = sampleCanvasRegion((ctx, w, h) => {
			ctx.fillStyle = "#ffffff";
			ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
			ctx.textAlign = align;
			ctx.textBaseline = "middle";
			const anchorX = align === "left" ? 2 : align === "right" ? w - 2 : w * .5;
			const startY = (h - lines.length * lineHeight) * .5 + lineHeight * .5;
			lines.forEach((line, idx) => {
				ctx.fillText(line, anchorX, startY + idx * lineHeight);
			});
		}, rect, density, fontSize, regionId);
		const alphaBoost = isHeading ? .92 : parseNum(node.attrs.opacity, .78);
		for (const pt of txtPts) {
			pt.weight = clamp((pt.weight ?? .8) * alphaBoost, .3, 1);
			textAndControlPoints.push(pt);
		}
	}
	const remainingForImages = Math.max(4500, totalBudget - Math.min(textAndControlPoints.length, Math.round(totalBudget * .65)));
	const perImageBudget = imageLeaves.length > 0 ? Math.max(3800, Math.round(remainingForImages / imageLeaves.length)) : 0;
	let imageCellSize = 2;
	const imagePoints = [];
	for (const { leaf, regionId } of imageLeaves) {
		const img = leaf.measured.resolvedImg;
		if (!img) continue;
		const { attrs } = leaf.measured.node;
		const localInvert = attrs.invert === "true" ? !invertContrast : attrs.invert === "false" ? false : invertContrast;
		const blurDisabled = attrs.blurStyle === "none" || attrs.blurStyle === "off";
		const localTuning = {
			blurStyle: attrs.blurStyle === "edge" ? "edge" : attrs.blurStyle === "radial" ? "radial" : imageTuning.blurStyle,
			edgeBlur: blurDisabled ? 0 : attrs.blur !== void 0 ? parseNum(attrs.blur, imageTuning.edgeBlur) : imageTuning.edgeBlur,
			contrast: attrs.contrast !== void 0 ? parseNum(attrs.contrast, imageTuning.contrast) : imageTuning.contrast,
			detail: attrs.detail !== void 0 ? parseNum(attrs.detail, imageTuning.detail) : imageTuning.detail
		};
		const res = sampleImageIntoBox(img, leaf.rect.x, leaf.rect.y, leaf.rect.width, leaf.rect.height, density, localInvert, isDarkTheme, localTuning, perImageBudget);
		const rr = rippleRegions[regionId];
		if (rr && res.bounds.width > 12 && res.bounds.height > 12) {
			rr.x = res.bounds.x;
			rr.y = res.bounds.y;
			rr.width = res.bounds.width;
			rr.height = res.bounds.height;
			rr.cx = res.bounds.x + res.bounds.width * .5;
			rr.cy = res.bounds.y + res.bounds.height * .5;
		}
		imageCellSize = Math.max(imageCellSize, res.cellSize);
		for (const pt of res.points) {
			pt.regionId = regionId;
			imagePoints.push(pt);
		}
	}
	let finalPoints;
	if (scrollMax > 0 || !trim) finalPoints = [...textAndControlPoints, ...imagePoints];
	else if (textAndControlPoints.length + imagePoints.length > totalBudget) {
		const buttonPts = textAndControlPoints.filter((p) => p.regionId !== void 0 && buttonRegionIds.has(p.regionId));
		const nonButtonPts = textAndControlPoints.filter((p) => p.regionId === void 0 || !buttonRegionIds.has(p.regionId));
		for (let i = nonButtonPts.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = nonButtonPts[i];
			nonButtonPts[i] = nonButtonPts[j];
			nonButtonPts[j] = tmp;
		}
		const maxNonBtn = Math.max(1e3, totalBudget - buttonPts.length - imagePoints.length);
		finalPoints = [
			...buttonPts,
			...nonButtonPts.slice(0, maxNonBtn),
			...imagePoints
		];
	} else finalPoints = [...textAndControlPoints, ...imagePoints];
	return {
		points: finalPoints,
		hitRegions,
		rippleRegions,
		cellSize: imageLeaves.length > 0 ? imageCellSize : 2,
		scrollMax,
		screenBudget: totalBudget,
		priorityRegionIds: Array.from(buttonRegionIds)
	};
}
// src/engine/textSampler.ts
var FONT_FAMILY_MAP = {
	serif: "'Fraunces', Georgia, serif",
	sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
	mono: "'JetBrains Mono', ui-monospace, monospace"
};
var DENSITY_STEP_MAP = {
	sparse: 3,
	balanced: 2,
	dense: 1
};
var DENSITY_AMBIENT_COUNT = {
	sparse: 9500,
	balanced: 21e3,
	dense: 36e3
};
function getAmbientCount(density, width, height) {
	const areaFactor = Math.min(1.2, Math.max(.42, width * height / 1296e3));
	return Math.round(DENSITY_AMBIENT_COUNT[density] * areaFactor);
}
function wrapLines(ctx, text, maxWidth) {
	const paragraphs = text.split(/\n+/);
	const lines = [];
	for (const para of paragraphs) {
		const clean = para.replace(/\s+/g, " ").trim();
		if (!clean) continue;
		const words = clean.split(" ");
		let currentLine = "";
		for (const word of words) {
			const candidate = currentLine ? `${currentLine} ${word}` : word;
			if (ctx.measureText(candidate).width <= maxWidth) currentLine = candidate;
			else if (currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				lines.push(word);
				currentLine = "";
			}
		}
		if (currentLine) lines.push(currentLine);
	}
	return lines;
}
/**
* Renders a phrase or multi-line paragraph onto an invisible offscreen canvas
* (2x supersampled for smaller/paragraph text) and extracts crisp gravitational anchor coordinates.
*/
function sampleTextTargets(text, viewportWidth, viewportHeight, fontStyle, density) {
	const trimmed = text.trim();
	if (!trimmed || viewportWidth < 120 || viewportHeight < 120) return {
		points: [],
		fontSize: 72,
		isParagraph: false,
		bounds: {
			x: 0,
			y: 0,
			width: viewportWidth,
			height: viewportHeight
		}
	};
	const measureCtx = document.createElement("canvas").getContext("2d");
	if (!measureCtx) return {
		points: [],
		fontSize: 72,
		isParagraph: false,
		bounds: {
			x: 0,
			y: 0,
			width: viewportWidth,
			height: viewportHeight
		}
	};
	const isParagraph = trimmed.length > 52 || trimmed.includes("\n");
	const horizontalMargin = viewportWidth < 640 ? 28 : isParagraph ? Math.min(240, viewportWidth * .16) : Math.min(200, viewportWidth * .14);
	const maxTextWidth = Math.max(220, viewportWidth - horizontalMargin * 2);
	const topReserve = viewportWidth < 640 ? 64 : 78;
	const bottomReserve = viewportWidth < 640 ? 158 : 170;
	const safeHeight = Math.max(160, viewportHeight - topReserve - bottomReserve);
	const centerY = topReserve + safeHeight / 2;
	const fontFamily = FONT_FAMILY_MAP[fontStyle];
	const fontWeight = fontStyle === "serif" ? 500 : fontStyle === "mono" ? 500 : 600;
	const charCount = trimmed.length;
	const lengthScale = charCount > 160 ? .38 : charCount > 100 ? .46 : charCount > 55 ? .58 : charCount > 28 ? .78 : 1;
	let fontSize = Math.round(Math.min(viewportWidth < 640 ? 50 : 108, Math.max(20, viewportWidth * .072 * lengthScale)));
	if (fontStyle === "mono") fontSize = Math.round(fontSize * .86);
	const maxAllowedLines = isParagraph ? 8 : 4;
	const lineSpacing = isParagraph ? 1.38 : 1.18;
	let lines = [];
	let widestLine = 0;
	while (fontSize >= 18) {
		measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
		lines = wrapLines(measureCtx, trimmed, maxTextWidth);
		const lineHeight = fontSize * lineSpacing;
		const totalHeight = lines.length * lineHeight;
		widestLine = Math.max(...lines.map((l) => measureCtx.measureText(l).width), 0);
		if (totalHeight <= safeHeight * .9 && widestLine <= maxTextWidth && lines.length <= maxAllowedLines) break;
		fontSize -= 2;
	}
	const sampleScale = fontSize <= 56 ? 2 : 1;
	const lineHeight = fontSize * lineSpacing;
	const blockHeight = (lines.length - 1) * lineHeight;
	const startY = centerY - blockHeight / 2;
	const textBounds = {
		x: Math.max(0, viewportWidth / 2 - widestLine / 2 - 12),
		y: Math.max(0, startY - fontSize * .65),
		width: Math.max(40, widestLine + 24),
		height: Math.max(40, blockHeight + fontSize * 1.3)
	};
	const offscreen = document.createElement("canvas");
	offscreen.width = Math.floor(viewportWidth * sampleScale);
	offscreen.height = Math.floor(viewportHeight * sampleScale);
	const ctx = offscreen.getContext("2d", { willReadFrequently: true });
	if (!ctx) return {
		points: [],
		fontSize,
		isParagraph,
		bounds: textBounds
	};
	ctx.setTransform(sampleScale, 0, 0, sampleScale, 0, 0);
	ctx.clearRect(0, 0, viewportWidth, viewportHeight);
	ctx.fillStyle = "#ffffff";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
	lines.forEach((line, index) => {
		ctx.fillText(line, viewportWidth / 2, startY + index * lineHeight);
	});
	const pad = fontSize;
	const minX = Math.max(0, Math.floor((viewportWidth / 2 - widestLine / 2 - pad) * sampleScale));
	const maxX = Math.min(offscreen.width - 1, Math.ceil((viewportWidth / 2 + widestLine / 2 + pad) * sampleScale));
	const minY = Math.max(0, Math.floor((startY - pad) * sampleScale));
	const maxY = Math.min(offscreen.height - 1, Math.ceil((startY + blockHeight + pad) * sampleScale));
	const boxW = maxX - minX + 1;
	const boxH = maxY - minY + 1;
	if (boxW <= 0 || boxH <= 0) return {
		points: [],
		fontSize,
		isParagraph,
		bounds: textBounds
	};
	const imageData = ctx.getImageData(minX, minY, boxW, boxH).data;
	const baseStep = DENSITY_STEP_MAP[density];
	const step = viewportWidth < 640 ? Math.max(2, baseStep) : fontSize <= 28 && sampleScale === 2 ? Math.min(2, baseStep) : baseStep;
	const fontScale = Math.min(1, Math.max(.26, fontSize / 80));
	const alphaThreshold = fontSize <= 42 ? 120 : 105;
	const jitter = step / sampleScale * (.28 + .42 * fontScale);
	const points = [];
	for (let y = 0; y < boxH; y += step) {
		const rowOffset = y * boxW;
		const cssBaseY = (minY + y) / sampleScale;
		for (let x = 0; x < boxW; x += step) if (imageData[(rowOffset + x) * 4 + 3] > alphaThreshold) {
			const cssBaseX = (minX + x) / sampleScale;
			points.push({
				x: cssBaseX + (Math.random() - .5) * jitter,
				y: cssBaseY + (Math.random() - .5) * jitter
			});
		}
	}
	for (let i = points.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = points[i];
		points[i] = points[j];
		points[j] = tmp;
	}
	const maxGlyphPoints = density === "dense" ? 32e3 : density === "balanced" ? 24e3 : 12e3;
	return {
		points: points.length > maxGlyphPoints ? points.slice(0, maxGlyphPoints) : points,
		fontSize,
		isParagraph,
		bounds: {
			x: Math.max(0, viewportWidth / 2 - widestLine / 2 - 12),
			y: Math.max(0, startY - fontSize * .65),
			width: Math.max(40, widestLine + 24),
			height: Math.max(40, blockHeight + fontSize * 1.3)
		}
	};
}
/**
* Spatial grid nearest-mote matcher operating directly on typed-array ParticlePool.
*/
function assignTargetsByProximity(pool, targets, width, height, fontSize = 72, isImage = false, onAssign) {
	const count = pool.count;
	const { x, y, tx, ty, hasTarget, isFringe, regionId, windReleaseAt, gravityBreakUntil, baseAlpha, waveLayer, waveV } = pool;
	for (let i = 0; i < count; i++) {
		hasTarget[i] = 0;
		isFringe[i] = 0;
		regionId[i] = -1;
		windReleaseAt[i] = 0;
		baseAlpha[i] = waveLayer[i] >= 0 ? .24 + (1 - Math.abs(waveV[i])) * .52 : .14 + Math.random() * .26;
	}
	if (targets.length === 0 || count === 0) return;
	const cellSize = 48;
	const cols = Math.max(1, Math.ceil(width / cellSize));
	const rows = Math.max(1, Math.ceil(height / cellSize));
	const numCells = cols * rows;
	const cellHeads = new Int32Array(numCells).fill(-1);
	const nextInCell = new Int32Array(count);
	const claimed = new Uint8Array(count);
	for (let i = 0; i < count; i++) {
		const cx = Math.min(cols - 1, Math.max(0, Math.floor(x[i] / cellSize)));
		const cellIdx = Math.min(rows - 1, Math.max(0, Math.floor(y[i] / cellSize))) * cols + cx;
		nextInCell[i] = cellHeads[cellIdx];
		cellHeads[cellIdx] = i;
	}
	let fallbackScanIdx = 0;
	const fringeRatio = isImage ? 1 : fontSize <= 38 ? .95 : .9;
	const fringeStartIdx = Math.floor(targets.length * fringeRatio);
	for (let t = 0; t < targets.length; t++) {
		const anchorX = targets[t].x;
		const anchorY = targets[t].y;
		const tcx = Math.min(cols - 1, Math.max(0, Math.floor(anchorX / cellSize)));
		const tcy = Math.min(rows - 1, Math.max(0, Math.floor(anchorY / cellSize)));
		let bestIdx = -1;
		let bestDistSq = Infinity;
		for (let r = 0; r <= 5; r++) {
			const minX = Math.max(0, tcx - r);
			const maxX = Math.min(cols - 1, tcx + r);
			const minY = Math.max(0, tcy - r);
			const maxY = Math.min(rows - 1, tcy + r);
			for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
				if (r > 0 && cx !== minX && cx !== maxX && cy !== minY && cy !== maxY) continue;
				let idx = cellHeads[cy * cols + cx];
				while (idx !== -1) {
					if (!claimed[idx]) {
						const dx = x[idx] - anchorX;
						const dy = y[idx] - anchorY;
						const dSq = dx * dx + dy * dy;
						if (dSq < bestDistSq) {
							bestDistSq = dSq;
							bestIdx = idx;
						}
					}
					idx = nextInCell[idx];
				}
			}
			if (bestIdx !== -1) break;
		}
		if (bestIdx === -1) {
			while (fallbackScanIdx < count && claimed[fallbackScanIdx]) fallbackScanIdx++;
			if (fallbackScanIdx < count) {
				bestIdx = fallbackScanIdx;
				fallbackScanIdx++;
			}
		}
		if (bestIdx !== -1) {
			claimed[bestIdx] = 1;
			tx[bestIdx] = anchorX;
			ty[bestIdx] = anchorY;
			hasTarget[bestIdx] = 1;
			isFringe[bestIdx] = t >= fringeStartIdx ? 1 : 0;
			regionId[bestIdx] = targets[t].regionId ?? -1;
			gravityBreakUntil[bestIdx] = 0;
			const pointWeight = targets[t].weight;
			baseAlpha[bestIdx] = pointWeight !== void 0 ? pointWeight : t >= fringeStartIdx ? .36 + Math.random() * .22 : .72 + Math.random() * .22;
			onAssign?.(t, bestIdx);
		}
	}
}
// src/engine/layoutWindow.ts
/** Extra band above/below the screen (as a fraction of its height) that already holds formed content. */
var MARGIN_RATIO = .12;
/** Re-window after the content has moved this many px. */
var REWINDOW_STEP = 12;
/** A vertical gap between consecutive sorted points at least this big separates two text lines. */
var LINE_GAP = 4;
/** How far above the budget cut to look for a line gap before cutting mid-line. */
var GAP_SEARCH = 90;
/**
* Gives particles only to the part of a scrollable layout that is on screen.
*
* Every target of the layout is kept (sorted by y, in content coordinates at scroll 0), but at most
* `screenBudget` particles are spent per screen, so long content is as crisp as short content. When
* scrolling, targets that leave the window release their particles; those particles are handed to
* the targets entering the window (paired by x, so they stream across), and any not needed dissolve
* into the ambient drift.
*/
var LayoutWindow = class {
	constructor(points, screenBudget, priorityRegionIds, viewHeight, mode = "screen", bounds = {
		top: 0,
		bottom: viewHeight
	}) {
		this.screenBudget = screenBudget;
		this.viewHeight = viewHeight;
		this.mode = mode;
		this.bounds = bounds;
		this.particleTarget = /* @__PURE__ */ new Int32Array(0);
		this.active = /* @__PURE__ */ new Int32Array(0);
		this.activeCount = 0;
		this.windowScroll = NaN;
		const sorted = points.slice().sort((a, b) => a.y - b.y);
		const n = sorted.length;
		const priority = new Set(priorityRegionIds);
		this.targetCount = n;
		this.x0 = new Float32Array(n);
		this.y0 = new Float32Array(n);
		this.weight = new Float32Array(n);
		this.region = new Int16Array(n);
		this.rank = new Float32Array(n);
		this.prefixNormal = new Int32Array(n + 1);
		this.targetParticle = new Int32Array(n).fill(-1);
		for (let i = 0; i < n; i++) {
			const p = sorted[i];
			const regionId = p.regionId ?? -1;
			this.x0[i] = p.x;
			this.y0[i] = p.y;
			this.weight[i] = p.weight ?? .8;
			this.region[i] = regionId;
			const isPriority = regionId >= 0 && priority.has(regionId);
			this.rank[i] = isPriority ? -1 : Math.random();
			this.prefixNormal[i + 1] = this.prefixNormal[i] + (isPriority ? 0 : 1);
		}
		let minX = Infinity;
		let maxX = -Infinity;
		for (let i = 0; i < n; i++) {
			if (this.x0[i] < minX) minX = this.x0[i];
			if (this.x0[i] > maxX) maxX = this.x0[i];
		}
		this.centerX = n > 0 ? (minX + maxX) / 2 : 0;
	}
	/** Particles needed to fill one window; size the pool with this plus the ambient count. */
	get poolNeed() {
		const windowShare = this.mode === "screen" ? 1.24 : 1;
		return Math.min(this.targetCount, Math.ceil(this.screenBudget * windowShare));
	}
	/**
	* Smallest scroll offset at which the last line of content is inside the band. For `'screen'`
	* this is 0 (the layout engine's own scroll range already covers it).
	*/
	scrollEnd() {
		const n = this.targetCount;
		if (n === 0 || this.mode === "screen") return 0;
		const last = this.y0[n - 1];
		let need;
		if (this.mode === "auto") {
			need = last - this.bounds.bottom;
			if (n > this.screenBudget) need = Math.max(need, this.y0[n - this.screenBudget] - this.bounds.top);
		} else need = last - (this.bounds.top + this.mode);
		return need > 0 ? Math.ceil(need + 24) : 0;
	}
	/** The clear band on screen (canvas px) at a scroll offset. */
	band(scroll) {
		if (this.mode === "screen") return {
			top: 0,
			bottom: this.viewHeight
		};
		const { lo, hi } = this.range(scroll);
		const top = this.bounds.top;
		if (this.mode !== "auto") return {
			top,
			bottom: top + this.mode
		};
		const bottom = hi < this.targetCount ? this.y0[hi] - scroll : this.bounds.bottom;
		return {
			top,
			bottom: Math.max(top, hi > lo ? bottom : top)
		};
	}
	/** Assign particles from scratch for the given scroll offset (after the pool was resized). */
	assignAll(pool, scroll, width, height) {
		this.ensureCapacity(pool);
		this.targetParticle.fill(-1);
		this.particleTarget.fill(-1);
		this.activeCount = 0;
		const { lo, hi, ratio } = this.range(scroll);
		const wanted = [];
		for (let t = lo; t < hi; t++) if (this.rank[t] < ratio) wanted.push(t);
		assignTargetsByProximity(pool, wanted.map((t) => ({
			x: this.x0[t],
			y: this.y0[t] - scroll,
			weight: this.weight[t],
			regionId: this.region[t]
		})), width, height, 36, true, (k, p) => {
			this.link(wanted[k], p);
		});
		this.windowScroll = scroll;
	}
	/**
	* Move particles to follow the scroll. Call after particle targets were shifted to `scroll`.
	* Returns true when assignments changed.
	*/
	update(pool, scroll, now) {
		if (Math.abs(scroll - this.windowScroll) < REWINDOW_STEP) return false;
		this.windowScroll = scroll;
		this.ensureCapacity(pool);
		const { lo, hi, ratio } = this.range(scroll);
		const { hasTarget, regionId, isFringe, baseAlpha, waveLayer, waveV, windReleaseAt } = pool;
		const released = [];
		for (let a = this.activeCount - 1; a >= 0; a--) {
			const t = this.active[a];
			if (t >= lo && t < hi && this.rank[t] < ratio) continue;
			const p = this.targetParticle[t];
			this.targetParticle[t] = -1;
			this.particleTarget[p] = -1;
			this.active[a] = this.active[--this.activeCount];
			hasTarget[p] = 0;
			regionId[p] = -1;
			isFringe[p] = 0;
			baseAlpha[p] = waveLayer[p] >= 0 ? .24 + (1 - Math.abs(waveV[p])) * .52 : .14 + Math.random() * .26;
			released.push(p);
		}
		const incoming = [];
		for (let t = lo; t < hi; t++) if (this.targetParticle[t] === -1 && this.rank[t] < ratio) incoming.push(t);
		const donors = released.slice(0, incoming.length);
		if (donors.length < incoming.length) {
			const reused = new Set(released);
			for (let i = 0; i < pool.count && donors.length < incoming.length; i++) if (hasTarget[i] === 0 && !reused.has(i)) donors.push(i);
		}
		const n = Math.min(donors.length, incoming.length);
		if (n > 0) {
			const pickedTargets = incoming.slice(0, n).sort((a, b) => this.x0[a] - this.x0[b]);
			const pickedDonors = donors.slice(0, n).sort((a, b) => pool.x[a] - pool.x[b]);
			for (let k = 0; k < n; k++) {
				const t = pickedTargets[k];
				const p = pickedDonors[k];
				pool.tx[p] = this.x0[t];
				pool.ty[p] = this.y0[t] - scroll;
				hasTarget[p] = 1;
				isFringe[p] = 0;
				regionId[p] = this.region[t];
				pool.gravityBreakUntil[p] = 0;
				windReleaseAt[p] = 0;
				baseAlpha[p] = this.weight[t];
				this.link(t, p);
			}
		}
		for (let k = n; k < released.length; k++) windReleaseAt[released[k]] = now + Math.random() * 160;
		return released.length > 0 || n > 0;
	}
	link(t, p) {
		this.targetParticle[t] = p;
		this.particleTarget[p] = t;
		this.active[this.activeCount++] = t;
	}
	ensureCapacity(pool) {
		if (this.particleTarget.length < pool.capacity) {
			const next = new Int32Array(pool.capacity).fill(-1);
			next.set(this.particleTarget);
			this.particleTarget = next;
		}
		if (this.active.length < pool.capacity) {
			const next = new Int32Array(pool.capacity);
			next.set(this.active.subarray(0, this.activeCount));
			this.active = next;
		}
	}
	/** Window [lo, hi) of sorted targets for a scroll offset, and the keep ratio for thinnable ones. */
	range(scroll) {
		if (this.mode === "auto") return this.autoRange(scroll);
		if (this.mode !== "screen") {
			const lo = this.lowerBound(scroll + this.bounds.top);
			const hi = this.lowerBound(scroll + this.bounds.top + this.mode);
			return {
				lo,
				hi,
				ratio: this.keepRatio(lo, hi)
			};
		}
		const margin = this.viewHeight * MARGIN_RATIO;
		const lo = this.lowerBound(scroll - margin);
		const hi = this.lowerBound(scroll + this.viewHeight + margin);
		const vLo = this.lowerBound(scroll);
		const vHi = this.lowerBound(scroll + this.viewHeight);
		return {
			lo,
			hi,
			ratio: this.keepRatio(vLo, vHi)
		};
	}
	/** Share of thinnable targets in [lo, hi) that fit the budget (priority targets always kept). */
	keepRatio(lo, hi) {
		const normal = this.prefixNormal[hi] - this.prefixNormal[lo];
		const priority = hi - lo - normal;
		const room = Math.max(0, this.screenBudget - priority);
		return normal > 0 ? Math.min(1, room / normal) : 1;
	}
	/**
	* 'auto': from the band top, take whole lines until the budget is used or the band bottom is
	* reached. Nothing is thinned; the cut lands in the gap between two lines.
	*/
	autoRange(scroll) {
		const lo = this.lowerBound(scroll + this.bounds.top);
		let hi = this.lowerBound(scroll + this.bounds.bottom);
		const cap = lo + this.screenBudget;
		if (cap < hi) {
			hi = cap;
			const capY = this.y0[cap];
			for (let k = cap; k > lo + 1 && capY - this.y0[k] < GAP_SEARCH; k--) if (this.y0[k] - this.y0[k - 1] >= LINE_GAP) {
				hi = k;
				break;
			}
		}
		return {
			lo,
			hi,
			ratio: 1
		};
	}
	lowerBound(y) {
		let a = 0;
		let b = this.targetCount;
		while (a < b) {
			const m = a + b >> 1;
			if (this.y0[m] < y) a = m + 1;
			else b = m;
		}
		return a;
	}
};
// src/engine/scrollHint.ts
/** A downward double chevron (⌄⌄) built from short thick strokes, ~300 points. */
function buildChevronShape() {
	const pts = [];
	const chevron = (offsetY, halfW, depth, alpha) => {
		const segs = [[
			-halfW,
			offsetY - depth / 2,
			0,
			offsetY + depth / 2
		], [
			0,
			offsetY + depth / 2,
			halfW,
			offsetY - depth / 2
		]];
		for (const [x1, y1, x2, y2] of segs) {
			const len = Math.hypot(x2 - x1, y2 - y1);
			const nx = -(y2 - y1) / len;
			const ny = (x2 - x1) / len;
			for (let s = 0; s <= len; s += .7) {
				const t = s / len;
				for (const w of [
					-1.1,
					0,
					1.1
				]) pts.push({
					dx: x1 + (x2 - x1) * t + nx * w,
					dy: y1 + (y2 - y1) * t + ny * w,
					a: alpha
				});
			}
		}
	};
	chevron(-4, 13, 8, .95);
	chevron(5, 10, 6, .6);
	return pts;
}
var SHAPE = buildChevronShape();
/**
* Particle-built "more content" chevrons for scrollable layouts. Hint particles are borrowed from the
* ambient dust when a hint appears and released (with a soft gust) when it goes away.
*/
var ScrollHints = class {
	constructor() {
		this.down = null;
		this.up = null;
		this.mask = /* @__PURE__ */ new Uint8Array(0);
		this.downPos = {
			x: 0,
			y: 0
		};
		this.upPos = {
			x: 0,
			y: 0
		};
	}
	/** Forget all hint particles (call after the pool was reassigned from scratch). */
	reset(capacity) {
		this.down = null;
		this.up = null;
		if (this.mask.length < capacity) this.mask = new Uint8Array(capacity);
		else this.mask.fill(0);
	}
	/** True if particle i belongs to a hint (so scrolling must not carry it). */
	isHint(i) {
		return this.mask[i] === 1;
	}
	/** Which hint (if any) is under a point, with a generous touch-friendly radius. */
	hit(x, y) {
		const r = 26;
		if (this.down && Math.hypot(x - this.downPos.x, y - this.downPos.y) < r) return "down";
		if (this.up && Math.hypot(x - this.upPos.x, y - this.upPos.y) < r) return "up";
		return null;
	}
	/** Release everything (hints switched off or layout no longer scrollable). */
	clear(pool, now) {
		if (this.down) this.release(pool, this.down, now);
		if (this.up) this.release(pool, this.up, now);
		this.down = null;
		this.up = null;
	}
	/** Show/hide and animate the hints for this frame. */
	update(pool, s, time, now) {
		if (this.mask.length < pool.capacity) {
			const next = new Uint8Array(pool.capacity);
			next.set(this.mask);
			this.mask = next;
		}
		const bob = Math.sin(time * 2.6) * 3.5;
		const pulse = .72 + .28 * Math.sin(time * 2.6 + 1.2);
		this.downPos = {
			x: s.centerX,
			y: Math.min(s.canvasHeight - 18, s.bandBottom + 26)
		};
		this.upPos = {
			x: s.centerX,
			y: Math.max(16, s.bandTop - 22)
		};
		if (s.showDown && !this.down) this.down = this.claim(pool);
		else if (!s.showDown && this.down) {
			this.release(pool, this.down, now);
			this.down = null;
		}
		if (s.showUp && !this.up) this.up = this.claim(pool);
		else if (!s.showUp && this.up) {
			this.release(pool, this.up, now);
			this.up = null;
		}
		if (this.down) this.place(pool, this.down, this.downPos.x, this.downPos.y + bob, 1, pulse);
		if (this.up) this.place(pool, this.up, this.upPos.x, this.upPos.y - bob, -1, pulse);
	}
	place(pool, ids, cx, cy, dir, pulse) {
		for (let k = 0; k < ids.length; k++) {
			const i = ids[k];
			if (i < 0 || this.mask[i] !== 1) continue;
			const pt = SHAPE[k];
			pool.tx[i] = cx + pt.dx;
			pool.ty[i] = cy + pt.dy * dir;
			pool.baseAlpha[i] = pt.a * pulse * .8;
		}
	}
	/** Borrow free ambient particles (from the end of the pool, away from layout assignments). */
	claim(pool) {
		const ids = new Int32Array(SHAPE.length).fill(-1);
		let k = 0;
		for (let i = pool.count - 1; i >= 0 && k < ids.length; i--) if (pool.hasTarget[i] === 0 && this.mask[i] === 0) {
			ids[k++] = i;
			this.mask[i] = 1;
			pool.hasTarget[i] = 1;
			pool.isFringe[i] = 0;
			pool.regionId[i] = -1;
			pool.gravityBreakUntil[i] = 0;
			pool.windReleaseAt[i] = 0;
		}
		return ids;
	}
	release(pool, ids, now) {
		for (let k = 0; k < ids.length; k++) {
			const i = ids[k];
			if (i < 0 || this.mask[i] !== 1) continue;
			this.mask[i] = 0;
			pool.hasTarget[i] = 0;
			pool.baseAlpha[i] = pool.waveLayer[i] >= 0 ? .24 + (1 - Math.abs(pool.waveV[i])) * .52 : .14 + Math.random() * .26;
			pool.windReleaseAt[i] = now + Math.random() * 120;
		}
	}
};
// src/lib/StarDust.ts
var DEFAULT_PHYSICS = {
	cursorMode: "repel",
	density: "balanced",
	fontStyle: "serif",
	turbulence: .75,
	cohesion: .065,
	autoDissolveSec: 20,
	perlinFlow: true,
	bloom: true,
	constellation: false
};
var DEFAULT_RIPPLE = {
	pattern: "off",
	trigger: "both",
	strength: .75,
	speed: 1,
	wavelength: 130
};
var DEFAULTS = {
	targetMode: "text",
	text: "",
	imageSrc: null,
	invertImageContrast: false,
	imageTuning: DEFAULT_IMAGE_TUNING,
	layoutAst: null,
	layoutLeftInset: 0,
	layoutOverflow: "scroll",
	layoutMinFontSize: 14,
	layoutPadding: void 0,
	layoutParticleBudget: void 0,
	layoutScrollTrail: 0,
	layoutWindow: "auto",
	layoutScrollHint: true,
	layoutAutoDissolve: false,
	collapsedMindMapIds: void 0,
	freeDrift: false,
	physics: DEFAULT_PHYSICS,
	ripple: DEFAULT_RIPPLE,
	palette: "aurora",
	fill: true,
	manageCursor: true
};
function mergeOptions(base, next) {
	const merged = { ...base };
	for (const key of Object.keys(next)) {
		const value = next[key];
		if (key === "physics") merged.physics = {
			...base.physics,
			...value
		};
		else if (key === "ripple") merged.ripple = {
			...base.ripple,
			...value
		};
		else if (value === void 0 && key in DEFAULTS) merged[key] = DEFAULTS[key];
		else merged[key] = value;
	}
	return merged;
}
function sameTuning(a, b) {
	return a.blurStyle === b.blurStyle && a.edgeBlur === b.edgeBlur && a.contrast === b.contrast && a.detail === b.detail;
}
function resolveLayoutPadding(padding, width, height) {
	const def = width < 640 ? 16 : 32;
	const value = typeof padding === "function" ? padding(width, height) : padding;
	if (typeof value === "number") return {
		top: value,
		right: value,
		bottom: value,
		left: value
	};
	return {
		top: value?.top ?? def,
		right: value?.right ?? def,
		bottom: value?.bottom ?? def,
		left: value?.left ?? def
	};
}
function samePadding(a, b) {
	return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
function whenFontsReady() {
	if (typeof document !== "undefined" && document.fonts && document.fonts.ready) return document.fonts.ready;
	return Promise.resolve();
}
function resolveRegionRipple(region, globalCfg) {
	const pattern = region?.pattern ?? globalCfg.pattern;
	const trigger = region?.trigger ?? globalCfg.trigger;
	const strength = region?.strength ?? globalCfg.strength;
	const speed = region?.speed ?? globalCfg.speed;
	const wavelength = region?.wavelength ?? globalCfg.wavelength;
	const active = pattern !== "off" && strength > .01;
	if (pattern === "expand") return {
		pattern,
		allowAmbient: false,
		allowHover: false,
		allowClick: active,
		strength,
		speed,
		wavelength
	};
	return {
		pattern,
		allowAmbient: active && (trigger === "both" || trigger === "ambient"),
		allowHover: active && (trigger === "both" || trigger === "interactive" || trigger === "hover"),
		allowClick: active && (trigger === "both" || trigger === "interactive" || trigger === "click"),
		strength,
		speed,
		wavelength
	};
}
var MAX_WAKE_NODES = 16;
var MAX_RIPPLE_PULSES = 8;
/**
* Framework-agnostic interactive dust-particle renderer.
*
* ```ts
* const dust = new StarDust(canvas, { text: 'Hello' });
* dust.setOptions({ palette: 'moonlit' });
* dust.scatter();
* dust.destroy();
* ```
*/
var StarDust = class {
	constructor(canvas, options = {}) {
		this.pool = createParticlePool(24e3);
		this.vertexData = /* @__PURE__ */ new Float32Array(192e3);
		this.dissolveOrder = /* @__PURE__ */ new Float32Array(24e3);
		this.perlinWind = new PerlinWindField(52, 34);
		this.constellation = new ConstellationBuilder();
		this.renderer = null;
		this.shockwaves = [];
		this.wakeNodes = [];
		this.size = {
			width: 0,
			height: 0,
			dpr: 1
		};
		this.parallax = {
			x: 0,
			y: 0
		};
		this.glyphFontSize = 72;
		this.imageCellSize = 2;
		this.loadedImage = null;
		this.layoutImageCache = /* @__PURE__ */ new Map();
		this.hitRegions = [];
		this.rippleRegions = [];
		this.ripplePulses = [];
		this.lastHoverRipple = {
			time: 0,
			x: -9999,
			y: -9999,
			regionId: -2
		};
		this.hoveredRegionId = -1;
		this.reportedHoverId = -1;
		this.lastActivityAt = typeof performance !== "undefined" ? performance.now() : 0;
		this.dissolveStartedAt = null;
		this.dissolveFired = false;
		this.lastMovePos = {
			x: -9999,
			y: -9999
		};
		this.lastAudioReportAt = 0;
		this.reducedMotion = false;
		this.pointer = {
			x: -9999,
			y: -9999,
			vx: 0,
			vy: 0,
			active: false,
			down: false,
			downAt: 0,
			downX: 0,
			downY: 0,
			swipeCooldownUntil: 0,
			recentClicks: []
		};
		this.scrollPos = 0;
		this.scrollGoal = 0;
		this.scrollLimit = 0;
		this.touchScroll = null;
		this.layoutWindow = null;
		this.hints = new ScrollHints();
		this.hintHover = false;
		this.kbFocusId = -1;
		this.rafId = 0;
		this.startTime = 0;
		this.shockUniforms = [];
		this.resizeTimer = null;
		this.targetDebounce = null;
		this.targetToken = 0;
		this.destroyed = false;
		this.cleanups = [];
		this.resolveImage = (ref) => (this.o.resolveLayoutImage ?? defaultLayoutImageUrl)(ref, this.o.imageSrc);
		this.renderFrame = (now) => {
			if (this.destroyed) return;
			this.rafId = requestAnimationFrame(this.renderFrame);
			const startTime = this.startTime;
			const { width, height, dpr } = this.size;
			const activeRenderer = this.renderer;
			if (width === 0 || height === 0 || !activeRenderer) return;
			const time = (now - startTime) * .001;
			if (this.scrollGoal !== this.scrollPos) {
				const remaining = this.scrollGoal - this.scrollPos;
				const ease = this.touchScroll?.active ? .5 : .22;
				this.applyScroll(Math.abs(remaining) < .5 ? remaining : remaining * ease);
			}
			this.updateScrollHints(time, now);
			const currentPhysics = this.o.physics;
			const currentPalette = this.o.palette;
			const isDark = PALETTE_THEMES[currentPalette].isDark;
			const isReduced = this.reducedMotion;
			const isFree = this.o.freeDrift;
			const ptr = this.pointer;
			ptr.vx *= .85;
			ptr.vy *= .85;
			const targetParX = ptr.active ? (ptr.x / width - .5) * 2 : 0;
			const targetParY = ptr.active ? (ptr.y / height - .5) * 2 : 0;
			this.parallax.x += (targetParX - this.parallax.x) * .045;
			this.parallax.y += (targetParY - this.parallax.y) * .045;
			const wakeNodes = this.wakeNodes;
			while (wakeNodes.length > 0 && now - wakeNodes[0].bornAt > 650) wakeNodes.shift();
			const waves = this.shockwaves;
			this.shockUniforms.length = 0;
			for (let w = waves.length - 1; w >= 0; w--) {
				const wave = waves[w];
				wave.radius += (wave.maxRadius - wave.radius) * .09 + 2.5;
				wave.alpha *= .92;
				if (wave.alpha < .01 || wave.radius >= wave.maxRadius) {
					waves.splice(w, 1);
					continue;
				}
				this.shockUniforms.push({
					x: wave.x,
					y: wave.y,
					radius: wave.radius,
					alpha: wave.alpha
				});
			}
			const pool = this.pool;
			const count = pool.count;
			const vData = this.vertexData;
			const lut = getPaletteLut(currentPalette);
			const { x, y, vx, vy, tx, ty, hasTarget, size, baseAlpha, phase, wanderSpeed, energy, waveLayer, waveU, waveV, depth, depthPlane, mass, colorSeed, isFringe, regionId, gravityBreakUntil, windReleaseAt } = pool;
			const turb = (isReduced ? .18 : 1) * currentPhysics.turbulence;
			const cohesion = isReduced ? Math.max(.08, currentPhysics.cohesion) : currentPhysics.cohesion;
			const pointerRadius = currentPhysics.cursorMode === "breeze" ? 168 : 134;
			const pointerRadiusSq = pointerRadius * pointerRadius;
			const holdEngaged = ptr.down;
			const waveDriftSpeed = (isReduced ? .004 : .013) * turb;
			const wavePull = isFree ? .015 : .009;
			const halfWidth = width * .5;
			const speedScale = isReduced ? .25 : 1;
			const waveAlphaScale = isDark ? currentPhysics.density === "dense" ? .34 : currentPhysics.density === "balanced" ? .46 : .68 : .85;
			const isImageStage = this.o.targetMode === "image" && !isFree;
			const isLayoutStage = this.o.targetMode === "layout" && !isFree;
			const isCompositeStage = isImageStage || isLayoutStage;
			const dimTransit = isLayoutStage && this.layoutWindow !== null;
			const hoveredBtnId = this.hoveredRegionId;
			const glyphScale = isImageStage ? .48 : isLayoutStage ? .56 : Math.min(1, Math.max(.45, this.glyphFontSize / 72));
			const glyphSizeScale = isImageStage ? Math.min(1.08, Math.max(.76, this.imageCellSize * .45)) : isLayoutStage ? .82 : .56 + .44 * glyphScale;
			const fringeOrbitRadius = .7 + 1.9 * glyphScale;
			const smallTextBoost = isCompositeStage ? 1 : 1 + (1 - glyphScale) * .24;
			const textAlphaScale = (isDark ? currentPhysics.density === "dense" ? isCompositeStage ? .72 : .54 : currentPhysics.density === "balanced" ? isCompositeStage ? .86 : .68 : isCompositeStage ? .96 : .82 : isCompositeStage ? .96 : .94) * smallTextBoost;
			const parX0 = isReduced ? 0 : this.parallax.x * 6;
			const parY0 = isReduced ? 0 : this.parallax.y * 4;
			const parX1 = isReduced ? 0 : this.parallax.x * 14;
			const parY1 = isReduced ? 0 : this.parallax.y * 9;
			const cursorEnabled = currentPhysics.cursorMode !== "off";
			const wakeLen = isReduced || !cursorEnabled ? 0 : wakeNodes.length;
			const ripplePulses = this.ripplePulses;
			for (let p = ripplePulses.length - 1; p >= 0; p--) {
				const maxAgeMs = ripplePulses[p].pattern === "expand" ? 3400 : 2600;
				if (now - ripplePulses[p].bornAt > maxAgeMs) ripplePulses.splice(p, 1);
			}
			const globalRipple = this.o.ripple;
			const rRegions = this.rippleRegions;
			const resolvedRegions = [];
			let anyAmbientRipple = false;
			const motionDamp = isReduced ? .35 : 1;
			if (!isFree) {
				if (rRegions.length > 0) for (let r = 0; r < rRegions.length; r++) {
					const reg = rRegions[r];
					const res = resolveRegionRipple(reg, globalRipple);
					if (res.allowAmbient) anyAmbientRipple = true;
					resolvedRegions.push({
						region: reg,
						pattern: res.pattern,
						allowAmbient: res.allowAmbient,
						allowHover: res.allowHover,
						allowClick: res.allowClick,
						strength: res.strength * motionDamp,
						speed: res.speed * (isReduced ? .45 : 1),
						wavelength: res.wavelength
					});
				}
				else {
					const fallbackReg = {
						id: 0,
						tag: "Stage",
						x: 0,
						y: 0,
						width,
						height,
						cx: width * .5,
						cy: height * .5
					};
					const res = resolveRegionRipple(void 0, globalRipple);
					if (res.allowAmbient) anyAmbientRipple = true;
					resolvedRegions.push({
						region: fallbackReg,
						pattern: res.pattern,
						allowAmbient: res.allowAmbient,
						allowHover: res.allowHover,
						allowClick: res.allowClick,
						strength: res.strength * motionDamp,
						speed: res.speed * (isReduced ? .45 : 1),
						wavelength: res.wavelength
					});
				}
			}
			const hasRippleField = !isFree && (anyAmbientRipple || ripplePulses.length > 0);
			const pulseCount = ripplePulses.length;
			const sweepAxisX = .9135;
			const sweepAxisY = .4067;
			const autoSec = this.o.targetMode === "layout" && !this.o.layoutAutoDissolve ? 0 : currentPhysics.autoDissolveSec;
			let dissolveProgress = 0;
			if (!isFree && autoSec > 0 && count > 0) {
				if (this.dissolveStartedAt === null) {
					if (now - this.lastActivityAt >= autoSec * 1e3) {
						this.dissolveStartedAt = now;
						this.dissolveFired = false;
						if (this.dissolveOrder.length < count) this.dissolveOrder = new Float32Array(Math.ceil(count * 1.25));
						const dOrder = this.dissolveOrder;
						const dCx = width * .5;
						const dCy = height * .5;
						const invMaxR = 1 / Math.max(120, Math.hypot(width, height) * .38);
						for (let k = 0; k < count; k++) if (hasTarget[k] === 1) {
							const rNorm = Math.min(1, Math.hypot(tx[k] - dCx, ty[k] - dCy) * invMaxR);
							const breezeBias = (1 - Math.max(0, Math.min(1, tx[k] / Math.max(1, width)))) * .22;
							const fringeBias = isFringe[k] === 1 ? -.16 : 0;
							const raw = (1 - rNorm) * .38 + breezeBias + Math.random() * .36 + fringeBias;
							dOrder[k] = Math.max(0, Math.min(.76, raw));
						} else dOrder[k] = 0;
					}
				}
				if (this.dissolveStartedAt !== null) {
					const elapsedSec = (now - this.dissolveStartedAt) / 1e3;
					dissolveProgress = Math.min(1, elapsedSec / 4.5);
				}
			} else {
				this.dissolveStartedAt = null;
				this.dissolveFired = false;
			}
			const dOrder = this.dissolveOrder;
			const isDissolving = dissolveProgress > 0;
			const usePerlinWind = currentPhysics.perlinFlow && (isFree || isDissolving);
			const windField = this.perlinWind;
			if (usePerlinWind) windField.update(width, height, time);
			let speedSum = 0;
			let energySum = 0;
			for (let i = 0; i < count; i++) {
				let px = x[i];
				let py = y[i];
				let pvx = vx[i];
				let pvy = vy[i];
				let pEnergy = energy[i];
				const pPhase = phase[i];
				const pMass = mass[i];
				const pLayer = waveLayer[i];
				const isGlyph = hasTarget[i] === 1 && !isFree;
				const releaseTime = windReleaseAt[i];
				if (releaseTime > 0 && now >= releaseTime) {
					windReleaseAt[i] = 0;
					const gust = (2.4 + Math.random() * 4.4) * speedScale / pMass;
					pvx += gust;
					pvy += (-.55 + Math.sin(py * .018 + pPhase) * 1.45) * speedScale;
					pEnergy = Math.min(1, pEnergy + .65);
				}
				const flowAngle = Math.sin(px * .0021 + time * .23 + pPhase * .1) * 1.7 + Math.cos(py * .0021 - time * .19 + pPhase * .08) * 1.7;
				const thermalDriftY = (pMass - .98) * .0085 * turb;
				let crestShift = 0;
				let meltBlend = 0;
				if (isGlyph) {
					if (isDissolving) {
						const startT = i < dOrder.length ? dOrder[i] : 0;
						const rawM = Math.max(0, Math.min(1, (dissolveProgress - startT) / .24));
						meltBlend = rawM * rawM * (3 - 2 * rawM);
					}
					if (now < gravityBreakUntil[i] && meltBlend < .5) {
						pvx += Math.cos(flowAngle) * .024 * turb;
						pvy += (Math.sin(flowAngle) * .024 + thermalDriftY) * turb;
						pvx *= .945;
						pvy *= .945;
					} else {
						let glyphVx = pvx;
						let glyphVy = pvy;
						if (meltBlend < .999) {
							const localCohesion = cohesion * (1 - (isDissolving ? Math.min(1, dissolveProgress / Math.max(.08, (dOrder[i] ?? .2) + .08)) : 0) * .35) * (1 - meltBlend);
							if (isFringe[i] === 1) {
								const haloX = tx[i] + Math.cos(time * .52 + pPhase) * fringeOrbitRadius;
								const haloY = ty[i] + Math.sin(time * .44 + pPhase) * fringeOrbitRadius;
								const dx = haloX - px;
								const dy = haloY - py;
								const dist = Math.hypot(dx, dy);
								const gain = localCohesion * 1.25 / (1 + dist * .032);
								const damp = .82 + .08 * (1 - Math.exp(-dist * .04));
								glyphVx = (pvx + dx * gain) * damp;
								glyphVy = (pvy + dy * gain) * damp;
							} else {
								let anchorX = tx[i];
								let anchorY = ty[i];
								if (hasRippleField && meltBlend < .7) {
									const rCfg = resolvedRegions[regionId[i] >= 0 && regionId[i] < resolvedRegions.length ? regionId[i] : 0];
									let rx = 0;
									let ry = 0;
									if (rCfg && rCfg.allowAmbient && rCfg.pattern !== "off") {
										const { region, pattern, strength, speed, wavelength } = rCfg;
										const k = Math.PI * 2 / wavelength;
										const rdx = anchorX - region.cx;
										const rdy = anchorY - region.cy;
										if (pattern === "ring") {
											const rDist = Math.hypot(rdx, rdy);
											const s = Math.sin(rDist * k - time * speed * 3.4);
											const amp = strength * 3.8;
											if (rDist > .5) {
												const invD = 1 / rDist;
												rx += rdx * invD * s * amp;
												ry += rdy * invD * s * amp;
											}
											crestShift += s * Math.min(1.2, strength);
										} else if (pattern === "sweep") {
											const theta = (rdx * sweepAxisX + rdy * sweepAxisY) * k - time * speed * 3.6;
											const s = Math.sin(theta);
											const amp = strength * 3.6;
											rx += -.4067 * s * amp * .78 + sweepAxisX * Math.cos(theta) * amp * .22;
											ry += sweepAxisX * s * amp * .78 + sweepAxisY * Math.cos(theta) * amp * .22;
											crestShift += s * Math.min(1.2, strength);
										} else {
											const rDist = Math.hypot(rdx, rdy);
											const maxHalf = Math.max(40, Math.hypot(region.width, region.height) * .5);
											const rNorm = Math.min(1.5, rDist / maxHalf);
											const s = Math.sin(time * speed * 2.5 - rNorm * 1.55);
											const amp = strength * 4 * (.28 + .72 * Math.min(1, rNorm));
											if (rDist > .5) {
												const invD = 1 / rDist;
												rx += rdx * invD * s * amp;
												ry += rdy * invD * s * amp;
											}
											crestShift += s * Math.min(1.2, strength);
										}
									}
									if (pulseCount > 0 && (!rCfg || rCfg.pattern !== "off")) {
										const pId = regionId[i];
										for (let p = 0; p < pulseCount; p++) {
											const pulse = ripplePulses[p];
											if (pulse.regionId !== -1 && pulse.regionId !== pId) continue;
											const ageSec = (now - pulse.bornAt) * .001;
											const pdx = anchorX - pulse.x;
											const pdy = anchorY - pulse.y;
											if (pulse.pattern === "expand") {
												const front = ageSec * (245 * pulse.speed);
												const band = Math.max(38, pulse.wavelength * .46);
												const pDist = Math.hypot(pdx, pdy);
												const delta = pDist - front;
												if (Math.abs(delta) < band * 2.4) {
													const fade = Math.exp(-ageSec * .85);
													const crest = Math.exp(-(delta * delta) / (band * band * .44));
													const echoDist = delta + band * 1.1;
													const wave = crest - .32 * Math.exp(-(echoDist * echoDist) / (band * band * .55));
													const amp = fade * pulse.power * 6.8 * motionDamp;
													if (pDist > .5) {
														rx += pdx / pDist * wave * amp;
														ry += pdy / pDist * wave * amp;
													}
													crestShift += Math.max(0, crest) * fade * 1.35;
												}
											} else {
												const front = ageSec * (195 * pulse.speed);
												const band = Math.max(46, pulse.wavelength * .58);
												const pDist = pulse.pattern === "sweep" ? Math.abs(pdx * sweepAxisX + pdy * sweepAxisY) : Math.hypot(pdx, pdy);
												const delta = pDist - front;
												if (Math.abs(delta) < band * 1.8) {
													const env = Math.exp(-ageSec * 1.45) * Math.exp(-(delta * delta) / (band * band * .54));
													const wave = pulse.pattern === "pulse" ? .85 : Math.sin(delta / pulse.wavelength * Math.PI * 2);
													const amp = env * pulse.power * 5.2 * motionDamp;
													if (pulse.pattern === "sweep") {
														rx += -.4067 * wave * amp;
														ry += sweepAxisX * wave * amp;
													} else if (pDist > .5) {
														const radDist = Math.hypot(pdx, pdy) || 1;
														rx += pdx / radDist * wave * amp;
														ry += pdy / radDist * wave * amp;
													}
													crestShift += Math.max(0, wave) * env * 1.15;
												}
											}
										}
									}
									anchorX += rx * (1 - meltBlend);
									anchorY += ry * (1 - meltBlend);
								}
								const dx = anchorX - px;
								const dy = anchorY - py;
								const distSq = dx * dx + dy * dy;
								const speedSq = pvx * pvx + pvy * pvy;
								if (!hasRippleField && !isDissolving && distSq < .16 && speedSq < .025) {
									px = anchorX;
									py = anchorY;
									glyphVx = 0;
									glyphVy = 0;
								} else {
									const dist = Math.sqrt(distSq);
									const gain = localCohesion * (hasRippleField ? 2.15 : 1.75) / (1 + dist * .032);
									const damp = hasRippleField ? .72 + .1 * (1 - Math.exp(-dist * .04)) : .78 + .1 * (1 - Math.exp(-dist * .04));
									glyphVx = (pvx + dx * gain) * damp;
									glyphVy = (pvy + dy * gain) * damp;
								}
							}
						}
						if (meltBlend > .001) {
							let waveVx = pvx;
							let waveVy = pvy;
							const releaseCurl = meltBlend * (1 - meltBlend) * .11;
							const meltWindX = usePerlinWind ? windField.sampleX(px, py) : Math.cos(flowAngle);
							const meltWindY = usePerlinWind ? windField.sampleY(px, py) : Math.sin(flowAngle);
							if (pLayer >= 0) {
								let u = waveU[i] + waveDriftSpeed * .016 * (.65 + depth[i] * .55);
								if (u >= 1) u -= 1;
								waveU[i] = u;
								const wavePt = computeWavePoint(u, waveV[i], pLayer, pPhase, time, width, height);
								let dx = wavePt.x - px;
								if (dx > halfWidth) dx -= width;
								else if (dx < -halfWidth) dx += width;
								const invMass = 1 / pMass;
								const activeWavePull = (usePerlinWind ? .009 : .014) * meltBlend;
								const windScale = usePerlinWind ? .068 * invMass : .028;
								waveVx += dx * activeWavePull * invMass;
								waveVy += (wavePt.y - py) * activeWavePull * invMass;
								waveVx += meltWindX * windScale * turb + releaseCurl;
								waveVy += meltWindY * windScale * turb + thermalDriftY;
								const airDrag = .875 + (pMass - 1) * .018;
								waveVx *= airDrag;
								waveVy *= airDrag;
							} else {
								const windScale = usePerlinWind ? .088 * turb * (.68 + depth[i] * .64) / pMass : .032 * turb * wanderSpeed[i] / pMass;
								waveVx += meltWindX * windScale + releaseCurl;
								waveVy += meltWindY * windScale + thermalDriftY;
								waveVx *= .965;
								waveVy *= .965;
							}
							pvx = glyphVx * (1 - meltBlend) + waveVx * meltBlend;
							pvy = glyphVy * (1 - meltBlend) + waveVy * meltBlend;
						} else {
							pvx = glyphVx;
							pvy = glyphVy;
						}
					}
				} else if (pLayer >= 0) {
					let u = waveU[i] + waveDriftSpeed * .016 * (.65 + depth[i] * .55);
					if (u >= 1) u -= 1;
					waveU[i] = u;
					const wavePt = computeWavePoint(u, waveV[i], pLayer, pPhase, time, width, height);
					let dx = wavePt.x - px;
					if (dx > halfWidth) dx -= width;
					else if (dx < -halfWidth) dx += width;
					const invMass = 1 / pMass;
					const activePull = isFree && usePerlinWind ? wavePull * .52 : wavePull;
					pvx += dx * activePull * invMass;
					pvy += (wavePt.y - py) * activePull * invMass;
					if (isFree && usePerlinWind) {
						const windGain = .072 * turb * invMass;
						pvx += windField.sampleX(px, py) * windGain;
						pvy += windField.sampleY(px, py) * windGain + thermalDriftY;
					} else {
						pvx += Math.cos(flowAngle) * .024 * turb;
						pvy += Math.sin(flowAngle) * .024 * turb + thermalDriftY;
					}
					const airDrag = .865 + (pMass - 1) * .018;
					pvx *= airDrag;
					pvy *= airDrag;
				} else {
					if (isFree && usePerlinWind) {
						const depthWeight = .68 + depth[i] * .64;
						const windGain = .095 * turb * depthWeight / pMass;
						pvx += windField.sampleX(px, py) * windGain;
						pvy += windField.sampleY(px, py) * windGain + thermalDriftY;
					} else {
						const driftForce = .028 * turb * wanderSpeed[i] / pMass;
						pvx += Math.cos(flowAngle) * driftForce;
						pvy += Math.sin(flowAngle) * driftForce + thermalDriftY;
					}
					pvx *= .965;
					pvy *= .965;
				}
				if (wakeLen > 0) for (let wn = wakeLen - 1; wn >= 0; wn--) {
					const node = wakeNodes[wn];
					const wdx = px - node.x;
					const wdy = py - node.y;
					const wDistSq = wdx * wdx + wdy * wdy;
					if (wDistSq < 7225) {
						const ageRatio = 1 - (now - node.bornAt) / 650;
						const distRatio = 1 - Math.sqrt(wDistSq) / 85;
						const wakeGain = ageRatio * distRatio * .065 / pMass;
						pvx += node.vx * wakeGain;
						pvy += node.vy * wakeGain;
						pEnergy = Math.min(1, pEnergy + ageRatio * distRatio * .08);
					}
				}
				const isHoveredButton = isLayoutStage && hoveredBtnId >= 0 && regionId[i] === hoveredBtnId;
				if (isHoveredButton) pEnergy = Math.max(pEnergy, .56);
				if (ptr.active && cursorEnabled && !isHoveredButton) {
					const pdx = px - ptr.x;
					const pdy = py - ptr.y;
					const distSq = pdx * pdx + pdy * pdy;
					if (distSq < pointerRadiusSq && distSq > .01) {
						const dist = Math.sqrt(distSq);
						const falloff = 1 - dist / pointerRadius;
						const nx = pdx / dist;
						const ny = pdy / dist;
						pEnergy = Math.min(1, pEnergy + falloff * .36);
						if (isGlyph) gravityBreakUntil[i] = now + 420 + falloff * 480;
						if (holdEngaged || currentPhysics.cursorMode === "vortex") {
							const pullStrength = holdEngaged ? 1.5 : .72;
							const spinStrength = holdEngaged ? 2.05 : 1.1;
							pvx += (-nx * pullStrength - ny * spinStrength) * falloff;
							pvy += (-ny * pullStrength + nx * spinStrength) * falloff;
						} else if (currentPhysics.cursorMode === "breeze") {
							const speedMag = Math.min(18, Math.hypot(ptr.vx, ptr.vy));
							const windX = speedMag > .5 ? ptr.vx * .22 : Math.cos(time * .9) * .55;
							const windY = speedMag > .5 ? ptr.vy * .22 : Math.sin(time * .9) * .55;
							pvx += (windX + nx * .52) * falloff;
							pvy += (windY + ny * .52) * falloff;
						} else {
							const push = falloff * falloff * 3.4;
							pvx += nx * push - ny * falloff * .5;
							pvy += ny * push + nx * falloff * .5;
						}
					}
				}
				px += pvx;
				py += pvy;
				pEnergy *= .93;
				if (!isGlyph || meltBlend > .85) {
					if (px < 0) px += width;
					else if (px >= width) px -= width;
					if (py < -16) py = height + 16;
					else if (py > height + 16) py = -16;
				}
				x[i] = px;
				y[i] = py;
				vx[i] = pvx;
				vy[i] = pvy;
				energy[i] = pEnergy;
				const twinkle = isReduced ? 1 : .8 + .2 * Math.sin(time * (.42 + wanderSpeed[i] * .36) + pPhase);
				const normX = Math.max(0, Math.min(1, px / width));
				const ridgeFocus = pLayer >= 0 ? 1 - Math.min(1, Math.abs(waveV[i])) : .2;
				const cSeed = colorSeed[i];
				let hueT;
				let alphaWeight;
				const positiveCrest = crestShift > 0 ? Math.min(1.2, crestShift) : 0;
				const layerShift = pLayer === 0 ? .14 : pLayer === 1 ? -.06 : .04;
				const waveHueT = pLayer >= 0 ? Math.max(0, Math.min(1, normX * .72 + ridgeFocus * .26 + layerShift + (cSeed - .5) * .14 + pEnergy * .32)) : Math.max(0, Math.min(1, normX * .65 + cSeed * .35 + pEnergy * .24));
				const baseRibbonStageDim = isFree ? 1 : isCompositeStage ? .18 : .32;
				const baseDustStageDim = isFree ? 1 : isCompositeStage ? .42 : .65;
				const ribbonStageDim = baseRibbonStageDim + (1 - baseRibbonStageDim) * dissolveProgress;
				const dustStageDim = baseDustStageDim + (1 - baseDustStageDim) * dissolveProgress;
				const waveAlpha = pLayer >= 0 ? Math.min(1, (.2 + ridgeFocus * .54 + pEnergy * .28) * ribbonStageDim * twinkle) * waveAlphaScale : Math.min(1, baseAlpha[i] * dustStageDim * twinkle + pEnergy * .22) * waveAlphaScale;
				if (isGlyph) {
					const isHoveredBtn = isLayoutStage && hoveredBtnId >= 0 && regionId[i] === hoveredBtnId;
					const glyphHue = isCompositeStage ? Math.min(1, .34 + baseAlpha[i] * .58 + cSeed * .08 + pEnergy * .22 + positiveCrest * .18 + (isHoveredBtn ? .16 : 0)) : Math.min(1, .54 + normX * .26 + cSeed * .16 + pEnergy * .2 + positiveCrest * .18);
					const glyphAlpha = Math.min(1, (baseAlpha[i] + pEnergy * .22 + positiveCrest * .16 + (isHoveredBtn ? .18 : 0)) * (isCompositeStage ? .96 + .04 * twinkle : isFringe[i] ? twinkle : .9 + .1 * twinkle)) * textAlphaScale;
					hueT = glyphHue * (1 - meltBlend) + waveHueT * meltBlend;
					alphaWeight = glyphAlpha * (1 - meltBlend) + waveAlpha * meltBlend;
					if (dimTransit) {
						const far = Math.abs(tx[i] - px) + Math.abs(ty[i] - py);
						if (far > 12) alphaWeight *= 1 - .95 * Math.min(1, (far - 12) / 90);
					}
				} else {
					hueT = waveHueT;
					alphaWeight = waveAlpha;
				}
				const lutIdx = Math.min(255, Math.max(0, Math.floor(hueT * 255))) * 3;
				const plane = isGlyph && meltBlend < .5 ? 1 : depthPlane[i];
				const drawX = px + (plane === 0 ? parX0 : parX1);
				const drawY = py + (plane === 0 ? parY0 : parY1);
				const isHoveredBtnSize = isGlyph && isLayoutStage && hoveredBtnId >= 0 && regionId[i] === hoveredBtnId;
				const targetParticleScale = isGlyph ? glyphSizeScale * (1 - meltBlend) + meltBlend : 1;
				const baseOffset = i * 8;
				const speed = Math.hypot(pvx, pvy);
				speedSum += speed;
				energySum += pEnergy;
				const driftShimmer = isFree || !isGlyph ? .16 + positiveCrest * .24 : meltBlend * .42;
				const motionGlow = Math.min(1.4, speed * .34 + pEnergy * .85 + positiveCrest * .25 + driftShimmer + (isHoveredBtnSize ? .28 * (1 - meltBlend) : 0));
				vData[baseOffset + 0] = drawX;
				vData[baseOffset + 1] = drawY;
				vData[baseOffset + 2] = lut[lutIdx + 0];
				vData[baseOffset + 3] = lut[lutIdx + 1];
				vData[baseOffset + 4] = lut[lutIdx + 2];
				vData[baseOffset + 5] = Math.min(1, alphaWeight);
				vData[baseOffset + 6] = size[i] * targetParticleScale + pEnergy * .12 + positiveCrest * .22 + (isHoveredBtnSize ? .26 * (1 - meltBlend) : 0);
				vData[baseOffset + 7] = dimTransit && isGlyph ? motionGlow * Math.min(1, alphaWeight * 1.6) : motionGlow;
			}
			let lineVertexCount = 0;
			const constellation = this.constellation;
			if (currentPhysics.constellation) lineVertexCount = constellation.build(vData, count, width, height, PALETTE_THEMES[currentPalette].isDark);
			activeRenderer.render(width, height, dpr, currentPalette, this.shockUniforms, vData, count, currentPhysics.bloom, constellation.vertexData, lineVertexCount);
			if (now - this.lastAudioReportAt >= 65) {
				this.lastAudioReportAt = now;
				const denom = Math.max(1, count);
				this.o.onMotionMetrics?.({
					particleCount: count,
					avgVelocity: speedSum / denom,
					avgEnergy: energySum / denom
				});
			}
			if (dissolveProgress >= 1 && !this.dissolveFired && !isFree) {
				this.dissolveFired = true;
				this.o.onAutoDissolvedToWave?.();
			}
		};
		this.canvas = canvas;
		this.o = mergeOptions({ ...DEFAULTS }, options);
		this.lastSampledTuning = this.o.imageTuning;
		if (this.o.fill) {
			canvas.style.display = "block";
			canvas.style.width = "100%";
			canvas.style.height = "100%";
		}
		canvas.style.touchAction = "none";
		canvas.style.userSelect = "none";
		this.updateCursor();
		try {
			this.renderer = new WebGLDustRenderer(canvas);
			this.supported = true;
		} catch {
			this.supported = false;
			return;
		}
		this.listen(canvas, "webglcontextlost", (e) => e.preventDefault());
		this.listen(canvas, "webglcontextrestored", () => {
			try {
				this.renderer = new WebGLDustRenderer(canvas);
			} catch {}
		});
		if (typeof window !== "undefined" && window.matchMedia) {
			const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
			this.reducedMotion = motionQuery.matches;
			const onMotionChange = (e) => {
				this.reducedMotion = e.matches;
			};
			motionQuery.addEventListener("change", onMotionChange);
			this.cleanups.push(() => motionQuery.removeEventListener("change", onMotionChange));
		}
		this.listen(canvas, "pointermove", (e) => this.handlePointerMove(e));
		this.listen(canvas, "pointerdown", (e) => this.handlePointerDown(e));
		this.listen(canvas, "pointerup", (e) => this.handlePointerUp(e));
		this.listen(canvas, "pointerleave", () => this.handlePointerLeave());
		this.listen(canvas, "pointercancel", () => this.handlePointerLeave());
		this.listen(canvas, "wheel", (e) => this.handleWheel(e), { passive: false });
		this.listen(canvas, "keydown", (e) => this.handleKeyDown(e));
		this.listen(canvas, "blur", () => this.setKeyboardFocus(-1));
		if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(() => this.handleResize());
			ro.observe(canvas);
			this.cleanups.push(() => ro.disconnect());
		} else this.listen(window, "resize", () => this.handleResize());
		this.handleResize();
		whenFontsReady().then(() => {
			if (!this.destroyed) this.assignTargets();
		});
		this.refreshTargets();
		this.startTime = performance.now();
		this.rafId = requestAnimationFrame(this.renderFrame);
	}
	/** Current resolved options (read-only snapshot). */
	getOptions() {
		return this.o;
	}
	/** Current particle count. */
	get particleCount() {
		return this.pool.count;
	}
	/**
	* Update any subset of options. Only the options that changed trigger work:
	* content/density/font changes re-sample targets; everything else applies next frame.
	*/
	setOptions(next) {
		if (this.destroyed) return;
		const prev = this.o;
		const o = mergeOptions(prev, next);
		this.o = o;
		if (o.freeDrift !== prev.freeDrift || o.physics.autoDissolveSec !== prev.physics.autoDissolveSec || o.layoutAutoDissolve !== prev.layoutAutoDissolve) this.resetIdleDissolve();
		if (o.physics.cursorMode !== prev.physics.cursorMode || o.manageCursor !== prev.manageCursor) this.updateCursor();
		const needsRetarget = o.text !== prev.text || o.targetMode !== prev.targetMode || o.imageSrc !== prev.imageSrc || o.invertImageContrast !== prev.invertImageContrast || !sameTuning(o.imageTuning, prev.imageTuning) || o.layoutAst !== prev.layoutAst || o.layoutLeftInset !== prev.layoutLeftInset || o.collapsedMindMapIds !== prev.collapsedMindMapIds || PALETTE_THEMES[o.palette].isDark !== PALETTE_THEMES[prev.palette].isDark || o.freeDrift !== prev.freeDrift || o.physics.density !== prev.physics.density || o.physics.fontStyle !== prev.physics.fontStyle || o.targetMode === "layout" && (o.layoutOverflow !== prev.layoutOverflow || o.layoutMinFontSize !== prev.layoutMinFontSize || o.layoutParticleBudget !== prev.layoutParticleBudget || o.layoutWindow !== prev.layoutWindow || !samePadding(resolveLayoutPadding(o.layoutPadding, this.size.width, this.size.height), resolveLayoutPadding(prev.layoutPadding, this.size.width, this.size.height)));
		if (o.layoutAst !== prev.layoutAst || o.targetMode !== prev.targetMode) this.setKeyboardFocus(-1);
		if (needsRetarget && this.supported) this.refreshTargets();
	}
	/** Blow the current formation apart with a left-to-right gust of wind. */
	scatter() {
		if (!this.supported || this.destroyed) return;
		this.resetIdleDissolve();
		const { width } = this.size;
		const pool = this.pool;
		const now = performance.now();
		const safeW = Math.max(1, width);
		const { x, hasTarget, windReleaseAt, gravityBreakUntil } = pool;
		for (let i = 0; i < pool.count; i++) {
			const delay = Math.max(0, Math.min(1, x[i] / safeW)) * 260 + Math.random() * 55;
			windReleaseAt[i] = now + delay;
			if (hasTarget[i]) gravityBreakUntil[i] = now + delay + 460 + Math.random() * 320;
		}
	}
	/** Reset the idle auto-dissolve timer, as if the user had just interacted. */
	markActivity() {
		this.resetIdleDissolve();
	}
	/** Current layout scroll offset in px (0 when the layout fits). */
	get scrollTop() {
		return this.scrollPos;
	}
	/** Largest possible layout scroll offset in px (0 when the layout fits). */
	get scrollHeight() {
		return this.scrollLimit;
	}
	/**
	* Clickable layout regions (`<Button>`s, collapsible mind-map nodes) in canvas CSS px, at the current
	* scroll position. Useful for overlaying accessible DOM controls.
	*/
	get layoutHitRegions() {
		return this.hitRegions.filter((r) => this.isInBand(r));
	}
	/**
	* The on-screen band (canvas px) where layout content is currently drawn, or null when the whole
	* layout is drawn. Useful for placing a scroll hint or fade below it.
	*/
	get layoutBand() {
		return this.layoutWindow ? this.layoutWindow.band(this.scrollPos) : null;
	}
	/**
	* Scroll a layout that overflows the canvas (smooth by default). Formed text moves with the scroll;
	* content leaving the screen dissolves and its particles re-form the content coming in.
	*/
	scrollTo(top, options = {}) {
		if (this.destroyed) return;
		this.scrollGoal = Math.max(0, Math.min(this.scrollLimit, top));
		if (options.smooth === false) this.applyScroll(this.scrollGoal - this.scrollPos);
	}
	/** Scroll by a relative amount (see `scrollTo`). */
	scrollBy(dy, options = {}) {
		this.scrollTo(this.scrollGoal + dy, options);
	}
	/** Stop the animation loop, remove all listeners and release GPU resources. */
	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.targetToken++;
		cancelAnimationFrame(this.rafId);
		if (this.resizeTimer) clearTimeout(this.resizeTimer);
		if (this.targetDebounce) clearTimeout(this.targetDebounce);
		for (const fn of this.cleanups) fn();
		this.cleanups = [];
		this.renderer?.dispose();
		this.renderer = null;
	}
	listen(target, type, fn, options) {
		target.addEventListener(type, fn, options);
		this.cleanups.push(() => target.removeEventListener(type, fn, options));
	}
	/** Whether a hit region is inside the drawn band (buttons outside it are invisible, so not clickable). */
	isInBand(r) {
		if (!this.layoutWindow) return true;
		const band = this.layoutWindow.band(this.scrollPos);
		const cy = r.y + r.height * .5;
		return cy >= band.top - 2 && cy <= band.bottom + 2;
	}
	canScroll() {
		return this.o.targetMode === "layout" && !this.o.freeDrift && this.scrollLimit > 0;
	}
	/** Move the content by `dy` px: shift particle targets and hit/ripple regions; particles follow on their springs. */
	applyScroll(dy) {
		if (dy === 0) return;
		this.scrollPos += dy;
		const carry = dy * (1 - Math.max(0, Math.min(1, this.o.layoutScrollTrail)));
		const { count, hasTarget, ty, y } = this.pool;
		for (let i = 0; i < count; i++) if (hasTarget[i] === 1 && !this.hints.isHint(i)) {
			ty[i] -= dy;
			y[i] -= carry;
		}
		for (const r of this.hitRegions) r.y -= dy;
		for (const r of this.rippleRegions) {
			r.y -= dy;
			r.cy -= dy;
		}
		this.layoutWindow?.update(this.pool, this.scrollPos, performance.now());
		this.resetIdleDissolve();
		this.o.onScroll?.(this.scrollPos, this.scrollLimit);
	}
	updateScrollHints(time, now) {
		const w = this.layoutWindow;
		if (!this.o.layoutScrollHint || !w || !this.canScroll()) {
			this.hints.clear(this.pool, now);
			return;
		}
		const band = w.band(this.scrollPos);
		this.hints.update(this.pool, {
			centerX: w.centerX,
			bandTop: band.top,
			bandBottom: band.bottom,
			canvasHeight: this.size.height,
			showDown: this.scrollGoal < this.scrollLimit - 1,
			showUp: this.scrollGoal > 1
		}, time, now);
	}
	/** Scroll roughly one band in a direction (used by the hint chevrons). */
	pageScroll(dir) {
		const band = this.layoutWindow?.band(this.scrollPos);
		const step = band ? Math.max(120, (band.bottom - band.top) * .8) : this.size.height * .8;
		this.scrollBy(dir * step);
	}
	/** A layout button was clicked or pressed: glow, shockwave, sound, then `onLayoutAction`. */
	activateHit(hit) {
		const pool = this.pool;
		for (let i = 0; i < pool.count; i++) if (pool.regionId[i] === hit.rippleRegionId) pool.energy[i] = 1;
		this.shockwaves.push({
			x: hit.x + hit.width * .5,
			y: hit.y + hit.height * .5,
			radius: 10,
			maxRadius: Math.max(130, hit.width * .9),
			alpha: .42
		});
		this.o.onSoundImpulse?.(.7, (hit.x + hit.width * .5) / Math.max(1, this.size.width));
		this.o.onLayoutAction?.(hit.action, hit);
	}
	/** Highlight a layout button for keyboard users (reuses the hover glow); -1 clears it. */
	setKeyboardFocus(rippleRegionId) {
		if (this.kbFocusId === rippleRegionId) return;
		const hadFocus = this.kbFocusId >= 0;
		this.kbFocusId = rippleRegionId;
		if (rippleRegionId >= 0 || hadFocus) {
			this.hoveredRegionId = rippleRegionId;
			this.syncHover(rippleRegionId >= 0);
		}
	}
	/** Scroll just enough that a region sits inside the clear band. */
	scrollIntoBand(r) {
		if (!this.canScroll()) return;
		const band = this.layoutWindow?.band(this.scrollPos) ?? {
			top: 0,
			bottom: this.size.height
		};
		const pad = 24;
		if (r.y < band.top + pad) this.scrollTo(this.scrollGoal + r.y - (band.top + pad));
		else if (r.y + r.height > band.bottom - pad) this.scrollTo(this.scrollGoal + r.y + r.height - (band.bottom - pad));
	}
	handleKeyDown(e) {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		if (!(this.o.targetMode === "layout" && !this.o.freeDrift)) return;
		if (e.key === "Tab") {
			const order = this.hitRegions.slice().sort((a, b) => Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x);
			if (order.length === 0) return;
			const cur = order.findIndex((r) => r.rippleRegionId === this.kbFocusId);
			const next = cur === -1 ? e.shiftKey ? order.length - 1 : 0 : cur + (e.shiftKey ? -1 : 1);
			if (next < 0 || next >= order.length) {
				this.setKeyboardFocus(-1);
				return;
			}
			e.preventDefault();
			this.setKeyboardFocus(order[next].rippleRegionId);
			this.scrollIntoBand(order[next]);
			return;
		}
		if (e.key === "Escape") {
			this.setKeyboardFocus(-1);
			return;
		}
		if ((e.key === "Enter" || e.key === " ") && this.kbFocusId >= 0) {
			const hit = this.hitRegions.find((r) => r.rippleRegionId === this.kbFocusId);
			if (hit) {
				e.preventDefault();
				this.activateHit(hit);
				return;
			}
		}
		if (!this.canScroll()) return;
		const band = this.layoutWindow?.band(this.scrollPos);
		const page = band ? Math.max(120, (band.bottom - band.top) * .85) : this.size.height * .85;
		let goal = null;
		switch (e.key) {
			case "ArrowDown":
				goal = this.scrollGoal + 48;
				break;
			case "ArrowUp":
				goal = this.scrollGoal - 48;
				break;
			case "PageDown":
				goal = this.scrollGoal + page;
				break;
			case "PageUp":
				goal = this.scrollGoal - page;
				break;
			case " ":
				goal = this.scrollGoal + (e.shiftKey ? -page : page);
				break;
			case "Home":
				goal = 0;
				break;
			case "End": goal = this.scrollLimit;
		}
		if (goal === null) return;
		const clamped = Math.max(0, Math.min(this.scrollLimit, goal));
		if (clamped === this.scrollGoal) return;
		e.preventDefault();
		this.scrollGoal = clamped;
	}
	handleWheel(e) {
		if (!this.canScroll() || e.ctrlKey) return;
		const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.size.height * .9 : 1;
		const next = Math.max(0, Math.min(this.scrollLimit, this.scrollGoal + e.deltaY * unit));
		if (next === this.scrollGoal) return;
		e.preventDefault();
		this.scrollGoal = next;
	}
	toLocal(e) {
		const rect = this.canvas.getBoundingClientRect();
		return {
			lx: e.clientX - rect.left,
			ly: e.clientY - rect.top
		};
	}
	handleResize() {
		if (this.destroyed) return;
		const canvas = this.canvas;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (width === this.size.width && height === this.size.height && dpr === this.size.dpr) return;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		this.size = {
			width,
			height,
			dpr
		};
		if (this.resizeTimer) clearTimeout(this.resizeTimer);
		this.resizeTimer = setTimeout(() => {
			this.assignTargets();
		}, 80);
	}
	updateCursor() {
		if (!this.o.manageCursor) return;
		this.canvas.style.cursor = this.hoveredRegionId >= 0 || this.hintHover ? "pointer" : this.o.physics.cursorMode === "off" ? "default" : "crosshair";
	}
	/** Called whenever hoveredRegionId may have changed. */
	syncHover(_hovering) {
		this.updateCursor();
		if (this.hoveredRegionId === this.reportedHoverId) return;
		this.reportedHoverId = this.hoveredRegionId;
		const region = this.hoveredRegionId >= 0 ? this.hitRegions.find((r) => r.rippleRegionId === this.hoveredRegionId) ?? null : null;
		this.o.onHoverChange?.(region);
	}
	resetIdleDissolve() {
		this.lastActivityAt = performance.now();
		this.dissolveStartedAt = null;
		this.dissolveFired = false;
	}
	/** Load whatever the current target needs (image, layout images, fonts), then re-sample. */
	refreshTargets() {
		const token = ++this.targetToken;
		if (this.targetDebounce !== null) {
			clearTimeout(this.targetDebounce);
			this.targetDebounce = null;
		}
		const live = () => token === this.targetToken && !this.destroyed;
		const { targetMode, imageSrc, imageTuning, layoutAst } = this.o;
		const run = async () => {
			if (targetMode === "image") {
				if (!imageSrc) {
					this.assignTargets();
					return;
				}
				if (this.loadedImage?.src === imageSrc) {
					const tuningChanged = !sameTuning(this.lastSampledTuning, imageTuning);
					this.lastSampledTuning = imageTuning;
					if (tuningChanged) this.targetDebounce = setTimeout(() => {
						this.targetDebounce = null;
						if (live()) this.assignTargets();
					}, 35);
					else this.assignTargets();
					return;
				}
				this.lastSampledTuning = imageTuning;
				try {
					const img = await loadImageElement(imageSrc);
					if (live()) {
						this.loadedImage = {
							src: imageSrc,
							img
						};
						this.assignTargets();
					}
				} catch {
					if (live()) this.o.onImageError?.();
				}
				return;
			}
			if (targetMode === "layout") {
				await whenFontsReady();
				const rawRefs = collectLayoutImageRefs(layoutAst);
				const missing = Array.from(new Set(rawRefs.map((ref) => this.resolveImage(ref)).filter((url) => !!url))).filter((url) => !this.layoutImageCache.has(url));
				if (missing.length > 0) await Promise.all(missing.map(async (url) => {
					try {
						const img = await loadImageElement(url);
						this.layoutImageCache.set(url, img);
					} catch {}
				}));
				if (live()) this.assignTargets();
				return;
			}
			await whenFontsReady();
			if (live()) this.assignTargets();
		};
		run();
	}
	assignTargets() {
		this.resetIdleDissolve();
		const { width, height } = this.size;
		if (width === 0 || height === 0) return;
		const currentPhysics = this.o.physics;
		const ambientCount = getAmbientCount(currentPhysics.density, width, height);
		let targets = [];
		let fontSize = 72;
		let isImage = false;
		let layoutScrollLimit = 0;
		let windowed = null;
		this.hitRegions = [];
		this.rippleRegions = [];
		if (!this.o.freeDrift) {
			if (this.o.targetMode === "image") {
				const cached = this.loadedImage;
				if (cached && cached.src === this.o.imageSrc) {
					const isDarkTheme = PALETTE_THEMES[this.o.palette].isDark;
					const sampledImg = sampleImageTargets(cached.img, width, height, currentPhysics.density, this.o.invertImageContrast, isDarkTheme, this.o.imageTuning);
					targets = sampledImg.points;
					for (let p = 0; p < targets.length; p++) targets[p].regionId = 0;
					this.rippleRegions = [{
						id: 0,
						tag: "Stage",
						x: sampledImg.bounds.x,
						y: sampledImg.bounds.y,
						width: sampledImg.bounds.width,
						height: sampledImg.bounds.height,
						cx: sampledImg.bounds.x + sampledImg.bounds.width * .5,
						cy: sampledImg.bounds.y + sampledImg.bounds.height * .5
					}];
					this.imageCellSize = sampledImg.cellSize;
					isImage = true;
				}
			} else if (this.o.targetMode === "layout") {
				const isDarkTheme = PALETTE_THEMES[this.o.palette].isDark;
				const sampledLayout = sampleLayoutScene(this.o.layoutAst, width, height, currentPhysics.density, currentPhysics.fontStyle, this.o.invertImageContrast, isDarkTheme, this.o.imageTuning, this.layoutImageCache, this.resolveImage, {
					leftInset: this.o.layoutLeftInset,
					collapsedMindMapIds: this.o.collapsedMindMapIds,
					padding: resolveLayoutPadding(this.o.layoutPadding, width, height),
					overflow: this.o.layoutOverflow,
					minFontSize: this.o.layoutMinFontSize,
					particleBudget: this.o.layoutParticleBudget,
					trim: this.o.layoutWindow === "screen"
				});
				this.hitRegions = sampledLayout.hitRegions;
				this.rippleRegions = sampledLayout.rippleRegions;
				layoutScrollLimit = sampledLayout.scrollMax;
				const windowMode = this.o.layoutWindow;
				if (windowMode !== "screen" || layoutScrollLimit > 0) {
					const pad = resolveLayoutPadding(this.o.layoutPadding, width, height);
					windowed = new LayoutWindow(sampledLayout.points, sampledLayout.screenBudget, sampledLayout.priorityRegionIds, height, typeof windowMode === "number" ? Math.max(40, windowMode) : windowMode, {
						top: pad.top,
						bottom: height - pad.bottom
					});
					layoutScrollLimit = Math.max(layoutScrollLimit, windowed.scrollEnd());
				} else targets = sampledLayout.points;
				const off = Math.min(this.scrollPos, layoutScrollLimit);
				if (off > 0) {
					for (const r of this.hitRegions) r.y -= off;
					for (const r of this.rippleRegions) {
						r.y -= off;
						r.cy -= off;
					}
				}
				this.imageCellSize = sampledLayout.cellSize;
				fontSize = 36;
				if (this.hoveredRegionId >= 0 && !sampledLayout.hitRegions.some((r) => r.rippleRegionId === this.hoveredRegionId)) {
					this.hoveredRegionId = -1;
					this.syncHover(false);
				}
			} else if (this.o.text.trim()) {
				const sampled = sampleTextTargets(this.o.text, width, height, currentPhysics.fontStyle, currentPhysics.density);
				targets = sampled.points;
				for (let p = 0; p < targets.length; p++) targets[p].regionId = 0;
				this.rippleRegions = [{
					id: 0,
					tag: "Stage",
					x: sampled.bounds.x,
					y: sampled.bounds.y,
					width: sampled.bounds.width,
					height: sampled.bounds.height,
					cx: sampled.bounds.x + sampled.bounds.width * .5,
					cy: sampled.bounds.y + sampled.bounds.height * .5
				}];
				fontSize = sampled.fontSize;
			}
		} else {
			this.hoveredRegionId = -1;
			this.syncHover(false);
		}
		this.glyphFontSize = fontSize;
		const prevScroll = this.scrollPos;
		this.scrollLimit = layoutScrollLimit;
		this.scrollPos = Math.min(this.scrollPos, layoutScrollLimit);
		this.scrollGoal = Math.min(this.scrollGoal, layoutScrollLimit);
		if (this.scrollPos !== prevScroll) this.o.onScroll?.(this.scrollPos, this.scrollLimit);
		const bgRatio = isImage || this.o.targetMode === "layout" ? .34 : .6;
		const targetCount = windowed ? windowed.poolNeed : targets.length;
		const desiredTotal = targetCount + (targetCount > 0 ? Math.round(ambientCount * bgRatio) : ambientCount);
		const pool = this.pool;
		resizeParticlePool(pool, desiredTotal, width, height);
		if (this.vertexData.length < desiredTotal * 8) this.vertexData = new Float32Array(Math.ceil(desiredTotal * 1.25) * 8);
		this.layoutWindow = windowed;
		this.hints.reset(pool.capacity);
		if (windowed) windowed.assignAll(pool, this.scrollPos, width, height);
		else assignTargetsByProximity(pool, targets, width, height, fontSize, isImage || this.o.targetMode === "layout");
		this.o.onParticleCountChange?.(pool.count);
	}
	handlePointerMove(e) {
		const { lx, ly } = this.toLocal(e);
		const overHint = this.o.layoutScrollHint && this.hints.hit(lx, ly) !== null;
		if (overHint !== this.hintHover) {
			this.hintHover = overHint;
			this.updateCursor();
		}
		const ts = this.touchScroll;
		if (ts && this.pointer.down) {
			const dy = ly - ts.startY;
			if (!ts.active && Math.abs(dy) > 10) ts.active = true;
			if (ts.active) {
				this.scrollGoal = Math.max(0, Math.min(this.scrollLimit, ts.startGoal - dy));
				this.pointer.active = false;
				return;
			}
		}
		const ptr = this.pointer;
		const x = lx;
		const y = ly;
		const now = performance.now();
		if (Math.hypot(x - this.lastMovePos.x, y - this.lastMovePos.y) > 3) {
			this.lastMovePos.x = x;
			this.lastMovePos.y = y;
			this.resetIdleDissolve();
		}
		if (ptr.active) {
			ptr.vx = x - ptr.x;
			ptr.vy = y - ptr.y;
			const speed = Math.hypot(ptr.vx, ptr.vy);
			if (this.o.physics.cursorMode !== "off") {
				if (speed > 4.5) {
					const nodes = this.wakeNodes;
					if (nodes.length >= MAX_WAKE_NODES) nodes.shift();
					nodes.push({
						x,
						y,
						vx: ptr.vx,
						vy: ptr.vy,
						bornAt: now
					});
				}
				if (speed > 58 && now > ptr.swipeCooldownUntil && !this.o.freeDrift) {
					ptr.swipeCooldownUntil = now + 5200;
					this.o.onSoundImpulse?.(.78, x / Math.max(1, this.size.width));
					this.o.onGesture?.("fast-swipe");
				}
			}
		}
		if (this.o.targetMode === "layout" && !this.o.freeDrift) {
			const hit = this.hitRegions.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height && this.isInBand(r));
			const nextId = hit ? hit.rippleRegionId : -1;
			if (nextId !== this.hoveredRegionId && (nextId >= 0 || this.kbFocusId < 0)) {
				this.kbFocusId = -1;
				this.hoveredRegionId = nextId;
				this.syncHover(nextId >= 0);
			}
		} else if (this.hoveredRegionId !== -1) {
			this.hoveredRegionId = -1;
			this.syncHover(false);
		}
		if (!this.o.freeDrift) {
			const regions = this.rippleRegions;
			const hoverPad = 14;
			const matched = regions.find((r) => x >= r.x - hoverPad && x <= r.x + r.width + hoverPad && y >= r.y - hoverPad && y <= r.y + r.height + hoverPad);
			if (matched) {
				const res = resolveRegionRipple(matched, this.o.ripple);
				if (res.allowHover && res.pattern !== "off") {
					const last = this.lastHoverRipple;
					const moved = Math.hypot(x - last.x, y - last.y);
					if (last.regionId !== matched.id && now - last.time > 90 || moved > 26 && now - last.time > 150) {
						last.time = now;
						last.x = x;
						last.y = y;
						last.regionId = matched.id;
						const pulses = this.ripplePulses;
						if (pulses.length >= MAX_RIPPLE_PULSES) pulses.shift();
						pulses.push({
							x,
							y,
							regionId: this.o.targetMode === "layout" ? matched.id : -1,
							pattern: res.pattern,
							bornAt: now,
							power: res.strength * .78,
							speed: res.speed,
							wavelength: res.wavelength
						});
					}
				}
			}
		}
		ptr.x = x;
		ptr.y = y;
		ptr.active = true;
	}
	handlePointerDown(e) {
		const { lx, ly } = this.toLocal(e);
		this.resetIdleDissolve();
		this.o.onUserActivity?.();
		const ptr = this.pointer;
		ptr.x = lx;
		ptr.y = ly;
		ptr.downX = lx;
		ptr.downY = ly;
		ptr.down = true;
		ptr.active = true;
		ptr.downAt = performance.now();
		this.touchScroll = e.pointerType === "touch" && this.canScroll() ? {
			startY: ly,
			startGoal: this.scrollGoal,
			active: false
		} : null;
	}
	handlePointerUp(e) {
		const { lx, ly } = this.toLocal(e);
		const ptr = this.pointer;
		if (!ptr.down) return;
		ptr.down = false;
		const wasScrolling = this.touchScroll?.active;
		this.touchScroll = null;
		if (wasScrolling) return;
		const now = performance.now();
		const heldMs = now - ptr.downAt;
		const movedDist = Math.hypot(lx - ptr.downX, ly - ptr.downY);
		if (movedDist < 16 && this.o.layoutScrollHint) {
			const hint = this.hints.hit(lx, ly);
			if (hint) {
				this.pageScroll(hint === "down" ? 1 : -1);
				return;
			}
		}
		if (!this.o.freeDrift && movedDist < 16) {
			const pad = 20;
			const matched = this.rippleRegions.find((r) => lx >= r.x - pad && lx <= r.x + r.width + pad && ly >= r.y - pad && ly <= r.y + r.height + pad) ?? this.rippleRegions[0];
			const res = resolveRegionRipple(matched, this.o.ripple);
			if (res.allowClick && res.pattern !== "off") {
				const pulses = this.ripplePulses;
				if (pulses.length >= MAX_RIPPLE_PULSES) pulses.shift();
				const isGlobalExpand = res.pattern === "expand" && (!matched || matched.pattern === void 0);
				pulses.push({
					x: lx,
					y: ly,
					regionId: isGlobalExpand || this.o.targetMode !== "layout" || !matched ? -1 : matched.id,
					pattern: res.pattern,
					bornAt: now,
					power: res.strength * 1.28,
					speed: res.speed,
					wavelength: res.wavelength
				});
			}
		}
		if (this.o.targetMode === "layout" && !this.o.freeDrift && movedDist < 14 && heldMs < 420) {
			const hit = this.hitRegions.find((r) => lx >= r.x && lx <= r.x + r.width && ly >= r.y && ly <= r.y + r.height && this.isInBand(r));
			if (hit) {
				this.activateHit(hit);
				return;
			}
		}
		if (this.o.physics.cursorMode === "off") {
			if (movedDist < 16) this.o.onCanvasClick?.();
			return;
		}
		const pool = this.pool;
		const burstRadius = heldMs > 360 ? 225 : 148;
		const burstRadiusSq = burstRadius * burstRadius;
		const burstPower = heldMs > 360 ? 9.5 : 5.8;
		const { x, y, vx, vy, energy, hasTarget, gravityBreakUntil } = pool;
		for (let i = 0; i < pool.count; i++) {
			const dx = x[i] - lx;
			const dy = y[i] - ly;
			const distSq = dx * dx + dy * dy;
			if (distSq < burstRadiusSq && distSq > .01) {
				const dist = Math.sqrt(distSq);
				const factor = (1 - dist / burstRadius) * burstPower;
				vx[i] += dx / dist * factor;
				vy[i] += dy / dist * factor;
				energy[i] = 1;
				if (hasTarget[i] === 1) gravityBreakUntil[i] = now + 520 + (1 - dist / burstRadius) * 420;
			}
		}
		this.shockwaves.push({
			x: lx,
			y: ly,
			radius: 8,
			maxRadius: burstRadius,
			alpha: .34
		});
		this.o.onSoundImpulse?.(heldMs > 360 ? .92 : .58, lx / Math.max(1, this.size.width));
		if (heldMs > 420) {
			this.o.onGesture?.("vortex-release");
			return;
		}
		if (movedDist < 16) {
			ptr.recentClicks = ptr.recentClicks.filter((t) => now - t < 1800);
			ptr.recentClicks.push(now);
			if (ptr.recentClicks.length >= 3) {
				ptr.recentClicks = [];
				this.o.onGesture?.("tap-burst");
			} else this.o.onCanvasClick?.();
		}
	}
	handlePointerLeave() {
		this.touchScroll = null;
		this.pointer.active = false;
		this.pointer.down = false;
		if (this.hoveredRegionId !== -1) {
			this.hoveredRegionId = -1;
			this.syncHover(false);
		}
	}
};
export { DEFAULT_IMAGE_TUNING as a, defaultLayoutImageUrl as i, DEFAULT_RIPPLE as n, PALETTE_THEMES as o, StarDust as r, DEFAULT_PHYSICS as t };

//# sourceMappingURL=StarDust-0oIwC1aD.js.map