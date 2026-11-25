// The recall mirror (.github/workflows/recall-mirror.yml): the last DAYS days of CPSC's recall API, unchanged, written
// to <out>/recalls.json with meta.json beside it. Exits non-zero, publishing nothing, when CPSC's answer is not a
// plausible list of recalls, so a bad day never replaces a good mirror.
// Usage: node tools/recall-mirror.mjs <out folder> [--days=180]
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] || 'recall-mirror-out';
const days = Number((process.argv.find(a => a.startsWith('--days=')) || '--days=180').slice(7));
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const from = day(-days), to = day(2);
const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${from}&RecallDateEnd=${to}&_=${Date.now()}`;

let records;
for (let attempt = 1; ; attempt++) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { accept: 'application/json', 'user-agent': 'StillRecalled-recall-mirror' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    records = await res.json();
    break;
  } catch (e) {
    if (attempt >= 3) { console.error(`CPSC could not be reached: ${e}`); process.exit(1); }
    await new Promise(r => setTimeout(r, 15000 * attempt));
  }
}
// CPSC publishes several recalls a week; fewer than 20 in 180 days means a broken answer, not a quiet season.
const good = Array.isArray(records) && records.length >= Math.min(20, days / 9) && records.every(r => r && r.RecallNumber && r.RecallDate);
if (!good) { console.error(`Not a plausible answer: ${Array.isArray(records) ? records.length + ' records' : typeof records}`); process.exit(1); }
records.sort((a, b) => String(b.RecallDate).localeCompare(String(a.RecallDate)));

mkdirSync(out, { recursive: true });
writeFileSync(`${out}/recalls.json`, JSON.stringify(records));
const meta = { fetched: new Date().toISOString(), from, to, count: records.length, newest: String(records[0].RecallDate).slice(0, 10), source: 'https://www.saferproducts.gov/RestWebServices/Recall' };
writeFileSync(`${out}/meta.json`, JSON.stringify(meta, null, 1));
writeFileSync(`${out}/README.md`, `# Recall mirror\n\nCPSC's recall API, ${from} to ${to}, copied unchanged on ${meta.fetched} (${meta.count} recalls). Still Recalled reads this only when www.saferproducts.gov can't be reached. Made by .github/workflows/recall-mirror.yml on main.\n`);
console.log(JSON.stringify(meta));
