// CPSC safety warnings in the field guide. When a firm will not recall a hazardous product, CPSC warns the public on
// its own ("CPSC Warns Consumers to Stop Using ..."). Those warnings are not in the recall API the cards are built
// from: on 2026-11-20 the warnings file held 393 notices, 144 of them from 2026, many for infant loungers, crib
// bumpers and walkers sold online by sellers who never answered. A parent meets these products secondhand like any
// recalled one, so each warning gets a card the same way a recall does: Gemini, through Firebase AI Logic, reads the
// warning once and writes its spotter card (shared/spotter.mjs), and from then on the device matches it in code.
//
//   node scripts/build-warnings.mjs [--fetch]     --fetch downloads CPSC's file again (data/raw/cpsc-warnings.csv)
//
// Writes data/warnings.json (the warnings as records), adds spotter cards to data/spotter.jsonl, and merges the cards
// into extension/data/cards.json after the recall cards, which are left exactly as they were. The full text the cloud
// check reads goes to extension/data/warnings.json (the recall API has no notice for a warning).
// Build-time only: uses the App Check debug token in extension/src/appcheck-debug.local.js, which never ships.
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { liveCardsFromCpsc } from '../shared/cards.mjs';
import { SPOTTER_SYSTEM, SPOTTER_SCHEMA, noticeText } from '../shared/spotter.mjs';
import { WARNINGS_CSV, warningRecords } from '../shared/warnings.mjs';

const SOURCE = WARNINGS_CSV;
const RAW = 'data/raw/cpsc-warnings.csv';
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + '…');
export { warningRecords };

/** Warning cards, made the careful way cards for new notices are (liveCardsFromCpsc), marked as warnings. */
export function warningCards(records, spots, baseCards) {
  return liveCardsFromCpsc(records, spots, baseCards).map(c => { const { live, ...card } = c; return { ...card, warning: true }; });
}

if (process.argv[1] && /build-warnings\.mjs$/.test(process.argv[1])) {
  mkdirSync('data/raw', { recursive: true });
  if (process.argv.includes('--fetch') || !existsSync(RAW)) {
    const res = await fetch(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`CPSC warnings file: HTTP ${res.status}`);
    writeFileSync(RAW, Buffer.from(await res.arrayBuffer()));
  }
  const records = warningRecords(readFileSync(RAW, 'utf8'));
  writeFileSync('data/warnings.json', JSON.stringify({ source: SOURCE, read: new Date().toISOString().slice(0, 10), records }));
  console.log(`${records.length} warnings, ${records.at(-1).RecallDate} to ${records[0].RecallDate}`);

  // The cloud writes each warning's spotter card, once (the model and prompt that wrote the recalls' cards).
  const { cloudJson } = await import('../tools/cloud-node.mjs');
  const spotFile = 'data/spotter.jsonl';
  const readSpots = () => new Map(readFileSync(spotFile, 'utf8').split('\n').filter(Boolean).map(l => { const s = JSON.parse(l); return [s.id, s]; }));
  const have = readSpots();
  const todo = records.filter(r => !have.has(r.RecallNumber));
  console.log(`${todo.length} spotter cards to write (${records.length - todo.length} already written)`);
  let i = 0, failed = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < todo.length) {
      const r = todo[i++];
      try {
        const { answer } = await cloudJson({ system: SPOTTER_SYSTEM, schema: SPOTTER_SCHEMA, parts: [noticeText(r)], models: ['gemini-3.5-flash-lite', 'gemini-4-hydrogen'], temperature: 0 });
        appendFileSync(spotFile, JSON.stringify({ id: r.RecallNumber, ...answer }) + '\n');
      } catch (e) { failed++; console.error(r.RecallNumber, String(e).slice(0, 120)); }
    }
  }));
  if (failed) console.log(`${failed} failed; run again to retry them`);

  const file = 'extension/data/cards.json';
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  const base = payload.cards.filter(c => !c.warning);
  const cards = warningCards(records, readSpots(), base);
  payload.cards = [...base, ...cards];
  payload.warnings = { source: SOURCE, read: new Date().toISOString().slice(0, 10), count: cards.length };
  writeFileSync(file, JSON.stringify(payload));
  const meta = JSON.parse(readFileSync('extension/data/meta.json', 'utf8'));
  writeFileSync('extension/data/meta.json', JSON.stringify({ ...meta, count: base.length, warnings: cards.length }));
  // What the cloud check reads for a warning, by id: the recall API has no notice for these.
  const keep = new Set(cards.map(c => c.id));
  writeFileSync('extension/data/warnings.json', JSON.stringify(Object.fromEntries(records.filter(r => keep.has(r.RecallNumber)).map(r => [r.RecallNumber, { ...r, Description: clip(r.Description, 1700) }]))));
  const kids = [...readSpots().values()].filter(s => keep.has(s.id) && s.for_children).length;
  console.log(`${base.length} recall cards kept as they were; ${cards.length} warning cards added (${kids} for babies or children), ${cards.filter(c => c.brands.length).length} with a brand to match`);
}
