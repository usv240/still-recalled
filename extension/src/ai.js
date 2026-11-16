// All model calls go through Firebase AI Logic. This file is the only place the SDK is touched.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, AgentPlatformBackend, InferenceMode } from 'firebase/ai';
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
export function cloudModel({ system, schema, model = CLOUD_MODEL }) {
  return getGenerativeModel(ai, {
    model,
    ...(system ? { systemInstruction: system } : {}),
    generationConfig: schema ? { responseMimeType: 'application/json', responseJsonSchema: schema } : {},
  }, { timeout: CLOUD_TIMEOUT_MS });
}

const RETRYABLE = /\b(429|500|503|504)\b|high demand|overloaded|RESOURCE_EXHAUSTED|UNAVAILABLE|timed? ?out|abort/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
// "Please retry in 12.3s" in a 429 answer; otherwise a growing wait.
const retryDelay = (e, attempt) => {
  const m = String(e).match(/retry in ([\d.]+)\s*s/i);
  return Math.min(30000, m ? Math.ceil(parseFloat(m[1]) * 1000) + 250 : 4000 * 2 ** attempt);
};

/**
 * One JSON answer from the cloud. Falls back through CLOUD_MODELS when a model is busy, and when every model is over
 * its per-minute quota, waits and tries again (twice). Returns { answer, model }.
 */
export async function cloudJson({ system, schema, parts, models = CLOUD_MODELS, retries = 2 }) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const model of models) {
      try {
        const r = await cloudModel({ system, schema, model }).generateContent(parts);
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
export function hybridModel({ system, schema, model = CLOUD_MODEL }) {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
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
      generationConfig: schema ? { responseMimeType: 'application/json', responseJsonSchema: schema } : {},
    },
  }, { timeout: CLOUD_TIMEOUT_MS });
}

/** One JSON answer through hybrid inference. Returns { answer, source: 'on_device' | 'in_cloud', model }. */
export async function hybridJson({ system, schema, parts, models = CLOUD_MODELS }) {
  let last;
  for (const model of models) {
    try {
      const r = await hybridModel({ system, schema, model }).generateContent(parts);
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
