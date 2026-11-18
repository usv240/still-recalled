// Development only: screenshots of local preview pages. Usage: node tools/shot.mjs <url> <out.png> [width] [height] [scale]
import puppeteer from 'puppeteer-core';
const [url, out, w = '1280', h = '900', scale = '1'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true });
try {
  const p = await b.newPage();
  await p.setViewport({ width: +w, height: +h, deviceScaleFactor: +scale });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  await p.screenshot({ path: out });
} finally { await b.close(); }
