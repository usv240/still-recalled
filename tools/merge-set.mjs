// Builds a test set (tools/<set>-listings.json) from searches read in a normal Chrome and by the test browser:
//   eBay and Mercari: read in a normal Chrome with the extension's page reader, one search at a time, saved as TSV
//     (id, price, photo path, title) and checked row by row against the page. eBay serves an automated browser an
//     error page after a search or two.
//   Craigslist: tools/collect-live.mjs in a separate test browser (tools/<set>-craigslist.json).
// Every listing that was in an earlier set is dropped, and so is any repeat.
// Usage: node tools/merge-third.mjs [tsv folder, default C:/tmp/third] [set name, default third] [date]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'C:/tmp/third';
const set = process.argv[3] || 'third';
const EARLIER = ['eval', 'live', 'fresh', 'third', 'fourth'].slice(0, ['eval', 'live', 'fresh', 'third', 'fourth'].indexOf(set));
const seen = new Set();
for (const f of EARLIER.map(s => `tools/${s}-listings.json`)) {
  if (!existsSync(f)) continue;
  for (const list of Object.values(JSON.parse(readFileSync(f, 'utf8')))) if (Array.isArray(list)) for (const l of list) seen.add(l.id);
}
const out = {};
let dropped = 0;
const keep = (name, l) => { if (seen.has(l.id)) { dropped++; return; } seen.add(l.id); (out[name] ||= []).push(l); };
const when = process.argv[4] || '2026-11-16T07:00:00.000Z';
for (const f of readdirSync(dir).filter(f => f.endsWith('.tsv')).sort()) {
  const [site, ...words] = f.replace(/\.tsv$/, '').split('-');
  const name = `${site}: ${words.join(' ')}`;
  for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)) {
    const [id, price, photo, title] = line.split('\t');
    keep(name, site === 'ebay'
      ? { id, site, url: `https://www.ebay.com/itm/${id}`, title, price, image: `https://i.ebayimg.com/images/${photo}`, search: name, collectedAt: when }
      : { id, site, url: `https://www.mercari.com/us/item/${id}/`, title, price, image: `https://u-mercari-images.mercdn.net/${photo}`, search: name, collectedAt: when });
  }
}
for (const [name, list] of Object.entries(JSON.parse(readFileSync(`tools/${set}-craigslist.json`, 'utf8')))) for (const l of list) keep(name, l);
writeFileSync(`tools/${set}-listings.json`, JSON.stringify(out, null, 1));
const all = Object.values(out).flat();
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join('\n'));
console.log(`total ${all.length} (${dropped} dropped as seen before), ${all.filter(l => l.price).length} with a price`);
