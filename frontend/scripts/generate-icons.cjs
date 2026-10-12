// Generates placeholder PWA icons (blue square + white open-book glyph).
// Dependency-free: builds PNGs by hand with zlib + CRC32.
// Replace public/icon-*.png with real branding any time - just keep the
// filenames (or update vite.config.js manifest entries).
//
// Usage: node scripts/generate-icons.cjs

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BLUE = [37, 99, 235];   // #2563eb (tailwind primary)
const WHITE = [255, 255, 255];

// -- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, pixelAt) {
  // RGBA raw scanlines, each prefixed with filter byte 0 (None)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x / size, y / size);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// -- The glyph: open book, kept within the center ~55% so maskable
//    (full-bleed circle) crops don't clip it ---------------------------------

function inRect(nx, ny, x0, y0, x1, y1) {
  return nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
}

function pixel(nx, ny) {
  // pages
  const leftPage = inRect(nx, ny, 0.26, 0.30, 0.475, 0.60);
  const rightPage = inRect(nx, ny, 0.525, 0.30, 0.74, 0.60);
  const spine = inRect(nx, ny, 0.475, 0.26, 0.525, 0.64);
  const cover = inRect(nx, ny, 0.22, 0.60, 0.78, 0.66);
  const book = leftPage || rightPage || spine || cover;

  if (!book) return BLUE;

  // "text lines" carved out of the pages
  const textBand = (ny > 0.38 && ny < 0.42) || (ny > 0.46 && ny < 0.50);
  const leftText = textBand && inRect(nx, ny, 0.30, 0, 0.44, 1);
  const rightText = textBand && inRect(nx, ny, 0.56, 0, 0.70, 1);
  if (leftText || rightText) return BLUE;

  return WHITE;
}

const outDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['favicon.png', 64]]) {
  fs.writeFileSync(path.join(outDir, name), encodePNG(size, pixel));
  console.log(`Wrote public/${name} (${size}x${size})`);
}
