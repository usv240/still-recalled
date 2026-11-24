// Accessibility audit with axe-core (the engine behind Lighthouse's accessibility score and many screen-reader
// test suites) on every surface a browser can show: the web page, the practice page and the privacy page, the
// extension's side panel (list, card, no-match and settings views, through tools/preview) and its welcome page. Light
// and dark, phone and desktop widths, WCAG 2.2 A and AA rules. Every Google and Firebase request is blocked, so no
// model is called and nothing is billed.
//
//   node tools/a11y.mjs            prints each violation and writes tools/a11y-report.json; exits 1 on any
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const root = path.resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p.endsWith(path.sep)) p = path.join(p, 'index.html');
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const pages = [
  ['web page', '/web/'],
  ['practice page', '/web/try/'],
  ['privacy page', '/web/privacy.html'],
  ['panel: flagged list', '/tools/preview/panel.html?fixture=mixed'],
  ['panel: recall card', '/tools/preview/panel.html?fixture=mixed&detail=recall'],
  ['panel: type card', '/tools/preview/panel.html?fixture=lounger&detail=first'],
  ['panel: no matches', '/tools/preview/panel.html?fixture=clear'],
  ['panel: still checking', '/tools/preview/panel.html?fixture=checking'],
  ['panel: settings', '/tools/preview/panel.html?fixture=mixed&settings=1'],
  ['extension welcome', '/extension/welcome.html'],
];
const sizes = [[390, 844], [1280, 900]];

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true });
const report = [];
let blocked = 0;
try {
  for (const [name, url] of pages) {
    for (const scheme of ['light', 'dark']) {
      for (const [w, hgt] of sizes) {
        const p = await b.newPage();
        await p.setRequestInterception(true);
        p.on('request', r => { if (/google|firebase|gstatic|recaptcha/.test(new URL(r.url()).hostname)) { blocked++; r.abort(); } else r.continue(); });
        await p.setViewport({ width: w, height: hgt });
        await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
        await p.goto(base + url, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
        await p.evaluate(axeSource);
        const res = await p.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
        report.push({ name, scheme, width: w, passes: res.passes.length, incomplete: res.incomplete.length,
          violations: res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => n.target.join(' ')) })) });
        await p.close();
      }
    }
  }
} finally { await b.close(); server.close(); }

let total = 0;
for (const r of report) {
  total += r.violations.length;
  console.log(`${r.violations.length ? 'FAIL' : 'ok  '} ${r.name} (${r.scheme}, ${r.width} px): ${r.passes} rules passed${r.violations.length ? '' : ''}`);
  for (const v of r.violations) console.log(`       ${v.impact} ${v.id}: ${v.help} -> ${v.nodes.join(', ')}`);
}
await writeFile('tools/a11y-report.json', JSON.stringify({ at: new Date().toISOString(), axe: JSON.parse(await readFile(createRequire(import.meta.url).resolve('axe-core/package.json'), 'utf8')).version, blockedRequests: blocked, report }, null, 2));
console.log(`${report.length} page views, ${total} violations; ${blocked} Google/Firebase requests blocked`);
process.exit(total ? 1 : 0);
