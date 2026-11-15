# How well it works: the tests

Both tests ran on 2026-11-15 on a Windows PC with Chrome 157 and Chrome's built-in model (Gemini Nano). Cloud model:
Gemini through Firebase AI Logic (`gemini-4-hydrogen`, falling back to `gemini-3.5-flash-lite` when it was busy).

Each test runs the same engine three ways (`tools/eval-test.html`, scored by `tools/eval-score.mjs`):
- **Words only:** no model at all, which is what a computer without Chrome's built-in model gets with the cloud off.
- **Built-in model only:** words, then Gemini Nano on the listings that need a look. Nothing leaves the computer.
- **Hybrid:** the same, then the cloud double-checks only what the built-in model flagged.

A listing counts as flagged at "possible" or "likely".

## Results

| Same engine, run as | First test: caught (of 14) | False alarms (of 115) | Second test: caught (of 4) | False alarms (of 117) |
|---|---|---|---|---|
| Words only | 6 | 22 | 1 | 16 |
| Built-in model only | 7 | 8 | 2 | 6 |
| **Hybrid** | **10** | **4** | **2** | **0** |

- **Across both tests, it flagged every padded bumper and every recall match: 8 of 8.**
- **Loungers and positioners are the hard case: 4 of 10.** The six misses were listed as a cover, a pillow or a
  portable sleeper.
- **In a shopper's units (first test):** the 14 listings that should be flagged were asking $908 in total. The hybrid
  flagged $756 of it, including all six crib sets with padded bumpers ($517).
- **The cloud saw 15% of the listings in the first test and 8% in the second.** No cloud call failed in either.

## 1. First test

**Test set.** 136 used-condition eBay listings from 18 searches (baby nest sleeper, crib bedding set, bumper pads crib,
inclined sleeper baby, baby lounger, drop side crib, baby swing, high chair, pack n play, kids dresser, pressure
cooker, space heater and others), collected on 2026-11-15 after the rules were written. Eight listings that also
appeared in the development set were removed. The set is `tools/eval-listings.json`.

**Labels.** A separate AI reviewer (Claude) labelled every listing from what a shopper sees: the title, the price and
one photo, checked against the 1,885 CPSC recall notices in `extension/data/cards.json`. It worked blind: it was not
allowed to read the pipeline's code, prompts or answers. Labels: 14 listings must be flagged, 115 must not, and 7 can't
be settled from the listing alone. The labels are in `tools/eval-labels.json`, with the visible evidence for each one.

**What the cloud saw.** 21 of the 136 listings. The built-in model looked at 98 listings on the computer (median
9.7 s each, including the cloud check where there was one). The other 38 were settled by their wording and never needed a model.

**What each part adds.**
- **The built-in model** cuts false alarms from 22 to 8 by looking at the photo. For example, it saw that "Fisher-Price
  sleeper" listings were pajamas and that a "bassinet" was a dollhouse toy.
- **The cloud** sees the full recall notice and both photos. It checked 21 listings:
  - It confirmed 7 true flags and raised them from "possible" to "likely".
  - It caught 3 crib bedding sets whose padded bumpers appear only in the photo. The word rules had only marked
    these sets for a closer look, and the built-in model had missed the bumpers.
  - It cleared 6 false alarms: five bedding sets that turned out to have no bumper, and a Newton bassinet.
  - It lowered three sewing patterns from "likely" to "possible" but did not clear them, and kept a hospital crib
    at "likely".

**The 4 misses.** A Baby Delight Snuggle Nest sold as a "Portable Infant Sleeper"; an "Abreeze Portable Bedside Baby
Sleeper" whose photo is a padded nest; two listings titled as a "cover" whose photos show the whole lounger.

**The 4 false alarms.** Three sewing patterns for crib bumpers, and one hospital crib with drop-side rails.

## 2. Changes made after the first test

These fixes came from the first test and from end-to-end runs on live pages:

- **Sewing patterns** ("Simplicity 3795 … Bumper Pad Pattern") are treated like doll items and never flagged.
- **Hospital and medical cribs** don't count as drop-side cribs.
- **Everyday words no longer count as a product-line name without the brand.** A Craigslist "Bedside
  Sleeper/Bassinet" had matched the "Papablic Bedside Sleepers" recall as the same line.
- **Craigslist's 2026 link format** (`/view/d/<name>/<code>`) is read. Before this, no Craigslist listing was found.
- **Badges sit beside a listing's link, not inside it.** On Craigslist, clicking a badge inside the link opened the
  listing.
- **Mercari titles** no longer carry the price or a discount ("Baby Lounger$25.00").
- **A built-in model call that doesn't answer within 45 s** is abandoned for that listing. The listing falls back to
  its words, so one stuck call can't stall a page.

## 3. Second test, after the changes

**Test set.** 125 listings collected on 2026-11-15 after the changes above, the first ones a shopper sees:
- eBay, used condition: "bassinet" and "baby sleeper" (16 each); "rock n play", "crib bumper", "baby lounger", "baby
  nest", "crib", "co sleeper" and "stroller" (12 each).
- Craigslist, Los Angeles and Chicago: "bassinet" and "crib" (10 each).

Every listing that was in the first test or the development set was removed, which removed most of the "crib bumper"
and "baby lounger" results. That is why this set has only 4 listings that must be flagged: it mostly measures false
alarms. The set is `tools/fresh-listings.json`.

How it was collected: `tools/collect-live.mjs` read the first searches with the extension's own page reader in a
separate test browser. eBay answers an automated browser with an error page after a search or two, so the remaining
eBay searches were read in a normal Chrome, one at a time, with the same page reader.

**Labels.** Two separate AI reviewers, one for eBay and one for Craigslist, with the same blind brief as the first
test: 4 must be flagged, 117 must not, 4 can't be settled from the listing alone. The labels are in
`tools/fresh-labels-ebay.json` and `tools/fresh-labels-craigslist.json`.

**What happened.**
- **The cloud saw 10 of the 125 listings (8%).** The built-in model looked at 103 (median 11.1 s each, including the cloud check where there was one); 22 were settled
  by their wording.
- **The cloud cleared all six of the built-in model's false alarms:** two Mattel "Heart Family Rock'n Play" doll
  nursery sets, an UPPAbaby VISTA stroller (the UPPAbaby recall is for the RIDGE), and three cribs whose sides are fixed.
- **Caught:** a padded crib headboard bumper, flagged "likely", and a Mockingbird Single-to-Double stroller, flagged
  "possible" with the right reason: it matches the recalled line, but the listing doesn't show the lot number.
- **Missed:** a Snuggle Me lounger, which the word rules dropped as a toy because its title said "Plush Pink"; and a
  foam crib wedge, which the built-in model looked at and cleared.
- **Unclear listings:** none of the 4 was flagged.
- **Three built-in model calls timed out** at 45 s and fell back to the words. No cloud call failed.

**Found and fixed after the second test (not yet measured):** "plush" alone no longer marks a listing as a toy; only
"plush toy", "plush animal" or "plush doll" does.

**Outside the recall data.** The Craigslist reviewer found five Dream On Me 2-in-1 bassinet and cradle listings from a
product family CPSC recalled in 2015. The recall data starts in November 2021, so these can't be matched yet.

## 4. Limits

- **Few positives:** 14 in the first test and 4 in the second, so each one moves a catch rate by 7 or 25 points.
- **AI labels:** the labels are from AI reviewers, not yet checked by a person. `tools/label-review.html` shows every
  label with its photo for a person to confirm or change; `tools/eval-score.mjs` then uses the person's answers.
- **One day of listings:** both sets were collected on one day.
- **Recall data since November 2021 only:** older recalls can't be matched.

## 5. End to end, in a real browser

`tools/e2e.mjs` loads the unpacked extension into a separate Chrome profile and opens a live search. It then checks
every hand-off:

1. The extension loads.
2. The page script, the background and the hidden page where checking runs pass work between them.
3. The cloud double-check runs, with App Check tokens from the site's bridge page in the release build.
4. Badges appear on the listings.
5. The toolbar count matches the flags.
6. Clicking a badge opens it without leaving the page.
7. The card offers the next step ("Ask the seller", and "Report to CPSC" on likely flags the law rules out).

A fresh profile has no built-in model, so these runs use the words-and-cloud path.

| Site | Build | Listings checked | Flagged | Result |
|---|---|---|---|---|
| eBay, "crib bedding set" | release | 70 in 197 s, 60 confirmed in the cloud | 26 | 10 of 10 steps pass |
| eBay, "baby lounger" | release | 60 in 121 s | 36 | 9 of 9 steps pass (before step 7 existed) |
| Craigslist SF Bay, "baby bassinet" | development | 151 in 75 s | 9 | 8 of 8 steps pass (before steps 3 and 7 existed) |
| Mercari, "baby lounger" | | not run | | Mercari serves no results to an automated browser |

On Mercari, the page reader was checked in a normal Chrome instead: it found all 30 listings, every one with a photo
and a price.

## Reproduce

```
npm install && npm run build
node tools/collector.mjs                    # local test server on :8766
# in Chrome with the built-in model: open http://localhost:8766/tools/eval-test.html, then in the console:
#   await __eval({ mode: 'words' }); await __eval({ mode: 'hybrid' })                       first test
#   await __eval({ mode: 'words', set: 'fresh' }); await __eval({ mode: 'hybrid', set: 'fresh' })   second test
node tools/eval-score.mjs                   # or --set=fresh
npm run e2e -- "crib bedding set"           # or --url=<a Craigslist or Mercari search>
```
