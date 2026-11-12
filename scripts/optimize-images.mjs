#!/usr/bin/env node
/**
 * Zécha! Asset Optimization Script
 * Reads originals from ./assets-src/, converts all raster images to stripped WebP
 * at exact pre-sized display budgets into ./public/assets/, writes ./public/assets/cup-mark.svg,
 * and generates ./lib/image-manifest.ts with tiny base64 blurDataURLs.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'assets-src');
const OUT_DIR = path.join(ROOT, 'public', 'assets');
const MANIFEST_PATH = path.join(ROOT, 'lib', 'image-manifest.ts');
const VERSION = 'v1';

const MENU_AND_PRODUCT_KEYS = new Set([
  'chai',
  'chai-splash',
  'chicken-dip',
  'coffee-orange',
  'fries-pack',
  'iced',
  'latte',
  'loaded-fries',
  'loaded-sq',
  'sub',
]);

async function moveLegacyOriginalsIfPresent() {
  if (!fs.existsSync(SRC_DIR)) {
    fs.mkdirSync(SRC_DIR, { recursive: true });
  }

  // Move top-level raster files from public/assets into assets-src if not yet moved
  if (fs.existsSync(OUT_DIR)) {
    for (const entry of fs.readdirSync(OUT_DIR)) {
      const fullPath = path.join(OUT_DIR, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && /\.(png|jpe?g)$/i.test(entry)) {
        const dest = path.join(SRC_DIR, entry);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(fullPath, dest);
        }
        fs.unlinkSync(fullPath);
      }
    }

    // Remove unused duplicate public/assets/menu directory (originals preserved in assets-src)
    const menuSubdir = path.join(OUT_DIR, 'menu');
    if (fs.existsSync(menuSubdir)) {
      fs.rmSync(menuSubdir, { recursive: true, force: true });
    }
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

async function generateBlurDataUrl(inputPath) {
  const buf = await sharp(inputPath)
    .resize({ width: 16, withoutEnlargement: true })
    .webp({ quality: 45, alphaQuality: 50 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

async function encodeWebpUnderBudget(inputPath, outPath, maxWidth, quality, budgetBytes) {
  let q = quality;
  const meta = await sharp(inputPath).metadata();
  const width = Math.min(meta.width || maxWidth, maxWidth);

  while (q >= 55) {
    await sharp(inputPath)
      .rotate() // Apply EXIF orientation if any, then strip all metadata (default)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: q, alphaQuality: Math.min(90, q + 10), effort: 6 })
      .toFile(outPath);

    const bytes = fs.statSync(outPath).size;
    if (!budgetBytes || bytes <= budgetBytes) {
      return bytes;
    }
    q -= 5;
  }
  return fs.statSync(outPath).size;
}

function writeCupMarkSvg() {
  const svg = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 19C24 16 26.5 14.5 26.5 11.5C26.5 9.5 25 8 25 8" stroke="#CE5535" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M32 17.5C32 14.5 34.5 13 34.5 10C34.5 8 33 6.5 33 6.5" stroke="#CE5535" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M40 19C40 16 42.5 14.5 42.5 11.5C42.5 9.5 41 8 41 8" stroke="#CE5535" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M15 24H46V35.5C46 43.5 39.2 49.5 30.5 49.5C21.8 49.5 15 43.5 15 35.5V24Z" stroke="#CE5535" stroke-width="3.2" stroke-linejoin="round" fill="rgba(206,85,53,0.1)"/>
  <path d="M46 27.5H49.5C52.8 27.5 55.2 30 55.2 33.2C55.2 36.4 52.8 39 49.5 39H45.5" stroke="#CE5535" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M13 54.5H48" stroke="#CE5535" stroke-width="3.5" stroke-linecap="round"/>
</svg>\n`;
  fs.writeFileSync(path.join(OUT_DIR, 'cup-mark.svg'), svg, 'utf8');
}

async function run() {
  await moveLegacyOriginalsIfPresent();
  writeCupMarkSvg();

  const srcFiles = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();

  const manifest = {};
  const legacyAliasMap = {};
  const reportRows = [];

  for (const file of srcFiles) {
    const srcPath = path.join(SRC_DIR, file);
    const meta = await sharp(srcPath).metadata();
    const beforeKB = fs.statSync(srcPath).size / 1024;
    const base = file.replace(/\.(png|jpe?g|webp)$/i, '');
    const blurDataURL = await generateBlurDataUrl(srcPath);

    const legacyPublicPath = `/assets/${file}`;
    const heroFilename = `${base}.${VERSION}.webp`;
    const heroOutPath = path.join(OUT_DIR, heroFilename);
    const heroPublicPath = `/assets/${heroFilename}`;

    let heroMaxW = 600;
    let heroBudget = 95 * 1024;
    let heroQuality = 80;

    if (base.startsWith('logo-')) {
      heroMaxW = 400; // 2x max 200px display
      heroBudget = 29 * 1024; // strictly under 30 KB
      heroQuality = 80;
    } else if (base.startsWith('mascot-')) {
      heroMaxW = 280; // >2x 130px peeking mascot
      heroBudget = 25 * 1024;
      heroQuality = 78;
    } else if (base === 'pattern') {
      heroMaxW = 600;
      heroBudget = 85 * 1024;
      heroQuality = 74;
    } else if (base === 'chicken') {
      heroMaxW = 380; // Displayed 140px wide -> >2x = 380w
      heroBudget = 45 * 1024;
      heroQuality = 78;
    } else if (base === 'loaded-cup') {
      heroMaxW = 300; // Displayed 104px wide -> >2x = 300w
      heroBudget = 35 * 1024;
      heroQuality = 78;
    } else if (MENU_AND_PRODUCT_KEYS.has(base)) {
      heroMaxW = 800; // Item hero target: 800w
      heroBudget = 95 * 1024; // Under 100 KB hard budget
      heroQuality = 80;
    }

    const heroBytes = await encodeWebpUnderBudget(
      srcPath,
      heroOutPath,
      heroMaxW,
      heroQuality,
      heroBudget
    );

    let thumbPublicPath = heroPublicPath;
    let thumbBytes = heroBytes;
    let tilePublicPath = heroPublicPath;
    let tileBytes = heroBytes;

    if (MENU_AND_PRODUCT_KEYS.has(base)) {
      const thumbName = `${base}-thumb.${VERSION}.webp`;
      const tileName = `${base}-tile.${VERSION}.webp`;

      thumbBytes = await encodeWebpUnderBudget(
        srcPath,
        path.join(OUT_DIR, thumbName),
        400, // Menu list thumb target: 400w
        76,
        38 * 1024 // Strictly under 40 KB
      );
      thumbPublicPath = `/assets/${thumbName}`;

      tileBytes = await encodeWebpUnderBudget(
        srcPath,
        path.join(OUT_DIR, tileName),
        600, // Bestseller / landing tile target: 600w
        78,
        65 * 1024
      );
      tilePublicPath = `/assets/${tileName}`;
    }

    legacyAliasMap[legacyPublicPath] = heroPublicPath;
    manifest[heroPublicPath] = {
      thumb: thumbPublicPath,
      tile: tilePublicPath,
      hero: heroPublicPath,
      blurDataURL,
      width: meta.width || heroMaxW,
      height: meta.height || heroMaxW,
    };

    reportRows.push({
      original: file,
      dims: `${meta.width}x${meta.height}`,
      beforeKB: beforeKB.toFixed(1),
      heroKB: (heroBytes / 1024).toFixed(1),
      tileKB: (tileBytes / 1024).toFixed(1),
      thumbKB: (thumbBytes / 1024).toFixed(1),
    });
  }

  const tsContent = `// AUTO-GENERATED BY scripts/optimize-images.mjs — DO NOT EDIT MANUALLY

export interface AssetManifestEntry {
  thumb: string;
  tile: string;
  hero: string;
  blurDataURL: string;
  width: number;
  height: number;
}

export const ASSET_MANIFEST: Record<string, AssetManifestEntry> = ${JSON.stringify(manifest, null, 2)};

export const LEGACY_ASSET_ALIASES: Record<string, string> = ${JSON.stringify(legacyAliasMap, null, 2)};
`;

  fs.writeFileSync(MANIFEST_PATH, tsContent, 'utf8');
  console.table(reportRows);
  console.log(`Generated ${Object.keys(manifest).length} optimized asset sets and ${MANIFEST_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
