// Development only: the web page's "I own it" mode, end to end, in a separate throwaway Chrome profile. Runs the
// local development build (node tools/collector.mjs serves it; it carries the App Check debug token, so the cloud
// check runs in an automated browser, which reCAPTCHA refuses on the live site). Chooses "I own it", types a recalled
// product, and checks that the result speaks to an owner. Saves tools/web-owner-report.json.
//   node tools/web-owner.mjs [--url=http://localhost:8766/web/index.html]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = (process.argv.find(a => a.startsWith('--url=')) || '--url=http://localhost:8766/web/index.html').slice(6);
const steps = [];
const step = (name, ok, detail = '') => { steps.push({ name, ok: !!ok, detail: String(detail).slice(0, 240) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${String(detail).slice(0, 160)}`); };
const profile = mkdtempSync(path.join(tmpdir(), 'sr-owner-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, userDataDir: profile, defaultViewport: { width: 1280, height: 900 }, args: ['--window-size=1300,1000', '--no-first-run', '--no-default-browser-check'] });
const BUYER_WORDS = /before you buy|the listing|the seller|ask the seller|report to cpsc/i;
async function check(page, text) {
  await page.$eval('#text', (el, v) => { el.value = v; }, text);
  await page.click('.type-form button[type=submit]');
  await page.waitForSelector('#side .result, #side .error', { timeout: 120000 });
  await new Promise(r => setTimeout(r, 600));
  return page.$eval('#side', el => el.innerText.replace(/\s+/g, ' '));
}
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.click('.seg-btn[data-who="owner"]');
  const title = await page.$eval('#title', el => el.textContent);
  step('choosing "I own it" changes the page\'s words', /before you sell it or pass it on/i.test(title), title);

  // A recalled product, every unit: don't pass it on, and what the recall offers.
  let text = await check(page, 'Boppy newborn lounger, floral cover');
  step('a recalled product: "Don\'t sell it or give it away"', /Don't sell it or give it away/.test(text), text.slice(0, 200));
  step('it says selling a recalled product is illegal, and gives the remedy', /illegal to sell any recalled product/.test(text) && /remedy/i.test(text), (text.match(/The recall's remedy:[^.]+\./) || [''])[0]);
  const remedy = (text.match(/The recall's remedy: (.{0,700}?) The notice says/) || [])[1] || '';
  step('the remedy is whole, not cut mid-word', remedy.length > 20 && !/…$/.test(remedy), remedy);
  step('no buyer wording on the owner\'s card', !BUYER_WORDS.test(text), (text.match(BUYER_WORDS) || [''])[0]);
  step('the card is captioned "Your item"', /Your item/.test(text));
  await page.click('.result-foot button');

  // A possible recall (some models only): check the label, in the owner's words.
  text = await check(page, 'Graco Pack n Play playard with bassinet');
  step('a product with no match is never called safe to pass on', !/safe to (sell|pass on)\b(?!.*That doesn't mean)/i.test(text) || /doesn't mean it's safe/.test(text), text.slice(0, 160));
  step('no buyer wording there either', !BUYER_WORDS.test(text), (text.match(BUYER_WORDS) || [''])[0]);
  await page.click('.result-foot button');

  // A type whose sale the law rules out.
  text = await check(page, 'padded crib bumper set, pink');
  step('a padded crib bumper: the rule, in plain words', /against federal law since November 2022/.test(text) && /sell it or give it away/.test(text), text.slice(0, 200));
  step('no buyer wording on a type flag', !BUYER_WORDS.test(text), (text.match(BUYER_WORDS) || [''])[0]);
} catch (e) {
  step('the run finished', false, String(e));
} finally {
  await browser.close().catch(() => {});
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
const failed = steps.filter(s => !s.ok).length;
const version = JSON.parse(readFileSync('extension/manifest.json', 'utf8')).version;
writeFileSync('tools/web-owner-report.json', JSON.stringify({ at: new Date().toISOString(), url, version, build: 'development (App Check debug token)', failed, steps }, null, 1));
console.log(JSON.stringify({ failed, steps: steps.length }));
process.exit(failed ? 1 : 0);
