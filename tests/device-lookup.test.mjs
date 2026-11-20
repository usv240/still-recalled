// The device asks its own field guide (shared/lookup.mjs deviceLookup): a brand the looking model reads in the photo,
// looked up by code when the listing's words do not say it. And what the decision and the card make of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceLookup, applyDeviceLookup } from '../shared/lookup.mjs';
import { buildIndex } from '../shared/shortlist.mjs';
import { decide } from '../shared/judge.mjs';
import { decideFinal, confirmParts } from '../shared/confirm.mjs';
import { present, remedyText, ownerView } from '../shared/present.mjs';
import { labelCopy } from '../shared/label.mjs';
import { BANNED_TYPES } from '../shared/banned.mjs';

const boppy = { id: '21198', date: '2021-09-23', product: 'Boppy Original Newborn Loungers', title: 'The Boppy Company Recalls Newborn Loungers', hazard: 'Suffocation', remedy: 'Refund.', url: 'https://www.cpsc.gov/x', image: '',
  tell: 'All units.', all: true, from: 2004, to: 2021, brands: [['boppy']], lines: [], linesWithBrand: [], kinds: [['lounger'], ['newborn', 'lounger']], productTokens: [], codes: [] };
const graco = { id: '03-001', date: '2003-01-01', product: 'Graco Pack N Play with raised changing table', title: 't', hazard: 'h', remedy: '', url: 'https://www.cpsc.gov/y', image: '',
  tell: 'Models 9845 only.', all: false, from: 2001, to: 2002, brands: [['graco']], lines: [], linesWithBrand: [], kinds: [['play', 'yard']], productTokens: [], codes: ['9845'] };
const index = buildIndex([boppy, graco]);
const listing = { id: '1', title: 'Newborn lounger pillow, washed cover', description: '', url: '' };
const look = over => ({ what_is_for_sale: 'the_product', product_kind: 'infant lounger', same_kind_as_recalled: false, recalled_unit: 'cannot_tell', banned_type: 'none', brand_seen: '', ...over });
const cloud = over => ({ what_is_for_sale: 'the_product', matches_recall: 'no', banned_type: 'none', evidence: 'e', check_before_buying: 'c', where: [], recall_id: '', ...over });

test('a brand read in the photo is looked up by code, only when the words do not say it', () => {
  assert.equal(deviceLookup(index, listing, look({ brand_seen: 'Boppy' })).card.id, '21198');
  // Nothing read, or a word that is not a brand: no lookup.
  assert.equal(deviceLookup(index, listing, look({ brand_seen: '' })), null);
  assert.equal(deviceLookup(index, listing, look({ brand_seen: 'none' })), null);
  assert.equal(deviceLookup(index, listing, look({ brand_seen: 'Baby' })), null);
  // The title already names the brand: the shortlist had its chance, the lookup adds nothing.
  assert.equal(deviceLookup(index, { ...listing, title: 'Boppy newborn lounger' }, look({ brand_seen: 'BOPPY' })), null);
  // A brand whose recall names only some models is not matched on the brand alone, read or typed.
  assert.equal(deviceLookup(index, { ...listing, title: 'Play yard, folds' }, look({ brand_seen: 'Graco', product_kind: 'play yard' })), null);
  // A brand with no recall of that kind of product.
  assert.equal(deviceLookup(index, { ...listing, title: 'Baby swing' }, look({ brand_seen: 'Boppy', product_kind: 'infant swing' })), null);
});

test('what the device finds is a question for the cloud: never a flag on the device alone, a soft flag at most', () => {
  const answer = look({ brand_seen: 'Boppy' });
  const first = decide(answer, null, [], []);
  const { device, seen } = applyDeviceLookup(index, listing, answer, null, first);
  assert.deepEqual(seen, { brand: 'Boppy', id: '21198' });
  // The device's own level does not change; the listing is sent to the cloud with the recall attached.
  assert.equal(device.level, 'none');
  assert.equal(device.askCloud, true);
  assert.equal(device.seen.id, '21198');
  // Without the cloud it is not shown: the built-in model often gives a brand it did not read.
  assert.equal(decideFinal(device, null, []).level, 'none');
  assert.equal(decideFinal(device, null, []).seen, undefined);
  // The cloud sees that product too and says so by its recall number: "possible", never a red recall.
  const yes = decideFinal(device, cloud({ matches_recall: 'yes', recall_id: '21198' }), []);
  assert.equal(yes.level, 'possible');
  assert.equal(yes.lookedUp, true);
  assert.equal(yes.card.id, '21198');
  // The cloud does not take it up (no recall number), or says it is not that product: nothing is shown.
  assert.equal(decideFinal(device, cloud({ matches_recall: 'no_recall_given' }), []).level, 'none');
  assert.equal(decideFinal(device, cloud({ matches_recall: 'no', recall_id: '21198' }), []).level, 'none');
  // The cloud names another product and the field guide has that one: the cloud's recall is the one shown.
  const other = { ...boppy, id: '26569', product: 'Other Loungers' };
  assert.equal(decideFinal(device, cloud({ matches_recall: 'yes', recall_id: '26569' }), [], [other]).card.id, '26569');
  // The cloud is told the brand is a small model's reading that may be wrong, and how to answer about it.
  const notice = { id: '21198', date: '', title: 't', product: 'p', units: '', description: 'd', hazard: '', soldAt: '', upcs: [], images: [] };
  const parts = confirmParts({ listing, notice: null, listingPhoto: null, recallPhoto: null, seen: { brand: 'Boppy', id: '21198', notice } }).join('\n');
  assert.match(parts, /RECALL NOTICE\n\(none given\)/);
  assert.match(parts, /FOUND BY THE DEVICE \(unverified\)/);
  assert.match(parts, /gave the brand "Boppy".*may be wrong/);
  assert.match(parts, /recall_id: 21198/);
  // A candidate from the words, or a part or toy, is left alone.
  assert.equal(applyDeviceLookup(index, listing, answer, { card: graco, strength: 'brand' }, first).seen, null);
  assert.equal(applyDeviceLookup(index, listing, answer, null, { ...first, why: 'the listing is a part or a toy version, not the product' }).seen, null);
});

test('on a type flag that stands, the recall the device found is named beside it, with a caution about look-alikes', () => {
  const lounger = BANNED_TYPES.find(t => t.key === 'in_bed_sleeper');
  const answer = look({ brand_seen: 'Boppy', banned_type: 'in_bed_sleeper' });
  const first = decide(answer, null, [lounger], []);
  const { device, seen } = applyDeviceLookup(index, listing, answer, null, first);
  assert.equal(device.kind, 'banned');
  assert.equal(device.seen.id, '21198');
  // With the cloud off the type flag stands as it was, without the unchecked recall.
  assert.equal(decideFinal(device, null, [lounger]).kind, 'banned');
  assert.equal(decideFinal(device, null, [lounger]).seen, undefined);
  const final = decideFinal(device, cloud({ matches_recall: 'yes', banned_type: 'in_bed_sleeper', recall_id: '21198' }), [lounger]);
  assert.equal(final.kind, 'banned');
  assert.equal(final.alsoRecall.id, '21198');
  const r = present(listing, final, { device: true, seen, cloud: { model: 'm', answer: {} } });
  assert.equal(r.also.id, '21198');
  assert.match(r.foundBy, /^It may be the Boppy Original Newborn Loungers/);
  assert.match(r.foundBy, /look-alikes/);
  assert.match(r.foundBy, /Gemini Nano, on this device, read “Boppy” in the photo and asked the recall field guide on this device/);
  // The cloud says it is not that product: the type flag stands alone.
  assert.equal(decideFinal(device, cloud({ matches_recall: 'no', banned_type: 'in_bed_sleeper', recall_id: '21198' }), [lounger]).alsoRecall, undefined);
});

test('the card says who read the brand, and the owner is not told about a "listing"', () => {
  const answer = look({ brand_seen: 'Boppy' });
  const { device, seen } = applyDeviceLookup(index, listing, answer, null, decide(answer, null, [], []));
  const r = present(listing, decideFinal(device, cloud({ matches_recall: 'cannot_tell', recall_id: '21198' }), []), { device: false, seen, cloud: { model: 'm', answer: {} } });
  assert.equal(r.badge, 'Possible recall');
  assert.match(r.foundBy, /^The listing's words didn't lead to this recall\. Gemini read “Boppy” in the photo/);
  assert.match(r.verdict, /The listing's words don't name this product/);
  assert.deepEqual(r.how.seen, { brand: 'Boppy', id: '21198' });
  const o = ownerView(r);
  assert.doesNotMatch(`${o.verdict} ${o.foundBy} ${o.action} ${o.lines.join(' ')}`, /listing|before you buy|the seller/i);
  assert.match(o.verdict, /Check the brand on yours/);
});

test('a recall the words matched is not displaced by one the cloud looked up', () => {
  const wordsCard = { ...boppy, id: '11-111', product: 'Brand X Loungers' };
  const device = { level: 'possible', kind: 'recall', card: wordsCard, banned: null, why: 'brand' };
  const final = decideFinal(device, cloud({ matches_recall: 'yes', recall_id: '21198' }), [], [boppy]);
  assert.equal(final.level, 'possible');
  assert.equal(final.card.id, '11-111');
  assert.equal(final.alsoRecall.id, '21198');
  assert.equal(final.lookedUp, undefined);
  const r = present(listing, final, { cloud: { model: 'm', answer: {} }, lookups: [{ asked: { brand: 'Boppy', product: 'lounger', model_number: '' }, found: ['21198'] }] });
  assert.match(r.foundBy, /^It may also be the Boppy Original Newborn Loungers/);
  assert.match(r.verdict, /^Same brand and kind as the Brand X Loungers/);
});

test('a remedy cut mid-word is shown as whole sentences or whole words', () => {
  assert.equal(remedyText('Refund.'), 'Refund.');
  assert.equal(remedyText('Consumers should stop using the recalled toy sets immediately, take them away from children, and contact SHEIN for a refund. Consumers will…'),
    'Consumers should stop using the recalled toy sets immediately, take them away from children, and contact SHEIN for a refund.');
  assert.equal(remedyText('Consumers should stop using the recalled portable generators immediately and go to https://www.cummins.com/en-na/na/generators/portable-gen…'),
    'Consumers should stop using the recalled portable generators immediately… (the notice has the rest)');
  assert.equal(remedyText('Consumers should stop using the recalled tricycles immediately and contact Huffy for free replacement rear axle assemblies. The rear wheel…'),
    'Consumers should stop using the recalled tricycles immediately and contact Huffy for free replacement rear axle assemblies.');
  // Cut exactly at the end of a sentence: nothing is dropped.
  assert.equal(remedyText('Consumers should stop using the cars immediately and contact Kakgold for information on how to receive a full refund.…'),
    'Consumers should stop using the cars immediately and contact Kakgold for information on how to receive a full refund.');
  // The full remedy, when the notice was fetched for the cloud check, replaces the card's cut one.
  const r = present(listing, { level: 'likely', kind: 'recall', card: { ...boppy, remedy: 'Consumers should contact Boppy for a ref…' } }, { remedies: { 21198: 'Consumers should contact Boppy for a refund.' } });
  assert.equal(r.recall.remedy, 'Consumers should contact Boppy for a refund.');
});

test('the label check speaks to the owner when the owner asks', () => {
  const v = { state: 'recalled', model: 'CHM84', listed: ['CHM84'], year: 0, yearOut: false, from: 0, to: 0 };
  assert.match(labelCopy(v).text, /Don't buy it unless the seller shows/);
  assert.match(labelCopy(v, { owner: true }).text, /Don't sell it or give it away unless the recall's fix was done/);
  assert.doesNotMatch(labelCopy({ ...v, state: 'near', twin: 'CHM85' }, { owner: true }).text, /before you buy/);
});
