// Development only: builds the "brand left out" test. Takes the real listings of the five accuracy tests whose words
// name a recalled product and whose blind label agrees (labelled "should be flagged", or "can't tell" with that same
// recall named by the reviewer), and strips from each title, by plain code, the words that name it: the recall card's
// brand, product line and model numbers. What is left is how many sellers write
// a title ("Baby rocker sleeper, pink"). The seller's own photo is kept. The word rules can no longer find the recall,
// so this measures the two lookups: the device's (a brand read in the photo) and the cloud's (lookup_recalls).
//   node tools/masked-build.mjs   -> tools/masked-listings.json (the test set), tools/masked-key.json (the answers)
// --from=<census file> --name=masked2 --max=30: the same, from fresh listings that no test set holds (0.17.0). They
// have no AI label, so the answer key is the recall the full title's words lead to (a product line or model number,
// never a brand alone, never a part or toy): the test asks whether the lookups recover it once the naming words are gone.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { tokenize, modelCodes } from '../shared/text.mjs';
import { triage } from '../shared/triage.mjs';

const read = f => JSON.parse(readFileSync(`tools/${f}`, 'utf8'));
const { cards } = JSON.parse(readFileSync('extension/data/cards.json', 'utf8'));
const index = buildIndex(cards);
const LABELS = { eval: ['eval-labels.json'], fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'], third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'], fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'], fifth: ['fifth-labels-a.json', 'fifth-labels-b.json', 'fifth-labels-c.json'] };

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=').slice(1).join('=');
const from = arg('from', ''), name = arg('name', 'masked'), max = Number(arg('max', '1000')), per = Number(arg('per', '4'));
const out = [], key = {}, skipped = [];
if (from) {
  const src = Object.values(JSON.parse(readFileSync(from, 'utf8')).listings);
  // Spread across the searches: at most a few per recall, so one recall can't fill the set.
  const perRecall = {};
  for (const l of src) {
    if (out.length >= max || !l.image) continue;
    const t0 = triage(index, l);
    const first = shortlist(index, l.title)[0];
    if (t0.partOrToy || !first || !['line', 'code'].includes(first.strength)) continue;
    if ((perRecall[first.card.id] = (perRecall[first.card.id] || 0) + 1) > per) continue;
    let title = l.title, removed = [];
    for (let round = 0; round < 4; round++) {
      const c = shortlist(index, title)[0];
      if (!c) break;
      const mask = new Set([...c.card.brands.flat(), ...c.card.lines.flat(), ...c.card.linesWithBrand.flat()]);
      title = title.split(/\s+/).filter(w => { const hit = tokenize(w).some(t => mask.has(t)) || modelCodes(w).length > 0; if (hit) removed.push(w); return !hit; }).join(' ').replace(/^[\s,;:|/&-]+|[\s,;:|/&-]+$/g, '');
    }
    if (shortlist(index, title)[0] || title.replace(/[^a-z]/gi, '').length < 4) { skipped.push({ id: l.id, title: l.title, left: title }); continue; }
    const t = triage(index, { title });
    out.push({ id: `m${l.id}`, site: l.site || 'ebay', url: l.url, title, price: l.price || '', image: l.image });
    key[`m${l.id}`] = { set: 'fresh eBay', label: 'none (words key)', original: l.title, removed, recall: first.card.id, strength: first.strength, product: first.card.product, allUnits: !!first.card.all,
      wordsNow: t.hints.length ? `type: ${t.hints[0].key}` : t.needsEyes ? 'a baby product, no recall or type' : 'nothing: no model looks' };
  }
}
for (const set of from ? [] : Object.keys(LABELS)) {
  const labels = Object.assign({}, ...LABELS[set].filter(f => existsSync(`tools/${f}`)).map(f => read(f).labels));
  for (const l of Object.values(read(`${set}-listings.json`)).flat()) {
    const lab = labels[l.id] || {};
    if (!l.image || !['yes', 'maybe'].includes(lab.should_warn)) continue;
    const first = shortlist(index, l.title)[0];
    if (!first) continue;   // flagged for its type, not for a recall its words name
    // "Can't tell" listings count only when the reviewer named the same recall the words lead to.
    const agrees = (lab.recall_ids || []).map(String).includes(first.card.id);
    if (lab.should_warn === 'maybe' && !agrees) continue;
    let title = l.title, removed = [];
    // Strip the words that name the recall; repeat while the stripped title still brings up a recall.
    for (let round = 0; round < 4; round++) {
      const c = shortlist(index, title)[0];
      if (!c) break;
      const mask = new Set([...c.card.brands.flat(), ...c.card.lines.flat(), ...c.card.linesWithBrand.flat()]);
      title = title.split(/\s+/).filter(w => {
        const hit = tokenize(w).some(t => mask.has(t)) || modelCodes(w).length > 0;
        if (hit) removed.push(w);
        return !hit;
      }).join(' ').replace(/^[\s,;:|/&-]+|[\s,;:|/&-]+$/g, '');
    }
    if (shortlist(index, title)[0] || title.replace(/[^a-z]/gi, '').length < 4) { skipped.push({ id: l.id, title: l.title, left: title }); continue; }
    const t = triage(index, { title });
    out.push({ id: `m${l.id}`, site: l.site || 'ebay', url: l.url, title, price: l.price || '', image: l.image });
    key[`m${l.id}`] = { set, label: lab.should_warn, reviewerNamedIt: agrees, original: l.title, removed, recall: first.card.id, strength: first.strength, product: first.card.product, allUnits: !!first.card.all,
      wordsNow: t.hints.length ? `type: ${t.hints[0].key}` : t.needsEyes ? 'a baby product, no recall or type' : 'nothing: no model looks' };
  }
}
writeFileSync(`tools/${name}-listings.json`, JSON.stringify({ masked: out }, null, 1));
writeFileSync(`tools/${name}-key.json`, JSON.stringify({ at: new Date().toISOString(), note: 'Real listings whose words named a recalled product and whose blind label agrees; the naming words were stripped by code. Photos are the sellers\' own.', listings: out.length, skipped, key }, null, 1));
console.log(`${out.length} listings, ${skipped.length} skipped`);
const by = {};
for (const k of Object.values(key)) by[k.wordsNow] = (by[k.wordsNow] || 0) + 1;
console.log(JSON.stringify(by));
for (const l of out) console.log(`${key[l.id].recall.padEnd(8)} ${key[l.id].strength.padEnd(5)} ${l.title.slice(0, 60).padEnd(60)} <- ${key[l.id].original.slice(0, 70)}`);
