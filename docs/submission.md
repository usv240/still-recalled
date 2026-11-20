# Devpost submission

## Project name
Still Recalled

## Tagline (elevator pitch, 200 characters max)
Flags recalled baby gear on secondhand listings. The device screens every listing, the cloud confirms its flags, and each can ask the other which recall an unnamed product is.

---

## The write-up

Kiersten Connolly's six-week-old son died in a Fisher-Price Rock 'n Play in 2015. Eight years later, NBC News reported
that she still searches Facebook Marketplace, eBay and Mercari every week for the sleeper, and that she searches
"inclined sleeper" too, because sellers don't always use the product's name (NBC News, April 21, 2023). CPSC issued
82,000 takedown notices in the first half of fiscal 2026 alone, its acting chairman said (Consumer Reports, April 23,
2026). A parent scrolling a listing gets none of that help: 63% of parents say it is hard to tell whether pre-owned
equipment is safe, and 49% are very likely to search online for recalls when they get some (C.S. Mott Children's
Hospital National Poll, May 2023, 932 parents).

eBay, Facebook Marketplace and Mercari already ban these products and filter listings by keyword. Consumer Reports
still found banned or recalled baby gear on all four sites it checked in May and June 2026 (Consumer Reports,
September 23, 2026). Its 2019 study had found one reason: sellers use generic names, such as "baby sleeper/rocker",
that keyword filters miss. The platforms screen the seller's words. Nothing checks what gets through for the buyer.

**Still Recalled puts the warning on the listing itself:** in Chrome on eBay, Mercari and Craigslist search pages, on
Android for any listing shared to it (Facebook Marketplace and OfferUp included), and on a web page for a screenshot.
It then keeps watching what you bought, because recall notices reach the first owner and never the next one. And it
works from the other side too: choose **I own it**, and the same check tells a seller, or a grandparent with a
hand-me-down, not to pass it on and what the recall offers its owner.

### The idea: a hybrid that works in both directions
Most hybrid apps run the small model first and fall back to the cloud. Here each side does a job the other cannot,
and each can ask the other.

- **The cloud writes the device's field guide.** Gemini read all 10,089 CPSC recall notices since 1973 and wrote a
  spotter card for each: the brand a seller would type, the product line, the years sold, how to tell a recalled
  unit. It did the same for 392 CPSC safety warnings, the notices CPSC issues when a seller will not recall a
  product (144 of them in 2026 alone). The recall API does not list those. Each recall and warning CPSC publishes
  later gets its card from the installed extension.
- **The device screens every listing.** Word rules match the cards, and Gemini Nano looks at each baby product's
  photo, one at a time, starting with the listings on screen. A parent's browsing is never sent anywhere to be
  screened.
- **The cloud confirms what the device flags or can't settle,** against the full notice and its photo. In five blind
  tests, 77% of listings never left the laptop.
- **The cloud asks the device.** A seller writes "Inclined baby sleeper, pink, folds flat". The words name no
  product, so the device finds only a risky type. The cloud recognises a Rock 'n Play in the photo, but the field
  guide lives on the device. So the confirmation carries one function, `lookup_recalls`, through Firebase AI Logic
  function calling: the cloud names the product, the call comes back to the device, the same code that shortlists
  listings answers it, and the cloud judges the listing against the notice the device found. A recall counts only if
  it is one the device returned. Because no code checked the brand, it is never a red "Recalled product" on the
  cloud's word alone: it is named on a type flag that already stands, or shown as "Possible recall".
- **The device asks itself, and the cloud checks the answer.** Gemini Nano also says which brand it can read in a
  photo, and the device looks that brand up in its own field guide. I measured how far to trust that: on ten test
  photos it said "Fisher-Price" for three different sleepers and was right once. So its answer is never shown. It
  only sends the listing to the cloud with the recall attached as a question, and the cloud agrees, names another
  product, or drops it. On 23 real listings with
  the brand stripped from the title by code, the sellers' own photos kept, the word rules found no recall. Checked
  one at a time, the two lookups named the right recall on 12, seven of them through the device's own lookup, and
  named no wrong one.
- **The device may raise an alarm alone, never reassure alone.** Asked "is this one of the recalled units?", Gemini
  Nano said yes 20 times where the cloud agreed once, so that answer is never acted on. A label reading that would
  point away from a recall is read again in the cloud; with the cloud off, the card says "Read once: not ruled out".

### Try it in a minute
- **Practice listings:** https://still-recalled.web.app/try has seventeen made-up listings, eight of them recalled
  products, each shown with the photo from its own recall notice. Install the extension (steps on the page) and the
  eight get a badge. The first is titled "Inclined baby sleeper, pink, folds flat": it comes back **Inclined infant
  sleeper**, and its card names the Rock 'n Play recall, found through the cloud's question to the device. Another, a
  Kidsview bouncer, was recalled after this version's recall list was built: the extension fetches it from CPSC.
- **Android:** install https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-android.apk,
  then share a screenshot of any listing to Still Recalled, or tap "Try it with an example photo" (a made-up listing).
- **Web page:** https://still-recalled.web.app. Add a screenshot of any listing, or choose **I own it** and add a
  photo of something you're about to sell. No account.

### What a parent sees
A used crib bedding set on eBay, $75. Folded among the sheets are padded bumpers, banned from sale since 2022. The
title never says "bumper". Still Recalled badges it **Padded crib bumper**, outlines the bumper in the seller's
photo, and says what to do: **Skip this one. CPSC's advice: nothing in a crib but a fitted sheet.** Every flag ends
in an action:
- **Ask the seller** copies the one question that settles it.
- **Settle it with the label:** add a photo of the label; Gemini Nano reads it and code compares it with the notice.
- **Report to CPSC** copies a ready report for SaferProducts.gov, offered only where the sale itself is ruled out.
- **Watch for recalls** checks what you bought against every new recall, on the device, and notifies you.

It never says "safe". No match means no recall was found for what the listing shows.

### How I used Firebase AI Logic
One design on two platforms, each through its own Firebase AI Logic SDK (web and Android), with the same prompts and
JSON schemas on both models.

| Step | Mode | What it sees |
|---|---|---|
| Word rules | code, on the device | Every listing, against 10,089 recalls and 392 warnings |
| Gemini Nano | `ONLY_ON_DEVICE` | Baby products: title and photo. Also names a brand it reads, which the device looks up |
| Gemini, to confirm | `ONLY_IN_CLOUD`, with function calling | What the device flagged or couldn't settle, with the full notice; may call `lookup_recalls`, answered on the device |
| Screenshot or label photo | `PREFER_ON_DEVICE` | Read on the device when it has Gemini Nano, in the cloud otherwise; the result shows `inferenceSource` |
| New recalls and warnings | `ONLY_IN_CLOUD` | Each notice CPSC publishes after the build, to write its spotter card |

- **Firebase Remote Config** holds the cloud model list and switches for the cloud steps. A retired preview model is
  replaced on every install within about an hour, with no update, and a model that answers "not found" is skipped
  for the next one in the list.
- **Android runs the extension's own rules, not a rewrite:** the engine is bundled into the app and run in Jetpack's
  JavaScript sandbox, and the function call is answered there. On the web page and the phone a parent checks one
  listing at a time, so every baby product gets the cloud's look; the extension offers the same as a setting, off by
  default. Where the phone has no Gemini Nano, the device steps go to the cloud's lightest model: a check takes 8 to 17 s.
- **App Check where there is no attestation provider.** Chrome extensions have none, and Play Integrity needs an app
  installed from Google Play. Both get tokens from a bridge page on the site that runs reCAPTCHA Enterprise. No debug
  token ships. The token vouches for that page, not for the APK, so on Android this protects the quota from scripts,
  not from a modified copy of the app; Play Integrity closes that once the app is on Google Play.

### Tested
**On 775 real listings, in five blind tests.** November 15 to 20, 2026: used baby-gear listings from eBay, Mercari
and Craigslist that the rules had never seen. 83 should be flagged. Each was run three ways:

| Run as | Caught (of 83) | False alarms (of 630) |
|---|---|---|
| Word rules only | 47 | 109 |
| Gemini Nano only | 51 | 64 |
| **Hybrid** | **65** | **12** |

The device cuts false alarms by looking at the photo; the cloud, which saw 23% of the listings, catches what neither
can. Each test was run with the engine of its day; within a test the three ways share one engine. The listings were
labelled blind by AI reviewers (Claude) from the title, price and photo; a person has not yet checked those labels.
Every label and every miss is in `docs/accuracy.md`.

**The fifth test is this version's.** 178 listings from plain searches ("baby rocker", "baby swing", "toddler bed")
in cities no earlier test used, collected and labelled after the engine was frozen, run once: 7 of 9 caught, 1 false
alarm among 149, 21% sent to the cloud. Word rules alone raised 23 false alarms. The two misses show the extension's
limit: a listing titled only "Baby Rocker" whose photo is a Rock 'n Play, and a lounger sold as a "baby pillow".
Gemini Nano saw nothing in either photo, so neither left the laptop. Checked one at a time, the way the web page and
the phone do, both are flagged, and the rocker's card names the Rock 'n Play recall through `lookup_recalls`.
I ran all 178 that way too: 9 of 9 caught, 3 soft false alarms, and 83% of listings sent to the cloud, against 21%.
That is the trade the extension makes by default, and a setting lets a parent make the other one.

**The earlier 597 again, on this version.** I ran the first two sets again (261 listings; the test computer could not finish the
other two with Gemini Nano): 14 of 18 caught and 3 false alarms, against 15 and 3 on 0.11.0 and 12 and 4 in the first
blind runs. That is not a blind result. In them the device's own lookup fired on 4 listings; the cloud took none up,
and nothing was shown.

**End to end, November 20, 2026.** The packed extension passed all 17 steps on the live practice page (a new Chrome
profile, so without Gemini Nano), including four CPSC safety warnings fetched live. With Gemini Nano, in a development
build, all 8 recalled practice listings were flagged and the label was read on the device. The Android release APK
passed all 10 checks and the 6 "I own it" checks on an Android 16 emulator, which has no Gemini Nano, so the phone's
on-device path has not been run yet. "I own it" on the web page passed its 10 steps on a local build.

### Challenges
- **The built-in model agrees too easily.** Asked "same brand?", it said yes to almost anything, and asked which
  brand it could read, it guessed. So code checks the words, the model only reads and looks, and the cloud confirms.
- **The cloud asked too often.** Offered the function, it called it on 19 of 21 listings, mostly for brands the title
  already named. Told that the device had already searched with the listing's own words, it called on none of them.
- **A slow government API became false alarms.** When CPSC's recall API timed out, the cloud check gave up and six
  unconfirmed flags stood. The check now runs on the short record the device already holds.
- **A first-time parent gets lost easily.** Two simulated walkthroughs (AI personas, not real users) found where a
  newcomer would stop, and independent AI reviews found claims the code did not support. Each is fixed, and listed in
  `docs/accuracy.md`.

### Built during the submission period
I built all of Still Recalled during the submission period, starting November 14, 2026. It reuses no code. The idea
comes from SafeState, my earlier project, a gate that lets a marketplace block recalled units at resale; Still Recalled
works from the buyer's side, today.

### What's next
The Chrome Web Store and Google Play; the Android on-device path on a phone with Gemini Nano; a person's check of the
test labels; real parents and sellers using it; and a better eye on the device, so that an unnamed product in a photo
is noticed without sending every listing to the cloud.

### Built with
Firebase AI Logic (web and Android; `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `ONLY_IN_CLOUD`, function calling), Gemini,
Gemini Nano (Chrome built-in AI; AICore on Android), Firebase Remote Config, Firebase App Check with reCAPTCHA
Enterprise, Firebase Hosting, Chrome Extensions MV3, Kotlin, Jetpack Compose, Jetpack JavaScriptEngine, WorkManager,
CPSC Recall API, CPSC product safety warnings.

### Sources
NBC News, "Grieving parents demand online listings for Rock 'n Plays be removed before more babies die", April 21,
2023. Consumer Reports, "Recalled Inclined Infant Sleepers Are Still in Use—and Still Dangerous", April 23, 2026;
"How to avoid unsafe used baby gear when shopping online", September 23, 2026; and its report of November 6, 2019 on
recalled products sold on Craigslist and Facebook Marketplace. C.S. Mott Children's Hospital National Poll on Children's
Health, "Used but still safe?", May 15, 2023. More in `docs/research/sources.md`.

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
