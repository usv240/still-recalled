// The checking pipeline, run in the offscreen page so it works with the side panel closed.
//
//   1. words (instant, every listing)   shortlist a recall by brand, line or model number; spot banned-type words;
//                                       drop parts and toys; decide which listings need eyes
//   2. on-device model (photo + title)  only listings that could matter: a recall candidate, banned-type words, a
//                                       bedding set, or any infant product. Nothing leaves the device here.
//   3. cloud model                      only listings step 2 flagged, with the full recall notice and both photos
import { deviceStatus, deviceModel, imagePart, cloudJson, hybridJson, hasCloudAccess, liveSettings, sharedEntries, shareEntry, templateJson, InferenceMode } from './ai.js';
import { LABEL_SYSTEM, LABEL_SCHEMA, judgeLabel, settleReadings, readOnce } from '../../shared/label.mjs';
import { buildIndex, shortlist } from '../../shared/shortlist.mjs';
import { triage, wordsOnlyAnswer } from '../../shared/triage.mjs';
import { SYSTEM, SCHEMA, promptText, decide } from '../../shared/judge.mjs';
import { fetchNotice, noticeFromCpsc, noticeFromCard } from '../../shared/notice.mjs';
import { CONFIRM_SYSTEM_LOOKUP, CONFIRM_SCHEMA_LOOKUP, confirmParts, decideFinal, capForStandIn } from '../../shared/confirm.mjs';
import { LOOKUP_TOOL, lookupArgs, lookupCards, lookupResponse, applyDeviceLookup } from '../../shared/lookup.mjs';
import { present } from '../../shared/present.mjs';
import { liveCardsFromCpsc } from '../../shared/cards.mjs';
import { SPOTTER_SYSTEM, SPOTTER_SCHEMA, noticeText } from '../../shared/spotter.mjs';
import { fitsNotice, validEntry } from '../../shared/fieldguide.mjs';
import { WARNINGS_CSV, warningRecords, warningNotice } from '../../shared/warnings.mjs';

let indexPromise = null, basePromise = null;
let cardsUrl = () => chrome.runtime.getURL('data/cards.json');
// Recalls CPSC published after this build, found by refreshRecalls and kept by the service worker.
let liveCards = [];
// Testing only (tools/e2e.mjs): leave out bundled recalls from this date on, as if the build were older, so a real
// recent notice arrives through the live path.
let hideFrom = '';
const baseCards = () => (basePromise ||= fetch(cardsUrl()).then(r => r.json()).then(d => d.cards))
  .then(cards => (hideFrom ? cards.filter(c => c.date < hideFrom) : cards));
const index = () => (indexPromise ||= baseCards().then(cards => buildIndex([...liveCards, ...cards])));
/** For pages that are not extension pages: the web page and the local accuracy test. */
export function useCards(url) { cardsUrl = () => url; indexPromise = null; basePromise = null; warningsPromise = null; }
// CPSC safety warnings (scripts/build-warnings.mjs) are not in the recall API, so their full text ships beside the cards.
let warningsPromise = null;
const warningTexts = () => (warningsPromise ||= fetch(cardsUrl().replace(/cards\.json$/, 'warnings.json')).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
/** The full notice the cloud check reads: from the CPSC recall API, or, for a warning, from the bundled file. */
async function noticeFor(id) {
  if (!/^W/.test(String(id))) return fetchNotice(id);
  // A warning published after the build carries its text on its card (newWarnings below).
  const fresh = liveCards.find(c => c.id === id && c.notice);
  const r = fresh ? fresh.notice : (await warningTexts())[id];
  if (!r) throw new Error(`warning ${id} not found`);
  return noticeFromCpsc(r);
}
/** Recalls published after the build, from the service worker's store. */
export function setLiveCards(cards, { hideFrom: hide = '' } = {}) { liveCards = cards || []; hideFrom = hide || ''; indexPromise = null; }

const CPSC_API = 'https://www.saferproducts.gov/RestWebServices/Recall';
const LIVE_MAX = 60;   // notices read by the cloud in one refresh; any beyond get cards from the plain-code rules
const FIELD_GUIDE_MODEL = 'gemini-3.5-flash-lite';   // the model scripts/build-spotter.mjs used
const daysBefore = (date, n) => new Date(Date.parse(date) - n * 864e5).toISOString().slice(0, 10);

/**
 * Live recalls. The bundled cards stop at the build; CPSC publishes new recalls every week. This asks the CPSC
 * recall API for notices since the newest one known, and has Gemini in the cloud write each new notice's field-guide
 * entry (the same prompt the build used for the 10,000 before it). From then on the device matches listings against
 * the new recall on its own. Without the cloud (switched off, or no App Check), a new notice still gets a card from
 * the plain-code rules: brand, model numbers and product name, without the field guide.
 * Resolves to { cards, found, written, newest }: `cards` are the new ones only.
 */
export async function refreshRecalls({ cloud = true, shared = cloud, fetchImpl = fetch } = {}) {
  const base = await baseCards();
  const known = [...liveCards, ...base];
  // Warnings come from another CPSC file at build time: they say nothing about how new the recall list is.
  const newest = known.filter(c => !c.warning).reduce((m, c) => (c.date > m ? c.date : m), '1973-01-01');
  // A week of overlap: CPSC sometimes posts a notice with an earlier date than ones already out. The API answers a
  // URL it has seen with its earlier answer (on 2026-11-19 it left out that morning's four recalls), so each request
  // is a new URL.
  const end = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const ids = new Set(known.map(c => c.id));
  // The recall API and the warnings file are two sources: one failing must not stop the other.
  let records = [], recallError = null;
  try {
    const res = await fetchImpl(`${CPSC_API}?format=json&RecallDateStart=${daysBefore(newest, 7)}&RecallDateEnd=${end}&_=${Date.now()}`, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
    if (!res.ok) throw new Error(`recall API ${res.status}`);
    records = (await res.json()).filter(r => r && r.RecallNumber && !ids.has(String(r.RecallNumber).trim()));
  } catch (e) { recallError = e; }
  const settings = await liveSettings();
  const cloudOn = cloud && hasCloudAccess && settings.cloudCheck && settings.liveRecalls;
  // `shared`: read the shared field guide even when this device writes no entries (the web page): entries other
  // devices wrote cost it no model call. A shopper who switched the cloud off gets neither: nothing is sent.
  const readShared = shared && hasCloudAccess && settings.cloudCheck;
  const spots = cloudOn || readShared ? await writeSpots(records, settings, { write: cloudOn }) : new Map();
  const cards = liveCardsFromCpsc(records, spots, known);
  // CPSC's safety warnings published since the build, from CPSC's warnings file. Without them, the recalls stand.
  let warned = { cards: [], found: 0, written: 0 }, warningsError = '';
  try { warned = await newWarnings(known, { cloudOn, readShared, settings, fetchImpl }); } catch (e) { warningsError = String(e).slice(0, 160); }
  // Nothing new from either source, and the recall API failed: the caller is told CPSC could not be reached.
  if (recallError && !warned.cards.length) throw recallError;
  liveCards = [...cards, ...warned.cards, ...liveCards];
  indexPromise = null;
  return { cards: [...cards, ...warned.cards], found: records.length + warned.found, written: (spots.written || 0) + warned.written, shared: (spots.shared || 0) + (warned.shared || 0), warnings: warned.cards.length, newest: cards[0] ? cards[0].date : newest,
    ...(recallError ? { recallError: String(recallError).slice(0, 160) } : {}), ...(warningsError ? { warningsError } : {}) };
}

/**
 * Each new notice's field-guide entry. The shared field guide first (shared/fieldguide.mjs): an entry another device
 * wrote is used when it fits the notice this device fetched itself. For the rest, Gemini in the cloud writes the entry,
 * and an entry that fits is shared for the devices after this one. Returns Map of notice number -> entry, with
 * `.shared` (entries read) and `.written` (entries Gemini wrote here) on the map.
 */
async function writeSpots(records, settings, { write = true } = {}) {
  const spots = new Map();
  const todo = records.slice(0, LIVE_MAX);
  const shared = await sharedEntries(todo.map(r => String(r.RecallNumber).trim()));
  let read = 0, written = 0;
  for (let i = todo.length - 1; i >= 0; i--) {
    const id = String(todo[i].RecallNumber).trim();
    const s = shared.get(id);
    if (s && !fitsNotice(s.spot, todo[i])) { spots.set(id, s.spot); read++; todo.splice(i, 1); }
  }
  if (!write) return Object.assign(spots, { shared: read, written: 0 });
  await Promise.all(Array.from({ length: Math.min(4, todo.length) }, async () => {
    while (todo.length) {
      const r = todo.shift();
      const id = String(r.RecallNumber).trim();
      try {
        // The server prompt template first; the prompt built into this build when it can't run. Either way the model
        // that wrote the other entries goes first, so new entries read like them.
        const viaTemplate = settings.fieldGuideTemplate ? await templateJson(settings.fieldGuideTemplate, { notice: noticeText(r) }).catch(() => null) : null;
        const { answer, model } = viaTemplate && validEntry(viaTemplate.answer) ? viaTemplate
          : await cloudJson({ system: SPOTTER_SYSTEM, schema: SPOTTER_SCHEMA, parts: [noticeText(r)], models: [...new Set([FIELD_GUIDE_MODEL, ...settings.models])] });
        spots.set(id, answer);
        written++;
        if (!fitsNotice(answer, r)) shareEntry(id, answer, model || FIELD_GUIDE_MODEL);
      } catch { /* this notice keeps the plain-code card */ }
    }
  }));
  return Object.assign(spots, { shared: read, written });
}

/**
 * Live warnings. CPSC's safety warnings (shared/warnings.mjs) are not in the recall API; CPSC publishes them as one
 * file, about three new ones a week in 2026. The extension reads that file with each refresh and gives every warning
 * newer than the bundled ones a card, the way a new recall gets one. Each card carries its warning's text, which the
 * cloud check reads in place of a recall notice. Only the extension can do this: CPSC's file has no CORS header, so a
 * web page cannot read it, and there the bundled warnings stand.
 */
async function newWarnings(known, { cloudOn, readShared, settings, fetchImpl }) {
  const none = { cards: [], found: 0, written: 0 };
  if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) return none;
  const have = known.filter(c => c.warning);
  if (!have.length) return none;
  const newest = have.reduce((m, c) => (c.date > m ? c.date : m), '');
  const res = await fetchImpl(`${WARNINGS_CSV}?_=${Date.now()}`, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (!res.ok) throw new Error(`warnings file ${res.status}`);
  const ids = new Set(known.map(c => c.id));
  // A week of overlap, as for recalls. Older warnings that never got a card (nothing to match on) are not retried.
  // Every new warning gets a card in this pass: the next pass starts from the newest one carded, so one left out now
  // would never be fetched. The cloud writes field-guide entries for the first LIVE_MAX; the rest get plain-code cards.
  const records = warningRecords(await res.text()).filter(r => r.RecallDate >= daysBefore(newest, 7) && !ids.has(r.RecallNumber));
  if (!records.length) return none;
  const spots = cloudOn || readShared ? await writeSpots(records, settings, { write: cloudOn }) : new Map();
  const byId = new Map(records.map(r => [r.RecallNumber, r]));
  const cards = liveCardsFromCpsc(records, spots, known).map(c => ({ ...c, warning: true, notice: warningNotice(byId.get(c.id)) }));
  return { cards, found: records.length, written: spots.written || 0, shared: spots.shared || 0 };
}

/**
 * Recall watch: listings the shopper saved, checked again when new recalls arrive. Only listings whose words could be
 * one of the new recalls go through the pipeline (device, then cloud), so a quiet week costs nothing.
 * Resolves to the results that flag one of `newIds`.
 */
export async function checkWatched(listings, newIds, { modelReady, cloud }) {
  const fresh = liveCards.filter(c => newIds.includes(c.id));
  if (!fresh.length || !listings.length) return [];
  const small = buildIndex(fresh);
  const hits = [];
  for (const listing of listings) {
    if (!shortlist(small, `${listing.title} ${listing.description || ''}`).length) continue;
    const result = await checkListing(listing, { modelReady, cloud }).catch(() => null);
    if (result && result.kind === 'recall' && (result.level === 'likely' || result.level === 'possible') && newIds.includes(result.recall.id)) hits.push(result);
  }
  return hits;
}
/** Step 1 alone, for a page that shows its progress. */
export async function triageListing(listing) { return triage(await index(), listing); }

let judge = null;
const judgeModel = () => (judge ||= deviceModel({ system: SYSTEM, schema: SCHEMA }));
const DEVICE_TIMEOUT_MS = 45000;
// The built-in model is one session: its looks run one after another, whoever asks.
let deviceChain = Promise.resolve();
const oneLookAtATime = fn => { const run = deviceChain.then(fn, fn); deviceChain = run.catch(() => {}); return run; };
const withTimeout = (promise, ms, what) => Promise.race([promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} did not answer within ${ms / 1000} s`)), ms))]);

export { triage };

/** The whole pipeline for one listing. Returns a presented result (plain data). */
export async function checkListing(listing, opts) {
  return confirmInCloud(await lookOnDevice(listing, opts), opts);
}

/**
 * Steps 1 and 2. Returns a stage: either finished (`stage.result`) or waiting for the cloud. Split from step 3 so the
 * queue can run the built-in model on the next listing while cloud checks are still out.
 * `judge` replaces the on-device-only model: the web page passes a hybrid one, which runs on the device when it can.
 * `secondOpinion` (web page only): every baby product goes to the cloud, which may raise a soft flag on its own.
 */
export async function lookOnDevice(listing, { modelReady, cloud, imageUrl = u => u, judge: judgeOverride = null, secondOpinion = false, wordsFirst = false, onLook = null }) {
  const idx = await index();
  const t = triage(idx, listing);
  if (!t.needsEyes) return { result: present(listing, { level: 'none', why: t.partOrToy ? 'part or toy' : 'no recall or risky type in the words' }, { words: true }) };
  // Remote Config's cloud_check switch can turn the cloud step off for everyone; flags then stand, unconfirmed.
  const cloudOn = cloud && hasCloudAccess && (await liveSettings()).cloudCheck;

  // `wordsFirst` (the extension's queue): a listing whose words name a risky type, and no recall, goes to the cloud
  // check whatever the built-in model would say, and with the cloud's answer the result is the same either way
  // (confirm.decideFinal trusts the words for the type). So it skips the model's look and its cloud check starts at
  // once, while the model, one listing at a time, looks at the listings where its answer decides something. With the
  // cloud off, the model looks at these too, and when the cloud check then fails, the model looks after all
  // (confirmInCloud). The cloud can name an unnamed product itself (lookup_recalls), so the device's own lookup is
  // not needed for these. Measured before this: 17 listings took 183 s with the built-in model against 30 to 81 s
  // without it.
  const skipLook = wordsFirst && cloudOn && modelReady && t.hints.length > 0 && !t.candidate;

  let device, photo = null, usedDevice = false, deviceError = '', deviceUnit = '', seen = null, lookedInCloud = false;
  if (modelReady && !skipLook) {
    if (onLook) onLook();
    photo = listing.image ? await imagePart(imageUrl(listing.image)).catch(() => null) : null;
    const parts = [promptText(listing, t.candidate, t.hints)];
    if (photo) parts.push(photo);
    const settle = answer => {
      device = decide(answer, t.candidate, t.hints, t.maybe);
      // What the built-in model made of the card's "which units" line; recorded beside the cloud's answer.
      if (t.candidate && device.kind === 'recall') deviceUnit = answer.recalled_unit || '';
      // The device asks its own field guide: a brand the model read in the photo that the listing's words don't say.
      ({ device, seen } = applyDeviceLookup(idx, listing, answer, t.candidate, device));
    };
    try {
      // A stuck model session must not stall the whole page: give up on this listing's look and start a fresh
      // session for the next one.
      const r = await oneLookAtATime(() => withTimeout((judgeOverride || judgeModel()).generateContent(parts), DEVICE_TIMEOUT_MS, 'the built-in model'));
      settle(JSON.parse(r.response.text()));
      usedDevice = (r.response.inferenceSource || 'on_device') === 'on_device';
    } catch (e) {
      if (!judgeOverride) judge = null;
      deviceError = String(e).slice(0, 160);
      device = null;
      // On the web page the look is hybrid: when the built-in model fails on a photo, Gemini in the cloud looks
      // instead, as the Android app does. The extension keeps the look on the computer.
      if (judgeOverride && cloudOn) {
        try {
          settle((await cloudJson({ system: SYSTEM, schema: SCHEMA, parts })).answer);
          lookedInCloud = true;
        } catch { device = null; }
      }
      device ||= decide(wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe);
    }
  } else {
    // No built-in model on this computer: the words alone decide what the cloud should look at.
    device = decide(wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe);
  }

  if (secondOpinion && !/part or a toy/.test(device.why || '')) device = { ...device, secondOpinion: true };
  const deviceLevel = device.level === 'none' && device.askCloud ? 'ask' : device.level;
  const how = { device: usedDevice, deviceLevel, deviceUnit, candidate: t.candidate ? `${t.candidate.card.id} ${t.candidate.strength}` : '', judgedInCloud: lookedInCloud || (modelReady && !skipLook && !usedDevice && !deviceError), deviceError, ...(seen ? { seen } : {}) };
  const stage = { listing, hints: t.hints, device, photo, how, result: null, skippedLook: skipLook };
  if ((device.level === 'none' && !device.askCloud && !device.secondOpinion) || !cloudOn) {
    stage.result = present(listing, device.level === 'none' ? device : decideFinal(device, null, t.hints), how);
  }
  return stage;
}

/**
 * Settle a possible recall with a photo of the product's label (a JPEG data URL). `recall` is the result's recall
 * ({ codes, from, to }). Firebase AI Logic hybrid inference reads the label, cloud first (PREFER_IN_CLOUD): on 12
 * real label photos from CPSC notices (2026-11-18), the built-in model misread one recalled model number (615573 as
 * S16578), which alone would have said "not among the listed models"; the cloud read it correctly. And a reassuring
 * reading went to the cloud anyway. When the cloud can't be reached (no signal), the SDK hands the photo to the
 * built-in model, and with the cloud switched off only the built-in model reads it.
 *
 * The device can raise the alarm on its own, but not clear it. A "recalled" reading stands. Any other reading, which
 * would reassure the shopper, is read again by Gemini in the cloud first, and the cloud's reading decides.
 * Resolves to { reading, source: 'on_device' | 'in_cloud' | 'device_then_cloud', verdict }.
 */
export async function readLabel(dataUrl, recall, { cloud = true } = {}) {
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('not a photo');
  const parts = ['Read the label in this photo.', { inlineData: { mimeType: m[1], data: m[2] } }];
  const inCloud = async () => (await cloudJson({ system: LABEL_SYSTEM, schema: LABEL_SCHEMA, parts })).answer;
  // The cloud is off when the shopper switched it off, or Remote Config did: the photo then stays on the device.
  const cloudOn = cloud && hasCloudAccess && (await liveSettings()).cloudCheck;
  let reading, source;
  try {
    if (cloudOn) ({ answer: reading, source } = await hybridJson({ system: LABEL_SYSTEM, schema: LABEL_SCHEMA, parts, mode: InferenceMode.PREFER_IN_CLOUD }));
    else {
      const r = await deviceModel({ system: LABEL_SYSTEM, schema: LABEL_SCHEMA }).generateContent(parts);
      reading = JSON.parse(r.response.text());
      source = 'on_device';
    }
  } catch (e) {
    // The built-in model can fail on a photo it can't take; the cloud reads it instead, and the card says so.
    if (!cloudOn) throw e;
    return { reading: await inCloud(), source: 'in_cloud', verdict: null };
  }
  const verdict = recall ? judgeLabel(reading, recall) : null;
  if (source !== 'on_device' || !recall || verdict.state === 'recalled') return { reading, source, verdict };
  // Anything that would reassure needs a second reading. Without one, it is not ruled out (readOnce).
  const second = cloudOn ? await inCloud().catch(() => null) : null;
  if (!second) return { reading, source, verdict: readOnce(verdict) };
  return { reading: second, source: 'device_then_cloud', verdict: settleReadings(reading, second, recall) };
}

/**
 * Step 3, for a stage lookOnDevice left open: the cloud reads the full recall notice and both photos. The call
 * carries one function, lookup_recalls (shared/lookup.mjs): when the cloud can name a product the listing's words
 * did not, it asks this device's field guide for that product's recall, and the shortlist's code answers.
 */
export async function confirmInCloud(stage, { imageUrl = u => u } = {}) {
  if (stage.result) return stage.result;
  const { listing, device, hints, how } = stage;
  try {
    const photo = stage.photo || (listing.image ? await imagePart(imageUrl(listing.image)).catch(() => null) : null);
    // The recall the cloud compares the listing with: the one the words matched, or the one the device's own lookup
    // found from a brand read in the photo (device.seen).
    const wordsCard = device.kind === 'recall' && device.card ? device.card : null;
    const inHand = wordsCard || device.seen || null;
    // When the CPSC recall API does not answer, the check goes on with the short record on the device's own card.
    const notice = inHand ? await noticeFor(inHand.id).catch(() => noticeFromCard(inHand)) : null;
    const recallPhoto = notice && notice.images[0] ? await imagePart(imageUrl(notice.images[0])).catch(() => null) : null;
    const lookups = [], lookedUp = [];
    // Each notice's remedy in full, for the card: the recall card keeps only its first 140 characters.
    const remedies = notice && notice.remedy ? { [inHand.id]: notice.remedy } : {};
    const onCall = async (_name, args) => {
      const found = lookupCards(await index(), args, { exclude: wordsCard ? wordsCard.id : '' });
      const notices = await Promise.all(found.map(c => noticeFor(c.card.id).catch(() => null)));
      lookups.push({ asked: lookupArgs(args), found: found.map(c => c.card.id) });
      lookedUp.push(...found.map(c => c.card));
      found.forEach((c, i) => { if (notices[i] && notices[i].remedy) remedies[c.card.id] = notices[i].remedy; });
      // (lookupResponse writes a candidate without a notice from its card's own lines.)
      return lookupResponse(found, notices);
    };
    const { answer, model } = await cloudJson({ system: CONFIRM_SYSTEM_LOOKUP, schema: CONFIRM_SCHEMA_LOOKUP, parts: confirmParts({ listing, notice: wordsCard ? notice : null, listingPhoto: photo, recallPhoto, seen: !wordsCard && device.seen && notice && how.seen ? { brand: how.seen.brand, id: device.seen.id, notice } : null }), tool: LOOKUP_TOOL, onCall });
    let decision = decideFinal(device, answer, hints, lookedUp);
    if (notice && notice.fromCard) decision = capForStandIn(decision);
    return present(listing, decision, { ...how, cloud: { model, answer }, remedies, ...(lookups.length ? { lookups } : {}) });
  } catch (e) {
    const cloudError = String(e).slice(0, 400);
    // The cloud check failed. A listing that skipped the built-in model's look because the cloud was going to check
    // it gets that look now, so it ends as it would with the cloud off, not as words alone.
    if (stage.skippedLook) {
      const again = await lookOnDevice(listing, { modelReady: true, cloud: false, imageUrl }).catch(() => null);
      if (again && again.result) return { ...again.result, how: { ...again.result.how, cloudError } };
    }
    // The on-device flag stands, marked unconfirmed.
    return present(listing, device.level === 'none' ? device : decideFinal(device, null, hints), { ...how, cloudError });
  }
}

// ---- Queue -------------------------------------------------------------------------------------------------------
// One listing at a time (the on-device model is one session). Listings the words settle go first (they take no time),
// then the ones on the shopper's screen, then words-matched ones before the rest, in page order. Jobs for a page the
// tab has left are dropped.
const queue = [];
const onScreen = new Map();   // tabId -> Set of listing ids on screen now (content.js reportOnScreen)
let running = false;
// Cloud confirmations in flight at once, while the on-device model works through the queue. A bedding search sends
// most of its 60 to 70 listings to the cloud for a photo check (about 13 s each); 4 at once took over 4 minutes a page.
// The Vertex AI quota answered 20 at once in a load test.
// Remote Config's cloud_at_once replaces this once it arrives.
let CLOUD_AT_ONCE = 8;
if (hasCloudAccess) liveSettings().then(s => { CLOUD_AT_ONCE = s.cloudAtOnce; });
let cloudBusy = 0;
const cloudWaiting = [];
let queueIndex = null;   // the card index, for ranking waiting cloud checks (set by pump)
const cloudSlot = job => (cloudBusy < CLOUD_AT_ONCE ? (cloudBusy++, Promise.resolve()) : new Promise(resolve => cloudWaiting.push({ resolve, job })));
// A freed slot goes to the waiting listing the shopper is most likely looking at: on screen now, then page order.
// Ranked when the slot frees, not when the listing joined, so scrolling moves a listing up.
function releaseCloudSlot() {
  if (!cloudWaiting.length) { cloudBusy--; return; }
  let best = 0;
  for (let i = 1; i < cloudWaiting.length; i++) {
    const a = cloudWaiting[i].job, b = cloudWaiting[best].job;
    const gone = j => (livePage.get(j.tabId) === j.pageKey ? 0 : 1);   // a page the tab has left only needs its slot back
    if ((gone(b) - gone(a) || (queueIndex ? priority(queueIndex, a) - priority(queueIndex, b) : 0) || a.order - b.order) < 0) best = i;
  }
  cloudWaiting.splice(best, 1)[0].resolve();
}
const livePage = new Map();   // tabId -> pageKey

// Offscreen pages cannot read chrome.storage, so the background sends the shopper's settings with each batch.
function enqueue(tabId, pageKey, listings, { cloud = true, thorough = false } = {}) {
  livePage.set(tabId, pageKey);
  // `thorough` (a setting, off by default): every baby product gets the cloud's look, as on the web page.
  const again = new Set(listings.map(l => l.id));
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].tabId === tabId && again.has(queue[i].listing.id)) queue.splice(i, 1);
  listings.forEach((listing, i) => queue.push({ tabId, pageKey, listing, order: listing.order ?? i, cloud, thorough: !!thorough && cloud }));
  pump();
}

async function pump() {
  if (running) return;
  running = true;
  try {
    const idx = await index();
    queueIndex = idx;
    if (hasCloudAccess) CLOUD_AT_ONCE = (await liveSettings()).cloudAtOnce;
    while (queue.length) {
      // Re-rank each time: new pages arrive while old ones run.
      queue.sort((a, b) => priority(idx, a) - priority(idx, b) || a.order - b.order);
      const job = queue.shift();
      if (livePage.get(job.tabId) !== job.pageKey) continue;
      const status = await deviceStatus();
      const send = result => {
        result.order = job.order;
        if (job.thorough) result.thorough = true;
        chrome.runtime.sendMessage({ type: 'sr:engine-result', tabId: job.tabId, pageKey: job.pageKey, result }).catch(() => {});
      };
      const failed = e => send({ id: job.listing.id, listing: job.listing, level: 'error', kind: null, error: String(e).slice(0, 160) });
      // Where this listing's check is, for the pill on the page: the built-in model, then the cloud.
      const stageIs = s => chrome.runtime.sendMessage({ type: 'sr:engine-stage', tabId: job.tabId, id: job.listing.id, stage: s }).catch(() => {});
      let stage;
      try {
        stage = await lookOnDevice(job.listing, { modelReady: status === 'available', cloud: job.cloud, wordsFirst: true, secondOpinion: job.thorough, onLook: () => stageIs('device') });
      } catch (e) {
        failed(e);
        continue;
      }
      if (stage.result) { send(stage.result); continue; }
      // The built-in model is one session, so it works through listings one at a time; cloud checks run alongside it,
      // up to CLOUD_AT_ONCE. When all cloud slots are busy, the queue waits for one.
      // The queue does not wait for a free slot: the built-in model keeps looking at the next listing meanwhile.
      stageIs('cloud');
      cloudSlot(job).then(() => (livePage.get(job.tabId) === job.pageKey ? confirmInCloud(stage).then(send, failed) : null)).finally(releaseCloudSlot);
    }
  } finally {
    running = false;
  }
}

function priority(idx, job) {
  const r = rank(idx, job);
  if (r === 0) return 0;
  const seen = onScreen.get(job.tabId);
  return (seen && seen.has(job.listing.id) ? 0 : 2) + r;
}

const rankCache = new WeakMap();
function rank(idx, job) {
  if (!rankCache.has(job)) {
    const t = triage(idx, job.listing);
    rankCache.set(job, !t.needsEyes ? 0 : (t.candidate || t.hints.length || t.maybe.length) ? 1 : 2);
  }
  return rankCache.get(job);
}

if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || typeof msg.type !== 'string') return false;
  if (msg.type === 'sr:engine-check') {
    enqueue(msg.tabId, msg.pageKey, msg.listings, msg.settings);
    reply({ queued: queue.length });
    return false;
  }
  if (msg.type === 'sr:engine-on-screen') {
    onScreen.set(msg.tabId, new Set(msg.ids || []));
    return false;
  }
  if (msg.type === 'sr:engine-forget') {
    livePage.delete(msg.tabId);
    onScreen.delete(msg.tabId);
    return false;
  }
  if (msg.type === 'sr:engine-status') {
    Promise.all([deviceStatus(), liveSettings()]).then(([model, settings]) => reply({ model, cloudAccess: hasCloudAccess, settings, queued: queue.length, running }));
    return true;
  }
  if (msg.type === 'sr:engine-live') {
    setLiveCards(msg.cards, msg);
    reply({ ok: true, count: liveCards.length });
    return false;
  }
  if (msg.type === 'sr:engine-refresh') {
    refreshRecalls(msg.settings || {}).then(reply, e => reply({ error: String(e).slice(0, 200) }));
    return true;
  }
  if (msg.type === 'sr:engine-watch') {
    deviceStatus().then(model => checkWatched(msg.listings, msg.newIds, { modelReady: model === 'available', cloud: (msg.settings || {}).cloud !== false }))
      .then(hits => reply({ hits }), e => reply({ error: String(e).slice(0, 200) }));
    return true;
  }
  if (msg.type === 'sr:engine-label') {
    readLabel(msg.dataUrl, msg.recall, { cloud: msg.cloud !== false }).then(reply, e => reply({ error: String(e).slice(0, 200) }));
    return true;
  }
  return false;
});
