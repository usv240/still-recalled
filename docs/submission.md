# Devpost submission

## Project name
Still Recalled

## Tagline (elevator pitch, 200 characters max)
Flags recalled and banned baby gear on secondhand listings. The cloud teaches the device once, the device screens every listing, and only the flags leave it.

---

## The write-up

Kiersten Connolly's six-week-old son died in a Fisher-Price Rock 'n Play in 2015. Eight years later, NBC News reported
that she still searches Facebook Marketplace, eBay and Mercari every week for the sleeper, and that she searches
"inclined sleeper" too, because sellers don't always use the product's name (NBC News, April 21, 2023). CPSC sent
more than 82,000 takedown requests to online platforms in the first half of fiscal 2026 alone (Consumer Reports, April
23, 2026). A parent scrolling a listing gets none of that help. As the Baby Safety Alliance's Lisa Trofe put it to
Consumer Reports: "Once a product moves into the secondhand market, that connection is lost."

**Still Recalled puts the warning on the listing itself, while the parent is still scrolling:** in Chrome on eBay,
Mercari and Craigslist, on Android for any listing shared to it (Facebook Marketplace and OfferUp included), and on a
web page for a screenshot. It then keeps watching what you bought, because recall notices reach the first owner and
never the next one.

### The idea: the cloud teaches the device, the device screens, only flags leave
- **The cloud writes the device's field guide, once.** At build time Gemini read all 10,089 CPSC recall notices since
  1973 and wrote a spotter card for each: the brand a seller would type, the product line, the years sold, how to tell
  a recalled unit. Each recall CPSC publishes later gets its card the same way, from the installed app, twice a day.
- **The device screens every listing.** Word rules match the cards, and Gemini Nano looks at the photo: is this the
  product, a part or a toy? Is that a padded bumper folded in the bedding? A whole search page is private and free.
- **Only flags leave the device.** Gemini in the cloud sees just what the device flagged, with the full recall notice
  and its photo, and confirms, clears, or names the one thing to check. In the tests, 77% of listings never left the
  laptop.
- **The device can raise the alarm, never clear it.** Anything that would reassure a parent is read again in the cloud
  first. I measured why: asked "is this one of the recalled units?", Gemini Nano said yes 20 times where the cloud
  agreed once, so that answer is recorded and never acted on.

### Try it in a minute
- **Practice listings:** https://still-recalled.web.app/try has seventeen made-up listings, eight of them recalled.
  Install the extension (steps on the page) and the eight get a badge. One, a Kidsview bouncer, was recalled on
  November 19, 2026, after this version's recall list was built: the extension fetches it from CPSC itself.
- **Android:** install https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-android.apk,
  then share a screenshot of any listing to Still Recalled, or tap "Try it with an example photo".
- **Web page:** https://still-recalled.web.app. Add a screenshot of any listing. No account.

### What a parent sees
A used crib bedding set on eBay, $75. Folded among the sheets are padded bumpers, banned from sale since 2022 because
they can suffocate a baby. The title never says "bumper". Still Recalled badges it **Padded crib bumper**, outlines
the bumper in the seller's photo, and says what to do: **Skip this one. CPSC's advice: nothing in a crib but a fitted
sheet.** Every flag ends in an action:
- **Ask the seller** copies the one question that settles it, usually the model number and date on the label.
- **Settle it with the label:** add a photo of the label; Gemini Nano reads it on the device and code compares it with
  the notice.
- **Report to CPSC** copies a ready report for SaferProducts.gov, offered only where the sale itself is ruled out.
- **Watch for recalls** keeps checking a listing you bought against every new recall, on the device, and notifies you
  when one matches.

It never says "safe". No match means no recall was found for what the listing shows.

### How I used Firebase AI Logic
One hybrid design on two platforms, each through its own Firebase AI Logic SDK (web and Android), with the same prompts
and JSON schemas on both models, so their answers can be compared field by field.

| Step | Mode | What it sees |
|---|---|---|
| Word rules | code, on the device | Every listing's title, against all 10,089 recalls |
| Gemini Nano | `ONLY_ON_DEVICE` | Baby products: title and photo |
| Gemini, to confirm | `ONLY_IN_CLOUD` | Only what the device flagged, with the full notice and its photo; returns a box around what decided it |
| Screenshot or label photo | `PREFER_ON_DEVICE` | Read on the device when it has Gemini Nano, in the cloud otherwise; the result shows `inferenceSource` |
| New recall notices | `ONLY_IN_CLOUD` | Each notice CPSC publishes after the build, once, to write its spotter card |

- **Firebase Remote Config** holds the cloud model list, how many cloud checks run at once, and switches that turn off
  the cloud check or the writing of new cards. A retired preview model is replaced on every install within the hour.
- **Android runs the extension's own rules, not a rewrite:** the engine is bundled into the app and run in Jetpack's
  JavaScript sandbox. Where the phone has no Gemini Nano, the device steps go to the cloud's lightest model: a check
  takes 6 to 14 s.
- **App Check where there is no attestation provider.** Chrome extensions have none, and Play Integrity needs an app
  installed from Google Play, while judges install the APK from GitHub. Both get tokens from a bridge page on the site
  that runs reCAPTCHA Enterprise: the extension's hidden page frames it, and the Android app loads it in a WebView that
  talks only to the site's origin. No debug token ships. The token vouches for that page, not for the APK, so on
  Android this protects the quota from scripts, not from a modified copy of the app; Play Integrity closes that once
  the app is on Google Play.

### Tested on 597 real listings
Four blind tests, November 15 to 18, 2026: 597 used baby-gear listings from eBay, Mercari and Craigslist that the
rules had never seen. 74 should be flagged. Each was run three ways:

| Run as | Caught (of 74) | False alarms (of 481) |
|---|---|---|
| Word rules only | 43 | 86 |
| Gemini Nano only | 47 | 50 |
| **Hybrid** | **58** | **11** |

The device cuts false alarms by looking at the photo (pajamas called "sleeper", a dollhouse "bassinet"); the cloud,
which saw 23% of the listings, catches what neither can, like a bumper that shows only in the photo. Each test changed
the product: loungers went from 4 of 10 caught to 23 of 25, then 8 of 9. The listings were labelled blind by AI
reviewers (Claude) from the title, price and photo, without seeing the rules or answers. Tests 3 and 4 searched for
risky product types on purpose. Every label and every miss is in `docs/accuracy.md`.

End to end on November 19, 2026: the packed extension passed all 15 steps on the live practice page, and the Android
release APK passed all 8 checks on an Android 16 emulator (that emulator has no Gemini Nano, so it measured the cloud
path).

### Challenges
- **The built-in model agrees too easily.** Asked "same brand?", it said yes to almost anything. So code checks the
  words, the model only reads and looks, and the cloud confirms.
- **A first-time parent gets lost easily.** Two simulated walkthroughs (AI personas of a first-time parent on Android
  and a grandparent in Chrome, not real users) found where a newcomer would stop: no Android link on the web page, a
  Facebook share holding only a link, results that named a product without saying what to do, wording that could read
  as "safe". Each one is fixed in 0.9.1.
- **A government API that remembers.** The CPSC recall API answered a repeated request with its earlier answer,
  missing that morning's recalls. Each request now carries a new address.

### Built during the submission period
I built all of Still Recalled during the submission period, starting November 14, 2026. It reuses no code. The idea
comes from SafeState, my earlier project, a gate that lets a marketplace block recalled units at resale; Still Recalled
works from the buyer's side, today.

### What's next
The Chrome Web Store and Google Play, so installing takes one tap; measuring the Android on-device path on phones with
Gemini Nano; and offering the engine to resale platforms.

### Built with
Firebase AI Logic (web and Android; `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `ONLY_IN_CLOUD`), Gemini, Gemini Nano (Chrome
built-in AI; AICore on Android), Firebase Remote Config, Firebase App Check with reCAPTCHA Enterprise, Firebase Hosting,
Chrome Extensions MV3, Kotlin, Jetpack Compose, Jetpack JavaScriptEngine, WorkManager, CPSC Recall API.

### Sources
NBC News, "Grieving parents demand Facebook remove listings for recalled Rock 'n Play sleepers", April 21, 2023.
Consumer Reports, "Recalled inclined infant sleepers still causing infant deaths", April 23, 2026. More in
`docs/research/sources.md`.

---

## Gallery (in this order)
1. `docs/gallery/1-extension.png`: the extension on the practice listings, one card open.
2. `docs/gallery/2-android.png`: the Android app: a shared listing matched, and a watched one matched to a new recall.
3. `docs/gallery/3-label-check.png`: the label check, read on the device.
4. `docs/gallery/4-new-recalls.png`: a recall published after the build, matched that day, and the watch list.
5. `docs/gallery/5-hybrid.png`: where each step runs.
6. `docs/gallery/6-results.png`: the four tests.
7. `docs/gallery/7-web-page.png`: the web page on a phone.

---

## Testing instructions
- **Practice listings (fastest):** https://still-recalled.web.app/try. Install the extension (below) and reload the
  page; it says when the extension is on, and eight of the seventeen listings get a badge. Open the Baby Trend
  stroller's listing, save the seller's label photo, and add it to the card's label check.
- **Watch for recalls:** open a practice listing's own page, open its card, and choose **Watch for recalls**. The
  **Watch list** button at the top of the side panel shows it.
- **Android:** download https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-android.apk on
  an Android 8.0+ phone or emulator and allow the install. Tap "Try it with an example photo", or share a screenshot of
  a listing to Still Recalled. The first check after install can take up to a minute while the app gets its first App
  Check token; it says so.
- **Extension:** download `still-recalled-extension.zip` from https://github.com/usv240/still-recalled/releases/latest
  and unzip it. Open `chrome://extensions`, turn on Developer mode, click Load unpacked and choose the
  `still-recalled-extension` folder. It also works on eBay, Mercari and Craigslist: search "crib bumper" or "baby
  lounger", condition Used.
- The on-device step needs Chrome 139 or later on a computer that can run Chrome's built-in model. Without it, the word
  rules and the cloud check still flag the practice page's eight.
- **Code:** https://github.com/usv240/still-recalled (Apache 2.0). Firebase AI Logic is called in `extension/src/ai.js`
  and `android/app/src/main/java/app/web/stillrecalled/ai/Ai.kt`.

The video script is in `docs/video.md`.
