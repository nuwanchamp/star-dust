import { PALETTE_THEMES } from './dustAtlas';
import type { PaletteMode } from '../types/mote';

export interface ShockwaveUniform {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

const VERTEX_SHADER_BG = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_quad;
out vec2 v_uv;
void main() {
  v_uv = a_quad * 0.5 + 0.5;
  gl_Position = vec4(a_quad, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_BG = `#version 300 es
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

const VERTEX_SHADER_PARTICLES = `#version 300 es
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

const FRAGMENT_SHADER_PARTICLES = `#version 300 es
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

const FRAGMENT_SHADER_DECAY = `#version 300 es
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

const FRAGMENT_SHADER_EXTRACT = `#version 300 es
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

const FRAGMENT_SHADER_BLUR = `#version 300 es
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

const FRAGMENT_SHADER_COMPOSITE = `#version 300 es
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

const VERTEX_SHADER_LINES = `#version 300 es
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

const FRAGMENT_SHADER_LINES = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;

void main() {
  outColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate WebGL2 shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Unable to allocate WebGL2 program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || 'Unknown program link error';
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  return prog;
}

interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): RenderTarget {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error('Unable to allocate WebGL2 post-process render target');

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

  return { fbo, tex, width, height };
}

function deleteRenderTarget(gl: WebGL2RenderingContext, target: RenderTarget | null): void {
  if (!target) return;
  gl.deleteFramebuffer(target.fbo);
  gl.deleteTexture(target.tex);
}

function hexToVec3(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

const paletteLutCache = new Map<PaletteMode, Float32Array>();

export function getPaletteLut(palette: PaletteMode): Float32Array {
  const existing = paletteLutCache.get(palette);
  if (existing) return existing;

  const stops = PALETTE_THEMES[palette].stops;
  const lut = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const scaled = t * (stops.length - 1);
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

export const FLOATS_PER_VERTEX = 8; // x, y, r, g, b, a, size, motion

export class WebGLDustRenderer {
  private gl: WebGL2RenderingContext;
  private bgProgram: WebGLProgram;
  private ptProgram: WebGLProgram;
  private lineProgram: WebGLProgram;
  private decayProgram: WebGLProgram;
  private extractProgram: WebGLProgram;
  private blurProgram: WebGLProgram;
  private compositeProgram: WebGLProgram;

  private bgVao: WebGLVertexArrayObject;
  private bgVbo: WebGLBuffer;
  private ptVao: WebGLVertexArrayObject;
  private ptVbo: WebGLBuffer;
  private lineVao: WebGLVertexArrayObject;
  private lineVbo: WebGLBuffer;
  private bufferCapacityFloats = 0;
  private lineBufferCapacityFloats = 0;

  private uBgRes: WebGLUniformLocation | null;
  private uBgColor: WebGLUniformLocation | null;
  private uMistInner: WebGLUniformLocation | null;
  private uMistMid: WebGLUniformLocation | null;
  private uMistScale: WebGLUniformLocation | null;
  private uShockColor: WebGLUniformLocation | null;
  private uShockwaves: WebGLUniformLocation | null;

  private uPtRes: WebGLUniformLocation | null;
  private uPtDpr: WebGLUniformLocation | null;
  private uPtTrailMode: WebGLUniformLocation | null;
  private uLineRes: WebGLUniformLocation | null;

  private uDecayPrevTex: WebGLUniformLocation | null;
  private uDecayFactor: WebGLUniformLocation | null;

  private uExtractSceneTex: WebGLUniformLocation | null;
  private uExtractTrailTex: WebGLUniformLocation | null;
  private uExtractIsDark: WebGLUniformLocation | null;

  private uBlurSrcTex: WebGLUniformLocation | null;
  private uBlurTexelStep: WebGLUniformLocation | null;

  private uCompSceneTex: WebGLUniformLocation | null;
  private uCompTrailTex: WebGLUniformLocation | null;
  private uCompBlurTex: WebGLUniformLocation | null;
  private uCompIsDark: WebGLUniformLocation | null;

  private sceneTarget: RenderTarget | null = null;
  private trailA: RenderTarget | null = null;
  private trailB: RenderTarget | null = null;
  private blurA: RenderTarget | null = null;
  private blurB: RenderTarget | null = null;
  private targetW = 0;
  private targetH = 0;
  private trailIndex = 0;
  private prevBloomEnabled = false;
  private lastPalette: PaletteMode | null = null;

  private shockwaveVec = new Float32Array(16);

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      throw new Error('WebGL2 unavailable');
    }
    this.gl = gl;

    this.bgProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_BG);
    this.ptProgram = createProgram(gl, VERTEX_SHADER_PARTICLES, FRAGMENT_SHADER_PARTICLES);
    this.lineProgram = createProgram(gl, VERTEX_SHADER_LINES, FRAGMENT_SHADER_LINES);
    this.decayProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_DECAY);
    this.extractProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_EXTRACT);
    this.blurProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_BLUR);
    this.compositeProgram = createProgram(gl, VERTEX_SHADER_BG, FRAGMENT_SHADER_COMPOSITE);

    this.uBgRes = gl.getUniformLocation(this.bgProgram, 'u_resolution');
    this.uBgColor = gl.getUniformLocation(this.bgProgram, 'u_bgColor');
    this.uMistInner = gl.getUniformLocation(this.bgProgram, 'u_mistInner');
    this.uMistMid = gl.getUniformLocation(this.bgProgram, 'u_mistMid');
    this.uMistScale = gl.getUniformLocation(this.bgProgram, 'u_mistScale');
    this.uShockColor = gl.getUniformLocation(this.bgProgram, 'u_shockColor');
    this.uShockwaves = gl.getUniformLocation(this.bgProgram, 'u_shockwaves');

    this.uPtRes = gl.getUniformLocation(this.ptProgram, 'u_resolution');
    this.uPtDpr = gl.getUniformLocation(this.ptProgram, 'u_dpr');
    this.uPtTrailMode = gl.getUniformLocation(this.ptProgram, 'u_trailMode');
    this.uLineRes = gl.getUniformLocation(this.lineProgram, 'u_resolution');

    this.uDecayPrevTex = gl.getUniformLocation(this.decayProgram, 'u_prevTex');
    this.uDecayFactor = gl.getUniformLocation(this.decayProgram, 'u_decay');

    this.uExtractSceneTex = gl.getUniformLocation(this.extractProgram, 'u_sceneTex');
    this.uExtractTrailTex = gl.getUniformLocation(this.extractProgram, 'u_trailTex');
    this.uExtractIsDark = gl.getUniformLocation(this.extractProgram, 'u_isDark');

    this.uBlurSrcTex = gl.getUniformLocation(this.blurProgram, 'u_srcTex');
    this.uBlurTexelStep = gl.getUniformLocation(this.blurProgram, 'u_texelStep');

    this.uCompSceneTex = gl.getUniformLocation(this.compositeProgram, 'u_sceneTex');
    this.uCompTrailTex = gl.getUniformLocation(this.compositeProgram, 'u_trailTex');
    this.uCompBlurTex = gl.getUniformLocation(this.compositeProgram, 'u_blurTex');
    this.uCompIsDark = gl.getUniformLocation(this.compositeProgram, 'u_isDark');

    // Fullscreen quad VAO
    const bgVao = gl.createVertexArray();
    const bgVbo = gl.createBuffer();
    if (!bgVao || !bgVbo) throw new Error('Unable to create WebGL2 background buffers');
    this.bgVao = bgVao;
    this.bgVbo = bgVbo;
    gl.bindVertexArray(bgVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, bgVbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Interleaved particle VAO: pos(2), color(4), size(1), motion(1)
    const ptVao = gl.createVertexArray();
    const ptVbo = gl.createBuffer();
    if (!ptVao || !ptVbo) throw new Error('Unable to create WebGL2 particle buffers');
    this.ptVao = ptVao;
    this.ptVbo = ptVbo;

    const stride = FLOATS_PER_VERTEX * 4;
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

    // Interleaved constellation wireframe VAO: pos(2), color(4)
    const lineVao = gl.createVertexArray();
    const lineVbo = gl.createBuffer();
    if (!lineVao || !lineVbo) throw new Error('Unable to create WebGL2 constellation buffers');
    this.lineVao = lineVao;
    this.lineVbo = lineVbo;

    const lineStride = 6 * 4;
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, lineStride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, lineStride, 8);
    gl.bindVertexArray(null);
  }

  private ensureTargets(pw: number, ph: number): void {
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

  private clearTrails(): void {
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

  private releaseTargets(): void {
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

  private drawBackground(
    width: number,
    height: number,
    palette: PaletteMode,
    shockwaves: ShockwaveUniform[]
  ): void {
    const gl = this.gl;
    const meta = PALETTE_THEMES[palette];
    const bg = hexToVec3(meta.bgHex);

    gl.disable(gl.BLEND);
    gl.useProgram(this.bgProgram);
    gl.bindVertexArray(this.bgVao);

    gl.uniform2f(this.uBgRes, width, height);
    gl.uniform3f(this.uBgColor, bg[0], bg[1], bg[2]);

    if (palette === 'aurora') {
      gl.uniform3f(this.uMistInner, 0.23, 0.51, 0.96);
      gl.uniform3f(this.uMistMid, 0.54, 0.36, 0.96);
      gl.uniform1f(this.uMistScale, 0.065);
      gl.uniform3f(this.uShockColor, 0.40, 0.91, 0.98);
    } else if (palette === 'sunbeam') {
      gl.uniform3f(this.uMistInner, 0.85, 0.47, 0.02);
      gl.uniform3f(this.uMistMid, 0.70, 0.32, 0.04);
      gl.uniform1f(this.uMistScale, 0.06);
      gl.uniform3f(this.uShockColor, 0.98, 0.82, 0.30);
    } else if (palette === 'moonlit') {
      gl.uniform3f(this.uMistInner, 0.58, 0.64, 0.72);
      gl.uniform3f(this.uMistMid, 0.28, 0.33, 0.41);
      gl.uniform1f(this.uMistScale, 0.055);
      gl.uniform3f(this.uShockColor, 0.80, 0.84, 0.90);
    } else {
      gl.uniform3f(this.uMistInner, -0.02, -0.025, 0.01);
      gl.uniform3f(this.uMistMid, -0.01, -0.01, 0.0);
      gl.uniform1f(this.uMistScale, 0.5);
      gl.uniform3f(this.uShockColor, 0.26, 0.22, 0.79);
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

  private uploadParticles(vertexData: Float32Array, particleCount: number): void {
    if (particleCount <= 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ptVbo);
    const neededFloats = particleCount * FLOATS_PER_VERTEX;
    if (neededFloats > this.bufferCapacityFloats) {
      this.bufferCapacityFloats = Math.ceil(neededFloats * 1.25);
      gl.bufferData(gl.ARRAY_BUFFER, this.bufferCapacityFloats * 4, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexData.subarray(0, neededFloats));
  }

  private drawParticles(
    width: number,
    height: number,
    dpr: number,
    particleCount: number,
    isDark: boolean,
    trailMode: boolean
  ): void {
    if (particleCount <= 0) return;
    const gl = this.gl;
    gl.enable(gl.BLEND);
    if (trailMode || isDark) {
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.useProgram(this.ptProgram);
    gl.bindVertexArray(this.ptVao);
    gl.uniform2f(this.uPtRes, width, height);
    gl.uniform1f(this.uPtDpr, dpr);
    gl.uniform1f(this.uPtTrailMode, trailMode ? 1.0 : 0.0);
    gl.drawArrays(gl.POINTS, 0, particleCount);
    gl.bindVertexArray(null);
  }

  private uploadLines(lineData: Float32Array, lineVertexCount: number): void {
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

  private drawLines(
    width: number,
    height: number,
    lineVertexCount: number,
    isDark: boolean
  ): void {
    if (lineVertexCount <= 0) return;
    const gl = this.gl;
    gl.enable(gl.BLEND);
    if (isDark) {
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.useProgram(this.lineProgram);
    gl.bindVertexArray(this.lineVao);
    gl.uniform2f(this.uLineRes, width, height);
    gl.drawArrays(gl.LINES, 0, lineVertexCount);
    gl.bindVertexArray(null);
  }

  render(
    width: number,
    height: number,
    dpr: number,
    palette: PaletteMode,
    shockwaves: ShockwaveUniform[],
    vertexData: Float32Array,
    particleCount: number,
    enableBloom = true,
    lineVertexData?: Float32Array,
    lineVertexCount = 0
  ): void {
    const gl = this.gl;
    const meta = PALETTE_THEMES[palette];
    const pw = Math.max(2, Math.floor(width * dpr));
    const ph = Math.max(2, Math.floor(height * dpr));

    this.uploadParticles(vertexData, particleCount);
    if (lineVertexData && lineVertexCount > 0) {
      this.uploadLines(lineVertexData, lineVertexCount);
    }

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
    if (!this.prevBloomEnabled || (this.lastPalette !== null && this.lastPalette !== palette)) {
      this.clearTrails();
    }
    this.prevBloomEnabled = true;
    this.lastPalette = palette;

    const scene = this.sceneTarget!;
    const srcTrail = this.trailIndex === 0 ? this.trailA! : this.trailB!;
    const dstTrail = this.trailIndex === 0 ? this.trailB! : this.trailA!;
    const blurA = this.blurA!;
    const blurB = this.blurB!;

    // Pass 1: Full-resolution crisp background + constellation web + particle sprites into sceneFbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.width, scene.height);
    this.drawBackground(width, height, palette, shockwaves);
    this.drawLines(width, height, lineVertexCount, meta.isDark);
    this.drawParticles(width, height, dpr, particleCount, meta.isDark, false);

    // Pass 2: Half-resolution persistence light-trail accumulation & exponential decay
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstTrail.fbo);
    gl.viewport(0, 0, dstTrail.width, dstTrail.height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.decayProgram);
    gl.bindVertexArray(this.bgVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTrail.tex);
    gl.uniform1i(this.uDecayPrevTex, 0);
    gl.uniform1f(this.uDecayFactor, 0.875);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Deposit soft motion-weighted glow into trail FBO (uses half-res dpr scaling for matching radius)
    this.drawParticles(width, height, dpr * 0.5, particleCount, meta.isDark, true);
    this.trailIndex = 1 - this.trailIndex;

    // Pass 3: Extract highlights + active trails into quarter-res blurA, then dual-radius Gaussian blur
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
    gl.uniform1f(this.uExtractIsDark, meta.isDark ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const runBlurPass = (
      src: RenderTarget,
      dst: RenderTarget,
      stepX: number,
      stepY: number
    ) => {
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

    // Pass 4: Composite crisp scene + luminous trails + soft bloom to backbuffer
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
    gl.uniform1f(this.uCompIsDark, meta.isDark ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  dispose(): void {
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
}
