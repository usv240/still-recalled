// Scores a census (tools/census.mjs) with the extension's word rules alone: no model, no photo. A listing counts only
// when its own words name a banned sleep type (triage hints) or a recalled product line or model (shortlist "line" or
// "code"), and it is not a part, a toy or a doll item. Brand-only matches and listings the words leave open are not
// counted, so this is a floor: listings sold without telling words (the ones the photo check is for) are not in it.
// Prints the table and writes tools/<name>-flagged.json for review.
// Usage: node tools/census-score.mjs tools/census-ebay.json
import { readFileSync, writeFileSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage } from '../shared/triage.mjs';
import { BANNED_TYPES } from '../shared/banned.mjs';

const file = process.argv[2] || 'tools/census-ebay.json';
const census = JSON.parse(readFileSync(file, 'utf8'));
const { cards } = JSON.parse(readFileSync('extension/data/cards.json', 'utf8'));
const idx = buildIndex(cards);
const price = p => { const m = /\$\s*([\d,]+(?:\.\d+)?)/.exec(String(p || '')); return m ? Number(m[1].replace(/,/g, '')) : 0; };

const listings = Object.values(census.listings);
const flagged = [];
for (const l of listings) {
  const t = triage(idx, l);
  if (t.partOrToy) continue;
  const type = t.hints[0] ? t.hints[0].key : '';
  const recall = t.candidate && (t.candidate.strength === 'line' || t.candidate.strength === 'code') ? t.candidate : null;
  if (!type && !recall) continue;
  flagged.push({ id: l.id, site: l.site, city: l.city, title: l.title, price: l.price || '', usd: price(l.price), url: l.url, image: l.image,
    type, recall: recall ? { id: recall.card.id, strength: recall.strength, product: recall.card.product, all: !!recall.card.all } : null });
}
const byType = {};
for (const f of flagged) {
  const k = f.type || (f.recall ? `recall ${f.recall.id}` : '');
  byType[k] ||= { n: 0, usd: 0 };
  byType[k].n++; byType[k].usd += f.usd;
}
const label = k => (BANNED_TYPES.find(t => t.key === k) || {}).label || k;
console.log(`${file}: ${Object.keys(census.searches).length} searches, ${listings.length} listings read, ${flagged.length} named a banned sleep type or a recalled line by their own words`);
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${label(k).padEnd(36)} ${String(v.n).padStart(4)}   $${Math.round(v.usd).toLocaleString('en-US')}`);
console.log(`  asking prices in all: $${Math.round(flagged.reduce((a, f) => a + f.usd, 0)).toLocaleString('en-US')}`);
writeFileSync(file.replace(/\.json$/, '-flagged.json'), JSON.stringify({ at: census.at, scored: new Date().toISOString(), searches: Object.keys(census.searches).length, read: listings.length, byType, flagged }, null, 1));
