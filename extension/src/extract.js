// Find listings on a marketplace page.
// Sites change their class names often, so this keys on the one thing that stays stable: the shape of a listing's link.

const SITES = [
  { site: 'ebay', host: /(^|\.)ebay\.com$/, item: /\/itm\/(?:[^/?#]+\/)?(\d{9,})/ },
  { site: 'mercari', host: /(^|\.)mercari\.com$/, item: /\/item\/(m\d+)/ },
  // Craigslist moved from /d/<slug>/<digits>.html to /view/d/<slug>/<code> in 2026; both are matched.
  { site: 'craigslist', host: /(^|\.)craigslist\.org$/, item: /\/(?:view\/)?d\/[^/]+\/([A-Za-z0-9]{8,})(?:\.html)?(?:[?#]|$)/ },
  // The practice listings on the project's own site (web/try/), for trying the extension without a live marketplace.
  { site: 'practice', host: /^(still-recalled\.web\.app|still-recalled\.firebaseapp\.com|localhost)$/, item: /\/try\/item\/([a-z0-9-]+)\.html/ },
];

export function siteFor(hostname) {
  return SITES.find(s => s.host.test(hostname)) || null;
}

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
function priceFor(card, site, id) {
  let el = card;
  for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
    const neighbour = [...el.querySelectorAll('a[href]')].some(a => { const m = site.item.exec(a.href); return m && m[1] !== id; });
    if (neighbour) return '';
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

function titleFor(link, card) {
  // Craigslist puts the clean title on the result's own element; its link text adds a photo counter ("… Cradle 1").
  const named = link.closest('[title]');
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
  const site = siteFor(loc.hostname);
  if (!site) return { site: null, listings: [] };
  const byId = new Map();
  for (const link of doc.querySelectorAll('a[href]')) {
    const m = site.item.exec(link.href);
    if (!m) continue;
    const id = m[1];
    const card = cardFor(link);
    const title = titleFor(link, card);
    // A listing usually has two links (photo and title). Keep the one with the longer title, and take the price or
    // photo from the other when it has them.
    const found = { id, site: site.site, url: link.href.split('#')[0], title, price: priceFor(card, site, id), image: bestImage(card), el: card };
    const prior = byId.get(id);
    const [keep, other] = prior && prior.title.length >= title.length ? [prior, found] : [found, prior];
    byId.set(id, other ? { ...keep, price: keep.price || other.price, image: keep.image || other.image } : keep);
  }
  return { site: site.site, listings: [...byId.values()].filter(l => l.title) };
}

/** The single listing on an item page, with its description. Null on other pages. */
export function listingDetail(doc = document, loc = location) {
  const site = siteFor(loc.hostname);
  if (!site) return null;
  const m = site.item.exec(loc.href);
  if (!m) return null;
  const main = doc.querySelector('main, #mainContent, [role=main]') || doc.body;
  const title = clean((doc.querySelector('h1') || {}).textContent) || clean(doc.title);
  return {
    id: m[1], site: site.site, url: loc.href.split('#')[0], title,
    description: clean(main.innerText || main.textContent).slice(0, 1500),
    image: bestImage(main),
  };
}
