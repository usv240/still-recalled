// Run with: node --test tests/core.test.mjs tests/judge.test.mjs tests/confirm.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideFinal, confirmParts, CONFIRM_SCHEMA } from '../shared/confirm.mjs';
import { noticeFromCpsc, noticeForPrompt } from '../shared/notice.mjs';
import { BANNED_TYPES, mayContain, notTheProduct } from '../shared/banned.mjs';
import { decide } from '../shared/judge.mjs';

const card = { id: '24719', product: 'YPSI and Z4 Inclined Sleeper Bassinets' };
const recallFlag = { level: 'possible', kind: 'recall', card, banned: null, why: 'line' };
const lounger = BANNED_TYPES.find(t => t.key === 'in_bed_sleeper');
const bannedFlag = { level: 'possible', kind: 'banned', card: null, banned: lounger, why: 'words' };
const cloud = over => ({ what_is_for_sale: 'the_product', matches_recall: 'no', banned_type: 'none', evidence: 'e', check_before_buying: 'c', ...over });

test('no cloud answer keeps the on-device flag, marked unconfirmed', () => {
  const r = decideFinal(recallFlag, null, []);
  assert.equal(r.level, 'possible');
  assert.equal(r.confirmed, false);
});

test('cloud "yes" raises a recall flag to likely; "cannot_tell" keeps it possible; "no" clears it', () => {
  assert.equal(decideFinal(recallFlag, cloud({ matches_recall: 'yes' }), []).level, 'likely');
  const unsure = decideFinal(recallFlag, cloud({ matches_recall: 'cannot_tell' }), []);
  assert.equal(unsure.level, 'possible');
  assert.equal(unsure.check, 'c');
  assert.equal(decideFinal(recallFlag, cloud({ matches_recall: 'no' }), []).level, 'none');
});

test('a toy is always cleared; a part of a recalled product is cleared', () => {
  assert.equal(decideFinal(recallFlag, cloud({ matches_recall: 'yes', what_is_for_sale: 'part_or_accessory' }), []).level, 'none');
  assert.equal(decideFinal(bannedFlag, cloud({ banned_type: 'in_bed_sleeper', what_is_for_sale: 'toy_or_doll_version' }), [lounger]).level, 'none');
});

test('a bumper the cloud calls an "accessory" is still flagged when it names the banned type', () => {
  const bumper = BANNED_TYPES.find(t => t.key === 'crib_bumper');
  const flag = { level: 'possible', kind: 'banned', card: null, banned: bumper, why: 'photo' };
  assert.equal(decideFinal(flag, cloud({ what_is_for_sale: 'part_or_accessory', banned_type: 'crib_bumper' }), []).level, 'likely');
  assert.equal(decideFinal(flag, cloud({ what_is_for_sale: 'part_or_accessory', banned_type: 'none' }), []).level, 'none');
});

test('banned type: both models agree -> likely; words only -> possible; photo-only flag the cloud rejects -> none', () => {
  assert.equal(decideFinal(bannedFlag, cloud({ banned_type: 'in_bed_sleeper' }), [lounger]).level, 'likely');
  assert.equal(decideFinal(bannedFlag, cloud({ banned_type: 'none' }), [lounger]).level, 'possible');
  assert.equal(decideFinal({ ...bannedFlag }, cloud({ banned_type: 'none' }), []).level, 'none');
});

test('the wording decides which banned type when both models agree something is banned', () => {
  const r = decideFinal(bannedFlag, cloud({ banned_type: 'inclined_sleeper' }), [lounger]);
  assert.equal(r.banned.key, 'in_bed_sleeper');
});

test('crib bedding sets get a cloud look; a stroller "with cup holder" is not a part', () => {
  const keys = t => mayContain(t).map(b => b.key);
  assert.deepEqual(keys("Vintage kids Line Two by Two Noah's Ark Nursery &crib set. Cottagecure 90's"), ['crib_bumper']);
  assert.deepEqual(keys('Nojo nautical Blue baby Crib 4PC Set'), ['crib_bumper']);
  assert.deepEqual(keys('American Girl doll crib bedding set'), []);
  assert.deepEqual(keys('Graco stroller travel system'), []);
  assert.equal(notTheProduct('Graco Single Folding Stroller w/ Canopy Hood & Cup Holder, Black/Gray'), false);
  assert.equal(notTheProduct('Cup holder for Graco stroller'), true);
});

test('a set the cloud sees a bumper in is "possible"; the same set with no bumper seen stays hidden', () => {
  const answer = { what_is_for_sale: 'the_product', product_kind: 'crib bedding', same_kind_as_recalled: false, banned_type: 'none' };
  const device = decide(answer, null, [], mayContain('Noah ark crib set'));
  assert.equal(device.level, 'none');
  assert.equal(device.askCloud, true);
  assert.equal(decideFinal(device, cloud({ matches_recall: 'no_recall_given', banned_type: 'crib_bumper' }), []).level, 'possible');
  assert.equal(decideFinal(device, cloud({ matches_recall: 'no_recall_given' }), []).level, 'none');
});

test('no outcome is ever "safe"', () => {
  for (const level of ['yes', 'no', 'cannot_tell', 'no_recall_given']) {
    assert.ok(['none', 'possible', 'likely'].includes(decideFinal(recallFlag, cloud({ matches_recall: level }), []).level));
  }
  assert.ok(!JSON.stringify(CONFIRM_SCHEMA).includes('"safe"'));
});

test('notice shaping puts product photos before label close-ups and keeps the prompt short', () => {
  const n = noticeFromCpsc({
    RecallNumber: '1', RecallDate: '2026-01-02T00:00:00', Title: 'X Recalls Y', URL: 'u', Description: 'd'.repeat(5000),
    Products: [{ Name: 'Y', NumberOfUnits: 'About 5' }], Hazards: [{ Name: 'Fall' }],
    Images: [{ URL: 'https://a/label.png' }, { URL: 'https://a/front.jpg' }],
  });
  assert.deepEqual(n.images, ['https://a/front.jpg', 'https://a/label.png']);
  assert.ok(noticeForPrompt(n).length < 2400);
});

test('prompt parts carry photos only when present', () => {
  const listing = { title: 'Peg Perego YPSI bassinet', price: '$40' };
  const img = { inlineData: { data: 'x', mimeType: 'image/jpeg' } };
  const notice = noticeFromCpsc({ RecallNumber: '24719', Title: 't', URL: 'u', Description: 'd' });
  assert.equal(confirmParts({ listing, notice, listingPhoto: img, recallPhoto: img }).filter(p => p === img).length, 2);
  assert.equal(confirmParts({ listing, notice: null, listingPhoto: null, recallPhoto: null }).filter(p => typeof p !== 'string').length, 0);
});

test('web second opinion: the cloud alone raises only a soft flag, and only when asked', async () => {
  const { decideFinal } = await import('../shared/confirm.mjs');
  const none = { level: 'none', kind: null, card: null, banned: null, why: '', askCloud: false, maybe: null };
  const cloud = { what_is_for_sale: 'the_product', matches_recall: 'no_recall_given', banned_type: 'in_bed_sleeper', evidence: 'a padded nest', check_before_buying: '' };
  assert.equal(decideFinal(none, cloud, []).level, 'none');
  const web = decideFinal({ ...none, secondOpinion: true }, cloud, []);
  assert.equal(web.level, 'possible');
  assert.equal(web.banned.key, 'in_bed_sleeper');
});
