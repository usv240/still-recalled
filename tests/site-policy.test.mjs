// The marketplace's own rules on a flagged listing (0.17.0): all four bar recalled products; Facebook Marketplace and
// eBay also bar the infant sleep types by name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sitePolicy } from '../extension/src/ui/detail.js';

const r = (url, kind, level = 'likely') => ({ level, kind, listing: { url } });
test('site policy line', () => {
  assert.match(sitePolicy(r('https://www.facebook.com/marketplace/item/1100087906213990/', 'banned')), /^Facebook Marketplace's rules don't allow this kind of infant sleep product/);
  assert.match(sitePolicy(r('https://www.ebay.com/itm/123456789012', 'banned')), /^eBay's rules/);
  assert.match(sitePolicy(r('https://sfbay.craigslist.org/view/d/x/5JJ79cTiC2NGjXLGS4HYLv', 'recall')), /^Craigslist's rules don't allow recalled products/);
  assert.equal(sitePolicy(r('https://sfbay.craigslist.org/view/d/x/5JJ79cTiC2NGjXLGS4HYLv', 'banned')), null);
  assert.equal(sitePolicy(r('https://www.ebay.com/itm/123456789012', 'recall', 'possible')), null);
  assert.equal(sitePolicy(r('https://still-recalled.web.app/try/item/newborn-lounger.html', 'banned')), null);
  assert.equal(sitePolicy(r('', 'recall')), null);
});
