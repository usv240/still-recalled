// Scores docs/accuracy.md, section 34: the Facebook Marketplace census (search words Facebook answers with nothing,
// what the photo review counted) and the hybrid on the inclined sleepers the word rules left open.
// Usage: node tools/census-fb-score.mjs
import { readFileSync } from 'node:fs';
const read = f => JSON.parse(readFileSync(`tools/${f}`, 'utf8'));
const rowsOf = f => { const o = read(f); return Array.isArray(o) ? o : Object.values(o).find(Array.isArray); };
const usd = p => Number(String(p || '').replace(/[^\d.]/g, '')) || 0;
const money = v => `$${Math.round(v).toLocaleString('en-US')}`;
const plain = t => t.replace(/^Just listed,\s*/i, '').toLowerCase().replace(/\W+/g, ' ').trim();

const census = read('census-facebook.json'), terms = read('census-facebook-terms.json');
const answers = (c, label) => {
  const by = {};
  for (const [k, v] of Object.entries(c.searches)) {
    const q = k.split(': ')[1];
    by[q] ||= { n: 0, none: 0, results: 0 };
    by[q].n++;
    by[q].results += v.results;
    if (!v.results && /No listings found/i.test(v.said || '')) by[q].none++;
  }
  console.log(label);
  for (const [q, v] of Object.entries(by)) {
    const line = v.none === v.n ? `"No listings found" in ${v.none} of ${v.n}` : `${v.results} listings in ${v.n} searches`;
    console.log(`  ${q.padEnd(26)} ${line}`);
  }
};
answers(census, `Census: ${Object.keys(census.searches).length} searches, ${Object.keys(census.listings).length} listings`);
answers(terms, 'Other wordings, 3 metros');

const sets = { flagged: read('census-facebook-labels.json').labels, open: read('census-facebook-open-labels.json').labels };
const all = Object.entries(sets).flatMap(([g, L]) => Object.entries(L).map(([id, l]) => ({ id, g, ...census.listings[id], ...l })));
// An ad that shares its title, price and metro area with another is counted once.
const once = r => [...new Map(r.map(x => [`${plain(x.title)}|${x.price}|${x.city}`, x])).values()];
const yes = once(all.filter(r => r.is_it === 'yes')), sure = yes.filter(r => r.sure);
const sum = r => money(r.reduce((a, x) => a + usd(x.price), 0));
const count = v => all.filter(r => r.is_it === v).length;
console.log(`\nPhoto review: ${all.length} listings (${Object.keys(sets.flagged).length} flagged by words, ${Object.keys(sets.open).length} left open); no ${count('no')}, unclear ${count('unclear')}, full-size photo opened ${all.filter(r => r.full_photo).length}`);
for (const [t, name] of [['in_bed_sleeper', 'loungers and nests'], ['crib_bumper', 'padded crib bumpers'], ['inclined_sleeper', 'inclined sleepers']]) {
  const s = sure.filter(r => r.type === t), y = yes.filter(r => r.type === t);
  const from = `words flagged ${s.filter(r => r.g === 'flagged').length}, left open ${s.filter(r => r.g === 'open').length}; ${new Set(s.map(r => r.city)).size} metros`;
  console.log(`  ${name.padEnd(20)} confident ${String(s.length).padStart(3)} ${sum(s).padStart(8)} (${from}) | with best readings ${y.length} ${sum(y)} in ${new Set(y.map(r => r.city)).size} metros`);
}
const perMetro = {};
for (const r of sure) perMetro[r.city] = (perMetro[r.city] || 0) + 1;
const per = Object.values(perMetro);
console.log(`  together             confident ${sure.length} ${sum(sure)} | with best readings ${yes.length} ${sum(yes)}`);
console.log(`  confident: no brand in title or photo ${sure.filter(r => !r.brand).length}; asked $20 or less ${sure.filter(r => usd(r.price) <= 20).length}; per metro ${Math.min(...per)} to ${Math.max(...per)} in ${per.length} metros`);
const wordYes = Object.values(sets.flagged).filter(l => l.is_it === 'yes');
console.log(`  word rules: ${wordYes.length} of ${Object.keys(sets.flagged).length} flagged were the type (${wordYes.filter(l => l.sure).length} confident)`);

const blind = read('census-fb-blind-labels.json');
const agree = blind.order.filter((id, i) => (sets.open[id].type === 'inclined_sleeper') === (blind.labels[String(i + 1)].kind === 'inclined')).length;
console.log(`\nBlind second review (photos only): agreed on ${agree} of ${blind.order.length}`);

const SETS = [['census-fb-inclined', 'inclined sleepers the words left open'], ['census-fb-rockers', 'random other "baby rocker sleeper" results']];
for (const [name, what] of SETS) {
  const rows = rowsOf(`${name}-results-hybrid.json`);
  const flagged = rows.filter(r => r.final === 'likely' || r.final === 'possible');
  const idOf = r => (r.recall && (r.recall.id || r.recall)) || '';
  const by = {};
  for (const r of flagged) { const k = r.kind === 'recall' ? `recall ${idOf(r)}` : 'banned type'; by[k] = (by[k] || 0) + 1; }
  const n = f => rows.filter(f).length;
  console.log(`\nHybrid on ${rows.length} ${what}: flagged ${flagged.length} (red ${n(r => r.final === 'likely')}, amber ${n(r => r.final === 'possible')}), cleared ${rows.length - flagged.length}`);
  console.log(`  cloud asked on ${n(r => r.cloud)}, Gemini Nano looked at ${n(r => r.usedDevice)}, sent on by the unnamed-sleep rule ${n(r => r.unnamedSleep)}, errors ${n(r => r.error || r.cloudError)}`);
  console.log(`  ${Object.entries(by).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  if (name !== 'census-fb-inclined') continue;
  for (const r of rows) {
    const l = sets.open[r.id];
    console.log(`    ${(r.final || 'none').padEnd(8)} ${String(r.kind === 'recall' ? idOf(r) : r.kind || '').padEnd(8)} ${r.title.slice(0, 34).padEnd(34)} reviewer saw: ${l.brand || 'no brand'}${l.sure ? '' : ' (best reading)'}`);
  }
}
