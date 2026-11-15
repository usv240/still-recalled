// Collects a fresh set of live listings for the second accuracy test and the real-run count.
// Opens each search in a separate, throwaway Chrome profile (your own Chrome is not touched), reads the listings with
// the extension's own page reader (extension/src/extract.js), and keeps the first N in page order: what a shopper
// sees first. Listings that appear in any earlier set (development or first test) are dropped, so the set is held out.
// Usage: node tools/collect-live.mjs [--out=tools/fresh-listings.json] [--per=16]
import puppeteer from 'puppeteer-core';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const outFile = path.resolve(opt('out', 'tools/fresh-listings.json'));
const per = Number(opt('per', 16));

// Searches a parent shopping for baby sleep gear would run, plus one ordinary control (stroller).
const EBAY = ['bassinet', 'baby sleeper', 'rock n play', 'crib bumper', 'baby lounger', 'baby nest', 'crib', 'baby swing', 'co sleeper', 'stroller'];
const CRAIGSLIST = [['losangeles', 'bassinet'], ['losangeles', 'crib'], ['chicago', 'bassinet'], ['chicago', 'crib']];
const searches = [
  ...EBAY.map(q => ({ name: `ebay: ${q}`, url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_ItemCondition=3000`, take: per })),
  ...CRAIGSLIST.map(([city, q]) => ({ name: `craigslist ${city}: ${q}`, url: `https://${city}.craigslist.org/search/sss?query=${encodeURIComponent(q)}`, take: 10 })),
];

const seen = new Set();
for (const f of ['tools/eval-listings.json', 'tools/live-listings.json']) {
  if (!existsSync(f)) continue;
  for (const list of Object.values(JSON.parse(readFileSync(f, 'utf8')))) for (const l of list) seen.add(l.id);
}

const reader = (await build({ entryPoints: ['extension/src/extract.js'], bundle: true, format: 'iife', globalName: '__srExtract', write: false })).outputFiles[0].text;
const profile = mkdtempSync(path.join(tmpdir(), 'sr-collect-'));
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, userDataDir: profile,
  defaultViewport: { width: 1366, height: 900 }, args: ['--window-size=1366,1000', '--no-first-run', '--no-default-browser-check'],
});
const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
for (const k of Object.keys(out)) if (!out[k].length) delete out[k];
// eBay answers an automated browser with an error page after a search or two. When it does, the collector stops for
// that site; the remaining searches were read in a normal browser instead.
const blocked = new Set();
const page = await browser.newPage();
for (const s of searches) {
  if (out[s.name]) { console.log('have', s.name); continue; }
  const site = new URL(s.url).hostname.split('.').slice(-2).join('.');
  if (blocked.has(site)) { console.log('skipped (site blocked the test browser):', s.name); continue; }
  try {
    // The first visit can redirect (a cookie or check page), which destroys the page context: retry the whole read.
    let listings = [];
    for (let attempt = 0; attempt < 2 && !listings.length; attempt++) {
      try {
        await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 45000 });
        // Scroll down in steps so lazy photos load, then read the page.
        for (let i = 0; i < 12; i++) { await page.evaluate(() => scrollBy(0, 700)); await new Promise(r => setTimeout(r, 350)); }
        await new Promise(r => setTimeout(r, 1500));
        // Evaluated, not added as a script tag: some pages' content security policy blocks inline scripts.
        listings = await page.evaluate(`(() => { ${reader}; return __srExtract.listingsOnPage().listings.map(({ el, ...l }) => l); })()`);
        if (!listings.length) {
          const seenLinks = await page.$$eval('a[href*="/itm/"], a[href*="/view/d/"]', a => a.length);
          const title = await page.title();
          console.log(`  empty read on ${s.name}: "${title}", ${seenLinks} item links`);
          if (/error page/i.test(title)) { blocked.add(site); break; }
          await page.screenshot({ path: path.join(path.dirname(outFile), 'collect-empty.png') });
          await new Promise(r => setTimeout(r, 8000));
        }
      } catch (e) {
        console.log(`  retry ${s.name}: ${String(e).slice(0, 90)}`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    const fresh = listings.filter(l => !seen.has(l.id) && l.image)
      // eBay links carry long tracking parameters; the item address alone is enough.
      .map(l => ({ ...l, url: l.site === 'ebay' ? `https://www.ebay.com/itm/${l.id}` : l.url.split('?')[0] }));
    fresh.forEach(l => seen.add(l.id));
    if (!listings.length) continue;
    out[s.name] = fresh.slice(0, s.take).map(l => ({ ...l, search: s.name, collectedAt: new Date().toISOString() }));
    console.log(`${s.name}: ${listings.length} on page, ${fresh.length} new, kept ${out[s.name].length}`);
    writeFileSync(outFile, JSON.stringify(out, null, 1));
  } catch (e) {
    console.log(s.name, String(e).slice(0, 120));
  }
  await new Promise(r => setTimeout(r, 6000));
}
await browser.close().catch(() => {});
try { rmSync(profile, { recursive: true, force: true }); } catch {}
const all = Object.values(out).flat();
console.log(`total ${all.length} listings, ${all.filter(l => l.price).length} with a price -> ${outFile}`);
