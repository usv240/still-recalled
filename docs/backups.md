# What happens when a service is down

Still Recalled leans on several services. Each one has at least one backup, and most have two, from a different
provider where that is possible. The last line of defence is always the same: the field guide of every CPSC recall
since 1973 lives on the device, so a check never needs the network to find a named recall. When a backup is in use,
the app can only lose reassurance, never invent it: no path says a product is safe.

| Service | What it does | First backup | Then |
|---|---|---|---|
| Gemini in the cloud (Firebase AI Logic, Agent Platform, `global`) | confirms or clears what the device flagged; reads labels; names an unnamed product | the next model: `gemini-4-hydrogen`, then `gemini-3.5-flash-lite`, then `gemini-3.5-flash` (busy, out of quota or retired); waits and tries again on a quota error | the device's own answer stands, marked unconfirmed. The model list is in Remote Config, so a new one reaches every copy within the hour, with no release |
| Gemini Nano on the device | looks at each listing first, on the device | Gemini in the cloud, through Firebase AI Logic hybrid inference (web page, Android) | the listing's words alone (plain code), then the cloud check |
| Server prompt template `field-guide-v1` (locked in Firebase) | writes the field-guide entry for each new recall | the same prompt built into the app | a card from plain code: brand, model numbers, product name |
| Cloud Firestore and Firebase Authentication | the shared field guide: an entry written once, read by every device | this device writes its own entry (template, then built-in prompt) | the plain-code card |
| Firebase Remote Config | model list, switches, yard-sale settings | the last values fetched | the values built into the app |
| Firebase App Check | lets only the real app spend the model quota | none needed: without a token nothing is sent | the device and the words keep working, offline |
| CPSC recall API (`www.saferproducts.gov`) | new recalls since the build; a notice's full text | the recall mirror through jsDelivr (`tools/recall-mirror.mjs`, `.github/workflows/recall-mirror.yml`, daily, the last 180 days, unchanged) | the same mirror through `raw.githubusercontent.com`; then the 10,089 notices built into the app, and for one notice, a stand-in from its card |
| CPSC warnings file (`www.cpsc.gov`) | safety warnings since the build | the recall API is a separate source; one failing does not stop the other | the warnings built into the app |
| Gemini Live (yard-sale mode, Android) | the camera and microphone, with lookups the phone answers | the next location: `us-central1`, then `us-east4`, then `us-east5` (each tested 2026-11-24; `europe-west4` also works and can be added in Remote Config) | the screenshot or photo check, one listing at a time. When the server says a session is ending, the next one opens with the camera still on |
| Firebase Hosting (the site) | the web page, the extension's App Check page | `still-recalled.web.app` and `still-recalled.firebaseapp.com` serve the same site (checked 2026-11-24); the cloud step works at the second address only if the reCAPTCHA key lists it | the extension and the Android app check on their own without it |
| GitHub Releases | the Android app and the extension downloads | the same files on the site (from 0.14.0) | |
| GitHub (the code) | the source | git bundles of every branch on a second local drive, verified (`git bundle verify`) | |

## Kept off GitHub on purpose

The Android release key (`android/release.jks`) and its settings (`android/local.properties`) are never committed.
A copy sits on a second local drive beside the git bundles. A copy away from this computer (a password manager or a
USB drive) is the owner's to make: without the key, no update to the Android app can be installed over the old one.

## How each backup was checked

- Cloud models: one short call to each model at each location (2026-11-24). The two newest models answer only at
  `global`; `gemini-3.5-flash` answered there too and is now the third model.
- Recall mirror: `node tools/recall-mirror.mjs <folder>` against CPSC (273 recalls in 180 days, 828 KB); unit tests
  (`tests/mirror.test.mjs`) cover the first CDN failing, both failing, and a notice read from the mirror.
- Gemini Live: a session opened and closed at each location with no content sent.
