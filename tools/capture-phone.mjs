// Captures the live web page at phone size running its example check, for the Devpost gallery and the video.
// Opens only https://still-recalled.web.app, in a separate, throwaway Chrome profile.
// Usage: node tools/capture-phone.mjs [--url=https://still-recalled.web.app]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = (process.argv.find(a => a.startsWith('--url=')) || '--url=https://still-recalled.web.app').slice(6);
const out = path.resolve('docs/gallery/src');
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), 'sr-phone-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, userDataDir: profile, args: ['--window-size=460,960'] });
try {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
  });
  // The page's own errors (App Check, quota) are what tell a failed cloud check apart.
  page.on('console', m => { if (/error|warn/i.test(m.type()) || /app ?check|quota|429|403|401/i.test(m.text())) console.log(`console ${m.type()}: ${m.text().slice(0, 240)}`); });
  page.on('response', r => { if (/firebasevertexai|firebaseappcheck|generativelanguage|recaptcha/.test(r.url()) && r.status() >= 400) console.log(`HTTP ${r.status()} ${new URL(r.url()).hostname}${new URL(r.url()).pathname.slice(0, 80)}`); });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.screenshot({ path: path.join(out, 'phone-start.png') });
  const example = await page.waitForSelector('::-p-text(Try it with an example photo)', { timeout: 15000 });
  await example.click();
  // The result replaces the steps when the check finishes; the cloud path can take a while on the no-cost tier.
  await page.waitForSelector("#side .result, #side .error", { timeout: 180000 });
  await new Promise(r => setTimeout(r, 800));
  const text = await page.$eval('#side', el => el.innerText.replace(/\s+/g, ' ').slice(0, 300));
  console.log('result:', text);
  await page.evaluate(() => document.querySelector('#side').scrollIntoView({ block: 'start' }));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(out, 'phone-result.png') });
  await page.screenshot({ path: path.join(out, 'phone-result-full.png'), fullPage: true });
  console.log('wrote', out);
} finally {
  await browser.close().catch(() => {});
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
