# Devpost submission

## Project name
Still Recalled

## Tagline (elevator pitch)
Spots recalled and banned baby sleep products in secondhand listings as you scroll. Chrome's built-in AI checks every
listing on your laptop; the cloud sees only the few it flags.

---

## The write-up

A parent scrolling eBay sees a used elephant crib bedding set for $75. In the photo, folded among the sheets, are padded
bumper panels with ties. Selling those has been against federal law since 2022, because bumpers can suffocate a baby.
The title never says "bumper", so no keyword filter catches it, and nothing on the page warns the parent.

I built Still Recalled to put that warning on the listing itself, while the parent is still scrolling. On that
listing it reads **Padded crib bumper**: Chrome's built-in model saw the panels on the laptop, and Gemini in the cloud
confirmed them.

**What it found on real listings.** I tested it three times, on November 15 and 16, 2026, on 437 used baby-gear
listings from eBay, Mercari and Craigslist that it had never seen. 52 of them were recalled products, padded crib
bumpers or infant loungers, asking $3,211 in total. Still Recalled flagged 40 of them ($2,689), with 10 false alarms
among the 365 listings that were fine. 80% of the listings never left the laptop.

### What it does
- **On eBay, Mercari and Craigslist search pages**, a badge appears on each listing that needs a look: red for a
  likely recalled product or risky sleep product, such as **Padded crib bumper**, and amber for **Possible recall**.
- **The card** shows the seller's photo beside the photo from the government recall notice, says what to check, and
  ends in an action:
  - **Ask the seller** copies a question for the one fact that settles it, usually the model number and date on the
    label, and opens eBay's message box.
  - **Report to CPSC** copies a ready report with the listing's link and opens SaferProducts.gov. CPSC asks shoppers
    who find a recalled product for sale online to report it there, and its e-commerce team has such listings taken
    down. In 13 months it sent 3,981 takedown requests for one sleeper model alone.
- **The side panel** lists every flag on the page.
- **On a phone**, the web page checks a screenshot of any listing, including Facebook Marketplace and OfferUp.

It never says "safe". No match means no recall was found.

### How the hybrid works, and why
A search page has 60 listings, and a parent scrolls through hundreds. Sending each one to the cloud would ship their
browsing to a server and cost money per look. So Chrome's built-in model looks at every baby product on the laptop,
and only what it flags goes to Gemini in the cloud, with the full recall notice.

| Step | Where it runs | What it sees | Why there |
|---|---|---|---|
| 1. Word rules | On the laptop | Every listing's title | Instant: matches 1,885 CPSC recall notices by brand, product line and model number, and drops parts, toys and doll items |
| 2. Gemini Nano, `ONLY_ON_DEVICE` | On the laptop | Baby products: title and photo | Private and free, so it can look at a whole page. It answers: is this the product, a part or a toy? Does the photo look like a lounger, a padded bumper or an inclined sleeper? |
| 3. Gemini, in the cloud | Google's servers | Only flagged listings: title, photo, the full recall notice and its photo | The notice is long and the call is close: is this the recalled model, a look-alike, or can't tell? It writes the one thing to check. |

**Measured, three ways, in three blind tests,** each on listings collected after the fixes the test before it led to:

| Same engine, run as | Caught (of 52) | False alarms (of 365) |
|---|---|---|
| Words only | 31 | 62 |
| Built-in model only | 35 | 30 |
| **Hybrid** | **40** | **10** |

The built-in model halves the word rules' false alarms by looking at the photo: pajamas named "sleeper", a dollhouse
"bassinet". The cloud, which saw 20% of the listings, catches what neither can, such as a crib set whose padded bumper
shows only in the photo, and clears what the built-in model gets wrong.

Each test changed the product. After the first two, loungers were the weak spot: 4 of 10 caught. The fixes that followed
raised that to 23 of 25 in the third test, on listings collected after the fixes. A miss costs more than a false alarm
here, so a flag the cloud can't settle stays on the page as "possible" rather than being cleared.

**Without Chrome's built-in model**, the extension uses the word rules and the cloud checks only what they flag. On the
web page the same call falls back to Gemini in the cloud, so it works on phones.

### How I used Firebase AI Logic
- **One SDK for both sides.** The extension's step 2 uses `InferenceMode.ONLY_ON_DEVICE`, so a shopper's browsing is
  never sent anywhere just to be screened. The web page uses `PREFER_ON_DEVICE`: on a laptop with Chrome's built-in
  model the screenshot is read on the device, and on a phone the identical call runs on Gemini in the cloud. The page
  reads `inferenceSource` and shows the shopper which one ran.
- **The same prompt and JSON schema on both models**, through `responseConstraint` on the device and
  `responseJsonSchema` in the cloud, so their answers can be compared field by field. That is how the table above was
  measured.
- **App Check on a Chrome extension.** Extensions have no attestation provider of their own. The extension's hidden page
  frames a small bridge page on the site, which runs reCAPTCHA Enterprise and hands App Check tokens only to this
  extension's ID. So anyone who installs it, judges included, gets the cloud check with App Check enforced.
- **Built to be judged.** The cloud side uses the Vertex AI Gemini API backend, which answered 20 calls at once in a
  load test, with a budget alert on the project. An end-to-end test runs the installed extension in a Chrome test
  profile that has the built-in model: Gemini Nano looked at 59 of 60 live eBay listings inside the extension, and the
  cloud confirmed 41 with no errors.

### Built during the submission period
I built all of Still Recalled during the submission period, starting November 14, 2026. It reuses no code. The idea
comes from SafeState, my earlier project, a gate that lets a marketplace block recalled units at resale. That only works
once a marketplace adopts it. Still Recalled works from the buyer's side, today.

### Challenges
- **The built-in model agrees too easily.** Asked "same brand?", it said yes to almost anything. So code checks the
  words (brand, model number), the model only reads and looks, and the cloud confirms.
- **Clicks inside marketplace links.** eBay follows the link around a button, and Craigslist routes clicks itself. The
  badge now sits beside the link, and the end-to-end test clicks it on live pages.
- **Photos that arrive late.** On Craigslist, the extension first read the page before its photos loaded, so most
  listings were judged by their title alone. I found it while recording the demo: the card said "the title lists" where
  it should have said "the photo shows". A listing now waits for its photo, and the rest are checked as you scroll.
- **The law differs by product type.** Inclined sleepers and padded bumpers can't be sold at any age; loungers made
  before 2025 can, though CPSC warns against them and eBay and Facebook prohibit them. Each warning states its own
  type's rule, checked against the Federal Register and CPSC, and only the first kind gets a Report to CPSC button.

### What's next
- Facebook Marketplace inside the extension.
- Recalls from before November 2021: the reviewers found bassinets, bouncers and stroller adapters from recalls in 2009,
  2015 and 2021 that the data doesn't have yet.
- The Chrome Web Store, so installing it takes one click.
- Offering the engine to resale platforms, the side SafeState covers.

### Built with
Firebase AI Logic (hybrid inference: `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, cloud), Gemini, Gemini Nano (Chrome
built-in AI), Firebase App Check with reCAPTCHA Enterprise, Firebase Hosting, Chrome Extensions MV3 (offscreen
document, side panel), CPSC Recall API, esbuild, Puppeteer.

---

## Testing instructions
- **Web page:** https://still-recalled.web.app. Click "Try it with an example photo", or add a screenshot of any listing.
  No account.
- **Extension:** download `still-recalled-extension.zip` from
  https://github.com/usv240/still-recalled/releases/latest and unzip it. Open `chrome://extensions`, turn on
  Developer mode, click "Load unpacked" and choose the folder. Then search eBay for "crib bumper" or "baby lounger" with
  Condition set to Used.
- The on-device step needs Chrome 139 or later on a computer that can run Chrome's built-in model. Without it, the
  extension still works with the word rules and the cloud check.
- **Code:** https://github.com/usv240/still-recalled (Apache 2.0). Firebase AI Logic is called in
  `extension/src/ai.js`; the pipeline is `extension/src/engine.js`.

---

# Video (1:55)

A complete draft is built by `scripts/make-video.mjs` from real footage (`scripts/record-demo.mjs`: the extension with
the built-in model on a live Craigslist search; `scripts/record-phone.mjs`: the web page at phone size), slides drawn
from the test reports, a neural voice and burned-in captions. To narrate it yourself, record over the same words; the
captions are in `still-recalled-demo.srt`.

| Time | Picture | Words |
|---|---|---|
| 0:00 | Craigslist Los Angeles, "baby lounger", the extension running | "A parent shopping Craigslist for a used baby lounger sees listings like these. Infant loungers are never safe for sleep: young babies can't lift their heads away from the soft padding, and many have been recalled. Nothing on the page says so." |
| 0:14 | Badges appear as listings are checked (3x speed) | "Still Recalled is a Chrome extension that checks every listing on the page. Chrome's built-in model, Gemini Nano, looks at each title and photo right on this laptop. Only the listings it flags go to Gemini in the cloud, through Firebase AI Logic, with the full recall notice and both photos." |
| 0:32 | A flagged lounger; the card opens | "This one is flagged as an infant lounger or nest: the built-in model saw it in the photo, and the cloud confirmed it. The card says why, and gives the shopper the one question that settles it. For products the law bans outright, like padded crib bumpers, it also copies a ready report for CPSC." |
| 0:51 | Slide: where each step runs | "Why hybrid? A search page has sixty listings, and a parent scrolls through hundreds. Screening them all in the cloud would send their browsing to a server and cost money for every look. So screening runs only on the device, and the cloud only confirms. Across three tests, 80% of listings never left the laptop." |
| 1:11 | Slide: results of the three tests | "It was tested three times, on 437 real listings it had never seen, labelled blind. Word rules alone raised 62 false alarms. The built-in model cut that to 30 by looking at the photos, and the cloud check cut it to 10, while catching 40 of the 52 listings that should be flagged." |
| 1:31 | The web page on a phone, checking the example photo in the cloud | "A phone has no built-in model, so the web page asks Firebase AI Logic to prefer the device, and the same call runs on Gemini in the cloud instead. Take a screenshot of any listing, even on Facebook Marketplace, and get the same check." |
| 1:46 | Logo, links | "It never says a product is safe: no match only means no recall was found. Still Recalled. Free, and open source." |
