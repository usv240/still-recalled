// The example for "Try it with an example photo" (web page and Android app): a made-up secondhand listing, at phone
// size, around the photo from CPSC recall notice 26591 (VEVOR baby loungers, every unit recalled). A real listing has a
// seller's title, and the title is what lets the check name the recall, so the example has one too. The page says the
// listing is made up.
//
//   node scripts/make-example.mjs   -> web/example/listing-26591.jpg, android/app/src/main/assets/example.jpg
import puppeteer from 'puppeteer-core';
import { readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const photo = `data:image/jpeg;base64,${readFileSync('web/example/recall-26591.jpg').toString('base64')}`;
const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; font: 16px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c1e21; background: #fff; width: 412px; }
  .bar { height: 48px; display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #e4e6eb; font-weight: 600; }
  img { display: block; width: 412px; height: 412px; object-fit: cover; background: #f0f2f5; }
  .body { padding: 14px 16px 22px; }
  h1 { font-size: 22px; line-height: 1.25; margin: 0 0 6px; font-weight: 600; }
  .price { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  .muted { color: #65676b; font-size: 14px; margin: 0 0 14px; }
  h2 { font-size: 16px; margin: 0 0 6px; }
  p.desc { margin: 0; }
</style>
<div class="bar">Listing</div>
<img src="${photo}">
<div class="body">
  <h1>VEVOR baby lounger nest, snow deer print</h1>
  <p class="price">$18</p>
  <p class="muted">Used, like new · Pickup only</p>
  <h2>Description</h2>
  <p class="desc">Portable newborn lounger with pillow. Used a few times for naps, washed, no stains. Smoke-free home.</p>
</div>`;

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 800, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  const out = path.resolve('web/example/listing-26591.jpg');
  await page.screenshot({ path: out, type: 'jpeg', quality: 86, fullPage: true });
  copyFileSync(out, 'android/app/src/main/assets/example.jpg');
  console.log('wrote', out, 'and android/app/src/main/assets/example.jpg');
} finally {
  await browser.close();
}
