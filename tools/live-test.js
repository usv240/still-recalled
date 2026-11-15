import { deviceStatus, deviceModel, imagePart } from '../extension/src/ai.js';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { bannedHints, notTheProduct } from '../shared/banned.mjs';
import { SYSTEM, SCHEMA, promptText, decide } from '../shared/judge.mjs';

const log = line => { document.getElementById('log').textContent += line + '\n'; };
const SITE_NOISE = /\s*Opens in a new window or tab\s*$/i;

window.__run = async (perSearch = 5, usePhoto = true) => {
  document.title = 'live test: running';
  const status = await deviceStatus();
  log('on-device model: ' + status);
  const { cards } = await (await fetch('/extension/data/cards.json')).json();
  const all = await (await fetch('/tools/live-listings.json')).json();
  const index = buildIndex(cards);
  const judge = deviceModel({ system: SYSTEM, schema: SCHEMA });
  const rows = [];
  for (const [search, list] of Object.entries(all)) {
    for (const raw of list.slice(0, perSearch)) {
      const listing = { ...raw, title: raw.title.replace(SITE_NOISE, '').replace(/^New Listing/i, '').trim() };
      const row = { search, title: listing.title, price: listing.price };
      const t0 = performance.now();
      if (notTheProduct(listing.title)) {
        row.decision = 'none'; row.why = 'part or toy (word rule)'; row.skippedModel = true;
      } else {
        const candidate = shortlist(index, listing.title)[0] || null;
        const hints = bannedHints(listing.title);
        row.candidate = candidate ? `${candidate.strength} ${candidate.card.id} ${candidate.card.product}` : null;
        row.hints = hints.map(h => h.key);
        try {
          const parts = [promptText(listing, candidate, hints)];
          if (usePhoto && listing.image) parts.push(await imagePart('/img?u=' + encodeURIComponent(listing.image)));
          const r = await judge.generateContent(parts);
          row.answer = JSON.parse(r.response.text());
          row.inferenceSource = r.response.inferenceSource;
          const d = decide(row.answer, candidate, hints);
          row.decision = d.level; row.why = d.why;
          row.flagged = d.card ? `${d.card.id} ${d.card.product}` : (d.banned ? d.banned.key : null);
        } catch (e) {
          row.error = String(e);
        }
      }
      row.ms = Math.round(performance.now() - t0);
      rows.push(row);
      log(`${(row.decision || 'ERROR').padEnd(9)} ${String(row.ms).padStart(5)} ms  ${row.title.slice(0, 70)}${row.error ? '  ' + row.error : ''}`);
    }
  }
  const report = { when: new Date().toISOString(), status, usePhoto, rows };
  await fetch('/live-results', { method: 'POST', body: JSON.stringify(report) });
  document.title = 'live test: done ' + rows.length;
};
document.title = 'live test: ready';
