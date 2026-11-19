import test from 'node:test';
import assert from 'node:assert/strict';
import { siteFor, largerPhoto } from '../extension/src/extract.js';

test('search-page thumbnails: eBay photos are asked for at 500 px, other hosts left alone', () => {
  assert.equal(largerPhoto('https://i.ebayimg.com/images/g/okwAAeSwI8Nq-gCd/s-l140.webp'), 'https://i.ebayimg.com/images/g/okwAAeSwI8Nq-gCd/s-l500.webp');
  assert.equal(largerPhoto('https://i.ebayimg.com/images/g/c6EAAeSwLOpq8J3~/s-l225.jpg'), 'https://i.ebayimg.com/images/g/c6EAAeSwLOpq8J3~/s-l500.jpg');
  const cl = 'https://images.craigslist.org/d/7937778010/00H0H_2GkwE0jPleY_0t20CI_600x450.jpg';
  assert.equal(largerPhoto(cl), cl);
});

test('listing links: each marketplace, including Craigslist old and 2026 formats', () => {
  const id = (host, url) => (siteFor(host).item.exec(url) || [])[1] || null;
  assert.equal(id('www.ebay.com', 'https://www.ebay.com/itm/Graco-swing/820300223652?hash=x'), '820300223652');
  assert.equal(id('www.mercari.com', 'https://www.mercari.com/us/item/m12345678901/'), 'm12345678901');
  assert.equal(id('sfbay.craigslist.org', 'https://sfbay.craigslist.org/sfc/bab/d/san-francisco-bassinet/7801234567.html'), '7801234567');
  assert.equal(id('sfbay.craigslist.org', 'https://sfbay.craigslist.org/view/d/san-francisco-snoo-smart-sleeper/5JJ79cTiC2NGjXLGS4HYLv'), '5JJ79cTiC2NGjXLGS4HYLv');
  assert.equal(id('sfbay.craigslist.org', 'https://sfbay.craigslist.org/search/sss?query=d'), null);
  assert.equal(id('still-recalled.web.app', 'https://still-recalled.web.app/try/item/newborn-lounger.html'), 'newborn-lounger');
  assert.equal(id('still-recalled.web.app', 'https://still-recalled.web.app/'), null);
  assert.equal(siteFor('www.facebook.com'), null);
  assert.equal(siteFor('www.amazon.com'), null);
});
