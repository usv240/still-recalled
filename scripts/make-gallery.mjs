// Draws the Devpost gallery images (docs/gallery/*.png) from the test reports, so every number in them is measured:
//   1-extension.png    the real extension on the practice listings, with one card open (scripts/shoot-try.mjs first)
//   2-label-check.png  the label check on the practice stroller, read on the device (scripts/shoot-try.mjs first)
//   3-new-recalls.png  live recalls and the recall watch (docs/gallery/src/live-run.json and watch-panel.png, from
//                      the release end-to-end run and tools/shoot-watch.mjs)
//   4-hybrid.png       where each step runs and how many listings reached it (every test report)
//   5-results.png      caught and false alarms, each test run three ways (every test report)
//   6-web-page.jpg     the web page on a phone (scripts/record-phone.mjs; not drawn here)
// The practice listings' photos are CPSC notice photos and public-domain photos, so every image is safe to publish.
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
      <span class="how">Every listing's title against the CPSC recall list (all 10,089 since 1973 in the current build). Parts, toys and doll items dropped. Instant.</span></div>
    <div class="step"><span class="n">${c.lookedAtOnDevice}</span><span class="what">Gemini Nano</span>
      <span class="how">Baby products only: title and photo. Is it the product, a part or a toy? Does it look like a lounger or a padded bumper?<br><code>ONLY_ON_DEVICE</code></span></div>
  </div></div>
  <div class="zone cloud"><h2>In the cloud</h2>
    <div class="step"><span class="n">${c.sentToCloud}</span><span class="what">Gemini</span>
      <span class="how">Only what Nano flagged: title, photo, the full recall notice and its photo. Confirms, clears, or says what to check.<br><code>ONLY_IN_CLOUD</code></span>
      <span class="how">Which models, and a switch that turns this step off, come from Firebase Remote Config.</span></div>
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
<p class="lede">Each of ${['', 'one', 'two', 'three', 'four'][tests.length] || tests.length} blind tests run three ways: word rules alone, the built-in model alone, and the hybrid. ${allListings} real listings the rules had never seen, each test collected after the fixes the one before led to.</p>
<div class="charts">${bars(`False alarms, among ${allFine} listings that were fine`, Math.max(...SYSTEMS.map(([k]) => alarmsOf(k))), alarmsOf)}${bars(`Caught, of ${allFlag} that should be flagged`, allFlag, caughtOf)}</div>
${perTest}
<div class="foot"><span>Labels by blind AI reviewers (Claude) that never saw the rules, from the title and one photo. Method and every miss: docs/accuracy.md.</span><span class="brand"><i></i>Still Recalled</span></div>
</div>`;

// 1 and 2: the real extension on the practice listings, from scripts/shoot-try.mjs, scored against the page's answer key.
const shot = f => pathToFileURL(path.join(src, f)).href;
const tryRun = existsSync(path.join(src, 'try-run.json')) ? read(path.join(src, 'try-run.json')) : null;
const key = read('web/try/answers.json');
const recalledTitles = new Set(key.filter(k => k.recalled).map(k => k.title));
const practice = tryRun && {
  recalled: recalledTitles.size,
  ordinary: key.length - recalledTitles.size,
  caught: tryRun.flagged.filter(f => recalledTitles.has(f.title)).length,
  falseAlarms: tryRun.flagged.filter(f => !recalledTitles.has(f.title)).length,
};
const hero = tryRun && `<!doctype html><meta charset="utf-8"><style>${base}
.split { display: grid; grid-template-columns: 470px 792px; gap: 46px; height: 100%; align-items: center; }
.split h1 { font-size: 48px; max-width: 470px; }
.points { margin: 36px 0 0; padding: 0; list-style: none; display: grid; gap: 22px; }
.points li { font-size: 21px; line-height: 1.4; padding-left: 22px; border-left: 3px solid var(--rule); }
.points b { display: block; font-weight: 600; }
.points li.on { border-color: var(--likely); }
.small { margin-top: 32px; font-size: 17px; line-height: 1.45; color: var(--muted); }
.frame { width: 792px; height: 628px; overflow: hidden; border-radius: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 12px 40px rgba(0,0,0,.10); background: #f8f8f8; }
.frame img { display: block; width: 1080px; margin: -96px 0 0 -144px; }
</style><div class="slide"><div class="split"><div>
<h1>Flags recalled baby gear on secondhand listings, before you buy.</h1>
<ul class="points">
  <li class="on"><b>Gemini Nano looks at every listing on your laptop.</b>Nothing leaves it.</li>
  <li><b>Gemini in the cloud checks only the few it flags,</b>against the full CPSC recall notice and its photo.</li>
  <li><b>Every CPSC recall since 1973,</b>plus the padded bumpers and loungers that federal law now bans.</li>
</ul>
<p class="small">The real Chrome extension on the practice listings at still-recalled.web.app/try: ${practice.caught} of ${practice.recalled} recalled products flagged, ${practice.falseAlarms} of ${practice.ordinary} ordinary ones flagged, in ${tryRun.seconds} s.</p>
</div><div class="frame"><img src="${shot('try-grid.png')}"></div></div></div>`;
const labelSlide = tryRun && tryRun.labelText && `<!doctype html><meta charset="utf-8"><style>${base}
.cols { display: grid; grid-template-columns: 1fr 520px; gap: 64px; margin-top: 40px; align-items: start; }
.label { width: 100%; height: 400px; object-fit: cover; object-position: 30% 55%; border-radius: 12px; display: block; box-shadow: 0 12px 40px rgba(0,0,0,.10); }
.cap { margin-top: 14px; font-size: 18px; color: var(--muted); }
.card { width: 520px; height: 640px; overflow: hidden; border-radius: 14px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 12px 40px rgba(0,0,0,.10); }
.card img { display: block; width: 2274px; margin: -500px 0 0 -1246px; }
.rules { margin-top: 24px; display: grid; gap: 10px; font-size: 19px; line-height: 1.45; }
.rules b { font-weight: 600; }
</style><div class="slide">
<h1>A possible recall comes down to the model number. Settle it with a photo of the label.</h1>
<div class="cols"><div>
  <img class="label" src="${pathToFileURL(path.resolve('web/try/img/stroller-label.jpg')).href}">
  <p class="cap">The seller's photo of the sticker on the stroller's leg (CPSC recall 20052).</p>
  <div class="rules">
    <div><b>Read on the laptop.</b> Gemini Nano reads the label; code, not the model, compares it with the notice.</div>
    <div><b>The device can raise the alarm, not clear it.</b> A reassuring reading is read again in the cloud. If the two disagree, or a number is one character off a recalled model, it says so.</div>
  </div>
</div><div class="card"><img src="${shot('try-label.png')}"></div></div>
<div class="foot"><span>On 12 real CPSC label photos: 8 matched the recall, 4 could not be read, none wrong.</span><span class="brand"><i></i>Still Recalled</span></div>
</div>`;
// 3. Live recalls and the watch: a recall CPSC published the morning after the build, matched that day.
const liveRun = existsSync(path.join(src, 'live-run.json')) ? read(path.join(src, 'live-run.json')) : null;
const day = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const liveSlide = liveRun && existsSync(path.join(src, 'watch-panel.png')) && `<!doctype html><meta charset="utf-8"><style>${base}
.cols { display: grid; grid-template-columns: 1fr 470px; gap: 72px; margin-top: 44px; align-items: start; }
.facts { display: grid; gap: 28px; }
.fact { border-top: 2px solid var(--text); padding-top: 14px; }
.fact b { display: block; font-size: 16px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
.fact p { margin: 0; font-size: 22px; line-height: 1.45; }
.fact .big { font-size: 64px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; display: block; margin-bottom: 8px; }
.phone { width: 470px; height: 650px; overflow: hidden; border-radius: 14px; background: #f8f8f8; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 12px 40px rgba(0,0,0,.10); }
.phone img { display: block; width: 470px; }
</style><div class="slide">
<h1>A recall announced this morning, matched the same day. And a watch on what you bought.</h1>
<div class="cols"><div class="facts">
  <div class="fact"><b>Live recalls</b><span class="big">${liveRun.found} new</span><p>CPSC recalls published on ${day(liveRun.date)}, the day after the build. The installed extension fetched them from CPSC and Gemini wrote each one's field-guide entry, through Firebase AI Logic, in ${liveRun.seconds} s. From then on the laptop matches them on its own.</p></div>
  <div class="fact"><b>On the practice listings</b><p>The ${liveRun.listing} was flagged against recall ${liveRun.recall}, published that morning.</p></div>
  <div class="fact"><b>Why a watch</b><p>Recall notices reach the first owner. Only 22% of the children's products recalled in 2022 that Kids In Danger could analyze were returned, replaced or repaired. A watched listing is checked against every new recall on the laptop, and a match raises a notification.</p></div>
</div><div class="phone"><img src="${pathToFileURL(path.join(src, 'watch-panel.png')).href}"></div></div>
<div class="foot"><span>Release 0.8.0, ${day(liveRun.date)}: all ${liveRun.steps} end-to-end steps passed on the live practice listings.</span><span class="brand"><i></i>Still Recalled</span></div>
</div>`;
const slides = [['1-extension', hero], ['2-label-check', labelSlide], ['3-new-recalls', liveSlide], ['4-hybrid', hybrid], ['5-results', results]].filter(([, html]) => html);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--allow-file-access-from-files'] });
try {
  for (const old of ['1-hybrid.png', '2-results.png', '3-search-page.png', '3-listing.png', '4-card.png', '3-hybrid.png', '4-results.png']) rmSync(path.join(out, old), { force: true });
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
