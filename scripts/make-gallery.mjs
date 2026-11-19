// Draws the Devpost gallery images (docs/gallery/*.png) from the test reports, so every number in them is measured:
//   1-hybrid.png    where each step runs and how many listings reached it (tools/eval-report.json)
//   2-results.png   caught and false alarms, three ways of running the same engine (every test report)
//   3-search-page.png  the real "crib bedding set" listings from the first test with the engine's real decisions
//   4-card.png         the full card for one of them, in the side panel
//                      (3 and 4 need tools/collector.mjs running, and tools/make-gallery-fixture.mjs run first)
// Rendered by headless Chrome from local files only. Usage: node scripts/make-gallery.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = path.resolve('docs/gallery');
const src = path.join(out, 'src');
mkdirSync(src, { recursive: true });
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const first = read('tools/eval-report.json');
const second = existsSync('tools/fresh-report.json') ? read('tools/fresh-report.json') : null;
const third = existsSync('tools/third-report.json') ? read('tools/third-report.json') : null;
const fourth = existsSync('tools/fourth-report.json') ? read('tools/fourth-report.json') : null;
const tests = [[first, 'First test', 'eBay'], [second, 'Second test', 'eBay, Craigslist'], [third, 'Third test', 'eBay, Mercari, Craigslist'], [fourth, 'Fourth test, every recall since 1973', 'eBay, Craigslist']].filter(t => t[0]);
const font = f => pathToFileURL(path.resolve('extension/fonts', f)).href;

const base = `
@font-face { font-family: Geist; src: url("${font('Geist-Regular.woff2')}"); font-weight: 400; }
@font-face { font-family: Geist; src: url("${font('Geist-Medium.woff2')}"); font-weight: 500; }
@font-face { font-family: Geist; src: url("${font('Geist-SemiBold.woff2')}"); font-weight: 600; }
:root { --ground: #f8f8f8; --surface: #fff; --text: #0a0a0a; --muted: #5e5e5e; --rule: #e6e6e6; --primary: #141414;
  --likely: #c4242a; --likely-bg: #ffedea; --quiet: #c9c9c9; }
* { box-sizing: border-box; }
html, body { margin: 0; width: 1500px; height: 1000px; background: var(--ground); color: var(--text); font-family: Geist, system-ui, sans-serif; }
.slide { width: 1500px; height: 1000px; padding: 80px 96px; display: flex; flex-direction: column; }
h1 { font-size: 52px; line-height: 1.08; font-weight: 600; letter-spacing: -0.02em; margin: 0; max-width: 1180px; text-wrap: balance; }
.lede { font-size: 24px; line-height: 1.4; color: var(--muted); margin: 20px 0 0; max-width: 1100px; }
.foot { margin-top: auto; font-size: 18px; color: var(--muted); display: flex; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--text); }
.brand i { width: 14px; height: 14px; border-radius: 3px; background: var(--likely); display: inline-block; }
`;

// 1. The hybrid: three steps, split by where they run, with the counts from one real run.
// Counts summed over every test run, so the diagram shows how much reached each step in practice.
const runs = [first, second, third, fourth].filter(Boolean);
const c = ['listings', 'lookedAtOnDevice', 'sentToCloud'].reduce((o, k) => ({ ...o, [k]: runs.reduce((n, r) => n + r.cost[k], 0) }), {});
c.shareSentToCloud = c.sentToCloud / c.listings;
const hybrid = `<!doctype html><meta charset="utf-8"><style>${base}
.zones { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-top: 56px; }
.zone { border-radius: 12px; padding: 28px; display: flex; flex-direction: column; gap: 20px; }
.laptop { background: var(--surface); border: 1px solid var(--rule); }
.cloud { background: #eef1f6; }
.zone h2 { margin: 0; font-size: 18px; font-weight: 600; text-transform: none; color: var(--muted); }
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.step { display: flex; flex-direction: column; gap: 10px; }
.n { font-size: 64px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; }
.what { font-size: 22px; font-weight: 600; }
.how { font-size: 18px; line-height: 1.45; color: var(--muted); }
code { font-family: Geist, monospace; font-size: 16px; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; color: var(--text); }
.cloud code { background: #e0e5ee; }
.crosses { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.crosses div { border-top: 2px solid var(--text); padding-top: 14px; font-size: 20px; line-height: 1.45; }
.crosses b { display: block; font-size: 16px; font-weight: 600; color: var(--muted); margin-bottom: 4px; }
</style><div class="slide">
<h1>Every listing is checked on your laptop. Only the few it flags go to the cloud.</h1>
<p class="lede">Firebase AI Logic runs the same prompt and JSON schema on Chrome's built-in Gemini Nano and on Gemini in the cloud.</p>
<div class="zones">
  <div class="zone laptop"><h2>On the laptop. Nothing leaves it.</h2><div class="steps">
    <div class="step"><span class="n">${c.listings}</span><span class="what">Word rules</span>
      <span class="how">Every listing's title against all 10,089 CPSC recalls since 1973. Parts, toys and doll items dropped. Instant.</span></div>
    <div class="step"><span class="n">${c.lookedAtOnDevice}</span><span class="what">Gemini Nano</span>
      <span class="how">Baby products only: title and photo. Is it the product, a part or a toy? Does it look like a lounger or a padded bumper?<br><code>ONLY_ON_DEVICE</code></span></div>
  </div></div>
  <div class="zone cloud"><h2>In the cloud</h2>
    <div class="step"><span class="n">${c.sentToCloud}</span><span class="what">Gemini</span>
      <span class="how">Only what Nano flagged: title, photo, the full recall notice and its photo. Confirms, clears, or says what to check.<br><code>cloud model</code></span></div>
  </div>
</div>
<div class="crosses">
  <div><b>What goes to the cloud</b>A flagged listing's title, description and photo, with the recall notice it might match.</div>
  <div><b>What never leaves the laptop</b>The other listings, your searches and your browsing. No account, no tracking.</div>
</div>
<div class="foot"><span>${['', 'One test run', 'Two test runs', 'Three test runs', 'Four test runs'][runs.length]}, November 15 to 18, 2026: ${c.listings} real listings from eBay${third ? ', Mercari' : ''} and Craigslist. ${Math.round(c.shareSentToCloud * 100)}% went to the cloud.</span><span class="brand"><i></i>Still Recalled</span></div>
</div>`;

// 2. Results: totals across every test, as two bar charts (different scales, so never one axis), hybrid in ink and
// the rest quiet; then each test on its own line, so no test hides inside the totals.
const SYSTEMS = [['words only', 'Word rules only'], ['on-device only', 'Built-in model only'], ['hybrid', 'Hybrid']];
const total = f => tests.reduce((s, [r]) => s + f(r), 0);
const caughtOf = k => total(r => r.systems[k].caught);
const alarmsOf = k => total(r => r.systems[k].falseAlarms.length);
const allFlag = total(r => r.mustFlag), allFine = total(r => r.mustNotFlag), allListings = total(r => r.listings);
// Bars start at zero; `of` is the full-width value: the total for "caught", the largest count for false alarms.
const bars = (title, of, val) => `<div class="chart"><h3>${title}</h3>${SYSTEMS.map(([k, label]) => {
  const v = val(k);
  const w = of && v ? Math.max(1, Math.round((v / of) * 86)) : 0;   // room after the longest bar for its number
  return `<div class="row"><span class="lab">${label}</span><span class="track"><span class="bar ${k === 'hybrid' ? 'is-hybrid' : ''}" style="width:${w}%"></span><span class="val">${v}</span></span></div>`;
}).join('')}</div>`;
const perTest = `<table class="per"><thead><tr><th></th><th>Listings</th><th>Hybrid caught</th><th>Hybrid false alarms</th><th>Word rules only: false alarms</th></tr></thead><tbody>${
  tests.map(([r, name, sites]) => `<tr><td><b>${name}</b> <span>${sites}</span></td><td>${r.listings}</td><td>${r.systems.hybrid.caught} of ${r.mustFlag}</td><td>${r.systems.hybrid.falseAlarms.length} of ${r.mustNotFlag}</td><td>${r.systems['words only'].falseAlarms.length}</td></tr>`).join('')}</tbody></table>`;
const results = `<!doctype html><meta charset="utf-8"><style>${base}
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; margin-top: 44px; }
.chart h3 { margin: 0 0 14px; font-size: 20px; font-weight: 500; color: var(--muted); }
.row { display: grid; grid-template-columns: 220px 1fr; align-items: center; gap: 14px; height: 46px; }
.lab { font-size: 21px; }
.track { height: 22px; display: flex; align-items: center; gap: 12px; }
.bar { display: block; height: 22px; border-radius: 0 4px 4px 0; background: var(--quiet); }
.bar.is-hybrid { background: var(--primary); }
.val { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
.per { margin-top: 40px; border-collapse: collapse; width: 100%; font-size: 19px; font-variant-numeric: tabular-nums; }
.per th { text-align: left; font-weight: 500; color: var(--muted); font-size: 16px; padding: 0 0 10px; border-bottom: 1px solid var(--rule); }
.per td { padding: 12px 0; border-bottom: 1px solid var(--rule); }
.per td span { color: var(--muted); }
</style><div class="slide">
<h1>The built-in model removes false alarms. The cloud catches what words miss.</h1>
<p class="lede">The same engine run three ways in ${['', 'one', 'two', 'three', 'four'][tests.length] || tests.length} blind tests: ${allListings} real listings the rules had never seen, each test collected after the fixes the one before led to.</p>
<div class="charts">${bars(`False alarms, among ${allFine} listings that were fine`, Math.max(...SYSTEMS.map(([k]) => alarmsOf(k))), alarmsOf)}${bars(`Caught, of ${allFlag} that should be flagged`, allFlag, caughtOf)}</div>
${perTest}
<div class="foot"><span>Labels by blind reviewers from the title and one photo. Method and every miss: docs/accuracy.md.</span><span class="brand"><i></i>Still Recalled</span></div>
</div>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--allow-file-access-from-files'] });
try {
  // Captures of the real badges and card from the local preview pages, when the local server is running.
  rmSync(path.join(out, '3-listing.png'), { force: true });
  const local = await fetch('http://localhost:8766/tools/fixtures/bumpers.json').then(r => r.ok, () => false);
  const slides = [['1-hybrid', hybrid], ['2-results', results]];
  if (local) {
    const cap = await browser.newPage();
    await cap.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
    await cap.goto('http://localhost:8766/tools/preview/listings.html?fixture=bumpers&links=off&open=4', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2500));
    await cap.screenshot({ path: path.join(src, 'card-preview.png'), clip: { x: 0, y: 0, width: 1500, height: 1000 } });
    await cap.setViewport({ width: 400, height: 1400, deviceScaleFactor: 2 });
    await cap.goto('http://localhost:8766/tools/preview/panel.html?fixture=bumpers&detail=147631281873', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    const card = await cap.$eval('.detail', el => { const b = el.closest('.card') || el; const r = b.getBoundingClientRect(); return { y: r.bottom + 16 }; }).catch(() => ({ y: 1200 }));
    await cap.screenshot({ path: path.join(src, 'panel-detail.png'), clip: { x: 0, y: 0, width: 400, height: Math.min(1400, Math.ceil(card.y)) } });
    await cap.close();
    copyFileSync(path.join(src, 'card-preview.png'), path.join(out, '3-search-page.png'));
    copyFileSync(path.join(src, 'panel-detail.png'), path.join(out, '4-card.png'));
    console.log('wrote', path.join(out, '3-search-page.png'), 'and 4-card.png');
  }
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
  for (const [name, html] of slides) {
    const file = path.join(src, `${name}.html`);
    writeFileSync(file, html);
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log('wrote', path.join(out, `${name}.png`));
  }
} finally {
  await browser.close();
}
