// The unnamed-sleep rule (0.14.0): a sleep-type product with no brand the field guide knows and no telling word gets
// the cloud's look in the extension, even when the built-in model sees nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage, namesKnownBrand } from '../shared/triage.mjs';

const { cards } = JSON.parse(readFileSync(new URL('../extension/data/cards.json', import.meta.url), 'utf8'));
const idx = buildIndex(cards);
const t = title => triage(idx, { id: 'x', title });

test('a sleep-type product with no brand is sent for the cloud look', () => {
  assert.equal(t('Baby Rocker').unnamedSleep, true);
  assert.equal(t('Soft newborn baby pillow').unnamedSleep, true);
  assert.equal(t('Portable baby bassinet').unnamedSleep, true);
});

test('a known brand, a recall candidate or a telling word keeps the old path', () => {
  assert.equal(namesKnownBrand(idx, 'Fisher-Price baby rocker'), true);
  assert.equal(t('Fisher-Price baby rocker').unnamedSleep, false);
  assert.equal(t('Rock n Play sleeper').unnamedSleep, false);        // a recall candidate
  assert.equal(t('Infant inclined sleeper rocker').unnamedSleep, false); // the words name a banned type
});

test('other baby products, parts and toys are not sent', () => {
  assert.equal(t('Baby stroller, gently used').unnamedSleep, false);
  assert.equal(t('Baby high chair').unnamedSleep, false);
  assert.equal(t('Swing replacement part motor').unnamedSleep, false);
  assert.equal(t('Doll cradle toy').unnamedSleep, false);
});
