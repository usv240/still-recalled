import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryId, validEntry, fitsNotice, entryDoc } from '../shared/fieldguide.mjs';

// A notice shaped like the CPSC recall API's records (Kidsview bouncer, recalled 2026-11-19).
const record = {
  RecallNumber: '27092', RecallDate: '2026-11-19T00:00:00',
  Title: 'Kidsview Infant Bouncers Recalled Due to Suffocation Hazard',
  Products: [{ Name: 'Kidsview Infant Bouncer with Toy Bar' }],
  Description: 'This recall involves Kidsview infant bouncers, model KV-2201 and KV-2202, sold in khaki and grey from January 2022 through August 2026.',
  Manufacturers: [{ Name: 'Kidsview Baby Co.' }],
};
const spot = {
  brands: ['Kidsview'], lines: [], kind: 'infant bouncer', other_names: ['baby bouncer', 'bouncy seat'],
  models: ['KV-2201', 'KV-2202'], sold_from: 2022, sold_to: 2026, all_units: false,
  tell: 'Check the model number KV-2201 or KV-2202 on the label under the seat.', for_children: true,
};

test('entryId: recall and warning numbers only', () => {
  assert.equal(entryId(' 27092 '), '27092');
  assert.equal(entryId('W26-742'), 'W26-742');
  assert.equal(entryId('../x'), '');
  assert.equal(entryId(''), '');
});

test('validEntry: the field guide shape, within the sizes the rules allow', () => {
  assert.ok(validEntry(spot));
  assert.ok(!validEntry({ ...spot, extra: 1 }));
  assert.ok(!validEntry({ ...spot, brands: Array(13).fill('x') }));
  assert.ok(!validEntry({ ...spot, sold_from: 2026, sold_to: 2022 }));
  assert.ok(!validEntry({ ...spot, tell: 'x'.repeat(401) }));
  const { kind, ...noKind } = spot;
  assert.ok(!validEntry(noKind));
});

test('fitsNotice: an entry that matches the notice this device fetched is used', () => {
  assert.equal(fitsNotice(spot, record), '');
  // Spelling and punctuation differ between a seller-style name and the notice.
  assert.equal(fitsNotice({ ...spot, brands: ['KIDSVIEW'], models: ['kv 2201'] }, record), '');
});

test('fitsNotice: a planted or wrong entry is refused', () => {
  assert.match(fitsNotice({ ...spot, brands: ['Graco'] }, record), /brand not in notice/);
  assert.match(fitsNotice({ ...spot, models: ['XYZ-9'] }, record), /model not in notice/);
  // Emptied, to hide a branded recall from the shortlist.
  assert.match(fitsNotice({ ...spot, brands: [], lines: [], models: [] }, record), /names nothing/);
  assert.equal(fitsNotice({ ...spot, sold_from: 1800 }, record), 'shape');
});

test('entryDoc: the stored document', () => {
  const d = entryDoc(spot, { model: 'gemini-3.5-flash-lite', uid: 'abc' });
  assert.deepEqual(Object.keys(d).sort(), ['by', 'model', 'spot', 'v']);
  assert.equal(d.v, 1);
  assert.equal(d.by, 'abc');
});

test('fitsNotice: a planted year or model number in the tell is refused (0.14.1)', () => {
  // Years the notice never states could drop a real match for a listing that gives its year.
  assert.match(fitsNotice({ ...spot, sold_from: 2001, sold_to: 2002 }, record), /year not in notice/);
  assert.equal(fitsNotice({ ...spot, sold_from: 0, sold_to: 0 }, record), '');
  // A tell that names other model numbers would send a shopper away from a recalled unit.
  assert.match(fitsNotice({ ...spot, tell: 'Only model KV-9900 is recalled.' }, record), /number in tell/);
});
