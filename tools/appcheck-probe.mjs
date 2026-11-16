// Diagnostic: opens the live site in a throwaway Chrome profile (your own Chrome is not touched), clicks "Try it with
// an example photo", and prints the App Check exchange and model call statuses and the result on the page.
// reCAPTCHA scores headless Chrome as a bot, so run it visible unless you mean to test that.
// Usage: node tools/appcheck-probe.mjs [--headless] [--url=https://still-recalled.web.app/]
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const headless = process.argv.includes('--headless');
const url = (process.argv.find(a => a.startsWith('--url=')) || '--url=https://still-recalled.web.app/').slice(6);
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless, pipe: true,
  userDataDir: mkdtempSync(path.join(tmpdir(), 'sr-ac-')), args: ['--no-first-run', '--no-default-browser-check'],
});
try {
  const p = await b.newPage();
  p.on('response', async r => {
    if (!/exchangeRecaptcha|generateContent/.test(r.url())) return;
    const body = r.ok() ? '' : (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    console.log(r.status(), r.url().split('?')[0].split(/[/:]/).pop(), body);
  });
  await p.goto(url, { waitUntil: 'networkidle2' });
  const [example] = await p.$$('xpath/.//button[contains(., "example photo")]');
  await example.click();
  await p.waitForSelector('#side .result, #side .error', { timeout: 120000 });
  console.log('page:', (await p.$eval('#side', el => el.innerText)).replace(/\s+/g, ' ').slice(0, 300));
} finally {
  await b.close();
}
