// Generates a 1024x1024 PNG app icon with no external dependencies.
// Rounded-rect indigo/violet gradient + white request/response arrows (⇄).
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const S = 1024;
const radius = 200;

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
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function insideRoundedRect(x, y) {
  const cx = Math.min(Math.max(x, radius), S - radius);
  const cy = Math.min(Math.max(y, radius), S - radius);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function inGlyph(x, y) {
  // Arrow pointing right (top)
  const cy1 = 430, h = 34;
  if (x >= 300 && x <= 660 && Math.abs(y - cy1) <= h) return true;
  if (x >= 640 && x <= 772) {
    const half = 96 * (772 - x) / (772 - 640);
    if (Math.abs(y - cy1) <= half) return true;
  }
  // Arrow pointing left (bottom)
  const cy2 = 594;
  if (x >= 364 && x <= 724 && Math.abs(y - cy2) <= h) return true;
  if (x >= 252 && x <= 384) {
    const half = 96 * (x - 252) / (384 - 252);
    if (Math.abs(y - cy2) <= half) return true;
  }
  return false;
}

// Build raw RGBA scanlines with filter byte 0 per row.
const raw = Buffer.alloc(S * (1 + S * 4));
let p = 0;
for (let y = 0; y < S; y++) {
  raw[p++] = 0; // filter: none
  const t = y / S;
  const r = Math.round(79 + (124 - 79) * t);
  const g = Math.round(70 + (58 - 70) * t);
  const b = Math.round(229 + (237 - 229) * t);
  for (let x = 0; x < S; x++) {
    if (!insideRoundedRect(x, y)) {
      raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = 0;
    } else if (inGlyph(x, y)) {
      raw[p++] = 245; raw[p++] = 246; raw[p++] = 255; raw[p++] = 255;
    } else {
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = 255;
    }
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = fileURLToPath(new URL('./icon.png', import.meta.url));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log('Wrote', out, `(${png.length} bytes)`);
