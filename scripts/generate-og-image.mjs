/**
 * Generate a placeholder OG image (1200x630) as a minimal PNG.
 * Black background with "elastic mindfulness" in gold-ish text.
 *
 * Uses raw PNG encoding with Node's zlib — no external dependencies.
 * Run: node scripts/generate-og-image.mjs
 */

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const WIDTH = 1200;
const HEIGHT = 630;

// ── Simple bitmap font for text rendering ─────────────────────────────
// 5x7 pixel font glyphs for lowercase + space
const GLYPHS = {
  e: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 0],
    [1, 1, 1],
  ],
  l: [
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 1],
  ],
  a: [
    [0, 1, 0],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
  s: [
    [0, 1, 1],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
  ],
  t: [
    [1, 1, 1],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
  i: [
    [1],
    [0],
    [1],
    [1],
    [1],
  ],
  c: [
    [0, 1, 1],
    [1, 0, 0],
    [1, 0, 0],
    [1, 0, 0],
    [0, 1, 1],
  ],
  m: [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  n: [
    [1, 0, 0, 1],
    [1, 1, 0, 1],
    [1, 0, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
  ],
  d: [
    [1, 1, 0],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 0],
  ],
  f: [
    [0, 1, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 0],
    [1, 0, 0],
  ],
  u: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [0, 1, 0],
  ],
  " ": [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
};

function renderText(pixels, text, startX, startY, scale, r, g, b, alpha) {
  let cursorX = startX;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cursorX += 3 * scale;
      continue;
    }
    for (let gy = 0; gy < glyph.length; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (!glyph[gy][gx]) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = cursorX + gx * scale + sx;
            const py = startY + gy * scale + sy;
            if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
              const idx = (py * WIDTH + px) * 4;
              // Alpha blend
              const srcA = alpha;
              const dstA = 1 - srcA;
              pixels[idx] = Math.round(r * srcA + pixels[idx] * dstA);
              pixels[idx + 1] = Math.round(g * srcA + pixels[idx + 1] * dstA);
              pixels[idx + 2] = Math.round(b * srcA + pixels[idx + 2] * dstA);
              pixels[idx + 3] = 255;
            }
          }
        }
      }
    }
    cursorX += (glyph[0].length + 1) * scale;
  }
}

// ── Generate pixel data ───────────────────────────────────────────────
const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

// Fill with black
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 0;
  pixels[i + 1] = 0;
  pixels[i + 2] = 0;
  pixels[i + 3] = 255;
}

// Add subtle radial gradient (warm dark center glow)
const cx = WIDTH / 2;
const cy = HEIGHT / 2;
const maxR = Math.sqrt(cx * cx + cy * cy);
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) / maxR;
    const glow = Math.max(0, 1 - dist * 1.5) * 0.08;
    const idx = (y * WIDTH + x) * 4;
    pixels[idx] = Math.min(255, Math.round(212 * glow));     // warm gold R
    pixels[idx + 1] = Math.min(255, Math.round(165 * glow)); // warm gold G
    pixels[idx + 2] = Math.min(255, Math.round(116 * glow)); // warm gold B
  }
}

// Draw "elastic mindfulness" centered, scale=4
const text = "elastic mindfulness";
// Calculate text width
let textWidth = 0;
for (const ch of text) {
  const glyph = GLYPHS[ch];
  textWidth += glyph ? (glyph[0].length + 1) * 4 : 3 * 4;
}
textWidth -= 4; // Remove trailing gap

const textX = Math.floor((WIDTH - textWidth) / 2);
const textY = Math.floor((HEIGHT - 5 * 4) / 2);
renderText(pixels, text, textX, textY, 4, 212, 165, 116, 0.7);

// ── Encode PNG ────────────────────────────────────────────────────────
function crc32(buf) {
  let c = 0xffffffff;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[n] = v;
  }
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type (RGB)
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Raw scanlines (filter byte 0 + RGB per pixel per row)
const rawData = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
for (let y = 0; y < HEIGHT; y++) {
  const rowOffset = y * (1 + WIDTH * 3);
  rawData[rowOffset] = 0; // filter: none
  for (let x = 0; x < WIDTH; x++) {
    const srcIdx = (y * WIDTH + x) * 4;
    const dstIdx = rowOffset + 1 + x * 3;
    rawData[dstIdx] = pixels[srcIdx];
    rawData[dstIdx + 1] = pixels[srcIdx + 1];
    rawData[dstIdx + 2] = pixels[srcIdx + 2];
  }
}

const compressed = deflateSync(rawData, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  pngChunk("IHDR", ihdr),
  pngChunk("IDAT", compressed),
  pngChunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(
  new URL("../public/og-image.png", import.meta.url),
  png
);

console.log(`Generated public/og-image.png (${png.length} bytes)`);
