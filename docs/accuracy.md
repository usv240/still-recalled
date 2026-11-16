# How well it works: the tests

Three tests ran on 2026-11-15 and 2026-11-16 on a Windows PC with Chrome 157 and Chrome's built-in model (Gemini
Nano). Each test set was collected after the fixes the test before it led to, so every set is new to the rules it
measures. Cloud model: Gemini through Firebase AI Logic (`gemini-4-hydrogen`, falling back to `gemini-3.5-flash-lite`
when it was busy).

Each test runs the same engine three ways (`tools/eval-test.html`, scored by `tools/eval-score.mjs`):
- **Words only:** no model at all, which is what a computer without Chrome's built-in model gets with the cloud off.
- **Built-in model only:** words, then Gemini Nano on the listings that need a look. Nothing leaves the computer.
- **Hybrid:** the same, then the cloud double-checks only what the built-in model flagged.

A listing counts as flagged at "possible" or "likely".

## Results

All three tests together: 437 listings, of which 52 must be flagged and 365 must not (20 can't be settled from the
listing alone and are left out).

| Same engine, run as | Caught (of 52) | False alarms (of 365) |
|---|---|---|
| Words only | 31 | 62 |
| Built-in model only | 35 | 30 |
| **Hybrid** | **40** | **10** |

| Test | Listings | Hybrid caught | Hybrid false alarms | Words only: false alarms |
|---|---|---|---|---|
| First: eBay, Nov 15 | 136 | 10 of 14 | 4 of 115 | 22 |
| Second, after fixes: eBay and Craigslist, Nov 15 | 125 | 2 of 4 | 0 of 117 | 16 |
| Third, after fixes: eBay, Mercari and Craigslist, Nov 16 | 176 | 28 of 34 | 6 of 133 | 24 |

- **The built-in model halves the word rules' false alarms by looking at the photo, and the cloud check cuts them to a
  sixth.** It also catches what words miss: products whose risky part shows only in the photo.
- **By kind, across the three tests:** recall matches 3 of 3; infant loungers and nests 27 of 35; padded crib bumpers
  10 of 14.
- **Loungers were the weak spot after two tests (4 of 10). The changes made after the second test raised that to 23 of
  25 in the third,** on listings collected after the changes.
- **In a shopper's units:** the listings that should be flagged were asking $3,211 in total; the hybrid flagged $2,689
  of it.
- **80% of the listings never left the computer.** The cloud saw 15%, 8% and 33% of the listings in the three tests
  (the third test's searches were mostly loungers, and every true lounger goes to the cloud to be confirmed).

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

**Found and fixed after the second test:** "plush" alone no longer marks a listing as a toy; only "plush toy",
"plush animal" or "plush doll" does. Measured in the third test.

**Outside the recall data.** The Craigslist reviewer found five Dream On Me 2-in-1 bassinet and cradle listings from a
product family CPSC recalled in 2015. The recall data starts in November 2021, so these can't be matched yet.

## 4. Changes made after the second test

These came from the lounger misses in the first two tests (4 of 10 caught):

- **Product lines named instead of the type:** "Snuggle Me Organic", "DockATot", "Snuggle Nest", "Boppy Newborn Lounger"
  and "Sleepyhead Deluxe" count as loungers, and so do a word or two between "infant" and "lounger" ("Infant Sensory
  Lounger").
- **Portable sleepers and travel beds** ("Portable Bedside Baby Sleeper", "baby pod") are not flagged on their words, but
  go to the cloud for a look at the photo: some are padded nests under another name.
- **When the words name a risky type but the built-in model calls the listing a part,** the cloud looks at the photo
  instead of the listing being cleared. A "DockATot Deluxe+ Lounger Cover" whose photo showed the whole lounger was
  cleared as a part in the first test.
- **"Plush"** no longer marks a listing as a toy (see the second test).

## 5. Third test, after the changes

**Test set.** 176 listings collected on 2026-11-16, after the changes above:
- eBay, used condition, 12 each unless noted: "infant lounger", "newborn lounger", "baby nest bed", "portable baby bed",
  "bedside sleeper", "infant sleeper", "crib bedding", "bassinet" (second page), "pack n play" (10) and "baby bouncer"
  (10). A "co sleeping bed" search was dropped: it returned camping cots and toy figurines.
- Mercari: "baby lounger" and "crib bumper" (10 each). Neither earlier test had Mercari.
- Craigslist, Houston and Seattle: "bassinet" and "crib" (10 each).

Every listing seen in an earlier set was left out. The set is `tools/third-listings.json`, built by
`tools/merge-third.mjs`.

How it was collected: eBay and Mercari were read in a normal Chrome, one search at a time, with the extension's own page
reader, and every saved row was checked against the page. Craigslist was read by `tools/collect-live.mjs` in a separate
test browser.

**Labels.** Three separate AI reviewers with the same blind brief as before: 34 must be flagged, 133 must not, 9 can't
be settled from the listing alone. The labels are in `tools/third-labels-a.json`, `-b.json` and `-c.json`.

**Where it ran.** The whole test ran in a separate Chrome test profile with the built-in model (`tools/eval-run.mjs`),
not in anyone's own Chrome. The built-in model looked at 169 listings (median 6.6 s each, including the cloud check
where there was one); 7 were settled by their wording. The cloud saw 58 (33%): these searches were mostly loungers, and
every true lounger goes to the cloud to be confirmed. One cloud check timed out.

**What happened.**

| Same engine, run as | Caught (of 34) | False alarms (of 133) |
|---|---|---|
| Words only | 24 | 24 |
| Built-in model only | 26 | 16 |
| **Hybrid** | **28** | **6** |

- **Loungers and nests: 23 of 25,** up from 4 of 10 in the first two tests. The 7 on Mercari were all caught.
- **Recall matches: 2 of 2.** A Mamibaby baby lounger (recall 24340) and an older 4moms mamaRoo swing (recall 22200).
- **Padded crib bumpers: 3 of 7.** The cloud found the bumper in the photo of three bedding sets whose titles never say
  "bumper" (a Looney Tunes set, a 13-piece jungle set whose package lists one, and a Lion King lot).
- **In a shopper's units:** the 34 listings that should be flagged were asking $1,865; the hybrid flagged $1,557 of it.

**The 6 misses.**
- Two bedding sets whose titles ("Baby Bedding ... 5 Pc Set", "Crib Baby bed Bedding") the bedding-set rule didn't
  recognise, so no model looked for a bumper.
- A bedding set whose cloud check timed out, and one where the cloud didn't see the bumper (the reviewer was unsure of
  both).
- Two LulyBoo loungers sold as a "Lounge".

**The 6 false alarms,** all at "possible":
- Three BreathableBaby mesh liners titled "crib bumper". Thin mesh liners are not padded bumpers.
- A bassinet sold as a "Snuggle Nest", and a bath seat whose title says "Newborn Lounger": both raised by the new
  lounger words. The cloud didn't confirm them, but a flag the words raise stays at "possible".
- A Magic Sleepsuit, the brand of a recalled sleepsuit; the reviewer found it is not one of the recalled ones.

**Unclear listings:** none of the 9 was flagged.

**Outside the recall data.** The reviewers named three older recalls the data doesn't have: Dream On Me 2-in-1 bassinets
(2015), BabyBjörn Babysitter Balance bouncers (2009) and UPPAbaby RumbleSeat adapters (2021).

## 6. Found and fixed after the third test (not yet measured)

- BreathableBaby, which makes only mesh liners, doesn't count as a padded bumper.
- Titles like "Baby Bedding" and "Crib ... Bedding" count as a bedding set, so the cloud looks at the photo for a bumper.
- LulyBoo and "baby lounge" go to the cloud for a look at the photo.
- A cloud check waits 40 s instead of 25 s before giving up.

These change 7 listings in the third test (the 3 mesh liners and 4 of the misses) and 1 in the second; none in the first.

## 7. Limits

- **Few positives per kind:** 52 listings must be flagged across the three tests, but only 14 are padded bumpers and 3
  are recall matches, so each one moves those rates a lot.
- **AI labels:** the labels are from AI reviewers, not yet checked by a person. `tools/label-review.html` shows every
  label with its photo for a person to confirm or change; `tools/eval-score.mjs` then uses the person's answers.
- **Two days of listings:** the sets were collected on November 15 and 16, 2026.
- **Recall data since November 2021 only:** older recalls can't be matched.

## 8. End to end, in a real browser

`tools/e2e.mjs` loads the unpacked extension into a separate Chrome profile and opens a live search. It then checks
every hand-off:

1. The extension loads.
2. The page script, the background and the hidden page where checking runs pass work between them.
3. The cloud double-check runs, with App Check tokens from the site's bridge page in the release build.
4. Badges appear on the listings.
5. The toolbar count matches the flags.
6. Clicking a badge opens it without leaving the page.
7. The card offers the next step ("Ask the seller", and "Report to CPSC" on likely flags the law rules out).

8. With the built-in model (`--profile`): Gemini Nano runs inside the installed extension.

A fresh profile has no built-in model, so those runs use the words-and-cloud path. `tools/nano-profile.mjs` makes a
separate test profile into which Chrome downloads its built-in model itself (about 4 GB), so the extension's on-device
step can be tested without anyone's own Chrome.

| Site | Build | Listings checked | Flagged | Result |
|---|---|---|---|---|
| eBay, "crib bedding set" | release 0.5.0, 2026-11-16 | 63 in 148 s, 61 confirmed in the cloud, 0 errors | 21 | 10 of 10 steps pass |
| Craigslist Seattle, "baby lounger", with the built-in model | release 0.5.0, 2026-11-16 | the 8 listings near the screen: 5 looked at by Gemini Nano, 3 confirmed in the cloud | 3 | 11 of 11 steps pass |
| Craigslist Chicago, "bassinet" | release 0.5.0, 2026-11-16 | the 12 listings near the screen, 3 confirmed in the cloud, 0 errors | 3 | 10 of 10 steps pass |
| eBay, "baby lounger", with the built-in model | release, 2026-11-16 | 60 in 468 s: 59 looked at by Gemini Nano in the extension, 41 confirmed in the cloud, 0 errors | 39 | 11 of 11 steps pass |
| eBay, "crib bedding set" | release, 2026-11-16 | 63 in 121 s, 58 confirmed in the cloud, 0 errors | 18 | 10 of 10 steps pass |
| Craigslist Los Angeles, "bassinet" | release, 2026-11-16 | 72 in 30 s, 15 confirmed in the cloud, 0 errors | 15 | 10 of 10 steps pass |
| eBay, "crib bedding set" | release | 70 in 197 s, 60 confirmed in the cloud | 26 | 10 of 10 steps pass |
| eBay, "baby lounger" | release | 60 in 121 s | 36 | 9 of 9 steps pass (before step 7 existed) |
| Craigslist SF Bay, "baby bassinet" | development | 151 in 75 s | 9 | 8 of 8 steps pass (before steps 3 and 7 existed) |
| Mercari, "baby lounger" | | not run | | Mercari serves no results to an automated browser |

On Mercari, the page reader was checked in a normal Chrome instead: it found all 30 listings, every one with a photo
and a price.

**Found on live pages on 2026-11-16, and fixed in 0.5.0:**
- **Craigslist photos.** Craigslist draws its photos after its listings and loads them as they near the screen. The
  extension read the page at once, so 14 of 15 listings were checked without a photo, by their title alone. A listing
  now waits for its photo, or until it has been near the screen for 2.5 s without one, and listings further down are
  checked as the shopper scrolls to them. Afterwards, the listings near the screen had their photos, and the card said
  "the title and photo show" where it had said "the title lists". The accuracy tests were not affected: they pass each
  listing's photo in directly.
- **Badges over Craigslist's header.** Craigslist scrolls its results under a fixed header, and the badges were drawn on
  top of it. They now sit just above the listing photo, and the card opens in the browser's top layer.
- **Badge over the price.** Craigslist prints the price in the photo's top-left corner; there the badge now takes the
  top-right one.

## Reproduce

```
npm install && npm run build
node tools/collector.mjs                    # local test server on :8766
# in Chrome with the built-in model: open http://localhost:8766/tools/eval-test.html, then in the console:
#   await __eval({ mode: 'words' }); await __eval({ mode: 'hybrid' })                       first test
#   await __eval({ mode: 'words', set: 'fresh' }); await __eval({ mode: 'hybrid', set: 'fresh' })   second test
# or, in a separate test profile with the built-in model (made once by node tools/nano-profile.mjs):
node tools/eval-run.mjs --set=third --mode=words && node tools/eval-run.mjs --set=third --mode=hybrid
node tools/eval-score.mjs                   # or --set=fresh, --set=third
npm run e2e -- "crib bedding set"           # or --url=<a Craigslist or Mercari search>
```
