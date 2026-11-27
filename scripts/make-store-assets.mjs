// Chrome Web Store images, made from the gallery and the extension's own icon and type:
//   dist/store-screens/<name>.png   five screenshots, 1280 x 800, no alpha
//   dist/store-screens/promo-440x280.png   the small promo tile
// Usage: node scripts/make-store-assets.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const out = path.resolve('dist/store-screens');
mkdirSync(out, { recursive: true });

// The gallery images are 1500 x 1000: scaled to 1200 x 800 and padded with their own ground colour.
for (const name of ['1-extension', '3-label-check', '4-new-recalls', '5-hybrid', '6-results']) {
  const src = `docs/gallery/${name}.png`;
  const { data } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const bg = { r: data[0], g: data[1], b: data[2] };
  await sharp(src).resize(1200, 800).extend({ left: 40, right: 40, background: bg }).flatten({ background: bg }).png().toFile(path.join(out, `${name}.png`));
}

const font = f => pathToFileURL(path.resolve('extension/fonts', f)).href;
const icon = `data:image/png;base64,${readFileSync('extension/icons/icon-128.png').toString('base64')}`;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url("${font('Geist-Medium.woff2')}"); font-weight: 500; }
@font-face { font-family: Geist; src: url("${font('Geist-SemiBold.woff2')}"); font-weight: 600; }
:root { --ground: #f8f8f8; --text: #0a0a0a; --muted: #5e5e5e; --likely: #c4242a; }
* { box-sizing: border-box; }
html, body { margin: 0; width: 440px; height: 280px; background: var(--ground); color: var(--text); font-family: Geist, system-ui, sans-serif; }
.tile { width: 440px; height: 280px; padding: 34px 36px; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 12px; font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }
.brand img { width: 36px; height: 36px; border-radius: 8px; }
h1 { margin: 0; font-size: 34px; line-height: 1.08; font-weight: 600; letter-spacing: -0.025em; }
.badge { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; background: var(--likely); color: #fff; font-size: 15px; font-weight: 600; padding: 6px 12px 6px 10px; border-radius: 7px; }
.badge svg { width: 15px; height: 15px; }
</style><div class="tile">
  <div class="brand"><img src="${icon}" alt="">Still Recalled</div>
  <h1>The recall warning,<br>on the listing.</h1>
  <span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>Recalled product</span>
</div>`;
const page = path.join(out, 'promo.html');
writeFileSync(page, html);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--allow-file-access-from-files'] });
const tab = await browser.newPage();
await tab.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
await tab.goto(pathToFileURL(page).href, { waitUntil: 'load' });
await tab.evaluate(() => document.fonts.ready);
const shot = await tab.screenshot({ type: 'png' });
await browser.close();
await sharp(shot).flatten({ background: '#f8f8f8' }).png().toFile(path.join(out, 'promo-440x280.png'));
// The store icon upload wants 128 x 128; the extension's own is used as it is.
await sharp('extension/icons/icon-128.png').png().toFile(path.join(out, 'icon-128.png'));
for (const f of ['promo-440x280.png', 'icon-128.png']) { const m = await sharp(path.join(out, f)).metadata(); console.log(f, `${m.width}x${m.height}`, 'alpha', m.hasAlpha); }
