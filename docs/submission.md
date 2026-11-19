# Devpost submission

## Project name
Still Recalled

## Tagline (elevator pitch)
Flags recalled and banned baby gear on secondhand listings as you scroll, and keeps watching what you bought for
recalls announced later. Gemini Nano checks every listing on your laptop; Gemini in the cloud sees only the few it flags.

---

## The write-up

**Try it in a minute:** https://still-recalled.web.app/try has seventeen made-up listings, eight of them products the
CPSC has recalled. Install the extension (steps on that page) and watch the eight get a badge. One of them, a Kidsview
infant bouncer, was recalled on November 19, 2026, the day after this version's recall list was built: the extension
fetched the notice from CPSC itself, Gemini wrote its field-guide entry, and the laptop matched the listing. No
marketplace account, no hunting for a risky listing.

A parent scrolling eBay sees a used crib bedding set for $75. In the photo, folded among the sheets, are padded bumper
panels. Selling those has been against federal law since 2022, because bumpers can suffocate a baby. The title never
says "bumper", so no keyword filter catches it, and nothing on the page warns the parent. Still Recalled puts the
warning on the listing itself, while the parent is still scrolling: **Padded crib bumper**, with the bumper outlined in
the seller's photo.

The parent who buys secondhand also never hears about a recall announced later. Recall notices reach the first owner,
who registered the product; the next owner is invisible. Kids In Danger found that only 22% of the children's products
recalled in 2022 that it could analyze were ever returned, replaced or repaired (2024 report). So Still Recalled also
**watches what you bought**: it checks your saved listings against every new CPSC recall, on your laptop, and tells you
when one matches.

**What it found on real listings.** Four blind tests, November 15 to 18, 2026: 597 used baby-gear listings from eBay,
Mercari and Craigslist that the rules had never seen. 74 should be flagged, asking $5,527 in total. Still Recalled
flagged 58 of them ($4,540) with 11 false alarms among 481 listings that were fine. Word rules alone raised 86 false
alarms. **77% of the listings never left the laptop.**

### What it does
- **On eBay, Mercari and Craigslist search pages**, a badge appears on each listing that needs a look: red for a likely
  recalled product or a banned sleep product (**Padded crib bumper**), amber for **Possible recall**.
- **The card** puts the seller's photo beside the photo from the government recall notice, **outlines where in the
  photo** the cloud saw the problem, says which units are recalled, and ends in an action:
  - **Ask the seller** copies a question for the one fact that settles it (usually the model number and date on the
    label) and opens the seller's message box.
  - **Report to CPSC** copies a ready report and opens SaferProducts.gov. CPSC asks shoppers to report recalled products
    for sale online there, and its e-commerce team has the listings taken down: 3,981 takedown requests in 13 months for
    one sleeper model alone.
  - **Settle it with the label.** Add a photo of the label; Gemini Nano reads it on the laptop and code compares it with
    the notice. Try it on the practice page's stroller: its listing includes the seller's label photo.
- **Live recalls.** CPSC publishes new recalls every week. Twice a day the extension asks the CPSC recall API for
  notices since the newest one it knows, and Gemini writes each new notice's field-guide entry. A page already open is
  checked again against them. On November 19, 2026 it picked up five recalls published that morning, field-guide
  entries included, in 12 seconds.
- **Watch for recalls.** On a listing's page, one button: **Watch for recalls**. When a new recall matches a watched
  listing, Chrome shows a notification and the panel's watch list says which recall, what the hazard is and which units
  are affected. The watch list never leaves the laptop.
- **The side panel** lists every flag on the page.
- **On a phone**, the web page checks a screenshot of any listing, including Facebook Marketplace and OfferUp.

It never says "safe". No match means no recall was found.

### How I used Firebase AI Logic
Each of the SDK's inference modes is used where it fits, on purpose:

| Step | Mode | What it sees | Why there |
|---|---|---|---|
| 1. Word rules | (code, on the laptop) | Every listing's title | Instant. Matches all 10,089 CPSC recalls since 1973 by brand, product line, model number and years sold; drops parts, toys and doll items |
| 2. Gemini Nano | `ONLY_ON_DEVICE` | Baby products: title and photo | Private and free, so it can look at a whole page. Is this the product, a part or a toy? Does it look like a lounger, a padded bumper or an inclined sleeper? |
| 3. Gemini | `ONLY_IN_CLOUD` | Only what step 2 flagged: title, photo, the full recall notice and its photo | The notice is long and the call is close. Confirms, clears, or names the one thing to check, and returns a box around what decided it |
| Label photo, web page | `PREFER_ON_DEVICE` | A label photo, or a listing screenshot | Read on the laptop when it can; on a phone the identical call runs in the cloud. The page reads `inferenceSource` and says which ran |
| New recall notices | `ONLY_IN_CLOUD` | Each notice CPSC publishes after the build, once | Writes the notice's field-guide entry, so from then on the laptop matches listings and watched items against it on its own |

- **The same prompt and JSON schema on both models** (`responseConstraint` on the device, `responseJsonSchema` in the
  cloud), so their answers can be compared field by field. That is how the tests below were measured.
- **The cloud writes the device's field guide, once.** Secondhand gear is old, and the 2019 Rock 'n Play recall wasn't
  in the five years of data I started with. So at build time Gemini read all 10,089 CPSC recall notices since 1973
  through Firebase AI Logic and wrote a spotter card for each: the brand a seller would type, the product line, the years
  sold, how to tell a recalled unit. The cards ship inside the extension, so the laptop matches every recall ever issued
  with no cloud call. **And it keeps teaching it:** each recall published after the build gets its entry the same way,
  from the installed extension, so the device never falls behind CPSC. Without the cloud, a new notice still gets a
  card from plain code (brand, model numbers, product name).
- **Your watch list stays on the device.** Watched listings are checked by the word rules and Gemini Nano on the
  laptop; only a listing the device flags against a new recall goes to the cloud to confirm, the same rule as on a
  search page.
- **The device can raise the alarm, never clear it.** A label reading that matches a recalled model stands. Anything
  that would reassure the shopper is read again in the cloud first. If the two readings disagree, or a number is one
  character off a recalled model, the card says so instead of clearing it. On 12 real CPSC label photos: 8 matched, 4
  couldn't be read, none wrong. Found by testing: the built-in model read "615573" as "S16578", and once both models
  misread a blurred label; without these rules either would have told a parent "not recalled".
- **I measured where the device should not decide.** I also asked the built-in model whether a listing was one of the
  recalled units. It said yes 20 times where the cloud agreed once, so that answer is recorded and never acted on.
- **Firebase Remote Config** holds the cloud model list, how many cloud checks run at once, a switch that turns the
  cloud step off (flags then stand, marked unconfirmed), and one that stops the cloud writing field-guide entries for
  new recalls. A preview model can be retired during judging; the fix reaches
  every installed copy within the hour, with no new build.
- **App Check on a Chrome extension.** Extensions have no attestation provider. The extension's hidden page frames a
  bridge page on the site that runs reCAPTCHA Enterprise and hands App Check tokens only to this extension's ID, so
  anyone who installs it, judges included, gets the cloud check with App Check enforced.
- **Firebase Hosting** serves the web page, the practice listings and the App Check bridge.

### The tests
Each test ran three ways: word rules alone, the built-in model alone, and the hybrid. Each was collected after the
fixes the test before it led to, so every set was new to the rules it measured.

| Run as | Caught (of 74) | False alarms (of 481) |
|---|---|---|
| Word rules only | 43 | 86 |
| Built-in model only | 47 | 50 |
| **Hybrid** | **58** | **11** |

- **What it catches:** padded crib bumpers 17 of 22, infant loungers and nests 35 of 44, recalled products by name 6 of 8.
  The fourth test was the first against all 10,089 recalls (the first three used the 1,885 notices from 2021 to 2026);
  two of its three recall catches were Graco swings under a recall from 2000.
- **The built-in model cuts false alarms by looking at the photo** (pajamas named "sleeper", a dollhouse "bassinet").
  The cloud, which saw 23% of the listings, catches what neither can, such as a bumper that shows only in the photo.
- **Each test changed the product.** After two tests, loungers were the weak spot (4 of 10 caught). The fixes that
  followed raised that to 23 of 25, then 8 of 9.
- **A miss costs more than a false alarm,** so a flag the cloud can't settle stays on the page as "possible".
- **Speed:** a listing the built-in model looks at takes 6 to 10 s (median, with the cloud check where there is one).
  Listings that match a recall go first, and the rest are checked as you scroll. The practice page's 17 listings take
  about a minute and a half with the built-in model.
- **Live recalls, end to end (November 19, 2026):** in a Chrome profile with Gemini Nano, the extension caught up
  with the five recalls CPSC published that morning (field-guide entries written in 12 s) and flagged the practice
  page's Kidsview bouncer. Made to forget the recalls from November 12 on, it fetched all twelve back, and a watched
  listing for one of them (a Huffy e-trike) raised an alert, confirmed in the cloud.
- **Labels:** blind AI reviewers (Claude) labelled every listing from the title, price and one photo, without seeing
  the rules, prompts or answers. Method, every label and every miss: `docs/accuracy.md`.

### Built during the submission period
I built all of Still Recalled during the submission period, starting November 14, 2026. It reuses no code. The idea
comes from SafeState, my earlier project, a gate that lets a marketplace block recalled units at resale. That only works
once a marketplace adopts it. Still Recalled works from the buyer's side, today.

### Challenges
- **The built-in model agrees too easily.** Asked "same brand?", it said yes to almost anything. So code checks the
  words (brand, model number), the model only reads and looks, and the cloud confirms.
- **Marketplaces fight extensions without meaning to.** eBay follows the link around a button, Craigslist routes clicks
  itself, and eBay's new photo carousel (November 2026) swallowed clicks on the badge. An end-to-end test clicks the
  badge on live pages, and found each one.
- **Photos that arrive late.** On Craigslist the extension first read the page before its photos loaded, so most
  listings were judged by their title alone. A listing now waits for its photo.
- **A government API that remembers.** The CPSC recall API answered a request it had seen before with its earlier
  answer, which left out that morning's four recalls. Each request now carries a new address.
- **The law differs by product type.** Padded crib bumpers and inclined sleepers can't be sold at all. In-bed sleepers
  and nests made from June 23, 2022, and loungers made from May 5, 2025, must meet federal standards (16 CFR 1236 and
  1243); older ones aren't banned from resale, though CPSC warns against them for sleep and eBay and Facebook prohibit
  them. Each warning states its own type's rule, and only the outright bans get a Report to CPSC button.

### What's next
- The Chrome Web Store, so installing takes one click.
- Facebook Marketplace inside the extension.
- Offering the engine to resale platforms, the side SafeState covers.

### Built with
Firebase AI Logic (hybrid inference: `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, `ONLY_IN_CLOUD`), Gemini, Gemini Nano
(Chrome built-in AI), Firebase Remote Config, Firebase App Check with reCAPTCHA Enterprise, Firebase Hosting, Chrome
Extensions MV3 (offscreen document, side panel, alarms, notifications), CPSC Recall API, esbuild, Puppeteer.

---

## Gallery (in this order)
1. `docs/gallery/1-extension.png`: the extension on the practice listings, one card open.
2. `docs/gallery/2-label-check.png`: the label check, read on the laptop.
3. `docs/gallery/3-new-recalls.png`: a recall published the morning after the build, matched that day, and the watch list.
4. `docs/gallery/4-hybrid.png`: where each step runs.
5. `docs/gallery/5-results.png`: the four tests.
6. `docs/gallery/6-web-page.jpg`: the web page on a phone.

---

## Testing instructions
- **Practice listings (fastest):** https://still-recalled.web.app/try. Install the extension (below), reload the page,
  and eight of the seventeen listings get a badge (the Kidsview bouncer's recall arrives from CPSC a few seconds after
  install). Open the Baby Trend stroller's listing, save the seller's label photo, and add it to the card's label check.
- **Watch for recalls:** open any practice listing's own page, open the side panel, and choose **Watch for recalls**.
  The bell at the top of the panel shows the watch list and when the recall list was last checked with CPSC.
- **Extension:** download `still-recalled-extension.zip` from
  https://github.com/usv240/still-recalled/releases/latest and unzip it. Open `chrome://extensions`, turn on
  Developer mode, click "Load unpacked" and choose the folder. It also works on eBay, Mercari and Craigslist: search for
  "crib bumper" or "baby lounger" with Condition set to Used.
- **Web page:** https://still-recalled.web.app. Click "Try it with an example photo", or add a screenshot of any listing.
  No account.
- The on-device step needs Chrome 139 or later on a computer that can run Chrome's built-in model. Without it, the
  extension still works with the word rules and the cloud check (the practice page's eight are still flagged).
- **Code:** https://github.com/usv240/still-recalled (Apache 2.0). Firebase AI Logic is called in
  `extension/src/ai.js`; the pipeline is `extension/src/engine.js`.

---

# Video (2:40)

A complete draft is built by `scripts/make-video.mjs` from real footage (`scripts/record-demo.mjs`: the release extension with
the built-in model on the practice listings, then the label check; `scripts/record-phone.mjs`: the web page at phone size), slides drawn
from the test reports, a neural voice and burned-in captions. To narrate it yourself, record over the same words; the
captions are in `still-recalled-demo.srt`.

| Time | Picture | Words |
|---|---|---|
| 0:00 | Practice listings at still-recalled.web.app/try; badges appear as the extension checks them | "Recalled baby gear is resold online every day: inclined sleepers linked to infant deaths, padded crib bumpers that federal law now bans. The listings rarely say so. Still Recalled is a Chrome extension that puts the warning on the listing itself." |
| 0:15 | The rest of the page is checked (sped up); seven of sixteen flagged | "These are practice listings: seven of the sixteen are products the CPSC has recalled. Chrome's built-in model, Gemini Nano, looks at each title and photo right on this laptop, against every CPSC recall since 1973. Only the listings it flags go to Gemini in the cloud, through Firebase AI Logic, with the full recall notice. All seven are flagged, and the toys and the bottle are left alone." |
| 0:42 | The padded crib bumper card opens, with the cloud outline on the photo | "This one is flagged as a padded crib bumper: the built-in model saw it in the photo, and the cloud confirmed it, and outlined exactly where. The card says why, and gives the shopper the one question that settles it. For products the law bans outright, it also copies a ready report for CPSC." |
| 1:00 | The Baby Trend stroller listing: the label photo is added and read on the laptop | "A possible recall comes down to the model number. Add a photo of the label, and Gemini Nano reads it on the laptop; the photo never leaves it. Code, not the model, compares it with the notice. The device can raise the alarm on its own, but anything reassuring is read again in the cloud first." |
| 1:18 | Slide: where each step runs (ONLY_ON_DEVICE, ONLY_IN_CLOUD, Remote Config) | "Why hybrid? A search page has sixty listings, and a parent scrolls through hundreds. Screening them all in the cloud would send their browsing to a server and cost money for every look. So screening runs only on the device, and the cloud only confirms. The cloud also wrote the device's field guide: it read all ten thousand recall notices once, so the laptop can match every one of them on its own. Across four tests, 77% of listings never left the laptop." |
| 1:48 | Slide: results of the four tests | "It was tested four times, on 597 real listings from eBay, Mercari and Craigslist that it had never seen, labelled blind. Word rules alone raised 86 false alarms. The built-in model cut that to 50 by looking at the photos, and the cloud check cut it to 11, while catching 58 of the 74 listings that should be flagged." |
| 2:11 | The web page on a phone, checking the example photo in the cloud | "A phone has no built-in model, so the web page asks Firebase AI Logic to prefer the device, and the same call runs on Gemini in the cloud instead. Take a screenshot of any listing, even on Facebook Marketplace, and get the same check." |
| 2:26 | Logo, links | "Try it yourself on the practice listings at still recalled dot web dot app, slash try. It never says a product is safe: no match only means no recall was found. Still Recalled. Free, and open source." |
