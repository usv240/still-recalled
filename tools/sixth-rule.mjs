import { readFileSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage, namesKnownBrand } from '../shared/triage.mjs';
import { bannedHints, mayContain } from '../shared/banned.mjs';
const { cards } = JSON.parse(readFileSync('extension/data/cards.json', 'utf8'));
const idx = buildIndex(cards);
const labels = Object.assign({}, ...['a','b','c'].map(k => JSON.parse(readFileSync(`tools/sixth-labels-${k}.json`,'utf8')).labels));
const rows = JSON.parse(readFileSync('tools/sixth-results-hybrid.json','utf8')).rows;
const fl = l => l === 'possible' || l === 'likely';
let sent = 0, sentByRule = 0, flagged = 0; const out = {yes:0,no:0,maybe:0}, fa = [];
for (const r of rows) {
  const t = triage(idx, r);
  if (!t.unnamedSleep) continue;
  sent++;
  // The rule changes only listings the device cleared on its own.
  const byRule = r.device === 'none' && !!r.cloud;
  if (byRule) { sentByRule++; const lab = (labels[r.id]||{}).should_warn; out[lab]++; if (fl(r.final)) { flagged++; if (lab !== 'yes') fa.push(`${lab} ${r.final} ${r.banned||r.recall} | ${r.title.slice(0,60)}`); } }
}
console.log({ triagedUnnamedSleep: sent, sentByRuleToCloud: sentByRule, labels: out, flaggedByRule: flagged }); fa.forEach(x => console.log('  ', x));
const miss = rows.find(x => /Happiness Baby Safety/.test(x.title));
const t = triage(idx, miss); console.log('miss:', { needsEyes: t.needsEyes, cand: !!t.candidate, hints: t.hints.map(h=>h.key), maybe: t.maybe.map(m=>m.key||m), brand: namesKnownBrand(idx, miss.title), unnamedSleep: t.unnamedSleep });
