// Scores the accuracy test. Reads the blind labels (tools/eval-labels.json) and the engine's answers
// (tools/eval-results-words.json, tools/eval-results-hybrid.json) and writes tools/eval-report.json plus a table.
// Nothing here changes the rules: it only counts.
//
// Usage: node tools/eval-score.mjs [--set=eval|fresh|third]
//   eval   the first test: 136 eBay listings, collected after the rules were written
//   fresh  the second test: 125 eBay and Craigslist listings, collected after the fixes the first test led to
//   third  the third test: 176 eBay, Mercari and Craigslist listings, collected after the fixes the second test led to
//   fourth the fourth test: 160 eBay and Craigslist listings, collected after every recall since 1973 was added
//   fifth  the fifth test: 178 eBay and Craigslist listings, collected for release 0.12.0 and run once on its engine
// Where a person has reviewed a label (tools/label-review.html -> tools/<set>-review.json), their answer is used.
//
// Three ways of running the same engine on the same held-out listings:
//   words only      no model at all (what a computer without Chrome's built-in model gets with the cloud off)
//   on-device only  words, then Chrome's built-in model on the listings that need a look; nothing leaves the computer
//   hybrid          the same, then the cloud double-checks only what the on-device model flagged
// A listing counts as flagged at "possible" or "likely". Labels: should_warn yes = must flag, no = must not,
// maybe = the listing alone can't settle it (scored separately, either answer is acceptable).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const has = f => existsSync(new URL(f, import.meta.url));
const set = (process.argv.find(a => a.startsWith('--set=')) || '--set=eval').slice(6);
const labelFiles = {
  eval: ['./eval-labels.json'],
  fresh: ['./fresh-labels-ebay.json', './fresh-labels-craigslist.json'],
  third: ['./third-labels-a.json', './third-labels-b.json', './third-labels-c.json'],
  fourth: ['./fourth-labels-a.json', './fourth-labels-b.json', './fourth-labels-c.json'],
  fifth: ['./fifth-labels-a.json', './fifth-labels-b.json', './fifth-labels-c.json'],
}[set].filter(has);
const labelSets = labelFiles.map(read);
const labels = Object.assign({}, ...labelSets.map(x => x.labels));
let labeller = labelSets[0].labeller;
// A person's answer overrides the AI label: "agree" keeps it; yes / no / maybe replace should_warn.
if (has(`./${set}-review.json`)) {
  const { answers } = read(`./${set}-review.json`);
  let changed = 0;
  for (const [id, a] of Object.entries(answers)) {
    if (!labels[id] || a === 'agree') continue;
    if (labels[id].should_warn !== a) changed++;
    labels[id] = { ...labels[id], should_warn: a, note: `${labels[id].note} [person: ${a}]` };
  }
  labeller += `; ${Object.keys(answers).length} labels checked by a person, ${changed} changed`;
}
// --tag=-rerun scores a later run of the same test, saved beside the first one (tools/eval-run.mjs --tag).
const tag = (process.argv.find(a => a.startsWith('--tag=')) || '--tag=').slice(6);
const words = read(`./${set}-results-words${tag}.json`).rows;
const hybrid = has(`./${set}-results-hybrid${tag}.json`) ? read(`./${set}-results-hybrid${tag}.json`) : null;
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

const report = { set, labeller, listings: ids.length, mustFlag: pos.length, mustNotFlag: neg.length, unclear: maybe.length, systems: {} };
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
// The same results in a shopper's units: asking prices of the listings that should be flagged, and of those caught.
const listingById = new Map(Object.values(read(`./${set}-listings.json`)).flat().map(l => [l.id, l]));
const dollars = list => +list.reduce((t, id) => t + (parseFloat(String((listingById.get(id) || {}).price || '').replace(/[$,]/g, '')) || 0), 0).toFixed(2);
report.askingPrices = { mustFlag: dollars(pos) };
for (const [name, answers] of Object.entries(systems)) report.askingPrices[name] = dollars(pos.filter(id => flagged(answers.get(id).level)));
report.bySite = {};
for (const id of ids) {
  const site = (listingById.get(id) || {}).site || 'ebay';
  const b = report.bySite[site] ||= { listings: 0, mustFlag: 0 };
  b.listings++;
  if (labels[id].should_warn === 'yes') b.mustFlag++;
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
if (tag) report.run = tag.replace(/^-/, '');
writeFileSync(new URL(`./${set}-report${tag}.json`, import.meta.url), JSON.stringify(report, null, 1));

console.log(`${ids.length} listings: ${pos.length} must be flagged, ${neg.length} must not, ${maybe.length} unclear from the listing alone`);
console.log('| | caught | missed | false alarms | precision |');
console.log('|---|---|---|---|---|');
for (const [name, s] of Object.entries(report.systems)) console.log(`| ${name} | ${s.caught}/${pos.length} | ${s.missed.length} | ${s.falseAlarms.length}/${neg.length} | ${s.precision ?? '-'} |`);
if (report.cost) console.log('cost:', JSON.stringify(report.cost));
console.log('asking prices:', JSON.stringify(report.askingPrices), 'by site:', JSON.stringify(report.bySite));
