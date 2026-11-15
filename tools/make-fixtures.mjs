// Builds preview fixtures for the side panel and the badges from a real test run (tools/confirm-results-v3.json):
// real eBay listings, real recall cards, the real on-device and cloud decisions. Development only.
// Usage: node tools/make-fixtures.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { BANNED_TYPES } from '../shared/banned.mjs';
import { present } from '../shared/present.mjs';

const read = async p => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const { cards } = await read('../extension/data/cards.json');
const run = await read('./confirm-results-v3.json');
const listings = Object.values(await read('./live-listings.json')).flat();
const NOISE = /\s*(Opens in a new window or tab|New Listing)\s*/gi;
const byTitle = new Map(listings.map(l => [l.title.replace(NOISE, ' ').trim(), l]));
const cardById = new Map(cards.map(c => [c.id, c]));

function resultFor(row, order) {
  const l = byTitle.get(row.title) || {};
  const listing = { id: l.id || String(order), title: row.title, price: row.price, image: l.image || '', url: l.url || '' };
  const final = row.final || row.device;
  const decision = { level: final.level, kind: final.kind, why: final.why || '', check: final.check || '', evidence: final.evidence || '', confirmed: !!row.final };
  if (final.kind === 'recall') decision.card = cardById.get(row.device.card);
  if (final.kind === 'banned') {
    const key = row.device.banned || (row.cloud && row.cloud.answer.banned_type);
    decision.banned = BANNED_TYPES.find(t => t.key === key);
  }
  const how = row.cloud ? { device: true, cloud: { model: row.cloud.model } } : { device: row.device.level !== 'none' || !!row.device.askCloud };
  return { ...present(listing, decision, how), order };
}

function state(rows, { scope, pendingFrom = Infinity }) {
  const s = { pageKey: `ebay:preview:${scope}`, url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(scope)}`, site: 'ebay', scope, kind: 'search', total: rows.length, order: rows.length, results: {}, pending: {} };
  rows.forEach((row, i) => {
    const r = resultFor(row, i);
    if (i >= pendingFrom) s.pending[r.id] = { title: r.listing.title, order: i };
    else s.results[r.id] = r;
  });
  return s;
}

const pick = search => run.rows.filter(r => r.search === search);
await mkdir(new URL('./fixtures/', import.meta.url), { recursive: true });
const fixtures = {
  mixed: state(run.rows, { scope: 'baby gear' }),
  lounger: state(pick('baby lounger nest'), { scope: 'baby lounger nest' }),
  checking: state([...pick('crib bumper used'), ...pick('baby lounger nest')], { scope: 'crib bumper', pendingFrom: 7 }),
  cosori: state(pick('cosori air fryer'), { scope: 'cosori air fryer' }),
  clear: state(pick('graco stroller'), { scope: 'graco stroller' }),
};
for (const [name, s] of Object.entries(fixtures)) {
  await writeFile(new URL(`./fixtures/${name}.json`, import.meta.url), JSON.stringify(s, null, 1));
  const v = Object.values(s.results);
  console.log(name.padEnd(9), 'results', v.length, 'pending', Object.keys(s.pending).length, 'likely', v.filter(r => r.level === 'likely').length, 'possible', v.filter(r => r.level === 'possible').length);
}
