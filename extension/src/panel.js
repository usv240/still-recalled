// The side panel: what was found on the page in the active tab, one listing's detail, and settings.
// It renders from the per-tab state the service worker keeps in chrome.storage.session and follows its changes.
import { h } from './ui/dom.js';
import { icon, mark } from './ui/icons.js';
import { detailView } from './ui/detail.js';
import { siteFor } from './extract.js';
import { byConcern } from '../../shared/present.mjs';
import { clip } from '../../shared/text.mjs';
import { deviceModel, deviceStatus, hasCloudAccess } from './ai.js';

const SITE_NAMES = { ebay: 'eBay', mercari: 'Mercari', craigslist: 'Craigslist', practice: 'Practice listings' };
const DEFAULTS = { cloud: true, badges: true };

const $view = document.getElementById('view');
document.getElementById('mark').append(mark(18));
const settingsBtn = document.getElementById('settings');
settingsBtn.append(icon('settings'));

let tab = null;            // { id, url }
let state = null;          // per-tab state from the service worker
let settings = { ...DEFAULTS };
let meta = null;           // recall data stamp
let model = 'checking';    // built-in model status, seen from this panel
let view = { name: 'list' };
let shownView = '';
const seenRows = new Set();

// ---- Data ---------------------------------------------------------------------------------------------------------
async function loadTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  tab = t ? { id: t.id, url: t.url || '' } : null;
  state = tab ? (await chrome.storage.session.get(`tab:${tab.id}`))[`tab:${tab.id}`] || null : null;
  seenRows.clear();
  if (state) Object.keys(state.results).forEach(id => seenRows.add(id));
  // Opened from a listing's popover: go straight to that listing.
  if (tab) {
    const key = `focus:${tab.id}`;
    const focus = (await chrome.storage.session.get(key))[key];
    if (focus && Date.now() - focus.at < 15000) {
      view = { name: 'detail', id: focus.id };
      chrome.storage.session.remove(key);
    } else if (view.name === 'detail') view = { name: 'list' };
  }
  render();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && tab && changes[`tab:${tab.id}`]) {
    state = changes[`tab:${tab.id}`].newValue || null;
    if (view.name !== 'settings') render();
  }
  if (area === 'session' && tab && changes[`focus:${tab.id}`] && changes[`focus:${tab.id}`].newValue) loadTab();
  if (area === 'local' && changes.settings) { settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) }; if (view.name === 'settings') render(); }
});
chrome.tabs.onActivated.addListener(() => { view = { name: 'list' }; loadTab(); });
chrome.tabs.onUpdated.addListener((id, info) => { if (tab && id === tab.id && info.url) { view = { name: 'list' }; loadTab(); } });

// ---- Rendering --------------------------------------------------------------------------------------------------
function render() {
  let node;
  if (view.name === 'settings') node = settingsView();
  else if (!state) node = tab && siteFor(hostOf(tab.url)) ? loadingView() : unsupportedView();
  else if (view.name === 'detail' && state.results[view.id]) node = detailPage(state.results[view.id]);
  else { view = { name: 'list' }; node = listView(); }

  const key = view.name;
  if (key !== shownView) node.classList.add(shownView && key === 'list' ? 'enter-back' : 'enter');
  shownView = key;
  settingsBtn.setAttribute('aria-pressed', String(view.name === 'settings'));
  $view.replaceChildren(node);
}

function go(next) {
  view = next;
  render();
  scrollTo({ top: 0 });
}

const hostOf = url => { try { return new URL(url).hostname; } catch { return ''; } };
const flaggedOf = s => Object.values(s.results).filter(r => r.level === 'likely' || r.level === 'possible').sort(byConcern);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The heading answers the screen's question (does anything here need a look?); the page it is about sits under it. */
function headBlock({ flagged, checked, done }) {
  const site = SITE_NAMES[state.site] || 'This page';
  const title = flagged.length
    ? `${plural(flagged.length, 'listing needs', 'listings need')} a look`
    : done ? 'No matches on this page' : 'Nothing flagged so far';
  const where = state.kind === 'item'
    ? [`${site} listing`]
    : state.scope ? [`${site} search for `, h('q', {}, state.scope)] : [`${site} search`];
  return h('div', { class: 'head' },
    h('h1', {}, title),
    h('p', { class: 'where' }, ...where, done ? ` · ${plural(checked, 'listing', 'listings')} checked` : ''),
  );
}

function listView() {
  const results = Object.values(state.results);
  const flagged = flaggedOf(state);
  const errors = results.filter(r => r.level === 'error');
  const pending = Object.keys(state.pending).length;
  const checked = results.length;
  const done = pending === 0;

  const parts = [headBlock({ flagged, checked, done })];

  if (!done) {
    parts.push(h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': state.total, 'aria-valuenow': checked, 'aria-label': 'Listings checked' },
      h('div', { class: 'progress-track' }, h('div', { class: 'progress-fill', style: { transform: `scaleX(${state.total ? checked / state.total : 0})` } })),
      h('div', { class: 'progress-label' }, h('span', {}, `Checked ${checked} of ${state.total}`), h('span', {}, model === 'available' ? 'On this device' : 'By their words'))));
  }

  const modelNote = modelNotice();
  if (modelNote) parts.push(modelNote);

  const likely = flagged.filter(r => r.level === 'likely');
  const possible = flagged.filter(r => r.level === 'possible');
  if (likely.length) parts.push(group('Likely', likely));
  if (possible.length) parts.push(group('Worth checking', possible));

  if (errors.length) {
    parts.push(h('div', { class: 'notice' },
      h('p', {}, `${plural(errors.length, 'listing', 'listings')} could not be checked.`),
      h('button', { class: 'link', type: 'button', onclick: recheck }, icon('refresh', { size: 14 }), 'Check this page again')));
  }

  if (done) {
    parts.push(h('p', { class: 'note' },
      h('strong', {}, 'No match does not mean safe. '),
      'Still Recalled checks U.S. recalls from the last five years and four infant sleep product types. Whether a unit is recalled usually depends on the model number on its label.'));
  }
  if (!flagged.length && !done) parts.push(skeletonRows(2));
  return h('section', { class: 'view' }, ...parts);
}

function group(title, rows) {
  return h('section', { class: 'group' },
    h('h2', { class: 'group-head' }, title, h('span', { class: 'num' }, String(rows.length))),
    h('ul', { class: 'rows' }, ...rows.map(r => h('li', {}, row(r)))));
}

function row(r) {
  const what = r.kind === 'recall' ? `${r.badge} · ${clip(r.recall.product, 60)}` : r.badge;
  const isNew = !seenRows.has(r.id);
  seenRows.add(r.id);
  const thumb = r.listing.image ? h('img', { class: 'thumb', src: r.listing.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'thumb' });
  return h('button', { class: `row${isNew ? ' row-new' : ''}`, type: 'button', onclick: () => go({ name: 'detail', id: r.id }) },
    thumb,
    h('span', { class: 'row-text' },
      h('span', { class: 'row-line1' }, h('span', { class: 'row-title' }, r.listing.title), r.listing.price ? h('span', { class: 'row-price' }, r.listing.price) : null),
      h('span', { class: 'row-line2' }, h('span', { class: `dot ${r.level === 'likely' ? 'is-likely' : 'is-possible'}` }), h('span', {}, what))));
}

function detailPage(r) {
  const flaggedCount = flaggedOf(state).length;
  const site = SITE_NAMES[state.site] || '';
  return h('section', { class: 'view' },
    h('button', { class: 'back', type: 'button', onclick: () => go({ name: 'list' }) }, icon('back'), `All flagged (${flaggedCount})`),
    h('div', { class: 'listing-head' },
      h('h1', {}, r.listing.title),
      h('div', { class: 'listing-meta' },
        r.listing.price ? h('span', { class: 'price' }, r.listing.price) : null,
        site ? h('span', {}, site) : null,
        h('button', { class: 'link', type: 'button', onclick: () => tab && chrome.tabs.sendMessage(tab.id, { type: 'sr:reveal', id: r.id }).catch(() => {}) }, 'Show on page'))),
    h('div', { class: 'detail-card' }, detailView(r, { onLabel: (dataUrl, recall) => chrome.runtime.sendMessage({ type: 'sr:read-label', dataUrl, recall }).then(r => { if (!r || r.error) throw new Error((r && r.error) || 'no answer'); return r; }) })));
}

function skeletonRows(n) {
  return h('div', { 'aria-hidden': 'true' }, ...Array.from({ length: n }, () =>
    h('div', { class: 'skel' }, h('div', { class: 'skel-box' }), h('div', { class: 'skel-lines' },
      h('div', { class: 'skel-line', style: { width: '78%' } }), h('div', { class: 'skel-line', style: { width: '52%' } })))));
}

function loadingView() {
  return h('section', { class: 'view' },
    h('div', { class: 'head' }, h('h1', {}, 'Reading this page'), h('p', { class: 'where' }, SITE_NAMES[siteFor(hostOf(tab.url)).site])),
    h('p', { class: 'note' }, 'If nothing appears, reload the page once: it was open before Still Recalled was installed.'),
    skeletonRows(3));
}

function unsupportedView() {
  return h('section', { class: 'view empty' },
    h('h1', {}, 'Open a secondhand listing to check it'),
    h('p', { class: 'note' }, 'Still Recalled reads search results and listings on these sites and flags products that match a U.S. recall or an infant sleep product type linked to deaths.'),
    h('ul', { class: 'sites' },
      h('li', {}, h('span', {}, 'eBay'), h('span', {}, 'Search and listings')),
      h('li', {}, h('span', {}, 'Mercari'), h('span', {}, 'Search and listings')),
      h('li', {}, h('span', {}, 'Craigslist'), h('span', {}, 'Search and listings'))),
    h('p', { class: 'note' }, 'Photos are checked on this computer by Chrome’s built-in AI. Only listings it flags are double-checked in the cloud.'));
}

function modelNotice() {
  if (model === 'available' || model === 'checking') return null;
  if (model === 'downloadable' || model === 'downloading') {
    const label = h('span', {}, model === 'downloading' ? 'Downloading…' : 'Download the model');
    const btn = h('button', { class: 'btn btn-secondary', type: 'button' }, label);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await deviceModel({}).initializeDeviceModel(p => { label.textContent = `Downloading ${Math.round(p * 100)}%`; });
        model = await deviceStatus();
        if (model === 'available') recheck();
      } catch { label.textContent = 'Download failed. Try again'; btn.disabled = false; }
    });
    return h('div', { class: 'notice' },
      h('p', {}, 'Photos are checked by Chrome’s built-in AI model, which is not on this computer yet. Until it is, listings are matched by their words.'), btn);
  }
  return h('div', { class: 'notice' },
    h('p', {}, `This computer cannot run Chrome’s built-in AI model, so photos are not checked here. Listings are matched by their words${settings.cloud && hasCloudAccess ? ', and flagged ones are checked in the cloud' : ''}.`));
}

function settingsView() {
  const toggle = (key, title, desc) => {
    const input = h('input', { type: 'checkbox', role: 'switch', class: 'switch', id: `set-${key}`, 'aria-describedby': `desc-${key}` });
    input.checked = settings[key] !== false;
    input.addEventListener('change', () => chrome.storage.local.set({ settings: { ...settings, [key]: input.checked } }));
    return h('div', { class: 'setting' },
      h('label', { class: 'setting-title', for: `set-${key}` }, title), input,
      h('p', { class: 'setting-desc', id: `desc-${key}` }, desc));
  };
  const modelWord = { available: 'Ready', downloadable: 'Not downloaded', downloading: 'Downloading', unavailable: 'Not supported here', absent: 'Not supported here' }[model] || 'Checking';
  return h('section', { class: 'view' },
    h('button', { class: 'back', type: 'button', onclick: () => go({ name: 'list' }) }, icon('back'), 'Back'),
    h('div', { class: 'head' }, h('h1', {}, 'Settings')),
    h('div', {},
      toggle('cloud', 'Cloud double-check', 'Sends only flagged listings (title, price and photo) to Gemini through Firebase, with the recall notice. Every other listing is checked on this computer.'),
      toggle('badges', 'Badges on listings', 'Show a badge on flagged listings on eBay, Mercari and Craigslist.')),
    h('dl', { class: 'kv' },
      h('div', {}, h('dt', {}, 'On-device model'), h('dd', {}, modelWord)),
      h('div', {}, h('dt', {}, 'Cloud check'), h('dd', {}, hasCloudAccess ? 'Set up' : 'Not set up in this build')),
      h('div', {}, h('dt', {}, 'Recall notices'), h('dd', {}, meta ? meta.count.toLocaleString('en-US') : '–')),
      h('div', {}, h('dt', {}, 'Recalls since'), h('dd', {}, meta ? meta.since : '–')),
      h('div', {}, h('dt', {}, 'Data updated'), h('dd', {}, meta ? meta.built.slice(0, 10) : '–'))),
    h('button', { class: 'btn btn-secondary', type: 'button', style: { justifySelf: 'start' }, onclick: recheck }, icon('refresh'), 'Clear saved results'));
}

async function recheck() {
  if (!tab) return;
  await chrome.runtime.sendMessage({ type: 'sr:recheck', tabId: tab.id }).catch(() => {});
  go({ name: 'list' });
}

settingsBtn.addEventListener('click', () => go(view.name === 'settings' ? { name: 'list' } : { name: 'settings' }));

// ---- Start ------------------------------------------------------------------------------------------------------
(async () => {
  settings = { ...DEFAULTS, ...((await chrome.storage.local.get('settings')).settings || {}) };
  meta = await fetch(chrome.runtime.getURL('data/meta.json')).then(r => r.json()).catch(() => null);
  await loadTab();
  model = await deviceStatus();
  render();
})();
