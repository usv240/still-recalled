import test from 'node:test';
import assert from 'node:assert/strict';
import { promptText, decide, SCHEMA } from '../shared/judge.mjs';
import { bannedHints, notTheProduct } from '../shared/banned.mjs';

const card = { id: '27040', product: 'Costway Convertible High Chairs', hazard: 'Fall and entrapment' };
const cand = strength => ({ card, strength });
const answer = over => ({ what_is_for_sale: 'the_product', product_kind: 'high chair', same_kind_as_recalled: true, banned_type: 'none', ...over });

test('the prompt names the one recalled product and stays short', () => {
  const text = promptText({ title: 'Costway high chair', description: 'x'.repeat(5000) }, cand('brand'), []);
  assert.match(text, /RECALLED PRODUCT\nCostway Convertible High Chairs/);
  assert.ok(text.length < 2200, 'prompt must leave room for the photo: ' + text.length);
  assert.ok(!text.includes('drop_side_crib'), 'drop-side is only described when the listing text hints at it');
  assert.match(promptText({ title: 'drop side crib' }, null, bannedHints('drop side crib')), /drop_side_crib/);
});

test('only a matching model number warns on-device; brand and line matches are soft flags', () => {
  assert.equal(decide(answer(), cand('code'), []).level, 'likely');
  assert.equal(decide(answer(), cand('line'), []).level, 'possible');
  assert.equal(decide(answer(), cand('brand'), []).level, 'possible');
});

test('a different kind of product is never flagged, whatever the brand', () => {
  assert.equal(decide(answer({ same_kind_as_recalled: false }), cand('code'), []).level, 'none');
});

test('parts and toy versions are never flagged', () => {
  assert.equal(decide(answer({ what_is_for_sale: 'part_or_accessory' }), cand('code'), []).level, 'none');
  assert.equal(decide(answer({ what_is_for_sale: 'toy_or_doll_version', banned_type: 'crib_bumper' }), null, bannedHints('crib bumper')).level, 'none');
});

test('banned types: wording plus photo warns, either alone is a soft flag', () => {
  const hints = bannedHints('braided crib bumper grey');
  assert.equal(decide(answer({ banned_type: 'crib_bumper' }), null, hints).level, 'likely');
  assert.equal(decide(answer({ banned_type: 'none' }), null, hints).level, 'possible');
  assert.equal(decide(answer({ banned_type: 'in_bed_sleeper' }), null, []).level, 'possible');
  // When both point to a banned type, the wording decides which one: the model confuses look-alikes.
  assert.equal(decide(answer({ banned_type: 'inclined_sleeper' }), null, bannedHints('baby nest lounger')).banned.key, 'in_bed_sleeper');
});

test('word rules catch spare parts and doll items before the model is asked', () => {
  assert.ok(notTheProduct("AC/DC Adapter for Fisher-Price Rock 'n Play Sleeper"));
  assert.ok(notTheProduct('American Girl Bitty Baby Crib Bumper Pad For Doll Bed'));
  assert.ok(notTheProduct('Graco stroller replacement part parent cupholder'));
  assert.ok(!notTheProduct('Fisher-Price Infant Baby Swing with canopy'));
  assert.deepEqual(bannedHints('Breathable Mesh Crib Liner Safer Bumper'), []);
});

test('no answer the model can give means "safe"', () => {
  // The banned-type descriptions mention words like "clearly"; what matters is the allowed answers.
  const allowed = Object.values(SCHEMA.properties).flatMap(p => p.enum || []);
  assert.ok(!allowed.some(v => ['safe', 'clear', 'cleared', 'ok', 'approved', 'not_recalled'].includes(v)), allowed.join(','));
  assert.deepEqual([...new Set(['code', 'line', 'brand'].map(s => decide(answer({ same_kind_as_recalled: false }), cand(s), []).level))], ['none']);
});
