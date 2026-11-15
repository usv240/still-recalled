// Find listings on a marketplace page.
// Sites change their class names often, so this keys on the one thing that stays stable: the shape of a listing's link.

const SITES = [
  { site: 'ebay', host: /(^|\.)ebay\.com$/, item: /\/itm\/(?:[^/?#]+\/)?(\d{9,})/ },
  { site: 'mercari', host: /(^|\.)mercari\.com$/, item: /\/item\/(m\d+)/ },
  // Craigslist moved from /d/<slug>/<digits>.html to /view/d/<slug>/<code> in 2026; both are matched.
  { site: 'craigslist', host: /(^|\.)craigslist\.org$/, item: /\/(?:view\/)?d\/[^/]+\/([A-Za-z0-9]{8,})(?:\.html)?(?:[?#]|$)/ },
  { site: 'facebook', host: /(^|\.)facebook\.com$/, item: /\/marketplace\/item\/(\d+)/ },
];

export function siteFor(hostname) {
  return SITES.find(s => s.host.test(hostname)) || null;
}

// eBay appends screen-reader text to link names; it is not part of the title.
const SITE_NOISE = /\s*Opens in a new window or tab\s*$/i;
const clean = s => String(s || '').replace(/\s+/g, ' ').replace(SITE_NOISE, '').replace(/^New Listing/i, '').trim();
// Some cards put the price and a discount inside the title link ("21% Snuggle me Lounger$42.00"); a title never needs them.
const cleanTitle = s => clean(s).replace(/\$\s?[\d,]+(?:\.\d{2})?/g, ' ').replace(/^\d{1,2}%\s*(off\s*)?/i, '').replace(/\s+/g, ' ').trim();

function bestImage(root) {
  let best = null, bestArea = 0;
  for (const img of root.querySelectorAll('img')) {
    const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
    if (!src || src.startsWith('data:')) continue;
    const area = (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0);
    if (area >= bestArea) { best = src; bestArea = area; }
  }
  return best;
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
    const prior = byId.get(id);
    if (prior && prior.title.length >= title.length) continue;
    const price = (clean(card.textContent).match(/\$\s?[\d,]+(?:\.\d{2})?/) || [''])[0];
    byId.set(id, { id, site: site.site, url: link.href.split('#')[0], title, price, image: bestImage(card), el: card });
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
