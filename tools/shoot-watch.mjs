// Screenshots of the 0.8.0 screens, for checking the design and for the gallery: the install page, and the side panel's
// watch list with one alert (from a real refresh: the Kidsview bouncer, recall 27092, published 2026-11-19) and one
// quiet listing. Uses a throwaway profile and the development build.
// Usage: node tools/shoot-watch.mjs [extDir] -> tools/e2e-out/welcome.png, watch-panel.png, item-panel.png
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const out = path.resolve('tools/e2e-out');
mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true,
  enableExtensions: true, userDataDir: mkdtempSync(path.join(tmpdir(), 'sr-shoot-')), args: ['--no-first-run', '--no-default-browser-check'] });
const id = await b.installExtension(path.resolve(process.argv[2] || 'extension'));
const sw = await (await b.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`))).worker();

// The install page.
const welcome = await b.newPage();
await welcome.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });
await welcome.goto(`chrome-extension://${id}/welcome.html`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 800));
await welcome.screenshot({ path: path.join(out, 'welcome.png'), fullPage: true });

// A real refresh, then a watch list with the bouncer (as the alert would record it) and one quiet listing.
const panel = await b.newPage();
await panel.setViewport({ width: 400, height: 860, deviceScaleFactor: 2 });
await panel.goto(`chrome-extension://${id}/panel.html`, { waitUntil: 'domcontentloaded' });
const refresh = await panel.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:refresh-recalls' }));
console.log('refresh', JSON.stringify(refresh));
const watched = await panel.evaluate(async () => {
  const bouncer = { id: 'infant-bouncer', title: 'Kidsview baby bouncer with toy bar, khaki', price: '$35',
    image: 'https://still-recalled.web.app/try/img/bouncer.png', url: 'https://still-recalled.web.app/try/item/infant-bouncer.html' };
  const blocks = { id: 'wooden-blocks', title: 'Wooden building blocks, painted', price: '$8',
    image: 'https://still-recalled.web.app/try/img/wooden-blocks.jpg', url: 'https://still-recalled.web.app/try/item/wooden-blocks.html' };
  const { live } = await chrome.storage.local.get('live');
  const card = live && live.cards.find(c => c.id === '27092');
  const day = n => new Date(Date.now() - n * 864e5).toISOString();
  const watch = {
    'practice:wooden-blocks': { site: 'practice', listing: blocks, addedAt: day(9), alert: null },
    'practice:infant-bouncer': { site: 'practice', listing: bouncer, addedAt: day(30), alert: card ? {
      at: new Date().toISOString(), level: 'possible', badge: 'Possible recall', confirmed: true, seen: false,
      recall: { id: card.id, date: card.date, product: card.product, hazard: card.hazard, url: card.url, tell: card.tell } } : null },
  };
  await chrome.storage.local.set({ watch });
  return !!card;
});
console.log('bouncer recall in live list:', watched);
await panel.reload({ waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 600));
await panel.click('#watching');
await new Promise(r => setTimeout(r, 1500));
await panel.screenshot({ path: path.join(out, 'watch-panel.png') });

// A listing's own page, with the panel's watch card. The panel follows the active tab, so it is opened in a window
// beside the listing.
const item = await b.newPage();
await item.goto('https://still-recalled.web.app/try/item/wooden-blocks.html', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 8000));
await sw.evaluate(() => 1);
console.log('saved to', out);
await b.close();
