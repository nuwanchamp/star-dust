// Classic 3D Ken Perlin gradient noise + bilinear-cached 2D curl-wind vector field

const PERM_BASE = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69,
  142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
  203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
  220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76,
  132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173,
  186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206,
  59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163,
  70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224,
  232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179,
  162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84,
  204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72,
  243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];

const PERM = new Uint8Array(512);
for (let i = 0; i < 512; i++) {
  PERM[i] = PERM_BASE[i & 255];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad3(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function perlin3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const zf = z - Math.floor(z);

  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);

  const A = PERM[X] + Y;
  const AA = PERM[A] + Z;
  const AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y;
  const BA = PERM[B] + Z;
  const BB = PERM[B + 1] + Z;

  return lerp(
    lerp(
      lerp(grad3(PERM[AA], xf, yf, zf), grad3(PERM[BA], xf - 1, yf, zf), u),
      lerp(grad3(PERM[AB], xf, yf - 1, zf), grad3(PERM[BB], xf - 1, yf - 1, zf), u),
      v
    ),
    lerp(
      lerp(grad3(PERM[AA + 1], xf, yf, zf - 1), grad3(PERM[BA + 1], xf - 1, yf, zf - 1), u),
      lerp(
        grad3(PERM[AB + 1], xf, yf - 1, zf - 1),
        grad3(PERM[BB + 1], xf - 1, yf - 1, zf - 1),
        u
      ),
      v
    ),
    w
  );
}

function fbmPerlin(x: number, y: number, z: number): number {
  return perlin3(x, y, z) * 0.68 + perlin3(x * 2.08 + 13.7, y * 2.08 - 7.3, z * 1.45) * 0.32;
}

/**
 * Coarse spatial flow grid (zero per-frame heap allocations) storing
 * divergence-free curl-Perlin wind + slow prevailing gust modulation.
 */
export class PerlinWindField {
  readonly cols: number;
  readonly rows: number;
  readonly vxGrid: Float32Array;
  readonly vyGrid: Float32Array;
  private width = 1;
  private height = 1;

  constructor(cols = 52, rows = 34) {
    this.cols = cols;
    this.rows = rows;
    this.vxGrid = new Float32Array(cols * rows);
    this.vyGrid = new Float32Array(cols * rows);
  }

  update(width: number, height: number, time: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    const { cols, rows, vxGrid, vyGrid } = this;
    const minDim = Math.max(240, Math.min(this.width, this.height));
    // Broad sweeping wind macro scale (~240..380px eddies)
    const freq = 2.65 / minDim;
    const tSlow = time * 0.14;
    const eps = 0.045;
    const invTwoEps = 1 / (2 * eps);

    // Slowly shifting prevailing breeze direction across canvas
    const gustAngle = perlin3(tSlow * 0.42, 4.1, 9.3) * 1.1;
    const gustStrength = 0.34 + 0.24 * perlin3(7.2, tSlow * 0.55, 2.8);
    const baseWindX = Math.cos(gustAngle) * gustStrength;
    const baseWindY = Math.sin(gustAngle) * gustStrength * 0.52;

    const stepX = this.width / (cols - 1);
    const stepY = this.height / (rows - 1);

    for (let gy = 0; gy < rows; gy++) {
      const py = gy * stepY;
      const ny = py * freq;
      const rowOffset = gy * cols;
      for (let gx = 0; gx < cols; gx++) {
        const px = gx * stepX;
        const nx = px * freq;

        // 2D curl of 3D Perlin potential creates natural wind ribbons and swirling eddies
        const dNdy =
          (fbmPerlin(nx, ny + eps, tSlow) - fbmPerlin(nx, ny - eps, tSlow)) * invTwoEps;
        const dNdx =
          (fbmPerlin(nx + eps, ny, tSlow) - fbmPerlin(nx - eps, ny, tSlow)) * invTwoEps;

        const idx = rowOffset + gx;
        vxGrid[idx] = dNdy * 0.85 + baseWindX;
        vyGrid[idx] = -dNdx * 0.85 + baseWindY;
      }
    }
  }

  sampleX(px: number, py: number): number {
    const gx = Math.max(0, Math.min(this.cols - 1.001, (px / this.width) * (this.cols - 1)));
    const gy = Math.max(0, Math.min(this.rows - 1.001, (py / this.height) * (this.rows - 1)));
    const x0 = gx | 0;
    const y0 = gy | 0;
    const fx = gx - x0;
    const fy = gy - y0;
    const i00 = y0 * this.cols + x0;
    const i10 = i00 + 1;
    const i01 = i00 + this.cols;
    const i11 = i01 + 1;
    const a = this.vxGrid[i00] + fx * (this.vxGrid[i10] - this.vxGrid[i00]);
    const b = this.vxGrid[i01] + fx * (this.vxGrid[i11] - this.vxGrid[i01]);
    return a + fy * (b - a);
  }

  sampleY(px: number, py: number): number {
    const gx = Math.max(0, Math.min(this.cols - 1.001, (px / this.width) * (this.cols - 1)));
    const gy = Math.max(0, Math.min(this.rows - 1.001, (py / this.height) * (this.rows - 1)));
    const x0 = gx | 0;
    const y0 = gy | 0;
    const fx = gx - x0;
    const fy = gy - y0;
    const i00 = y0 * this.cols + x0;
    const i10 = i00 + 1;
    const i01 = i00 + this.cols;
    const i11 = i01 + 1;
    const a = this.vyGrid[i00] + fx * (this.vyGrid[i10] - this.vyGrid[i00]);
    const b = this.vyGrid[i01] + fx * (this.vyGrid[i11] - this.vyGrid[i01]);
    return a + fy * (b - a);
  }
}
