// Records the demo video's raw footage: the packed extension and the live site, driven the way docs/demo-script.md
// says, with a drawn pointer. Each take is a folder of frames with their times, and the moments the edit needs.
//   <out>/<take>/f000001.jpg ...   raw frames (the browser's own screencast, one per screen change)
//   <out>/<take>/take.json         { width, height, frames: [{ f, t }], marks: [{ name, t, ... }] }  times in seconds
// Usage: node scripts/demo/record.mjs <part> [--out=E:/still-recalled-video/takes] [--ext=dist/still-recalled-extension]
//          [--profile=C:/tmp/sr-nano-profile]
//   off          scene 1a: the practice listings in a browser without the extension
//   ext          scenes 2, 1b, 3, 4 and 8: the extension on the practice listings (takes: flow, label, bouncer)
//   page-device  scene 6: the web page in the profile with Gemini Nano
//   page-cloud   scene 6: the web page in a new profile with no built-in model
//   market       scene 7: a real marketplace search, signed out (--url1=<blank search> --url2=<search with listings>)
// The profile with Gemini Nano needs the computer's memory to itself: about 6 GB of free commit to load the model.
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { builtInModelArgs, freshServiceWorkers } from '../../tools/chrome-args.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const part = args.find(a => !a.startsWith('--')) || 'ext';
const OUT = opt('out', 'E:/still-recalled-video/takes');
const EXT = path.resolve(opt('ext', 'dist/still-recalled-extension'));
const NANO = opt('profile', 'C:/tmp/sr-nano-profile');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = 'https://still-recalled.web.app';
const TRY = `${SITE}/try/`;
const EXT_ID = 'hpjnflbbhaokhgcoikhndmjapdiilkaa';
const DSF = 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function launch({ profile = '', width = 1280, height = 720 } = {}) {
  if (profile) freshServiceWorkers(profile);
  const dir = profile || mkdtempSync(path.join(tmpdir(), 'sr-take-'));
  const size = [`--window-size=${width + 20},${height + 140}`, '--no-default-browser-check', '--no-first-run', '--hide-scrollbars'];
  // With a kept profile: Chrome's built-in model stays on (tools/chrome-args.mjs). Without one: Puppeteer's usual
  // flags, which leave Chrome with no built-in model and nothing to download.
  const browser = await puppeteer.launch(profile
    ? { executablePath: CHROME, headless: false, pipe: true, ignoreDefaultArgs: true, protocolTimeout: 0, defaultViewport: { width, height, deviceScaleFactor: DSF }, args: [...builtInModelArgs({ userDataDir: dir }), ...size] }
    : { executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: dir, protocolTimeout: 0, defaultViewport: { width, height, deviceScaleFactor: DSF }, args: size });
  browser.__dir = profile ? '' : dir;
  return browser;
}

// ---- The pointer: drawn in the page, in the top layer, so it shows over the extension's card too -----------------
function pointerScript() {
  if (window.top !== window || window.__srPointer) return;
  window.__srPointer = true;
  const NS = 'http://www.w3.org/2000/svg';
  let el = null, ring = null, x = -200, y = -200;
  try { const s = JSON.parse(sessionStorage.getItem('__srPointer') || 'null'); if (s) { x = s.x; y = s.y; } } catch {}
  const place = () => { if (el) el.style.transform = `translate(${x}px, ${y}px)`; };
  const build = () => {
    if (el || !document.documentElement) return;
    el = document.createElement('div');
    el.setAttribute('popover', 'manual');
    el.setAttribute('aria-hidden', 'true');
    const s = el.style;
    s.inset = 'auto'; s.position = 'fixed'; s.left = '0'; s.top = '0'; s.margin = '0'; s.padding = '0'; s.border = '0';
    s.background = 'transparent'; s.overflow = 'visible'; s.pointerEvents = 'none'; s.width = '0'; s.height = '0'; s.zIndex = '2147483647';
    ring = document.createElement('div');
    const r = ring.style;
    r.position = 'absolute'; r.left = '-18px'; r.top = '-18px'; r.width = '36px'; r.height = '36px'; r.borderRadius = '50%';
    r.background = 'rgba(20,20,20,.22)'; r.boxShadow = '0 0 0 2px rgba(255,255,255,.75)'; r.opacity = '0';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '28'); svg.setAttribute('height', '28'); svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.position = 'absolute'; svg.style.left = '-4.7px'; svg.style.top = '-2.3px'; svg.style.overflow = 'visible';
    svg.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,.4))';
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M4 2 L4 19.5 L8.4 15.4 L11.3 21.8 L14 20.6 L11.1 14.3 L17.2 14.3 Z');
    p.setAttribute('fill', '#141414'); p.setAttribute('stroke', '#ffffff'); p.setAttribute('stroke-width', '1.6'); p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
    el.append(ring, svg);
    document.documentElement.append(el);
    place();
    top();
  };
  // The newest popover is drawn on top; showing this one again keeps it above a card opened after it.
  const top = () => { if (!el) return; try { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); } catch {} };
  addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; place(); try { sessionStorage.setItem('__srPointer', JSON.stringify({ x, y })); } catch {} }, true);
  addEventListener('mousedown', () => {
    if (!ring) return;
    ring.animate([{ opacity: 1, transform: 'scale(.35)' }, { opacity: 0, transform: 'scale(1.25)' }], { duration: 520, easing: 'cubic-bezier(.23,1,.32,1)' });
  }, true);
  if (document.documentElement) build();
  new MutationObserver(() => { if (!el || !el.isConnected) { el = null; build(); } }).observe(document, { childList: true, subtree: false });
  document.addEventListener('DOMContentLoaded', build);
  setInterval(() => { build(); top(); }, 150);
}

async function newPage(browser, { width, height, scheme = 'light' } = {}) {
  const page = await browser.newPage();
  if (width) await page.setViewport({ width, height, deviceScaleFactor: DSF });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.evaluateOnNewDocument(pointerScript);
  page.__m = { x: (width || 1280) * 0.72, y: (height || 720) * 0.55 };
  return page;
}

// ---- A take: frames with their own times, and named moments ------------------------------------------------------
class Take {
  constructor(page, name) { this.page = page; this.name = name; this.dir = path.join(OUT, name); this.frames = []; this.marks = []; this.notes = {}; }
  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.createCDPSession();
    this.cdp.on('Page.screencastFrame', f => {
      const file = `f${String(this.frames.length + 1).padStart(6, '0')}.jpg`;
      this.frames.push({ f: file, t: +(f.metadata.timestamp - this.t0).toFixed(3) });
      writeFileSync(path.join(this.dir, file), Buffer.from(f.data, 'base64'));
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    this.arm = () => this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 }).catch(() => {});
    this.onNav = fr => { if (fr === this.page.mainFrame()) this.arm(); };
    this.page.on('framenavigated', this.onNav);
    this.t0 = Date.now() / 1000;
    await this.arm();
    log(`take ${this.name}: recording`);
  }
  mark(name, extra = {}) {
    const m = { name, t: +(Date.now() / 1000 - this.t0).toFixed(3), ...extra };
    this.marks.push(m);
    log(`  ${m.t.toFixed(1).padStart(6)} ${name}`, Object.keys(extra).length ? JSON.stringify(extra).slice(0, 160) : '');
    return m;
  }
  async stop() {
    this.mark('end');
    await sleep(300);
    this.page.off('framenavigated', this.onNav);
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await this.cdp.detach().catch(() => {});
    const vp = this.page.viewport();
    writeFileSync(path.join(this.dir, 'take.json'), JSON.stringify({ name: this.name, at: new Date().toISOString(), width: vp.width, height: vp.height, notes: this.notes, marks: this.marks, frames: this.frames }));
    log(`take ${this.name}: ${this.frames.length} frames, ${this.marks.at(-1).t.toFixed(1)} s`);
  }
}

// ---- Moving like a person ---------------------------------------------------------------------------------------
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
async function moveTo(page, x, y, ms = 800) {
  const { x: x0, y: y0 } = page.__m;
  const t0 = Date.now();
  for (;;) {
    const k = Math.min(1, (Date.now() - t0) / ms);
    await page.mouse.move(x0 + (x - x0) * ease(k), y0 + (y - y0) * ease(k));
    if (k >= 1) break;
    await sleep(12);
  }
  page.__m = { x, y };
}
async function click(page) { await page.mouse.down(); await sleep(70); await page.mouse.up(); }
const scrollY = page => page.evaluate(() => window.scrollY);
async function scrollToY(page, top, ms = 1400) {
  await page.evaluate((top, ms) => new Promise(done => {
    const y0 = window.scrollY, t0 = performance.now();
    const e = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    const step = now => { const k = Math.min(1, (now - t0) / ms); window.scrollTo({ top: y0 + (top - y0) * e(k), behavior: 'instant' }); if (k < 1) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  }), top, ms);
}
/** Wheel in small steps with the pointer where it is (scrolls whatever is under it: the page, or the card). */
async function wheel(page, dy, ms = 900) {
  const n = Math.max(1, Math.round(Math.abs(dy) / 24));
  for (let i = 0; i < n; i++) { await page.mouse.wheel({ deltaY: dy / n }); await sleep(ms / n); }
  await sleep(250);
}
const boxOf = (page, sel) => page.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });

// ---- Finding things inside the extension's closed shadow roots (DevTools can see them; the page cannot) ----------
async function tree(page) {
  const cdp = page.__cdp || (page.__cdp = await page.createCDPSession());
  return { cdp, root: (await cdp.send('DOM.getDocument', { depth: -1, pierce: true })).root };
}
const kids = n => [...(n.children || []), ...(n.shadowRoots || [])];
const attrs = n => { const a = {}; for (let i = 0; i < (n.attributes || []).length; i += 2) a[n.attributes[i]] = n.attributes[i + 1]; return a; };
function* walk(n, parent = null) { yield [n, parent]; for (const k of kids(n)) yield* walk(k, n); }
const textOf = n => (n.nodeType === 3 ? n.nodeValue : kids(n).map(textOf).join(''));
async function quads(cdp, node) {
  const r = await cdp.send('DOM.getContentQuads', { backendNodeId: node.backendNodeId }).catch(() => null);
  const list = ((r && r.quads) || []).map(q => { const xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]]; const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; }).filter(b => b.w > 1 && b.h > 1);
  if (!list.length) return null;
  const x = Math.min(...list.map(b => b.x)), y = Math.min(...list.map(b => b.y));
  return { x, y, w: Math.max(...list.map(b => b.x + b.w)) - x, h: Math.max(...list.map(b => b.y + b.h)) - y, lines: list };
}
/** Elements whose own text matches: [{ text, box, lines }] in viewport CSS pixels. `tag` narrows to an element name. */
async function findText(page, re, { tag = '' } = {}) {
  const { cdp, root } = await tree(page);
  const out = [];
  for (const [n, parent] of walk(root)) {
    if (n.nodeType !== 3 || !re.test(n.nodeValue) || !parent) continue;
    if (tag && parent.nodeName !== tag.toUpperCase()) continue;
    const box = (await quads(cdp, n)) || (await quads(cdp, parent));
    if (box) out.push({ text: n.nodeValue.trim(), ...box });
  }
  return out;
}
/** Elements by attribute test (role, aria-label...) or tag: [{ attrs, text, box }]. */
async function findEl(page, test) {
  const { cdp, root } = await tree(page);
  const out = [];
  for (const [n] of walk(root)) {
    if (n.nodeType !== 1) continue;
    const a = attrs(n);
    if (!test(n.nodeName.toLowerCase(), a, n)) continue;
    const box = await quads(cdp, n);
    if (box) out.push({ attrs: a, text: textOf(n).trim().slice(0, 200), ...box });
  }
  return out;
}
const card = async page => (await findEl(page, (tag, a) => a.role === 'dialog' && /^Still Recalled/.test(a['aria-label'] || '') ))[0] || null;
/** Scroll the open card with the wheel until `find()` returns a box that sits fully inside it. */
async function bringIntoCard(page, find, { margin = 24 } = {}) {
  for (let i = 0; i < 14; i++) {
    const c = await card(page), b = await find();
    if (!c || !b) return b;
    if (b.y >= c.y + 44 && b.y + b.h <= c.y + c.h - margin) return b;
    if (Math.hypot(page.__m.x - (c.x + c.w / 2), page.__m.y - (c.y + c.h / 2)) > 150) await moveTo(page, c.x + c.w - 60, c.y + c.h * 0.55, 600);
    await wheel(page, b.y + b.h > c.y + c.h - margin ? Math.min(160, b.y + b.h - (c.y + c.h - margin) + 30) : -Math.min(160, c.y + 44 - b.y + 30), 500);
  }
  return find();
}

// ---- The extension session -----------------------------------------------------------------------------------------
async function installed(browser) {
  await browser.uninstallExtension(EXT_ID).catch(() => {});
  const id = await browser.installExtension(EXT);
  const worker = await (await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes(id), { timeout: 20000 })).worker();
  await worker.evaluate(() => chrome.alarms.clearAll());
  // Start with nothing remembered, so the recording shows the real check.
  await worker.evaluate(() => Promise.all([chrome.storage.local.clear(), chrome.storage.session.clear()]));
  // New recalls: the install fetches the notices published since the build. Do it now, before the page is checked.
  const p = await browser.newPage();
  await p.goto(`chrome-extension://${id}/panel.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const t0 = Date.now();
  const caught = await p.evaluate(async () => {
    const out = await chrome.runtime.sendMessage({ type: 'sr:refresh-recalls' });
    const { live } = await chrome.storage.local.get('live');
    return { ...out, ids: ((live && live.cards) || []).map(c => `${c.id} ${c.date}`) };
  }).catch(e => ({ error: String(e) }));
  log('new recalls fetched', JSON.stringify(caught).slice(0, 300), `${Math.round((Date.now() - t0) / 1000)} s`);
  for (const pg of await browser.pages()) if (pg !== p && /welcome|chrome-extension:/.test(pg.url())) await pg.close().catch(() => {});
  // Per-tab state is read from this extension page, kept open in a background tab: the service worker stops when
  // idle, and a handle to it dies with it.
  const state = async host => {
    const all = await p.evaluate(() => chrome.storage.session.get(null)).catch(() => ({}));
    return Object.entries(all).filter(([k]) => k.startsWith('tab:')).map(([, v]) => v).find(v => v && v.url && v.url.includes(host)) || null;
  };
  return { id, worker, state, caught };
}

async function nanoCheck(page) {
  // A session is only asked for when the model is already on the computer: in a new profile the same call would
  // start a 4 GB download and wait for it.
  const check = page.evaluate(async () => {
    if (!('LanguageModel' in self)) return 'no built-in model in this Chrome';
    const a = await LanguageModel.availability();
    if (a !== 'available') return `${a}; no built-in model in this profile`;
    try { const s = await LanguageModel.create({ expectedOutputs: [{ type: 'text', languages: ['en'] }] }); s.destroy(); return `${a}; session ok`; }
    catch (e) { return `${a}; session failed: ${e.message}`; }
  }).catch(e => `check failed: ${e.message}`);
  return Promise.race([check, sleep(90000).then(() => 'no answer in 90 s')]);
}

const gridTop = page => page.$eval('#results-title', e => Math.round(e.getBoundingClientRect().top + window.scrollY - 14));
const item = async (page, title) => page.evaluate(t => {
  const li = [...document.querySelectorAll('.grid .item')].find(e => e.querySelector('.title').textContent.includes(t));
  const r = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y + window.scrollY, w: b.width, h: b.height }; };
  return li && { card: r(li), photo: r(li.querySelector('.photo')), title: r(li.querySelector('.title')), meta: r(li.querySelector('.meta')), price: r(li.querySelector('.price')) };
}, title);
const pills = page => findText(page, /^(Looking on this computer|Checking in the cloud)$/);
const badges = page => findEl(page, (tag, a) => tag === 'button' && /\bbadge\b/.test(a.class || '') && a['aria-haspopup'] === 'dialog');

async function flow(browser, ext) {
  const page = await newPage(browser);
  const take = new Take(page, 'flow');
  await page.goto('about:blank');
  take.notes.caught = ext.caught;
  await take.start();
  await page.goto(TRY, { waitUntil: 'domcontentloaded' });
  take.mark('loaded');
  await sleep(1200);
  const status = await boxOf(page, '#sr-status');
  await moveTo(page, status.x + 150, status.y + status.h / 2 + 2, 900);
  take.mark('status', { box: status, text: await page.$eval('#sr-status', e => e.textContent) });
  await sleep(1300);
  const top = await gridTop(page);
  await moveTo(page, 1180, 400, 500);
  take.mark('scroll to grid');
  await scrollToY(page, top, 1500);
  take.mark('grid', { scrollY: top });

  // While the engine works: rest the pointer beside the first "on this computer" pill, then the first "in the cloud" one.
  const seen = {}, stages = [], watching = {};
  const t0 = Date.now();
  for (;;) {
    const ps = await pills(page), bs = await badges(page);
    const dev = ps.filter(p => /computer/.test(p.text)), cloud = ps.filter(p => /cloud/.test(p.text));
    stages.push({ t: +(Date.now() / 1000 - take.t0).toFixed(2), device: dev.length, cloud: cloud.length, badges: bs.length });
    for (const w of Object.values(watching)) if (!w.gone && !ps.some(p => p.text === w.text && Math.abs(p.x - w.x) < 4 && Math.abs(p.y - w.y) < 4)) { w.gone = true; take.mark(`pill ${w.name} gone`); }
    const beside = async (p, name) => { seen[name] = true; watching[name] = { name, text: p.text, x: p.x, y: p.y }; take.mark(`pill ${name}`, { box: { x: p.x, y: p.y, w: p.w, h: p.h } }); await moveTo(page, p.x + p.w + 26, p.y + p.h / 2 + 10, 700); take.mark(`at pill ${name}`); };
    if (!seen.device && dev.length && dev[0].y > 20 && dev[0].y < 660) await beside(dev[0], 'device');
    else if (!seen.cloud && cloud.length && cloud[0].y > 20 && cloud[0].y < 660) await beside(cloud[0], 'cloud');
    if (!seen.badge && bs.length) { seen.badge = true; take.mark('first badge', { box: { x: bs[0].x, y: bs[0].y, w: bs[0].w, h: bs[0].h }, text: bs[0].text }); }
    const s = await ext.state('still-recalled.web.app');
    if (s && s.total && Object.keys(s.results || {}).length >= s.total && !ps.length) {
      const flagged = Object.values(s.results).filter(r => r.level === 'likely' || r.level === 'possible');
      take.mark('engine done', { total: s.total, flagged: flagged.length });
      take.notes.flagged = flagged.map(r => ({ title: r.listing.title, badge: r.badge, level: r.level, recall: r.recall ? r.recall.id : '', also: r.also ? r.also.id : '', device: !!(r.how && r.how.device), cloud: (r.how && r.how.cloudModel) || '', lookups: (r.how && r.how.lookups) || [] }));
      take.notes.checked = Object.values(s.results).map(r => ({ title: r.listing.title, level: r.level, device: !!(r.how && r.how.device), cloud: (r.how && r.how.cloudModel) || '', deviceError: (r.how && r.how.deviceError) || '', cloudError: (r.how && r.how.cloudError) || '' }));
      break;
    }
    if (Date.now() - t0 > 12 * 60 * 1000) throw new Error('the engine did not finish in 12 minutes');
    await sleep(350);
  }
  take.notes.stages = stages;
  await sleep(1200);

  // The top row: badge, none, badge, none.
  const row = [];
  for (const t of ['Inclined baby sleeper', 'Kids xylophone', 'Boppy newborn lounger', 'Lot of baby toys']) row.push(await item(page, t));
  take.mark('sweep');
  for (const [i, it] of row.entries()) {
    await moveTo(page, it.photo.x + (i % 2 ? it.photo.w / 2 : 150), it.photo.y - top + (i % 2 ? it.photo.h / 2 : 46), 620);
    await sleep(520);
  }
  take.mark('sweep end');
  // All seventeen, top to bottom and back.
  await moveTo(page, 1210, 380, 500);
  const bottom = await page.evaluate(() => { const g = document.querySelector('.grid').getBoundingClientRect(); return Math.round(g.bottom + window.scrollY - window.innerHeight + 40); });
  take.mark('tour');
  await scrollToY(page, bottom, 5200);
  take.mark('tour bottom');
  await sleep(900);
  await scrollToY(page, top, 1500);
  take.mark('tour end');
  await sleep(600);

  // Scene 1b: the first listing with its badge, pointer out of the way.
  take.mark('badged', { item: { ...row[0], y0: top } });
  await sleep(4200);

  // Scene 3: the title, then the badge and its card.
  const first = row[0];
  await moveTo(page, first.title.x + 120, first.title.y - top + 16, 900);
  take.mark('title', { box: { ...first.title, y: first.title.y - top } });
  await sleep(2600);
  const b = (await badges(page)).sort((p, q) => p.y - q.y || p.x - q.x)[0];
  await moveTo(page, b.x + b.w / 2, b.y + b.h / 2, 800);
  take.mark('at badge', { box: { x: b.x, y: b.y, w: b.w, h: b.h }, text: b.text });
  await sleep(500);
  await click(page);
  take.mark('card open');
  await sleep(1500);
  const c = await card(page);
  take.mark('card', { box: c && { x: c.x, y: c.y, w: c.w, h: c.h } });
  await sleep(2500);
  const para = () => findText(page, /asked the recall field guide/).then(r => r[0]);
  let pr = await bringIntoCard(page, para);
  if (pr) {
    take.mark('para', { box: { x: pr.x, y: pr.y, w: pr.w, h: pr.h }, lines: pr.lines, text: pr.text });
    const lines = pr.lines.slice(-2);
    await moveTo(page, lines[0].x + 4, lines[0].y + lines[0].h + 3, 800);
    for (const l of lines) { await moveTo(page, l.x + 4, l.y + l.h + 3, 300); await moveTo(page, l.x + l.w - 4, l.y + l.h + 3, 1500); }
    take.mark('para read');
  } else take.mark('para missing');
  await sleep(5000);
  take.mark('card hold end');

  // Scene 4, first part: what to do next.
  const btn = name => () => findEl(page, (tag, a, n) => (tag === 'button' || tag === 'a') && new RegExp(name).test(textOf(n))).then(r => r[0]);
  const ask = await bringIntoCard(page, btn('Ask the seller|Copy question for seller'));
  if (ask) { await moveTo(page, ask.x + ask.w / 2, ask.y + ask.h / 2 + 4, 800); take.mark('ask', { box: { x: ask.x, y: ask.y, w: ask.w, h: ask.h }, text: ask.text }); await sleep(1900); }
  const rep = await bringIntoCard(page, btn('Report to CPSC'));
  if (rep) { await moveTo(page, rep.x + rep.w / 2, rep.y + rep.h / 2 + 4, 800); take.mark('report', { box: { x: rep.x, y: rep.y, w: rep.w, h: rep.h }, text: rep.text }); await sleep(2100); }
  const x = (await findEl(page, (tag, a) => tag === 'button' && a['aria-label'] === 'Close'))[0];
  if (x) { await moveTo(page, x.x + x.w / 2, x.y + x.h / 2, 800); await sleep(300); await click(page); take.mark('card closed'); }
  await sleep(1000);
  take.notes.nano = await nanoCheck(page);
  await take.stop();
  return page;
}

/** Open a listing's own page from the grid, wait for its badge, and open the card. */
async function openItem(page, take, title) {
  const top0 = await scrollY(page);
  const it = await item(page, title);
  await scrollToY(page, Math.max(0, Math.round(it.card.y - 170)), Math.max(700, Math.min(1600, Math.abs(it.card.y - 170 - top0) * 1.6)));
  const y0 = await scrollY(page);
  take.mark('row', { item: { ...it, y0 } });
  return { it, y0 };
}
async function intoItem(page, take, it, y0) {
  await moveTo(page, it.title.x + Math.min(150, it.title.w / 2), it.title.y - y0 + 12, 800);
  await sleep(450);
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), click(page)]);
  take.mark('item page', { url: page.url().replace(SITE, '') });
  let b = null;
  for (let i = 0; i < 400 && !b; i++) { b = (await badges(page))[0] || null; if (!b) await sleep(400); }
  if (!b) throw new Error('no badge on the item page');
  take.mark('item badge', { box: { x: b.x, y: b.y, w: b.w, h: b.h }, text: b.text });
  await sleep(1300);
  await moveTo(page, b.x + b.w / 2, b.y + b.h / 2, 800);
  await sleep(450);
  await click(page);
  take.mark('card open');
  await sleep(1400);
  const c = await card(page);
  take.mark('card', { box: c && { x: c.x, y: c.y, w: c.w, h: c.h } });
  return b;
}

async function label(page) {
  const take = new Take(page, 'label');
  await take.start();
  await sleep(500);
  const { it, y0 } = await openItem(page, take, 'Baby Trend Tango Mini');
  await sleep(500);
  await intoItem(page, take, it, y0);
  await sleep(1500);
  const add = () => findEl(page, (tag, a, n) => tag === 'button' && /Add a label photo/.test(textOf(n))).then(r => r[0]);
  const a = await bringIntoCard(page, add, { margin: 40 });
  if (!a) throw new Error('no "Add a label photo" button in the card');
  const head = (await findText(page, /Settle it with the label/))[0];
  take.mark('label section', { box: head && { x: head.x, y: head.y, w: head.w, h: head.h }, button: { x: a.x, y: a.y, w: a.w, h: a.h } });
  await moveTo(page, a.x + a.w / 2, a.y + a.h / 2 + 3, 800);
  await sleep(700);
  const file = path.resolve('web/try/img/stroller-label.jpg');
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 8000 }).catch(() => null), click(page)]);
  if (chooser) await chooser.accept([file]);
  else {
    const { cdp, root } = await tree(page);
    const input = [...walk(root)].map(([n]) => n).find(n => n.nodeName === 'INPUT' && attrs(n).type === 'file');
    await cdp.send('DOM.setFileInputFiles', { files: [file], backendNodeId: input.backendNodeId });
  }
  take.mark('label added', { chooser: !!chooser });
  for (let i = 0; i < 240; i++) { if ((await findText(page, /Try another photo|could not be read/)).length) break; await sleep(400); }
  take.mark('label read');
  const result = () => findText(page, /The label (matches|does not match)|label/i, { tag: 'p' }).then(r => r.find(x => /The label/.test(x.text)));
  const res = await bringIntoCard(page, result, { margin: 110 });
  const all = await findEl(page, (tag, a) => /label-result/.test(a.class || ''));
  take.mark('label result', { box: res && { x: res.x, y: res.y, w: res.w, h: res.h }, text: all[0] && all[0].text, whole: all[0] && { x: all[0].x, y: all[0].y, w: all[0].w, h: all[0].h } });
  if (res) await moveTo(page, res.x + res.w + 8, res.y + res.h / 2 + 6, 800);
  await sleep(4000);
  await take.stop();
}

async function bouncer(page) {
  await page.goto(TRY, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 300; i++) { if ((await badges(page)).length >= 8) break; await sleep(400); }
  await sleep(800);
  const take = new Take(page, 'bouncer');
  await take.start();
  await moveTo(page, 1150, 420, 400);
  const { it, y0 } = await openItem(page, take, 'Kidsview baby bouncer');
  const bs = await badges(page);
  const b = bs.find(q => q.x >= it.photo.x - 4 && q.x <= it.photo.x + it.photo.w && q.y >= it.photo.y - y0 - 4 && q.y <= it.photo.y - y0 + it.photo.h);
  if (b) { await moveTo(page, b.x + b.w + 14, b.y + b.h / 2 + 8, 800); take.mark('bouncer badge', { box: { x: b.x, y: b.y, w: b.w, h: b.h }, text: b.text }); }
  await sleep(2200);
  await intoItem(page, take, it, y0);
  await sleep(1200);
  const date = () => findText(page, /November \d+, 2026|Nov\.? \d+, 2026|November 2026/).then(r => r[0]);
  const d = await bringIntoCard(page, date);
  if (d) { await moveTo(page, d.x + Math.min(d.w, 200) + 8, d.y + d.h / 2 + 6, 800); take.mark('date', { box: { x: d.x, y: d.y, w: d.w, h: d.h }, lines: d.lines, text: d.text }); }
  else take.mark('date missing', { text: (await card(page) || {}).text });
  await sleep(2800);
  const watch = () => findEl(page, (tag, a, n) => tag === 'button' && /Watch for recalls|Watching for recalls/.test(textOf(n))).then(r => r[0]);
  const w = await bringIntoCard(page, watch, { margin: 30 });
  if (w) {
    await moveTo(page, w.x + w.w / 2, w.y + w.h / 2 + 3, 800);
    take.mark('watch', { box: { x: w.x, y: w.y, w: w.w, h: w.h }, text: w.text });
    await sleep(900);
    await click(page);
    for (let i = 0; i < 40; i++) { if ((await findText(page, /Watching for recalls/)).length) break; await sleep(200); }
    take.mark('watching');
    await moveTo(page, w.x + w.w + 30, w.y + w.h + 26, 600);
  } else take.mark('watch missing');
  await sleep(3200);
  await take.stop();
}

/** Scene 6: the web page's one PREFER_ON_DEVICE call, with the page's own line saying where it ran. */
async function webPage(browser, name) {
  const page = await newPage(browser, { width: 390, height: 844, scheme: 'dark' });
  await page.goto(`${SITE}/`, { waitUntil: 'networkidle2' });
  await sleep(6000);   // the page checks for the model first
  const take = new Take(page, name);
  take.notes.nano = await nanoCheck(page);
  await take.start();
  await sleep(700);
  const [example] = await page.$$('xpath/.//button[contains(., "example")]');
  const eb = await example.boundingBox();
  if (eb.y + eb.height > 800) { await scrollToY(page, Math.round(eb.y + eb.height - 620), 900); }
  const e2 = await example.boundingBox();
  await moveTo(page, e2.x + e2.width / 2, e2.y + e2.height / 2 + 2, 900);
  await sleep(500);
  await click(page);
  take.mark('click');
  let read = null;
  const steps = () => page.$$eval('.step', els => els.map(e => { const b = e.getBoundingClientRect(); return { text: e.innerText.replace(/\s+/g, ' ').trim(), state: e.dataset.state, x: b.x, y: b.y, w: b.width, h: b.height }; }));
  const t0 = Date.now();
  let firstSteps = false;
  for (;;) {
    const st = await steps();
    if (!firstSteps && st.length) { firstSteps = true; take.mark('steps', { steps: st }); }
    read = st.find(s => /Read on this device|Read in the cloud/.test(s.text));
    if (read) break;
    if (Date.now() - t0 > 5 * 60 * 1000) throw new Error('the page did not read the screenshot in 5 minutes');
    await sleep(250);
  }
  take.mark('read', { box: { x: read.x, y: read.y, w: read.w, h: read.h }, text: read.text });
  await moveTo(page, Math.min(360, read.x + 250), read.y + read.h + 14, 700);
  await page.waitForSelector('#side .result, #side .error', { timeout: 600000 });
  take.mark('result', { steps: await steps(), scrollY: await scrollY(page) });
  await sleep(3500);
  await take.stop();
  log(name, take.notes.nano, '|', read.text);
}

/**
 * Scene 7: a real marketplace search, signed out. These are strangers' listings, so the page is changed before it is
 * recorded: the site's header and side column are hidden, the sign-in boxes closed, and every photo and town name
 * blurred. Titles, prices and Still Recalled's badges are left as they are.
 */
function privacyScript() {
  if (window.top !== window) return;
  const tidy = () => {
    for (const e of document.querySelectorAll('[role=banner], [role=navigation], [role=complementary]')) e.style.visibility = 'hidden';
    for (const e of document.querySelectorAll('[role=dialog]')) { const x = e.querySelector('[aria-label="Close"]'); if (x && !e.__closed) { e.__closed = true; x.click(); } e.style.display = 'none'; }
    for (const img of document.querySelectorAll('a[href*="/marketplace/item/"] img')) if (!img.__blur) { img.__blur = true; img.style.filter = 'blur(13px)'; img.style.transform = 'scale(1.12)'; if (img.parentElement) img.parentElement.style.overflow = 'hidden'; }
    for (const sp of document.querySelectorAll('a[href*="/marketplace/item/"] span')) if (!sp.__seen && !sp.children.length) { sp.__seen = true; if (/^[A-Za-z .'-]+, [A-Z]{2}$/.test(sp.textContent.trim())) sp.style.filter = 'blur(6px)'; }
    // The sign-in bar fixed to the bottom of a signed-out page.
    for (const e of document.querySelectorAll('div')) if (!e.__fx && e.childElementCount && e.offsetHeight > 40 && e.offsetHeight < 220) { const cs = getComputedStyle(e); if (cs.position === 'fixed' && parseFloat(cs.bottom) < 10 && /log in|sign up/i.test(e.textContent)) { e.__fx = true; e.style.display = 'none'; } }
    document.documentElement.style.overflow = 'auto'; if (document.body) document.body.style.overflow = 'auto';
  };
  setInterval(tidy, 200);
  document.addEventListener('DOMContentLoaded', tidy);
}
async function market(browser, ext) {
  const url1 = opt('url1', ''), url2 = opt('url2', '');
  if (!url1 || !url2) throw new Error('market needs --url1=<a search the site answers with nothing> and --url2=<a search with listings>');
  const q = u => new URL(u).searchParams.get('query') || '';
  const page = await newPage(browser);
  await page.evaluateOnNewDocument(privacyScript);
  await page.goto(url1, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  const take = new Take(page, 'market');
  await take.start();
  const said = await page.evaluate(() => ((document.querySelector('[role=main]') || document.body).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160));
  take.mark('blank', { query: q(url1), said });
  await sleep(4500);
  await page.goto(url2, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  take.mark('loaded', { query: q(url2), listings: await page.$$eval('a[href*="/marketplace/item/"]', a => a.length) });
  // Let the extension work through the first screens, moving the page gently as a shopper would.
  const t0 = Date.now();
  let n = 0;
  for (let i = 0; Date.now() - t0 < 150000; i++) {
    await scrollToY(page, i % 2 ? 0 : 260, 2200);
    await sleep(1200);
    const s = await ext.state('facebook.com');
    n = (await badges(page)).length;
    const left = (await pills(page)).length;
    if (s && s.total && Object.keys(s.results || {}).length >= s.total && !left && i % 2) break;
    if (Date.now() - t0 > 60000 && n >= 3 && !left && i % 2) break;
  }
  await sleep(800);
  const bs = await badges(page);
  take.mark('results', { query: q(url2), badges: bs.length, texts: bs.map(b => b.text) });
  await sleep(1200);
  await scrollToY(page, 330, 4200);
  const vis = (await badges(page)).filter(b => b.y > 60 && b.y < 560);
  if (vis[0]) { await moveTo(page, vis[0].x + vis[0].w + 18, vis[0].y + vis[0].h / 2 + 10, 900); take.mark('at badge', { box: { x: vis[0].x, y: vis[0].y, w: vis[0].w, h: vis[0].h }, text: vis[0].text }); }
  await sleep(1500);
  if (vis[1]) { await moveTo(page, vis[1].x + vis[1].w + 18, vis[1].y + vis[1].h / 2 + 10, 900); take.mark('at badge 2', { box: { x: vis[1].x, y: vis[1].y, w: vis[1].w, h: vis[1].h }, text: vis[1].text }); }
  await sleep(1500);
  await scrollToY(page, 0, 4200);
  await sleep(1200);
  await take.stop();
}

// ---- Run -------------------------------------------------------------------------------------------------------------
let browser;
try {
  if (part === 'off') {
    browser = await launch();
    const page = await newPage(browser);
    await page.goto(TRY, { waitUntil: 'networkidle2' });
    const top = await gridTop(page);
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top);
    await sleep(800);
    const take = new Take(page, 'off');
    await take.start();
    const it = await item(page, 'Inclined baby sleeper');
    take.mark('listing', { item: { ...it, y0: top } });
    await sleep(2500);
    await moveTo(page, it.title.x + 120, it.title.y - top + 16, 1000);
    take.mark('title');
    await sleep(2200);
    await moveTo(page, it.price.x + it.price.w + 10, it.price.y - top + 14, 800);
    take.mark('price');
    await sleep(3500);
    await take.stop();
  } else if (part === 'ext') {
    browser = await launch({ profile: NANO === 'none' ? '' : NANO });
    const ext = await installed(browser);
    const only = opt('only', '');
    const page = await flow(browser, ext);
    if (!only || only.includes('label')) await label(page);
    if (!only || only.includes('bouncer')) await bouncer(page);
  } else if (part === 'page-device') {
    browser = await launch({ profile: NANO === 'none' ? '' : NANO });
    await webPage(browser, 'page-device');
  } else if (part === 'page-cloud') {
    browser = await launch();
    await webPage(browser, 'page-cloud');
  } else if (part === 'market') {
    browser = await launch({ profile: NANO === 'none' ? '' : NANO });
    await market(browser, await installed(browser));
  } else throw new Error(`unknown part: ${part}`);
} finally {
  if (browser) { const dir = browser.__dir; await browser.close().catch(() => {}); if (dir) try { rmSync(dir, { recursive: true, force: true }); } catch {} }
}
