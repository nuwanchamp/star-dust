export interface ParticlePool {
  capacity: number;
  count: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  hasTarget: Uint8Array;
  size: Float32Array;
  baseAlpha: Float32Array;
  phase: Float32Array;
  wanderSpeed: Float32Array;
  energy: Float32Array;
  waveLayer: Int8Array; // -1 = free cosmic dust, 0..2 = ribbon layers
  waveU: Float32Array;
  waveV: Float32Array;
  depth: Float32Array;
  depthPlane: Uint8Array; // 0 = far mist, 1 = mid core
  mass: Float32Array;
  colorSeed: Float32Array;
  isFringe: Uint8Array;
  regionId: Int16Array; // -1 = default particle, >= 0 = interactive layout region index
  gravityBreakUntil: Float64Array;
  windReleaseAt: Float64Array;
  /** performance.now() time a targeted particle leaves the wave for its target; 0 = straight away. */
  joinAt: Float64Array;
  /** formFlowMs: performance.now() time a particle riding the Perlin wind starts condensing into its place. */
  condenseAt: Float64Array;
  /** formFlowMs: time a particle lets go of the old shape and starts riding the wind. */
  releaseAt: Float64Array;
  /** formFlowMs: 1 = part of the old shape the new one doesn't use; it dissolves into ambient dust. */
  flowPhantom: Uint8Array;
}

export function computeWavePoint(
  u: number,
  v: number,
  layer: number,
  phaseOffset: number,
  time: number,
  width: number,
  height: number
): { x: number; y: number } {
  const phase = u * Math.PI * 2;
  const layerOffset = (layer - 1) * 0.052;

  const crestY =
    height * (0.48 + layerOffset) +
    Math.sin(phase + time * 0.26 + layer * 1.75) * (height * 0.092) +
    Math.cos(phase * 2 - time * 0.19 + v * 1.45) * (height * 0.048) +
    Math.sin(phase * 4 + time * 0.31 + layer) * (height * 0.019);

  const ribbonThickness =
    height * (0.09 + Math.sin(phase * 2 + time * 0.18 + layer) * 0.036);

  const rawX = (u * width + Math.sin(time * 0.22 + phaseOffset) * 10) % width;
  return {
    x: rawX < 0 ? rawX + width : rawX,
    y: crestY + v * ribbonThickness,
  };
}

export function createParticlePool(initialCapacity: number): ParticlePool {
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
    windReleaseAt: new Float64Array(cap),
    joinAt: new Float64Array(cap),
    condenseAt: new Float64Array(cap),
    releaseAt: new Float64Array(cap),
    flowPhantom: new Uint8Array(cap),
  };
}

function growPool(pool: ParticlePool, minCapacity: number): void {
  const newCap = Math.max(minCapacity, Math.ceil(pool.capacity * 1.4));

  const growF32 = (old: Float32Array) => {
    const next = new Float32Array(newCap);
    next.set(old);
    return next;
  };
  const growF64 = (old: Float64Array) => {
    const next = new Float64Array(newCap);
    next.set(old);
    return next;
  };
  const growU8 = (old: Uint8Array) => {
    const next = new Uint8Array(newCap);
    next.set(old);
    return next;
  };
  const growI8 = (old: Int8Array) => {
    const next = new Int8Array(newCap);
    next.set(old);
    return next;
  };
  const growI16 = (old: Int16Array) => {
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
  pool.joinAt = growF64(pool.joinAt);
  pool.condenseAt = growF64(pool.condenseAt);
  pool.releaseAt = growF64(pool.releaseAt);
  pool.flowPhantom = growU8(pool.flowPhantom);
  pool.capacity = newCap;
}

export function resizeParticlePool(
  pool: ParticlePool,
  desiredCount: number,
  width: number,
  height: number
): void {
  if (desiredCount > pool.capacity) {
    growPool(pool, desiredCount + 2048);
  }

  for (let i = pool.count; i < desiredCount; i++) {
    const isRibbon = Math.random() < 0.82;
    const waveLayer = isRibbon ? Math.floor(Math.random() * 3) : -1;

    const rawV = Math.random() * 2 - 1;
    const waveV = Math.sign(rawV) * Math.pow(Math.abs(rawV), 1.65);
    const waveU = Math.random();
    const depth = Math.random();
    const phase = Math.random() * Math.PI * 2;
    const mass = 0.72 + Math.random() * 0.68;

    const depthPlane = !isRibbon && Math.random() < 0.35 ? 0 : Math.random() < 0.25 ? 0 : 1;
    const size =
      depthPlane === 0 ? 1.85 + Math.random() * 0.65 : 2.1 + Math.random() * 0.75;

    let px = Math.random() * width;
    let py = Math.random() * height;
    if (isRibbon) {
      const pt = computeWavePoint(waveU, waveV, waveLayer, phase, 0, width, height);
      px = pt.x + (Math.random() - 0.5) * 8;
      py = pt.y + (Math.random() - 0.5) * 8;
    }

    pool.x[i] = px;
    pool.y[i] = py;
    pool.vx[i] = (Math.random() - 0.5) * 0.35;
    pool.vy[i] = (Math.random() - 0.5) * 0.35;
    pool.tx[i] = 0;
    pool.ty[i] = 0;
    pool.hasTarget[i] = 0;
    pool.size[i] = size;
    pool.baseAlpha[i] = depthPlane === 0 ? 0.14 + Math.random() * 0.18 : 0.3 + Math.random() * 0.45;
    pool.phase[i] = phase;
    pool.wanderSpeed[i] = 0.4 + Math.random() * 0.85;
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
    pool.joinAt[i] = 0;
    pool.condenseAt[i] = 0;
    pool.releaseAt[i] = 0;
    pool.flowPhantom[i] = 0;
  }

  pool.count = desiredCount;
}
