// Development only: sends one label photo through the extension's own path (side panel -> service worker -> offscreen
// engine) and prints the answer or the error. Usage: node tools/label-probe.mjs [--ext=extension] [--fresh-profile]
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';
const args = process.argv.slice(2);
const ext = path.resolve((args.find(a => a.startsWith('--ext=')) || '--ext=extension').slice(6));
const nano = !args.includes('--fresh-profile');
const profile = nano ? 'C:/tmp/sr-nano-profile' : mkdtempSync(path.join(tmpdir(), 'sr-label-'));
freshServiceWorkers(nano ? profile : '');
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true, enableExtensions: true, userDataDir: profile,
  ...(nano ? { ignoreDefaultArgs: true, args: [...builtInModelArgs({ headless: false, userDataDir: profile }), '--no-first-run'] } : { args: ['--no-first-run'] }),
});
try {
  // A kept profile can hold an earlier install of the same extension (same key, same id) whose service worker Chrome
  // keeps running from its old script; remove it first so this run tests the code on disk.
  await browser.uninstallExtension('hpjnflbbhaokhgcoikhndmjapdiilkaa').catch(() => {});
  const id = await browser.installExtension(ext);
  const swt = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`));
  const worker = await swt.worker();
  console.log('worker build', JSON.stringify(await worker.evaluate(async () => { const t = await fetch(chrome.runtime.getURL('build/background.js')).then(r => r.text()); return { v: chrome.runtime.getManifest().version, readLabel: t.includes('sr:read-label'), len: t.length, url: chrome.runtime.getURL('') }; })));
  worker.on('console', m => console.log('[worker]', m.text()));
  await worker.evaluate(() => { self.__orig = chrome.runtime.sendMessage.bind(chrome.runtime); chrome.runtime.onMessage.addListener((m, s) => { console.log('BG got', m.type, s.url); }); chrome.runtime.sendMessage = (...a) => { console.log('BG sends', a[0].type); return self.__orig(...a).then(r => { console.log('BG inner reply', JSON.stringify(r)); return r; }, e => { console.log('BG inner err', String(e)); throw e; }); }; });
  const page = await browser.newPage();
  page.on('console', m => console.log('[panel]', m.text()));
  await page.goto(`chrome-extension://${id}/panel.html`);
  const dataUrl = 'data:image/jpeg;base64,' + readFileSync('web/try/img/toddler-swing-label.jpg').toString('base64');
  console.log('status', JSON.stringify(await page.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:engine-status' }))).slice(0, 300));
  const offT = browser.targets().find(x => x.url().includes('offscreen'));
  if (offT) { const w = await offT.page().catch(() => null) || await offT.asPage().catch(() => null); if (w) w.on('console', m => console.log('[offscreen]', m.text())); }
  const direct = await page.evaluate(d => chrome.runtime.sendMessage({ type: 'sr:engine-label', dataUrl: d, recall: { codes: ['615573'], from: 2009, to: 2014 } }).then(r => ({ ok: r === undefined ? 'UNDEFINED' : r }), e => ({ err: String(e) })), 'data:image/jpeg;base64,' + readFileSync('web/try/img/toddler-swing-label.jpg').toString('base64'));
  console.log('direct', JSON.stringify(direct).slice(0, 600));
  console.log('open-offscreen', JSON.stringify(await page.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:open-offscreen' }).then(r => r === undefined ? 'UNDEFINED' : r, e => 'ERR ' + e))));
  console.log('recheck-like worker-status', JSON.stringify(await page.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:worker-status' }).then(r => r === undefined ? 'UNDEFINED' : r, e => 'ERR ' + e))));
  console.log('from worker engine-label', JSON.stringify(await worker.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:engine-label', dataUrl: 'x', recall: null }).then(r => r === undefined ? 'UNDEFINED' : r, e => 'ERR ' + e))));
  console.log('from worker engine-status', JSON.stringify(await worker.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:engine-status' }).then(r => r === undefined ? 'UNDEFINED' : r, e => 'ERR ' + e))).slice(0,120));
  console.log('tiny', JSON.stringify(await page.evaluate(() => chrome.runtime.sendMessage({ type: 'sr:read-label', dataUrl: 'x', recall: null }).then(r => r === undefined ? 'UNDEFINED' : r, e => 'ERR ' + e))));
  const t = Date.now();
  const r = await page.evaluate(d => chrome.runtime.sendMessage({ type: 'sr:read-label', dataUrl: d, recall: { codes: ['615573'], from: 2009, to: 2014 } }), dataUrl);
  console.log(Math.round((Date.now() - t) / 1000) + ' s', String(JSON.stringify(r)).slice(0, 800));
  const off = browser.targets().find(x => x.url().includes('offscreen'));
  console.log('offscreen target:', !!off);
} finally { await browser.close(); }
