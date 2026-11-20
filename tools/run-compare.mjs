// Compares two runs of the four accuracy tests, by their file tags. Counts only.
//   node tools/run-compare.mjs --a=-rerun --b=-r5 [--sets=eval,fresh]    (a: the earlier run; "" is the first, blind runs)
// Writes tools/run-compare<b>.json: totals for each run, the listings that changed between flagged and not, and what
// the device's own lookup did in run b (shared/lookup.mjs deviceLookup: a brand the built-in model gave for the photo).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const opt = (k, d) => { const v = process.argv.find(a => a.startsWith(`--${k}=`)); return v ? v.slice(k.length + 3) : d; };
const A = opt('a', '-rerun'), B = opt('b', '-r5');
const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const flagged = l => l === 'possible' || l === 'likely';
const labelFiles = { eval: ['eval-labels.json'], fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'], third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'], fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'] };
const blank = () => ({ caught: 0, falseAlarms: 0, softFalseAlarms: 0, cloud: 0, words: { caught: 0, falseAlarms: 0 }, device: { caught: 0, falseAlarms: 0 }, lookups: 0, lookupFound: 0, shownViaLookup: 0 });
const sum = { listings: 0, mustFlag: 0, mustNot: 0, a: blank(), b: blank() };
// The device's own lookup in run b.
const seen = { gaveABrandNotInTheWords: 0, foundARecall: 0, sentToCloudOnlyForIt: 0, cloudTookItUp: 0, cloudNamedAnother: 0, shown: 0, shownOnShouldFlag: 0, shownOnShouldNot: 0, brands: {} };
const out = { at: new Date().toISOString(), a: A || '(first runs)', b: B, sets: {}, total: null, seen, changes: [], falseAlarmsB: [], missedB: [] };
const only = opt('sets', '').split(',').filter(Boolean);
out.sets_compared = only.length ? only : Object.keys(labelFiles);
for (const [set, files] of Object.entries(labelFiles).filter(([s]) => !only.length || only.includes(s))) {
  const labels = Object.assign({}, ...files.filter(f => existsSync(new URL(`./${f}`, import.meta.url))).map(f => read(`./${f}`).labels));
  const rowsA = new Map(read(`./${set}-results-hybrid${A}.json`).rows.map(r => [r.id, r]));
  const rowsB = read(`./${set}-results-hybrid${B}.json`).rows;
  const wordsA = new Map((existsSync(new URL(`./${set}-results-words${A}.json`, import.meta.url)) ? read(`./${set}-results-words${A}.json`).rows : []).map(r => [r.id, r]));
  const wordsB = new Map(read(`./${set}-results-words${B}.json`).rows.map(r => [r.id, r]));
  const s = { listings: 0, mustFlag: 0, mustNot: 0, a: { caught: 0, falseAlarms: 0, cloud: 0 }, b: { caught: 0, falseAlarms: 0, cloud: 0 } };
  for (const b of rowsB) {
    const label = (labels[b.id] || {}).should_warn, a = rowsA.get(b.id);
    if (!label || !a) continue;
    s.listings++; sum.listings++;
    for (const [k, r, w] of [['a', a, wordsA.get(b.id)], ['b', b, wordsB.get(b.id)]]) {
      const dev = ['possible', 'likely'].includes(r.device), wf = flagged((w || {}).final);
      if (r.cloud) { s[k].cloud++; sum[k].cloud++; }
      if ((r.lookups || []).length) sum[k].lookups++;
      if ((r.lookups || []).some(l => l.found.length)) sum[k].lookupFound++;
      if (r.lookedUp || r.also) sum[k].shownViaLookup++;
      if (label === 'yes') { if (flagged(r.final)) { s[k].caught++; sum[k].caught++; } if (wf) sum[k].words.caught++; if (dev) sum[k].device.caught++; }
      if (label === 'no') { if (flagged(r.final)) { s[k].falseAlarms++; sum[k].falseAlarms++; if (r.final === 'possible') sum[k].softFalseAlarms++; } if (wf) sum[k].words.falseAlarms++; if (dev) sum[k].device.falseAlarms++; }
    }
    if (label === 'yes') { s.mustFlag++; sum.mustFlag++; if (!flagged(b.final)) out.missedB.push({ set, title: b.title.slice(0, 90), device: b.device, cloud: !!b.cloud, why: (b.why || '').slice(0, 120) }); }
    if (label === 'no') { s.mustNot++; sum.mustNot++; if (flagged(b.final)) out.falseAlarmsB.push({ set, title: b.title.slice(0, 90), level: b.final, kind: b.kind, recall: b.recall, seen: b.seen || null, lookedUp: !!(b.lookedUp || b.also), why: (b.why || '').slice(0, 120) }); }
    if (b.seen) {
      seen.foundARecall++;
      seen.brands[b.seen.brand] = (seen.brands[b.seen.brand] || 0) + 1;
      if (b.device === 'ask') seen.sentToCloudOnlyForIt++;
      const via = b.recall && b.lookedUp ? b.recall : b.also;
      if (via === b.seen.id) { seen.cloudTookItUp++; seen.shown++; if (label === 'yes') seen.shownOnShouldFlag++; if (label === 'no') seen.shownOnShouldNot++; }
      else if (via) { seen.cloudNamedAnother++; seen.shown++; if (label === 'yes') seen.shownOnShouldFlag++; if (label === 'no') seen.shownOnShouldNot++; }
    }
    if (flagged(a.final) !== flagged(b.final) && label !== 'maybe') {
      out.changes.push({ set, label, title: b.title.slice(0, 90), a: `${a.final}${a.kind ? ' ' + a.kind : ''}`, b: `${b.final}${b.kind ? ' ' + b.kind : ''}${b.recall ? ' ' + b.recall : ''}`,
        better: (label === 'yes') === flagged(b.final), deviceA: a.device, deviceB: b.device, cloudA: !!a.cloud, cloudB: !!b.cloud, seen: b.seen || null, lookedUp: !!(b.lookedUp || b.also), why: (b.why || '').slice(0, 140) });
    }
  }
  out.sets[set] = s;
}
out.total = { ...sum, shareSentToCloudA: +(sum.a.cloud / sum.listings).toFixed(3), shareSentToCloudB: +(sum.b.cloud / sum.listings).toFixed(3) };
writeFileSync(new URL(`./run-compare${B}.json`, import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.total));
console.log('sets', JSON.stringify(out.sets));
console.log('device lookup', JSON.stringify(seen));
console.log(`changed between flagged and not: ${out.changes.length} (better ${out.changes.filter(c => c.better).length}, worse ${out.changes.filter(c => !c.better).length})`);
for (const c of out.changes) console.log(`  ${c.better ? 'better' : 'WORSE '} ${c.label.padEnd(3)} ${c.a} -> ${c.b} | ${c.title.slice(0, 70)}${c.seen ? ' | seen ' + c.seen.brand : ''}`);
console.log('false alarms in b:');
for (const f of out.falseAlarmsB) console.log(`  ${f.level} ${f.kind} ${f.recall || ''} | ${f.title.slice(0, 70)}${f.seen ? ' | seen ' + f.seen.brand : ''}${f.lookedUp ? ' | via lookup' : ''}`);
