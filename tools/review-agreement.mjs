// How often a person agreed with the AI reviewers' labels, for every set someone has reviewed in
// tools/label-review.html (answers in tools/<set>-review.json). This is the number to publish once a person has
// looked: until then every label in this project is an AI's.
//   agree  the AI label is right          yes / no  the person would label it the other way
//   maybe  the person can't tell from the title and photo
// Usage: node tools/review-agreement.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = f => JSON.parse(readFileSync(`tools/${f}`, 'utf8'));
const sets = readdirSync('tools').filter(f => /-review\.json$/.test(f)).map(f => f.replace(/-review\.json$/, ''));
if (!sets.length) { console.log('No reviews yet. Open tools/label-review.html (with node tools/collector.mjs running) to start.'); process.exit(0); }
for (const set of sets) {
  const { answers = {}, reviewer = '?', updated = '' } = read(`${set}-review.json`);
  // The AI's own call for each reviewed listing, to tell which way a disagreement went.
  let ai = {};
  if (set.startsWith('census-')) {
    const labels = read(`${set}-labels.json`).labels;
    ai = Object.fromEntries(Object.entries(labels).map(([id, l]) => [id, l.is_it === 'yes' ? 'yes' : l.is_it === 'no' ? 'no' : 'maybe']));
  } else {
    for (const f of readdirSync('tools').filter(f => f.startsWith(`${set}-labels`) && f.endsWith('.json'))) Object.assign(ai, Object.fromEntries(Object.entries(read(f).labels).map(([id, l]) => [id, l.should_warn])));
    if (set === 'eval' && existsSync('tools/eval-labels.json')) Object.assign(ai, Object.fromEntries(Object.entries(read('eval-labels.json').labels).map(([id, l]) => [id, l.should_warn])));
  }
  const n = { agree: 0, flip: 0, maybe: 0 };
  const byAi = { yes: { n: 0, agree: 0 }, no: { n: 0, agree: 0 }, maybe: { n: 0, agree: 0 } };
  for (const [id, a] of Object.entries(answers)) {
    const was = ai[id] || 'maybe';
    const agreed = a === 'agree' || a === was;
    if (a === 'maybe') n.maybe++; else if (agreed) n.agree++; else n.flip++;
    byAi[was].n++; if (agreed) byAi[was].agree++;
  }
  const total = n.agree + n.flip + n.maybe;
  const pct = x => total ? `${Math.round(100 * x / total)}%` : '-';
  console.log(`${set}: ${total} reviewed by ${reviewer} (${updated.slice(0, 10)}): agreed ${n.agree} (${pct(n.agree)}), would change ${n.flip}, can't tell ${n.maybe}`);
  for (const [k, v] of Object.entries(byAi)) if (v.n) console.log(`  AI said ${k}: ${v.agree} of ${v.n} agreed`);
}
