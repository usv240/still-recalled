// Firebase web app configuration for the "still-recalled" project.
// These values identify the project; they are not secrets. Access is controlled by App Check and security rules,
// not by hiding this object.
export const firebaseConfig = {
  apiKey: 'AIzaSyAlgjwPzQBVpZBaBfYSkHCd75dBw-5hx3U',
  authDomain: 'still-recalled.firebaseapp.com',
  projectId: 'still-recalled',
  storageBucket: 'still-recalled.firebasestorage.app',
  messagingSenderId: '638478968297',
  appId: '1:638478968297:web:44e0ee7781341128c79778',
};

export const hasRealConfig = firebaseConfig.projectId !== 'replace-me';

// App Check. Both values are public by design.
//   web page:   reCAPTCHA Enterprise with this site key (allowed domains: still-recalled.web.app, .firebaseapp.com, localhost)
//   extension:  Chrome extensions have no attestation provider of their own, so the extension asks a small page on
//               the site for tokens. That page answers only these extension IDs and can only be framed by them
//               (firebase.json headers): the unpacked release, whose ID the "key" in manifest.json fixes, and the
//               Chrome Web Store copy once it has an ID (the store assigns its own and rejects a "key").
export const recaptchaSiteKey = '6LfJ5CEuAAAAAI2GbDONzKXnpcjFJcTlAHGH5Vp6';
export const extensionIds = ['hpjnflbbhaokhgcoikhndmjapdiilkaa', 'dkjchdlmlagjpogknpgpiiedcopgaobm'];
export const extensionId = extensionIds[0];
export const appCheckBridgeUrl = 'https://still-recalled.web.app/appcheck-bridge.html';
