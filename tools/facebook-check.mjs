// Checks the extension's page reader (extension/src/extract.js) on public Facebook Marketplace pages, logged out, in a
// throwaway Chrome profile: a search page, an item opened from it (Facebook shows it in a dialog over the search),
// and the same item loaded on its own. Prints what the reader found; reads nothing else and stores nothing.
// Usage: node tools/facebook-check.mjs [--city=charlotte] [--query="baby lounger"]
import puppeteer from 'puppeteer-core';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const city = opt('city', 'charlotte'), query = opt('query', 'baby lounger');
const reader = (await build({ entryPoints: ['extension/src/extract.js'], bundle: true, format: 'iife', globalName: '__srExtract', write: false })).outputFiles[0].text;
const read = page => page.evaluate(`(() => { ${reader}; const s = __srExtract.listingsOnPage(); const d = __srExtract.listingDetail();
  return { site: s.site, count: s.listings.length, listings: s.listings.slice(0, 40).map(({ el, ...l }) => l), detail: d }; })()`);
const wait = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(path.join(tmpdir(), 'sr-fb-'));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true,
  userDataDir: profile, defaultViewport: { width: 1366, height: 900 }, args: ['--window-size=1366,1000', '--no-first-run', '--no-default-browser-check'] });
const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
try {
  const page = await browser.newPage();
  await page.goto(`https://www.facebook.com/marketplace/${city}/search?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(4000);
  const search = await read(page);
  console.log(`search: ${search.count} listings`);
  for (const l of search.listings.slice(0, 12)) console.log(`  ${l.id} | ${l.title} | ${l.price} | ${l.image ? 'photo' : 'NO PHOTO'}`);
  check(search.site === 'facebook' && search.count >= 5, 'search page: at least 5 listings read');
  check(search.listings.every(l => l.title && !/listing \d|\$\d/.test(l.title) && !/, [A-Z]{2}$/.test(l.title)), 'titles carry no price, place or listing number');
  check(search.listings.filter(l => l.price).length >= search.count * 0.9, 'prices read on 90% or more');
  check(search.listings.filter(l => l.image).length >= search.count * 0.9, 'photos read on 90% or more');
  check(!search.detail, 'a search page is not read as an item page');

  // Open the first listing the way a shopper does: a click, which opens it in a dialog over the search.
  const first = search.listings[0];
  await page.evaluate(id => document.querySelector(`a[href*="/marketplace/item/${id}"]`).click(), first.id);
  await wait(5000);
  const modal = await read(page);
  console.log(`dialog: ${JSON.stringify(modal.detail && { ...modal.detail, description: modal.detail.description.slice(0, 160) })}`);
  check(modal.detail && modal.detail.id === first.id, 'an item opened from the search is read as that item');
  check(modal.detail && modal.detail.title.toLowerCase().startsWith(first.title.toLowerCase().slice(0, 10)), 'its title matches the card');
  check(modal.detail && !/be aware of product recalls|seller information|today's picks/i.test(modal.detail.description), "Facebook's own notice and the seller's profile are left out");

  await page.goto(`https://www.facebook.com/marketplace/item/${first.id}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(4000);
  const own = await read(page);
  console.log(`item page: ${JSON.stringify(own.detail && { ...own.detail, description: own.detail.description.slice(0, 160) })}`);
  check(own.detail && own.detail.id === first.id && own.detail.title, 'the item page is read');
  check(own.detail && own.detail.image, 'the item page has its photo');
  check(own.detail && !/be aware of product recalls|seller information|seller reviews/i.test(own.detail.description), "the item page leaves out Facebook's notice and the seller's profile");

  // Elsewhere on Facebook the reader must read nothing.
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2000);
  const home = await read(page);
  check(!home.site && !home.count && !home.detail, 'outside Marketplace nothing is read');
} finally {
  await browser.close().catch(() => {});
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* fine */ }
}
console.log(fails.length ? `${fails.length} failed` : 'all passed');
process.exit(fails.length ? 1 : 0);
