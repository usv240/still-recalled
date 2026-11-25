// Spanish titles (0.15.0): an AI persona walkthrough found them skipped, since no English word matched. Not yet
// measured on a test set of real Spanish listings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage } from '../shared/triage.mjs';

const { cards } = JSON.parse(readFileSync(new URL('../extension/data/cards.json', import.meta.url), 'utf8'));
const idx = buildIndex(cards);
const t = title => triage(idx, { id: 'x', title });

test('Spanish baby-gear titles get a look', () => {
  for (const title of ['Mecedora para bebé', 'Moisés con colchón', 'Columpio de bebé', 'Cuna de madera', 'Corralito portátil']) {
    assert.equal(t(title).needsEyes, true, title);
  }
});

test('Spanish names of the banned sleep types raise their hint', () => {
  assert.deepEqual(t('Protector para cuna trenzado').hints.map(h => h.key), ['crib_bumper']);
  assert.deepEqual(t('Chichonera para cuna').hints.map(h => h.key), ['crib_bumper']);
  assert.deepEqual(t('Mecedora inclinada para bebé').hints.map(h => h.key), ['inclined_sleeper']);
  assert.deepEqual(t('Nido para bebé recién nacido').hints.map(h => h.key), ['in_bed_sleeper']);
});

test('Spanish parts and other things are left alone', () => {
  assert.equal(t('Repuesto de funda para columpio').needsEyes, false);
  assert.equal(t('Bicicleta de niño').needsEyes, false);
  assert.equal(t('Silla de comer').needsEyes, false);
});
