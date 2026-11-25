// Scores the hybrid on the census (docs/accuracy.md, section 32): a fixed random 70 of the listings an AI reviewer
// counted (tools/census-sample-listings.json) and a fixed random 30 of the ones it ruled out
// (tools/census-sample-no-listings.json), each run through the extension's own pipeline with Gemini Nano
// (node tools/eval-run.mjs --set=census-sample --mode=hybrid, and --set=census-sample-no).
// Usage: node tools/census-hybrid-score.mjs
import { readFileSync, existsSync } from 'node:fs';
const read = f => JSON.parse(readFileSync(`tools/${f}`, 'utf8'));
const BRAND = /dock ?a ?tot|snuggle ?me|boppy|la-?la-?me|snuggle nest|halo|baby delight|chicco|sleepyhead|sleepy head|rahoo|mamibaby|yoocaa|cosy nation|pillani|bluesnail|frida|leachco|summer infant|fisher|graco|oxo/i;
const tally = rows => {
  const t = { n: rows.length, likely: 0, possible: 0, none: 0, errors: 0, cloud: 0, device: 0, lookups: 0 };
  for (const r of rows) {
    t[r.final === 'likely' ? 'likely' : r.final === 'possible' ? 'possible' : 'none']++;
    if (r.cloud) t.cloud++;
    if (r.usedDevice) t.device++;
    if ((r.lookups || []).length) t.lookups++;
    if (r.error || r.cloudError) t.errors++;
  }
  return t;
};
for (const [name, label] of [['census-sample', 'counted by the AI reviewer (should be flagged)'], ['census-sample-no', 'ruled out by the AI reviewer (should not be flagged)']]) {
  if (!existsSync(`tools/${name}-results-hybrid.json`)) { console.log(`${name}: not run`); continue; }
  const run = read(`${name}-results-hybrid.json`);
  const rows = run.rows, t = tally(rows);
  console.log(`\n${name}${run.partial ? ' (PARTIAL)' : ''}: ${t.n} listings ${label}`);
  console.log(`  flagged ${t.likely + t.possible} (likely ${t.likely}, possible ${t.possible}), cleared ${t.none}; looked at by Gemini Nano ${t.device}, sent to the cloud ${t.cloud}, cloud asked the device ${t.lookups}, errors ${t.errors}`);
  if (name === 'census-sample') {
    const plain = rows.filter(r => !BRAND.test(r.title));
    const p = tally(plain);
    console.log(`  no brand word in the title: ${p.n}; flagged ${p.likely + p.possible} (likely ${p.likely}, possible ${p.possible})`);
    for (const r of rows.filter(r => r.final !== 'likely')) console.log(`    not red: ${r.final} | ${r.title.slice(0, 70)} | ${String(r.why || r.error || r.cloudError).slice(0, 90)}`);
  } else {
    for (const r of rows.filter(r => r.final !== 'none')) console.log(`    still flagged: ${r.final} ${r.kind || ''} | ${r.title.slice(0, 70)} | ${String(r.why).slice(0, 90)}`);
  }
}
