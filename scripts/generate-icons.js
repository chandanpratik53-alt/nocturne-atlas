// scripts/generate-icons.js
// Generates valid PNG icons for Nocturne Atlas PWA using pure Node.js (zlib)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.resolve(__dirname, '../assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// CRC32 table calculation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

/**
 * Creates a raw PNG buffer with Nocturne Atlas branding
 * Palette:
 * Ink Plum: #171629 -> (23, 22, 41)
 * Surface elevated: #22203A -> (34, 32, 58)
 * Tidal Mint: #8ADBD0 -> (138, 219, 208)
 * Orbit Lilac: #AAA0FF -> (170, 160, 255)
 * Afterglow: #FF947F -> (255, 148, 127)
 */
function generateIconPNG(size, isMaskable = false) {
  const width = size;
  const height = size;
  const bytesPerRow = 1 + width * 4; // 1 filter byte (0) + 4 bytes per RGBA pixel
  const rawData = Buffer.alloc(height * bytesPerRow);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.45 : 0.40);
  const cornerRadius = isMaskable ? 0 : width * 0.22;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte 0 (None)

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background: Ink Plum #171629
      let r = 23, g = 22, b = 41, a = 255;

      // Subtle radial gradient center glow
      const glowFactor = Math.max(0, 1 - dist / (width * 0.7));
      r = Math.min(255, Math.floor(r + 15 * glowFactor));
      g = Math.min(255, Math.floor(g + 14 * glowFactor));
      b = Math.min(255, Math.floor(b + 25 * glowFactor));

      // Atlas Orbit Ring (ellipse)
      // transformed coordinates rotated by -28 deg
      const rad = -28 * (Math.PI / 180);
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      const aAxis = width * 0.38;
      const bAxis = width * 0.15;
      const ellipseVal = (rx * rx) / (aAxis * aAxis) + (ry * ry) / (bAxis * bAxis);
      if (Math.abs(ellipseVal - 1.0) < 0.08) {
        // Orbit Lilac stroke
        r = 170; g = 160; b = 255;
      }

      // Crescent Moon check (outer circle and cutout circle)
      const moonOuterDx = x - (cx + width * 0.04);
      const moonOuterDy = y - (cy + width * 0.04);
      const moonDist = Math.sqrt(moonOuterDx * moonOuterDx + moonOuterDy * moonOuterDy);
      const moonCutDx = x - (cx + width * 0.16);
      const moonCutDy = y - (cy - width * 0.06);
      const moonCutDist = Math.sqrt(moonCutDx * moonCutDx + moonCutDy * moonCutDy);

      const moonRadius = width * 0.26;
      const cutRadius = width * 0.22;

      if (moonDist <= moonRadius && moonCutDist > cutRadius) {
        // Tidal Mint gradient
        const t = (x - (cx - moonRadius)) / (moonRadius * 2);
        r = Math.floor(138 * (1 - t) + 86 * t);
        g = Math.floor(219 * (1 - t) + 184 * t);
        b = Math.floor(208 * (1 - t) + 171 * t);
      }

      // Afterglow point / Polaris (accent)
      const starDx = x - (cx + width * 0.18);
      const starDy = y - (cy - width * 0.15);
      const starDist = Math.sqrt(starDx * starDx + starDy * starDy);
      if (starDist <= width * 0.035) {
        r = 255; g = 148; b = 127; // Afterglow
      } else if (starDist <= width * 0.07) {
        // Star halo
        const halo = (1 - (starDist / (width * 0.07))) * 0.4;
        r = Math.min(255, Math.floor(r * (1 - halo) + 255 * halo));
        g = Math.min(255, Math.floor(g * (1 - halo) + 148 * halo));
        b = Math.min(255, Math.floor(b * (1 - halo) + 127 * halo));
      }

      // If not maskable, handle rounded corners with antialiasing
      if (!isMaskable) {
        const cornerX = Math.abs(x - cx) - (cx - cornerRadius);
        const cornerY = Math.abs(y - cy) - (cy - cornerRadius);
        if (cornerX > 0 && cornerY > 0) {
          const cornerDist = Math.sqrt(cornerX * cornerX + cornerY * cornerY);
          if (cornerDist > cornerRadius) {
            a = 0;
          }
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  // Compress IDAT
  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate files
const icon192 = generateIconPNG(192, false);
fs.writeFileSync(path.join(assetsDir, 'icon-192.png'), icon192);

const icon512 = generateIconPNG(512, false);
fs.writeFileSync(path.join(assetsDir, 'icon-512.png'), icon512);

const iconMaskable = generateIconPNG(512, true);
fs.writeFileSync(path.join(assetsDir, 'icon-maskable.png'), iconMaskable);

console.log('✓ Generated icon-192.png (192x192)');
console.log('✓ Generated icon-512.png (512x512)');
console.log('✓ Generated icon-maskable.png (512x512 maskable)');
