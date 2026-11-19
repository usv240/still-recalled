// The checking pipeline, run in the offscreen page so it works with the side panel closed.
//
//   1. words (instant, every listing)   shortlist a recall by brand, line or model number; spot banned-type words;
//                                       drop parts and toys; decide which listings need eyes
//   2. on-device model (photo + title)  only listings that could matter: a recall candidate, banned-type words, a
//                                       bedding set, or any infant product. Nothing leaves the device here.
//   3. cloud model                      only listings step 2 flagged, with the full recall notice and both photos
import { deviceStatus, deviceModel, imagePart, cloudJson, hybridJson, hasCloudAccess, liveSettings } from './ai.js';
import { LABEL_SYSTEM, LABEL_SCHEMA, judgeLabel, settleReadings } from '../../shared/label.mjs';
import { buildIndex, shortlist } from '../../shared/shortlist.mjs';
import { bannedHints, notTheProduct, mayContain } from '../../shared/banned.mjs';
import { SYSTEM, SCHEMA, promptText, decide } from '../../shared/judge.mjs';
import { fetchNotice } from '../../shared/notice.mjs';
import { CONFIRM_SYSTEM, CONFIRM_SCHEMA, confirmParts, decideFinal } from '../../shared/confirm.mjs';
import { present } from '../../shared/present.mjs';
import { liveCardsFromCpsc } from '../../shared/cards.mjs';
import { SPOTTER_SYSTEM, SPOTTER_SCHEMA, noticeText } from '../../shared/spotter.mjs';

// Infant products get a photo check even without a recall candidate: a lounger listed as "baby bed" has no telling words.
const INFANT = /\b(babys?|babies|infants?|newborns?|toddlers?|cribs?|cots?|bassinets?|cradles?|sleepers?|nests?|loungers?|swings?|bouncers?|rockers?|bumpers?|play\s*yards?|playards?|pack\s*'?n\s*'?play|nursery|co-?sleep\w*)\b/i;

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
export function useCards(url) { cardsUrl = () => url; indexPromise = null; basePromise = null; }
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
export async function refreshRecalls({ cloud = true, fetchImpl = fetch } = {}) {
  const base = await baseCards();
  const known = [...liveCards, ...base];
  const newest = known.reduce((m, c) => (c.date > m ? c.date : m), '1973-01-01');
  // A week of overlap: CPSC sometimes posts a notice with an earlier date than ones already out. The API answers a
  // URL it has seen with its earlier answer (on 2026-11-19 it left out that morning's four recalls), so each request
  // is a new URL.
  const end = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const res = await fetchImpl(`${CPSC_API}?format=json&RecallDateStart=${daysBefore(newest, 7)}&RecallDateEnd=${end}&_=${Date.now()}`, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (!res.ok) throw new Error(`recall API ${res.status}`);
  const ids = new Set(known.map(c => c.id));
  const records = (await res.json()).filter(r => r && r.RecallNumber && !ids.has(String(r.RecallNumber).trim()));
  const spots = new Map();
  const settings = await liveSettings();
  if (cloud && hasCloudAccess && settings.cloudCheck && settings.liveRecalls) {
    const todo = records.slice(0, LIVE_MAX);
    await Promise.all(Array.from({ length: Math.min(4, todo.length) }, async () => {
      while (todo.length) {
        const r = todo.shift();
        try {
          // The model that wrote the other 10,089 entries first, so new entries read like them.
          const { answer } = await cloudJson({ system: SPOTTER_SYSTEM, schema: SPOTTER_SCHEMA, parts: [noticeText(r)], models: [...new Set([FIELD_GUIDE_MODEL, ...settings.models])] });
          spots.set(String(r.RecallNumber).trim(), answer);
        } catch { /* this notice keeps the plain-code card */ }
      }
    }));
  }
  const cards = liveCardsFromCpsc(records, spots, known);
  liveCards = [...cards, ...liveCards];
  indexPromise = null;
  return { cards, found: records.length, written: spots.size, newest: cards[0] ? cards[0].date : newest };
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
const withTimeout = (promise, ms, what) => Promise.race([promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} did not answer within ${ms / 1000} s`)), ms))]);

/** Step 1, for one listing. `needsEyes` says whether the on-device model should look at it. */
export function triage(idx, listing) {
  const text = `${listing.title} ${listing.description || ''}`;
  const partOrToy = notTheProduct(listing.title);
  const candidate = partOrToy ? null : shortlist(idx, text)[0] || null;
  const hints = partOrToy ? [] : bannedHints(text);
  const maybe = partOrToy ? [] : mayContain(listing.title);
  const needsEyes = !partOrToy && (!!candidate || hints.length > 0 || maybe.length > 0 || INFANT.test(listing.title));
  return { partOrToy, candidate, hints, maybe, needsEyes };
}

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
export async function lookOnDevice(listing, { modelReady, cloud, imageUrl = u => u, judge: judgeOverride = null, secondOpinion = false }) {
  const idx = await index();
  const t = triage(idx, listing);
  if (!t.needsEyes) return { result: present(listing, { level: 'none', why: t.partOrToy ? 'part or toy' : 'no recall or risky type in the words' }, { words: true }) };

  let device, photo = null, usedDevice = false, deviceError = '', deviceUnit = '';
  if (modelReady) {
    photo = listing.image ? await imagePart(imageUrl(listing.image)).catch(() => null) : null;
    const parts = [promptText(listing, t.candidate, t.hints)];
    if (photo) parts.push(photo);
    try {
      // A stuck model session must not stall the whole page: give up on this listing's look and start a fresh
      // session for the next one.
      const r = await withTimeout((judgeOverride || judgeModel()).generateContent(parts), DEVICE_TIMEOUT_MS, 'the built-in model');
      const answer = JSON.parse(r.response.text());
      device = decide(answer, t.candidate, t.hints, t.maybe);
      // What the built-in model made of the card's "which units" line; recorded beside the cloud's answer.
      if (t.candidate && device.kind === 'recall') deviceUnit = answer.recalled_unit || '';
      usedDevice = (r.response.inferenceSource || 'on_device') === 'on_device';
    } catch (e) {
      if (!judgeOverride) judge = null;
      deviceError = String(e).slice(0, 160);
      device = decide({ what_is_for_sale: 'the_product', product_kind: '', same_kind_as_recalled: !!t.candidate, banned_type: 'none' }, t.candidate, t.hints, t.maybe);
    }
  } else {
    // No built-in model on this computer: the words alone decide what the cloud should look at.
    device = decide({ what_is_for_sale: 'the_product', product_kind: '', same_kind_as_recalled: !!t.candidate, banned_type: 'none' }, t.candidate, t.hints, t.maybe);
  }

  if (secondOpinion && !/part or a toy/.test(device.why || '')) device = { ...device, secondOpinion: true };
  const deviceLevel = device.level === 'none' && device.askCloud ? 'ask' : device.level;
  const how = { device: usedDevice, deviceLevel, deviceUnit, candidate: t.candidate ? `${t.candidate.card.id} ${t.candidate.strength}` : '', judgedInCloud: modelReady && !usedDevice && !deviceError, deviceError };
  const stage = { listing, hints: t.hints, device, photo, how, result: null };
  // Remote Config's cloud_check switch can turn the cloud step off for everyone; flags then stand, unconfirmed.
  const cloudOn = cloud && hasCloudAccess && (await liveSettings()).cloudCheck;
  if ((device.level === 'none' && !device.askCloud && !device.secondOpinion) || !cloudOn) {
    stage.result = present(listing, device.level === 'none' ? device : decideFinal(device, null, t.hints), how);
  }
  return stage;
}

/**
 * Settle a possible recall with a photo of the product's label (a JPEG data URL). `recall` is the result's recall
 * ({ codes, from, to }). Firebase AI Logic hybrid inference reads the label: the built-in model when this device has
 * it, so the photo stays on the device.
 *
 * The device can raise the alarm on its own, but not clear it. A "recalled" reading stands. Any other reading, which
 * would reassure the shopper, is read again by Gemini in the cloud first, and the cloud's reading decides. On 12 real
 * label photos from CPSC notices (2026-11-18), the built-in model misread one recalled model number (615573 as
 * S16578), which alone would have said "not among the listed models"; the cloud read it correctly.
 * Resolves to { reading, source: 'on_device' | 'in_cloud' | 'device_then_cloud', verdict }.
 */
export async function readLabel(dataUrl, recall) {
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('not a photo');
  const parts = ['Read the label in this photo.', { inlineData: { mimeType: m[1], data: m[2] } }];
  const inCloud = async () => (await cloudJson({ system: LABEL_SYSTEM, schema: LABEL_SCHEMA, parts })).answer;
  let reading, source;
  try {
    ({ answer: reading, source } = await hybridJson({ system: LABEL_SYSTEM, schema: LABEL_SCHEMA, parts }));
  } catch (e) {
    // The built-in model can fail on a photo it can't take; the cloud reads it instead, and the card says so.
    if (!hasCloudAccess) throw e;
    return { reading: await inCloud(), source: 'in_cloud', verdict: null };
  }
  const verdict = recall ? judgeLabel(reading, recall) : null;
  if (source !== 'on_device' || !recall || verdict.state === 'recalled' || !hasCloudAccess || !(await liveSettings()).cloudCheck) return { reading, source, verdict };
  const second = await inCloud().catch(() => null);
  if (!second) return { reading, source, verdict };
  return { reading: second, source: 'device_then_cloud', verdict: settleReadings(reading, second, recall) };
}

/** Step 3, for a stage lookOnDevice left open: the cloud reads the full recall notice and both photos. */
export async function confirmInCloud(stage, { imageUrl = u => u } = {}) {
  if (stage.result) return stage.result;
  const { listing, device, hints, how } = stage;
  try {
    const photo = stage.photo || (listing.image ? await imagePart(imageUrl(listing.image)).catch(() => null) : null);
    const notice = device.kind === 'recall' && device.card ? await fetchNotice(device.card.id) : null;
    const recallPhoto = notice && notice.images[0] ? await imagePart(imageUrl(notice.images[0])).catch(() => null) : null;
    const { answer, model } = await cloudJson({ system: CONFIRM_SYSTEM, schema: CONFIRM_SCHEMA, parts: confirmParts({ listing, notice, listingPhoto: photo, recallPhoto }) });
    return present(listing, decideFinal(device, answer, hints), { ...how, cloud: { model, answer } });
  } catch (e) {
    // The on-device flag stands, marked unconfirmed.
    return present(listing, device.level === 'none' ? device : decideFinal(device, null, hints), { ...how, cloudError: String(e).slice(0, 400) });
  }
}

// ---- Queue -------------------------------------------------------------------------------------------------------
// One listing at a time (the on-device model is one session). Listings that matched words go first, then the rest
// in page order. Jobs for a page the tab has left are dropped.
const queue = [];
let running = false;
// Cloud confirmations in flight at once, while the on-device model works through the queue. A bedding search sends
// most of its 60 to 70 listings to the cloud for a photo check (about 13 s each); 4 at once took over 4 minutes a page.
// The Vertex AI quota answered 20 at once in a load test.
// Remote Config's cloud_at_once replaces this once it arrives.
let CLOUD_AT_ONCE = 8;
if (hasCloudAccess) liveSettings().then(s => { CLOUD_AT_ONCE = s.cloudAtOnce; });
let cloudBusy = 0;
const cloudWaiting = [];
const cloudSlot = () => (cloudBusy < CLOUD_AT_ONCE ? (cloudBusy++, Promise.resolve()) : new Promise(r => cloudWaiting.push(r)));
const releaseCloudSlot = () => { const next = cloudWaiting.shift(); if (next) next(); else cloudBusy--; };
const livePage = new Map();   // tabId -> pageKey

// Offscreen pages cannot read chrome.storage, so the background sends the shopper's settings with each batch.
function enqueue(tabId, pageKey, listings, { cloud = true } = {}) {
  livePage.set(tabId, pageKey);
  listings.forEach((listing, i) => queue.push({ tabId, pageKey, listing, order: listing.order ?? i, cloud }));
  pump();
}

async function pump() {
  if (running) return;
  running = true;
  try {
    const idx = await index();
    while (queue.length) {
      // Re-rank each time: new pages arrive while old ones run.
      queue.sort((a, b) => rank(idx, a) - rank(idx, b) || a.order - b.order);
      const job = queue.shift();
      if (livePage.get(job.tabId) !== job.pageKey) continue;
      const status = await deviceStatus();
      const send = result => {
        result.order = job.order;
        chrome.runtime.sendMessage({ type: 'sr:engine-result', tabId: job.tabId, pageKey: job.pageKey, result }).catch(() => {});
      };
      const failed = e => send({ id: job.listing.id, listing: job.listing, level: 'error', kind: null, error: String(e).slice(0, 160) });
      let stage;
      try {
        stage = await lookOnDevice(job.listing, { modelReady: status === 'available', cloud: job.cloud });
      } catch (e) {
        failed(e);
        continue;
      }
      if (stage.result) { send(stage.result); continue; }
      // The built-in model is one session, so it works through listings one at a time; cloud checks run alongside it,
      // up to CLOUD_AT_ONCE. When all cloud slots are busy, the queue waits for one.
      await cloudSlot();
      confirmInCloud(stage).then(send, failed).finally(releaseCloudSlot);
    }
  } finally {
    running = false;
  }
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
  if (msg.type === 'sr:engine-forget') {
    livePage.delete(msg.tabId);
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
    readLabel(msg.dataUrl, msg.recall).then(reply, e => reply({ error: String(e).slice(0, 200) }));
    return true;
  }
  return false;
});
