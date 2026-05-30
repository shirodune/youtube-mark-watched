// Generates the extension icons (16/48/128) with no external dependencies.
// Draws a red rounded square with a white "eye" (matching the in-page button),
// rasterized with 4x supersampling for smooth edges, and encodes PNG via zlib.
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SS = 4; // supersample factor for anti-aliasing

function renderIcon(size) {
  const W = size * SS;
  const H = size * SS;
  const radius = 0.2 * W;
  const cx = W / 2;
  const cy = H / 2;
  const scleraRx = 0.32 * W;
  const scleraRy = 0.19 * W;
  const pupilR = 0.13 * W;

  const inRoundedRect = (x, y) => {
    const nx = Math.min(Math.max(x, radius), W - radius);
    const ny = Math.min(Math.max(y, radius), H - radius);
    const dx = x - nx;
    const dy = y - ny;
    return dx * dx + dy * dy <= radius * radius;
  };
  const inEllipse = (x, y, rx, ry) => {
    const a = (x - cx) / rx;
    const b = (y - cy) / ry;
    return a * a + b * b <= 1;
  };

  const big = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let col = [0, 0, 0, 0];
      const px = x + 0.5;
      const py = y + 0.5;
      if (inRoundedRect(px, py)) {
        col = [255, 0, 0, 255];
        if (inEllipse(px, py, scleraRx, scleraRy)) {
          col = [255, 255, 255, 255];
          const pdx = px - cx;
          const pdy = py - cy;
          if (pdx * pdx + pdy * pdy <= pupilR * pupilR) col = [255, 0, 0, 255];
        }
      }
      const i = (y * W + x) * 4;
      big[i] = col[0];
      big[i + 1] = col[1];
      big[i + 2] = col[2];
      big[i + 3] = col[3];
    }
  }

  // Downsample SS x SS, averaging in premultiplied alpha.
  const out = new Uint8ClampedArray(size * size * 4);
  const n = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          const al = big[i + 3] / 255;
          r += big[i] * al;
          g += big[i + 1] * al;
          b += big[i + 2] * al;
          a += big[i + 3];
        }
      }
      const aAvg = a / n;
      const o = (y * size + x) * 4;
      if (aAvg > 0) {
        const alA = aAvg / 255;
        out[o] = Math.round(r / n / alA);
        out[o + 1] = Math.round(g / n / alA);
        out[o + 2] = Math.round(b / n / alA);
        out[o + 3] = Math.round(aAvg);
      }
    }
  }
  return { width: size, height: size, data: out };
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng({ width, height, data }) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + stride)] = 0; // filter: none
    for (let x = 0; x < stride; x++) raw[y * (1 + stride) + 1 + x] = data[y * stride + x];
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('icons', { recursive: true });
for (const s of [16, 48, 128]) {
  const png = encodePng(renderIcon(s));
  writeFileSync(`icons/icon${s}.png`, png);
  console.log(`icons/icon${s}.png (${png.length} bytes)`);
}
console.log('Icons generated.');
