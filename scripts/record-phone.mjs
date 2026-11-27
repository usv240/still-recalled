// Records the phone half of the demo video: the web page at phone size checking the example photo. It runs in a
// throwaway profile with Puppeteer's defaults, which leave out Chrome's built-in model, as on a phone, so Firebase AI
// Logic's PREFER_ON_DEVICE call runs on Gemini in the cloud. Uses the local development build
// (http://localhost:8766/web/, from tools/collector.mjs), which gets App Check tokens from the debug token instead of
// reCAPTCHA; the page code is the same as the live site's.
// Writes <out>/<name>.webm and <out>/<name>.json (when each moment happened, and the page's step lines).
// With --profile=<a kept Chrome profile that has the built-in model>, the same page and the same call run on Gemini
// Nano instead: the two recordings side by side are the fallback, shown (docs/demo-script.md, scene 6).
// Usage: node scripts/record-phone.mjs [--out=C:/tmp/video] [--url=http://localhost:8766/web/index.html]
//        [--name=phone] [--profile=C:/tmp/sr-nano-profile]
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { builtInModelArgs } from '../tools/chrome-args.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const out = opt('out', 'C:/tmp/video');
mkdirSync(out, { recursive: true });
const name = opt('name', 'phone'), profile = opt('profile', ''), desktop = args.includes('--desktop');

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, protocolTimeout: 0,
  // --desktop: the same page as a computer sees it (no phone size, no phone user agent).
  defaultViewport: desktop ? { width: 1280, height: 800, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ...(profile ? { ignoreDefaultArgs: true, args: [...builtInModelArgs({ userDataDir: profile }), `--window-size=${desktop ? '1320,960' : '440,1000'}`, '--no-default-browser-check'] }
    : { userDataDir: mkdtempSync(path.join(tmpdir(), 'sr-phone-')), args: ['--window-size=440,1000', '--no-first-run', '--no-default-browser-check'] }),
});
const marks = {};
let t0 = 0;
const mark = name => { marks[name] = +((Date.now() - t0) / 1000).toFixed(2); console.log(marks[name].toFixed(1).padStart(6), name); };
try {
  const page = await browser.newPage();
  if (!desktop) await page.setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36');
  await page.goto(opt('url', 'http://localhost:8766/web/index.html'), { waitUntil: 'networkidle2' });
  marks.model = await page.evaluate(() => ('LanguageModel' in self ? LanguageModel.availability() : 'absent'));
  console.log('built-in model here:', marks.model);
  const recorder = await page.screencast({ path: path.join(out, `${name}.webm`), fps: 30 });
  t0 = Date.now();
  await new Promise(r => setTimeout(r, 2500));
  mark('page shown');
  const [example] = await page.$$('xpath/.//button[contains(., "example")]');
  await example.scrollIntoView();
  await new Promise(r => setTimeout(r, 1200));
  await (desktop ? example.click() : example.tap());
  mark('example tapped');
  // The page's own step lines, kept as they change: "Read on this device" or "Read in the cloud" is what Firebase AI
  // Logic reported for the one PREFER_ON_DEVICE call.
  await page.evaluate(() => {
    window.__steps = [];
    const note = () => { for (const e of document.querySelectorAll('.step')) { const t = e.innerText.replace(/\s+/g, ' ').trim(); if (t && !window.__steps.includes(t)) window.__steps.push(t); } };
    note(); new MutationObserver(note).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.waitForSelector('#side .result, #side .error', { timeout: profile ? 600000 : 120000 });
  mark('result shown');
  marks.steps = await page.evaluate(() => window.__steps);
  await page.evaluate(() => document.querySelector('#side').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  await new Promise(r => setTimeout(r, 4000));
  // Scroll slowly through the result card.
  for (let i = 0; i < 6; i++) { await page.evaluate(() => scrollBy({ top: 220, behavior: 'smooth' })); await new Promise(r => setTimeout(r, 1300)); }
  await new Promise(r => setTimeout(r, 1500));
  mark('end');
  marks.result = (await page.$eval('#side', el => el.innerText)).replace(/\s+/g, ' ').slice(0, 400);
  await recorder.stop();
} finally {
  writeFileSync(path.join(out, `${name}.json`), JSON.stringify(marks, null, 1));
  await browser.close();
}
