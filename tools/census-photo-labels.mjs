// Turns the photo review of a census (tools/census-sheets.mjs: every flagged listing, and every listing from the baby
// searches that the word rules left open, each read by an AI reviewer from its title and photo) into label files, and
// prints the tables of docs/accuracy.md, section 34.
// Reads <dir>/index.json and <dir>/labels-flagged-*.json, labels-open-*.json (keyed by sheet number).
// Writes tools/<census>-labels.json (same shape as the other censuses) and tools/<census>-open-labels.json.
// Usage: node tools/census-photo-labels.mjs tools/census-facebook.json E:/sr-census-fb
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const file = process.argv[2], dir = process.argv[3];
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const index = read(path.join(dir, 'index.json'));
const TYPE = { lounger: 'in_bed_sleeper', bumper: 'crib_bumper', inclined: 'inclined_sleeper' };
const usd = p => Number(String(p || '').replace(/[^\d.]/g, '')) || 0;
const money = v => `$${Math.round(v).toLocaleString('en-US')}`;
const plain = t => t.replace(/^Just listed,\s*/i, '').toLowerCase().replace(/\W+/g, ' ').trim();
// An ad that shares its title, price and metro area with another is counted once (as on Craigslist).
const once = rows => [...new Map(rows.map(r => [`${plain(r.title)}|${r.price}|${r.city}`, r])).values()];

const out = {};
for (const group of ['flagged', 'open']) {
  const parts = readdirSync(dir).filter(f => f.startsWith(`labels-${group}-`) && f.endsWith('.json'));
  const raw = Object.assign({}, ...parts.map(f => read(path.join(dir, f))));
  const labels = {}, missing = [];
  for (const row of index[group]) {
    const l = raw[String(row.n)];
    if (!l) { missing.push(row.n); continue; }
    labels[row.id] = {
      type: TYPE[l.kind] || l.kind, is_it: TYPE[l.kind] ? 'yes' : l.kind === 'unclear' ? 'unclear' : 'no', sure: !!l.sure,
      brand: l.brand || '', condition: 'unknown', photo_checked: true, full_photo: !!l.full, why: l.why || '',
    };
  }
  if (missing.length) console.log(`${group}: ${missing.length} without a label (${missing.slice(0, 12).join(', ')}...)`);
  out[group] = labels;
  const rows = index[group].filter(r => labels[r.id]).map(r => ({ ...r, ...labels[r.id] }));
  const count = v => rows.filter(r => r.is_it === v).length;
  const yes = once(rows.filter(r => r.is_it === 'yes'));
  console.log(`\n${group}: ${rows.length} labelled; yes ${count('yes')} (counted once: ${yes.length}), no ${count('no')}, unclear ${count('unclear')}`);
  for (const t of Object.values(TYPE)) {
    const of = yes.filter(r => r.type === t);
    const asked = money(of.reduce((a, r) => a + usd(r.price), 0));
    console.log(`  ${t.padEnd(18)} ${String(of.length).padStart(4)}  ${asked.padStart(8)}  sure ${of.filter(r => r.sure).length}, no brand ${of.filter(r => !r.brand).length}, metros ${new Set(of.map(r => r.city)).size}`);
  }
  const prices = yes.map(r => usd(r.price)).sort((a, b) => a - b);
  console.log(`  asked in all: ${money(prices.reduce((a, p) => a + p, 0))}; median ${money(prices[prices.length >> 1] || 0)}`);
  const brands = {};
  for (const r of yes) if (r.brand) { const b = r.brand.toLowerCase().replace(/[^a-z]/g, ''); brands[b] = (brands[b] || 0) + 1; }
  console.log(`  brands: ${Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([b, n]) => `${b} ${n}`).join(', ')}`);
  if (group === 'open') {
    for (const r of yes.filter(r => r.type === 'inclined_sleeper'))
      console.log(`    ${String(r.n).padStart(3)} ${r.city.padEnd(12)} ${r.price.padEnd(6)} ${r.title.slice(0, 44).padEnd(44)} | ${r.brand} | ${r.why}`);
  }
}
const labeller = 'AI reviewer (Claude, separate agents), 2026-11-25, title and photo for every listing';
writeFileSync(file.replace(/\.json$/, '-labels.json'), JSON.stringify({ labeller, labels: out.flagged }, null, 1));
writeFileSync(file.replace(/\.json$/, '-open-labels.json'), JSON.stringify({
  labeller, what: 'listings from the searches "baby lounger", "baby nest" and "baby rocker sleeper" that the word rules left open', labels: out.open,
}, null, 1));
