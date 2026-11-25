import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { liveLookup, LIVE_TOOL, LIVE_SYSTEM } from '../shared/live.mjs';

const cards = JSON.parse(readFileSync('web/data/cards.json', 'utf8'));
const index = buildIndex(Array.isArray(cards) ? cards : cards.cards || Object.values(cards)[0]);

test('the Live tool is the field-guide lookup, described for the camera', () => {
  assert.equal(LIVE_TOOL.name, 'lookup_recalls');
  assert.deepEqual(LIVE_TOOL.parameters.required, ['product']);
  assert.match(LIVE_SYSTEM, /Never say a product is safe/);
});

test('a product Gemini names in the camera finds its recall on the device', () => {
  const r = liveLookup(index, { brand: 'Fisher-Price', product: "Rock 'n Play sleeper" });
  assert.ok(r.shown.recalls.some(x => x.card.id === '23088'), 'Rock n Play recall found');
  assert.ok(r.response.recalls.some(x => x.recall_id === '23088'));
  // Its kind is banned too, and the screen says so.
  assert.ok(r.shown.types.some(t => t.key === 'inclined_sleeper'));
  assert.ok(r.response.sleep_types.length > 0);
  // Firm, on condition: every unit is recalled, and the type is against federal law to sell.
  assert.ok(r.response.say.some(l => /^If this is the .*: don't buy it\. Every unit is recalled\./.test(l)));
  assert.ok(r.response.say.some(l => /inclined sleeper: don't buy it/.test(l)));
});

test('a banned kind with no recall still warns', () => {
  const r = liveLookup(index, { brand: 'Unknown', product: 'padded crib bumper set' });
  assert.ok(r.shown.types.some(t => t.key === 'crib_bumper'));
  assert.match(r.response.note || '', /sleep risk/);
  assert.ok(r.response.say.some(l => /crib bumper: don't buy it/.test(l)));
});

test('a lounger is never called illegal to sell, and gets the safe-sleep line (0.15.0)', () => {
  const r = liveLookup(index, { brand: '', product: 'baby lounger nest' });
  assert.ok(r.shown.types.some(t => t.key === 'in_bed_sleeper'));
  assert.doesNotMatch(JSON.stringify(r.response), /cannot legally|against federal law/i);
  assert.ok(r.response.say.some(l => /lounger or nest: skip it/.test(l)));
  assert.match(r.response.sleep, /Not for sleep/);
});

test('nothing named: nothing found, and the response never says safe', () => {
  const r = liveLookup(index, { brand: '', product: 'stroller' });
  assert.equal(r.shown.recalls.length, 0);
  assert.doesNotMatch(JSON.stringify(r.response), /\bsafe\b/i);
});

test('a toy version is not the product', () => {
  const r = liveLookup(index, { brand: 'Fisher-Price', product: "doll Rock 'n Play for dolls" });
  assert.equal(r.shown.recalls.length, 0);
  assert.equal(r.shown.types.length, 0);
});
