# Devpost submission

## Project name
Still Recalled

## Tagline (elevator pitch, 200 characters max)
Flags recalled baby gear on secondhand listings. The device screens every listing, the cloud confirms its flags, and each can ask the other which recall an unnamed product is.

---

## The write-up

Kiersten Connolly's six-week-old son died in a Fisher-Price Rock 'n Play in 2015. Eight years later, NBC News reported
that she still searches Facebook Marketplace, eBay and Mercari every week for the sleeper, by hand, and that she
searches "inclined sleeper" too, because sellers don't always use the product's name (NBC News, April 21, 2023).

A parent scrolling those listings gets no help at all. A used crib bedding set on eBay, $75: folded among the sheets
are padded bumpers, banned from sale since 2022 because they can suffocate a baby. The title never says "bumper", so
no keyword filter catches it.

**Still Recalled puts the warning on the listing.** It badges that set **Padded crib bumper**, outlines the bumper in
the seller's photo, and says what to do: **Skip this one. CPSC's advice: nothing in a crib but a fitted sheet.** It
works in Chrome on eBay, Mercari and Craigslist search pages, on Android for a listing or screenshot shared from any
app (which is how it reaches Facebook Marketplace and OfferUp), and on a web page for a screenshot.

**On 775 real listings it had never seen, sellers were asking $6,063 for baby gear that should have been flagged.
Still Recalled flagged $5,022 of it,** and raised 12 false alarms among 630 ordinary listings. Keyword rules alone
raised 109.

### Try it in a minute
- **Practice listings:** https://still-recalled.web.app/try. Seventeen made-up listings, eight of them recalled
  products, each with the photo from its own recall notice. Install the extension (steps on the page) and the eight
  get a badge. The first is titled only "Inclined baby sleeper, pink, folds flat". Open its card: it names the Rock
  'n Play recall, and says how it found it.
- **Android:** install https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-android.apk,
  then share a screenshot of any listing to Still Recalled, or tap "Try it with an example photo".
- **Web page:** https://still-recalled.web.app. Add a screenshot, or choose **I own it** and check something you are
  about to sell. No account.

### How it got here: four things I got wrong
**1. I trusted the small model.** My first version asked Gemini Nano, on the laptop, "is this the recalled product?"
It said yes to almost anything. Asked whether a listing was one of the recalled units, it said yes 20 times where
Gemini in the cloud agreed once. So I split the work. Code checks the words. Gemini Nano only looks: is this the
product, a part or a toy, and does the photo show a risky type? Gemini in the cloud confirms what gets flagged,
against the full recall notice and its photo. False alarms fell from 109 to 12.

**2. The device had nothing to check against.** There are 10,089 CPSC recalls since 1973, and Gemini Nano knows none
of them. So the cloud taught the device once: Gemini read every notice and wrote a short "spotter card" for each
(the brand a seller would type, the product line, the years sold, how to tell a recalled unit). The cards ship with
the app, and the device matches every listing against them with no cloud call. It did the same for 392 CPSC safety
warnings, which the recall API leaves out, and the installed extension does it again for each new recall and warning
CPSC publishes.

**3. Sellers leave the name out.** "Inclined baby sleeper, pink, folds flat" names no product, so the device finds
only a risky type. The cloud can recognise a Rock 'n Play in the photo, but the field guide lives on the device. So
the cloud's confirmation now carries one function, `lookup_recalls`, through Firebase AI Logic function calling: the
cloud names the product, the call comes back to the device, the device's own matching code answers, and the cloud
judges the listing against the notice the device found. The first time I offered the function, the cloud called it on
19 of 21 listings, mostly for brands the title already named. Told that the device had already searched with the
listing's own words, it called it on none of those.

**4. I let the small model name the brand, and it guessed.** I had Gemini Nano say which brand it could read in the
photo, so the device could look it up itself. On ten test photos it gave a brand three times and was wrong each
time. So its answer is never shown. It only sends the listing to the cloud as a question, and a recall found this way
is never more than "Possible recall". On 23 real listings with the brand stripped from the title, the two lookups
named the right recall on 12 and a wrong one on none.

**The rule all four taught me: the device may raise an alarm alone, but never reassure alone.** A small model that
says "looks fine" is the dangerous case, so anything that would reassure a parent is checked again in the cloud. With
the cloud off, a label reading that points away from a recall says "Read once: not ruled out". The app never says
"safe".

### Every flag ends in something to do
- **Ask the seller** copies the one question that settles it.
- **Settle it with the label:** add a photo of the label. Gemini Nano reads it on the device, and code compares it
  with the notice.
- **Report to CPSC** copies a ready report for SaferProducts.gov, offered only where the sale itself is ruled out.
- **Watch for recalls** checks what you bought against every new recall, on the device, and notifies you. Recall
  notices reach the first owner, never the next one.
- **I own it** turns the same check around for a seller or a grandparent with a hand-me-down: don't pass it on, and
  what the recall offers you.

### How I used Firebase AI Logic
One design on two platforms, each through its own Firebase AI Logic SDK (web and Android), with the same prompts and
JSON schemas on both models.

| Step | Mode | What it sees |
|---|---|---|
| Word rules | code, on the device | Every listing, against 10,089 recalls and 392 warnings |
| Gemini Nano | `ONLY_ON_DEVICE` | Baby products the words leave open: title and photo |
| Gemini, to confirm | `ONLY_IN_CLOUD`, with function calling | What the device flagged or couldn't settle, with the full notice; may call `lookup_recalls`, answered on the device |
| Screenshot or label photo | `PREFER_ON_DEVICE` | Read on the device when it has Gemini Nano, in the cloud otherwise; the result shows `inferenceSource` |
| New recalls and warnings | `ONLY_IN_CLOUD` | Each notice CPSC publishes after the build, to write its spotter card |

- **Most listings never leave the laptop:** 77% across the five tests. Nothing is sent just to be screened.
- **Firebase Remote Config** holds the cloud model list and a switch for the cloud steps, so a retired preview model
  is replaced on every install within about an hour, with no update.
- **Android runs the extension's own rules, not a rewrite:** the engine is bundled into the app and run in Jetpack's
  JavaScript sandbox, and the function call is answered there.
- **App Check where there is no attestation provider.** A Chrome extension has none, and Play Integrity needs an app
  from Google Play. Both get tokens from a page on the site that runs reCAPTCHA Enterprise. No debug token ships.

### The numbers
Five blind tests, November 15 to 20, 2026: 775 used baby-gear listings from eBay, Mercari and Craigslist, collected
after the rules they test were written. 83 should be flagged. The same engine, run three ways:

| Run as | Caught (of 83) | False alarms (of 630) |
|---|---|---|
| Word rules only | 47 | 109 |
| Gemini Nano only | 51 | 64 |
| **Hybrid** | **65** | **12** |

The newest test, 178 listings on this version: 7 of 9 caught, 1 false alarm among 149, and 21% of listings sent to
the cloud. Its two misses show the extension's limit. One was a Rock 'n Play listed only as "Baby Rocker": Gemini
Nano saw nothing in the photo, so the listing never left the laptop. Checked one at a time, the way the web page and
the phone do, all 9 are caught, with 3 soft false alarms and 83% sent to the cloud. That is the trade between privacy
and reach, and a setting lets the parent choose.

Tests on the shipped builds: 87 unit tests; the packed extension, 18 of 18 end-to-end steps on the live practice
page; the Android app, 10 of 10 checks on an emulator.

### Limits, as measured
- **No person has checked the test labels, and no parent has used it yet.** The labels are by AI reviewers (Claude)
  who could not see the product. Each listing in the newest test has one reviewer's label.
- **The newest test is small:** 9 listings to flag, 6 of them from two searches that name a hazard.
- **Android has not run on Gemini Nano.** The emulator has none, so its device steps ran in the cloud (8 to 17 s a
  check; up to 54 s when the cloud was slow).
- **Gemini Nano is slow and varies.** About 5 to 11 s a listing, and its answer for the same listing can differ between
  runs.
- **Sideload only** until the Chrome Web Store and Google Play listings are done.

Every label, every miss and the method are in `docs/accuracy.md`.

### Built during the submission period
I built all of Still Recalled during the submission period, starting November 14, 2026. It reuses no code. The idea
comes from SafeState, my earlier project, a gate that lets a marketplace block recalled units at resale; Still
Recalled works from the buyer's side, today.

### Built with
Firebase AI Logic (web and Android; `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `ONLY_IN_CLOUD`, function calling), Gemini,
Gemini Nano (Chrome built-in AI; AICore on Android), Firebase Remote Config, Firebase App Check with reCAPTCHA
Enterprise, Firebase Hosting, Chrome Extensions MV3, Kotlin, Jetpack Compose, Jetpack JavaScriptEngine, WorkManager,
CPSC Recall API, CPSC product safety warnings.

### Sources
NBC News, "Grieving parents demand online listings for Rock 'n Plays be removed before more babies die", April 21,
2023. Consumer Reports, "How to avoid unsafe used baby gear when shopping online", September 23, 2026. More in
`docs/research/sources.md`.

---

## Gallery (in this order)
1. `docs/gallery/1-extension.png`: the extension on the practice listings, one card open.
2. `docs/gallery/2-android.png`: the Android app: a shared listing matched, and a watched one matched to a new recall.
3. `docs/gallery/3-label-check.png`: the label check, read on the device.
4. `docs/gallery/4-new-recalls.png`: a recall published after the build, matched that day, and the watch list.
5. `docs/gallery/5-hybrid.png`: where each step runs.
6. `docs/gallery/6-results.png`: the five tests.
7. `docs/gallery/7-web-page.png`: the web page on a phone.

---

## Testing instructions
- **Practice listings (fastest):** https://still-recalled.web.app/try. Install the extension (below) and reload the
  page; it says when the extension is on, and eight of the seventeen listings get a badge. Open the "Inclined baby
  sleeper" card: it names the Rock 'n Play and says how the recall was found. Open the Baby Trend stroller's listing,
  save the seller's label photo, and add it to the card's label check.
- **Watch for recalls:** open a practice listing's own page, open its card, and choose **Watch for recalls**. The
  **Watch list** button at the top of the side panel shows it.
- **Android:** download https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-android.apk on
  an Android 8.0+ phone or emulator and allow the install. Tap "Try it with an example photo", or share a screenshot of
  a listing to Still Recalled. To see a CPSC warning, share the text "Aila+Aiden baby lounger, grey". The first check
  after install can take up to a minute while the app gets its first App Check token; it says so. Choose **I own it**
  on the start screen to see the seller's side.
- **Extension:** download `still-recalled-extension.zip` from https://github.com/usv240/still-recalled/releases/latest
  and unzip it. Open `chrome://extensions`, turn on Developer mode, click Load unpacked and choose the
  `still-recalled-extension` folder. It also works on eBay, Mercari and Craigslist: search "crib bumper" or "baby
  lounger", condition Used.
- The on-device step needs Chrome 139 or later on a computer that can run Chrome's built-in model. Without it, the word
  rules and the cloud check still flag the practice page's eight.
- **Code:** https://github.com/usv240/still-recalled (Apache 2.0). Firebase AI Logic is called in `extension/src/ai.js`
  and `android/app/src/main/java/app/web/stillrecalled/ai/Ai.kt`; the function the cloud calls, and the device's own
  lookup, are in `shared/lookup.mjs`.

The video script is in `docs/video.md`.
