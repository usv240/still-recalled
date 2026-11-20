// Compares the re-run of the four accuracy tests on the current engine (tools/<set>-results-*-rerun.json, made by
// tools/rerun-all.sh) with the first, blind runs. Counts only; writes tools/rerun-compare.json and prints a summary.
//   node tools/rerun-compare.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const flagged = l => l === 'possible' || l === 'likely';
const labelFiles = { eval: ['eval-labels.json'], fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'], third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'], fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'] };
const out = { at: new Date().toISOString(), sets: {}, total: {}, changes: [] };
const sum = { listings: 0, mustFlag: 0, mustNot: 0, first: { caught: 0, falseAlarms: 0, cloud: 0 }, rerun: { caught: 0, falseAlarms: 0, cloud: 0, words: { caught: 0, falseAlarms: 0 }, device: { caught: 0, falseAlarms: 0 }, lookups: 0, lookupFound: 0, shownViaLookup: 0 } };
for (const [set, files] of Object.entries(labelFiles)) {
  const labels = Object.assign({}, ...files.filter(f => existsSync(new URL(`./${f}`, import.meta.url))).map(f => read(`./${f}`).labels));
  const first = new Map(read(`./${set}-results-hybrid.json`).rows.map(r => [r.id, r]));
  const again = read(`./${set}-results-hybrid-rerun.json`).rows;
  const words = new Map(read(`./${set}-results-words-rerun.json`).rows.map(r => [r.id, r]));
  const s = { listings: 0, mustFlag: 0, mustNot: 0, first: { caught: 0, falseAlarms: 0, cloud: 0 }, rerun: { caught: 0, falseAlarms: 0, cloud: 0 } };
  for (const r of again) {
    const label = (labels[r.id] || {}).should_warn, f = first.get(r.id);
    if (!label || !f) continue;
    s.listings++; sum.listings++;
    const dev = ['possible', 'likely'].includes(r.device), w = flagged((words.get(r.id) || {}).final);
    if (f.cloud) { s.first.cloud++; sum.first.cloud++; }
    if (r.cloud) { s.rerun.cloud++; sum.rerun.cloud++; }
    if ((r.lookups || []).length) sum.rerun.lookups++;
    if ((r.lookups || []).some(l => l.found.length)) sum.rerun.lookupFound++;
    if (r.lookedUp || r.also) sum.rerun.shownViaLookup++;
    if (label === 'yes') {
      s.mustFlag++; sum.mustFlag++;
      if (flagged(f.final)) { s.first.caught++; sum.first.caught++; }
      if (flagged(r.final)) { s.rerun.caught++; sum.rerun.caught++; }
      if (w) sum.rerun.words.caught++;
      if (dev) sum.rerun.device.caught++;
    } else if (label === 'no') {
      s.mustNot++; sum.mustNot++;
      if (flagged(f.final)) { s.first.falseAlarms++; sum.first.falseAlarms++; }
      if (flagged(r.final)) { s.rerun.falseAlarms++; sum.rerun.falseAlarms++; }
      if (w) sum.rerun.words.falseAlarms++;
      if (dev) sum.rerun.device.falseAlarms++;
    }
    if (flagged(f.final) !== flagged(r.final) && label !== 'maybe') {
      out.changes.push({ set, label, title: r.title.slice(0, 90), first: `${f.final}${f.kind ? ' ' + f.kind : ''}`, rerun: `${r.final}${r.kind ? ' ' + r.kind : ''}${r.recall ? ' ' + r.recall : ''}`,
        better: (label === 'yes') === flagged(r.final), deviceFirst: f.device, deviceRerun: r.device, cloudFirst: !!f.cloud, cloudRerun: !!r.cloud, lookedUp: !!(r.lookedUp || r.also), warning: /^W/.test(r.recall || ''), why: (r.why || '').slice(0, 110), evidence: (r.evidence || '').slice(0, 140) });
    }
  }
  out.sets[set] = s;
}
out.total = { ...sum, rerunShareSentToCloud: +(sum.rerun.cloud / sum.listings).toFixed(3), firstShareSentToCloud: +(sum.first.cloud / sum.listings).toFixed(3) };
writeFileSync(new URL('./rerun-compare.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.total));
console.log(`changed between flagged and not: ${out.changes.length} (better ${out.changes.filter(c => c.better).length}, worse ${out.changes.filter(c => !c.better).length})`);
