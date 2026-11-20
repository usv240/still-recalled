// Development only: a test set checked one listing at a time, the way the web page and the Android app check a
// listing on a device without a built-in model: the look runs in the cloud (the lightest model first), the device's
// own lookup runs on the brand the look gave, and every baby product then gets the cloud's confirmation, which may
// call lookup_recalls. The extension's results for the same set are in tools/<set>-results-hybrid.json; this is the
// other path. Scores against the set's labels and saves tools/<set>-results-single.json.
//   node tools/single-run.mjs --for=fifth [--limit=40]      (stops and resumes: finished rows are kept)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage, wordsOnlyAnswer } from '../shared/triage.mjs';
import { decide } from '../shared/judge.mjs';
import { applyDeviceLookup } from '../shared/lookup.mjs';
import { confirm, look } from './lookup-run.mjs';

const opt = (k, d = '') => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
// "--for", not "--set": tools/lookup-run.mjs, imported above, runs its own test when it sees "--set".
const set = opt('for', 'fifth');
const read = f => JSON.parse(readFileSync(`tools/${f}`, 'utf8'));
const LABELS = { eval: ['eval-labels.json'], fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'], third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'], fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'], fifth: ['fifth-labels-a.json', 'fifth-labels-b.json', 'fifth-labels-c.json'] }[set];
const labels = Object.assign({}, ...LABELS.filter(f => existsSync(`tools/${f}`)).map(f => read(f).labels));
const { cards } = JSON.parse(readFileSync('extension/data/cards.json', 'utf8'));
const index = buildIndex(cards);
const listings = Object.values(read(`${set}-listings.json`)).flat().slice(0, Number(opt('limit', '9999')));
const outFile = `tools/${set}-results-single.json`;
const prior = existsSync(outFile) ? read(`${set}-results-single.json`).rows.filter(r => !r.error) : [];
const done = new Map(prior.map(r => [r.id, r]));
const rows = [...prior];

async function one(l) {
  if (done.has(l.id)) return;
  const listing = { title: l.title, description: l.description || '', price: l.price || '' };
  const t = triage(index, listing);
  const row = { id: l.id, title: l.title, label: (labels[l.id] || {}).should_warn || '?', words: t.candidate ? `${t.candidate.card.id} ${t.candidate.strength}` : t.hints.length ? `type: ${t.hints[0].key}` : t.needsEyes ? 'baby product' : 'nothing' };
  const t0 = Date.now();
  try {
    if (!t.needsEyes) Object.assign(row, { final: 'none', kind: null, cloud: false });
    else {
      const answer = await look(listing, t, l.image).catch(() => null);
      let device = decide(answer || wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe), seen = null;
      if (answer) ({ device, seen } = applyDeviceLookup(index, listing, answer, t.candidate, device));
      // Every baby product gets the cloud's look here, unless the first look calls it a part or a toy.
      if (!/part or a toy/.test(device.why || '')) device = { ...device, secondOpinion: true };
      const needsCloud = !(device.level === 'none' && !device.askCloud && !device.secondOpinion);
      Object.assign(row, { look: answer ? 'cloud' : 'failed', brandGiven: (answer && answer.brand_seen) || '', seen, device: device.level === 'none' && device.askCloud ? 'ask' : device.level });
      if (!needsCloud) Object.assign(row, { final: device.level, kind: device.kind, cloud: false });
      else {
        const r = await confirm(listing, device, t.hints, l.image, seen);
        const shown = r.final.card || r.final.alsoRecall || null;
        Object.assign(row, { final: r.final.level, kind: r.final.level === 'none' ? null : r.final.kind, cloud: true, model: r.model, recall: r.final.kind === 'recall' && r.final.card ? r.final.card.id : null, also: r.final.alsoRecall ? r.final.alsoRecall.id : null,
          lookedUp: !!r.final.lookedUp, lookups: r.lookups, matches: r.answer.matches_recall, evidence: (r.answer.evidence || '').slice(0, 200), why: r.final.why || '', shown: shown ? shown.id : null });
      }
    }
  } catch (e) { row.error = String(e).slice(0, 200); }
  row.ms = Date.now() - t0;
  rows.push(row);
  const flag = row.final === 'possible' || row.final === 'likely';
  console.log(`${String(rows.length).padStart(3)} ${row.label.padEnd(5)} ${String(row.final || 'ERROR').padEnd(8)} ${(row.kind || '-').padEnd(6)} ${String(row.recall || row.also || '').padEnd(8)} ${flag !== (row.label === 'yes') && row.label !== 'maybe' ? '<<' : '  '} ${l.title.slice(0, 60)}${row.error ? ' ERR ' + row.error : ''}`);
  if (rows.length % 10 === 0) writeFileSync(outFile, JSON.stringify({ partial: true, rows }, null, 1));
}
const queue = [...listings];
await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await one(queue.shift()); }));

const ok = rows.filter(r => !r.error), flagged = r => r.final === 'possible' || r.final === 'likely';
const yes = ok.filter(r => r.label === 'yes'), no = ok.filter(r => r.label === 'no'), maybe = ok.filter(r => r.label === 'maybe');
const summary = { set, listings: rows.length, errors: rows.length - ok.length, mustFlag: yes.length, caught: yes.filter(flagged).length, mustNot: no.length, falseAlarms: no.filter(flagged).length,
  softFalseAlarms: no.filter(r => r.final === 'possible').length, unclear: maybe.length, unclearFlagged: maybe.filter(flagged).length, sentToCloud: ok.filter(r => r.cloud).length,
  cloudCalledLookup: ok.filter(r => (r.lookups || []).length).length, lookupFoundARecall: ok.filter(r => (r.lookups || []).some(x => x.found.length)).length, shownViaLookup: ok.filter(r => r.lookedUp || r.also).length,
  lookGaveABrandNotInTheWords: ok.filter(r => r.seen).length, medianMs: ok.filter(r => r.cloud).map(r => r.ms).sort((a, b) => a - b)[ok.filter(r => r.cloud).length >> 1] || 0 };
writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), note: 'Checked one listing at a time, as the web page and the Android app do without a built-in model: look in the cloud, the device\'s lookup, then the cloud\'s confirmation for every baby product.', summary, missed: yes.filter(r => !flagged(r)).map(r => r.title), falseAlarms: no.filter(flagged).map(r => ({ title: r.title, level: r.final, kind: r.kind, recall: r.recall || r.also || null, why: r.why })), rows }, null, 1));
console.log(JSON.stringify(summary));
