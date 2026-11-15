import test from 'node:test';
import assert from 'node:assert/strict';
import { siteFor } from '../extension/src/extract.js';

test('listing links: each marketplace, including Craigslist old and 2026 formats', () => {
  const id = (host, url) => (siteFor(host).item.exec(url) || [])[1] || null;
  assert.equal(id('www.ebay.com', 'https://www.ebay.com/itm/Graco-swing/820300223652?hash=x'), '820300223652');
  assert.equal(id('www.mercari.com', 'https://www.mercari.com/us/item/m12345678901/'), 'm12345678901');
  assert.equal(id('sfbay.craigslist.org', 'https://sfbay.craigslist.org/sfc/bab/d/san-francisco-bassinet/7801234567.html'), '7801234567');
  assert.equal(id('sfbay.craigslist.org', 'https://sfbay.craigslist.org/view/d/san-francisco-snoo-smart-sleeper/5JJ79cTiC2NGjXLGS4HYLv'), '5JJ79cTiC2NGjXLGS4HYLv');
  assert.equal(id('sfbay.craigslist.org', 'https://sfbay.craigslist.org/search/sss?query=d'), null);
  assert.equal(id('www.facebook.com', 'https://www.facebook.com/marketplace/item/1234567890/'), '1234567890');
  assert.equal(siteFor('www.amazon.com'), null);
});
