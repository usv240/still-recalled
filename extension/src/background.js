// Service worker: routes listings from pages to the engine (offscreen page) and results back to pages and the panel.
//
// Per-tab state lives in chrome.storage.session under "tab:<id>", so the side panel can render from it and follow it.
// Results are cached per listing in chrome.storage.local for a week, so a page seen again is instant.
const CACHE_DAYS = 7;
const PIPELINE = 'v4';   // bump when the pipeline changes enough that cached results should be redone

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

let creating = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ||= chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Runs the on-device model on listings away from the visible page.',
  }).finally(() => { creating = null; });
  await creating;
  // A new offscreen page starts with only the bundled recalls: give it the ones found since.
  const { live, devHideFrom } = await chrome.storage.local.get(['live', 'devHideFrom']);
  await chrome.runtime.sendMessage({ type: 'sr:engine-live', cards: (live && live.cards) || [], hideFrom: devHideFrom || '' }).catch(() => {});
}

// The shopper's choices. Cloud double-check is on by default and sends only flagged listings. "Thorough" is off by
// default: with it on, every baby product on a page gets the cloud's look, as on the web page and the phone.
const DEFAULT_SETTINGS = { cloud: true, badges: true, thorough: false };
async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await chrome.storage.local.get('settings')).settings || {}) };
}

const tabKey = tabId => `tab:${tabId}`;

// Turning "check every baby product in the cloud" on reads the open pages again, so it acts at once and not only on
// the next page: onPage then re-queues the listings that were cleared without the cloud's look.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  const was = changes.settings.oldValue || {}, now = changes.settings.newValue || {};
  const on = s => s.cloud !== false && s.thorough === true;
  if (!on(now) || on(was)) return;
  chrome.storage.session.get(null).then(all => {
    for (const key of Object.keys(all).filter(k => k.startsWith('tab:'))) chrome.tabs.sendMessage(Number(key.slice(4)), { type: 'sr:rescan' }).catch(() => {});
  });
});
// Cached results also carry how many live recalls they were checked against: when new recalls arrive, a listing
// seen before is checked again, since it may be one of them.
let liveStamp = 0;
const liveStampReady = chrome.storage.local.get('live').then(({ live }) => { liveStamp = (live && live.cards.length) || 0; });
const unseenByCloud = r => r.level === 'none' && !r.thorough && !(r.how && r.how.cloudModel);
const cacheKey = (site, id) => `r:${PIPELINE}.${liveStamp}:${site}:${id}`;

async function getTab(tabId) {
  return (await chrome.storage.session.get(tabKey(tabId)))[tabKey(tabId)] || null;
}
async function setTab(tabId, state) {
  await chrome.storage.session.set({ [tabKey(tabId)]: state });
  const flagged = Object.values(state.results).filter(r => r.level === 'likely' || r.level === 'possible').length;
  const likely = Object.values(state.results).some(r => r.level === 'likely');
  chrome.action.setBadgeText({ tabId, text: flagged ? String(flagged) : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: likely ? '#c4242a' : '#92400e' }).catch(() => {});
}

// Writes to one tab's state are serialised, so results arriving together do not overwrite each other.
const locks = new Map();
function withTab(tabId, fn) {
  const next = (locks.get(tabId) || Promise.resolve()).then(async () => {
    const state = await getTab(tabId);
    const out = await fn(state);
    if (out) await setTab(tabId, out);
    return out;
  });
  locks.set(tabId, next.catch(() => {}));
  return next;
}

/** A page reported its listings. New page: reset. Same page: add the listings not seen yet. */
async function onPage(tabId, page) {
  await liveStampReady;
  const pageKey = `${page.site}:${page.url}`;
  const fresh = [];
  const first = await getSettings();
  const thorough = first.cloud !== false && first.thorough === true;
  const state = await withTab(tabId, async prior => {
    const state = prior && prior.pageKey === pageKey
      ? prior
      : { pageKey, url: page.url, site: page.site, scope: page.scope, kind: page.kind, total: 0, order: 0, results: {}, pending: {} };
    if (!prior || prior.pageKey !== pageKey) chrome.runtime.sendMessage({ type: 'sr:engine-forget', tabId }).catch(() => {});
    const now = Date.now();
    for (const l of page.listings) {
      // With "check every baby product in the cloud" on, a listing that was cleared without the cloud's look is
      // checked again; one that got it (under this setting, or because the device or the unnamed-sleep rule sent it),
      // or was flagged, is not.
      const had = state.results[l.id];
      if (state.pending[l.id] || (had && !(thorough && unseenByCloud(had)))) continue;
      if (had) delete state.results[l.id];
      const order = state.order++;
      const cached = (await chrome.storage.local.get(cacheKey(page.site, l.id)))[cacheKey(page.site, l.id)];
      const redo = thorough && cached && unseenByCloud(cached);
      if (cached && !redo && now - Date.parse(cached.checkedAt) < CACHE_DAYS * 864e5) {
        state.results[l.id] = { ...cached, order, cached: true };
      } else {
        state.pending[l.id] = { title: l.title, order };
        fresh.push({ ...l, order });
      }
    }
    state.total = Object.keys(state.results).length + Object.keys(state.pending).length;
    return state;
  });
  sendToTab(tabId, Object.values(state.results).filter(r => r.level === 'likely' || r.level === 'possible'));
  if (fresh.length) {
    await ensureOffscreen();
    const settings = await getSettings();
    await chrome.runtime.sendMessage({ type: 'sr:engine-check', tabId, pageKey, listings: fresh, settings }).catch(() => {});
  }
}

async function onResult(tabId, pageKey, result) {
  // A result whose model call failed (the cloud, or the built-in model timing out) is shown but not kept for the
  // week: the next visit checks the listing again. A good result is kept even when the tab has moved on (opening an
  // item on Facebook changes the address while its search is still being checked), so that work is not paid for twice.
  if (result.level !== 'error' && !(result.how && (result.how.cloudError || result.how.deviceError))) {
    const { order, ...stored } = result;
    chrome.storage.local.set({ [cacheKey(pageKey.slice(0, pageKey.indexOf(':')), result.id)]: stored }).catch(() => {});
  }
  const state = await withTab(tabId, async state => {
    if (!state || state.pageKey !== pageKey) return null;
    delete state.pending[result.id];
    state.results[result.id] = result;
    return state;
  });
  if (!state) return;
  if (result.level === 'likely' || result.level === 'possible') sendToTab(tabId, [result]);
  // Nothing to show: take the "still checking" pill off the listing.
  else chrome.tabs.sendMessage(tabId, { type: 'sr:stage', id: result.id, stage: 'done' }).catch(() => {});
}

function sendToTab(tabId, results) {
  if (results.length) chrome.tabs.sendMessage(tabId, { type: 'sr:results', results }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || typeof msg.type !== 'string') return false;
  const tabId = sender.tab && sender.tab.id;
  switch (msg.type) {
    case 'sr:page':
      if (tabId != null) onPage(tabId, msg.page).then(() => reply({ ok: true }), e => reply({ ok: false, error: String(e) }));
      return true;
    case 'sr:on-screen':
      if (tabId != null) chrome.runtime.sendMessage({ type: 'sr:engine-on-screen', tabId, ids: msg.ids }).catch(() => {});
      return false;
    case 'sr:engine-stage':
      // Where a listing's check is (the built-in model, or the cloud): shown on the page, never stored.
      chrome.tabs.sendMessage(msg.tabId, { type: 'sr:stage', id: msg.id, stage: msg.stage }).catch(() => {});
      return false;
    case 'sr:engine-result':
      onResult(msg.tabId, msg.pageKey, msg.result);
      return false;
    case 'sr:open-panel':
      // Allowed only in response to a user gesture; the page's click is one. Open first, while the gesture holds,
      // then tell the panel which listing to show.
      if (tabId != null) {
        chrome.sidePanel.open({ tabId }).then(() => reply({ ok: true }), e => reply({ ok: false, error: String(e) }));
        chrome.storage.session.set({ [`focus:${tabId}`]: { id: msg.id, at: Date.now() } }).catch(() => {});
      }
      return true;
    case 'sr:read-label':
      // From a card on the page or in the panel: have the hidden page's model read a label photo.
      // The shopper's cloud switch applies here too: with it off, the label photo never leaves the computer.
      Promise.all([ensureOffscreen(), getSettings()]).then(([, s]) => chrome.runtime.sendMessage({ type: 'sr:engine-label', dataUrl: msg.dataUrl, recall: msg.recall, cloud: s.cloud !== false })).then(reply, e => reply({ error: String(e) }));
      return true;
    case 'sr:watch': {
      // From the panel: start or stop watching a listing.
      (async () => {
        const { watch = {} } = await chrome.storage.local.get('watch');
        const key = watchKey(msg.item);
        if (msg.on) watch[key] = { site: msg.item.site, listing: msg.item.listing, addedAt: new Date().toISOString(), alert: null };
        else delete watch[key];
        await chrome.storage.local.set({ watch });
        reply({ ok: true, count: Object.keys(watch).length });
      })();
      return true;
    }
    case 'sr:watch-seen':
      chrome.action.setBadgeText({ text: '' }).catch(() => {});
      return false;
    case 'sr:refresh-recalls':
      refreshRecalls().then(reply, e => reply({ error: String(e).slice(0, 200) }));
      return true;
    case 'sr:engine-status':
      ensureOffscreen().then(() => chrome.runtime.sendMessage({ type: 'sr:engine-status' })).then(reply, e => reply({ error: String(e) }));
      return true;
    case 'sr:recheck':
      // From the panel: forget cached results for the active tab's page and read it again.
      chrome.storage.session.remove(tabKey(msg.tabId)).then(async () => {
        const all = await chrome.storage.local.get(null);
        await chrome.storage.local.remove(Object.keys(all).filter(k => k.startsWith('r:')));
        await chrome.tabs.sendMessage(msg.tabId, { type: 'sr:rescan' }).catch(() => {});
        reply({ ok: true });
      });
      return true;
    // Developer setup check (dev.html).
    case 'sr:worker-status':
      reply({ languageModelInServiceWorker: 'LanguageModel' in self });
      return false;
    case 'sr:open-offscreen':
      ensureOffscreen().then(() => reply({ ok: true }), e => reply({ ok: false, error: String(e) }));
      return true;
    default:
      return false;
  }
});

// ---- Live recalls and the recall watch -----------------------------------------------------------------------------
// Twice a day the engine asks CPSC for recalls published since the newest one it knows. When there are new ones, the
// listings the shopper chose to watch are checked against them, and a match raises a notification. The watch list is
// kept in chrome.storage.local on this computer and is never sent anywhere; a watched listing reaches the cloud only
// if the on-device check flags it against a new recall, the same rule as on a search page.
const REFRESH = 'sr-recalls';
const ensureAlarm = async () => { if (!(await chrome.alarms.get(REFRESH))) chrome.alarms.create(REFRESH, { delayInMinutes: 1, periodInMinutes: 12 * 60 }); };

chrome.runtime.onInstalled.addListener(({ reason }) => {
  ensureAlarm();
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }).catch(() => {});
  // The bundled recalls stop at the build: catch up straight away rather than at the first alarm.
  refreshRecalls().catch(() => {});
});
chrome.runtime.onStartup.addListener(ensureAlarm);
chrome.alarms.onAlarm.addListener(a => { if (a.name === REFRESH) { refreshRecalls().catch(() => {}); forgetOldResults().catch(() => {}); } });

// Results are kept for CACHE_DAYS and then deleted, not only ignored (twice a day, with the recall refresh).
async function forgetOldResults(now = Date.now()) {
  const all = await chrome.storage.local.get(null);
  const old = Object.keys(all).filter(k => k.startsWith('r:') && !(now - Date.parse(all[k] && all[k].checkedAt) < CACHE_DAYS * 864e5));
  if (old.length) await chrome.storage.local.remove(old);
  return old.length;
}

let refreshing = null;
function refreshRecalls() {
  return refreshing ||= (async () => {
    await ensureOffscreen();
    const settings = await getSettings();
    const out = await chrome.runtime.sendMessage({ type: 'sr:engine-refresh', settings });
    if (!out || out.error) throw new Error((out && out.error) || 'no answer');
    const { live = { cards: [] } } = await chrome.storage.local.get('live');
    const known = new Set(live.cards.map(c => c.id));
    const added = out.cards.filter(c => !known.has(c.id));
    const next = { cards: [...added, ...live.cards], checkedAt: new Date().toISOString(), added: added.length, written: out.written, shared: out.shared || 0 };
    await chrome.storage.local.set({ live: next });
    if (added.length) {
      liveStamp = next.cards.length;
      await recheckOpenPages();
    }
    const hits = added.length ? await checkWatch(added.map(c => c.id), settings) : [];
    return { added: added.length, written: out.written, shared: out.shared || 0, total: next.cards.length, checkedAt: next.checkedAt, hits: hits.length };
  })().finally(() => { refreshing = null; });
}

// Pages already open were checked without the new recalls: read them again.
async function recheckOpenPages() {
  const all = await chrome.storage.session.get(null);
  for (const key of Object.keys(all).filter(k => k.startsWith('tab:'))) {
    const tabId = Number(key.slice(4));
    await chrome.storage.session.remove(key);
    chrome.tabs.sendMessage(tabId, { type: 'sr:rescan' }).catch(() => {});
  }
}

async function checkWatch(newIds, settings) {
  const { watch = {} } = await chrome.storage.local.get('watch');
  const items = Object.values(watch).filter(w => !w.alert);
  if (!items.length) return [];
  const out = await chrome.runtime.sendMessage({ type: 'sr:engine-watch', listings: items.map(w => w.listing), newIds, settings });
  const hits = (out && out.hits) || [];
  if (!hits.length) return [];
  const now = new Date().toISOString();
  const fresh = (await chrome.storage.local.get('watch')).watch || {};
  for (const hit of hits) {
    const key = Object.keys(fresh).find(k => fresh[k].listing.id === hit.id);
    if (!key) continue;
    fresh[key].alert = { at: now, level: hit.level, badge: hit.badge, verdict: hit.verdict, recall: hit.recall, confirmed: hit.confirmed, seen: false };
    chrome.notifications.create(`sr-watch:${key}`, {
      type: 'basic', iconUrl: 'icons/icon-128.png', priority: 2,
      title: 'A listing you’re watching may be recalled',
      message: `${hit.listing.title.slice(0, 80)} may be the ${hit.recall.product.slice(0, 80)} CPSC recalled on ${new Date(hit.recall.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`,
    });
  }
  await chrome.storage.local.set({ watch: fresh });
  chrome.action.setBadgeText({ text: '!' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: '#c4242a' }).catch(() => {});
  return hits;
}

// A click on the notification opens the panel on the watch list (the click counts as the user's gesture).
chrome.notifications.onClicked.addListener(async id => {
  if (!id.startsWith('sr-watch:')) return;
  await chrome.storage.session.set({ openWatch: Date.now() });
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (win) chrome.sidePanel.open({ windowId: win.id }).catch(() => {});
  chrome.notifications.clear(id);
});

const watchKey = l => `${l.site}:${l.id}`;

chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(tabKey(tabId)).catch(() => {});
  chrome.runtime.sendMessage({ type: 'sr:engine-forget', tabId }).catch(() => {});
});
