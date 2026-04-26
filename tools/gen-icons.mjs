#!/usr/bin/env node
// Generates the PWA icons in public/icons/ as solid-color PNGs with a
// simple sparkline glyph. Pure Node, no native deps. Re-run via `npm run icons`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [0x0b, 0x12, 0x20, 0xff];
const LINE = [0xf5, 0xb0, 0x4a, 0xff];
const PAST = [0x6f, 0x7d, 0x99, 0xff];

const points = [
  [0.10, 0.66], [0.22, 0.58], [0.34, 0.62], [0.45, 0.50],
  [0.55, 0.55], [0.66, 0.40], [0.78, 0.45], [0.90, 0.30]
];
const splitIdx = 4; // first 4 points are "past" (gray-blue), rest "future" (orange)

function generate(size, opts = {}) {
  const { padding = 0 } = opts;
  const inner = size - padding * 2;
  const pixels = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    pixels[i * 4 + 0] = BG[0];
    pixels[i * 4 + 1] = BG[1];
    pixels[i * 4 + 2] = BG[2];
    pixels[i * 4 + 3] = BG[3];
  }

  const px = points.map(([x, y]) => [padding + x * inner, padding + y * inner]);
  const thickness = Math.max(2, Math.round(size / 32));

  for (let i = 0; i < px.length - 1; i++) {
    const color = i < splitIdx - 1 ? PAST : LINE;
    drawLine(pixels, size, px[i][0], px[i][1], px[i + 1][0], px[i + 1][1], thickness, color);
  }

  // accent dot at the split point ("now")
  const [nx, ny] = px[splitIdx - 1];
  drawDisc(pixels, size, nx, ny, Math.max(3, Math.round(size / 16)), LINE);

  return encodePng(pixels, size, size);
}

function drawLine(buf, w, x0, y0, x1, y1, thick, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist * 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    drawDisc(buf, w, x0 + dx * t, y0 + dy * t, thick / 2, color);
  }
}

function drawDisc(buf, w, cx, cy, r, color) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(w - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        const idx = (y * w + x) * 4;
        buf[idx + 0] = color[0];
        buf[idx + 1] = color[1];
        buf[idx + 2] = color[2];
        buf[idx + 3] = color[3];
      }
    }
  }
}

// --- minimal PNG encoder (RGBA, 8-bit, no filtering) ---

function encodePng(rgba, width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // raw with filter byte 0 per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idatData = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const targets = [
  { name: 'icon-192.png', size: 192, padding: 16 },
  { name: 'icon-512.png', size: 512, padding: 48 },
  // maskable: extra padding so the glyph stays inside the safe zone.
  { name: 'icon-512-maskable.png', size: 512, padding: 96 }
];

for (const t of targets) {
  const buf = generate(t.size, { padding: t.padding });
  writeFileSync(resolve(outDir, t.name), buf);
  console.log(`wrote ${t.name} (${buf.length} bytes)`);
}
