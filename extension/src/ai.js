// All model calls go through Firebase AI Logic. This file is the only place the SDK is touched.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, getTemplateGenerativeModel, AgentPlatformBackend, InferenceMode } from 'firebase/ai';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { initializeAuth, indexedDBLocalPersistence, signInAnonymously } from 'firebase/auth/web-extension';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore/lite';
import { COLLECTION, ENTRY_VERSION, entryId, entryDoc } from '../../shared/fieldguide.mjs';
import { firebaseConfig, recaptchaSiteKey, appCheckBridgeUrl } from './firebase-config.js';

// Cloud models used to confirm or clear what the on-device model flagged, in order of preference.
// The next one is tried when a model is overloaded or out of quota.
export const CLOUD_MODELS = ['gemini-4-hydrogen', 'gemini-3.5-flash-lite'];
export const CLOUD_MODEL = CLOUD_MODELS[0];
// One cloud check in 58 timed out at 25 s in the third test, on both models; a check runs in the background.
const CLOUD_TIMEOUT_MS = 40000;

const app = initializeApp(firebaseConfig);

// App Check is enforced on AI Logic, so only this app can spend the project's model quota.
//   web page:           reCAPTCHA Enterprise
//   extension:          tokens from the site's bridge page (see bridgeToken below)
//   development builds: a debug token from src/appcheck-debug.local.js (gitignored; RELEASE=1 builds leave it out)
/* global __APPCHECK_DEBUG_TOKEN__ */
const debugToken = typeof __APPCHECK_DEBUG_TOKEN__ === 'string' ? __APPCHECK_DEBUG_TOKEN__ : '';
const hasDocument = typeof document !== 'undefined';
const inExtension = typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
if (debugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
const noProvider = new CustomProvider({ getToken: () => Promise.reject(new Error('No App Check attestation in this context')) });
// Auto-refresh is off. Every refresh is another reCAPTCHA score, and one refused score (403) makes the SDK stop asking
// for a day. Tokens last an hour and are renewed when a call needs one.
initializeAppCheck(app, {
  provider: debugToken ? noProvider
    : inExtension && hasDocument ? new CustomProvider({ getToken: bridgeToken })
    : hasDocument ? new ReCaptchaEnterpriseProvider(recaptchaSiteKey)
    : noProvider,
  isTokenAutoRefreshEnabled: false,
});

// The Agent Platform Gemini API (formerly Vertex AI), billed per call on the project's Cloud Billing account. Its
// quota answered 20 calls at once (tested 2026-11-16); the Gemini Developer API's free tier ran out at 3.
const ai = getAI(app, { backend: new AgentPlatformBackend('global') });
export const hasCloudAccess = !!debugToken || hasDocument;

// The shared field guide (shared/fieldguide.mjs): one entry per new CPSC notice in Cloud Firestore, written by the
// first device that sees the notice and read by every other. Firebase Authentication signs each device in
// anonymously (no account, no personal data), so the security rules can require a signed-in caller and record which
// anonymous id wrote an entry; App Check is enforced on Firestore as on AI Logic. firebase/auth/web-extension is the
// build of Auth with no remote code, which a Chrome extension needs; it works the same on the web page.
let userPromise = null;
const signedIn = () => (userPromise ||= (async () => {
  const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
  return auth.currentUser || (await signInAnonymously(auth)).user;
})().catch(e => { userPromise = null; throw e; }));
const db = getFirestore(app);

/** Shared entries for these notice numbers, as Map of number -> { spot, model }. Missing or unreadable ones are left out. */
export async function sharedEntries(ids) {
  const found = new Map();
  if (!hasCloudAccess || !ids.length) return found;
  try {
    await signedIn();
    await Promise.all(ids.map(async id => {
      if (!entryId(id)) return;
      const snap = await getDoc(doc(db, COLLECTION, entryId(id))).catch(() => null);
      const d = snap && snap.exists() ? snap.data() : null;
      if (d && d.v === ENTRY_VERSION && d.spot) found.set(id, { spot: d.spot, model: d.model || '' });
    }));
  } catch { /* no sign-in or no Firestore: every entry is written here, as before */ }
  return found;
}

/**
 * A field-guide entry from the server prompt template (Firebase AI Logic server prompt templates): the prompt and its
 * JSON schema live in Firebase, locked, and this device sends only the notice's text. Fixing the prompt is a new
 * template version named in Remote Config, with no new build; and no copy of the app can rewrite the prompt that
 * fills the shared field guide. Resolves to { answer, model }; throws when the template can't run, and the caller
 * writes the entry with the prompt built into this build instead.
 */
export async function templateJson(templateId, inputs) {
  const r = await getTemplateGenerativeModel(ai, { timeout: CLOUD_TIMEOUT_MS }).generateContent({ templateId, templateVariables: inputs });
  return { answer: JSON.parse(r.response.text()), model: `template ${templateId}` };
}

/** Stores an entry this device wrote, for every other device. The first entry for a notice stands; a later one is refused. */
export async function shareEntry(id, spot, model) {
  if (!hasCloudAccess || !entryId(id)) return false;
  try {
    const user = await signedIn();
    await setDoc(doc(db, COLLECTION, entryId(id)), { ...entryDoc(spot, { model, uid: user.uid }), at: serverTimestamp() });
    return true;
  } catch { return false; }
}

/**
 * Settings that can change without a new build, from Firebase Remote Config: which cloud models to use and in what
 * order, how many cloud checks run at once, and a switch that turns the cloud step off (the on-device flags then stand,
 * marked unconfirmed, and nothing leaves the computer), and whether the cloud writes field-guide entries for recalls
 * published after the build. A preview model can be retired, or a quota run out, while the
 * extension is already installed; this is how the fix reaches every copy within the hour. The values in this file are
 * the fallback when Remote Config cannot be reached.
 * Resolves to { models, cloudCheck, cloudAtOnce, liveRecalls, from: 'remote' | 'cached' | 'defaults' }.
 */
const DEFAULTS = { cloud_models: CLOUD_MODELS.join(','), cloud_check: true, cloud_at_once: 8, live_recalls: true, field_guide_template: 'field-guide-v1' };
let live = null;
let liveAt = 0;
// The hidden page can stay open for days, so the values are read again every 10 minutes. Remote Config itself goes to
// the network at most once an hour (minimumFetchIntervalMillis below), so a change reaches every copy in about an hour.
const LIVE_FOR = 10 * 60 * 1000;
export function liveSettings() {
  if (live && Date.now() - liveAt > LIVE_FOR) live = null;
  if (!live) liveAt = Date.now();
  return live ||= (async () => {
    const read = (rc, from) => {
      const models = (rc ? getValue(rc, 'cloud_models').asString() : DEFAULTS.cloud_models)
        .split(',').map(m => m.trim()).filter(m => /^gemini-[\w.-]+$/.test(m));
      const atOnce = rc ? getValue(rc, 'cloud_at_once').asNumber() : DEFAULTS.cloud_at_once;
      return {
        models: models.length ? models : CLOUD_MODELS,
        cloudCheck: rc ? getValue(rc, 'cloud_check').asBoolean() : true,
        cloudAtOnce: Math.max(1, Math.min(20, Math.round(atOnce) || DEFAULTS.cloud_at_once)),
        // Off: new recalls still arrive from CPSC, but the cloud does not write their field-guide entries.
        liveRecalls: rc ? getValue(rc, 'live_recalls').asBoolean() : true,
        // The server prompt template that writes field-guide entries (prompts/field-guide-v1.prompt); empty: the
        // prompt built into this build writes them.
        fieldGuideTemplate: ((rc ? getValue(rc, 'field_guide_template').asString() : DEFAULTS.field_guide_template).match(/^[a-z0-9-]{1,63}$/) || [''])[0],
        from,
      };
    };
    // Remote Config needs a page (IndexedDB and a window); the service worker never calls the models.
    if (!hasDocument || typeof indexedDB === 'undefined') return read(null, 'defaults');
    let rc = null;
    try {
      rc = getRemoteConfig(app);
      rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
      rc.settings.fetchTimeoutMillis = 5000;
      rc.defaultConfig = DEFAULTS;
      await fetchAndActivate(rc);
      return read(rc, 'remote');
    } catch {
      // Offline or refused: the last values fetched, or the defaults above.
      return read(rc, rc && rc.lastFetchStatus === 'success' ? 'cached' : 'defaults');
    }
  })();
}

/**
 * An App Check token for the extension, from appcheck-bridge.html on the site. That page runs reCAPTCHA Enterprise on
 * the site's own domain and answers postMessage requests only from this extension's origin. The frame is created on
 * the first cloud call and kept for the life of the (offscreen) page.
 */
let bridge = null;
let bridgeFrame = null;
const waiting = new Map();
let nextId = 0;

// When reCAPTCHA refuses a token (403), the App Check SDK in the bridge stops asking for a day. The bridge frame lives
// as long as the offscreen page, so one low score would turn the cloud check off for a day. Instead, a refused token
// replaces the frame, which starts with no back-off and gets a fresh reCAPTCHA score, and asks once more.
async function bridgeToken() {
  try {
    return await bridgeTokenOnce();
  } catch {
    resetBridge();
    return bridgeTokenOnce();
  }
}

function resetBridge() {
  if (bridgeFrame) bridgeFrame.remove();
  bridgeFrame = null;
  bridge = null;
}

function bridgeTokenOnce() {
  const origin = new URL(appCheckBridgeUrl).origin;
  if (!bridge) {
    bridge = new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      bridgeFrame = frame;
      frame.src = appCheckBridgeUrl;
      frame.title = 'App Check';
      frame.style.display = 'none';
      const timer = setTimeout(() => { bridge = null; frame.remove(); reject(new Error('App Check bridge did not load')); }, 20000);
      addEventListener('message', e => {
        if (e.origin !== origin || !e.data) return;
        if (e.data.type === 'sr-appcheck-ready' && e.source === frame.contentWindow) { clearTimeout(timer); resolve(frame); }
        if (e.data.type === 'sr-appcheck-token' && waiting.has(e.data.id)) {
          const w = waiting.get(e.data.id);
          waiting.delete(e.data.id);
          if (e.data.error) w.reject(new Error(e.data.error));
          else w.resolve({ token: e.data.token, expireTimeMillis: e.data.expireTimeMillis });
        }
      });
      document.body.append(frame);
    });
  }
  return bridge.then(frame => new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    frame.contentWindow.postMessage({ type: 'sr-appcheck-get', id }, origin);
    setTimeout(() => { if (waiting.delete(id)) reject(new Error('App Check bridge did not answer')); }, 20000);
  }));
}

const TEXT_AND_IMAGE = {
  expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

/**
 * A model that runs only on this device. `schema` is a JSON Schema the answer must follow.
 * Settings last for the life of the instance, so each prompt shape gets its own model.
 */
export function deviceModel({ system, schema }) {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        ...TEXT_AND_IMAGE,
        ...(system ? { initialPrompts: [{ role: 'system', content: [{ type: 'text', value: system }] }] } : {}),
      },
      ...(schema ? { promptOptions: { responseConstraint: schema } } : {}),
    },
  });
}

/**
 * A cloud Gemini model through Firebase AI Logic. With `schema`, the answer is JSON following that JSON Schema,
 * the same schema shape the on-device model takes, so the two answers can be compared field by field.
 */
export function cloudModel({ system, schema, model = CLOUD_MODEL, tools = null }) {
  // ONLY_IN_CLOUD on purpose: this step reads the full recall notice and two photos, a judgment the on-device model
  // was measured to get wrong (it said "one of the recalled units" 20 times where the cloud agreed once).
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model,
      ...(tools ? { tools } : {}),
      ...(system ? { systemInstruction: system } : {}),
      // Temperature 0, as on Android: the same listing should get the same answer.
      generationConfig: schema ? { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 } : { temperature: 0 },
    },
  }, { timeout: CLOUD_TIMEOUT_MS });
}

// Errors that mean "try the next model": busy or over quota, and a model that is no longer there (404). A retired
// preview model must not stop the check while Remote Config's list still names a working one.
const RETRYABLE = /\b(404|429|500|503|504)\b|NOT_FOUND|high demand|overloaded|RESOURCE_EXHAUSTED|UNAVAILABLE|timed? ?out|abort/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
// "Please retry in 12.3s" in a 429 answer; otherwise a growing wait.
const retryDelay = (e, attempt) => {
  const m = String(e).match(/retry in ([\d.]+)\s*s/i);
  return Math.min(30000, m ? Math.ceil(parseFloat(m[1]) * 1000) + 250 : 4000 * 2 ** attempt);
};

/**
 * One request with a function the cloud model may call (Firebase AI Logic function calling). `onCall(name, args)`
 * runs on this device and returns the function's response; the model then gives its JSON answer. At most two rounds
 * of calls: a model that keeps asking is told to answer.
 */
async function askWithTool(model, parts, onCall) {
  const chat = model.startChat();
  let r = await chat.sendMessage(parts);
  for (let round = 0; round < 3; round++) {
    const calls = (r.response.functionCalls && r.response.functionCalls()) || [];
    if (!calls.length) break;
    const answers = [];
    for (const c of calls.slice(0, 3)) {
      const response = round < 2 ? await onCall(c.name, c.args || {}) : { note: 'No more lookups. Answer now.' };
      answers.push({ functionResponse: { name: c.name, response } });
    }
    r = await chat.sendMessage(answers);
  }
  return r;
}

/**
 * One JSON answer from the cloud. Falls back through CLOUD_MODELS when a model is busy, and when every model is over
 * its per-minute quota, waits and tries again (twice). With `tool` (a function declaration) and `onCall`, the model
 * may call that function, which runs here, before it answers. Returns { answer, model }.
 */
export async function cloudJson({ system, schema, parts, models = null, retries = 2, tool = null, onCall = null }) {
  models ||= (await liveSettings()).models;
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const model of models) {
      try {
        let r = tool && onCall
          ? await askWithTool(cloudModel({ system, schema, model, tools: [{ functionDeclarations: [tool] }] }), parts, onCall)
          : await cloudModel({ system, schema, model }).generateContent(parts);
        // A model that keeps calling the function after being told to answer leaves no text: ask once more without it.
        if (tool && onCall && !/\{/.test(r.response.text() || '')) r = await cloudModel({ system, schema, model }).generateContent(parts);
        return { answer: JSON.parse(r.response.text()), model };
      } catch (e) {
        last = e;
        if (!RETRYABLE.test(String(e))) throw e;
      }
    }
    if (attempt < retries && /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(String(last))) await sleep(retryDelay(last, attempt));
    else break;
  }
  throw last;
}

/**
 * Firebase AI Logic hybrid inference: the browser's built-in model when this device has it, Gemini in the cloud
 * when it doesn't (phones, other browsers). Same prompt, same schema either way.
 */
export function hybridModel({ system, schema, model = CLOUD_MODEL, mode = InferenceMode.PREFER_ON_DEVICE }) {
  return getGenerativeModel(ai, {
    mode,
    onDeviceParams: {
      createOptions: {
        ...TEXT_AND_IMAGE,
        ...(system ? { initialPrompts: [{ role: 'system', content: [{ type: 'text', value: system }] }] } : {}),
      },
      ...(schema ? { promptOptions: { responseConstraint: schema } } : {}),
    },
    inCloudParams: {
      model,
      ...(system ? { systemInstruction: system } : {}),
      // Temperature 0 here too: on a phone or another browser this is the cloud path for every step.
      generationConfig: schema ? { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 } : { temperature: 0 },
    },
  }, { timeout: CLOUD_TIMEOUT_MS });
}

/** One JSON answer through hybrid inference. Returns { answer, source: 'on_device' | 'in_cloud', model }. */
export async function hybridJson({ system, schema, parts, models = null, mode = InferenceMode.PREFER_ON_DEVICE }) {
  models ||= (await liveSettings()).models;
  let last;
  for (const model of models) {
    try {
      const r = await hybridModel({ system, schema, model, mode }).generateContent(parts);
      const source = r.response.inferenceSource || 'in_cloud';
      return { answer: JSON.parse(r.response.text()), source, model: source === 'on_device' ? 'built-in' : model };
    } catch (e) {
      last = e;
      if (!RETRYABLE.test(String(e))) throw e;
    }
  }
  throw last;
}

/** Is the built-in model usable from the calling page? Returns the browser's own status word. */
export async function deviceStatus() {
  if (!('LanguageModel' in self)) return 'absent';
  try {
    return await self.LanguageModel.availability(TEXT_AND_IMAGE);
  } catch (e) {
    return 'error: ' + e.message;
  }
}

/** Fetch a listing photo and return it as a JPEG part the on-device model accepts (it takes JPEG and PNG only). */
export async function imagePart(url, maxSide = 512) {
  // A photo host that stops answering must not hold up the page: give up on the photo after 15 s.
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`photo: HTTP ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { inlineData: { data: btoa(binary), mimeType: 'image/jpeg' } };
}

export { InferenceMode };
