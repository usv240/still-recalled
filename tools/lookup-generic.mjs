// A controlled test of the cloud's question to the device (shared/lookup.mjs): ten made-up listings for recalled baby
// products, each titled the way sellers often do, without the brand or product name, and shown with the photo from
// its own CPSC recall notice (the easy case for recognising a product; a seller's own photo is harder). The words
// alone cannot find the recall. Counts how often the cloud names the product, asks the device's field guide, and the
// result names the right recall. Each listing is checked as the web page and the Android app check one listing.
//   node tools/lookup-generic.mjs [--runs=1]   -> tools/lookup-generic.json
import { readFileSync, writeFileSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage, wordsOnlyAnswer } from '../shared/triage.mjs';
import { decide } from '../shared/judge.mjs';
import { decideFinal } from '../shared/confirm.mjs';
import { confirm } from './lookup-run.mjs';

const LISTINGS = [
  { recall: '23088', title: 'Inclined baby sleeper, pink, folds flat', text: 'Used for about four months. Gentle rocking, folds flat for travel.' },
  { recall: '21198', title: 'Newborn lounger pillow, washed cover', text: 'Soft lounger for a newborn. Cover has been washed.' },
  { recall: '23089', title: 'Baby rocking sleeper, vibrates', text: 'Rocks on its own with soothing vibration. Works great.' },
  { recall: '22200', title: 'Baby swing, plugs in, five motions', text: 'Bluetooth, sounds and five motions. Smoke-free home.' },
  { recall: '20062', title: 'Rocking seat for baby, grey', text: 'Converts from rocker to stationary seat. Clean.' },
  { recall: '20059', title: 'Bedside baby sleeper, folds for travel', text: 'Sits next to the bed. Used for two months.' },
  { recall: '12247', title: 'Baby floor seat, foam', text: 'Soft foam seat for a baby who is learning to sit.' },
  { recall: '13083', title: 'Baby recliner, foam with fitted cover', text: 'Foam recliner with harness and washable cover.' },
  { recall: '20052', title: 'Compact stroller, folds small, grey', text: 'Lightweight, folds with one hand. Some wear on the wheels.' },
  { recall: '26569', title: 'Baby nest lounger, grey stars', text: 'Portable nest for a baby, used a handful of times.' },
];
const { cards } = JSON.parse(readFileSync('extension/data/cards.json', 'utf8'));
const index = buildIndex(cards);
const runs = Number((process.argv.find(a => a.startsWith('--runs=')) || '--runs=1').slice(7));
const rows = [];
for (let run = 0; run < runs; run++) {
  for (const l of LISTINGS) {
    const card = cards.find(c => c.id === l.recall);
    const listing = { title: l.title, description: l.text, price: '' };
    const t = triage(index, listing);
    const device = { ...decide(wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe), secondOpinion: true };
    const row = { recall: l.recall, product: card.product, title: l.title, words: t.candidate ? `${t.candidate.card.id} ${t.candidate.strength}` : t.hints.length ? `type: ${t.hints[0].key}` : 'nothing' };
    try {
      const r = await confirm(listing, device, t.hints, card.image);
      const without = decideFinal(device, { ...r.answer, recall_id: '' }, t.hints, []);
      Object.assign(row, { model: r.model, ms: r.ms, photo: r.photo, asked: r.lookups.map(x => `${x.asked.brand} / ${x.asked.product}`), returned: r.lookups.flatMap(x => x.found),
        without: `${without.level}${without.kind ? ' ' + without.kind : ''}`, withLookup: `${r.final.level}${r.final.kind ? ' ' + r.final.kind : ''}${(r.final.card || r.final.alsoRecall) ? ' ' + (r.final.card || r.final.alsoRecall).id : ''}`,
        named: !!((r.final.lookedUp && r.final.card) || r.final.alsoRecall), right: !!(((r.final.card || r.final.alsoRecall) || {}).id === l.recall), sameProductOtherNotice: !!((r.final.card || r.final.alsoRecall) && (r.final.card || r.final.alsoRecall).id !== l.recall), red: r.final.level === 'likely' && r.final.kind === 'recall' });
      console.log(`${l.recall} ${row.right ? 'RIGHT' : row.named ? 'other notice' : 'not named'} | words: ${row.words} | asked: ${row.asked.join('; ') || 'no call'} -> ${row.returned.join(',') || '-'} | ${row.without} -> ${row.withLookup} | ${r.ms} ms ${r.model}`);
    } catch (e) { row.error = String(e).slice(0, 160); console.log(l.recall, 'ERROR', row.error); }
    rows.push(row);
  }
}
const ok = rows.filter(r => !r.error);
const summary = { listings: LISTINGS.length, runs, checked: ok.length, wordsFoundRecall: ok.filter(r => /^\d/.test(r.words)).length, cloudAsked: ok.filter(r => r.asked.length).length, deviceReturnedTheRecall: ok.filter(r => r.returned.includes(r.recall)).length,
  namedRightRecall: ok.filter(r => r.right).length, namedAnotherNotice: ok.filter(r => r.sameProductOtherNotice).length, flaggedWithoutLookup: ok.filter(r => !/^none/.test(r.without)).length, redRecallOnTheCloudsWordAlone: ok.filter(r => r.red).length, medianMs: ok.map(r => r.ms).sort((a, b) => a - b)[ok.length >> 1] || 0 };
writeFileSync('tools/lookup-generic.json', JSON.stringify({ at: new Date().toISOString(), note: 'Made-up listings with generic titles and each recall notice\'s own photo.', summary, rows }, null, 1));
console.log(JSON.stringify(summary));
