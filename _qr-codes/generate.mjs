// Usage: node generate.mjs <url> [--logo] [--name <nom>]
// Ex.    node generate.mjs "https://brocoquests.fr/app/?src=flyer" --logo

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(HERE, 'output');
const LOGO_PATH = path.join(HERE, '..', 'icon.png');
const PNG_WIDTH = 2048;
// Share of the QR surface covered by the logo and its white pad; level H tolerates ~30 % damage, 20 % is the cap
const LOGO_AREA_RATIO = 0.15;
const CORNER_RADIUS_RATIO = 0.2;

function parseArgs(argv) {
  const url = argv.find((arg) => !arg.startsWith('--'));
  if (!url) {
    console.error('Usage: node generate.mjs <url> [--logo] [--name <nom>]');
    process.exit(1);
  }
  const nameIndex = argv.indexOf('--name');
  const name = nameIndex !== -1 ? argv[nameIndex + 1] : new URL(url).searchParams.get('src') || 'qr';
  return { url, name, withLogo: argv.includes('--logo') };
}

async function roundCorners(logoBuffer, side) {
  const mask = Buffer.from(`<svg width="${side}" height="${side}"><rect width="${side}" height="${side}" rx="${side * CORNER_RADIUS_RATIO}" fill="#fff"/></svg>`);
  return sharp(logoBuffer)
    .resize(side, side)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function logoBox(size) {
  const side = Math.round(size * Math.sqrt(LOGO_AREA_RATIO));
  return { side, offset: Math.round((size - side) / 2), padding: Math.round(side * 0.08) };
}

async function buildSvg(url, logoSource) {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 4 });
  if (!logoSource)
    return svg;
  const logoBase64 = (await sharp(logoSource).resize(400).jpeg({ quality: 85 }).toBuffer()).toString('base64');
  const size = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  const { side, offset, padding } = logoBox(size);
  const logoSide = side - 2 * padding;
  const overlay =
    `<rect x="${offset}" y="${offset}" width="${side}" height="${side}" rx="${side * CORNER_RADIUS_RATIO}" fill="#fff"/>` +
    `<clipPath id="logo-clip"><rect x="${offset + padding}" y="${offset + padding}" width="${logoSide}" height="${logoSide}" rx="${logoSide * CORNER_RADIUS_RATIO}"/></clipPath>` +
    `<image x="${offset + padding}" y="${offset + padding}" width="${logoSide}" height="${logoSide}" clip-path="url(#logo-clip)" href="data:image/jpeg;base64,${logoBase64}"/>`;
  return svg.replace('</svg>', `${overlay}</svg>`);
}

async function buildPng(url, logoBuffer) {
  const qr = await QRCode.toBuffer(url, { type: 'png', errorCorrectionLevel: 'H', margin: 4, width: PNG_WIDTH });
  if (!logoBuffer)
    return qr;
  const size = (await sharp(qr).metadata()).width;
  const { side, offset, padding } = logoBox(size);
  const pad = Buffer.from(`<svg width="${side}" height="${side}"><rect width="${side}" height="${side}" rx="${side * CORNER_RADIUS_RATIO}" fill="#fff"/></svg>`);
  const logo = await roundCorners(logoBuffer, side - 2 * padding);
  return sharp(qr)
    .composite([
      { input: pad, top: offset, left: offset },
      { input: logo, top: offset + padding, left: offset + padding },
    ])
    .png()
    .toBuffer();
}

const { url, name, withLogo } = parseArgs(process.argv.slice(2));
const logoBuffer = withLogo ? await readFile(LOGO_PATH) : null;
const fileName = withLogo ? `${name}-logo` : name;

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(path.join(OUTPUT_DIR, `${fileName}.svg`), await buildSvg(url, logoBuffer));
await writeFile(path.join(OUTPUT_DIR, `${fileName}.png`), await buildPng(url, logoBuffer));
console.log(`QR code généré : output/${fileName}.svg et output/${fileName}.png`);
