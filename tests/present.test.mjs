import test from 'node:test';
import assert from 'node:assert/strict';
import { present, badgeText, byConcern, TYPE_COPY } from '../shared/present.mjs';
import { BANNED_TYPES } from '../shared/banned.mjs';

const listing = { id: '1', title: 'Peg Perego YPSI bassinet', price: '$40.00', image: 'https://i.ebayimg.com/x.jpg', url: 'https://www.ebay.com/itm/1' };
const card = { id: '24719', date: '2024-03-28', product: 'YPSI and Z4 Inclined Sleeper Bassinets', title: 't', hazard: 'h', remedy: 'r', url: 'u', image: 'i', codes: [], tokens: [] };
const lounger = BANNED_TYPES.find(t => t.key === 'in_bed_sleeper');

test('a recall result is plain data with the recall facts and the shopper wording', () => {
  const r = present(listing, { level: 'likely', kind: 'recall', card, why: 'w', check: 'c', confirmed: true }, { device: true, cloud: { model: 'm' } });
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);           // survives messaging and storage
  assert.equal(r.badge, 'Recalled product');
  assert.match(r.verdict, /recalled March 2024/);
  assert.match(r.question, /24719/);
  assert.equal(r.how.cloudModel, 'm');
  assert.equal(r.recall.tokens, undefined);                      // matching internals are not shipped to the UI
});

test('a banned-type result carries the type copy and a CPSC source, never a RegExp', () => {
  const r = present(listing, { level: 'possible', kind: 'banned', banned: lounger }, { device: true });
  assert.equal(r.banned.name, TYPE_COPY.in_bed_sleeper.name);
  assert.equal(r.badge, 'Possible lounger');
  assert.ok(!('pattern' in r.banned));
});

test('a "none" result has no wording and no kind', () => {
  const r = present(listing, { level: 'none', kind: 'recall', card });
  assert.equal(r.kind, null);
  assert.equal(r.badge, undefined);
});

test('no shopper-facing text says safe, banned or illegal', () => {
  const texts = [];
  for (const level of ['likely', 'possible']) {
    texts.push(present(listing, { level, kind: 'recall', card }));
    for (const t of BANNED_TYPES) texts.push(present(listing, { level, kind: 'banned', banned: t }));
  }
  const all = JSON.stringify(texts.map(r => [r.badge, r.verdict, r.question, r.banned && r.banned.risk]));
  assert.doesNotMatch(all, /\bsafe\b(?!-sleep| sleep)|\bbanned\b|\billegal\b/i);
  assert.equal(badgeText({ kind: null }), '');
});

test('likely recalls sort first, then likely types, then possibles', () => {
  const rows = [
    { level: 'possible', kind: 'recall', order: 0 },
    { level: 'likely', kind: 'banned', order: 1 },
    { level: 'likely', kind: 'recall', order: 2 },
  ].sort(byConcern);
  assert.deepEqual(rows.map(r => r.order), [2, 1, 0]);
});

test('verdict uses "an" before a vowel sound', async () => {
  const { present } = await import('../shared/present.mjs');
  const r = present({ id: '1', title: 'Baby nest' }, { level: 'likely', kind: 'banned', banned: { key: 'in_bed_sleeper' } });
  assert.equal(r.verdict, 'This looks like an infant lounger or nest.');
  const b = present({ id: '2', title: 'Bumper' }, { level: 'possible', kind: 'banned', banned: { key: 'crib_bumper' } });
  assert.equal(b.verdict, 'This may be or include a padded crib bumper.');
});

test('report to CPSC: only likely flags whose sale is ruled out, with a clean listing link and no verdict', async () => {
  const { cpscReport, reportable, CPSC_REPORT_URL } = await import('../shared/present.mjs');
  const ebay = { ...listing, id: '960198699912', url: 'https://www.ebay.com/itm/960198699912?itmprp=enc%3AAQAL&itmmeta=xyz' };
  const recall = present(ebay, { level: 'likely', kind: 'recall', card });
  assert.ok(reportable(recall));
  assert.match(recall.report, /^A recalled product listed for sale online\./);
  assert.match(recall.report, /Listing: https:\/\/www\.ebay\.com\/itm\/960198699912\n/);   // no search-page tracking
  assert.match(recall.report, /CPSC recall 24719/);
  assert.match(recall.report, /appears to be/);
  assert.doesNotMatch(recall.report, /illegal|itmprp/i);
  assert.equal(CPSC_REPORT_URL, 'https://www.saferproducts.gov/IncidentReporting');

  const bumper = BANNED_TYPES.find(t => t.key === 'crib_bumper');
  assert.match(present(ebay, { level: 'likely', kind: 'banned', banned: bumper }).report, /16 CFR 1309.*November 12, 2022/);
  // A possible flag asks the seller first; loungers made before 2025 are not under a sales ban, so no report.
  assert.equal(present(ebay, { level: 'possible', kind: 'recall', card }).report, '');
  assert.equal(present(ebay, { level: 'likely', kind: 'banned', banned: lounger }).report, '');
  // A screenshot on the web page has no link: the report points at the screenshot the shopper attaches.
  assert.match(cpscReport(present({ ...listing, url: '' }, { level: 'likely', kind: 'recall', card })), /Listing: see the attached screenshot/);
});

test('ask the seller: eBay opens its message box; other sites open the listing; a screenshot opens nothing', () => {
  const ebay = present({ ...listing, id: '960198699912', url: 'https://www.ebay.com/itm/960198699912?itmprp=x' }, { level: 'possible', kind: 'recall', card });
  assert.equal(ebay.messageUrl, 'https://www.ebay.com/itm/960198699912?m2mOpen=1');
  const cl = present({ ...listing, id: 'upTYnx8vqnFUqdbVYj5Pdc', url: 'https://www.craigslist.org/view/d/gardena-bassinet/upTYnx8vqnFUqdbVYj5Pdc?x=1' }, { level: 'possible', kind: 'recall', card });
  assert.equal(cl.messageUrl, 'https://www.craigslist.org/view/d/gardena-bassinet/upTYnx8vqnFUqdbVYj5Pdc');
  assert.equal(present({ ...listing, url: '' }, { level: 'possible', kind: 'recall', card }).messageUrl, '');
});
