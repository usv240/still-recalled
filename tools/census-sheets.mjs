// Builds numbered photo sheets from a census (tools/census.mjs) for the photo review: 16 listings a sheet, each with
// its number, title and price. Two groups: "flagged" (listings the word rules flagged) and "open" (listings from the
// baby searches that the word rules left open). Photos must be saved first (they are short-lived addresses).
// Usage: node tools/census-sheets.mjs tools/census-facebook.json E:/sr-census-fb
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[2], dir = process.argv[3];
const census = JSON.parse(readFileSync(file, 'utf8'));
const { flagged } = JSON.parse(readFileSync(file.replace(/\.json$/, '-flagged.json'), 'utf8'));
const isFlagged = new Set(flagged.map(f => f.id));
const BABY = /: (baby lounger|baby nest|baby rocker sleeper)$/;
const open = Object.values(census.listings).filter(l => !isFlagged.has(l.id) && l.searches.some(s => BABY.test(s)));
const groups = { flagged: flagged.map(f => census.listings[f.id]), open };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
mkdirSync(path.join(dir, 'sheets'), { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1440 });
const index = {};
for (const [name, list] of Object.entries(groups)) {
  index[name] = list.map((l, i) => ({ n: i + 1, id: l.id, title: l.title, price: l.price || '', city: l.city, search: l.searches[0].split(': ')[1] }));
  for (let s = 0; s * 16 < list.length; s++) {
    const tiles = list.slice(s * 16, s * 16 + 16).map((l, j) => `<div class="t"><img src="${pathToFileURL(path.join(dir, 'img', `${l.id}.jpg`)).href}"><b>${s * 16 + j + 1}</b><p>${esc(l.title.slice(0, 70))} <i>${esc(l.price || '')}</i></p></div>`).join('');
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;font:15px/1.25 system-ui,sans-serif;color:#000}
.g{display:grid;grid-template-columns:repeat(4,320px);grid-auto-rows:360px}.t{position:relative;padding:4px;border:1px solid #ccc;overflow:hidden}
img{width:310px;height:290px;object-fit:contain;background:#eee;display:block}b{position:absolute;left:4px;top:4px;background:#000;color:#fff;font-size:22px;padding:2px 8px}
p{margin:4px 0 0;height:52px;overflow:hidden}i{font-style:normal;font-weight:600}</style><div class="g">${tiles}</div>`;
    const tmp = path.join(dir, 'sheet.html');
    writeFileSync(tmp, html);
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(dir, 'sheets', `${name}-${String(s + 1).padStart(2, '0')}.png`) });
    rmSync(tmp);
  }
  console.log(`${name}: ${list.length} listings, ${Math.ceil(list.length / 16)} sheets`);
}
await browser.close();
writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));
