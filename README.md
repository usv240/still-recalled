# Still Recalled

A parent scrolling eBay sees a used elephant crib bedding set for $75. In the photo, folded among the sheets, are
padded bumper panels with ties. Selling those has been against federal law since 2022, because bumpers can suffocate
a baby. The title never says "bumper", so no keyword filter catches it, and nothing on the page warns the parent.

**Still Recalled puts the warning on the listing.** It is a Chrome extension for eBay, Mercari and Craigslist search
pages, plus a web page that checks a screenshot of any listing on a phone. Chrome's built-in model (Gemini Nano) looks
at every baby product on your own computer, and only the few it flags go to Gemini in the cloud, through Firebase AI
Logic hybrid inference.

**What it found on real listings.** In three blind tests on 437 used baby-gear listings from eBay, Mercari and
Craigslist, 52 were recalled products, padded crib bumpers or infant loungers, asking $3,211 in total. Still Recalled
flagged 40 of them ($2,689), with 10 false alarms among the 365 listings that were fine. Word rules alone raised 62.
80% of the listings never left the computer.

## The problem

- **Some of these products have killed infants.** About 100 deaths were reported in Fisher-Price Rock 'n Play inclined
  sleepers alone (CPSC, 2023). CPSC counted 113 deaths that involved a crib bumper in the sleep setting (1990–2019).
- **Selling them is against federal law.** Inclined sleepers and padded crib bumpers have been banned from sale since
  November 2022, whatever their age. Selling a recalled product is unlawful too, for private sellers as well,
  unless the recall's fix has been applied.
- **They are still for sale secondhand.** In May–June 2026, Consumer Reports found these product types for sale on
  Facebook Marketplace, eBay, Mercari and Craigslist, with all four types on Facebook Marketplace. Its earlier
  investigation found that sellers use generic names, which keyword filters miss.
- **Parents rely on secondhand gear.** About two in three U.S. parents bought kids' or baby items secondhand in the
  past year (Mercari Reuse Report, 2022).
- **Nothing warns the buyer.** The only similar Chrome extension checks Amazon product pages only. No tool flags
  secondhand marketplace listings from the buyer's side.

Every figure is sourced in [docs/research/sources.md](docs/research/sources.md).

## What it does

**On a search page** (eBay, Mercari, Craigslist), a badge appears on each listing that needs a look:
- red **Recalled product**, or the product type, such as **Infant lounger or nest**, when it's likely;
- amber **Possible recall** when it's worth checking.

Clicking the badge opens a card that shows:
- the seller's photo beside the photo from the government recall notice;
- what to check before buying;
- **Ask the seller**: copies a question that asks for the one fact that settles it, usually the model number and
  date on the label, and opens eBay's message box for that seller (on other sites, the listing);
- **Report to CPSC**, on likely flags where a recall or the law rules the sale out: copies a ready report with the
  listing's link and opens the SaferProducts.gov form. CPSC asks shoppers who find a recalled product for sale online
  to report it there, and its e-commerce team has such listings taken down.

The side panel lists every flag on the page. The toolbar icon shows how many there are.

**On the web page**, you add a screenshot of any listing, including Facebook Marketplace or OfferUp, or a photo of the
item, and get the same check. It works on phones.

It never says a product is safe. No match means no recall was found.

## How the hybrid AI works

```
every listing ── 1. word rules (instant, on the computer) ──────────────────────────────┐
                    recall shortlist by brand, product line, model number (1,885 CPSC notices)
                    risky-type words; parts and toys dropped                             │
                                                                                         ▼
baby products ─── 2. Chrome's built-in model (Gemini Nano, on the computer) ── title + photo
                    is it the product, a part or a toy? does the photo look like a risky type?
                                                                                         ▼
flags only ────── 3. Gemini in the cloud, via Firebase AI Logic ── full recall notice + both photos
                    is this the recalled product? cannot tell? what should the buyer check?
```

- **Extension:** step 2 uses `InferenceMode.ONLY_ON_DEVICE`. A shopper's browsing is never sent to the cloud just to
  be screened; only listings already flagged on the computer go to step 3.
- **Web page:** steps 1 and 2 use `InferenceMode.PREFER_ON_DEVICE`. The same code runs on the built-in model in
  desktop Chrome and falls back to Gemini on phones. The page shows which one was used.
- **One engine:** both use the same engine, prompts and JSON schemas. Answers are structured JSON in both modes, so
  the on-device and cloud answers can be compared field by field.

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

Three tests, each on listings collected after the fixes the test before it led to, labelled blind by separate
reviewers from what a shopper sees: the title, the price and one photo. Method, every miss and the limits are in
[docs/accuracy.md](docs/accuracy.md).

| Same engine, run as | Caught (of 52) | False alarms (of 365) |
|---|---|---|
| Words only | 31 | 62 |
| Built-in model only | 35 | 30 |
| **Hybrid** | **40** | **10** |

| Test | Listings | Hybrid caught | Hybrid false alarms |
|---|---|---|---|
| First: eBay | 136 | 10 of 14 | 4 of 115 |
| Second, after fixes: eBay and Craigslist | 125 | 2 of 4 | 0 of 117 |
| Third, after fixes: eBay, Mercari and Craigslist | 176 | 28 of 34 | 6 of 133 |

- By kind: recall matches 3 of 3, infant loungers and nests 27 of 35, padded crib bumpers 10 of 14.
- Loungers were the weak spot after two tests (4 of 10). The changes that followed raised that to 23 of 25 in the
  third test, on listings collected after the changes.
- The cloud saw 20% of the listings across the three tests.

An end-to-end test loads the real extension into Chrome and runs it on a live search. It checks every hand-off, the
badges, the toolbar count, that a badge click stays on the page, and that the card offers the next step. In a Chrome
profile that has the built-in model, the release build passes all 11 steps on eBay: Gemini Nano looked at 59 of the
60 listings inside the installed extension, and the cloud confirmed 41 with no errors. Without the model it passes all
10 on eBay and on Craigslist.

## Try it

**Web page:** https://still-recalled.web.app. On a phone or computer, add a screenshot, or use "Try it with an example photo".

**Chrome extension**
1. Download `still-recalled-extension.zip` from the [latest release](https://github.com/usv240/still-recalled/releases/latest) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder.
3. Search eBay for `baby lounger` (Condition: Used). Badges appear as listings are checked. Click one, or click the
   toolbar icon for the side panel.

The on-device step needs Chrome 139 or later on a computer that can run Chrome's built-in model. Without it, the
extension uses the word rules and the cloud check.

## Build

```
npm install
npm run build        # extension/build, web/build
npm test             # unit tests
npm run e2e          # the real extension in a separate Chrome profile, on a live eBay search
node scripts/pack-extension.mjs    # release package in dist/ (no debug token, no developer pages)
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
- A flagged listing's title, description and photo are sent to Gemini through Firebase AI Logic, with the recall
  notice, for the double check. You can turn the cloud check off in the side panel's settings.
- No accounts and no tracking. Results are kept in the browser for 7 days.
- The full policy: [still-recalled.web.app/privacy.html](https://still-recalled.web.app/privacy.html).

## Data and credits

- **Recall data:** the U.S. Consumer Product Safety Commission recall API (saferproducts.gov), 1,885 notices since
  November 2021. Still Recalled is not affiliated with CPSC.
- **Example photo:** `web/example/recall-26591.jpg` is from CPSC recall notice 26591 (VEVOR baby loungers).
- **Font:** Geist, SIL Open Font License, © Vercel ([extension/fonts/Geist-LICENSE.txt](extension/fonts/Geist-LICENSE.txt)).
- **Origins:** Still Recalled was built during the #BuildHybridAI submission period, from November 14, 2026, and
  reuses no code. The idea comes from my earlier project, [SafeState](https://safestate.vercel.app). SafeState gives
  marketplaces a gate that blocks recalled units at the moment of resale, but only once a marketplace adopts it.
  Still Recalled works from the buyer's side, today, on listings no one has screened. It adds the infant sleep
  products that are dangerous even when no recall names them.

## License

Apache License 2.0. See [LICENSE](LICENSE).
