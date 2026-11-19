// Screenshots of the real extension on the practice listings (still-recalled.web.app/try/), for the Devpost gallery
// and the README. Every photo on that page is a CPSC notice photo or public domain, so the images are safe to publish.
// Runs in the Gemini Nano test profile from tools/nano-profile.mjs (your own Chrome is not touched), headful because
// reCAPTCHA scores headless Chrome as a bot.
//   <out>/try-grid.png    the search page with its badges, one card open
//   <out>/try-label.png   the stroller's card after its label photo was added (the label check)
//   <out>/try-run.json    what was flagged, where each check ran, and the label check's answer
// Usage: node scripts/shoot-try.mjs [--out=docs/gallery/src] [--ext=extension] [--open=Padded crib bumper]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { builtInModelArgs, freshServiceWorkers } from '../tools/chrome-args.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const out = path.resolve(opt('out', 'docs/gallery/src'));
const extDir = path.resolve(opt('ext', 'extension'));
const openTitle = new RegExp(opt('open', 'crib bumper'), 'i');
const base = opt('url', 'https://still-recalled.web.app/try/');
const profile = 'C:/tmp/sr-nano-profile';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

freshServiceWorkers(profile);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile, ignoreDefaultArgs: true,
  defaultViewport: { width: 1500, height: 1000 },
  args: [...builtInModelArgs({ headless: false, userDataDir: profile }), '--window-size=1520,1120', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars'],
});
const run = {};
try {
  // A kept profile can hold an earlier install of the same extension (same key, same id) whose service worker Chrome
  // keeps running from its old script; remove it first so this run tests the code on disk.
  await browser.uninstallExtension('hpjnflbbhaokhgcoikhndmjapdiilkaa').catch(() => {});
  const id = await browser.installExtension(extDir);
  const sw = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`));
  const worker = await sw.worker();
  await worker.evaluate(() => Promise.all([chrome.storage.local.clear(), chrome.storage.session.clear()]));

  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.goto(base, { waitUntil: 'networkidle2' });
  const state = () => worker.evaluate(() => chrome.storage.session.get(null).then(all => Object.values(all).find(v => v && v.url && v.url.includes('/try/')) || null));
  const t0 = Date.now();
  let s = null;
  for (;;) {
    s = await state();
    const n = s ? Object.keys(s.results || {}).length : 0;
    if (s && n >= s.total) break;
    if (Date.now() - t0 > 300000) throw new Error(`only ${n} checked after 5 minutes`);
    await sleep(2000);
  }
  const results = Object.values(s.results);
  run.seconds = Math.round((Date.now() - t0) / 1000);
  run.flagged = results.filter(r => r.level === 'likely' || r.level === 'possible')
    .map(r => ({ title: r.listing.title, badge: r.badge, device: !!(r.how && r.how.device), cloud: (r.how && r.how.cloudModel) || '', where: !!r.where }));
  run.cleared = results.filter(r => r.level === 'none').map(r => ({ title: r.listing.title, device: !!(r.how && r.how.device) }));
  log(`${results.length} checked in ${run.seconds} s; flagged ${run.flagged.length}`);

  // The grid, scrolled so the results fill the frame, with one card open.
  await page.evaluate(() => document.querySelector('.results-head').scrollIntoView({ block: 'start' }));
  await sleep(800);
  const target = results.find(r => (r.level === 'likely' || r.level === 'possible') && openTitle.test(r.listing.title + ' ' + r.badge));
  const badges = await page.$$('still-recalled-badge');
  let opened = false;
  for (const b of badges) {
    const title = await b.evaluate(el => (el.closest('li') || el.parentElement).textContent);
    if (target && title.includes(target.listing.title)) {
      await b.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await sleep(500);
      const box = await b.boundingBox();
      await page.mouse.click(box.x + 20, box.y + 12);
      opened = true;
      break;
    }
  }
  await sleep(1500);
  await page.screenshot({ path: path.join(out, 'try-grid.png') });
  log('grid', opened ? `with "${target.listing.title}" open` : 'with no card open');

  // The label check, on the toddler swing's own listing page.
  await page.goto(new URL('item/compact-stroller.html', base).href, { waitUntil: 'networkidle2' });
  let inline = null;
  for (let i = 0; i < 90 && !inline; i++) { inline = await page.$('still-recalled-badge'); if (!inline) await sleep(1000); }
  if (!inline) throw new Error('no badge on the stroller page');
  const box = await inline.boundingBox();
  await page.mouse.click(box.x + 20, box.y + 12);
  await sleep(1200);
  // The card lives in a closed shadow root; DevTools can still reach its file input.
  const cdp = await page.createCDPSession();
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const find = n => (n.nodeName === 'INPUT' && (n.attributes || []).join(' ').includes('file') ? n : [...(n.children || []), ...(n.shadowRoots || [])].map(find).find(Boolean));
  const input = find(root);
  if (!input) throw new Error('no label input in the card');
  const labelFile = path.resolve('web/try/img/stroller-label.jpg');
  const tLabel = Date.now();
  await cdp.send('DOM.setFileInputFiles', { files: [labelFile], backendNodeId: input.backendNodeId });
  // Wait for the answer: the button reads "Try another photo" once the card shows it.
  const texts = n => [n.nodeType === 3 ? n.nodeValue : '', ...[...(n.children || []), ...(n.shadowRoots || [])].flatMap(texts)];
  const byClass = (n, c) => ((n.attributes || []).join(' ').split(' ').includes(c) ? n : [...(n.children || []), ...(n.shadowRoots || [])].map(k => byClass(k, c)).find(Boolean));
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    const { root: r2 } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    if (!texts(r2).some(t => t === 'Try another photo')) continue;
    const result = byClass(r2, 'label-out');
    run.labelText = result ? texts(result).filter(Boolean).join(' | ') : '';
    break;
  }
  run.labelSeconds = Math.round((Date.now() - tLabel) / 1000);
  // Scroll the card so the label answer is in view.
  await page.mouse.move(box.x + 120, box.y + 300);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: 400 }); await sleep(150); }
  await sleep(800);
  await page.screenshot({ path: path.join(out, 'try-label.png') });
  log(`label check: "${run.labelText}" in ${run.labelSeconds} s`);
  writeFileSync(path.join(out, 'try-run.json'), JSON.stringify(run, null, 2));
} finally {
  await browser.close();
}
