// Runs on marketplace pages: reads the listings, sends them to be checked, and puts a badge on each flagged one.
// The badge and its popover live in a closed shadow root, so the page's styles and scripts cannot reach them.
import { listingsOnPage, listingDetail, siteFor } from './extract.js';
import { addFonts, buildBadge, attachBadge } from './ui/badge.js';

const site = siteFor(location.hostname);
let pageUrl = '';
const sent = new Set();          // listing ids already reported for this page
const cards = new Map();         // id -> { el, inline }
const results = new Map();       // id -> flagged result
const hosts = new Map();         // id -> badge host element
let showBadges = true;

const urlNow = () => location.href.split('#')[0];

function scopeOf() {
  const u = new URL(location.href);
  const q = u.searchParams.get('_nkw') || u.searchParams.get('keyword') || u.searchParams.get('query') || u.searchParams.get('q');
  return q ? q.trim() : '';
}

function resetPage() {
  pageUrl = urlNow();
  sent.clear(); cards.clear(); results.clear();
  for (const host of hosts.values()) host.remove();
  hosts.clear();
}

/** Report listings not reported yet. Called on load, on DOM changes, and when the URL changes in place. */
function scan() {
  if (!site) return;
  if (urlNow() !== pageUrl) resetPage();
  const fresh = [];
  const detail = listingDetail();
  if (detail) {
    const heading = document.querySelector('h1');
    if (heading) cards.set(detail.id, { el: heading, inline: true });
    if (!sent.has(detail.id)) { sent.add(detail.id); fresh.push(detail); }
  }
  for (const l of listingsOnPage().listings) {
    if (detail && l.id === detail.id) continue;
    cards.set(l.id, { el: l.el, inline: false });
    if (!sent.has(l.id)) {
      sent.add(l.id);
      const { el, ...plain } = l;
      fresh.push(plain);
    }
  }
  // Results can arrive before a lazily rendered card exists, and pages re-render cards: keep badges attached.
  for (const id of results.keys()) ensureBadge(id);
  if (!fresh.length) return;
  const scope = detail ? detail.title : scopeOf();
  chrome.runtime.sendMessage({
    type: 'sr:page',
    page: { url: pageUrl, site: site.site, kind: detail ? 'item' : 'search', scope, listings: fresh },
  }).catch(() => {});
}

// ---- Badges --------------------------------------------------------------------------------------------------
function ensureBadge(id) {
  const r = results.get(id), card = cards.get(id);
  if (!r || !card || !showBadges) return;
  const existing = hosts.get(id);
  if (existing && existing.isConnected) return;
  addFonts(p => chrome.runtime.getURL(p));
  const host = buildBadge(r, { onOpenPanel: () => chrome.runtime.sendMessage({ type: 'sr:open-panel', id: r.id }).catch(() => {}) });
  hosts.set(id, host);
  attachBadge(host, card);
}

function applyResults(list) {
  for (const r of list) {
    if (r.level !== 'likely' && r.level !== 'possible') continue;
    results.set(r.id, r);
    ensureBadge(r.id);
  }
}

// ---- Wiring ------------------------------------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg) return false;
  if (msg.type === 'sr:results') applyResults(msg.results);
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
  if (!showBadges) { for (const host of hosts.values()) host.remove(); hosts.clear(); }
  else for (const id of results.keys()) ensureBadge(id);
});

if (site) {
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(scan, 600); };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', later);
  scan();
}
