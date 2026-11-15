# How well it works: the tests

Run on 2026-11-15 on a Windows PC with Chrome 157 and Chrome's built-in model (Gemini Nano). Cloud model: Gemini through
Firebase AI Logic (`gemini-4-hydrogen`, falling back to `gemini-3.5-flash-lite` when it was busy).

## 1. Accuracy on listings the rules had never seen

**Test set.** 136 used-condition eBay listings from 18 searches (baby nest sleeper, crib bedding set, bumper pads crib,
inclined sleeper baby, baby lounger, drop side crib, baby swing, high chair, pack n play, kids dresser, pressure
cooker, space heater and others), collected on 2026-11-15 after the rules were written. Eight listings that also
appeared in the development set were removed. The test set is `tools/eval-listings.json`.

**Labels.** A separate AI reviewer (Claude) labelled every listing from what a shopper sees: the title, the price and
one photo, checked against the 1,885 CPSC recall notices in `extension/data/cards.json`. It worked blind: it was not
allowed to read the pipeline's code, prompts or answers. Labels: 14 listings must be flagged, 115 must not, and 7 can't
be settled from the listing alone. The labels are in `tools/eval-labels.json`, with the visible evidence for each one.
They have not yet been checked by a person.

**Three ways of running the same engine** (`tools/eval-test.html`, scored by `tools/eval-score.mjs`):

| | Caught (of 14) | Missed | False alarms (of 115) | Flags that were right |
|---|---|---|---|---|
| Words only (no model) | 6 | 8 | 22 | 21% |
| On-device model only | 7 | 7 | 8 | 47% |
| **Hybrid: on-device, then cloud on what it flags** | **10** | **4** | **4** | **71%** |

**What the cloud saw.** 21 of the 136 listings (15%). The built-in model looked at 98 listings on the computer (median
9.7 s each). The other 38 were settled by their wording and never needed a model. No cloud call failed.

**What each part adds.**
- **The built-in model** cuts false alarms from 22 to 8, by looking at the photo. For example, it saw that "Fisher-Price
  sleeper" listings were pajamas and that a "bassinet" was a dollhouse toy. Nothing leaves the computer for this step.
- **The cloud** sees the full recall notice and both photos. It checked 21 listings:
  - It confirmed 7 true flags and raised them from "possible" to "likely".
  - It caught 3 crib bedding sets whose padded bumpers appear only in the photo. The word rules had only marked
    these sets for a closer look, and the built-in model had missed the bumpers.
  - It cleared 6 false alarms: five bedding sets that turned out to have no bumper, and a Newton bassinet.
  - It lowered the three sewing patterns from "likely" to "possible", but did not clear them.
  - It kept the hospital crib at "likely".
  - Overall, false alarms fell from 8 to 4 and catches rose from 7 to 10.

**The 4 misses.**
- A Baby Delight Snuggle Nest sold as a "Portable Infant Sleeper".
- An "Abreeze Portable Bedside Baby Sleeper" whose photo is a padded nest.
- Two listings titled as a "cover" whose photos show the whole lounger.

**The 4 false alarms.**
- Three sewing patterns for crib bumpers.
- One hospital crib with drop-side rails.

**Limits.**
- Only 14 positives, so each one moves the catch rate by 7 points.
- One labeller, and it is an AI.
- All listings are from eBay, from one day of searches.
- 15 photos had a `~` in their address, which the local test server mishandled. Those listings may have been judged
  without their photo, which could only hurt the scores.

## 2. Changes made after the test

These fixes were made because the test above and the end-to-end runs exposed the errors. They are not reflected in
the numbers above. A fresh set of listings is needed to measure them.

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

## 3. End to end, in a real browser

`tools/e2e.mjs` loads the unpacked extension into a separate Chrome profile and opens a live search. It then checks
every hand-off:

1. The extension loads.
2. The page script, the background and the hidden page where checking runs pass work between them.
3. Badges appear on the listings.
4. The toolbar count matches the flags.
5. Clicking a badge opens it without leaving the page.

A fresh profile has no built-in model, so these runs use the words-and-cloud path.

| Site | Listings checked | Flagged | Result |
|---|---|---|---|
| eBay, "baby lounger" | 60 in 142 s | 37 | 8 of 8 steps pass |
| Craigslist SF Bay, "baby bassinet" | 151 in 75 s | 9 | 8 of 8 steps pass, after the two Craigslist fixes above |
| Mercari, "baby lounger" | not run | | Mercari serves no results to an automated browser |

On Mercari, the page reader was checked in a normal Chrome instead: it found all 30 listings, every one with a photo
and a price.

## Reproduce

```
npm install && npm run build
node tools/collector.mjs                    # local test server on :8766
# in Chrome with the built-in model: open http://localhost:8766/tools/eval-test.html, then in the console:
#   await __eval({ mode: 'words' }); await __eval({ mode: 'hybrid' })
npm run eval:score
npm run e2e -- "baby lounger"               # or --url=<a Craigslist or Mercari search>
```
