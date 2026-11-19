// Live recalls: cards made on the shopper's computer for notices CPSC published after the build.
// The fixture is the real API answer for 2026-11-12 (seven notices).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveCardsFromCpsc } from '../shared/cards.mjs';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { noticeText } from '../shared/spotter.mjs';

const records = JSON.parse(readFileSync(new URL('./fixtures/cpsc-2026-11-12.json', import.meta.url), 'utf8'));
const bundled = JSON.parse(readFileSync(new URL('../extension/data/cards.json', import.meta.url), 'utf8')).cards;
// As if the build were from before these notices.
const base = bundled.filter(c => c.date < '2026-11-12');

// What the cloud wrote for the Huffy e-trike notice (the shape SPOTTER_SCHEMA asks for).
const huffy = { brands: ['Huffy', 'Buzz Bicycles'], lines: ['Cerana T2', 'Cerana'], kind: 'e-trike', other_names: ['electric tricycle', 'adult tricycle', 'electric trike'],
  models: ['E4004'], sold_from: 2023, sold_to: 2026, all_units: false, tell: 'Model E4004 only; the number is on a label near the pedals under the downtube.', for_children: false };

test('new notices become cards; notices already known are skipped', () => {
  const cards = liveCardsFromCpsc(records, new Map(), base);
  assert.equal(cards.length, 7);
  assert.ok(cards.every(c => c.live));
  assert.equal(liveCardsFromCpsc(records, new Map(), bundled).length, 0);
});

test('the field guide written in the cloud makes a new recall matchable on the device', () => {
  const cards = liveCardsFromCpsc(records, new Map([['27086', huffy]]), base);
  const idx = buildIndex(cards);
  const hit = shortlist(idx, 'Buzz Bicycles Cerana T2 electric trike E4004, barely used')[0];
  assert.equal(hit && hit.card.id, '27086');
  assert.equal(hit.strength, 'code');
  // A line counts only with the brand: a listing that shares the line's word alone is not a candidate.
  assert.equal(shortlist(idx, 'Cerana bracelet, sterling silver').length, 0);
});

test('without the cloud, a new notice still gets a card from the plain-code rules', () => {
  const card = liveCardsFromCpsc(records, new Map(), base).find(c => c.id === '27086');
  assert.ok(card.codes.includes('E4004'));
  assert.equal(card.tell, '');
});

test('the notice text the cloud reads carries the model and the label location', () => {
  const text = noticeText(records.find(r => String(r.RecallNumber) === '27086'));
  assert.match(text, /E4004/);
  assert.match(text, /label near the pedals/);
});
