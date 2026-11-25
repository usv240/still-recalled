// Checks fitsNotice against real CPSC notices. Usage: node tools/fits-real.mjs <recalls.json from the recall-mirror branch>
// How many honest field-guide entries (written by Gemini at build time) pass fitsNotice against their CPSC notice.
import { readFileSync } from 'node:fs';
import { fitsNotice } from '../shared/fieldguide.mjs';
const recs = JSON.parse(readFileSync(process.argv[2] || 'recalls.json', 'utf8'));
const spots = new Map(readFileSync('data/spotter.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(({ id, ...s }) => [id, s]));
const why = {}; let n = 0, ok = 0;
for (const r of recs) { const s = spots.get(String(r.RecallNumber)); if (!s) continue; n++; const w = fitsNotice(s, r); if (!w) ok++; else { const k = w.split(':')[0]; why[k] = (why[k] || 0) + 1; if ((why[k]) <= 2) console.log(r.RecallNumber, w); } }
console.log({ pairs: n, fit: ok, why });
