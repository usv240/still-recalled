// Builds tools/fixtures/bumpers.json for the gallery: the crib bedding sets from the first accuracy test, with the
// engine's real decisions from that run (tools/eval-results-hybrid.json): level, the cloud's evidence, where it ran.
// Development only. Usage: node tools/make-gallery-fixture.mjs, then open
// http://localhost:8766/tools/preview/listings.html?fixture=bumpers&links=off
import { readFileSync, writeFileSync } from 'node:fs';
import { BANNED_TYPES } from '../shared/banned.mjs';
import { present } from '../shared/present.mjs';

const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const listings = read('./eval-listings.json')['crib bedding set'];
const rows = new Map(read('./eval-results-hybrid.json').rows.map(r => [r.id, r]));
const bumper = BANNED_TYPES.find(t => t.key === 'crib_bumper');

const results = {};
listings.forEach((l, order) => {
  const row = rows.get(l.id);
  if (!row) return;
  const flagged = row.final === 'likely' || row.final === 'possible';
  const decision = flagged
    ? { level: row.final, kind: 'banned', banned: bumper, confirmed: !!row.cloud, evidence: row.evidence, why: row.why }
    : { level: 'none', why: row.why };
  const r = present(l, decision, { device: row.usedDevice, deviceLevel: row.device, cloud: row.cloud ? { model: row.cloud } : null });
  results[l.id] = { ...r, order };
});
writeFileSync(new URL('./fixtures/bumpers.json', import.meta.url), JSON.stringify({ scope: 'crib bedding set', results }, null, 1));
console.log(Object.values(results).map(r => `${r.level.padEnd(8)} ${r.listing.price.padEnd(8)} ${r.listing.title.slice(0, 60)}`).join('\n'));
