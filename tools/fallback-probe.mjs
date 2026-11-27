// Which model does the web page's one PREFER_ON_DEVICE call run on? Opens the page, runs the example photo, and
// prints the page's own step lines ("Read on this device" or "Read in the cloud": Firebase AI Logic's inferenceSource).
// Usage: node tools/fallback-probe.mjs [--profile=C:/tmp/sr-nano-profile] [--phone] [--url=http://localhost:8766/web/index.html]
//   --profile  a kept Chrome profile that has the built-in model; without it, a throwaway profile with none
//   --phone    phone size and a phone user agent
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { builtInModelArgs } from './chrome-args.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const profile = opt('profile', ''), phone = args.includes('--phone');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, protocolTimeout: 0,
  defaultViewport: phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 800 },
  ...(profile ? { ignoreDefaultArgs: true, args: [...builtInModelArgs({ userDataDir: profile }), '--no-default-browser-check'] }
    : { userDataDir: mkdtempSync(path.join(tmpdir(), 'sr-probe-')), args: ['--no-first-run', '--no-default-browser-check'] }),
});
try {
  const page = await browser.newPage();
  const notes = [];
  page.on('console', m => { if (/Still Recalled/.test(m.text())) notes.push(m.text().slice(0, 400)); });
  if (phone) await page.setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36');
  await page.goto(opt('url', 'http://localhost:8766/web/index.html'), { waitUntil: 'networkidle2' });
  const status = await page.evaluate(async () => ({
    plain: 'LanguageModel' in self ? await LanguageModel.availability() : 'absent',
    withImage: 'LanguageModel' in self ? await LanguageModel.availability({ expectedInputs: [{ type: 'text' }, { type: 'image' }] }).catch(e => `error: ${e.message}`) : 'absent',
  }));
  // Give the page time to finish its own check of the model before the example runs.
  await new Promise(r => setTimeout(r, 6000));
  await page.evaluate(() => {
    window.__steps = [];
    const note = () => { for (const e of document.querySelectorAll('.step')) { const t = e.innerText.replace(/\s+/g, ' ').trim(); if (t && !window.__steps.includes(t)) window.__steps.push(t); } };
    new MutationObserver(note).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  const [example] = await page.$$('xpath/.//button[contains(., "example")]');
  const t0 = Date.now();
  await example.evaluate(b => b.click());
  await page.waitForSelector('#side .result, #side .error', { timeout: 600000 });
  const steps = await page.evaluate(() => window.__steps);
  console.log(JSON.stringify({ profile: profile || 'throwaway, no built-in model', phone, status, seconds: Math.round((Date.now() - t0) / 1000), steps, notes }, null, 1));
} finally {
  await browser.close();
}
