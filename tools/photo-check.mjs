// Diagnostic: loads the development extension in a throwaway profile, opens a search page, and counts how many
// listings reached the engine with a photo. Found the Craigslist late-photo bug (2026-11-16).
// Usage: node tools/photo-check.mjs "<search page URL>"
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import path from 'node:path';
const url = process.argv[2];
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true, enableExtensions: true, userDataDir: mkdtempSync(path.join(tmpdir(), 'sr-pc-')), defaultViewport: { width: 1440, height: 810 }, args: ['--no-first-run'] });
try {
  const id = await b.installExtension(path.resolve('extension'));
  const w = await (await b.waitForTarget(t => t.type() === 'service_worker' && t.url().includes(id))).worker();
  const p = await b.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 25000));
  const all = await w.evaluate(() => chrome.storage.session.get(null));
  const st = Object.values(all).find(v => v && v.url && v.results);
  const rows = Object.values(st.results);
  console.log(`${rows.length} results; with photo ${rows.filter(r => r.listing.image).length}; without ${rows.filter(r => !r.listing.image).length}`);
  for (const r of rows.filter(r => !r.listing.image).slice(0, 8)) console.log('  no photo:', r.listing.title.slice(0, 60));
  const onPage = await p.evaluate(() => [...document.querySelectorAll('a[href*="/d/"]')].map(a => { const c = a.closest('li, .cl-search-result, .result-row') || a; const img = c.querySelector('img'); return img ? (img.currentSrc || img.src || '').slice(0, 40) : 'NO IMG ELEMENT'; }).slice(0, 15));
  console.log('page img sources:', JSON.stringify(onPage));
} finally { await b.close(); }
