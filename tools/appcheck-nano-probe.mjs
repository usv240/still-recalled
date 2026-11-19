// Diagnostic: in a kept Chrome profile (the Nano one), load the release extension, check the practice listings, and
// print each App Check exchange and model call with its status, plus the claims of the App Check token the model call
// carried (app ID, audience, expiry), to see why the backend refuses it.
// Usage: node tools/appcheck-nano-probe.mjs [profileDir] [extDir]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';

const profile = process.argv[2] || 'C:/tmp/sr-nano-profile';
freshServiceWorkers(profile);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true,
  ignoreDefaultArgs: true, args: builtInModelArgs({ userDataDir: profile }) });
const id = await b.installExtension(path.resolve(process.argv[3] || 'dist/still-recalled-extension'));
const sw = await (await b.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`))).worker();
await sw.evaluate(() => Promise.all([chrome.storage.local.clear(), chrome.storage.session.clear(), chrome.alarms.clearAll()]));
const claims = jwt => { try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()); } catch { return null; } };
const seen = new Set();
const watch = async t => {
  const s = await t.createCDPSession().catch(() => null); if (!s) return;
  await s.send('Network.enable').catch(() => {});
  s.on('Network.requestWillBeSent', ev => {
    const tok = ev.request.headers['X-Firebase-AppCheck'] || ev.request.headers['x-firebase-appcheck'];
    if (tok && !seen.has(tok)) { seen.add(tok); const c = claims(tok); console.log('token', c ? { sub: c.sub, aud: c.aud, iss: c.iss, exp: new Date(c.exp * 1000).toISOString(), iat: new Date(c.iat * 1000).toISOString() } : tok.slice(0, 40)); }
  });
  s.on('Network.responseReceived', async ev => {
    const u = ev.response.url; if (!/exchange|generateContent|remoteconfig/i.test(u)) return;
    let body = ''; if (ev.response.status >= 400) body = await s.send('Network.getResponseBody', { requestId: ev.requestId }).then(r => r.body.replace(/\s+/g, ' ').slice(0, 200)).catch(() => '');
    console.log(new Date().toISOString().slice(14, 19), t.url().split('/').pop().slice(0, 30), ev.response.status, u.split('?')[0].split(/[/:]/).pop(), body);
  });
};
b.on('targetcreated', watch);
for (const t of b.targets()) watch(t);
const p = await b.newPage();
await p.goto('https://still-recalled.web.app/try/', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 60000));
await b.close();
