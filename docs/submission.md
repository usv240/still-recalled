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

**What it found on real listings.** On November 15, 2026, I ran it on 136 used baby-gear listings from 18 eBay
searches. 6 were crib sets with padded bumpers and 8 were infant loungers or in-bed sleepers, asking $908 in total.
Still Recalled flagged all 6 bumper sets ($517) and 4 of the 8 loungers, with 4 false alarms among the 115 listings
that were fine. 85% of the listings never left the laptop. In a second test after fixes, on 125 new listings from eBay and from Craigslist in Los Angeles and Chicago, it raised no false alarms at all and again flagged every padded bumper and recall match.

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

**Measured, three ways, on listings the rules had never seen**, labelled blind:

| Same engine, run as | First test: caught (of 14) | False alarms (of 115) | Second test: caught (of 4) | False alarms (of 117) |
|---|---|---|---|---|
| Words only | 6 | 22 | 1 | 16 |
| Built-in model only | 7 | 8 | 2 | 6 |
| **Hybrid** | **10** | **4** | **2** | **0** |

The built-in model removes most of the word rules' false alarms by looking at the photo: pajamas named "sleeper", a
dollhouse "bassinet". The cloud, which saw 15% of the listings in the first test and 8% in the second, catches what
neither can, such as a crib set whose padded bumper shows only in the photo, and clears what the built-in model gets wrong: in the second test
it cleared all six of its false alarms.

Across both tests it flagged every padded bumper and every recall match, 8 of 8. Loungers and positioners are the hard
case, 4 of 10: the six it missed were listed as a cover, a pillow or a portable sleeper. A miss costs more than a false
alarm here, so a flag the cloud can't settle stays on the page as "possible" rather than being cleared.

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

### Built during the submission period
I built all of Still Recalled during the submission period, starting November 14, 2026. It reuses no code. The idea
comes from SafeState, my earlier project, a gate that lets a marketplace block recalled units at resale. That only works
once a marketplace adopts it. Still Recalled works from the buyer's side, today.

### Challenges
- **The built-in model agrees too easily.** Asked "same brand?", it said yes to almost anything. So code checks the
  words (brand, model number), the model only reads and looks, and the cloud confirms.
- **Clicks inside marketplace links.** eBay follows the link around a button, and Craigslist routes clicks itself. The
  badge now sits beside the link, and the end-to-end test clicks it on live pages.
- **The law differs by product type.** Inclined sleepers and padded bumpers can't be sold at any age; loungers made
  before 2025 can, though CPSC warns against them and eBay and Facebook prohibit them. Each warning states its own
  type's rule, checked against the Federal Register and CPSC, and only the first kind gets a Report to CPSC button.

### What's next
- Facebook Marketplace inside the extension.
- Recalls from before November 2021: the second test found five Craigslist bassinets from a product family CPSC recalled
  in 2015.
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

# Video script (under 3:00)

| Time | Picture | Words |
|---|---|---|
| 0:00 | eBay search "crib bedding set", Used. A real listing: a used elephant crib bedding set, $75. Slow zoom to the bumper in the photo. | "I'm shopping for a used crib set. This one is $75. Look at the photo: a padded bumper. Selling one has been against federal law since 2022, because bumpers can suffocate a baby. Nothing on the page says so." |
| 0:15 | The badge appears on that listing: **Padded crib bumper**. | "Still Recalled says so, right on the listing." |
| 0:20 | Click the badge. The card: seller's photo, the rule, Ask the seller, Report to CPSC. | "It shows why, what to ask the seller, and a ready report to CPSC, which takes these listings down." |
| 0:35 | Click Report to CPSC: SaferProducts.gov opens; paste the report. | "One click copies the report with the listing's link." |
| 0:45 | Scroll the page: badges appear one by one; the toolbar count climbs; open the side panel. | "It checks every listing on eBay, Mercari and Craigslist as I scroll." |
| 0:55 | Diagram: laptop chip, then cloud. Counters from the first test: 136 listings, 98 looked at on the laptop, 21 sent to the cloud. | "Here's the hybrid, all through Firebase AI Logic. Chrome's built-in Gemini Nano looks at every baby product on my laptop: title and photo, nothing leaves. Only what it flags goes to Gemini in the cloud, with the full recall notice." |
| 1:25 | The results chart (gallery image 2), rows lighting up. | "I tested it on 136 eBay listings it had never seen. Words alone raised 22 false alarms; the hybrid, 4. It caught all six crib sets with padded bumpers. After fixes, a second test on 125 new listings from eBay and Craigslist: no false alarms at all." |
| 1:50 | A recall match: seller photo beside the CPSC notice photo. | "For recalls, it puts the seller's photo beside the government's, and asks the seller for the model number that settles it." |
| 2:05 | Phone: the web page. A Facebook Marketplace screenshot; steps tick: "Read in the cloud". Same on the laptop: "Read on this device". | "On a phone, take a screenshot of any listing, even Facebook Marketplace. The same code reads it on the device when it can, and in the cloud when it can't." |
| 2:30 | "Never says safe." CPSC sources. | "It never says 'safe'. Every warning cites CPSC." |
| 2:40 | Logo, URL, "Free. Open source." | "Still Recalled. Check before you buy." |
