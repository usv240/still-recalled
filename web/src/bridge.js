// appcheck-bridge.html: App Check tokens for the Still Recalled extension.
// Chrome extensions have no attestation provider of their own. This page runs reCAPTCHA Enterprise on the site's own
// domain and hands the resulting App Check token to the extension, which frames it from its offscreen page.
// It answers only messages from the extension's origin, and firebase.json lets only that origin frame it.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'firebase/app-check';
import { firebaseConfig, recaptchaSiteKey, extensionIds } from '../../extension/src/firebase-config.js';

const EXTENSIONS = extensionIds.map(id => `chrome-extension://${id}`);
const app = initializeApp(firebaseConfig);
// Auto-refresh off: each refresh is another reCAPTCHA score, and one refused score stops App Check for a day. The
// extension replaces this frame when a token is refused (see extension/src/ai.js).
const appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey), isTokenAutoRefreshEnabled: false });

// The token's own expiry, read from its payload, so the extension's SDK refreshes it on time.
const expiry = token => {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch { return Date.now() + 30 * 60 * 1000; }
};

addEventListener('message', async e => {
  if (!EXTENSIONS.includes(e.origin) || !e.data || e.data.type !== 'sr-appcheck-get') return;
  try {
    const { token } = await getToken(appCheck, false);
    e.source.postMessage({ type: 'sr-appcheck-token', id: e.data.id, token, expireTimeMillis: expiry(token) }, e.origin);
  } catch (err) {
    e.source.postMessage({ type: 'sr-appcheck-token', id: e.data.id, error: String(err && err.message || err).slice(0, 200) }, e.origin);
  }
});

// Delivered only if the parent is one of the extensions (a message to any other origin is dropped).
if (parent !== window) for (const origin of EXTENSIONS) parent.postMessage({ type: 'sr-appcheck-ready' }, origin);
