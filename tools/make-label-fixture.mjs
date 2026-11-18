// Development only: tools/fixtures/label.json, one "possible recall" result for the preview pages, to look at the
// card's "Which units" line and "Settle it with the label". A real listing from the first test (a Fisher-Price swing)
// against a real card (16143, Cradle 'n Swings, recalled by model number).
// Usage: node tools/make-label-fixture.mjs, then http://localhost:8766/tools/preview/panel.html?fixture=label&detail=first
import { readFileSync, writeFileSync } from 'node:fs';
import { present } from '../shared/present.mjs';

const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const card = read('../extension/data/cards.json').cards.find(c => c.id === '16143');
const listing = { id: 'demo-swing', title: 'Fisher-Price Cradle n Swing, Sweet Surroundings, Pink, Works Great', price: '$45.00',
  image: 'https://www.cpsc.gov/s3fs-public/Recall.2016.16143.FPCHM84PR2Z.jpg', url: 'https://www.ebay.com/itm/000000000000' };
const r = present(listing, { level: 'possible', kind: 'recall', card, confirmed: true,
  evidence: 'Same brand and line as the recalled Cradle \'n Swings; the listing doesn\'t show the model number.',
  check: card.tell, why: 'same brand and kind as a recalled product; the listing does not show which model' },
  { device: true, deviceLevel: 'possible', cloud: { model: 'gemini-4-hydrogen', answer: { matches_recall: 'cannot_tell' } } });
writeFileSync(new URL('./fixtures/label.json', import.meta.url), JSON.stringify({ scope: 'cradle swing', results: { [r.id]: { ...r, order: 0 } } }, null, 1));
console.log(r.verdict, '|', r.recall.tell, '|', r.recall.codes);
