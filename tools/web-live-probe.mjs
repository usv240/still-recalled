// Diagnostic: open the web page and print its recall-data line and the recent recalls it lists.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(process.argv[2] || 'http://localhost:8766/web/index.html', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 40; i++) {
  const line = await p.$eval('#data-line', e => e.textContent).catch(() => '');
  if (/published since/.test(line)) break;
  await new Promise(r => setTimeout(r, 1000));
}
console.log(await p.$eval('#data-line', e => e.textContent).catch(() => ''));
console.log(await p.$$eval('.recent .row-title', els => els.map(e => e.textContent)).catch(() => []));
await p.screenshot({ path: 'e2e-out/web-live.png' });
await b.close();
