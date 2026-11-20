// What adding the CPSC warning cards changes for the word rules, on the four test sets' 597 listings: every listing
// whose strongest word match is now a warning card, with its label. Nothing here calls a model.
//   node tools/warnings-check.mjs
import { readFileSync, existsSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage } from '../shared/triage.mjs';
const { cards } = JSON.parse(readFileSync('extension/data/cards.json', 'utf8'));
const withW = buildIndex(cards), without = buildIndex(cards.filter(c => !c.warning));
const sets = { eval: ['eval-labels.json'], fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'], third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'], fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'] };
let n = 0, changed = 0;
for (const [set, files] of Object.entries(sets)) {
  const labels = Object.assign({}, ...files.filter(f => existsSync(`tools/${f}`)).map(f => JSON.parse(readFileSync(`tools/${f}`, 'utf8')).labels));
  for (const l of Object.values(JSON.parse(readFileSync(`tools/${set}-listings.json`, 'utf8'))).flat()) {
    n++;
    const a = triage(without, l), b = triage(withW, l);
    const ida = a.candidate ? a.candidate.card.id : '', idb = b.candidate ? b.candidate.card.id : '';
    if (ida === idb) continue;
    changed++;
    console.log(`${set} | label ${(labels[l.id] || {}).should_warn || '?'} | ${l.title.slice(0, 70)} | was ${ida || 'no recall'} | now ${idb} ${b.candidate.strength}: ${b.candidate.card.product.slice(0, 50)}`);
  }
}
console.log(JSON.stringify({ listings: n, changedByWarnings: changed, warningCards: cards.filter(c => c.warning).length }));
