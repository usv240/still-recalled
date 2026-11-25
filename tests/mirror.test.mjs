// The recall mirror: when CPSC's API can't be reached, the same records come from the mirror, through either CDN.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mirrorRecalls, MIRROR_URLS } from '../shared/mirror.mjs';
import { fetchNotice } from '../shared/notice.mjs';

const rec = (n, date) => ({ RecallNumber: n, RecallDate: `${date}T00:00:00`, Title: `Recall ${n}`, Description: 'A baby rocker.', Products: [], Manufacturers: [], Images: [] });
const MIRROR = [rec('27001', '2026-11-19'), rec('26500', '2026-08-01')];
const json = body => ({ ok: true, status: 200, json: async () => body });
const fail = () => { throw new Error('network down'); };

test('the first CDN that answers is used, and only records from the date asked', async () => {
  const seen = [];
  const fetchImpl = async url => { seen.push(url); return url === MIRROR_URLS[0] ? fail() : json(MIRROR); };
  const got = await mirrorRecalls('2026-10-01', { fetchImpl });
  assert.deepEqual(got.map(r => r.RecallNumber), ['27001']);
  assert.deepEqual(seen, MIRROR_URLS);
});

test('with both CDNs down the caller is told', async () => {
  await assert.rejects(mirrorRecalls('2026-01-01', { fetchImpl: async () => fail() }), /network down/);
});

test('a notice comes from the mirror when CPSC is down, and a missing one still fails', async () => {
  const fetchImpl = async url => (url.includes('saferproducts.gov') ? fail() : json(MIRROR));
  const n = await fetchNotice('26500', fetchImpl);
  assert.equal(n.id, '26500');
  await assert.rejects(fetchNotice('11111', fetchImpl), /network down/);
});
