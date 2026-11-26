// A person's blind check of the 34 Facebook photos (docs/accuracy.md, section 37), beside the AI reviewers' labels
// and what the hybrid did. Answers: tools/census-fb-sleepers-review.json (from tools/label-review.html).
// Usage: node tools/census-fb-person.mjs
import { readFileSync } from 'node:fs';
const read = f => JSON.parse(readFileSync(`tools/${f}`, 'utf8'));
const { answers, updated } = read('census-fb-sleepers-review.json');
const ai = read('census-fb-sleepers-labels.json').labels;
const order = read('census-fb-blind.json').order;
const sure = { ...read('census-facebook-open-labels.json').labels, ...read('census-facebook-labels.json').labels };
const hybrid = Object.fromEntries(['inclined', 'rockers'].flatMap(s => read(`census-fb-${s}-results-hybrid.json`).rows).map(r => [r.id, r.final !== 'none']));
const n = f => order.filter(f).length;
const P = id => answers[id] === 'yes', A = id => ai[id].is_it === 'yes';
const agree = n(id => P(id) === A(id)), pe = (n(P) * n(A) + n(id => !P(id)) * n(id => !A(id))) / order.length ** 2;
console.log(`checked ${updated.slice(0, 10)}: ${Object.keys(answers).length} of ${order.length} answered, ${n(id => answers[id] === 'maybe')} "can't tell"`);
console.log(`person: ${n(P)} inclined sleepers, ${n(id => !P(id))} not; AI reviewers: ${n(A)} and ${n(id => !A(id))}`);
console.log(`same answer: ${agree} of ${order.length} (kappa ${((agree / order.length - pe) / (1 - pe)).toFixed(2)})`);
console.log(`  of the AI's ${n(A)} inclined sleepers the person agreed on ${n(id => A(id) && P(id))}; of its ${n(id => !A(id))} others, on ${n(id => !A(id) && !P(id))}`);
console.log(`both say inclined sleeper: ${n(id => A(id) && P(id))} (${n(id => A(id) && P(id) && sure[id].sure)} of them confident AI calls); hybrid flagged ${n(id => A(id) && P(id) && hybrid[id])}`);
console.log(`both say not one: ${n(id => !A(id) && !P(id))}; hybrid flagged ${n(id => !A(id) && !P(id) && hybrid[id])}`);
console.log(`by the person's answers: hybrid flagged ${n(id => P(id) && hybrid[id])} of ${n(P)} inclined sleepers and ${n(id => !P(id) && hybrid[id])} of ${n(id => !P(id))} others`);
console.log(`by the AI's answers:     hybrid flagged ${n(id => A(id) && hybrid[id])} of ${n(A)} inclined sleepers and ${n(id => !A(id) && hybrid[id])} of ${n(id => !A(id))} others`);
console.log(`person yes, AI no (${n(id => P(id) && !A(id))}): ${order.filter(id => P(id) && !A(id)).map(id => ai[id].why).join('; ')}`);
console.log(`person no, AI yes (${n(id => !P(id) && A(id))}): ${order.filter(id => !P(id) && A(id)).map(id => ai[id].why).join('; ')}`);
