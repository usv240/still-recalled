// Runs on marketplace pages: reads the listings, sends them to be checked, and puts a badge on each flagged one.
// The badge and its popover live in a closed shadow root, so the page's styles and scripts cannot reach them.
import { listingsOnPage, listingDetail, detailHeading, siteFor } from './extract.js';
import { addFonts, buildBadge, buildPending, attachBadge } from './ui/badge.js';

const site = siteFor(location.hostname);
let pageUrl = '';
const sent = new Set();          // listing ids already reported for this page
const cards = new Map();         // id -> { el, inline }
const results = new Map();       // id -> flagged result
const hosts = new Map();         // id -> badge host element
const pending = new Map();       // id -> the quiet pill on a listing still being checked
let showBadges = true;

const urlNow = () => location.href.split('#')[0];

function scopeOf() {
  const u = new URL(location.href);
  const q = u.searchParams.get('_nkw') || u.searchParams.get('keyword') || u.searchParams.get('query') || u.searchParams.get('q');
  return q ? q.trim() : '';
}

function resetPage() {
  pageUrl = urlNow();
  sent.clear(); cards.clear(); results.clear(); waitingSince.clear();
  for (const host of hosts.values()) host.remove();
  hosts.clear();
  for (const host of pending.values()) host.remove();
  pending.clear();
}

/** Where a listing's check is: "device" (the built-in model is looking), "cloud" (confirming a flag), "done". */
function setStage(id, stage) {
  const old = pending.get(id);
  if (stage === 'done' || results.has(id) || !showBadges) { if (old) { old.remove(); pending.delete(id); } return; }
  const card = cards.get(id);
  if (!card || card.inline || !card.el.isConnected) return;
  if (old && old.isConnected) { old.setStage(stage); return; }
  addFonts(file => chrome.runtime.getURL(file));
  const host = buildPending(stage);
  attachBadge(host, card, { corner: site.site === 'craigslist' ? 'right' : 'left' });
  pending.set(id, host);
}

// A listing is reported once, so it must not go before its photo: the models look at the photo. Craigslist draws its
// photos after the listings, and loads them lazily as they near the screen; reading the page at once sent 14 of 15
// listings without one (2026-11-16). A listing without a photo waits until it has one, or until it has been near the
// screen for PHOTO_WAIT_MS without one (some listings have no photo at all).
const PHOTO_WAIT_MS = 2500;
const waitingSince = new Map();   // id -> when it was first seen near the screen without a photo
let recheck = 0;
function readyToSend(l) {
  if (l.image) return true;
  const r = l.el.getBoundingClientRect();
  if (r.top > innerHeight * 1.5 || r.bottom < -innerHeight * 0.5) return false;
  if (!waitingSince.has(l.id)) waitingSince.set(l.id, Date.now());
  const left = PHOTO_WAIT_MS - (Date.now() - waitingSince.get(l.id));
  if (left <= 0) return true;
  clearTimeout(recheck);
  recheck = setTimeout(scan, left + 50);
  return false;
}

/** Report listings not reported yet. Called on load, on DOM changes, and when the URL changes in place. */
function scan() {
  if (!site) return;
  if (urlNow() !== pageUrl) resetPage();
  const fresh = [];
  const detail = listingDetail();
  if (detail) {
    const heading = detailHeading() || document.querySelector('h1');
    if (heading) cards.set(detail.id, { el: heading, inline: true });
    if (!sent.has(detail.id)) { sent.add(detail.id); fresh.push(detail); }
  }
  for (const l of listingsOnPage().listings) {
    if (detail && l.id === detail.id) continue;
    cards.set(l.id, { el: l.el, inline: false });
    if (!sent.has(l.id) && readyToSend(l)) {
      sent.add(l.id);
      const { el, ...plain } = l;
      fresh.push(plain);
    }
  }
  // Results can arrive before a lazily rendered card exists, and pages re-render cards: keep badges attached.
  for (const id of results.keys()) ensureBadge(id);
  reportOnScreen();
  if (!fresh.length) return;
  const scope = detail ? detail.title : scopeOf();
  chrome.runtime.sendMessage({
    type: 'sr:page',
    page: { url: pageUrl, site: site.site, kind: detail ? 'item' : 'search', scope, listings: fresh },
  }).catch(() => {});
}

// The built-in model looks at one listing at a time, a few seconds each, so a long page takes minutes. Tell the engine
// which listings are on screen now, and it looks at those first: the badges arrive where the shopper is looking.
let lastOnScreen = '';
function reportOnScreen() {
  const ids = [];
  for (const [id, c] of cards) {
    if (c.inline || !sent.has(id) || results.has(id)) continue;
    const r = c.el.getBoundingClientRect();
    if (r.bottom > -innerHeight * 0.25 && r.top < innerHeight * 1.25) ids.push(id);
  }
  const key = ids.join(',');
  if (key === lastOnScreen) return;
  lastOnScreen = key;
  chrome.runtime.sendMessage({ type: 'sr:on-screen', ids }).catch(() => {});
}

// ---- Badges --------------------------------------------------------------------------------------------------
function ensureBadge(id) {
  const r = results.get(id), card = cards.get(id);
  if (!r || !card || !showBadges) return;
  const existing = hosts.get(id);
  if (existing && existing.isConnected) return;
  addFonts(p => chrome.runtime.getURL(p));
  const host = buildBadge(r, {
    onOpenPanel: () => chrome.runtime.sendMessage({ type: 'sr:open-panel', id: r.id }).catch(() => {}),
    onLabel: (dataUrl, recall) => chrome.runtime.sendMessage({ type: 'sr:read-label', dataUrl, recall }).then(r => { if (!r || r.error) throw new Error((r && r.error) || 'no answer'); return r; }),
    // On the listing's own page, the card can watch it too (the same entry as the side panel's button).
    watch: card.inline ? {
      get: () => chrome.storage.local.get('watch').then(({ watch }) => !!(watch && watch[`${site.site}:${r.id}`])),
      set: on => chrome.runtime.sendMessage({ type: 'sr:watch', on, item: { site: site.site, id: r.id, listing: { ...r.listing, id: r.id } } }),
    } : null,
  });
  hosts.set(id, host);
  attachBadge(host, card, { corner: site.site === 'craigslist' ? 'right' : 'left' });
}

function applyResults(list) {
  for (const r of list) {
    if (r.level !== 'likely' && r.level !== 'possible') continue;
    results.set(r.id, r);
    setStage(r.id, 'done');
    ensureBadge(r.id);
  }
  if (site && site.site === 'practice') document.documentElement.dataset.srFlagged = String(results.size);
}

// The practice page says whether the extension is on it: a first-time user otherwise can't tell until a badge appears.
if (site && site.site === 'practice') document.documentElement.dataset.stillRecalled = 'on';

// ---- Wiring ------------------------------------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg) return false;
  if (msg.type === 'sr:results') applyResults(msg.results);
  if (msg.type === 'sr:stage') setStage(msg.id, msg.stage);
  if (msg.type === 'sr:reveal') { ensureBadge(msg.id); const host = hosts.get(msg.id); if (host) host.reveal(); }
  if (msg.type === 'sr:rescan') { resetPage(); scan(); }
  if (msg.type === 'sr:read-page') {
    // Developer setup check (dev.html).
    const { listings } = listingsOnPage();
    reply({
      url: location.href, site: site && site.site, languageModelInContentScript: 'LanguageModel' in self,
      count: listings.length, withImage: listings.filter(l => l.image).length, withPrice: listings.filter(l => l.price).length,
      sample: listings.slice(0, 8).map(({ el, ...rest }) => rest), detail: listingDetail(),
    });
  }
  return false;
});

chrome.storage.local.get('settings').then(({ settings }) => { showBadges = !settings || settings.badges !== false; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  showBadges = !changes.settings.newValue || changes.settings.newValue.badges !== false;
  if (!showBadges) { for (const host of hosts.values()) host.remove(); hosts.clear(); for (const host of pending.values()) host.remove(); pending.clear(); }
  else for (const id of results.keys()) ensureBadge(id);
});

if (site) {
  // Scan once the page has been quiet for 0.6 s, and at least every 2 s while it keeps changing: Facebook's pages
  // change many times a second, and a scan that waits for quiet would never run there.
  let timer = 0, first = 0;
  const later = () => {
    clearTimeout(timer);
    first ||= Date.now();
    timer = setTimeout(() => { first = 0; scan(); }, Math.max(0, Math.min(600, 2000 - (Date.now() - first))));
  };
  // A lazy photo arriving changes an attribute, not the tree; scrolling brings waiting listings near the screen.
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  addEventListener('scroll', later, { passive: true, capture: true });
  // Badges placed on a listing's row follow its photo when the layout changes width.
  let sizing = 0;
  addEventListener('resize', () => { cancelAnimationFrame(sizing); sizing = requestAnimationFrame(() => { for (const host of hosts.values()) if (host.place) host.place(); }); });
  addEventListener('popstate', later);
  scan();
}
