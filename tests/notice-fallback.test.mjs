// When the CPSC recall API does not answer, the cloud check runs on the short record the device keeps
// (shared/notice.mjs noticeFromCard), instead of giving up and leaving the device's flag unconfirmed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { noticeFromCard, noticeForPrompt } from '../shared/notice.mjs';
import { confirmParts } from '../shared/confirm.mjs';

const card = { id: '15196', date: '2015-07-23', product: 'UPPAbaby 2015 CRUZ and VISTA strollers', title: 'UPPAbaby Recalls Strollers', hazard: 'Choking hazard',
  remedy: 'Consumers should…', url: 'https://www.cpsc.gov/x', image: 'https://www.cpsc.gov/p.jpg', tell: '2015 models with a foam bumper bar.', codes: ['0401-CRZ-US', '0115-VIS-US'], more: true, from: 2014, to: 2015, all: false };

test('a card stands in for a notice that could not be fetched', () => {
  const n = noticeFromCard(card);
  assert.equal(n.id, '15196');
  assert.equal(n.fromCard, true);
  assert.equal(n.remedy, '');   // the card's remedy is cut short, so it is not passed off as the notice's
  assert.deepEqual(n.images, ['https://www.cpsc.gov/p.jpg']);
  const text = noticeForPrompt(n);
  assert.match(text, /^Recall 15196, 2015-07-23/);
  assert.match(text, /Which units are recalled: 2015 models with a foam bumper bar\./);
  assert.match(text, /Sold from 2014 to 2015\./);
  assert.match(text, /0401-CRZ-US, 0115-VIS-US, and others/);
  assert.match(text, /could not be fetched/);
  const parts = confirmParts({ listing: { title: 'UPPAbaby Vista stroller' }, notice: n, listingPhoto: null, recallPhoto: null }).join('\n');
  assert.match(parts, /RECALL NOTICE\nRecall 15196/);
});

test('a card of a product recalled in every unit says so', () => {
  assert.match(noticeFromCard({ ...card, all: true, codes: [] }).description, /^Every unit of this product is recalled\./);
});
