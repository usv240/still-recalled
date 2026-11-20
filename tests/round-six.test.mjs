// Fixes after the fifth independent review (0.12.1): what a stand-in notice may raise, how the cloud's recall number is
// read, the owner's words, the warnings file's columns, and the proof that skipping the built-in model's look on a
// listing whose words name a risky type cannot change the result once the cloud has answered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideFinal, capForStandIn } from '../shared/confirm.mjs';
import { decide, SCHEMA } from '../shared/judge.mjs';
import { wordsOnlyAnswer } from '../shared/triage.mjs';
import { BANNED_TYPES } from '../shared/banned.mjs';
import { present, ownerView } from '../shared/present.mjs';
import { warningRecords } from '../shared/warnings.mjs';

const card = { id: '23088', date: '2023-01-09', product: 'Rock \'n Play Sleepers', title: 't', hazard: 'h', remedy: 'Refund.', url: 'https://www.cpsc.gov/x', image: '', tell: 'All.', codes: [], from: 2009, to: 2019, all: true };
const cloud = over => ({ what_is_for_sale: 'the_product', matches_recall: 'no', banned_type: 'none', evidence: 'e', check_before_buying: 'c', where: [], recall_id: '', ...over });

test('a recall match made on a stand-in notice is a soft flag at most', () => {
  const device = { level: 'possible', kind: 'recall', card, banned: null, why: 'line' };
  const red = decideFinal(device, cloud({ matches_recall: 'yes' }), []);
  assert.equal(red.level, 'likely');
  const capped = capForStandIn(red);
  assert.equal(capped.level, 'possible');
  assert.equal(capped.card.id, '23088');
  assert.match(capped.why, /could not be fetched/);
  // A type flag, a soft flag and "nothing" are left as they are.
  const type = { level: 'likely', kind: 'banned', banned: BANNED_TYPES[0] };
  assert.equal(capForStandIn(type), type);
  const none = { level: 'none', kind: null };
  assert.equal(capForStandIn(none), none);
});

test('the cloud\'s recall number is read with words around it, and never matched in part', () => {
  const device = { level: 'none', kind: null, card: null, banned: null, secondOpinion: true };
  for (const said of ['23088', ' 23088 ', 'Recall 23088', 'recall #23088', 'CPSC recall 23088.']) {
    const d = decideFinal(device, cloud({ matches_recall: 'yes', recall_id: said }), [], [card]);
    assert.equal(d.card && d.card.id, '23088', said);
  }
  // A longer number that only contains it, or another number, names nothing the device returned.
  for (const said of ['230881', '3088', '99-999', 'none']) {
    assert.equal(decideFinal(device, cloud({ matches_recall: 'yes', recall_id: said }), [], [card]).level, 'none', said);
  }
  const warning = { ...card, id: 'W27-081', warning: true };
  assert.equal(decideFinal(device, cloud({ matches_recall: 'yes', recall_id: 'warning W27-081' }), [], [warning]).card.id, 'W27-081');
});

test('skipping the built-in model\'s look on a risky-type listing cannot change what the cloud\'s answer leads to', () => {
  // engine.js lookOnDevice (wordsFirst): a listing whose words name a risky type, and no recall, goes to the cloud
  // whatever the built-in model says. This checks every answer the model can give against every answer the cloud can
  // give: the flag (level, kind, which type) is the same as with no look at all.
  const looks = [];
  for (const what of SCHEMA.properties.what_is_for_sale.enum) for (const type of SCHEMA.properties.banned_type.enum) for (const same of [true, false]) {
    looks.push({ what_is_for_sale: what, product_kind: 'x', same_kind_as_recalled: same, recalled_unit: 'cannot_tell', banned_type: type, brand_seen: '' });
  }
  const clouds = [];
  for (const what of ['the_product', 'part_or_accessory', 'toy_or_doll_version', 'unclear']) for (const type of ['none', ...BANNED_TYPES.map(t => t.key)]) for (const m of ['yes', 'no', 'cannot_tell', 'no_recall_given']) {
    clouds.push(cloud({ what_is_for_sale: what, banned_type: type, matches_recall: m }));
  }
  let compared = 0;
  for (const hint of BANNED_TYPES) {
    const hints = [hint];
    const skipped = decide(wordsOnlyAnswer(null), null, hints, []);
    for (const look of looks) {
      const looked = decide(look, null, hints, []);
      // Either way the listing reaches the cloud: a flag, or a "part or toy" the words disagree with.
      assert.ok(looked.level !== 'none' || looked.askCloud, `${hint.key} ${look.what_is_for_sale} ${look.banned_type}`);
      for (const c of clouds) {
        const a = decideFinal(looked, c, hints), b = decideFinal(skipped, c, hints);
        assert.deepEqual([a.level, a.kind, a.banned && a.banned.key], [b.level, b.kind, b.banned && b.banned.key]);
        compared++;
      }
    }
  }
  assert.equal(compared, BANNED_TYPES.length * looks.length * clouds.length);
});

test('the owner is not told about a listing, a seller, or an item for sale', () => {
  const r = present({ id: '1', title: 'Boppy lounger', url: '' }, { level: 'likely', kind: 'recall', card, confirmed: true,
    evidence: 'The listing\'s price and the listing title show the item for sale is a Rock \'n Play; the seller\'s photo shows the listing\'s frame.' }, {});
  const o = ownerView(r);
  assert.doesNotMatch(o.evidence, /listing|seller|for sale|entered's/i);
  assert.match(o.evidence, /^Its price and what you entered show your item is a Rock 'n Play; your photo shows its frame\.$/);
  assert.match(o.lines[0], /^Stop using it unless the recall's fix has already been done\. CPSC says it is illegal to sell any recalled product\.$/);
});

test('a warnings file with renamed columns is an error, not "no warnings"', () => {
  assert.throws(() => warningRecords('"Warning Number","Date","Title"\n27-099,"November 19, 2026","X"\n'), /unexpected columns/);
  assert.equal(warningRecords('').length, 0);
});
