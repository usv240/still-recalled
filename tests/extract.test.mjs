import test from 'node:test';
import assert from 'node:assert/strict';
import { siteFor, siteOfUrl, facebookTitle, largerPhoto } from '../extension/src/extract.js';

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
  assert.equal(id('www.facebook.com', 'https://www.facebook.com/marketplace/item/1100087906213990/?ref=search'), '1100087906213990');
  assert.equal(id('www.facebook.com', 'https://www.facebook.com/marketplace/charlotte/search?query=baby'), null);
  assert.equal(siteFor('www.amazon.com'), null);
});

test('Facebook Marketplace: only Marketplace pages are read (0.17.0)', () => {
  assert.equal(siteOfUrl('https://www.facebook.com/marketplace/charlotte/search?query=baby%20lounger').site, 'facebook');
  assert.equal(siteOfUrl('https://www.facebook.com/marketplace/item/1100087906213990/').site, 'facebook');
  assert.equal(siteOfUrl('https://www.facebook.com/marketplace').site, 'facebook');
  // The feed, messages, profiles and groups: nothing is read.
  for (const u of ['https://www.facebook.com/', 'https://www.facebook.com/messages/t/123', 'https://www.facebook.com/groups/123/', 'https://www.facebook.com/marketplaceinfo'])
    assert.equal(siteOfUrl(u), null, u);
  assert.equal(siteOfUrl('not a url'), null);
});

test('Facebook Marketplace card titles: no price, place or listing number', () => {
  const link = (aria, text, alt = '') => ({ getAttribute: n => n === 'aria-label' ? aria : null, innerText: text, textContent: text, querySelector: () => (alt ? { alt } : null) });
  assert.equal(facebookTitle(link('Baby lounger, $5, Charlotte, NC, listing 1100087906213990', '$5\nBaby lounger\nCharlotte, NC')), 'Baby lounger');
  assert.equal(facebookTitle(link('Baby Loungers, Baby Bassinets for newborn, $60, Matthews, NC, listing 2555689814786268', '')), 'Baby Loungers, Baby Bassinets for newborn');
  assert.equal(facebookTitle(link('Crib bumper set, Free, Austin, TX, listing 123456789', '')), 'Crib bumper set');
  // A price cut shows two prices; with no name on the link, the lines are read.
  assert.equal(facebookTitle(link('', '$15$25\nRock n Play sleeper\nTampa, FL\n12 mi')), 'Rock n Play sleeper');
  assert.equal(facebookTitle(link('', '', 'Infant lounger in Pineville, NC')), 'Infant lounger');
});
