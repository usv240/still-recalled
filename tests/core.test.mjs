// Run with: node --test tests/core.test.mjs tests/judge.test.mjs tests/confirm.test.mjs
// These use the real recall cards, so run `node scripts/build-cards.mjs` first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tokenize, modelCodes } from '../shared/text.mjs';
import { cardFromCpsc } from '../shared/cards.mjs';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { bannedHints } from '../shared/banned.mjs';

const { cards } = JSON.parse(await readFile(new URL('../extension/data/cards.json', import.meta.url), 'utf8'));
const index = buildIndex(cards);
const ids = text => shortlist(index, text).map(h => h.card.id);

test('tokenizer drops recall-notice words and joins hyphenated codes', () => {
  assert.deepEqual(tokenize('Recalled Due to Fall Hazard'), ['fall']);
  assert.ok(tokenize('RGV3-304-N range').includes('rgv3304n'));
  assert.ok(tokenize('Snuga Swings').includes('swing'));
});

test('model codes need letters and two digits; sizes and feature tags are not codes', () => {
  assert.deepEqual(modelCodes('Model RGV3-304 and ABC, 2-in-1, 5.8QT, 3-Wheel, 12V'), ['RGV3-304']);
});

test('a record with no recall number or link makes no card', () => {
  assert.equal(cardFromCpsc({ Title: 'x' }), null);
});

test('a listing that names the recalled product line is a "line" match', () => {
  const hit = shortlist(index, 'Peg Perego YPSI stroller bassinet inclined sleeper, great condition')[0];
  assert.equal(hit.card.id, '24719');
  assert.equal(hit.strength, 'line');
  assert.equal(shortlist(index, '4moms MamaRoo infant swing')[0].card.id, '22200');
});

test('brand plus kind of product, with no model named, is a "brand" match', () => {
  const hit = shortlist(index, 'Fisher-Price Infant Baby Swing Gray/Beige with canopy')[0];
  assert.equal(hit.card.id, '25009');          // plural "Swings" in the notice matches "Swing" in the listing
  assert.equal(hit.strength, 'brand');
});

test('ordinary listings produce no candidates', () => {
  for (const t of ['Used baby sleeper, works great', 'IKEA Kallax shelf white 4x4', 'iPhone 13 128GB unlocked',
                   'wooden high chair vintage', 'baby clothes lot 0-3 months',
                   'Front Bumper Base V6 Without Pony Package Fits 05-09 MUSTANG']) {
    assert.deepEqual(ids(t), [], t);
  }
});

test('banned-type words raise a hint; look-alike words do not', () => {
  const keys = t => bannedHints(t).map(b => b.key);
  assert.deepEqual(keys('Fisher Price Rock n Play sleeper'), ['inclined_sleeper']);
  assert.deepEqual(keys('braided bumper for crib, grey'), ['crib_bumper']);
  assert.deepEqual(keys('drop-side crib with mattress'), ['drop_side_crib']);
  assert.deepEqual(keys('baby nest newborn lounger'), ['in_bed_sleeper']);
  assert.deepEqual(keys('car bumper sticker'), []);
  assert.deepEqual(keys('nursing pillow and bassinet'), []);
});

test('fixes from the 2026-11-15 tests: sewing patterns, hospital cribs, everyday words as line names', async () => {
  const { bannedHints, notTheProduct } = await import('../shared/banned.mjs');
  const { buildIndex, shortlist } = await import('../shared/shortlist.mjs');
  assert.equal(notTheProduct('Simplicity 3795 Nursery Quilt Canopy Bumper Pad Pattern Cut'), true);
  assert.equal(notTheProduct('VINTAGE (1982) Simplicity House 125 Baby Basics Coverlet Bumper Pads'), true);
  assert.deepEqual(bannedHints('NK Medical Products 9687 Pediatrics Medical Crib with Drop Side Rails'), []);
  assert.equal(bannedHints('Vintage wooden drop side crib')[0].key, 'drop_side_crib');
  const idx = buildIndex([{ id: '1', date: '2026-10-15', product: 'Papablic Bedside Sleepers', brand: ['papablic'], line: ['bedside'], productTokens: ['papablic', 'bedside', 'sleeper'], codes: [], tokens: ['papablic', 'bedside', 'sleeper'] }]);
  assert.equal(shortlist(idx, 'Portable Baby Bassinet / Bedside Sleeper').length, 0);
  assert.equal(shortlist(idx, 'Papablic bedside sleeper')[0].strength, 'line');
});

test('fix from the second test: "plush" is a fabric word unless it names a plush toy', async () => {
  const { notTheProduct } = await import('../shared/banned.mjs');
  // Missed in the second test: the word rules dropped this lounger as a toy before any model looked at it.
  assert.equal(notTheProduct('Snuggle Me Organic Cotton Infant Lounger Pillow Plush Pink, Fits Bassinet'), false);
  assert.equal(notTheProduct('Plush toy crib for teddy bears'), true);
  assert.equal(notTheProduct('Lot of 3 plush animals baby nursery'), true);
});

test('lounger fixes from the second test: product lines, words between, portable sleepers, and a disagreement', async () => {
  const { mayContain } = await import('../shared/banned.mjs');
  const { decide } = await import('../shared/judge.mjs');
  const type = t => bannedHints(t).map(x => x.key);
  // Missed in the first two tests.
  assert.deepEqual(type('Snuggle Me Organic Infant Sensory Lounger Sage Green Cover with Storage Bag'), ['in_bed_sleeper']);
  assert.deepEqual(type('Baby Delight Snuggle Nest Adventure Portable Infant Sleeper – Foldable'), ['in_bed_sleeper']);
  assert.deepEqual(type('Sleepyhead DockATot Deluxe+ Baby Infant Lounger Cover'), ['in_bed_sleeper']);
  // A portable sleeper is not flagged on its words; the photo decides.
  assert.deepEqual(type('Abreeze Portable Bedside Baby Sleeper, Gray/White, Carry Bag'), []);
  assert.deepEqual(mayContain('Abreeze Portable Bedside Baby Sleeper, Gray/White, Carry Bag').map(x => x.key), ['in_bed_sleeper']);
  // Look-alikes stay clear.
  for (const t of ['Pool chaise lounger, white', 'Large dog lounger bed', 'Baby Bjorn Travel Crib Light', 'Graco travel system stroller and car seat']) {
    assert.deepEqual(type(t), [], t);
    assert.deepEqual(mayContain(t), [], t);
  }
  // Words name a lounger, the built-in model calls it a part: the cloud looks at the photo instead of the listing being cleared.
  const hints = bannedHints('Sleepyhead DockATot Deluxe+ Baby Infant Lounger Cover');
  const d = decide({ what_is_for_sale: 'part_or_accessory', product_kind: 'cover', same_kind_as_recalled: false, banned_type: 'none' }, null, hints);
  assert.equal(d.level, 'none');
  assert.equal(d.askCloud, true);
  // With no risky-type words, a part stays cleared without a cloud call.
  assert.equal(decide({ what_is_for_sale: 'part_or_accessory', product_kind: 'adapter', same_kind_as_recalled: false, banned_type: 'none' }, null, []).askCloud, false);
});

test('fixes from the third test: mesh liner brand, bedding titles that never reached a photo check, LulyBoo', async () => {
  const { mayContain } = await import('../shared/banned.mjs');
  const may = t => mayContain(t).map(x => x.key);
  assert.deepEqual(bannedHints('Crib bumper - BreathableBaby').map(x => x.key), []);
  assert.deepEqual(may('Vintage Clown Baby Bedding Clowncore Judi -S 80s Heirloom Collection 5 Pc Set'), ['crib_bumper']);
  assert.deepEqual(may('Lot of 9 Graham Kracker Sport football baseball Crib Baby bed Bedding room USA'), ['crib_bumper']);
  assert.deepEqual(may('Lulyboo Indoor Outdoor Bubble Cuddle and Play Lounge and Nest Gray'), ['in_bed_sleeper']);
  // Still not a bedding set or a lounger.
  for (const t of ['Baby bath tub with sling', 'Crib mattress protector waterproof', 'Pool lounge chair']) assert.deepEqual(may(t), [], t);
});
