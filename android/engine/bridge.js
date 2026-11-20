// The Android app's rules engine: the same shared modules the extension and the web page run (shared/*.mjs), bundled
// by build.mjs into android/app/src/main/assets/engine.js and run in Jetpack's JavaScript sandbox
// (androidx.javascriptengine). Kotlin makes every model call through Firebase AI Logic; everything that decides runs
// here, so the phone and the extension cannot drift apart.
//
// Every function takes plain JSON values and returns a JSON string (the sandbox passes strings).
import { buildIndex, shortlist } from '../../shared/shortlist.mjs';
import { triage, wordsOnlyAnswer, INFANT } from '../../shared/triage.mjs';
import { SYSTEM, SCHEMA, promptText, decide } from '../../shared/judge.mjs';
import { noticeFromCpsc } from '../../shared/notice.mjs';
import { CONFIRM_SYSTEM_LOOKUP, CONFIRM_SCHEMA_LOOKUP, confirmParts, decideFinal } from '../../shared/confirm.mjs';
import { LOOKUP_TOOL, lookupArgs, lookupCards, lookupResponse } from '../../shared/lookup.mjs';
import { present, productName, ownerView } from '../../shared/present.mjs';
import { READ_SYSTEM, READ_SCHEMA, listingFromRead, listingFromText } from '../../shared/read.mjs';
import { LABEL_SYSTEM, LABEL_SCHEMA, judgeLabel, settleReadings, labelCopy, readOnce } from '../../shared/label.mjs';
import { liveCardsFromCpsc } from '../../shared/cards.mjs';
import { SPOTTER_SYSTEM, SPOTTER_SCHEMA, noticeText } from '../../shared/spotter.mjs';

const out = v => JSON.stringify(v === undefined ? null : v);
let base = [];
let live = [];
let idx = null;
const index = () => (idx ||= buildIndex([...live, ...base]));

const PHOTO = { listing: '\u0000LISTING_PHOTO', recall: '\u0000RECALL_PHOTO' };

globalThis.SR = {
  /** Cards arrive in chunks (the sandbox caps one evaluation's size). */
  addCards(cards) { base.push(...cards); idx = null; return out(base.length); },
  setLive(cards) { live = cards || []; idx = null; return out(live.length); },
  counts() { return out({ base: base.length, live: live.length }); },

  prompts() {
    return out({
      read: { system: READ_SYSTEM, schema: READ_SCHEMA },
      judge: { system: SYSTEM, schema: SCHEMA },
      // The confirmation carries one function the cloud may call, answered on the phone (shared/lookup.mjs).
      confirm: { system: CONFIRM_SYSTEM_LOOKUP, schema: CONFIRM_SCHEMA_LOOKUP, tool: LOOKUP_TOOL },
      label: { system: LABEL_SYSTEM, schema: LABEL_SCHEMA },
      spotter: { system: SPOTTER_SYSTEM, schema: SPOTTER_SCHEMA },
    });
  },

  listingFromRead(answer, image) { return out(listingFromRead(answer, image)); },
  listingFromText(text) { return out(listingFromText(text)); },

  /** Step 1. Adds `words`, a one-line summary for the progress view. */
  triage(listing) {
    const t = triage(index(), listing);
    const words = t.partOrToy ? 'Looks like a part or a toy version'
      : t.candidate ? `Possible match: ${productName(t.candidate.card.product)}`
      : t.hints.length ? `Wording points to ${(t.hints[0].label || 'a risky sleep product').toLowerCase()}`
      : 'No recall names this brand and product';
    return out({ ...t, words });
  },

  /** The finished result for a listing no model needs to look at. */
  wordsOnly(listing, t) {
    return out(present(listing, { level: 'none', why: t.partOrToy ? 'part or toy' : 'no recall or risky type in the words' }, { words: true }));
  },

  judgeText(listing, t) { return out(promptText(listing, t.candidate, t.hints)); },

  /**
   * Step 2's answer (null when no model answered) as the device's decision, as engine.js lookOnDevice makes it.
   * `secondOpinion`: every baby product goes to the cloud, which may raise a soft flag on its own (the web page and
   * the phone do this; a search page of 60 listings does not).
   */
  afterLook(answer, t, { secondOpinion = false } = {}) {
    let device = decide(answer || wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe);
    if (secondOpinion && !/part or a toy/.test(device.why || '')) device = { ...device, secondOpinion: true };
    const needsCloud = !(device.level === 'none' && !device.askCloud && !device.secondOpinion);
    const deviceLevel = device.level === 'none' && device.askCloud ? 'ask' : device.level;
    const recallId = device.kind === 'recall' && device.card ? device.card.id : '';
    return out({ device, needsCloud, deviceLevel, recallId, recallImage: '' });
  },

  /**
   * Step 3's prompt, as text parts in order. A photo goes where a part is "\u0000LISTING_PHOTO" or
   * "\u0000RECALL_PHOTO". `noticeRecord` is the raw CPSC API record, or null.
   */
  confirmParts(listing, noticeRecord, hasListingPhoto, hasRecallPhoto) {
    const notice = noticeRecord ? noticeFromCpsc(noticeRecord) : null;
    const parts = confirmParts({ listing, notice, listingPhoto: hasListingPhoto ? PHOTO.listing : null, recallPhoto: notice && hasRecallPhoto ? PHOTO.recall : null });
    return out(parts);
  },
  noticeImage(noticeRecord) { const n = noticeFromCpsc(noticeRecord); return out(n.images[0] || ''); },

  /**
   * The cloud asks the device: its lookup_recalls call, answered by the shortlist's code on the phone. Returns
   * { asked, ids, cards, strengths }; `exclude` is the recall the confirmation already has.
   */
  lookup(args, exclude) {
    const found = lookupCards(index(), args, { exclude: exclude || '' });
    return out({ asked: lookupArgs(args), ids: found.map(c => c.card.id), cards: found.map(c => c.card), strengths: found.map(c => c.strength) });
  },
  /** The function's response for the cloud. `noticeRecords`: the raw CPSC record for each id, or null, in order. */
  lookupResponse(found, noticeRecords) {
    const candidates = (found.cards || []).map((card, i) => ({ card, strength: (found.strengths || [])[i] || 'brand' }));
    return out(lookupResponse(candidates, (noticeRecords || []).map(r => (r ? noticeFromCpsc(r) : null))));
  },

  /**
   * The presented result. `cloud` is the cloud's answer, or null when the cloud did not run. `lookedUp`: the cards
   * the phone returned to the cloud's lookups.
   */
  finish(listing, device, cloud, hints, how, lookedUp) {
    const decision = cloud ? decideFinal(device, cloud, hints, lookedUp || []) : device.level === 'none' ? device : decideFinal(device, null, hints);
    return out(present(listing, decision, how));
  },

  /** The same result, said to someone who owns the item: { action, heading, lines }. */
  ownerView(result) { return out(ownerView(result)); },

  judgeLabel(reading, recall) { return out(judgeLabel(reading, recall)); },
  settleReadings(device, cloud, recall) { return out(settleReadings(device, cloud, recall)); },
  labelCopy(verdict) { return out(labelCopy(verdict)); },
  /** A reading by the phone alone, with no second reading in the cloud: it never rules a recall out. */
  readOnce(verdict) { return out(readOnce(verdict)); },

  // ---- Live recalls and the watch ---------------------------------------------------------------------------------
  // Warnings come from another CPSC file at build time: they say nothing about how new the recall list is.
  newest() { return out([...live, ...base].filter(c => !c.warning).reduce((m, c) => (c.date > m ? c.date : m), '1973-01-01')); },
  /** The records of an API answer that are not known yet. */
  unknown(records) {
    const ids = new Set([...live, ...base].map(c => c.id));
    return out((records || []).filter(r => r && r.RecallNumber && !ids.has(String(r.RecallNumber).trim())));
  },
  noticeText(record) { return out(noticeText(record)); },
  liveCards(records, spots) { return out(liveCardsFromCpsc(records, new Map(Object.entries(spots || {})), [...live, ...base])); },
  /** Watched listings whose words could be one of the new recalls: { listingId: recallId }. */
  watchHits(listings, newIds) {
    const fresh = live.filter(c => newIds.includes(c.id));
    if (!fresh.length) return out({});
    const small = buildIndex(fresh);
    const hits = {};
    for (const l of listings) {
      const s = shortlist(small, `${l.title} ${l.description || ''}`)[0];
      if (s) hits[l.id] = s.card.id;
    }
    return out(hits);
  },
  /** Recent recalls of baby products, for the home screen. */
  recentInfant(n) {
    return out([...live, ...base].filter(c => INFANT.test(`${c.product} ${c.title}`) && /^https:/.test(c.image || ''))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)
      .map(c => ({ id: c.id, date: c.date, product: productName(c.product), image: c.image, url: c.url, hazard: c.hazard, live: !!c.live })));
  },
};
