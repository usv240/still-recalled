// End-to-end test of the real extension in a separate, throwaway Chrome profile (your own Chrome is not touched).
// Loads extension/ unpacked, opens a live eBay search, and checks every hand-off:
//   content script -> service worker -> offscreen engine -> results back -> badges on the page -> toolbar count
//   -> clicking a badge opens its popover without leaving the page.
// A fresh profile has no built-in model, so by default this covers the words + cloud path. With --profile=<dir> made by
// tools/nano-profile.mjs, the profile has Chrome's built-in model and the test also checks that the extension's
// on-device step ran.
// reCAPTCHA scores headless Chrome as a bot, so the release build's cloud check needs --headful.
// Usage: node build.mjs && node tools/e2e.mjs [search words] [--headful] [--url=<search page>] [--ext=<dir>] [--profile=<dir>]
import puppeteer from 'puppeteer-core';
import { builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const headful = args.includes('--headful');
const query = args.filter(a => !a.startsWith('--')).join(' ') || 'baby lounger';
const urlArg = (args.find(a => a.startsWith('--url=')) || '').slice(6);
const extDir = (args.find(a => a.startsWith('--ext=')) || '--ext=extension').slice(6);
const out = process.env.E2E_OUT || path.resolve('tools/e2e-out');
mkdirSync(out, { recursive: true });
const keptProfile = (args.find(a => a.startsWith('--profile=')) || '').slice(10);
const profile = keptProfile || mkdtempSync(path.join(tmpdir(), 'sr-e2e-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = { query, steps: [] };
const step = (name, ok, detail = '') => { results.steps.push({ name, ok, detail }); log(ok ? 'PASS' : 'FAIL', name, detail); };

freshServiceWorkers(keptProfile);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: !headful, pipe: true, enableExtensions: true, userDataDir: profile,
  defaultViewport: { width: 1366, height: 900 },
  ...(keptProfile ? { ignoreDefaultArgs: true } : {}),
  args: [...(keptProfile ? builtInModelArgs({ headless: !headful, userDataDir: profile }) : []), '--window-size=1366,1000', '--no-first-run', '--no-default-browser-check'],
});
try {
  const id = await browser.installExtension(path.resolve(extDir));
  step('extension installs', !!id, id);

  const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`), { timeout: 15000 });
  const worker = await swTarget.worker();
  step('service worker starts', !!worker);
  // The install schedules a live-recall refresh a minute later; it would run alongside the test's own refresh.
  await worker.evaluate(() => chrome.alarms.clearAll());
  // --fresh: forget results cached by an earlier run in a kept profile, so every listing is checked again.
  // It also drops the Firebase SDK's IndexedDB stores (App Check token, Remote Config): a kept profile once held an
  // App Check token the backend no longer accepted (401 "token is invalid"), and the SDK kept sending it.
  if (args.includes('--fresh')) await worker.evaluate(async () => {
    await Promise.all([chrome.storage.local.clear(), chrome.storage.session.clear()]);
    if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
    for (const db of await indexedDB.databases()) if (/firebase/i.test(db.name)) await new Promise(r => { const q = indexedDB.deleteDatabase(db.name); q.onsuccess = q.onerror = q.onblocked = r; });
  });
  // And the App Check bridge page's own store on the site's origin, where its tokens are cached.
  if (args.includes('--fresh')) {
    const cdp = await browser.target().createCDPSession();
    for (const origin of ['https://still-recalled.web.app', 'https://still-recalled.firebaseapp.com'])
      await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'indexeddb,local_storage,service_workers,cache_storage' }).catch(() => {});
    // The bridge page's own scripts too: an HTTP-cached copy from an earlier deploy would keep running.
    await cdp.send('Network.clearBrowserCache').catch(() => {});
    await cdp.detach().catch(() => {});
  }

  // Live recalls: the install starts a catch-up with CPSC. Wait for it, then run one more on a clean store, so the
  // page below is checked against every recall published since the build.
  const catchUp = await (async () => {
    const p = await browser.newPage();
    await p.goto(`chrome-extension://${id}/panel.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const t0 = Date.now();
    const out = await p.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'sr:refresh-recalls' });
      await chrome.storage.local.set({ live: { cards: [] } });
      await chrome.runtime.sendMessage({ type: 'sr:engine-live', cards: [], hideFrom: '' });
      const out = await chrome.runtime.sendMessage({ type: 'sr:refresh-recalls' });
      const { live } = await chrome.storage.local.get('live');
      return { ...out, cards: live.cards.map(c => ({ id: c.id, date: c.date, product: c.product, guide: !!c.tell })) };
    }).catch(e => ({ error: String(e) }));
    await p.close().catch(() => {});
    return { ...out, ms: Date.now() - t0 };
  })();
  results.catchUp = catchUp;
  step('recall list catches up with CPSC', !!(catchUp && !catchUp.error && typeof catchUp.added === 'number'),
    catchUp.error ? catchUp.error : `${catchUp.added} recalls published since the build (${catchUp.cards.map(c => `${c.id} ${c.date}`).join(', ')}), ${catchUp.cards.filter(c => c.guide).length} with field-guide entries from the cloud, ${Math.round(catchUp.ms / 1000)} s`);

  const page = await browser.newPage();
  const url = urlArg || `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_ItemCondition=3000`;
  const host = new URL(url).hostname.split('.').slice(-2).join('.');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Craigslist and Mercari draw their results after load (and Craigslist may redirect first), so poll.
  let listings = 0;
  for (let i = 0; i < 20 && !listings; i++) {
    listings = await page.$$eval('a[href*="/itm/"], a[href*="/item/"], a[href*="/d/"]', as => as.length).catch(() => 0);
    if (!listings) await new Promise(r => setTimeout(r, 1000));
  }
  step('search page loads', listings > 0, `${await page.title()} (${listings} item links)`);
  if (!listings) throw new Error('the marketplace did not serve results to the test browser');

  // Wait for the engine to work through the page: per-tab state lives in chrome.storage.session.
  const tabState = async () => {
    const all = await worker.evaluate(() => chrome.storage.session.get(null));
    return Object.entries(all).filter(([k]) => k.startsWith('tab:')).map(([, v]) => v).find(v => v && v.url && v.url.includes(host)) || null;
  };
  let state = null;
  const t0 = Date.now();
  for (;;) {
    state = await tabState();
    const done = state && state.total && Object.keys(state.results || {}).length >= state.total;
    if (done || Date.now() - t0 > (keptProfile ? 1500000 : 240000)) break;   // the on-device step takes about 10 s a listing
    await new Promise(r => setTimeout(r, 3000));
  }
  const checked = state ? Object.keys(state.results || {}).length : 0;
  step('engine checks the listings', !!state && checked > 0, state ? `${checked} of ${state.total} checked in ${Math.round((Date.now() - t0) / 1000)} s` : 'no tab state');
  const flagged = state ? Object.values(state.results).filter(r => r.level === 'possible' || r.level === 'likely') : [];
  const errors = state ? Object.values(state.results).filter(r => r.level === 'error') : [];
  if (/\/try\//.test(url)) {
    let key = [];
    try { key = JSON.parse(readFileSync('web/try/answers.json', 'utf8')).filter(k => k.liveRecall); } catch {}
    for (const k of key) {
      const r = state && state.results[k.id];
      const known = catchUp.cards && catchUp.cards.some(c => c.id === k.liveRecall);
      if (!known) { log(`recall ${k.liveRecall} is in the bundled list or not yet published: live-recall listing check skipped`); continue; }
      step('a recall published after the build is flagged', !!(r && (r.level === 'likely' || r.level === 'possible') && r.recall && r.recall.id === k.liveRecall),
        r ? `${k.title}: ${r.level}${r.recall ? ` / recall ${r.recall.id} (${r.recall.date})` : ''}` : 'not checked');
    }
  }
  step('no engine errors', errors.length === 0, errors.slice(0, 2).map(e => e.error).join(' | '));
  results.cloudChecked = state ? Object.values(state.results).filter(r => r.how && r.how.cloudModel).length : 0;
  results.cloudErrors = state ? Object.values(state.results).filter(r => r.how && r.how.cloudError).map(r => r.how.cloudError) : [];
  step('cloud double-check runs', results.cloudChecked > 0 && results.cloudErrors.length === 0, `${results.cloudChecked} confirmed in the cloud, ${results.cloudErrors.length} cloud errors ${results.cloudErrors.slice(0, 1).join('')}`);
  if (keptProfile) {
    const onDevice = state ? Object.values(state.results).filter(r => r.how && r.how.device).length : 0;
    step('built-in model runs in the extension', onDevice > 0, `${onDevice} listings looked at on this device`);
  }
  // The offscreen engine's settings: from Firebase Remote Config when it answered, else the built-in defaults.
  // Asked from an extension page, as the side panel does: the service worker starts the offscreen engine if needed.
  const extPage = await browser.newPage();
  await extPage.goto(`chrome-extension://${id}/panel.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const engine = await extPage.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:engine-status' })).catch(e => ({ error: String(e) }));
  await extPage.close().catch(() => {});
  await page.bringToFront();
  step('settings come from Remote Config', !!(engine && engine.settings && engine.settings.from !== 'defaults'),
    engine && engine.settings ? `${engine.settings.from}: ${engine.settings.models.join(', ')}; cloud ${engine.settings.cloudCheck ? 'on' : 'off'}; ${engine.settings.cloudAtOnce} at once` : JSON.stringify(engine).slice(0, 160));
  results.flagged = flagged.map(r => ({ level: r.level, badge: r.badge, title: r.listing.title, recall: r.recall ? r.recall.id : '', also: r.also ? r.also.id : '', cloud: r.how.cloudModel, device: r.how.device, lookups: r.how.lookups || [] }));
  // The practice page's inclined sleeper is titled without its product's name. Its recall can only come from the cloud
  // naming the product in the photo and asking this device's field guide (shared/lookup.mjs, function calling).
  if (/still-recalled\.web\.app\/try/.test(urlArg)) {
    const unnamed = flagged.find(r => /^Inclined baby sleeper/.test(r.listing.title));
    const named = unnamed && (unnamed.also || unnamed.recall);
    const asked = named && (unnamed.how.lookups || []).find(l => l.found.includes(named.id));
    step('the cloud asks the device for a product the title does not name', !!asked,
      asked ? `asked the field guide for "${asked.asked.brand} ${asked.asked.product}"; the device returned ${asked.found.join(', ')}; shown as ${unnamed.badge}, with recall ${named.id} named on the card` : unnamed ? `flagged as ${unnamed.badge}, but not through a lookup` : 'the listing was not flagged');
  }
  log(`flagged ${flagged.length}:`, flagged.slice(0, 8).map(r => `${r.level}/${r.badge}: ${r.listing.title.slice(0, 50)}`).join('\n  '));

  await new Promise(r => setTimeout(r, 1500));
  const badges = await page.$$eval('still-recalled-badge', els => els.map(e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y + scrollY }; }));
  step('badges appear on flagged listings', flagged.length === 0 ? badges.length === 0 : badges.length > 0, `${badges.length} badges for ${flagged.length} flagged`);

  const tabs = await worker.evaluate(h => chrome.tabs.query({}).then(t => t.filter(x => (x.url || '').includes(h))), host);
  const text = tabs[0] ? await worker.evaluate(tabId => chrome.action.getBadgeText({ tabId }), tabs[0].id) : '';
  step('toolbar count matches', String(flagged.length || '') === String(text || ''), `toolbar "${text}", flagged ${flagged.length}`);

  if (badges.length) {
    const before = page.url();
    await page.evaluate(y => scrollTo(0, Math.max(0, y - 200)), badges[0].y);
    await new Promise(r => setTimeout(r, 400));
    const hostBox = await page.$eval('still-recalled-badge', e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await page.mouse.click(hostBox.x + 12, hostBox.y + 12);
    await new Promise(r => setTimeout(r, 800));
    step('badge click stays on the page', page.url() === before, page.url() === before ? '' : `navigated to ${page.url()}`);
    // The card's closed shadow root is still in the accessibility tree, which is how a screen reader finds it too.
    const ask = await page.$('::-p-aria([name="Ask the seller"][role="button"])');
    const report = await page.$('::-p-aria([name="Report to CPSC"][role="button"])');
    step('card offers the next step', !!ask, `Ask the seller: ${ask ? 'yes' : 'no'}; Report to CPSC: ${report ? 'yes' : 'no (only on likely flags the law rules out)'}`);
    await page.screenshot({ path: path.join(out, 'popover.png') });
    log('screenshot', path.join(out, 'popover.png'));
  }
  await page.screenshot({ path: path.join(out, 'page.png'), fullPage: false });

  // The "thorough" setting (off by default): every baby product on the page gets the cloud's look. Turned on with the
  // page already open and checked, it must act on that page: listings cleared without the cloud are checked again.
  {
    const viaCloud = st => Object.values((st && st.results) || {}).filter(r => r.how && r.how.cloudModel).length;
    const before = viaCloud(await tabState());
    const setThorough = on => worker.evaluate(async v => { const { settings = {} } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, thorough: v } }); }, on);
    await setThorough(true);
    let st = null;
    for (const t1 = Date.now(); Date.now() - t1 < 180000; await new Promise(r => setTimeout(r, 3000))) {
      st = await tabState();
      if (Date.now() - t1 > 9000 && st && !Object.keys(st.pending || {}).length && Object.keys(st.results || {}).length >= st.total) break;
    }
    const after = viaCloud(st);
    const stamped = st ? Object.values(st.results).filter(r => r.thorough).length : 0;
    const flaggedNow = st ? Object.values(st.results).filter(r => r.level === 'possible' || r.level === 'likely').length : 0;
    step('thorough setting: turned on, the open page\'s baby products get the cloud\'s look', after > before && stamped > 0 && flaggedNow >= flagged.length,
      `${before} listings had been to the cloud, ${after} after; ${stamped} checked again; ${flaggedNow} flagged (${flagged.length} before)`);
    results.thorough = { cloudBefore: before, cloudAfter: after, recheckedListings: stamped, flaggedBefore: flagged.length, flaggedAfter: flaggedNow,
      newlyFlagged: st ? Object.values(st.results).filter(r => (r.level === 'possible' || r.level === 'likely') && !flagged.some(f => f.id === r.id)).map(r => `${r.badge}: ${r.listing.title}`) : [] };
    await setThorough(false);
  }

  const extPage2 = await browser.newPage();
  await extPage2.goto(`chrome-extension://${id}/panel.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  // Live recalls and the recall watch. The engine leaves out the bundled recalls from 2026-11-12 on, as if this
  // build were older, so the notices since then (seven on 2026-11-12 and more) arrive through the live path: from the CPSC API, with field-guide
  // entries written by Gemini in the cloud. A watched listing for one of them (the Huffy e-trike, recall 27086) must
  // then raise an alert. Everything is put back afterwards.
  const huffy = { id: 'e2e-huffy', title: 'Buzz Bicycles Cerana T2 electric trike, model E4004, gray, 500W', price: '$650',
    image: 'https://www.cpsc.gov/s3fs-public/Huffy1.jpg?VersionId=QLL20sS7WlVoNJa5y3bJY3doTHAPJyhs', url: 'https://still-recalled.web.app/try/' };
  const liveRun = await extPage2.evaluate(async listing => {
    await chrome.storage.local.set({ devHideFrom: '2026-11-12', live: { cards: [] },
      watch: { 'practice:e2e-huffy': { site: 'practice', listing, addedAt: new Date().toISOString(), alert: null } } });
    await chrome.runtime.sendMessage({ type: 'sr:engine-live', cards: [], hideFrom: '2026-11-12' });
    const t0 = Date.now();
    const out = await chrome.runtime.sendMessage({ type: 'sr:refresh-recalls' });
    const { watch, live } = await chrome.storage.local.get(['watch', 'live']);
    await chrome.storage.local.set({ devHideFrom: '', live: { cards: [] }, watch: {} });
    await chrome.runtime.sendMessage({ type: 'sr:engine-live', cards: [], hideFrom: '' });
    return { out, ms: Date.now() - t0, alert: watch['practice:e2e-huffy'].alert, ids: live.cards.map(c => c.id), guide: live.cards.filter(c => c.tell).length };
  }, huffy).catch(e => ({ error: String(e) }));
  step('new recalls arrive from CPSC', !!(liveRun.out && liveRun.out.added >= 7 && liveRun.ids.includes('27086')),
    liveRun.out ? `${liveRun.out.added} added (${liveRun.ids.join(', ')}), ${liveRun.out.written} field-guide entries written in the cloud, ${Math.round(liveRun.ms / 1000)} s` : JSON.stringify(liveRun).slice(0, 200));
  // CPSC's safety warnings are not in the recall API: the extension reads CPSC's warnings file with the same refresh.
  const liveWarnings = (liveRun.ids || []).filter(i => /^W\d/.test(i));
  step('new CPSC safety warnings arrive too', liveWarnings.length >= 1, liveWarnings.length ? `${liveWarnings.length} warnings (${liveWarnings.slice(0, 4).join(', ')})` : 'none');
  step('watched listing raises an alert', !!(liveRun.alert && liveRun.alert.recall && liveRun.alert.recall.id === '27086'),
    liveRun.alert ? `${liveRun.alert.level} / ${liveRun.alert.badge}: recall ${liveRun.alert.recall.id}${liveRun.alert.confirmed ? ', confirmed in the cloud' : ''}` : 'no alert');
  results.live = liveRun;
  await extPage2.close().catch(() => {});
} catch (e) {
  step('run', false, String(e).slice(0, 300));
} finally {
  await browser.close().catch(() => {});
  if (!keptProfile) try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
const failed = results.steps.filter(s => !s.ok).length;
// Kept per run kind: the packed release or the development build, with or without the built-in model.
const manifest = JSON.parse(readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
const kind = `${/dist|still-recalled-extension/.test(extDir) ? 'release' : 'dev'}${keptProfile ? '-nano' : ''}`;
writeFileSync(path.resolve(`tools/e2e-report-${kind}.json`), JSON.stringify({ at: new Date().toISOString(), version: manifest.version, ext: extDir, builtInModelProfile: !!keptProfile, url: urlArg || null, query, passed: results.steps.length - failed, failed, ...results }, null, 2));
console.log(JSON.stringify({ passed: results.steps.length - failed, failed }, null, 0));
process.exit(failed ? 1 : 0);
