// End-to-end test of the real extension in a separate, throwaway Chrome profile (your own Chrome is not touched).
// Loads extension/ unpacked, opens a live eBay search, and checks every hand-off:
//   content script -> service worker -> offscreen engine -> results back -> badges on the page -> toolbar count
//   -> clicking a badge opens its popover without leaving the page.
// A fresh profile has no built-in model, so this run covers the words + cloud path; the on-device path is covered by
// tools/eval-test.html in a Chrome that has the model.
// Usage: node build.mjs && node tools/e2e.mjs [search words] [--headful]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
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
const profile = mkdtempSync(path.join(tmpdir(), 'sr-e2e-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = { query, steps: [] };
const step = (name, ok, detail = '') => { results.steps.push({ name, ok, detail }); log(ok ? 'PASS' : 'FAIL', name, detail); };

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: !headful, pipe: true, enableExtensions: true, userDataDir: profile,
  defaultViewport: { width: 1366, height: 900 }, args: ['--window-size=1366,1000', '--no-first-run', '--no-default-browser-check'],
});
try {
  const id = await browser.installExtension(path.resolve(extDir));
  step('extension installs', !!id, id);

  const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`), { timeout: 15000 });
  const worker = await swTarget.worker();
  step('service worker starts', !!worker);

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
    if (done || Date.now() - t0 > 240000) break;
    await new Promise(r => setTimeout(r, 3000));
  }
  const checked = state ? Object.keys(state.results || {}).length : 0;
  step('engine checks the listings', !!state && checked > 0, state ? `${checked} of ${state.total} checked in ${Math.round((Date.now() - t0) / 1000)} s` : 'no tab state');
  const flagged = state ? Object.values(state.results).filter(r => r.level === 'possible' || r.level === 'likely') : [];
  const errors = state ? Object.values(state.results).filter(r => r.level === 'error') : [];
  step('no engine errors', errors.length === 0, errors.slice(0, 2).map(e => e.error).join(' | '));
  results.cloudChecked = state ? Object.values(state.results).filter(r => r.how && r.how.cloudModel).length : 0;
  results.cloudErrors = state ? Object.values(state.results).filter(r => r.how && r.how.cloudError).map(r => r.how.cloudError) : [];
  step('cloud double-check runs', results.cloudChecked > 0 && results.cloudErrors.length === 0, `${results.cloudChecked} confirmed in the cloud, ${results.cloudErrors.length} cloud errors ${results.cloudErrors.slice(0, 1).join('')}`);
  results.flagged = flagged.map(r => ({ level: r.level, badge: r.badge, title: r.listing.title, cloud: r.how.cloudModel, device: r.how.device }));
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
    await page.screenshot({ path: path.join(out, 'popover.png') });
    log('screenshot', path.join(out, 'popover.png'));
  }
  await page.screenshot({ path: path.join(out, 'page.png'), fullPage: false });
} catch (e) {
  step('run', false, String(e).slice(0, 300));
} finally {
  await browser.close().catch(() => {});
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
const failed = results.steps.filter(s => !s.ok).length;
console.log(JSON.stringify({ passed: results.steps.length - failed, failed }, null, 0));
process.exit(failed ? 1 : 0);
