# Still Recalled

A parent scrolling eBay sees a used elephant crib bedding set for $75. In the photo, folded among the sheets, are
padded bumper panels with ties. Selling those has been against federal law since 2022, because bumpers can suffocate
a baby. The title never says "bumper", so no keyword filter catches it, and nothing on the page warns the parent.

**Still Recalled puts the warning on the listing.** It is a Chrome extension for eBay, Mercari and Craigslist search
pages, an Android app that checks a listing or screenshot shared to it from any app (which is how it reaches Facebook Marketplace and OfferUp), and a web page
that checks a screenshot. **The cloud teaches the device once, the device screens every listing, and only what it
flags goes to the cloud:** Gemini in the cloud wrote a spotter card for every CPSC recall since 1973, the word rules and Gemini Nano
check each listing on your own computer or phone, and only what they flag, or can't settle from the words, goes to
Gemini in the cloud, through Firebase AI Logic hybrid inference. **And each can ask the other:** when the cloud
recognises a product the listing doesn't name, it calls a function that the device answers from its field guide; when
the device's model gives a brand for an unnamed product, the device looks it up and asks the cloud to check.

**Install:** [Chrome extension](https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-extension.zip)
(unzip, open `chrome://extensions`, turn on Developer mode, Load unpacked, choose the `still-recalled-extension` folder) ·
[Android app](https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-android.apk) (allow the
install, then share any listing's screenshot to it) · [web page](https://still-recalled.web.app) (no install).

**What it found on real listings.** In five blind tests on 775 used baby-gear listings from eBay, Mercari and
Craigslist, 83 were recalled products, padded crib bumpers, infant loungers or inclined sleepers, asking $6,063 in
total. Still Recalled flagged 65 of them ($5,022), with 12 false alarms among the 630 listings that were fine. Word
rules alone raised 109. 77% of the listings never left the computer (each test on the engine of its day). The fifth test is this version's
own: 178 new listings, labelled by AI reviewers who could not see the product: 7 of 9 caught, 1 false alarm among 149. It
knows every CPSC recall since 1973 and 392 CPSC safety warnings (the notices CPSC issues when a seller will not recall
a product), and fetches each new recall and warning from CPSC twice a day.

**And it keeps watching what you bought.** Recall notices reach the first owner, not the next one: Kids In Danger found
that only 22% of the children's products recalled in 2022 that it could analyze were ever returned, replaced or
repaired. Watch a listing and Still Recalled checks it against every new recall on your computer, and notifies you if
one matches.

**Try it in a minute** on the practice listings at https://still-recalled.web.app/try: seventeen made-up listings,
eight of them products the CPSC has recalled. With the extension installed, all eight get a badge and the nine ordinary
ones don't. The first is titled "Inclined baby sleeper, pink, folds flat", the way sellers often write it: it is
flagged as an inclined sleeper, and its card names the Rock 'n Play recall, through the cloud's question to the device. One, a Kidsview infant bouncer, was recalled on 2026-11-19, after this version's recall list was built: the
extension fetches it from CPSC on install.

## The problem

- **Some of these products have killed infants.** About 100 deaths were reported in Fisher-Price Rock 'n Play inclined
  sleepers alone (CPSC, 2023). CPSC counted 113 deaths that involved a crib bumper in the sleep setting (1990–2019).
- **Selling them is against federal law.** Inclined sleepers and padded crib bumpers have been banned from sale since
  November 2022, whatever their age. Selling a recalled product is unlawful too, for private sellers as well,
  unless the recall's fix has been applied.
- **They are still for sale secondhand.** In May–June 2026, Consumer Reports found these product types for sale on
  Facebook Marketplace, eBay, Mercari and Craigslist, with all four types on Facebook Marketplace. Its 2019
  investigation found that sellers use generic names ("baby sleeper/rocker", "bassinet"), which keyword filters miss.
- **Parents rely on secondhand gear.** About two in three U.S. parents bought kids' or baby items secondhand in the
  past year (Mercari Reuse Report, 2022).
- **Nothing warns the buyer.** The similar Chrome extensions check new-product pages on retail sites (Amazon, and in
  one case Walmart, Target and Best Buy), mostly when you click. None flags secondhand marketplace listings as you
  scroll, or banned sleep products.

Every figure is sourced in [docs/research/sources.md](docs/research/sources.md).

## What it does

**On a search page** (eBay, Mercari, Craigslist), a badge appears on each listing that needs a look:
- red **Recalled product**, or the product type, such as **Infant lounger or nest**, when it's likely;
- amber **Possible recall** when it's worth checking.

Clicking the badge opens a card that shows:
- the seller's photo beside the photo from the government recall notice;
- **where in the photo**: the cloud check outlines what it saw, such as the padded bumper folded among the bedding;
- **which units**: one sentence on how to tell a recalled unit from one that isn't (models, dates, where the label is);
- what to check before buying;
- **Ask the seller**: copies a question that asks for the one fact that settles it, usually the model number and
  date on the label, and opens eBay's message box for that seller (on other sites, the listing);
- **Report to CPSC**, on likely flags where a recall or the law rules the sale out: copies a ready report with the
  listing's link and opens the SaferProducts.gov form. CPSC asks shoppers who find a recalled product for sale online
  to report it there, and its e-commerce team has such listings taken down;
- **Settle it with the label**, on a possible recall: add a photo of the product's label (from the seller, or of the
  item in front of you). The built-in model reads the model number and date, and code compares them with the notice.

The side panel lists every flag on the page. The toolbar icon shows how many there are.

**New recalls and warnings, twice a day.** The extension asks the CPSC recall API for notices published since the
newest one it knows, and reads CPSC's file of safety warnings, which that API leaves out. Gemini, through Firebase AI
Logic, writes each new notice's field-guide entry (the same prompt that wrote the 10,089 before it; each install
writes its own), and from then on the laptop matches against it on its own. Pages already open are checked again.
(The web page and the Android app fetch new recalls; new warnings reach only the extension so far.)

**Watch for recalls.** On a listing's own page, the side panel offers **Watch for recalls**. When a new recall matches a
watched listing, Chrome shows a notification, and the bell at the top of the panel lists the recall, the hazard and
which units are affected. The watch list is kept on the computer and sent nowhere; a watched listing reaches the cloud
only if the built-in model flags it against a new recall.

**On the web page**, you add a screenshot of any listing, including Facebook Marketplace or OfferUp, or a photo of the
item, and get the same check. It works on phones.

It never says a product is safe. No match means no recall was found.

## How the hybrid AI works

```
every listing ── 1. word rules (instant, on the computer) ──────────────────────────────┐
                    recall shortlist by brand, line, model, years sold (every CPSC recall since 1973)
                    risky-type words; parts and toys dropped                             │
                                                                                         ▼
baby products ─── 2. Chrome's built-in model (Gemini Nano, on the computer) ── title + photo
                    is it the product, a part or a toy? does the photo look like a risky type?
                                                                                         ▼
flags only ────── 3. Gemini in the cloud, via Firebase AI Logic ── full recall notice + both photos
                    is this the recalled product? cannot tell? what should the buyer check?
```

- **Extension:** step 2 uses `InferenceMode.ONLY_ON_DEVICE`. A shopper's browsing is never sent to the cloud just to
  be screened. Step 3 gets the listings flagged on the computer, and the ones the words can't settle without a closer
  look at the photo: bedding sets that may hide a bumper, and "parts" whose words name a risky type. A crib bedding
  search therefore sends most of its page; a lounger search, few.
- **Web page:** steps 1 and 2 use `InferenceMode.PREFER_ON_DEVICE`. The same code runs on the built-in model in
  desktop Chrome and falls back to Gemini on phones. The page shows which one was used.
- **One engine:** both use the same engine, prompts and JSON schemas. Answers are structured JSON in both modes, so
  the on-device and cloud answers can be compared field by field.

**The cloud asks the device** ([shared/lookup.mjs](shared/lookup.mjs)). Sellers often leave the product's name out, so
the word rules find only a risky type, or nothing. The cloud model can often name the product from the photo, but the
field guide of every recall lives on the device. So the cloud's confirmation carries one function, `lookup_recalls`,
through Firebase AI Logic function calling (web SDK and Android SDK). The cloud names the brand and product; the call
comes back to the device; the same shortlist code that matches listings answers it, with the notices it found; and the
cloud judges the listing against them. A recall the cloud names counts only when it is one the device returned. And
because the listing's words never named the brand, no code checked it: such a recall is never a red "Recalled product"
on the cloud's word alone. It is named on a type flag that already stands, or shown as "Possible recall".
- On ten made-up listings with generic titles and each recall notice's own photo, checked one at a time as the web
  page and the Android app do, the word rules found the recall on none. With the function, the right recall was named on 6 of 10 and 7 of 10 in two passes; one more each pass named another notice (once an earlier notice for the same product, once a look-alike product, by the fallback model). 9 of 10 were flagged, against 6 without it, and none as a red recall on the cloud's word alone
  (`node tools/lookup-generic.mjs`, `tools/lookup-generic.json`).
- In the extension the function reaches the listings the device flags or can't settle. A generic title with no risky
  type words reaches the cloud only when Gemini Nano sees a risky type in the photo, or gives a brand for it (below).
- On the 140 real test listings that went to the cloud, the function was called on 12, the device had a recall for 2,
  and no listing changed between flagged and not flagged (`node tools/lookup-run.mjs --set=third`,
  `tools/*-lookup.json`).

**The device asks itself, and the cloud checks the answer** ([shared/lookup.mjs](shared/lookup.mjs), `deviceLookup`).
The model that looks at a listing also says which brand it can read in the photo. When the listing's words don't
already say it, the shortlist's code looks that brand up with the kind of product. Gemini Nano guesses here more than
it reads: on ten test photos it gave a brand three times and was wrong each time. So what the
lookup finds is never shown on the device's word: the listing goes to the cloud with the recall attached as "found by
the device, unverified", and it is shown, as "Possible recall" at most, only if the cloud answers with that recall's
number. If the cloud names another product, it calls `lookup_recalls` and that recall is shown instead. With the cloud
off, nothing from this lookup is shown.
- **The brand left out, real photos.** 23 real test listings whose words named a recalled product had those words
  stripped from the title by code; the sellers' own photos were kept. The word rules then find no recall. Checked one
  at a time, with Gemini's lightest cloud model doing the look (as on a phone without Gemini Nano), the two lookups
  named the right recall on 12 of 23 (7 through the device's own lookup, 5 of those one Bumbo recall; 5 through
  `lookup_recalls`), named no other recall, and none was a red recall (`node tools/masked-build.mjs`,
  `node tools/lookup-generic.mjs --masked`, `tools/lookup-masked.json`).
- In the extension with Gemini Nano: the first seven of those listings were run through the extension's own
  pipeline. The right recall was named on 3 of 7: Gemini Nano read "Graco" on two swings, and its wrong guess for a
  MamaRoo still sent that listing to the cloud, which named it. Across both small sets Gemini Nano's brand was right 2
  times of 6, against 9 of 9 for Gemini's lightest cloud model (`tools/lookup-nano.json`).

**Thorough mode.** The extension sends only what the device flags or can't settle. A setting, off by default, sends
every baby product on a page for the cloud's look, as the web page and the Android app do for the one listing they
check. Turned on with a page open, it checks that page again (an end-to-end step covers this). The fifth test shows what the choice is: with the default, a listing titled only "Baby Rocker" whose photo is a
Rock 'n Play never left the laptop and was missed; checked the other way, its card names the recall.
On that test's 178 listings: the extension's default caught 7 of 9 with 1 false alarm and sent 21% to the cloud;
checked one at a time, 9 of 9 with 3 soft false alarms, and 83% sent (`node tools/single-run.mjs --for=fifth`,
`tools/fifth-results-single.json`). One of those false alarms came through the lookup: an unbranded swing shown as a
possible MamaRoo.

**CPSC safety warnings** ([scripts/build-warnings.mjs](scripts/build-warnings.mjs)). When a seller will not recall a
hazardous product, CPSC warns the public itself. Those notices are not in the recall API: on 2026-11-20 CPSC's file
held 393 of them, 144 dated 2026. Each gets a spotter card the way a recall does, and its own wording on the card
("CPSC warning", not "Recalled product"). Adding them changed the word match of 1 of the 597 test listings, which the
cloud cleared (`node tools/warnings-check.mjs`).

**For the person who owns it** ([shared/present.mjs](shared/present.mjs), `ownerView`). On the web page and in the
Android app, choose **I own it**: the same check then speaks to someone about to sell an item, give it away, or use a
hand-me-down. A match says not to pass it on, that CPSC says it is illegal to sell a recalled product, and what the
recall offers its owner. The words on the card are the owner's: no "listing", no "before you buy"
(`node tools/web-owner.mjs`, `node tools/android-owner.mjs`; reports in `tools/`).

**While a page is checked,** a quiet pill on each listing says where its check is: "Looking on this computer" (Gemini
Nano), then "Checking in the cloud" for what the computer flagged.

Three more places the device and the cloud work together:
- **The cloud writes the device's field guide, once.** At build time, Gemini read all 10,089 CPSC recall notices since
  1973 and wrote a short spotter card for each ([data/spotter.jsonl](data/spotter.jsonl), by
  [scripts/build-spotter.mjs](scripts/build-spotter.mjs)): the brand a seller would type, the product line, the kind of
  product, the years sold, and how to tell a recalled unit. The cards ship with the extension (2.4 MB compressed), so
  the word rules and the built-in model use them on the shopper's computer with no cloud call. Matching stays in code.
- **The cloud shows where.** Its answer includes a box around what decided it, and the card outlines that part of the
  seller's photo.
- **The device can raise the alarm on a label, but not clear it.** The built-in model reads a label photo, and a match
  to a recalled model stands on that reading alone. A reading that would reassure the shopper is read again in the
  cloud first; with the cloud check off (the photo then stays on the computer), the card says "Read once, on this
  device: not ruled out". On 12 real label photos from CPSC notices, this read 8 recalled model numbers correctly and gave no
  wrong answer; the built-in model alone misread one ("615573" as "S16578") and would have said it wasn't recalled.

Where Firebase AI Logic is called:
- [extension/src/ai.js](extension/src/ai.js): `deviceModel`, `cloudJson`, `hybridModel` and `hybridJson`. The cloud side
  uses the `AgentPlatformBackend` (the Vertex AI Gemini API), billed per call, which answered 20 calls at once in a
  load test; the Gemini Developer API's free tier ran out at 3.
- [extension/src/engine.js](extension/src/engine.js): the pipeline above, shared by the extension and the web page.
- [web/src/app.js](web/src/app.js): reads a screenshot, then runs the engine.

**App Check** keeps the project's model quota for this app only. The web page uses reCAPTCHA Enterprise. Chrome
extensions have no attestation provider of their own, so the extension's hidden page frames
[appcheck-bridge.html](web/appcheck-bridge.html) on the site and asks it for tokens. That page answers only this
extension's ID, which the `key` in the manifest fixes, and only that extension may frame it. So anyone who installs
the extension, judges included, gets the cloud check with App Check still enforced.

## How well it works

Five tests, each on listings collected after the fixes the test before it led to, labelled blind by separate AI
reviewers from what a shopper sees: the title, the price and one photo. A person has not yet checked those labels.
Method, every miss and the limits are in [docs/accuracy.md](docs/accuracy.md).

| Same engine, run as | Caught (of 83) | False alarms (of 630) |
|---|---|---|
| Words only | 47 | 109 |
| Built-in model only | 51 | 64 |
| **Hybrid** | **65** | **12** |

| Test | Listings | Hybrid caught | Hybrid false alarms |
|---|---|---|---|
| First: eBay | 136 | 10 of 14 | 4 of 115 |
| Second, after fixes: eBay and Craigslist | 125 | 2 of 4 | 0 of 117 |
| Third, after fixes: eBay, Mercari and Craigslist | 176 | 28 of 34 | 6 of 133 |
| Fourth, with every recall since 1973: eBay and Craigslist | 160 | 18 of 22 | 1 of 116 |
| Fifth, on release 0.12.0: eBay and Craigslist | 178 | 7 of 9 | 1 of 149 |

- By kind: recall matches 7 of 9, infant loungers and nests 39 of 49, padded crib bumpers 19 of 24, inclined sleepers
  0 of 1.
- The fifth test's two misses are a listing titled only "Baby Rocker" whose photo shows a Rock 'n Play, and a lounger
  sold as a "baby pillow". Gemini Nano saw nothing in either photo. Both are flagged when checked one at a time, the
  way the web page and the phone check a listing.
- Loungers were the weak spot after two tests (4 of 10). The changes that followed raised that to 23 of 25 in the
  third test and 8 of 9 in the fourth, on listings collected after the changes.
- In the fourth test, two of the three recall catches were recalls older than the five years of data the first three
  tests used: a 1995 Graco swing and a Graco Swyngomatic, under Graco's 2000 swing recall.
- The cloud saw 23% of the listings across the five tests.
- **Run again on 0.11.0** (2026-11-20, with the warnings and the function): 67 of 74 caught, 13 false alarms, 28% sent
  to the cloud. Not a blind result: the first three sets were used to fix the engine. The newest set came out the same
  (18 of 22, no false alarms). Six of the 13 false alarms are UPPAbaby strollers, five of them titled "V2", flagged
  softly against the 2015 recall of the first version, and 31 listings changed between the two runs (19 for the
  better): Gemini Nano's answer is not the same on every run. `node tools/rerun-compare.mjs`, `docs/accuracy.md`
  section 18.
- **The first two sets again on 0.12.0** (261 listings; the other two could not be finished with Gemini Nano on the
  test computer that day): 14 of 18 caught, 3 false alarms, against 15 and 3 on 0.11.0. Not blind. The device's own
  lookup fired on 4 of the 261 and nothing was shown because of it. `node tools/run-compare.mjs --a=-rerun --b=-r5
  --sets=eval,fresh`, `docs/accuracy.md` section 19.

An end-to-end test loads the real extension into Chrome and runs it on a live search. It checks every hand-off, the
badges, the toolbar count, that a badge click stays on the page, and that the card offers the next step, and saves
its report to `tools/e2e-report-*.json`. On the practice listings, the packed release passes all 18 steps in a
new Chrome profile, which has no built-in model (words, then the cloud). With the built-in model, the development
build looked at all 8 flagged listings on the computer first (`docs/accuracy.md` sections 17 and 18). The on-device step was run end to end with
release 0.7.0 in a profile with Gemini Nano: all 12 steps of that version passed, Gemini Nano looked at the listings
inside the installed extension, the cloud confirmed the flags, and the settings came from Firebase Remote Config. In
that heavily automated profile reCAPTCHA later refused release tokens, so later on-device runs used the development
build. On live marketplaces (release 0.6.0, 2026-11-18) it passed on eBay and Craigslist; see `docs/accuracy.md`.

## Try it

**Practice listings:** https://still-recalled.web.app/try. Install the extension (below) and reload: eight of the
seventeen get a badge. The Baby Trend stroller's listing has the seller's label photo; add it to the card's label check.
Open any listing's own page and choose **Watch for recalls** in the side panel.

**Android app:** download [still-recalled-android.apk](https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-android.apk) (Android 8.0 or later), allow installs from your
browser, and open it. Tap "Try it with an example photo", or share a listing or a screenshot to Still Recalled from any
app. "Watch for recalls" on a result adds it to the watch list.

**Web page:** https://still-recalled.web.app. On a phone or computer, add a screenshot, or use "Try it with an example photo".

**Chrome extension**
1. Download `still-recalled-extension.zip` from the [latest release](https://github.com/usv240/still-recalled/releases/latest) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder.
3. Open the practice listings, or search eBay for `baby lounger` (Condition: Used). Badges appear as listings are checked, the ones on screen first. Click one, or click the
   toolbar icon for the side panel.

The on-device step needs Chrome 139 or later on a computer that can run Chrome's built-in model. Without it, the
extension uses the word rules and the cloud check.

## Android

`android/` is a native app (Kotlin, Jetpack Compose) with the same pipeline as the extension:

- **Firebase AI Logic for Android** (`firebase-ai` and `firebase-ai-ondevice`): `PREFER_ON_DEVICE` reads a shared
  screenshot and looks at the listing (Gemini Nano through AICore where the phone has it); `ONLY_IN_CLOUD` confirms
  against the full recall notice and writes field-guide entries for new recalls. All in `android/app/src/main/java/app/web/stillrecalled/ai/Ai.kt`.
- **The extension's rules, unchanged.** `android/engine/bridge.js` exposes the shared modules; `build.mjs` bundles them
  into the app's assets with the recall cards, and the app runs them in Jetpack's JavaScript sandbox (`engine/Rules.kt`).
- **App Check without Google Play** (`appcheck/BridgeAppCheck.kt`): tokens from the site's reCAPTCHA Enterprise
  bridge, loaded in a WebView the user never sees, through a WebMessageListener restricted to the site's origin.
- **Watch for recalls** in the background (`work/RecallWorker.kt`, WorkManager, twice a day) with notifications.
- **Firebase Remote Config** with the extension's template.

Build: `node build.mjs` (writes the engine and cards into `android/app/src/main/assets`), then in `android/`:
`./gradlew assembleRelease` (JDK 17+, Android SDK with platform 37.2). `android/local.properties` (gitignored) holds the
SDK path, the release signing key and, for development builds only, an App Check debug token. Test on an emulator or
phone with `node tools/android-e2e.mjs` (add `--watch` with a debug build to replay a recall arriving after a purchase).

**On a phone with Gemini Nano** (AICore; recent Pixel and Galaxy flagships): turn on USB debugging, plug the phone in,
open the app once and wait until its start screen says Gemini Nano is ready (the model downloads the first time), then
run `node tools/android-e2e.mjs --nano`. It fails unless the app reports the on-device model as available and the
example photo is read on the phone, and writes the phone, the model and each check's timing to
`tools/android-e2e-out/report-nano.json`.

## Build

```
npm install
npm run build        # extension/build, web/build
npm test             # unit tests
npm run e2e          # the real extension in a separate Chrome profile, on a live eBay search
node scripts/pack-extension.mjs    # release package in dist/ (no debug token, no developer pages)
node scripts/build-warnings.mjs    # CPSC safety warnings: spotter cards written in the cloud, merged after the recall cards
bash tools/rerun-all.sh -r5        # the first four accuracy tests again on the current engine, saved beside the first runs
node tools/run-compare.mjs --a=-rerun --b=-r5   # two such runs compared, and what the device's own lookup did
node tools/single-run.mjs --for=fifth           # a test set checked one listing at a time, as the web page does
node tools/masked-build.mjs        # real listings with the brand stripped from the title, for the two lookups
node tools/web-owner.mjs           # "I own it" on the web page, end to end (tools/web-owner-report.json)
node tools/nano-profile.mjs        # a separate Chrome test profile with the built-in model (Chrome downloads it, ~4 GB)
npm run e2e -- --profile=C:/tmp/sr-nano-profile    # the end-to-end test with the on-device step
node tools/eval-run.mjs --set=third --mode=hybrid  # an accuracy test run in that profile
node scripts/make-video.mjs        # the demo video, from footage recorded by scripts/record-demo.mjs and record-phone.mjs
```

`extension/src/firebase-config.js` holds the Firebase web config, which is public by design. For local development
with App Check enforced, put a debug token in `extension/src/appcheck-debug.local.js`; that file is gitignored and
the release build refuses to include it.

## Security

`extension/src/firebase-config.js` contains the project's Firebase web API key. GitHub's secret scanner flags it, but
it is not a secret. Every Firebase web app ships this key to its users, as Firebase documents in
[Learn about using and managing API keys for Firebase](https://firebase.google.com/docs/projects/api-keys). It
identifies the project; it doesn't grant access.

What protects the project's model quota:
- **The key is restricted to Firebase APIs only.** Called directly against the Gemini API, it gets 403 Permission
  denied.
- **App Check is enforced on Firebase AI Logic.** A call with the key but without a valid App Check token gets 401
  "Firebase App Check token is invalid" (tested 2026-11-15, and again on 2026-11-16 after the move to the
  Vertex AI Gemini API backend).
- **A budget alert** watches the project's cloud spend.
- **The App Check debug token used in development is gitignored.** The release build checks that it appears in no
  shipped file.

## Privacy

- Listings that the word rules and the built-in model clear stay on the computer.
- A flagged listing's title, description, price and photo are sent to Gemini through Firebase AI Logic, with the recall
  notice, for the double check. You can turn the cloud check off in the side panel's settings. A second setting, off
  by default, sends every baby product on a page for the cloud's look.
- No accounts and no tracking. Results are kept in the browser for 7 days.
- The full policy: [still-recalled.web.app/privacy.html](https://still-recalled.web.app/privacy.html).

## Data and credits

- **Recall data:** the U.S. Consumer Product Safety Commission recall API (saferproducts.gov), all 10,089 notices
  since 1973, and CPSC's product safety warnings file (392 warnings, read 2026-11-20; the extension reads it again
  twice a day). Still Recalled is not affiliated with CPSC.
- **Example photo:** `web/example/recall-26591.jpg` is from CPSC recall notice 26591 (VEVOR baby loungers). The example
  listing around it, `web/example/listing-26591.jpg` (`scripts/make-example.mjs`), is made up.
- **Font:** Geist, SIL Open Font License, © Vercel ([extension/fonts/Geist-LICENSE.txt](extension/fonts/Geist-LICENSE.txt)).
- **Origins:** Still Recalled was built during the #BuildHybridAI submission period, from November 14, 2026, and
  reuses no code. The idea comes from my earlier project, [SafeState](https://safestate.vercel.app). SafeState gives
  marketplaces a gate that blocks recalled units at the moment of resale, but only once a marketplace adopts it.
  Still Recalled works from the buyer's side, today, on listings no one has screened. It adds the infant sleep
  products that are dangerous even when no recall names them.

## License

Apache License 2.0. See [LICENSE](LICENSE).
