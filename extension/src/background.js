// Service worker: routes listings from pages to the engine (offscreen page) and results back to pages and the panel.
//
// Per-tab state lives in chrome.storage.session under "tab:<id>", so the side panel can render from it and follow it.
// Results are cached per listing in chrome.storage.local for a week, so a page seen again is instant.
const CACHE_DAYS = 7;
const PIPELINE = 'v3';   // bump when the pipeline changes enough that cached results should be redone

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
}

// The shopper's choices. Cloud double-check is on by default and sends only flagged listings.
const DEFAULT_SETTINGS = { cloud: true, badges: true };
async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await chrome.storage.local.get('settings')).settings || {}) };
}

const tabKey = tabId => `tab:${tabId}`;
const cacheKey = (site, id) => `r:${PIPELINE}:${site}:${id}`;

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
  const pageKey = `${page.site}:${page.url}`;
  const fresh = [];
  const state = await withTab(tabId, async prior => {
    const state = prior && prior.pageKey === pageKey
      ? prior
      : { pageKey, url: page.url, site: page.site, scope: page.scope, kind: page.kind, total: 0, order: 0, results: {}, pending: {} };
    if (!prior || prior.pageKey !== pageKey) chrome.runtime.sendMessage({ type: 'sr:engine-forget', tabId }).catch(() => {});
    const now = Date.now();
    for (const l of page.listings) {
      if (state.results[l.id] || state.pending[l.id]) continue;
      const order = state.order++;
      const cached = (await chrome.storage.local.get(cacheKey(page.site, l.id)))[cacheKey(page.site, l.id)];
      if (cached && now - Date.parse(cached.checkedAt) < CACHE_DAYS * 864e5) {
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
  const state = await withTab(tabId, async state => {
    if (!state || state.pageKey !== pageKey) return null;
    delete state.pending[result.id];
    state.results[result.id] = result;
    return state;
  });
  if (!state) return;
  if (result.level !== 'error') {
    const { order, ...stored } = result;
    chrome.storage.local.set({ [cacheKey(state.site, result.id)]: stored }).catch(() => {});
  }
  if (result.level === 'likely' || result.level === 'possible') sendToTab(tabId, [result]);
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

chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(tabKey(tabId)).catch(() => {});
  chrome.runtime.sendMessage({ type: 'sr:engine-forget', tabId }).catch(() => {});
});
