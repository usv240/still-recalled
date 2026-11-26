// Find listings on a marketplace page.
// Sites change their class names often, so this keys on the one thing that stays stable: the shape of a listing's link.

const SITES = [
  { site: 'ebay', host: /(^|\.)ebay\.com$/, item: /\/itm\/(?:[^/?#]+\/)?(\d{9,})/ },
  { site: 'mercari', host: /(^|\.)mercari\.com$/, item: /\/item\/(m\d+)/ },
  // Craigslist moved from /d/<slug>/<digits>.html to /view/d/<slug>/<code> in 2026; both are matched.
  { site: 'craigslist', host: /(^|\.)craigslist\.org$/, item: /\/(?:view\/)?d\/[^/]+\/([A-Za-z0-9]{8,})(?:\.html)?(?:[?#]|$)/ },
  // Facebook Marketplace (0.17.0): the largest U.S. market for used baby gear. Only Marketplace pages are read: the
  // extension runs on facebook.com because Marketplace is reached inside the site without a page load, but outside
  // /marketplace it reads nothing (no feed, no messages, no profiles).
  { site: 'facebook', host: /(^|\.)facebook\.com$/, path: /^\/marketplace(\/|$)/, item: /\/marketplace\/item\/(\d{6,})/ },
  // The practice listings on the project's own site (web/try/), for trying the extension without a live marketplace.
  { site: 'practice', host: /^(still-recalled\.web\.app|still-recalled\.firebaseapp\.com|localhost)$/, item: /\/try\/item\/([a-z0-9-]+)\.html/ },
];

export function siteFor(hostname) {
  return SITES.find(s => s.host.test(hostname)) || null;
}

/** The site, when this page is one the extension reads (on Facebook, Marketplace pages only). */
export function readable(loc) {
  const site = siteFor(loc.hostname);
  return site && (!site.path || site.path.test(loc.pathname)) ? site : null;
}
/** The same, for a page address ("https://www.facebook.com/marketplace/..."); null for any other address. */
export function siteOfUrl(url) {
  try { return readable(new URL(url)); } catch { return null; }
}

// Facebook's card link is named "Baby lounger, $5, Charlotte, NC, listing 1100087906213990"; its photo is named
// "Baby lounger in Charlotte, NC"; its text is the price, the title and the place on three lines (November 2026).
const FB_PRICE = /^(?:\$[\d,]+(?:\.\d{2})?|free)+$/i;
const FB_PLACE = /^[^,]{2,40}, [A-Z]{2}$|\b\d+(?:\.\d+)?\s*(?:mi|km|miles)\b/;
export function facebookTitle(link) {
  // A new listing's name starts with Facebook's own "Just listed, " (found by the census, 43 of 1,528); not the seller's words.
  const named = String(link.getAttribute('aria-label') || '').replace(/,\s*listing \d+\s*$/i, '').replace(/^Just listed,\s*/i, '');
  const cut = named.search(/,\s*(?:\$[\d,]+(?:\.\d{2})?|free)\b/i);
  if (cut > 2) return clean(named.slice(0, cut));
  const lines = String(link.innerText || link.textContent || '').split('\n').map(clean).filter(t => t && !FB_PRICE.test(t) && !FB_PLACE.test(t));
  if (lines.length) return lines.sort((a, b) => b.length - a.length)[0];
  const img = link.querySelector('img');
  return img ? clean(img.alt).replace(/\s+in [^,]{2,40}, [A-Z]{2}$/, '') : '';
}

// Facebook puts its own general notice on every item page ("Be aware of product recalls. Check the manufacturer's
// website..."). It is about recalls in general, not this item, and its words must not count as the seller's.
const SITE_NOTICES = /Be aware of product recalls\.[^\n]*(\n|$)/gi;
// On a Facebook item page the seller's own words end where the seller's profile and the suggestions begin.
const FB_END = /\n(?:Seller information|Seller details|Today's picks|Related searches|Sponsored)\n/;

// eBay appends screen-reader text to link names; it is not part of the title.
// It also labels the photo carousel inside the title link ("… Image 1 of 4").
const SITE_NOISE = /\s*Opens in a new window or tab\s*$/i;
const PHOTO_COUNTER = /\s*Image \d+ of \d+\s*$/i;
const clean = s => String(s || '').replace(/\s+/g, ' ').replace(SITE_NOISE, '').replace(PHOTO_COUNTER, '').replace(SITE_NOISE, '').replace(/^New Listing/i, '').trim();
// Some cards put the price and a discount inside the title link ("21% Snuggle me Lounger$42.00"); a title never needs them.
const cleanTitle = s => clean(s).replace(/\$\s?[\d,]+(?:\.\d{2})?/g, ' ').replace(/^\d{1,2}%\s*(off\s*)?/i, '').replace(/\s+/g, ' ').trim();

// Search pages load small thumbnails (eBay: 140 px). The models need to see a bumper or an incline, so ask the
// photo host for a larger copy of the same picture where its address says how.
export function largerPhoto(src) {
  if (/(^|\.)ebayimg\.com\//.test(src.replace(/^https?:\/\//, ''))) return src.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)\b/i, '/s-l500.$1');
  return src;
}

function bestImage(root) {
  let best = null, bestArea = 0;
  for (const img of root.querySelectorAll('img')) {
    const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
    if (!src || src.startsWith('data:')) continue;
    const area = (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0);
    if (area >= bestArea) { best = src; bestArea = area; }
  }
  return best && largerPhoto(best);
}

const PRICE = /\$\s?[\d,]+(?:\.\d{2})?/;
/** The price nearest the listing: climb from its card until a price shows, but never into a neighbour's card. */
// A price is its own piece of text ("$45"). Reading it out of the card's whole text took one from a title ("paid more
// than $100") run together with the photo count after it: "$10011" (Craigslist census, 2026-11-25).
const WHOLE_PRICE = /^\$\s?[\d,]+(?:\.\d{2})?$/;
function ownPrice(el) {
  const walk = el.ownerDocument.createTreeWalker(el, 4);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.nodeValue.trim();
    if (WHOLE_PRICE.test(t)) return t.replace(/\s/g, '');
  }
  return '';
}
function priceFor(card, site, id) {
  const levels = [];
  for (let el = card, i = 0; i < 6 && el; i++, el = el.parentElement) {
    const neighbour = [...el.querySelectorAll('a[href]')].some(a => { const m = site.item.exec(a.href); return m && m[1] !== id; });
    if (neighbour) break;
    levels.push(el);
    const own = ownPrice(el);
    if (own) return own;
  }
  for (const el of levels) {
    const m = clean(el.textContent).match(PRICE);
    if (m) return m[0].replace(/\s/g, '');
  }
  return '';
}

/** Climb from a listing link to the smallest ancestor that also holds its photo. */
function cardFor(link) {
  let el = link;
  for (let i = 0; i < 7 && el.parentElement; i++) {
    if (el.querySelector('img') && el.getBoundingClientRect().height > 60) return el;
    el = el.parentElement;
  }
  return link;
}

function titleFor(link, card, site) {
  if (site.site === 'facebook') return facebookTitle(link);
  // Craigslist puts the clean title on the result's own element; its link text and photo name add a photo counter
  // ("… Cradle 1"), and its photo link has no text at all. On Craigslist the element's title is the title.
  const named = link.closest('[title]');
  if (site.site === 'craigslist' && named && clean(named.getAttribute('title')).length > 3) return clean(named.getAttribute('title'));
  const own = named && cleanTitle(named.getAttribute('title'));
  if (own && own.length > 3 && cleanTitle(link.textContent).startsWith(own)) return own;
  const heading = card.querySelector('h1, h2, h3, [role=heading]');
  const candidates = [
    link.getAttribute('aria-label'), heading && heading.textContent, link.textContent,
    card.querySelector('img') && card.querySelector('img').alt,
  ].map(cleanTitle).filter(t => t.length > 3);
  // Prefer the longest of the short texts: titles are a line, not a paragraph.
  return candidates.filter(t => t.length <= 200).sort((a, b) => b.length - a.length)[0] || candidates[0] || '';
}

/** Listings shown on a search or browse page. */
export function listingsOnPage(doc = document, loc = location) {
  const site = readable(loc);
  if (!site) return { site: null, listings: [] };
  const byId = new Map();
  for (const link of doc.querySelectorAll('a[href]')) {
    const m = site.item.exec(link.href);
    if (!m) continue;
    const id = m[1];
    const card = cardFor(link);
    const title = titleFor(link, card, site);
    // A listing usually has two links (photo and title). Keep the one with the longer title, and take the price or
    // photo from the other when it has them.
    const found = { id, site: site.site, url: link.href.split('#')[0], title, price: priceFor(card, site, id), image: bestImage(card), el: card };
    const prior = byId.get(id);
    const [keep, other] = prior && prior.title.length >= title.length ? [prior, found] : [found, prior];
    byId.set(id, other ? { ...keep, price: keep.price || other.price, image: keep.image || other.image } : keep);
  }
  return { site: site.site, listings: [...byId.values()].filter(l => l.title) };
}

/** The heading a badge goes beside on an item page: the item's own, which on Facebook is the open dialog's. */
export function detailHeading(doc = document, loc = location) {
  const site = readable(loc);
  if (!site || !site.item.test(loc.href)) return null;
  const dialog = site.site === 'facebook' ? [...doc.querySelectorAll('[role=dialog]')].reverse().find(d => d.querySelector('h1')) : null;
  const main = dialog || doc.querySelector('main, #mainContent, [role=main]') || doc.body;
  return [...main.querySelectorAll('h1')].find(h => { const t = clean(h.textContent); return t && !/^(marketplace|search results|notifications)$/i.test(t); }) || null;
}

/** The single listing on an item page, with its description. Null on other pages. */
export function listingDetail(doc = document, loc = location) {
  const site = readable(loc);
  if (!site) return null;
  const m = site.item.exec(loc.href);
  if (!m) return null;
  // Facebook opens an item from a search in a dialog over the search page; the item is the dialog then.
  const dialog = site.site === 'facebook' ? [...doc.querySelectorAll('[role=dialog]')].reverse().find(d => d.querySelector('h1')) : null;
  const main = dialog || doc.querySelector('main, #mainContent, [role=main]') || doc.body;
  const heading = [...main.querySelectorAll('h1')].map(h => clean(h.textContent)).find(t => t && !/^(marketplace|search results|notifications)$/i.test(t));
  const title = heading || clean(doc.title);
  let text = String(main.innerText || main.textContent || '').replace(SITE_NOTICES, '');
  if (site.site === 'facebook') {
    const from = title ? text.indexOf(title) : -1;
    if (from > -1) text = text.slice(from + title.length);
    const end = text.search(FB_END);
    if (end > -1) text = text.slice(0, end);
    // The page's buttons, not the seller's words.
    text = text.replace(/^(?:Message|Save|Share|Details|Send seller a message|Send)$/gm, '');
  }
  return {
    id: m[1], site: site.site, url: loc.href.split('#')[0], title,
    description: clean(text).slice(0, 1500),
    image: bestImage(main),
  };
}
