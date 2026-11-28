# How Still Recalled works, in detail

The [README](../README.md) has the short version. This page has every step, with the file each one lives in.

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

- **Extension:** step 2 uses `InferenceMode.ONLY_ON_DEVICE`. Listings that aren't baby products are never sent to
  the cloud. Step 3 gets the listings flagged on the computer, and the ones the words can't settle without a closer
  look at the photo: bedding sets that may hide a bumper, "parts" whose words name a risky type, and infant sleep
  products that name no known brand, even when the computer cleared them. A crib bedding
  search therefore sends most of its page; a lounger search, few.
- **Web page:** steps 1 and 2 use `InferenceMode.PREFER_ON_DEVICE`. The same code runs on the built-in model in
  desktop Chrome and falls back to Gemini on phones. The page shows which one was used.
- **One engine:** both use the same engine, prompts and JSON schemas. Answers are structured JSON in both modes, so
  the on-device and cloud answers can be compared field by field.

**The cloud asks the device** ([shared/lookup.mjs](../shared/lookup.mjs)). Sellers often leave the product's name out, so
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

**The device asks itself, and the cloud checks the answer** ([shared/lookup.mjs](../shared/lookup.mjs), `deviceLookup`).
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
- **A second, fresh set of 34** (2026-11-25, nine recalls; `docs/accuracy.md`, section 33): the cloud named the
  product from the photo and asked the device on 33, the device's field guide answered with the right recall on 28,
  and the card showed it on 13, always as amber. The other 14 the device answered were later versions of a recalled
  line (a City Mini GT2, a "2024 version" swing) that the cloud judged outside the notice. One listing was shown a
  notice that does not cover it, as amber. None was red; without the lookups, none of the 34 is flagged.
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

**CPSC safety warnings** ([scripts/build-warnings.mjs](../scripts/build-warnings.mjs)). When a seller will not recall a
hazardous product, CPSC warns the public itself. Those notices are not in the recall API: on 2026-11-20 CPSC's file
held 393 of them, 144 dated 2026. Each gets a spotter card the way a recall does, and its own wording on the card
("CPSC warning", not "Recalled product"). Adding them changed the word match of 1 of the 597 test listings, which the
cloud cleared (`node tools/warnings-check.mjs`).

**For the person who owns it** ([shared/present.mjs](../shared/present.mjs), `ownerView`). On the web page and in the
Android app, choose **I own it**: the same check then speaks to someone about to sell an item, give it away, or use a
hand-me-down. A match says not to pass it on, that CPSC says it is illegal to sell a recalled product, and what the
recall offers its owner. The words on the card are the owner's: no "listing", no "before you buy"
(`node tools/web-owner.mjs`, `node tools/android-owner.mjs`; reports in `tools/`).

**While a page is checked,** a quiet pill on each listing says where its check is: "Looking on this computer" (Gemini
Nano), then "Checking in the cloud" for what the computer flagged.

Three more places the device and the cloud work together:
- **The cloud writes the device's field guide, once.** At build time, Gemini read all 10,089 CPSC recall notices since
  1973 and wrote a short spotter card for each ([data/spotter.jsonl](../data/spotter.jsonl), by
  [scripts/build-spotter.mjs](../scripts/build-spotter.mjs)): the brand a seller would type, the product line, the kind of
  product, the years sold, and how to tell a recalled unit. The cards ship with the extension (2.4 MB compressed), so
  the word rules and the built-in model use them on the shopper's computer with no cloud call. Matching stays in code.
- **The cloud shows where.** Its answer includes a box around what decided it, and the card outlines that part of the
  seller's photo.
- **Labels are read in the cloud first; the device can raise the alarm, but not clear it.** Firebase AI Logic hybrid
  inference with `PREFER_IN_CLOUD`: a label photo goes to Gemini in the cloud, and to Gemini Nano on the device only
  when the cloud can't be reached or the cloud check is off. A device reading can warn on its own; a reading that
  would reassure says "Read once, on this device: not ruled out". On 12 real label photos from CPSC notices, Gemini Nano
  alone misread one recalled model number ("615573" as "S16578") and would have said it wasn't recalled, which is why
  the cloud reads first.

Where Firebase AI Logic is called:
- [extension/src/ai.js](../extension/src/ai.js): `deviceModel`, `cloudJson`, `hybridModel` and `hybridJson`. The cloud side
  uses the `AgentPlatformBackend` (the Vertex AI Gemini API), billed per call, which answered 20 calls at once in a
  load test; the Gemini Developer API's free tier ran out at 3.
- [extension/src/engine.js](../extension/src/engine.js): the pipeline above, shared by the extension and the web page.
- [web/src/app.js](../web/src/app.js): reads a screenshot, then runs the engine.

**App Check** keeps the project's model quota for this app only. The web page uses reCAPTCHA Enterprise. Chrome
extensions have no attestation provider of their own, so the extension's hidden page frames
[appcheck-bridge.html](../web/appcheck-bridge.html) on the site and asks it for tokens. That page answers only this
extension's ID, which the `key` in the manifest fixes, and only that extension may frame it. So anyone who installs
the extension, judges included, gets the cloud check with App Check still enforced.

**The shared field guide: Cloud Firestore, Firebase Authentication, a server prompt template.** CPSC publishes new
recalls every week, after the build. Each needs a field-guide entry, and Gemini in the cloud writes it. Without
sharing, every phone and extension would pay for the same entry again.
- **The first device to see a new notice writes the entry** through a locked server prompt template
  ([prompts/field-guide-v1.prompt](../prompts/field-guide-v1.prompt)). The prompt lives in Firebase, so no copy of the app
  can change what fills the shared guide, and Remote Config names the template version.
- **It stores the entry in Firestore** under the notice's number ([shared/fieldguide.mjs](../shared/fieldguide.mjs),
  [FieldGuide.kt](../android/app/src/main/java/app/web/stillrecalled/data/FieldGuide.kt)). Every other device reads it
  instead of calling Gemini. The web page, which writes no entries, reads them too.
- **Firebase Authentication signs each device in anonymously**: no account and no personal data. The security rules
  ([firestore.rules](firestore.rules)) then allow an entry to be written once, by a signed-in caller, in the field
  guide's exact shape. No overwrite, no delete, no listing.
- **App Check is enforced on Firestore** as on AI Logic. The rules are tested on the Firestore emulator
  (`npm run test:rules`, 7 tests).
- **A shared entry is never trusted as it is.** Each device checks it against the notice it fetched from CPSC itself:
  every brand, product line and model number must appear in the notice (`fitsNotice`). An entry only puts a recall on
  the shortlist; the cloud still reads the official notice before anything is flagged.
- **A shopper who switched the cloud off sends nothing**, Firestore included.
- **Labels are read cloud first** (`PREFER_IN_CLOUD`). A photo of a label goes to Gemini in the cloud first, because
  small model numbers are what Gemini Nano was measured to misread. With no signal, the SDK hands it to Gemini Nano on
  the device; that reading can warn but never reassure.

**Yard-sale mode: Gemini Live, with the phone answering (Android).** At a yard sale or a thrift store, the shopper
points the camera at the table. Gemini Live (Firebase AI Logic's Live API) watches and listens. For each baby product
it can name, it calls `lookup_recalls`, and the phone answers from its own field guide and the banned-type rules
([shared/live.mjs](../shared/live.mjs), [YardSaleScreen.kt](../android/app/src/main/java/app/web/stillrecalled/ui/YardSaleScreen.kt)).
So the phone, not the model, decides which recalls exist, and the screen shows only what the lookup returned. A
session lasts at most a few minutes (Remote Config), and it never says a product is safe. Run on a Pixel with typed
words in place of the camera: the session opened 1.2 s after App Check, the phone answered the lookup 1.8 s later
(two Rock 'n Play recalls and the banned inclined-sleeper type), and Gemini spoke at 6.9 s. The web page has no
yard-sale mode: Firebase's web SDK sends no App Check token on a Live connection, so App Check refuses it.

**For families, clinics and shops (0.16.0).** A printable one-page card for WIC offices, crib programs and
grandparents, in English and Spanish, with a QR code to the check ([web/card.html](../web/card.html)). Results, the web
page and the card read in Spanish (an AI translation, labelled as one). The web page saves every check on the device:
reopen it when the seller's label photo arrives, or keep it as a resale shop's intake log, with several photos at
once, a batch name, CSV and print.

**Every service has a backup.** Three cloud models in turn, three Live locations, a daily mirror of CPSC's recall API
on two CDNs, the shared field guide falling back to the device's own entry, Remote Config falling back to built-in
values, and under all of it the field guide on the device. The table is in [docs/backups.md](backups.md).

## How well it works

Five tests, each on listings collected after the fixes the test before it led to, labelled blind by separate AI
reviewers from what a shopper sees: the title, the price and one photo. A person has not yet checked those labels.
Method, every miss and the limits are in [docs/accuracy.md](accuracy.md).

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
| Sixth, on release 0.14.0: unbranded sleep products, eBay and Craigslist | 180 | 6 of 7 (one post listed twice) | 1 of 157 |

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
