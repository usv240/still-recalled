// What the owner of an item reads (shared/present.mjs ownerView): the same check, said to the person about to sell it
// or give it away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { present, ownerView } from '../shared/present.mjs';

const listing = { id: '1', title: 'Rock n Play', url: '' };
const card = { id: '23088', date: '2023-01-09', product: 'All models of Rock \'n Play Sleepers', title: 't', hazard: 'h', remedy: 'Refund.', url: 'https://www.cpsc.gov/x', image: '', tell: 'All models.', codes: [], from: 2009, to: 2019, all: true };

test('a recalled product: do not sell it, and what the recall offers its owner', () => {
  const o = ownerView(present(listing, { level: 'likely', kind: 'recall', card, confirmed: true }));
  assert.match(o.action, /^Don't sell it or give it away/);
  assert.ok(o.lines.some(l => /illegal to sell any recalled product/.test(l)));
  assert.ok(o.lines.some(l => /remedy: Refund\./.test(l)));
});

test('a possible recall: check the label first; a recall the cloud named is never stated as fact', () => {
  const some = { ...card, all: false, tell: 'Models 123 and 456, on the label under the seat.' };
  const o = ownerView(present(listing, { level: 'possible', kind: 'recall', card: some, confirmed: true }));
  assert.match(o.action, /^Check its label/);
  assert.ok(o.lines.some(l => /Models 123 and 456/.test(l)));
  const named = ownerView(present(listing, { level: 'possible', kind: 'recall', card, lookedUp: true, confirmed: true }, { lookups: [{ asked: { brand: 'Fisher-Price', product: 'Rock n Play' }, found: ['23088'] }] }));
  assert.match(named.action, /looks like a recalled product/);
  assert.ok(named.lines.some(l => /Every unit/.test(l)));
});

test('a CPSC warning: no refund to claim; a banned type: the rule in plain words; nothing found: never "safe to sell"', () => {
  const w = ownerView(present(listing, { level: 'likely', kind: 'recall', card: { ...card, id: 'W26-742', warning: true, remedy: 'Stop using the loungers and dispose of them.' }, confirmed: true }));
  assert.match(w.action, /CPSC has told people to stop using/);
  assert.ok(w.lines.some(l => /no refund to claim/.test(l)));
  assert.ok(w.lines.some(l => /^CPSC says: Stop using/.test(l)));
  const b = ownerView(present(listing, { level: 'likely', kind: 'banned', banned: { key: 'crib_bumper' }, confirmed: true }));
  assert.equal(b.action, "Don't sell it or give it away.");
  assert.ok(b.lines.some(l => /against federal law since November 2022/.test(l)));
  const lounger = ownerView(present(listing, { level: 'likely', kind: 'banned', banned: { key: 'in_bed_sleeper' }, confirmed: true }));
  assert.ok(!lounger.lines.some(l => /federal law/.test(l)), 'loungers are not banned from sale by federal law');
  const none = ownerView(present(listing, { level: 'none' }));
  assert.match(none.action, /doesn't mean it's safe to pass on/);
  assert.ok(!/\bsafe to sell\b/.test(JSON.stringify(none)));
});
