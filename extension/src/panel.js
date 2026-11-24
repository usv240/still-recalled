// The side panel: what was found on the page in the active tab, one listing's detail, and settings.
// It renders from the per-tab state the service worker keeps in chrome.storage.session and follows its changes.
import { h } from './ui/dom.js';
import { icon, mark } from './ui/icons.js';
import { detailView } from './ui/detail.js';
import { siteFor } from './extract.js';
import { byConcern } from '../../shared/present.mjs';
import { clip } from '../../shared/text.mjs';
import { safeUrl } from './ui/dom.js';
import { deviceModel, deviceStatus, hasCloudAccess } from './ai.js';

const SITE_NAMES = { ebay: 'eBay', mercari: 'Mercari', craigslist: 'Craigslist', practice: 'Practice listings' };
const DEFAULTS = { cloud: true, badges: true, thorough: false };

const $view = document.getElementById('view');
const $status = document.getElementById('status');
let spoken = '';
/** One line for screen readers, said only when it changes: how many listings need a look, and when the page is done. */
function announce(text) {
  if (!$status || !text || text === spoken) return;
  spoken = text;
  $status.textContent = text;
}
document.getElementById('mark').append(mark(18));
const settingsBtn = document.getElementById('settings');
settingsBtn.append(icon('settings'));
const watchBtn = document.getElementById('watching');
watchBtn.append(icon('bell'), Object.assign(document.createElement('span'), { textContent: 'Watch list' }));

let tab = null;            // { id, url }
let state = null;          // per-tab state from the service worker
let settings = { ...DEFAULTS };
let meta = null;           // recall data stamp
let live = null;           // recalls found since the build: { cards, checkedAt, added }
let watch = {};            // listings the shopper is watching, by "site:id"
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
  if (area === 'local' && (changes.watch || changes.live)) {
    if (changes.watch) watch = changes.watch.newValue || {};
    if (changes.live) live = changes.live.newValue || null;
    render();
  }
});
chrome.tabs.onActivated.addListener(() => { view = { name: 'list' }; loadTab(); });
chrome.tabs.onUpdated.addListener((id, info) => { if (tab && id === tab.id && info.url) { view = { name: 'list' }; loadTab(); } });

// ---- Rendering --------------------------------------------------------------------------------------------------
function render() {
  let node;
  if (view.name === 'settings') node = settingsView();
  else if (view.name === 'watch') node = watchView();
  else if (!state) node = tab && siteFor(hostOf(tab.url)) ? loadingView() : unsupportedView();
  else if (view.name === 'detail' && state.results[view.id]) node = detailPage(state.results[view.id]);
  else { view = { name: 'list' }; node = listView(); }

  const key = view.name;
  if (key !== shownView) node.classList.add(shownView && key === 'list' ? 'enter-back' : 'enter');
  shownView = key;
  settingsBtn.setAttribute('aria-pressed', String(view.name === 'settings'));
  watchBtn.setAttribute('aria-pressed', String(view.name === 'watch'));
  watchBtn.classList.toggle('has-alert', Object.values(watch).some(w => w.alert && !w.alert.seen));
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
  announce(done
    ? (flagged.length ? `Done. ${plural(flagged.length, 'listing needs', 'listings need')} a look.` : `Done. No matches among ${plural(checked, 'listing', 'listings')}.`)
    : flagged.length ? `${plural(flagged.length, 'listing needs', 'listings need')} a look so far.` : '');

  if (!done) {
    parts.push(h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': state.total, 'aria-valuenow': checked, 'aria-label': 'Listings checked' },
      h('div', { class: 'progress-track' }, h('div', { class: 'progress-fill', style: { transform: `scaleX(${state.total ? checked / state.total : 0})` } })),
      h('div', { class: 'progress-label' }, h('span', {}, `Checked ${checked} of ${state.total}`), h('span', {}, model === 'available' ? 'On this computer' : 'Matching by name'))));
  }

  const modelNote = modelNotice();
  if (modelNote) parts.push(modelNote);

  const likely = flagged.filter(r => r.level === 'likely');
  const possible = flagged.filter(r => r.level === 'possible');
  if (likely.length) parts.push(group('Likely match', likely));
  if (possible.length) parts.push(group('Possible match', possible));

  if (errors.length) {
    parts.push(h('div', { class: 'notice' },
      h('p', {}, `${plural(errors.length, 'listing', 'listings')} could not be checked.`),
      h('button', { class: 'link', type: 'button', onclick: recheck }, icon('refresh', { size: 14 }), 'Check this page again')));
  }

  // On a listing's own page: the shopper can keep watching it, so a recall announced after they buy still reaches them.
  if (state.kind === 'item') {
    const own = results.find(r => r.level !== 'error');
    if (own) parts.push(watchCard(own, { flagged: flagged.length > 0 }));
  }

  if (done) {
    // What was checked, counted from this page's own results, so "no matches" says what it rests on.
    const ok = results.filter(r => r.level !== 'error');
    const looked = ok.filter(r => r.how && r.how.device).length;
    const cloud = ok.filter(r => r.how && (r.how.cloudModel || r.how.judgedInCloud)).length;
    if (!flagged.length && ok.length) {
      parts.push(h('div', { class: 'checked' },
        h('h2', { class: 'group-head' }, 'What was checked'),
        h('ul', { class: 'checked-list' },
          h('li', {}, `${plural(ok.length, 'listing', 'listings')}: title and description, against every CPSC recall since 1973 and CPSC's safety warnings`),
          looked ? h('li', {}, `${plural(looked, 'photo', 'photos')} looked at on this computer`) : null,
          cloud ? h('li', {}, `${plural(cloud, 'listing', 'listings')} double-checked in the cloud`) : null,
          h('li', {}, 'Four infant sleep product types CPSC bans or warns against'))));
    }
    parts.push(h('p', { class: 'note' },
      h('strong', {}, 'No match does not mean safe. '),
      'New recalls arrive twice a day. Whether a unit is recalled usually depends on the model number on its label.'));
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

// ---- Recall watch ------------------------------------------------------------------------------------------------
const watchKeyOf = r => `${state.site}:${r.id}`;
const isWatched = r => !!(state && watch[watchKeyOf(r)]);
const toggleWatch = (r, on) => chrome.runtime.sendMessage({ type: 'sr:watch', on, item: { site: state.site, id: r.id, listing: { ...r.listing, id: r.id } } });
const dayOf = iso => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function watchCard(r, { flagged }) {
  const on = isWatched(r);
  const btn = h('button', { class: `btn ${on ? 'btn-secondary' : 'btn-primary'}`, type: 'button', 'aria-pressed': String(on), onclick: () => toggleWatch(r, !on) },
    icon(on ? 'check' : 'bell', { size: 16 }), on ? 'Watching' : 'Watch for recalls');
  return h('div', { class: 'watch-card' },
    h('p', { class: 'watch-title' }, flagged ? 'Bought it anyway, or already own one?' : 'Buying this, or already own one?'),
    h('p', { class: 'watch-desc' }, 'Recall notices reach the first owner, not the next one. Watch this listing and Still Recalled checks it against every new CPSC recall, on this computer, and tells you if one matches.'),
    btn);
}

function watchView() {
  const items = Object.entries(watch).sort((a, b) => (!!b[1].alert - !!a[1].alert) || (a[1].addedAt < b[1].addedAt ? 1 : -1));
  const alerts = items.filter(([, w]) => w.alert);
  if (alerts.some(([, w]) => !w.alert.seen)) {
    const next = { ...watch };
    for (const [k, w] of alerts) next[k] = { ...w, alert: { ...w.alert, seen: true } };
    chrome.storage.local.set({ watch: next });
    chrome.runtime.sendMessage({ type: 'sr:watch-seen' }).catch(() => {});
  }
  const added = live ? live.cards.length : 0;
  const label = h('span', {}, 'Check for new recalls now');
  const refreshBtn = h('button', { class: 'link', type: 'button' }, icon('refresh', { size: 14 }), label);
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    label.textContent = 'Checking with CPSC…';
    const out = await chrome.runtime.sendMessage({ type: 'sr:refresh-recalls' }).catch(e => ({ error: String(e) }));
    refreshBtn.disabled = false;
    label.textContent = out && !out.error
      ? (out.added ? `${plural(out.added, 'new notice', 'new notices')} added` : 'No new recalls or warnings since the last check')
      : 'Could not reach CPSC. Try again later';
  });
  const status = h('p', { class: 'where' },
    live && live.checkedAt ? `Recall list checked ${dayOf(live.checkedAt)}` : `Recall list from ${meta ? dayOf(meta.built) : 'this version'}`,
    added ? ` · ${plural(added, 'notice', 'notices')} added since this version` : '');
  const parts = [
    h('button', { class: 'back', type: 'button', onclick: () => go({ name: 'list' }) }, icon('back'), 'Back'),
    h('div', { class: 'head' }, h('h1', {}, alerts.length ? `${plural(alerts.length, 'watched listing matches', 'watched listings match')} a new recall` : 'Watching for recalls'), status),
  ];
  if (!items.length) {
    parts.push(h('p', { class: 'note' }, 'Open a listing you bought or plan to buy, then choose Watch for recalls. When CPSC announces a recall that matches it, you get a notification, even months later.'));
  } else {
    parts.push(h('ul', { class: 'rows watch-rows' }, ...items.map(([k, w]) => h('li', {}, watchRow(k, w)))));
  }
  parts.push(h('div', {}, refreshBtn),
    h('p', { class: 'note' }, 'New recalls and CPSC safety warnings are fetched from CPSC twice a day. Your watched listings stay on this computer: Chrome’s built-in model checks them, and only a listing it flags against a new recall is sent to the cloud to confirm.'));
  return h('section', { class: 'view' }, ...parts);
}

function watchRow(key, w) {
  const l = w.listing;
  const thumb = l.image ? h('img', { class: 'thumb', src: l.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'thumb' });
  const a = w.alert;
  return h('div', { class: `watch-row${a ? ' is-alert' : ''}` },
    thumb,
    h('div', { class: 'row-text' },
      h('a', { class: 'row-title', href: safeUrl(l.url), target: '_blank', rel: 'noreferrer' }, l.title),
      a
        ? h('div', { class: `watch-alert${a.level === 'likely' ? '' : ' is-possible'}` },
            h('span', { class: `pill ${a.level === 'likely' ? 'is-likely' : 'is-possible'}` }, a.badge || 'Possible recall'),
            h('p', {}, `CPSC recalled the ${a.recall.product} on ${dayOf(a.recall.date)}. ${a.recall.hazard || ''}`),
            a.recall.tell ? h('p', { class: 'muted' }, a.recall.tell) : null,
            // What to do with something already in the house (the same words as the Android app).
            h('p', {}, a.level === 'likely'
              ? 'What to do: stop using it, and follow the remedy in the recall notice (often a refund, repair or replacement from the maker).'
              : "What to do: check its label against the units the notice lists. If it matches, stop using it and follow the notice's remedy."),
            h('a', { class: 'link', href: safeUrl(a.recall.url), target: '_blank', rel: 'noreferrer' }, 'Read the recall notice', icon('external', { size: 14 })))
        : h('span', { class: 'row-line2' }, `Watching since ${dayOf(w.addedAt)} · no recall yet`),
      h('button', { class: 'link muted', type: 'button', onclick: () => chrome.runtime.sendMessage({ type: 'sr:watch', on: false, item: { site: w.site, id: l.id } }) }, 'Stop watching')));
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
    h('a', { class: 'link', href: 'https://still-recalled.web.app/try/', target: '_blank', rel: 'noopener' }, 'Try the practice listings', icon('external', { size: 14 })),
    h('p', { class: 'note' }, 'Listings are checked on this computer. The ones it flags, and sets or parts it can\'t settle from the words, are double-checked in the cloud.'));
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
  // Said on every scan, so one line; the reason opens on demand.
  return h('details', { class: 'notice notice-line' },
    h('summary', {}, `Matching by words${settings.cloud && hasCloudAccess ? ', cloud double-check on' : ''}`),
    h('p', {}, `This computer can’t run Chrome’s built-in AI model, so photos aren’t looked at here. Listings are matched by their words${settings.cloud && hasCloudAccess ? ', and flagged ones are checked in the cloud' : ''}. Settings shows what each part does.`));
}

function settingsView() {
  const toggle = (key, title, desc) => {
    const input = h('input', { type: 'checkbox', role: 'switch', class: 'switch', id: `set-${key}`, 'aria-describedby': `desc-${key}` });
    input.checked = DEFAULTS[key] ? settings[key] !== false : settings[key] === true;
    if (key === 'thorough' && settings.cloud === false) { input.disabled = true; input.checked = false; }
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
      toggle('cloud', 'Cloud double-check', 'Listings this computer flags or can\'t settle (bedding sets, possible parts): their title, description, price and photo go to Google Gemini through Firebase, with the recall notice. Everything else stays on this computer.'),
      toggle('thorough', 'Check every baby product in the cloud', 'Off: only what this computer flags goes to the cloud. On: every baby product on the page gets a look from Gemini, as on the web page and the phone. That catches a recalled product whose seller left its name out and that this computer\'s model did not recognize, and it sends more of what you browse. Needs the cloud double-check.'),
      toggle('badges', 'Badges on listings', 'Show a badge on flagged listings on eBay, Mercari and Craigslist.')),
    h('dl', { class: 'kv' },
      h('div', {}, h('dt', {}, 'On-device model'), h('dd', {}, modelWord)),
      h('div', {}, h('dt', {}, 'Cloud check'), h('dd', {}, hasCloudAccess ? 'Available' : 'Off')),
      h('div', {}, h('dt', {}, 'Recall notices'), h('dd', {}, meta ? (meta.count + (live ? live.cards.length : 0)).toLocaleString('en-US') : '–')),
      meta && meta.warnings ? h('div', {}, h('dt', {}, 'CPSC safety warnings'), h('dd', {}, meta.warnings.toLocaleString('en-US'))) : null,
      h('div', {}, h('dt', {}, 'Recalls since'), h('dd', {}, meta ? dayOf(meta.since) : '–')),
      h('div', {}, h('dt', {}, 'Added since this version'), h('dd', {}, String(live ? live.cards.length : 0))),
      h('div', {}, h('dt', {}, 'Last checked with CPSC'), h('dd', {}, live && live.checkedAt ? dayOf(live.checkedAt) : meta ? `${dayOf(meta.built.slice(0, 10))} (this version)` : '–'))),
    h('button', { class: 'btn btn-secondary', type: 'button', style: { justifySelf: 'start' }, onclick: recheck }, icon('refresh'), 'Check this page again'));
}

async function recheck() {
  if (!tab) return;
  await chrome.runtime.sendMessage({ type: 'sr:recheck', tabId: tab.id }).catch(() => {});
  go({ name: 'list' });
}

settingsBtn.addEventListener('click', () => go(view.name === 'settings' ? { name: 'list' } : { name: 'settings' }));
watchBtn.addEventListener('click', () => go(view.name === 'watch' ? { name: 'list' } : { name: 'watch' }));

// ---- Start ------------------------------------------------------------------------------------------------------
(async () => {
  settings = { ...DEFAULTS, ...((await chrome.storage.local.get('settings')).settings || {}) };
  meta = await fetch(chrome.runtime.getURL('data/meta.json')).then(r => r.json()).catch(() => null);
  ({ watch = {}, live = null } = await chrome.storage.local.get(['watch', 'live']));
  // Opened from a watch notification.
  const { openWatch } = await chrome.storage.session.get('openWatch');
  if (openWatch && Date.now() - openWatch < 15000) { view = { name: 'watch' }; chrome.storage.session.remove('openWatch'); }
  await loadTab();
  model = await deviceStatus();
  render();
})();
