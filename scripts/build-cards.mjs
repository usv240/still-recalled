// Fetch recall notices from the CPSC public API and write them as recall cards.
// Usage: node scripts/build-cards.mjs [--since 2021-11-14] [--from path/to/saved.json]
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cardsFromCpsc } from '../shared/cards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};
const fiveYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
};

const since = arg('--since') || fiveYearsAgo();
const from = arg('--from');

let records;
if (from) {
  records = JSON.parse(await readFile(from, 'utf8'));
} else {
  const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${since}`;
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`CPSC API returned ${res.status}`);
  records = await res.json();
}

const cards = cardsFromCpsc(records);
const out = path.join(root, 'extension', 'data');
await mkdir(out, { recursive: true });
const payload = { source: 'U.S. Consumer Product Safety Commission recall API', since, built: new Date().toISOString(), cards };
await writeFile(path.join(out, 'cards.json'), JSON.stringify(payload));
// A small stamp the side panel reads without loading every card.
await writeFile(path.join(out, 'meta.json'), JSON.stringify({ source: payload.source, since, built: payload.built, count: cards.length }));
const bytes = Buffer.byteLength(JSON.stringify(payload));
console.log(`${records.length} records -> ${cards.length} cards, ${(bytes / 1024).toFixed(0)} KB, newest ${cards[0]?.date}, oldest ${cards.at(-1)?.date}`);
