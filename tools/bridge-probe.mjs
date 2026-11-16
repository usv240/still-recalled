// Diagnostic: loads the release extension in a throwaway profile, opens a Craigslist search, and prints every App
// Check exchange and model call made by the offscreen page and its bridge frame, with statuses.
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import path from 'node:path';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true,
  enableExtensions: true, userDataDir: mkdtempSync(path.join(tmpdir(), 'sr-bp-')), args: ['--no-first-run', '--no-default-browser-check'] });
const id = await b.installExtension(path.resolve(process.argv[2] || 'dist/still-recalled-extension'));
const watch = async t => {
  const s = await t.createCDPSession().catch(() => null); if (!s) return;
  await s.send('Network.enable').catch(() => {});
  s.on('Network.responseReceived', async ev => {
    const u = ev.response.url; if (!/exchange|generateContent|recaptcha\/enterprise\/(reload|clr)/.test(u)) return;
    let body = ''; if (ev.response.status >= 400) body = await s.send('Network.getResponseBody', { requestId: ev.requestId }).then(r => r.body.replace(/\s+/g, ' ').slice(0, 160)).catch(() => '');
    console.log(new Date().toISOString().slice(14, 19), t.url().split('/').pop().slice(0, 30), ev.response.status, u.split('?')[0].split(/[/:]/).pop(), body);
  });
};
b.on('targetcreated', watch);
for (const t of b.targets()) watch(t);
const p = await b.newPage();
await p.goto('https://losangeles.craigslist.org/search/sss?query=bassinet', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 45000));
console.log('targets:', b.targets().map(t => t.type() + ' ' + t.url().slice(0, 70)).join('\n  '));
await b.close();
