// The cloud writes the field guide. Gemini, through Firebase AI Logic, reads every CPSC recall notice once and fills
// in a short "spotter card": the brand a seller would type, the product line, the kind of product, the models and
// years, and one sentence on how to tell a recalled unit from one that is not. The cards ship with the extension, so
// the word rules and the built-in model use them on the shopper's computer with no cloud call.
// Build-time only: uses the App Check debug token in extension/src/appcheck-debug.local.js, which never ships.
// --direct calls the same model on Vertex AI with the developer's own Google Cloud login instead: Firebase AI Logic
// limits each user to about 100 calls a minute, which suits an app and not a 10,000-notice batch.
// Usage: node scripts/build-spotter.mjs --from C:/tmp/cpsc/all.json [--out data/spotter.jsonl] [--only 19105,21198] [--at-once 16] [--direct]
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : dflt; };
const from = arg('--from');
const outFile = arg('--out', 'data/spotter.jsonl');
const only = (arg('--only', '') || '').split(',').filter(Boolean);
const atOnce = Number(arg('--at-once', 16));
const MODEL = arg('--model', 'gemini-3.5-flash-lite');
const direct = process.argv.includes('--direct');
let gcloudToken = '', gcloudAt = 0;
const gcloud = () => { if (Date.now() - gcloudAt > 30 * 60 * 1000) { gcloudToken = execSync('gcloud auth print-access-token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); gcloudAt = Date.now(); } return gcloudToken; };

const cfg = readFileSync('extension/src/firebase-config.js', 'utf8');
const key = cfg.match(/apiKey:\s*'([^']+)'/)[1], app = cfg.match(/appId:\s*'([^']+)'/)[1];
const debugToken = readFileSync('extension/src/appcheck-debug.local.js', 'utf8').match(/['"]([0-9a-f-]{36})['"]/i)[1];
let token = '', tokenAt = 0;
async function appCheck() {
  if (Date.now() - tokenAt < 40 * 60 * 1000) return token;
  const r = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/still-recalled/apps/${app}:exchangeDebugToken?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ debugToken }) });
  if (!r.ok) throw new Error(`App Check exchange ${r.status}`);
  token = (await r.json()).token; tokenAt = Date.now();
  return token;
}

export const SPOTTER_SYSTEM = [
  'You read one U.S. CPSC recall notice and fill in a short card used to match secondhand listings (eBay, Craigslist) to it.',
  'Use only what the notice says. Write names the way a seller would type them in a listing title.',
  'brands: the brand names on the recalled product (for example "Fisher-Price", "Graco", "IKEA"). A store counts only when the product is its own brand. Not a manufacturer nobody would name in a listing. Empty if the notice names no brand.',
  'lines: distinctive product line or model names (for example "Rock \'n Play", "MamaRoo", "MALM"). Not everyday words like "deluxe" or "portable", and not the kind of product. Empty if none.',
  'kind: the kind of product in one to three everyday words, singular (for example "stroller", "crib", "space heater", "infant lounger").',
  'other_names: up to four other everyday names sellers use for the same kind of product (for example "play yard": "playpen", "playard", "pack n play").',
  'models: model, style or item numbers the notice lists, exactly as written. At most twelve.',
  'sold_from and sold_to: the first and last year the recalled units were sold or made, as four-digit years. 0 when the notice does not say.',
  'all_units: true when the recall covers every unit of the named product or line; false when only certain models, colours, dates or serial numbers are recalled.',
  'tell: one sentence, at most 35 words, on how a shopper can tell a recalled unit from one that is not: which models, colours, dates or markings, and where the label is. If all units are recalled, say so.',
  'for_children: true when the product is made for babies or children.',
].join('\n');

export const SPOTTER_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['brands', 'lines', 'kind', 'other_names', 'models', 'sold_from', 'sold_to', 'all_units', 'tell', 'for_children'],
  properties: {
    brands: { type: 'array', items: { type: 'string' } },
    lines: { type: 'array', items: { type: 'string' } },
    kind: { type: 'string' },
    other_names: { type: 'array', items: { type: 'string' } },
    models: { type: 'array', items: { type: 'string' } },
    sold_from: { type: 'integer' }, sold_to: { type: 'integer' },
    all_units: { type: 'boolean' },
    tell: { type: 'string' },
    for_children: { type: 'boolean' },
  },
};

const names = list => (Array.isArray(list) ? list.map(x => x && x.Name).filter(Boolean).join('; ') : '');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1) + '…'; };
export const noticeText = r => [
  `Recall ${r.RecallNumber}, ${String(r.RecallDate || '').slice(0, 10)}`,
  `Title: ${clip(r.Title, 300)}`,
  names(r.Products) ? `Products: ${clip(names(r.Products), 300)}` : '',
  `Description: ${clip(r.Description, 2200)}`,
  names(r.Manufacturers) ? `Manufacturer: ${clip(names(r.Manufacturers), 160)}` : '',
  names(r.Importers) ? `Importer: ${clip(names(r.Importers), 160)}` : '',
  names(r.Distributors) ? `Distributor: ${clip(names(r.Distributors), 160)}` : '',
  names(r.Retailers) ? `Sold at: ${clip(names(r.Retailers), 400)}` : '',
  (r.Images || []).length ? `Photo captions: ${clip((r.Images || []).map(i => i.Caption).filter(Boolean).join('; '), 400)}` : '',
].filter(Boolean).join('\n');

async function spot(r) {
  const body = {
    systemInstruction: { parts: [{ text: SPOTTER_SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: noticeText(r) }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SPOTTER_SCHEMA, temperature: 0 },
  };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://${direct ? 'aiplatform.googleapis.com/v1' : 'firebasevertexai.googleapis.com/v1beta'}/projects/still-recalled/locations/global/publishers/google/models/${MODEL}:generateContent`, {
      method: 'POST', body: JSON.stringify(body),
      headers: direct ? { 'Content-Type': 'application/json', Authorization: `Bearer ${gcloud()}` } : { 'Content-Type': 'application/json', 'x-goog-api-key': key, 'X-Firebase-AppCheck': await appCheck() },
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    if (res.ok) {
      const j = await res.json();
      try { return JSON.parse(j.candidates[0].content.parts.map(p => p.text || '').join('')); } catch { if (attempt >= 3) return null; }
    } else if (attempt >= 5 || ![0, 429, 500, 502, 503, 504].includes(res.status)) {
      console.error(r.RecallNumber, res.status, (await res.text()).slice(0, 160));
      return null;
    }
    await new Promise(ok => setTimeout(ok, 1500 * 2 ** attempt));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/build-spotter.mjs')) {
  const records = JSON.parse(readFileSync(from, 'utf8'));
  mkdirSync(path.dirname(outFile), { recursive: true });
  const done = new Set(existsSync(outFile) && !only.length ? readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
  const todo = records.filter(r => r.RecallNumber && !done.has(String(r.RecallNumber)) && (!only.length || only.includes(String(r.RecallNumber))));
  console.log(`${todo.length} notices to read (${done.size} already done), ${atOnce} at once, ${MODEL}`);
  let i = 0, ok = 0, failed = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: atOnce }, async () => {
    while (i < todo.length) {
      const r = todo[i++];
      const card = await spot(r);
      if (!card) { failed++; continue; }
      ok++;
      if (only.length) console.log(String(r.RecallNumber), clip(r.Title, 70), '\n  ', JSON.stringify(card));
      else appendFileSync(outFile, JSON.stringify({ id: String(r.RecallNumber), ...card }) + '\n');
      if (ok % 500 === 0) console.log(`${ok} done, ${failed} failed, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  }));
  console.log(`finished: ${ok} cards, ${failed} failed, ${Math.round((Date.now() - t0) / 1000)} s`);
}
