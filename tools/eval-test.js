// Development page: the accuracy test. Runs the extension's own engine (extension/src/engine.js, unchanged code path)
// on the held-out listings in tools/eval-listings.json, which were collected after the rules were written and never
// used to tune them.
//
//   window.__eval({ mode: 'words' })    no model at all (a computer without Chrome's built-in model, cloud off)
//   window.__eval({ set: 'fresh' })     the second test set, tools/fresh-listings.json, collected after the fixes
//   window.__eval({ mode: 'hybrid' })   on-device model, then the cloud on what it flags; the on-device-only verdict
//                                       is recorded too (result.how.deviceLevel), so one run gives both
//
// Results go to tools/eval-results-<mode>.json. Labels live in tools/eval-labels.json and are scored by
// tools/eval-score.mjs, which never feeds anything back into the rules.
import { checkListing, useCards } from '../extension/src/engine.js';
import { deviceStatus } from '../extension/src/ai.js';

useCards('/extension/data/cards.json');
const proxied = u => (u && /^https:/.test(u) ? `/img?u=${encodeURIComponent(u)}` : u);
const log = line => { document.getElementById('log').textContent += line + '\n'; };
const save = (name, data) => fetch(`/save-as?name=${name}`, { method: 'POST', body: JSON.stringify(data) });

// `tag` names a later run of the same test ("-rerun"), so the first, published results are never overwritten.
window.__eval = async ({ mode = 'hybrid', set = 'eval', limit = 9999, only = '', resume = false, tag = '' } = {}) => {
  const name = `${set}-results-${mode}${tag}`;
  const status = await deviceStatus();
  const modelReady = mode === 'hybrid' && status === 'available';
  if (mode === 'hybrid' && !modelReady) { log(`on-device model is "${status}", not available: stopping`); return; }
  document.title = `eval ${mode}: running`;
  const sets = await (await fetch(`/tools/${set}-listings.json`)).json();
  const listings = Object.entries(sets).flatMap(([search, list]) => list.map(l => ({ ...l, search })));
  const pick = only ? listings.filter(l => new RegExp(only, 'i').test(l.title)) : listings;
  // resume: keep the rows a stopped run saved and continue with the rest (the browser tab can freeze mid-run).
  const prior = resume ? await fetch(`/tools/${name}.json`).then(r => r.json()).catch(() => null) : null;
  const rows = prior ? prior.rows.filter(r => !r.error) : [];
  const done = new Set(rows.map(r => r.id));
  if (prior) log(`resuming after ${rows.length} saved rows`);
  const t0 = performance.now() - (prior && prior.totalMs || 0);
  for (const listing of pick.slice(0, limit)) {
    if (done.has(listing.id)) continue;
    // Whether the photo could be read at all, so a miss can be told apart from a missing photo.
    const photoOk = listing.image ? await fetch(proxied(listing.image)).then(r => r.ok, () => false) : false;
    const start = performance.now();
    let r;
    try {
      r = await checkListing(listing, { modelReady, cloud: mode === 'hybrid', imageUrl: proxied });
    } catch (e) {
      r = { id: listing.id, level: 'error', error: String(e).slice(0, 200), how: {} };
    }
    const row = {
      id: listing.id, search: listing.search, title: listing.title, price: listing.price || '', photoOk,
      final: r.level, kind: r.kind || null, device: r.how && r.how.deviceLevel, usedDevice: !!(r.how && r.how.device),
      deviceUnit: (r.how && r.how.deviceUnit) || '', cloudMatch: (r.how && r.how.cloudMatch) || '', candidate: (r.how && r.how.candidate) || '',
      cloud: (r.how && r.how.cloudModel) || '', cloudError: (r.how && r.how.cloudError) || '', deviceError: (r.how && r.how.deviceError) || '',
      recall: r.recall ? r.recall.id : null, banned: r.banned ? r.banned.key : null,
      // The cloud's questions to the device's field guide (shared/lookup.mjs), and a recall shown because of one.
      lookups: (r.how && r.how.lookups) || [], lookedUp: !!r.lookedUp, also: r.also ? r.also.id : null,
      // The device's own question to its field guide: the brand the built-in model read in the photo, and the recall.
      seen: (r.how && r.how.seen) || null,
      why: r.why || '', evidence: r.evidence || '', ms: Math.round(performance.now() - start), error: r.error || '',
    };
    rows.push(row);
    document.title = `eval ${mode}: ${rows.length}/${pick.length}`;
    log(`${String(rows.length).padStart(3)} ${String(row.device || '-').padEnd(8)} -> ${String(row.final).padEnd(8)} ${String(row.ms).padStart(5)}ms ${row.cloud ? 'cloud' : '     '} ${listing.title.slice(0, 70)}${row.error ? '  ERR ' + row.error : ''}`);
    if (rows.length % 5 === 0) await save(name, { partial: true, mode, status, totalMs: Math.round(performance.now() - t0), rows });
  }
  const report = { when: new Date().toISOString(), mode, status, totalMs: Math.round(performance.now() - t0), rows };
  await save(name, report);
  document.title = `eval ${mode}: done ${rows.length}`;
  return rows.length;
};
document.title = 'eval: ready';
