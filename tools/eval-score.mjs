// Scores the accuracy test. Reads the blind labels (tools/eval-labels.json) and the engine's answers
// (tools/eval-results-words.json, tools/eval-results-hybrid.json) and writes tools/eval-report.json plus a table.
// Nothing here changes the rules: it only counts.
//
// Three ways of running the same engine on the same 136 held-out eBay listings:
//   words only      no model at all (what a computer without Chrome's built-in model gets with the cloud off)
//   on-device only  words, then Chrome's built-in model on the listings that need a look; nothing leaves the computer
//   hybrid          the same, then the cloud double-checks only what the on-device model flagged
// A listing counts as flagged at "possible" or "likely". Labels: should_warn yes = must flag, no = must not,
// maybe = the listing alone can't settle it (scored separately, either answer is acceptable).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const { labels, labeller } = read('./eval-labels.json');
const words = read('./eval-results-words.json').rows;
const hybrid = existsSync(new URL('./eval-results-hybrid.json', import.meta.url)) ? read('./eval-results-hybrid.json') : null;
if (hybrid && hybrid.partial) console.log('NOTE: hybrid results are partial');

const flagged = level => level === 'possible' || level === 'likely';
const deviceOnly = r => (['possible', 'likely'].includes(r.device) ? r.device : 'none');
const systems = {
  'words only': new Map(words.map(r => [r.id, { level: r.final }])),
  ...(hybrid ? {
    'on-device only': new Map(hybrid.rows.map(r => [r.id, { level: deviceOnly(r) }])),
    hybrid: new Map(hybrid.rows.map(r => [r.id, { level: r.final }])),
  } : {}),
};

const ids = Object.keys(labels).filter(id => systems['words only'].has(id) && (!hybrid || systems.hybrid.has(id)));
const pos = ids.filter(id => labels[id].should_warn === 'yes');
const neg = ids.filter(id => labels[id].should_warn === 'no');
const maybe = ids.filter(id => labels[id].should_warn === 'maybe');
const title = id => (words.find(r => r.id === id) || {}).title || id;

const report = { labeller, listings: ids.length, mustFlag: pos.length, mustNotFlag: neg.length, unclear: maybe.length, systems: {} };
for (const [name, answers] of Object.entries(systems)) {
  const hit = id => flagged(answers.get(id).level);
  const caught = pos.filter(hit), missed = pos.filter(id => !hit(id));
  const falseAlarms = neg.filter(hit);
  const flags = ids.filter(hit);
  report.systems[name] = {
    caught: caught.length, missed: missed.map(id => ({ id, title: title(id), why: labels[id].note })),
    falseAlarms: falseAlarms.map(id => ({ id, title: title(id), level: answers.get(id).level, why: labels[id].note })),
    flagged: flags.length, unclearFlagged: maybe.filter(hit).length,
    recallRate: pos.length ? +(caught.length / pos.length).toFixed(3) : null,
    precision: (caught.length + falseAlarms.length) ? +(caught.length / (caught.length + falseAlarms.length)).toFixed(3) : null,
  };
}
if (hybrid) {
  const rows = hybrid.rows;
  const ms = rows.map(r => r.ms).sort((a, b) => a - b);
  report.cost = {
    listings: rows.length,
    checkedByWordsOnly: rows.filter(r => !r.usedDevice).length,
    lookedAtOnDevice: rows.filter(r => r.usedDevice).length,
    sentToCloud: rows.filter(r => r.cloud).length,
    cloudErrors: rows.filter(r => r.cloudError).length,
    shareSentToCloud: +(rows.filter(r => r.cloud).length / rows.length).toFixed(3),
    medianMs: ms[Math.floor(ms.length / 2)], totalMinutes: +((hybrid.totalMs || 0) / 60000).toFixed(1),
  };
}
writeFileSync(new URL('./eval-report.json', import.meta.url), JSON.stringify(report, null, 1));

console.log(`${ids.length} listings: ${pos.length} must be flagged, ${neg.length} must not, ${maybe.length} unclear from the listing alone`);
console.log('| | caught | missed | false alarms | precision |');
console.log('|---|---|---|---|---|');
for (const [name, s] of Object.entries(report.systems)) console.log(`| ${name} | ${s.caught}/${pos.length} | ${s.missed.length} | ${s.falseAlarms.length}/${neg.length} | ${s.precision ?? '-'} |`);
if (report.cost) console.log('cost:', JSON.stringify(report.cost));
