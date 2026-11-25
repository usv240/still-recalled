// Draws docs/gallery/8-census.png: what was for sale on eBay and Craigslist on 2026-11-25, every number computed here
// from the census files and the AI reviewers' labels (docs/accuracy.md, sections 29 and 31). Same look as
// scripts/make-gallery.mjs. Usage: node scripts/make-census-image.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const read = f => JSON.parse(readFileSync(f, 'utf8'));
const usd = p => Number(String(p || '').replace(/[^\d.]/g, '')) || 0;
const TYPE = t => (t === 'in_bed_sleeper' ? 'lounger' : t === 'crib_bumper' ? 'bumper' : t === 'inclined_sleeper' ? 'inclined' : 'recall');

// One site: the listings an AI reviewer labelled "yes". On Craigslist an ad posted twice (same title and price, same city)
// is counted once; on eBay each listing is its own item number, and a seller may list two of the same, so all count.
function site(name) {
  const census = read(`tools/census-${name}.json`);
  const { flagged } = read(`tools/census-${name}-flagged.json`);
  const { labels } = read(`tools/census-${name}-labels.json`);
  const yes = flagged.filter(f => labels[f.id] && labels[f.id].is_it === 'yes');
  const once = name === 'craigslist' ? [...new Map(yes.map(f => [`${f.title.toLowerCase().replace(/\W+/g, ' ').trim()}|${f.price}|${f.city}`, f])).values()] : yes;
  const by = { lounger: { n: 0, usd: 0 }, bumper: { n: 0, usd: 0 }, inclined: { n: 0, usd: 0 }, recall: { n: 0, usd: 0 } };
  for (const f of once) { const k = TYPE(labels[f.id].type); by[k].n++; by[k].usd += usd(f.price); }
  return { read: Object.keys(census.listings).length, searches: Object.values(census.searches).filter(s => s.results).length, flagged: flagged.length, n: once.length, usd: once.reduce((a, f) => a + usd(f.price), 0), by };
}
// eBay's file keeps every listing the word rules flagged; the census counts only sleep types (51 toy recall-line
// matches left out, docs/accuracy.md section 29), as its labels do.
const ebay = site('ebay'), cl = site('craigslist');
const money = v => `$${Math.round(v).toLocaleString('en-US')}`;
const total = { n: ebay.n + cl.n, usd: ebay.usd + cl.usd, read: ebay.read + cl.read };
const font = f => pathToFileURL(path.resolve('extension/fonts', f)).href;
const row = (label, k) => `<tr><td>${label}</td><td>${ebay.by[k].n}</td><td>${cl.by[k].n}</td><td><b>${ebay.by[k].n + cl.by[k].n}</b></td><td>${money(ebay.by[k].usd + cl.by[k].usd)}</td></tr>`;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url("${font('Geist-Regular.woff2')}"); font-weight: 400; }
@font-face { font-family: Geist; src: url("${font('Geist-Medium.woff2')}"); font-weight: 500; }
@font-face { font-family: Geist; src: url("${font('Geist-SemiBold.woff2')}"); font-weight: 600; }
:root { --ground: #f8f8f8; --text: #0a0a0a; --muted: #5e5e5e; --rule: #e6e6e6; --likely: #c4242a; }
* { box-sizing: border-box; }
html, body { margin: 0; width: 1500px; height: 1000px; background: var(--ground); color: var(--text); font-family: Geist, system-ui, sans-serif; }
.slide { width: 1500px; height: 1000px; padding: 80px 96px; display: flex; flex-direction: column; }
h1 { font-size: 52px; line-height: 1.08; font-weight: 600; letter-spacing: -0.02em; margin: 0; max-width: 1200px; text-wrap: balance; }
.lede { font-size: 24px; line-height: 1.4; color: var(--muted); margin: 20px 0 0; max-width: 1180px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 48px; }
.stat { border-top: 3px solid var(--text); padding-top: 16px; }
.stat.hot { border-color: var(--likely); }
.big { font-size: 76px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; }
.what { font-size: 21px; line-height: 1.4; color: var(--muted); margin-top: 10px; }
table { margin-top: 44px; border-collapse: collapse; width: 100%; font-size: 21px; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 500; color: var(--muted); font-size: 17px; padding: 0 0 10px; border-bottom: 1px solid var(--rule); }
td { padding: 13px 0; border-bottom: 1px solid var(--rule); }
th:not(:first-child), td:not(:first-child) { width: 150px; }
.foot { margin-top: auto; font-size: 18px; line-height: 1.45; color: var(--muted); display: flex; justify-content: space-between; gap: 40px; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--text); white-space: nowrap; }
.brand i { width: 14px; height: 14px; border-radius: 3px; background: var(--likely); display: inline-block; }
</style><div class="slide">
<h1>On one day, ${total.n} infant loungers, padded bumpers and recalled products were for sale on two sites.</h1>
<p class="lede">November 25, 2026: the first results page of searches for four kinds of infant sleep product, on eBay and on Craigslist in the 30 largest U.S. metro areas. Nearly half carried no brand in the title, the case a keyword filter misses.</p>
<div class="stats">
  <div class="stat hot"><div class="big">${total.n}</div><div class="what">listings of infant sleep products that are banned, recalled, or that CPSC warns are never for sleep</div></div>
  <div class="stat"><div class="big">${money(total.usd)}</div><div class="what">asked for them in all</div></div>
  <div class="stat"><div class="big">${total.read.toLocaleString('en-US')}</div><div class="what">listings read, from ${ebay.searches + cl.searches} searches</div></div>
</div>
<table><thead><tr><th>What was for sale</th><th>eBay</th><th>Craigslist</th><th>Together</th><th>Asked</th></tr></thead><tbody>
${row('Infant loungers and nests a baby lies in', 'lounger')}
${row('Padded crib bumpers (banned from sale since 2022)', 'bumper')}
${ebay.by.recall.n + cl.by.recall.n ? row('Products named in a CPSC recall (model not checked)', 'recall') : ''}
</tbody></table>
<div class="foot"><span>Each listing the word rules flagged was labelled by an AI reviewer (Claude) from its title, with photos checked for a sample; a person's check is next. Craigslist ads posted twice are counted once. Method: docs/accuracy.md, sections 29 and 31.</span><span class="brand"><i></i>Still Recalled</span></div>
</div>`;

const tmp = path.resolve('docs/gallery/src/census.html');
writeFileSync(tmp, html);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle0' });
await page.screenshot({ path: 'docs/gallery/8-census.png' });
await browser.close();
rmSync(tmp);
console.log(`8-census.png: ${total.n} listings, ${money(total.usd)} (eBay ${ebay.n} ${money(ebay.usd)}, Craigslist ${cl.n} ${money(cl.usd)})`);
