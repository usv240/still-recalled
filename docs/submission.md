# Devpost submission draft

## Tagline
Flags recalled and deadly baby sleep products in secondhand listings, checked on your own computer first.

## Inspiration
A Rock 'n Play sleeper sells on Facebook Marketplace for about $25. About 100 infant deaths were reported in that one
recalled model, and selling one has been against federal law since 2022. In the 13 months to March 2023, CPSC sent
3,981 takedown requests for Rock 'n Play listings alone, most of them to Facebook Marketplace. Its own chair wrote
that it was "unlikely that we are catching every listing."

In September 2026, Consumer Reports looked for four kinds of banned or dangerous baby sleep products on eBay, Facebook
Marketplace, Mercari and Craigslist: drop-side cribs, inclined sleepers, in-bed sleepers and padded crib bumpers. It
found some of them on every site, and all four on Facebook Marketplace. In an earlier investigation it found that
sellers use generic names, such as "baby sleeper/rocker" or "bassinet", which keyword filters miss.

About two in three U.S. parents buy kids' or baby gear secondhand. Nobody warns the buyer at the moment it matters,
which is while they're scrolling the listing.

We built SafeState earlier: a gate that lets a marketplace block recalled units at resale. It only works if a
marketplace adopts it. Still Recalled is the other half: it works from the buyer's side, today, on any listing.

## What it does
- **Chrome extension.** On eBay, Mercari and Craigslist search pages, it checks every listing as you scroll and puts a
  badge on the ones that need a look: **Recalled product**, **Possible recall**, or the product type, such as
  **Infant lounger or nest** or **Padded crib bumper**.
- **The card.** Clicking a badge shows the seller's photo beside the photo from the government recall notice. It says
  what to check (usually the model number and date on the label) and gives a question you can copy to the seller.
- **The side panel** lists everything flagged on the page.
- **Web page for phones.** Add a screenshot of any listing, including Facebook Marketplace and OfferUp, and get the
  same check.
- It never says "safe". No match means no recall was found.

## How we built it: hybrid inference with a job for each side
1. **Word rules, instant, on the computer.** Every listing is matched against 1,885 CPSC recall notices (since
   November 2021) by brand, product line and model number. Parts, toys and doll furniture are dropped.
2. **Chrome's built-in model (Gemini Nano), on the computer, through Firebase AI Logic `ONLY_ON_DEVICE`.** It looks at
   the title and the photo of each baby product. Is it the product, a part or a toy? Does the photo look like a
   lounger, a padded bumper or an inclined sleeper, even when the title says "nest" or "crib set"? Nothing leaves the
   computer for this step.
3. **Gemini in the cloud, through Firebase AI Logic, only for what step 2 flagged.** It gets the full recall notice
   and both photos. It decides whether this is the recalled product or can't tell, and writes the one thing the buyer
   should check.

The web page uses the same engine, with `PREFER_ON_DEVICE`: on a computer with Chrome's built-in model it reads the
screenshot on the device, and on a phone it falls back to Gemini. Both modes take the same prompts and the same JSON
schemas, so their answers can be compared field by field. App Check protects the model quota.

**Why hybrid, measured.** We ran the same engine three ways on 136 eBay listings the rules had never seen. The labels
were made blind, without access to the pipeline's code or answers.

| | Caught (of 14) | False alarms (of 115) |
|---|---|---|
| Words only | 6 | 22 |
| On-device model only | 7 | 8 |
| Hybrid | 10 | 4 |

The on-device model cut false alarms by almost two-thirds without sending anything anywhere. The cloud, which saw
only 15% of the listings, caught 3 more, including crib sets whose padded bumper shows only in the photo, and halved
the false alarms again.

## Challenges
- **The on-device model agrees too easily.** In early tests it answered "same brand: yes" to almost anything. We
  split the work: code checks the words (brand, model number), the model only reads and looks, and the cloud
  confirms.
- **Clicks inside marketplace links.** eBay follows the link around a button, and Craigslist routes clicks with a
  capture-phase listener. The badge now sits beside the link, and the end-to-end test clicks it on live pages.
- **Craigslist changed its link format** during the build. The end-to-end test caught it.
- **The legal facts differ by product type.** Inclined sleepers and padded bumpers are banned from sale whatever
  their age. Loungers made before 2025 are not banned, but CPSC warns against them and eBay and Facebook prohibit
  them. Each warning states its own type's rule, checked against the Federal Register and CPSC.

## Accomplishments
- **It runs on live sites:** the real extension, on live eBay and Craigslist searches, 8 of 8 end-to-end steps on each.
- **A measured accuracy test** on held-out listings, with the misses and false alarms published.
- **One engine, three surfaces:** the extension on search pages, its side panel, and a phone page.

## What we learned
- On-device models are good at a narrow look ("is this a part or a toy?", "what kind of product is this?") and poor
  at judging identity. The hybrid split matters more than the model.
- Report accuracy on data you didn't tune on. Our first rules looked better on the listings we built them with.

## What's next
- Facebook Marketplace inside the extension.
- More recall years: the data currently starts in November 2021.
- A human-checked label set.
- Offering the engine to resale platforms. The other half of that already exists: SafeState.

## Built with
Firebase AI Logic (hybrid inference: `ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, cloud), Gemini, Chrome built-in AI (Gemini
Nano), Firebase App Check, Firebase Hosting, Chrome Extensions MV3 (offscreen document, side panel), CPSC Recall API,
esbuild, Puppeteer.

## Testing instructions
- **Web page:** https://still-recalled.web.app. Click "Try it with an example photo", or add any listing screenshot.
- **Extension:** download the zip from https://github.com/usv240/still-recalled/releases/latest, unzip it, open `chrome://extensions`, turn on Developer
  mode, click "Load unpacked" and choose the folder. Then search eBay for "baby lounger" with Condition set to Used.
- The on-device step needs Chrome 139 or later on hardware that supports Chrome's built-in model. Without it, the
  extension still works with the word rules and the cloud check.

---

# Video script (under 3:00)

| Time | Picture | Words |
|---|---|---|
| 0:00 | A Rock 'n Play on a Facebook Marketplace search, $25. Slow zoom on the price. | "This sleeper sells secondhand for about twenty-five dollars. About a hundred infant deaths were reported in this model. Selling one has been against federal law since 2022. It's still for sale." |
| 0:12 | Consumer Reports headline, then four marketplace logos ticking. | "This fall, Consumer Reports found banned or dangerous baby sleep products on eBay, Facebook, Mercari and Craigslist. Sellers give them generic names that filters miss." |
| 0:25 | Title card: Still Recalled. | "Still Recalled warns the buyer while they're still scrolling." |
| 0:30 | eBay search "baby lounger". Badges appear one by one. Toolbar count climbs. | "On eBay, Mercari and Craigslist, every listing is checked as you scroll. The ones that need a look get a badge." |
| 0:45 | Click a badge. The card opens: seller photo beside the recall-notice photo. | "Click it: the seller's photo beside the government recall photo, what to check on the label, and a question to send the seller." |
| 1:00 | Copy the question, then open the side panel. | "The side panel lists every flag on the page." |
| 1:10 | Diagram: words, then laptop chip, then cloud. Counter: 136 listings, 98 looked at on the laptop, 21 sent to the cloud. | "Here's the hybrid. Word rules check 1,885 recall notices instantly. Chrome's built-in model looks at every baby product on your computer. Your browsing never leaves it. Only what it flags goes to Gemini in the cloud, with the full recall notice and both photos." |
| 1:40 | The accuracy table, rows lighting up. | "We tested it on 136 listings it had never seen, labelled blind. Words alone: 22 false alarms. On-device: 8. Hybrid: 4, and it caught 10 of 14 dangerous listings. The cloud saw 15 percent of them." |
| 2:05 | A crib bedding set listing. The bumper is circled in the photo, then the badge appears. | "The cloud catches what words can't: a crib set whose padded bumper shows only in the photo." |
| 2:15 | Phone: the web page. Screenshot from Marketplace, steps tick: "Read in the cloud" on the phone, "Read on this device" on the laptop. | "On a phone, take a screenshot of any listing. The same engine reads it on your device when it can, and in the cloud when it can't. Firebase AI Logic decides." |
| 2:35 | Card: never "safe"; sources; SafeState then Still Recalled. | "It never says 'safe'. Every warning cites CPSC. We built SafeState to stop recalled sales at the marketplace. Still Recalled protects the buyer today." |
| 2:50 | Logo and URL. | "Still Recalled. Check before you buy." |
