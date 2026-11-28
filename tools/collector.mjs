// Development helper for testing against live pages. Not part of the shipped product.
//   POST /save              the setup-check report from the extension  -> tools/report.json
//   POST /listings?q=NAME   listings read from a live page             -> merged into tools/live-listings.json
//   POST /live-results      results of the live pipeline test          -> tools/live-results.json
//   POST /save-as?name=N    any test run's results                     -> tools/N.json
//   GET  /img?u=URL         fetches a listing photo so a local test page can read its pixels
//   GET  /photo?id=ID       a census photo saved on this computer (PHOTOS folder, default ../sr-census-fb/img, beside the repo)
//   GET  /anything-else     static files from the project folder
// Usage: node tools/collector.mjs
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PHOTO_HOSTS = /(^|\.)(ebayimg\.com|mercdn\.net|craigslist\.org|fbcdn\.net|cpsc\.gov)$/;

async function body(req) {
  let s = '';
  for await (const chunk of req) s += chunk;
  return s;
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    if (req.method === 'POST' && url.pathname === '/save') {
      await writeFile(path.join(here, 'report.json'), JSON.stringify(JSON.parse(await body(req)), null, 1));
      res.writeHead(200).end('saved'); return;
    }
    if (req.method === 'POST' && url.pathname === '/live-results') {
      await writeFile(path.join(here, 'live-results.json'), JSON.stringify(JSON.parse(await body(req)), null, 1));
      res.writeHead(200).end('saved'); return;
    }
    if (req.method === 'POST' && url.pathname === '/save-as') {
      const name = url.searchParams.get('name') || '';
      if (!/^[a-z0-9-]{1,40}$/.test(name)) { res.writeHead(400).end('bad name'); return; }
      await writeFile(path.join(here, `${name}.json`), JSON.stringify(JSON.parse(await body(req)), null, 1));
      res.writeHead(200).end('saved'); return;
    }
    if (req.method === 'POST' && url.pathname === '/listings') {
      const file = path.join(here, 'live-listings.json');
      const all = await readFile(file, 'utf8').then(JSON.parse, () => ({}));
      all[url.searchParams.get('q') || 'unnamed'] = JSON.parse(await body(req));
      await writeFile(file, JSON.stringify(all, null, 1));
      res.writeHead(200).end('saved ' + Object.keys(all).length); return;
    }
    if (req.method === 'GET' && url.pathname === '/photo') {
      // Marketplace photo addresses stop working after a while; the census saved a copy of each (not in the repo).
      const id = url.searchParams.get('id') || '';
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) { res.writeHead(400).end('bad id'); return; }
      const data = await readFile(path.join(process.env.PHOTOS || '../sr-census-fb/img', `${id}.jpg`)).catch(() => null);
      if (!data) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(data); return;
    }
    if (req.method === 'GET' && url.pathname === '/img') {
      const target = new URL(url.searchParams.get('u'));
      if (target.protocol !== 'https:' || !PHOTO_HOSTS.test(target.hostname)) { res.writeHead(400).end('host not allowed'); return; }
      const r = await fetch(target, { headers: { 'user-agent': 'Mozilla/5.0' } });
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'image/jpeg' });
      res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    if (req.method === 'GET') {
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/tools/live-test.html' : url.pathname));
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data); return;
    }
    res.writeHead(404).end();
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(8766, '127.0.0.1', () => console.log('Collector listening on http://localhost:8766'));
