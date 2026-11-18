// Fetch recall notices from the CPSC public API and write them as recall cards.
// Every recall CPSC has published (since 1973), joined with the spotter cards in data/spotter.jsonl
// (scripts/build-spotter.mjs). Secondhand goods are old: a five-year window misses the 2019 Rock 'n Play recall.
// Usage: node scripts/build-cards.mjs [--since 1973-01-01] [--from path/to/saved.json] [--save path/to/save.json]
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cardsFromCpsc } from '../shared/cards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};
const since = arg('--since') || '1973-01-01';
const from = arg('--from');

let records;
if (from) {
  records = JSON.parse(await readFile(from, 'utf8'));
} else {
  // In spans of years: one request for everything is slow to answer.
  records = [];
  const end = new Date().getFullYear() + 1;
  for (let y = Number(since.slice(0, 4)); y <= end; y += 8) {
    const from = y === Number(since.slice(0, 4)) ? since : `${y}-01-01`;
    const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${from}&RecallDateEnd=${Math.min(y + 7, end)}-12-31`;
    const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`CPSC API returned ${res.status}`);
    records.push(...await res.json());
  }
  if (arg('--save')) await writeFile(arg('--save'), JSON.stringify(records));
}

const spotFile = path.join(root, 'data', 'spotter.jsonl');
const spots = new Map(existsSync(spotFile) ? readFileSync(spotFile, 'utf8').split('\n').filter(Boolean).map(l => { const s = JSON.parse(l); return [s.id, s]; }) : []);
const cards = cardsFromCpsc(records, spots);
const out = path.join(root, 'extension', 'data');
await mkdir(out, { recursive: true });
const payload = { source: 'U.S. Consumer Product Safety Commission recall API', since, built: new Date().toISOString(), cards };
await writeFile(path.join(out, 'cards.json'), JSON.stringify(payload));
// A small stamp the side panel reads without loading every card.
await writeFile(path.join(out, 'meta.json'), JSON.stringify({ source: payload.source, since, built: payload.built, count: cards.length }));
const bytes = Buffer.byteLength(JSON.stringify(payload));
console.log(`${spots.size} spotter cards; ${cards.filter(c => c.kinds.length).length} cards use one`);
console.log(`${records.length} records -> ${cards.length} cards, ${(bytes / 1024).toFixed(0)} KB, newest ${cards[0]?.date}, oldest ${cards.at(-1)?.date}`);
