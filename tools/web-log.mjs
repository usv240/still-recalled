// Development only: the web page's saved checks, intake log and Spanish (0.16.0), end to end, in a throwaway Chrome
// profile on the local development build (node tools/collector.mjs). Three typed checks (three cloud calls at most):
// one in English, two in Spanish. Saves tools/web-log-report.json.
//   node tools/web-log.mjs [--url=http://localhost:8766/web/index.html]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = (process.argv.find(a => a.startsWith('--url=')) || '--url=http://localhost:8766/web/index.html').slice(6);
const steps = [];
const step = (name, ok, detail = '') => { steps.push({ name, ok: !!ok, detail: String(detail).slice(0, 240) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${String(detail).slice(0, 160)}`); };
const profile = mkdtempSync(path.join(tmpdir(), 'sr-log-'));
const downloads = mkdtempSync(path.join(tmpdir(), 'sr-log-dl-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, userDataDir: profile, defaultViewport: { width: 1280, height: 900 }, args: ['--window-size=1300,1000', '--no-first-run', '--no-default-browser-check'] });
const sideText = page => page.$eval('#side', el => el.innerText.replace(/\s+/g, ' '));
async function check(page, text) {
  await page.$eval('#text', (el, v) => { el.value = v; }, text);
  await page.click('.type-form button[type=submit]');
  await page.waitForSelector('#side .result, #side .error', { timeout: 120000 });
  await new Promise(r => setTimeout(r, 800));
  return sideText(page);
}
try {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });

  // English: a check is saved, and the idle page offers it again.
  await page.goto(`${url}?lang=en`, { waitUntil: 'networkidle2', timeout: 45000 });
  let text = await check(page, 'Boppy newborn lounger');
  step('English: a result says it is saved on this device', /Saved on this device/.test(text), text.slice(0, 160));
  step('English: the lounger card carries the safe-sleep line', /Not for sleep, recalled or not/.test(text), (text.match(/Not for sleep[^.]*\./) || [''])[0]);
  await page.click('.result-foot .btn');
  await page.waitForSelector('.mychecks', { timeout: 15000 });
  text = await sideText(page);
  step('English: "Your checks" lists the check on the start page', /Your checks/.test(text) && /Boppy/i.test(text), text.slice(0, 160));
  await page.click('.mychecks .row');
  await page.waitForSelector('#side .result', { timeout: 15000 });
  text = await sideText(page);
  step('English: the saved check opens again, with its result', /Checked (today|\w{3} \d)/.test(text) && /(Recalled product|Possible recall|lounger)/i.test(text), text.slice(0, 160));

  // The log: batch name, CSV.
  await page.click('.result-foot .link');
  await page.waitForSelector('.log-card', { timeout: 15000 });
  await page.type('#batch', 'Consignor 482');
  text = await sideText(page);
  step('English: the log shows the check in a table', /Your checks/.test(text) && /Boppy/i.test(text) && await page.$('table.log') !== null);
  const [csvBtn] = await page.$$('xpath/.//button[contains(., "Download CSV")]');
  await csvBtn.click();
  await new Promise(r => setTimeout(r, 2500));
  const csvFile = readdirSync(downloads).find(f => f.endsWith('.csv'));
  const csv = csvFile ? readFileSync(path.join(downloads, csvFile), 'utf8') : '';
  step('English: the CSV downloads with a header and the check', /Date,Time,Batch,Who,Item,Result/.test(csv) && /Boppy/i.test(csv), csv.split(/\r?\n/)[1] || '(no file)');

  // Spanish: the page, a result, and a Spanish title the English rules used to skip.
  await page.goto(`${url}?lang=es`, { waitUntil: 'networkidle2', timeout: 45000 });
  const title = await page.$eval('#title', el => el.textContent);
  step('Spanish: ?lang=es turns the page to Spanish', /Revise un anuncio de segunda mano/.test(title), title);
  const link = await page.$eval('#lang-link', el => el.textContent);
  step('Spanish: the switch offers English', link === 'English', link);
  text = await check(page, 'Protector para cuna trenzado');
  step('Spanish: a braided crib bumper in Spanish is flagged, in Spanish', /Protector acolchado para cuna/.test(text) && /No lo compre/.test(text), text.slice(0, 200));
  step('Spanish: its card carries the safe-sleep line in Spanish', /solo de decoración|sábana ajustable/.test(text), (text.match(/Para cada sueño[^.]*\./) || [''])[0]);
  await page.click('.result-foot .btn');
  text = await check(page, 'Cuna de madera usada');
  step('Spanish: a no-match result in Spanish, with the 2011 crib line', /Sin coincidencias/.test(text) && /28 de junio de 2011/.test(text), text.slice(0, 200));
  step('Spanish: never "es seguro" as reassurance', !/\bes seguro\b(?! que)/.test(text.replace(/no quiere decir que sea seguro/g, '')));
} catch (e) {
  step('run finished', false, String(e));
} finally {
  await browser.close();
  try { rmSync(profile, { recursive: true, force: true }); rmSync(downloads, { recursive: true, force: true }); } catch { /* fine */ }
}
const report = { at: new Date().toISOString(), url, passed: steps.filter(s => s.ok).length, failed: steps.filter(s => !s.ok).length, steps };
writeFileSync('tools/web-log-report.json', JSON.stringify(report, null, 1));
console.log(`${report.passed} passed, ${report.failed} failed`);
