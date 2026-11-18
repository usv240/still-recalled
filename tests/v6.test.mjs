// Tests for the 0.6 additions: every recall since 1973 with cloud-written spotter cards, the outline of where the
// cloud saw the problem, and settling a possible recall with a label photo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { boxFrom, decideFinal } from '../shared/confirm.mjs';
import { judgeLabel, labelCopy } from '../shared/label.mjs';
import { uniqueTokens } from '../shared/text.mjs';

const { cards } = JSON.parse(await readFile(new URL('../extension/data/cards.json', import.meta.url), 'utf8'));
const index = buildIndex(cards);
const top = t => shortlist(index, t)[0] || null;

test('recalls from every era are known, not only the last five years', () => {
  assert.ok(cards.length > 10000);
  assert.ok(cards.some(c => c.date < '1980'));
  assert.equal(top('Fisher-Price Rock n Play Sleeper').card.id, '23088');       // all Rock 'n Play models (2023 re-announcement)
  assert.equal(top('Nap Nanny Generation 2 baby recliner').card.id, '10309');    // 2010
  assert.equal(top('Boppy Newborn Lounger gray').card.id, '21198');              // 2021, before the old cutoff
  assert.ok(['12247', '12188'].includes(top('Bumbo floor seat blue').card.id));
});

test('a brand that is also an everyday word does not match listings by that word', () => {
  // A treestand maker's brand reads as "stand", an old rattle's as "toy", a mattress recall's as "mattress".
  for (const t of ['White Oval Wicker Baby Bassinet w/ Rocking Stand', 'Kolcraft crib mattress', 'Ingenuity Infant Baby Bouncer Seat with Toy Bar']) {
    assert.equal(top(t), null, t);
  }
  // "L.L. Bean" keeps only "bean" after tokenizing; it must not match "Nested Bean".
  assert.equal(top('Nested Bean Footie Zippered Pajamas'), null);
});

test('brand and kind alone do not match a recall that names its models or lines', () => {
  // Graco recalled certain Pack 'n Play models with raised changing tables in 2003; not every Graco play yard.
  assert.equal(top('Graco Pack n Play Playard Gray with Carry Bag'), null);
  // ...but a recall of every unit still matches on brand and kind.
  assert.equal(top('Mamibaby Ultra-Soft Reversible Newborn Baby Nest Lounger').strength, 'brand');
});

test('"2-1", "2 in 1" and "2-in-1" read the same', () => {
  assert.ok(uniqueTokens('Portable 2-1 Bassinet').includes('2in1'));
  assert.ok(uniqueTokens('3 in 1 crib').includes('3in1'));
  assert.ok(uniqueTokens('RGV3-304').includes('rgv3304'));
});

test('a listing that states a year outside the recalled years is not a brand match', () => {
  const card = { id: 'x', date: '2020-01-01', product: 'Acme Swings', brands: [['acme']], lines: [], linesWithBrand: [], kinds: [['swing']], codes: [], productTokens: [], from: 2018, to: 2019, all: true };
  const idx = buildIndex([card]);
  assert.equal(shortlist(idx, 'Acme baby swing 2019')[0].strength, 'brand');
  assert.equal(shortlist(idx, 'Acme baby swing')[0].strength, 'brand');
  assert.equal(shortlist(idx, 'Acme baby swing 2024').length, 0);
});

test('the outline of where the cloud saw it: a box, or nothing', () => {
  assert.deepEqual(boxFrom([95, 118, 492, 515]), { x: 0.118, y: 0.095, w: 0.397, h: 0.397 });
  assert.equal(boxFrom([0, 4, 885, 990]), null);          // nearly the whole photo outlines nothing
  assert.equal(boxFrom([10, 10, 20, 20]), null);          // too small to see
  assert.equal(boxFrom([]), null);
  assert.equal(boxFrom(null), null);
  assert.equal(boxFrom([1, 2, 3]), null);
  const d = decideFinal({ level: 'possible', kind: 'banned', banned: { key: 'crib_bumper' }, askCloud: true, maybe: { key: 'crib_bumper' } },
    { what_is_for_sale: 'the_product', matches_recall: 'no_recall_given', banned_type: 'crib_bumper', evidence: 'e', check_before_buying: '', where: [455, 750, 825, 998] }, []);
  assert.deepEqual(d.where, { x: 0.75, y: 0.455, w: 0.248, h: 0.37 });
});

test('the label check: code compares what the model read with the notice', () => {
  const card = { codes: ['CHM84', 'CMR40', 'CMR43'], from: 2015, to: 2016 };
  assert.equal(judgeLabel({ readable: true, model_numbers: ['CHM84-9993'], year: 2016 }, card).state, 'recalled');
  assert.equal(judgeLabel({ readable: true, model_numbers: ['cmr 40'], year: 0 }, card).state, 'recalled');
  assert.equal(judgeLabel({ readable: true, model_numbers: ['GVF83'], year: 2021 }, card).state, 'not_listed');
  assert.equal(judgeLabel({ readable: true, model_numbers: [], year: 2021 }, card).state, 'year_out');
  assert.equal(judgeLabel({ readable: false, model_numbers: [], year: 0 }, card).state, 'unreadable');
  assert.equal(judgeLabel({ readable: true, model_numbers: ['AB1'], year: 0 }, { codes: [], from: 0, to: 0 }).state, 'no_models');
  // Never "safe", in any outcome.
  for (const state of ['recalled', 'not_listed', 'year_out', 'no_models', 'unreadable']) {
    const copy = labelCopy({ state, model: 'X1', listed: card.codes, year: 2016, from: 2015, to: 2016 });
    assert.ok(!/\bsafe\b/i.test(`${copy.title} ${copy.text}`), state);
  }
});
