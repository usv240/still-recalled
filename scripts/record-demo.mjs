// Records the raw footage for the demo video: the real extension, with Chrome's built-in model, on a live eBay search.
// Runs in the separate test profile from tools/nano-profile.mjs (your own Chrome is not touched) and writes
//   <out>/ebay.webm      the page from load to the opened card
//   <out>/ebay.json      when each moment happened (seconds from the start of the recording), for the edit
// Usage: node scripts/record-demo.mjs ["crib bedding set"] [--out=C:/tmp/video] [--ext=extension] [--url=<any search page>]
//        [--prefer=<badge words to open>] [--name=ebay]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { builtInModelArgs } from '../tools/chrome-args.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const query = args.filter(a => !a.startsWith('--')).join(' ') || 'crib bedding set';
const out = opt('out', 'C:/tmp/video');
const extDir = path.resolve(opt('ext', 'extension'));
const prefer = new RegExp(opt('prefer', 'Padded crib bumper'), 'i');
const urlArg = opt('url', '');
const name = opt('name', urlArg ? new URL(urlArg).hostname.split('.').slice(-2, -1)[0] : 'ebay');
const searchUrl = urlArg || `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_ItemCondition=3000`;
const host = new URL(searchUrl).hostname.split('.').slice(-2).join('.');
mkdirSync(out, { recursive: true });

const W = 1440, H = 810;   // recorded at 1.3333x: 1920 x 1080
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, ignoreDefaultArgs: true, protocolTimeout: 0,
  defaultViewport: { width: W, height: H, deviceScaleFactor: 4 / 3 },
  args: [...builtInModelArgs({ userDataDir: opt('profile', 'C:/tmp/sr-nano-profile') }), `--window-size=${W + 20},${H + 140}`, '--no-default-browser-check'],
});
const marks = {};
let t0 = 0;
const mark = (name, extra = {}) => { marks[name] = { t: +((Date.now() - t0) / 1000).toFixed(2), ...extra }; console.log(marks[name].t.toFixed(1).padStart(6), name, JSON.stringify(extra)); };
try {
  const id = await browser.installExtension(extDir);
  const worker = await (await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes(id))).worker();
  // Results are kept for 7 days; start empty so the recording shows the real check.
  await worker.evaluate(() => Promise.all([chrome.storage.local.clear(), chrome.storage.session.clear()]));
  const page = await browser.newPage();
  await page.goto('about:blank');
  const recorder = await page.screencast({ path: path.join(out, `${name}.webm`), fps: 30 });
  t0 = Date.now();
  // eBay sometimes answers an automated browser with an error page; going through the home page and waiting helps.
  for (let attempt = 0; ; attempt++) {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!/error page/i.test(await page.title())) break;
    if (attempt === 3) throw new Error('eBay served its error page to the test browser');
    console.log('eBay error page; trying again through the home page');
    await new Promise(r => setTimeout(r, 30000));
    await page.goto(new URL(searchUrl).origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 8000));
  }
  mark('search loaded', { title: await page.title() });

  const state = async () => {
    const all = await worker.evaluate(() => chrome.storage.session.get(null));
    return Object.entries(all).filter(([k]) => k.startsWith('tab:')).map(([, v]) => v).find(v => v && v.url && v.url.includes(host)) || null;
  };
  // Scroll slowly through the page while the engine works, the way a shopper would, then back to the top.
  let firstBadge = false;
  const deadline = Date.now() + 15 * 60 * 1000;
  for (let y = 0, dir = 1; Date.now() < deadline;) {
    const s = await state();
    const done = s && s.total && Object.keys(s.results || {}).length >= s.total;
    if (!firstBadge && await page.$('still-recalled-badge')) { firstBadge = true; mark('first badge'); }
    if (done) { mark('engine done', { total: s.total }); break; }
    y += dir * 180;
    const max = await page.evaluate(() => document.body.scrollHeight - innerHeight);
    if (y >= max * 0.6 || y <= 0) dir = -dir;
    await page.evaluate(top => scrollTo({ top, behavior: 'smooth' }), Math.max(0, y));
    await new Promise(r => setTimeout(r, 2500));
  }

  // The listing to open: a likely flag of the preferred kind, else any likely flag.
  const s = await state();
  const flagged = Object.values(s.results).filter(r => r.level === 'likely' || r.level === 'possible');
  const withPhoto = flagged.filter(r => r.listing.image);
  // Prefer a listing the cloud outlined in its photo, so the recording shows where it saw the problem.
  const outlined = withPhoto.filter(r => r.where);
  const pick = outlined.find(r => r.level === 'likely' && prefer.test(`${r.badge} ${r.listing.title}`)) || withPhoto.find(r => r.level === 'likely' && prefer.test(`${r.badge} ${r.listing.title}`)) || outlined[0] || withPhoto.find(r => r.level === 'likely') || withPhoto[0] || flagged[0];
  marks.flagged = flagged.map(r => ({ id: r.id, level: r.level, badge: r.badge, title: r.listing.title, price: r.listing.price, image: !!r.listing.image, where: r.where || null, device: !!(r.how && r.how.device), cloud: (r.how && r.how.cloudModel) || '' }));
  marks.pick = pick && { id: pick.id, badge: pick.badge, title: pick.listing.title, price: pick.listing.price, where: pick.where || null, how: pick.how };
  if (!pick) throw new Error('nothing was flagged on this page');
  mark('picked', { title: pick.listing.title, badge: pick.badge });

  // Scroll the picked listing into the middle of the screen, hold, then open its badge.
  const link = `a[href*="${pick.id}"]`;
  await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ behavior: 'smooth', block: 'center' }), link);
  await new Promise(r => setTimeout(r, 2500));
  mark('listing in view');
  await new Promise(r => setTimeout(r, 3000));
  const badge = await page.evaluateHandle(sel => {
    const a = document.querySelector(sel);
    let n = a;
    for (let i = 0; i < 8 && n; i++, n = n.parentElement) { const b = n.querySelector('still-recalled-badge'); if (b) return b; }
    return null;
  }, link);
  const box = badge && await badge.asElement()?.boundingBox();
  if (!box) throw new Error('no badge found beside the picked listing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await new Promise(r => setTimeout(r, 600));
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  mark('card opened');
  await new Promise(r => setTimeout(r, 9000));
  mark('end');
  await recorder.stop();
  await page.screenshot({ path: path.join(out, `${name}-card.png`) });
} finally {
  writeFileSync(path.join(out, `${name}.json`), JSON.stringify(marks, null, 1));
  await browser.close();
}
