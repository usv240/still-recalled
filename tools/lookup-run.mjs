// Development only: the cloud confirmation with the lookup_recalls function (shared/lookup.mjs), from Node.
//
//   node tools/lookup-run.mjs --title="Baby rocker sleeper, pink" [--text="..."] [--image=<file or url>]
//       one made-up listing whose words name no product: does the cloud name it and ask the field guide?
//   node tools/lookup-run.mjs --set=third [--limit=40]
//       every listing of a test set that the hybrid run sent to the cloud, confirmed again with the function offered.
//       Reports which results change, against the labels. Saves tools/<set>-lookup.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { cloudJsonTool, imagePart } from './cloud-node.mjs';
import { buildIndex } from '../shared/shortlist.mjs';
import { triage, wordsOnlyAnswer } from '../shared/triage.mjs';
import { decide } from '../shared/judge.mjs';
import { fetchNotice as fetchRecall, noticeFromCpsc } from '../shared/notice.mjs';
import { CONFIRM_SYSTEM_LOOKUP, CONFIRM_SCHEMA_LOOKUP, confirmParts, decideFinal } from '../shared/confirm.mjs';
import { LOOKUP_TOOL, lookupArgs, lookupCards, lookupResponse } from '../shared/lookup.mjs';

const args = process.argv.slice(2);
const opt = (k, d = '') => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const { cards } = JSON.parse(readFileSync('extension/data/cards.json', 'utf8'));
const index = buildIndex(cards);
// A CPSC warning's text ships with the cards; the recall API has none (extension/src/engine.js noticeFor).
const warnings = existsSync('extension/data/warnings.json') ? JSON.parse(readFileSync('extension/data/warnings.json', 'utf8')) : {};
const fetchNotice = async id => (/^W/.test(String(id)) ? noticeFromCpsc(warnings[id]) : fetchRecall(id));

async function photoPart(src) {
  if (!src) return null;
  if (/^https?:/.test(src)) return imagePart(src);
  if (!existsSync(src)) return null;
  return { inlineData: { mimeType: /\.png$/i.test(src) ? 'image/png' : 'image/jpeg', data: readFileSync(src).toString('base64') } };
}

/** The confirmation as extension/src/engine.js confirmInCloud makes it. `device` is the device's decision. */
/** The look step as the web page and the phone run it where there is no built-in model: the same prompt, in the cloud. */
export async function look(listing, t, image) {
  const { SYSTEM, SCHEMA, promptText } = await import('../shared/judge.mjs');
  const { cloudJson } = await import('./cloud-node.mjs');
  const photo = await photoPart(image);
  const parts = [promptText(listing, t.candidate, t.hints)];
  if (photo) parts.push(photo);
  // The lightest model first, as the phone does for the device's steps.
  return (await cloudJson({ system: SYSTEM, schema: SCHEMA, parts, models: ['gemini-3.5-flash-lite', 'gemini-4-hydrogen'], temperature: 0 })).answer;
}

export async function confirm(listing, device, hints, image, seen = null) {
  const wordsCard = device.kind === 'recall' && device.card ? device.card : null;
  const inHand = wordsCard || device.seen || null;
  const notice = inHand ? await fetchNotice(inHand.id).catch(() => null) : null;
  const [listingPhoto, recallPhoto] = await Promise.all([photoPart(image), notice && notice.images[0] ? imagePart(notice.images[0]).catch(() => null) : null]);
  const lookups = [], lookedUp = [];
  const onCall = async (_n, a) => {
    const found = lookupCards(index, a, { exclude: inHand ? inHand.id : '' });
    const notices = await Promise.all(found.map(c => fetchNotice(c.card.id).catch(() => null)));
    lookups.push({ asked: lookupArgs(a), found: found.map(c => c.card.id) });
    lookedUp.push(...found.map(c => c.card));
    return lookupResponse(found, notices);
  };
  const t0 = Date.now();
  const { answer, model } = await cloudJsonTool({ system: CONFIRM_SYSTEM_LOOKUP, schema: CONFIRM_SCHEMA_LOOKUP, parts: confirmParts({ listing, notice: wordsCard ? notice : null, listingPhoto, recallPhoto, seen: !wordsCard && device.seen && notice && seen ? { brand: seen.brand, id: device.seen.id, notice } : null }), tool: LOOKUP_TOOL, onCall });
  const final = decideFinal(device, answer, hints, lookedUp);
  return { final, answer, model, lookups, ms: Date.now() - t0, photo: !!listingPhoto };
}

if (opt('title')) {
  const listing = { title: opt('title'), description: opt('text'), price: '' };
  const t = triage(index, listing);
  const device = decide(wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe);
  console.log('words:', { candidate: t.candidate && `${t.candidate.card.id} ${t.candidate.strength}`, hints: t.hints.map(h => h.key), device: device.level, kind: device.kind });
  const r = await confirm(listing, { ...device, secondOpinion: true }, t.hints, opt('image'));
  if (args.includes('--brief')) { console.log(`BRIEF ${r.model} ${r.ms} ms | lookups ${JSON.stringify(r.lookups)} | ${r.answer.matches_recall}/${r.answer.banned_type} | final ${r.final.level}/${r.final.kind || '-'} ${r.final.card ? r.final.card.id : ''} | ${r.answer.evidence.slice(0, 150)}`); process.exit(0); }
  console.log(JSON.stringify({ model: r.model, ms: r.ms, photo: r.photo, lookups: r.lookups, answer: r.answer, final: { level: r.final.level, kind: r.final.kind, card: r.final.card && r.final.card.id, lookedUp: !!r.final.lookedUp, why: r.final.why } }, null, 1));
}

if (opt('set')) {
  const { BANNED_TYPES } = await import('../shared/banned.mjs');
  const set = opt('set');
  const read = f => JSON.parse(readFileSync(`tools/${f}`, 'utf8'));
  const listings = new Map(Object.values(read(`${set}-listings.json`)).flat().map(l => [String(l.id), l]));
  const labelFiles = { eval: ['eval-labels.json'], fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'], third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'], fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'] }[set];
  const labels = Object.assign({}, ...labelFiles.filter(f => existsSync(`tools/${f}`)).map(f => read(f).labels));
  const rows = read(`${set}-results-hybrid.json`).rows.filter(r => r.cloud).slice(0, Number(opt('limit', '999')));
  const out = [];
  const one = async row => {
    const listing = { ...(listings.get(String(row.id)) || {}), title: row.title, price: row.price };
    const t = triage(index, listing);
    // The device's decision as the saved run had it: its level is kept; what it pointed at comes from the words, or,
    // when only the photo raised it, from the saved type.
    let device = decide(wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe);
    if (row.device === 'ask') device = { level: 'none', kind: null, card: null, banned: null, askCloud: true, maybe: t.maybe[0] || null };
    else if (device.level === 'none') device = { level: 'possible', kind: 'banned', card: null, banned: BANNED_TYPES.find(b => b.key === row.banned) || BANNED_TYPES.find(b => b.key === 'in_bed_sleeper') };
    const rec = { id: row.id, title: row.title, label: (labels[row.id] || {}).should_warn || '?', saved: { final: row.final, kind: row.kind, recall: row.recall } };
    try {
      const r = await confirm(listing, device, t.hints, listing.image);
      // The same cloud answer with the lookup taken away: what the lookup alone changed.
      const without = decideFinal(device, { ...r.answer, recall_id: '' }, t.hints, []);
      Object.assign(rec, { model: r.model, ms: r.ms, photo: r.photo, lookups: r.lookups, recall_id: r.answer.recall_id, matches: r.answer.matches_recall, evidence: r.answer.evidence,
        withLookup: { level: r.final.level, kind: r.final.kind, card: r.final.card && r.final.card.id, lookedUp: !!r.final.lookedUp },
        without: { level: without.level, kind: without.kind, card: without.card && without.card.id } });
      console.log(`${rec.label.padEnd(5)} ${String(r.lookups.length ? 'asked ' + r.lookups.map(l => `${l.asked.brand}/${l.asked.product} -> ${l.found.join(',') || 'none'}`).join('; ') : 'no call').slice(0, 90).padEnd(90)} ${without.level}/${without.kind || '-'} -> ${r.final.level}/${r.final.kind || '-'}${r.final.lookedUp ? ' ' + r.final.card.id : ''}  ${row.title.slice(0, 50)}`);
    } catch (e) { rec.error = String(e).slice(0, 200); console.log('ERROR', rec.error.slice(0, 100), row.title.slice(0, 40)); }
    out.push(rec);
  };
  const queue = [...rows];
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await one(queue.shift()); }));
  const ok = out.filter(r => !r.error);
  const summary = { set, cloudChecked: out.length, errors: out.length - ok.length, calledLookup: ok.filter(r => r.lookups.length).length, deviceHadRecall: ok.filter(r => r.lookups.some(l => l.found.length)).length,
    changedByLookup: ok.filter(r => r.withLookup.lookedUp).length, medianMs: ok.map(r => r.ms).sort((a, b) => a - b)[ok.length >> 1] || 0 };
  writeFileSync(`tools/${set}-lookup.json`, JSON.stringify({ at: new Date().toISOString(), summary, rows: out }, null, 1));
  console.log(JSON.stringify(summary));
}
