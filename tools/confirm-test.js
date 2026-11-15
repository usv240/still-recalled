// Development page: the cloud check on real eBay listings.
// Takes the on-device answers saved by the live test (tools/live-results-v2.json), recomputes the on-device decision
// with the current code, sends only the flagged listings to the cloud with the full recall notice and both photos,
// and saves the results to tools/confirm-results.json.
// Open http://localhost:8766/tools/confirm-test.html and call window.__confirm().
import { cloudJson, imagePart } from '../extension/src/ai.js';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { bannedHints, notTheProduct, mayContain } from '../shared/banned.mjs';
import { decide } from '../shared/judge.mjs';
import { fetchNotice } from '../shared/notice.mjs';
import { CONFIRM_SYSTEM, CONFIRM_SCHEMA, confirmParts, decideFinal } from '../shared/confirm.mjs';

const log = line => { document.getElementById('log').textContent += line + '\n'; };
const SITE_NOISE = /\s*(Opens in a new window or tab|New Listing)\s*/gi;
const proxied = url => `/img?u=${encodeURIComponent(url)}`;
const photo = url => (url ? imagePart(proxied(url)).catch(() => null) : null);

window.__confirm = async (limit = 99, onlyPattern = '') => {
  const only = onlyPattern ? new RegExp(onlyPattern, 'i') : null;
  document.title = 'confirm test: running';
  const { cards } = await (await fetch('/extension/data/cards.json')).json();
  const index = buildIndex(cards);
  const saved = await (await fetch('/tools/live-results-v2.json')).json();
  const listings = Object.values(await (await fetch('/tools/live-listings.json')).json()).flat();
  const byTitle = new Map(listings.map(l => [l.title.replace(SITE_NOISE, ' ').trim(), l]));

  const rows = [];
  for (const row of saved.rows) {
    const title = row.title.replace(SITE_NOISE, ' ').trim();
    const listing = { ...(byTitle.get(title) || {}), title, price: row.price };
    const candidate = notTheProduct(title) ? null : shortlist(index, title)[0] || null;
    const hints = bannedHints(title);
    const partOrToy = notTheProduct(title);
    // Saved answers lack rows the old parts rule skipped; give those a neutral answer so the current rules decide.
    const answer = row.answer || (partOrToy ? null : { what_is_for_sale: 'the_product', product_kind: '', same_kind_as_recalled: !!candidate, banned_type: 'none' });
    const device = answer ? decide(answer, candidate, hints, mayContain(title)) : { level: 'none', why: 'part or toy (word rule)' };
    const out = { search: row.search, title, price: row.price, url: listing.url, device: { level: device.level, kind: device.kind, why: device.why, askCloud: !!device.askCloud, card: device.card && device.card.id, banned: device.banned && device.banned.key } };
    rows.push(out);
    if ((device.level === 'none' && !device.askCloud) || rows.filter(r => r.cloud).length >= limit) continue;
    if (only && !only.test(title)) continue;

    const t0 = performance.now();
    try {
      const notice = device.kind === 'recall' && device.card ? await fetchNotice(device.card.id) : null;
      const [listingPhoto, recallPhoto] = await Promise.all([photo(listing.image), photo(notice && notice.images[0])]);
      const { answer, model } = await cloudJson({ system: CONFIRM_SYSTEM, schema: CONFIRM_SCHEMA, parts: confirmParts({ listing, notice, listingPhoto, recallPhoto }) });
      const final = decideFinal(device, answer, hints);
      out.cloud = { model, answer, ms: Math.round(performance.now() - t0), photos: [!!listingPhoto, !!recallPhoto] };
      out.final = { level: final.level, kind: final.kind, why: final.why, check: final.check, evidence: final.evidence };
      log(`${device.level.padEnd(8)} -> ${final.level.padEnd(8)} ${out.cloud.ms}ms ${model}  ${title.slice(0, 60)}\n    ${answer.matches_recall}/${answer.banned_type}: ${answer.evidence}\n    check: ${answer.check_before_buying}`);
    } catch (e) {
      out.cloudError = String(e).slice(0, 300);
      log(`${device.level.padEnd(8)} -> ERROR ${out.cloudError.slice(0, 120)}  ${title.slice(0, 50)}`);
    }
  }
  const summary = {};
  for (const r of rows) {
    const k = `${r.device.level} -> ${r.final ? r.final.level : r.cloudError ? 'error' : r.device.level}`;
    summary[k] = (summary[k] || 0) + 1;
  }
  log('\nSUMMARY ' + JSON.stringify(summary));
  await fetch('/save-as?name=confirm-results', { method: 'POST', body: JSON.stringify({ when: new Date().toISOString(), summary, rows }) });
  document.title = 'confirm test: done';
  return summary;
};
