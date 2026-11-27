# How well it works: the tests

Five tests ran on 2026-11-15, 16, 18 and 20 on a Windows PC with Chrome 157 and Chrome's built-in model (Gemini
Nano). Each test set was collected after the fixes the test before it led to, so every set is new to the rules it
measures. The labels are by AI reviewers working blind; a person has not yet checked them. Cloud model: Gemini through Firebase AI Logic (`gemini-4-hydrogen`, falling back to `gemini-3.5-flash-lite`
when it was busy).

Each test runs the same engine three ways (`tools/eval-test.html`, scored by `tools/eval-score.mjs`):
- **Words only:** no model at all, which is what a computer without Chrome's built-in model gets with the cloud off.
- **Built-in model only:** words, then Gemini Nano on the listings that need a look. Nothing leaves the computer.
- **Hybrid:** the same, then the cloud double-checks only what the built-in model flagged.

A listing counts as flagged at "possible" or "likely".

## Results

All five tests together: 775 listings, of which 83 must be flagged and 630 must not (62 can't be settled from the
listing alone and are left out).

| Same engine, run as | Caught (of 83) | False alarms (of 630) |
|---|---|---|
| Words only | 47 | 109 |
| Built-in model only | 51 | 64 |
| **Hybrid** | **65** | **12** |

The first four tests alone (597 listings, 74 to flag, 481 not), as earlier versions of this page reported them:

| Same engine, run as | Caught (of 74) | False alarms (of 481) |
|---|---|---|
| Words only | 43 | 86 |
| Built-in model only | 47 | 50 |
| **Hybrid** | **58** | **11** |

| Test | Listings | Hybrid caught | Hybrid false alarms | Words only: false alarms |
|---|---|---|---|---|
| First: eBay, Nov 15 | 136 | 10 of 14 | 4 of 115 | 22 |
| Second, after fixes: eBay and Craigslist, Nov 15 | 125 | 2 of 4 | 0 of 117 | 16 |
| Third, after fixes: eBay, Mercari and Craigslist, Nov 16 | 176 | 28 of 34 | 6 of 133 | 24 |
| Fourth, every recall since 1973: eBay and Craigslist, Nov 18 | 160 | 18 of 22 | 1 of 116 | 24 |
| Fifth, on release 0.12.0, plain searches: eBay and Craigslist, Nov 20 | 178 | 7 of 9 | 1 of 149 | 23 |

- **The built-in model cuts the word rules' false alarms by looking at the photo, and the cloud check cuts them to an
  eighth.** It also catches what words miss: products whose risky part shows only in the photo.
- **By kind, across the five tests:** recall matches 7 of 9; infant loungers and nests 39 of 49; padded crib bumpers
  19 of 24; inclined sleepers 0 of 1 (a Rock 'n Play listed only as "Baby Rocker"; section 19).
- **Each test changed the product.** Loungers were the weak spot after two tests (4 of 10); the changes that followed
  raised that to 23 of 25 in the third and 8 of 9 in the fourth. The fourth test was the first with every recall since
  1973, and two of its three recall catches were recalls the earlier data didn't have.
- **In a shopper's units:** the listings that should be flagged were asking $6,063 in total; the hybrid flagged $5,022
  of it.
- **77% of the listings never left the computer.** The cloud saw 15%, 8%, 33%, 32% and 21% of the listings in the five
  tests (the third and fourth searched mostly for loungers, recalled brands and old gear, which go to the cloud to be
  confirmed).
- **The fifth test is the one closest to the released engine.** Each earlier test ran on the engine of its day, and
  its misses were then used to change the engine. The fifth was labelled after 0.12.0's decision rules were finished;
  what came after it, and what weakens it, is in sections 19 and 20.

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
8.0 s each, including the cloud check where there was one). The other 38 were settled by their wording and never needed a model.

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
separate test browser. After a search or two eBay stopped serving results to the test browser, so the remaining eBay
searches were opened by hand in a normal Chrome, one at a time, and read with the same page reader. No site's limits
were worked around: each page was one a shopper would open.

**Labels.** Two separate AI reviewers, one for eBay and one for Craigslist, with the same blind brief as the first
test: 4 must be flagged, 117 must not, 4 can't be settled from the listing alone. The labels are in
`tools/fresh-labels-ebay.json` and `tools/fresh-labels-craigslist.json`.

**What happened.**
- **The cloud saw 10 of the 125 listings (8%).** The built-in model looked at 103 (median 10.4 s each, including the cloud check where there was one); 22 were settled
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
product family CPSC recalled in 2015. The recall data then started in November 2021, so these couldn't be matched; see
section 7.

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

## 6. Changes made after the third test

- BreathableBaby, which makes only mesh liners, doesn't count as a padded bumper.
- Titles like "Baby Bedding" and "Crib ... Bedding" count as a bedding set, so the cloud looks at the photo for a bumper.
- LulyBoo and "baby lounge" go to the cloud for a look at the photo.
- A cloud check waits 40 s instead of 25 s before giving up.

These change 7 listings in the third test (the 3 mesh liners and 4 of the misses) and 1 in the second; none in the first.

## 7. Every recall since 1973

**Why.** Secondhand gear is old. The first three tests used the recalls of the last five years (1,885 notices), and
the reviewers named 19 of their 437 listings that might fall under an older recall the data didn't have: Arm's Reach
co-sleepers (2011), Dream On Me 2-in-1 bassinets (2015), Graco swings (2000), BabyBjörn bouncers (2009), the 2015
UPPAbaby VISTA and CRUZ strollers. Only 3 listings matched a recall the data did have. The 2019 Rock 'n Play recall
itself was outside the window.

**What changed.**
- **All 10,089 CPSC recall notices since 1973** are in the extension and the web page.
- **The cloud writes a spotter card for each, once.** At build time, Gemini read every notice through Firebase AI Logic
  and wrote: the brand a seller would type, the product lines, the kind of product and its other names, the model
  numbers, the years the recalled units were sold, whether every unit is recalled, and one sentence on how to tell a
  recalled unit (`data/spotter.jsonl`, `scripts/build-spotter.mjs`). Before, the brand was guessed from the notice's
  title by code, and an old rattle maker came out as the brand "toy".
- **Stricter matching, because five times the recalls means five times the chances of a false match.** A one-word
  brand that is a kind of product elsewhere ("stand", "mattress") is dropped. Brand plus kind alone matches only a
  recall of every unit; a recall of certain models needs the model or the line. A listing that states a year outside
  the years sold doesn't match on brand alone. "2-1", "2 in 1" and "2-in-1" read the same.
- **The built-in model is shown the card's "which units" line** and asked whether the listing names a model or year it
  covers. Its answer is recorded next to the cloud's, and not yet acted on (see the fourth test).

**Before any model runs.** On the 437 listings of the first three tests, with the word rules alone
(`tools/cards-compare.mjs`): 44 listings got a recall candidate, against 47 before; 34 got a different or new one,
including the Dream On Me 2-in-1 bassinet (2015), the 2015 UPPAbaby VISTA and CRUZ, and the Graco infant swings (2000);
22 lost one, mostly false ones (a DeWalt heater recall on Pelonis heaters, a snow-bike kit on crib conversion kits).
These listings were seen while the rules were written, so the measure that counts is the fourth test.

## 8. Fourth test, with every recall since 1973

**Test set.** 160 listings collected on 2026-11-18, after every change above:
- eBay, used condition, 10 each: "graco baby swing", "fisher price infant swing", "vintage baby crib", "baby stroller",
  "baby walker", "high chair baby", "play yard playpen", "crib bumper pads", "nursery bedding set", "rock n play
  sleeper", "baby bassinet" (third page), "baby lounger nest" (second page). Brand searches and old gear on purpose:
  that is where older recalls live.
- Craigslist, Denver and Atlanta: "crib" and "baby swing" (10 each).

Every listing seen in an earlier set was left out (`tools/fourth-listings.json`, built by `tools/merge-set.mjs`).

**Labels.** Three separate AI reviewers with the same blind brief, now checking each listing against all 10,089 raw
CPSC recall records since 1973 (not the product's cards): 22 must be flagged, 116 must not, 22 can't be settled from
the listing alone (`tools/fourth-labels-a.json`, `-b.json`, `-c.json`).

**What happened.**

| Same engine, run as | Caught (of 22) | False alarms (of 116) |
|---|---|---|
| Words only | 12 | 24 |
| Built-in model only | 12 | 20 |
| **Hybrid** | **18** | **1** |

- **By kind:** infant loungers and nests 8 of 9; padded crib bumpers 7 of 8; recall matches 3 of 5.
- **Older recalls, now matched.** Two of the three recall catches came from recalls the old five-year data didn't
  have: a 1995 Graco Open Top swing and a Graco Swyngomatic, both under Graco's 2000 recall of swings made before
  November 1997 (00098). The third was a Jool Baby Nova swing (24145, 2024).
- **In a shopper's units:** the 22 listings that should be flagged were asking $2,316; the hybrid flagged $1,851.
- **Where it ran:** the built-in model looked at 124 listings (median 5.8 s each, including the cloud check where
  there was one); 36 were settled by their wording. The cloud saw 51 (32%). No cloud call failed.
- **Unclear listings:** 5 of the 22 were flagged "possible": a Maclaren stroller (a recall of all units sold before
  2009), a vintage Century playpen, a Graco high chair, a Fisher-Price swing and a Jool Baby Nova swing. Each is the
  same brand and kind as a recall, with the model or date not shown.

**The 4 misses.**
- A replacement seat pad for the Fisher-Price My Little Snugapuppy Cradle 'n Swing (model X7345). The 2024 recall
  tells owners to remove and destroy exactly this pad, so the reviewer counted it; the word rules treat replacement
  parts as not the product.
- A classic 4moms MamaRoo titled only "4MOMS baby swing": the recall covers the 3-point-harness versions, and the
  title gives no line or model for the word rules to match.
- A Mickey Mouse bedding lot with padded bumpers in the photo, and a quilted MOONSEA nest pad.

**The 1 false alarm:** a new UPPAbaby 4moms MamaRoo with a 5-point harness, which the MamaRoo recall excludes; it was
flagged "possible", not "likely".

**What the built-in model made of "which units".** On the 26 listings with a recall candidate, the built-in model was
asked whether the listing names a model or year the card's "which units" line covers. It said "yes" 20 times; the
cloud, reading the full notice, said "yes" once and "no" 16 times. Of the 20, the cloud agreed once. The built-in model agrees too easily, as it did with
brands in the first week. So its answer is recorded and not used: the cloud decides which units, and the spotter cards
help the device by naming brands, lines and years for the code to check.

**All four tests together:** 597 listings, of which 74 must be flagged and 481 must not.

| Same engine, run as | Caught (of 74) | False alarms (of 481) |
|---|---|---|
| Words only | 43 | 86 |
| Built-in model only | 47 | 50 |
| **Hybrid** | **58** | **11** |

## 9. Settling a possible recall with the label

A "possible recall" means the listing doesn't show the model number or date. The card now takes a photo of the label.
The built-in model reads it (Firebase AI Logic hybrid inference, so the photo stays on the computer) and code compares
the reading with the recall card's model numbers and years (`shared/label.mjs`).

**The rule: the device can raise the alarm, not clear it.** A reading that matches a recalled model stands. Any other
reading, which would reassure the shopper, is read again by Gemini in the cloud, and the cloud's reading decides.

**Test.** 12 label close-ups from CPSC recall notices (strollers, cribs, a swing, a gate, a heater, a mattress), each
judged against its own recall, where the answer should be "recalled", and against another recall of the same kind,
where it should not (`tools/label-test.html`, `tools/label-run.mjs`, in the test profile with the built-in model).

| Read by | Recalled model found | Couldn't read | Wrong answer |
|---|---|---|---|
| Built-in model alone (first run) | 6 of 12 | 4 | 2: one misread model ("S16578" for "615573"), one partly read |
| **Built-in model, cloud before reassuring** | **8 of 12** | 4 | **0** |
| Cloud alone | 7 of 12 | 5 | 0 |

Against the other recall, no label was ever matched. The 4 unreadable photos show where a label is, not its print.
The device read 6 labels alone, and the cloud was asked about the other 6.

## 10. Limits

- **Few positives per kind:** only a few listings per test are padded bumpers or recall matches, so each one moves
  those rates a lot.
- **AI labels:** the labels are from AI reviewers, not yet checked by a person. `tools/label-review.html` shows every
  label with its photo for a person to confirm or change; `tools/eval-score.mjs` then uses the person's answers.
- **Three days of listings:** the sets were collected on November 15, 16 and 18, 2026.
- **Label photos from notices:** the label check was tested on CPSC's own label photos, which are sharper than a
  seller's phone photo.

## 11. End to end, in a real browser

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
| eBay, "crib bedding set" | release 0.6.0, 2026-11-18 | 70 in 145 s, 63 confirmed in the cloud, 0 errors | 16 | 10 of 10 steps pass |
| Craigslist Seattle, "baby lounger", with the built-in model | release 0.6.0, 2026-11-18 | the 8 near the screen: 5 looked at by Gemini Nano, 4 confirmed in the cloud | 4 | 11 of 11 steps pass |
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

**Found on live pages on 2026-11-18, and fixed in 0.6.0:**
- **eBay's new photo carousel.** eBay's search results gained a photo carousel, and a badge inside it could no longer
  be opened: the page's own click handlers ran first. The badge now sits on the listing's row, over the same corner of
  the photo, and the card closes itself on a click outside instead of relying on the browser.
- **A page that sends most listings to the cloud.** A crib bedding search sends nearly every listing to the cloud for a
  look at the photo, and 4 checks at a time took over 4 minutes a page. 8 at a time finishes 70 listings in under 2.5.

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

## 12. Practice listings and release 0.7.0 (2026-11-19)

**Practice listings.** https://still-recalled.web.app/try has sixteen made-up listings, built by
`scripts/make-try.mjs` so anyone can try the extension without hunting for a risky listing. Seven are products the CPSC
recalled, with their notice photos and titles written the way sellers write them; nine are ordinary toys and baby
things with public-domain photos. The answer key is `web/try/answers.json`. They are a demonstration, not a test: the
listing photo and the notice photo are the same picture, which makes a match easier than on a real listing. The four
tests above are the measure.

| Run (release 0.7.0) | Recalled flagged | Ordinary flagged | Time |
|---|---|---|---|
| With Chrome's built-in model | 7 of 7 | 0 of 9 | 52 to 107 s for the page |
| Without it (words, then the cloud) | 6 of 6 (12-listing version of the page) | 0 of 6 | 45 s |

The end-to-end test (`node tools/e2e.mjs --headful --fresh --profile=C:/tmp/sr-nano-profile --ext=dist/still-recalled-extension --url=https://still-recalled.web.app/try/`)
passes all 12 steps with the release build: Gemini Nano ran inside the installed extension, the cloud confirmed every
flag through the App Check bridge, and the engine's settings came from Firebase Remote Config.

**Two label misreads, and what changed.** On a blurred CPSC label photo (Little Tikes swing, recall 17096, model
615573), one run's cloud reading was 315573, and in another the built-in model read W2670 while the cloud read 313570.
Under the earlier rules either would have shown "Not among the listed models", a reassurance the label did not support.
Two rules now stop that (`shared/label.mjs`, tested in `tests/label.test.mjs`):
- **One character off:** a model number one character from a recalled one, in codes of five or more characters, is
  shown as "One character from a recalled model", never cleared.
- **Readings disagree:** when the built-in model's and the cloud's readings share no model number and neither matches,
  the card says the label is hard to read and asks for a sharper photo.

Re-scored on the saved readings of the 12 CPSC label photos (§9), neither rule changed a result: 8 recalled, 4
unreadable, and no "near" against the other recall each photo was also checked against.

**A test-profile finding.** Chrome kept the Nano test profile's extension service worker from an earlier build and
kept running it after the file on disk changed: the label check in that profile went to a background script from before
the label check existed. Installs from the release zip are not affected. The test scripts now clear that cache before
each launch (`freshServiceWorkers` in `tools/chrome-args.mjs`).

**Firebase Remote Config.** `cloud_models`, `cloud_check` (an off switch for the cloud step) and `cloud_at_once` are
read by `liveSettings()` in `extension/src/ai.js`, with the values in the code as the fallback.

## 13. Live recalls and the recall watch, release 0.8.0 (2026-11-19)

**Why.** The recall list ships inside the extension, so before 0.8.0 a recall announced after a build never reached an
installed copy. And recall notices reach the first owner, who registered the product, not the person who bought it
secondhand: Kids In Danger found that only 22% of the children's products recalled in 2022 that it could analyze were
returned, replaced or repaired (2024 report; see `docs/research/sources.md`).

**How.** Twice a day (and at install) the extension asks the CPSC recall API for notices published since the newest
one it knows, with a week of overlap. Gemini, through Firebase AI Logic (`ONLY_IN_CLOUD`, `gemini-3.5-flash-lite`
first, the model the build used), writes each new notice's field-guide entry with the build's own prompt
(`shared/spotter.mjs`). The cards are made with the build's code (`liveCardsFromCpsc` in `shared/cards.mjs`), with one
difference: a handful of notices is too few to tell a distinctive product line from an everyday word, so every line
counts only together with the brand. Pages already open are checked again. Listings the shopper chose to watch are
checked against the new recalls: the word rules first, then Gemini Nano on the photo, then the cloud only for what the
device flags. A match raises a Chrome notification.

**Results (2026-11-19).**

| Run | Result |
|---|---|
| Catch-up at install, Chrome profile with Gemini Nano (development build) | 5 recalls CPSC published that morning (27090, 27092, 27094, 27096, 27098), field-guide entries written for all 5 in 12 s |
| Practice listings after the catch-up | The Kidsview infant bouncer (recall 27092, published that morning) flagged "possible recall"; 8 of 8 recalled flagged, 0 of 9 ordinary, 17 listings in 93 s |
| Recall watch: the 12 recalls from 2026-11-12 on hidden from the build, a Huffy e-trike listing watched | All 12 fetched back, 12 field-guide entries in 36 s; the watched listing flagged "likely" against recall 27086, confirmed in the cloud |
| Release build, new profile without the built-in model, live practice page | Caught up with 6 recalls published that morning in 8 s (field-guide entries for all 6); Kidsview bouncer flagged; 8 of 8 recalled, 0 of 9 ordinary, 8 confirmed in the cloud; the watch test fetched 13 back (13 entries in 44 s) and raised the alert, confirmed in the cloud; all 15 steps passed |
| Unit tests (`tests/live.test.mjs`, the real CPSC answer for 2026-11-12) | A field-guide entry makes a new recall matchable by model number; a line alone does not match; without the cloud a notice still gets a card from plain code |

**Two findings.**
- **The CPSC API answers a URL it has seen with its earlier answer.** The same query returned 31 notices, and 35 with
  an extra parameter; the four missing were that morning's. Each request now carries an end date and a unique
  parameter.
- **A field-guide entry took 18 s on `gemini-4-hydrogen`** (7 notices in 128 s, four at a time). The build's model,
  `gemini-3.5-flash-lite`, is now tried first: 5 notices in 12 s.

**A test-profile limit.** In the heavily automated Nano test profile, reCAPTCHA Enterprise refused App Check tokens to
the release build's bridge after the first one (403 at the exchange; the SDK then sends a placeholder token, refused
with 401), so the release build's cloud step was checked in a new profile, and the Nano profile used the development
build's App Check debug token. Flags stood, marked unconfirmed, as designed. `tools/appcheck-nano-probe.mjs` shows each
exchange and the token's claims.

**A bug found on the way.** Remote Config's `cloud_models` value was checked against `/^gemini-[w.-]+$/` (a lost
backslash), which rejected every model name, so the built-in list was always used. Fixed to `[\w.-]`.

## 14. Android, release 0.9.0 (2026-11-19)

**What it is.** A native Android app (`android/`, Kotlin and Jetpack Compose) with the extension's pipeline: Firebase
AI Logic for Android reads a shared screenshot or listing and looks at it (`PREFER_ON_DEVICE`: Gemini Nano through AICore
where the phone has it), the extension's own rules engine matches it against every recall (bundled from `shared/` and
run in Jetpack's JavaScript sandbox), and Gemini confirms flags against the full notice (`ONLY_IN_CLOUD`). Live recalls
and the recall watch run in the background with WorkManager. App Check tokens come from the site's reCAPTCHA Enterprise
bridge, since Play Integrity needs an install from Google Play.

**Results** (Android 16 emulator with Google Play services, `node tools/android-e2e.mjs`):

| Check | Release APK | Debug build, with the watch replay |
|---|---|---|
| App Check token from the bridge | yes, 48 s after a first launch | yes, 35 s |
| Background catch-up with CPSC | yes | yes |
| Example photo (infant lounger) | flagged, 12.7 s | flagged, 13.9 s |
| Shared text: Rock 'n Play | recall 23088 matched, confirmed in the cloud, 13.8 s | 11.2 s |
| Shared text: Graco swing | possible recall, 9.5 s | 18.8 s |
| Shared text: wooden blocks | no match, 0.3 s, no model call | 0.5 s |
| Shared text: Kidsview bouncer (recalled that morning) | possible recall, 46.2 s (the larger model timed out and the lighter one answered) | 10.4 s |
| The watch: bouncer before its recall, watched, refreshed | | no match, then a notification 20 s after the refresh |
| All checks | 8 of 8 | 12 of 12 |

**Speed.** With the larger cloud model for every step (the emulator has no Gemini Nano), a check took 34 to 48 s. The
steps meant for Gemini Nano (read, look, label) now fall back to the cloud's lightest model, `gemini-3.5-flash-lite`
(1 to 3 s each); the confirmation keeps `gemini-4-hydrogen` (5 to 16 s; one outlier of 37 s while the test machine was
short of memory). The label's cloud re-read, the reading that can clear a listing, keeps the larger model.

**Two findings.**
- **The first App Check token must be ready before the first call.** The AI SDK waits about 10 s for a token and then
  sends a placeholder, which the backend refuses (401); reCAPTCHA in the bridge took longer than that on a cold start.
  The app now loads the bridge and asks for a token at launch.
- **On-device output on Android ignores response schemas.** The on-device path takes structured output only through
  generated Kotlin classes, so the JSON Schema also goes into the instructions and answers are parsed leniently; the
  cloud stays bound to the schema.

**Not tested:** Gemini Nano on Android (the emulator has none; the SDK's on-device inference is experimental, and needs a phone
whose AICore offers Gemini Nano).

## 15. Simulated first-time-user walkthroughs and release 0.9.1 (2026-11-19)

**What they were.** Two cognitive walkthroughs run by AI agents playing first-time users: a first-time parent on a
budget who buys on Facebook Marketplace on an Android phone, and a grandparent buying on eBay and Craigslist in Chrome
who has never installed an extension outside the Web Store. **They are simulations, not user research:** the agents read
the UI code, the screenshots and the live pages, and listed where such a person would stop, be misled or give up.

**What they found, and what changed in 0.9.1:**
- **Flags named a product but didn't say what to do.** "This looks like an infant lounger or nest" read as a category,
  not a warning. Every flag now carries an action line on all three surfaces (`shared/present.mjs` `actionLine`), such
  as "Skip this one. CPSC's advice: nothing in a crib but a fitted sheet." or "Don't buy it. Every unit of this product
  is recalled." A recall covering every unit no longer asks for a label photo "to confirm".
- **Wording that could read as "safe".** "…and it doesn't look like a risky sleep product" became "No recall found for
  what we could read. That doesn't mean it's safe…". "If you buy it, never use it for sleep" (heard as permission to
  buy) became "Never use it for sleep, not even for a nap." A label not in the notice now reads "Model not listed in
  this recall", adding that other recalls may still apply.
- **A practice listing offered "Report to CPSC"** and opened the real SaferProducts.gov form about a made-up listing.
  On the practice page the report is now copied for viewing and the form is never opened.
- **The practice page couldn't tell whether the extension was installed.** It now says "Extension on" and how many of
  the eight are flagged so far, and has a copy button for `chrome://extensions` with the exact folder to choose.
- **Watching was hard to find.** "Watch for recalls" is now in the card on a listing's own page too, and the side
  panel's bell is labelled "Watch list".
- **The web page never mentioned the Android app.** It now has an Android section with plain install steps, shown at
  the top for Android visitors.
- **Android: a share holding only a link (Facebook often shares just a link, or "Check out this item on Marketplace")
  was either ignored or checked as that stock phrase.** The app now strips links and stock share lines, and when
  nothing about the product is left, asks for a screenshot instead.
- **Android: watching with notifications turned off would never alert.** The watch card now says alerts are off and
  opens the notification settings. Watch alerts now say what to do, and the watch list has "Watch something you own".
- **Android: the first check after install could wait most of a minute with no explanation** (the first App Check token).
  The check now shows "Connecting securely (first launch only, up to a minute)" and waits for the token.
- **Android release builds no longer contain Firebase's App Check debug provider** (`debugImplementation`; checked in
  the release APK's dex files).
- Settings wording: "Clear saved results" (which re-checks the page) is "Check this page again"; "Set up / Not set up in
  this build" is "Available / Off"; the welcome page's "One step left" for the model download is "Optional".

**0.9.1 results (2026-11-19).** The packed extension passed all 15 end-to-end steps on the live practice page in a
new Chrome profile (8 of 8 recalled listings badged, 8 confirmed in the cloud, a watched listing alerted). On the
Android 16 emulator the release APK passed 8 of 8 (App Check token 10 s after launch; checks 5 to 10 s) and the debug
watch replay 12 of 12 (notification 15 s after the refresh). A share holding only a Facebook Marketplace link and its
stock line now asks for a screenshot; a share naming the product is checked as before.

**Label review tool.** `tools/label-review.html` has a quick review (the default): only the 314 of 597 labels that
decide the published numbers (every "must flag" and "unclear" listing, and every "must not" listing any of the three
ways flagged), answered with keys 1 to 4. `tools/eval-score.mjs` uses a person's answer where there is one.

## 16. A second independent review, and release 0.9.2 (2026-11-20)

A fresh review of 0.9.1 (an AI judge reading the rules, the write-up, the code and the reports, not a person) checked
the published numbers against the reports and found them right, and found claims the code did not support. Each was
fixed in the words or in the code:

- **"The device can raise the alarm, never clear it" was too broad.** Gemini Nano does drop a word match whose photo
  is plainly another kind of product, without the cloud (`shared/judge.mjs`, `decide`), and that is where most false
  alarms end (86 with word rules alone, 50 after its look). What it never does alone is tell a parent a unit is not
  one of the recalled ones: a label that would reassure is read again in the cloud. The write-up now says that.
- **"Only flags leave the device" was too broad.** Bedding sets that may hide a bumper, and listings the words call a
  part that name a risky type, also go to the cloud for a look at the photo; a crib bedding search sends most of its
  page. Without Gemini Nano, the look itself runs in the cloud. The write-up, README and gallery now say so.
- **Gallery slide 1 said federal law bans loungers.** It bans padded crib bumpers and inclined sleepers from sale
  whatever their age; 16 CFR 1243 covers loungers made after May 5, 2025, and older ones are banned only by platform
  policy unless recalled (`docs/research/sources.md`). Corrected.
- **The README mixed two end-to-end runs.** The 15-step passes ran in a profile without the built-in model; the
  on-device end-to-end pass was release 0.7.0 (12 steps, §12). Corrected. The extension's end-to-end test now saves
  its report to `tools/e2e-report-*.json`.
- **"A retired model is replaced within the hour" was not guaranteed.** The settings were kept for the life of the
  hidden page (extension) or the app process (Android). Both now read them again every 10 minutes; Remote Config goes
  to the network at most once an hour.
- **Field-guide entries for new recalls are written by each install**, not once for everyone. The words now say so.
- **The example photo named no recall.** It was the bare photo from recall 26591, so only the lounger type could be
  seen. It is now a made-up listing around that photo, with a seller's title (`scripts/make-example.mjs`), so the
  check names the recall, which covers every unit. The page and the app say the listing is made up.
- **Badges came slowly on a long page:** Gemini Nano looks at one listing at a time, a few seconds each (60 eBay
  listings took 468 s). The page now tells the engine which listings are on screen, and those are looked at first.
- **Not said before:** eBay, Facebook Marketplace and Mercari already ban these products by policy, and the practice
  listings use each recall notice's own photo. The write-up now says both, and that the four tests' totals add four
  engine versions.

**0.9.2 results (2026-11-20).** 65 unit tests pass, one new: the example listing's words match recall 26591. The
packed extension passed all 15 end-to-end steps on the live practice page in a new Chrome profile (9 recalls caught up
in 10 s, 17 of 17 listings checked in 45 s, 8 of 8 recalled listings badged and confirmed in the cloud, a watched
listing alerted); the report is `tools/e2e-report-release.json`. On the Android 16 emulator (no Gemini Nano) the
release APK passed 8 of 8; the example now comes back "Recalled product", recall 26591, in 16 s. On the live web page,
in a desktop Chrome with Gemini Nano, the example was read on the device and confirmed in the cloud as recall 26591:
"Don't buy it. Every unit of this product is recalled."

## 17. The cloud asks the device, CPSC warnings, and release 0.10.0 (2026-11-20)

A third independent review (an AI judge, not a person) and a research pass on past winners and unmet needs led to
this release. What changed, and what was measured.

**Claims the review found still wrong in 0.9.2, and the fix.**
- A label reading by the device alone could still be shown as "Model not listed in this recall" when the cloud
  re-read was off or failed. It is now "Read once, on this device: not ruled out" (`shared/label.mjs`, `readOnce`),
  on the extension, the web page and Android.
- The extension's label check ignored the shopper's cloud switch. It now honours it: with the cloud off, the label
  photo is read by the built-in model only and never leaves the computer.
- "Only a possible match goes to the cloud" was wrong for the web page and the Android app, where a parent checks one
  listing at a time and every baby product gets the cloud's look. Their text now says so.
- "The words settle most listings at once": in the four tests Gemini Nano looked at 494 of 597 listings. The line is
  gone.
- Android's read step had no cloud fallback when the on-device call throws. It has one now.

**The cloud asks the device (`shared/lookup.mjs`).** The cloud's confirmation call carries one function,
`lookup_recalls(brand, product, model_number)`, through Firebase AI Logic function calling (the web SDK's chat with
`tools`, and the Android SDK's `Tool.functionDeclarations`). When the cloud can name a product the listing's words do
not state, it calls the function; the call is answered on the device by the shortlist's code over the field guide,
with the full notice for each recall found; the cloud then judges the listing against it. A recall the cloud names
counts only when it is one the device returned (`shared/confirm.mjs`, `decideFinal`).

- *Does it find recalls the words miss?* `node tools/lookup-generic.mjs --runs=2`: ten made-up listings for recalled
  baby products, titled without brand or product name ("Inclined baby sleeper, pink, folds flat", "Baby floor seat,
  foam") and shown with each recall notice's own photo, the easy case for recognising a product. The word rules found
  the recall on 0 of 20 checks. The cloud asked on 16; the result named the exact recall on 14 and an earlier notice
  for the same product on 2 (Nap Nanny), so 8 of 10 listings on each pass. Without the function, 12 of the 20 were
  flagged at all, by type only; a MamaRoo swing, a Bumbo seat and a Nap Nanny would have shown nothing. Not named: a
  Tango Mini stroller and a CooCooBaby lounger, which the cloud did not recognise. The first pass, before a fix for
  brand spellings ("Kids II" for "Kids2"), named 7 of 10. Results: `tools/lookup-generic.json`.
- *Does it add false alarms?* `node tools/lookup-run.mjs --set=<set>` on every listing of the four test sets that the
  hybrid run sent to the cloud (140): the function was called on 12, the device had a recall for 2, and no listing
  changed between flagged and not flagged. One listing already flagged as a possible UPPAbaby recall named a different
  UPPAbaby recall. Results: `tools/eval-lookup.json`, `fresh-lookup.json`, `third-lookup.json`, `fourth-lookup.json`.
  The device's decision for each listing was rebuilt from the saved run (its level kept; what it pointed at taken from
  the words), so this measures the function's effect on the cloud step, not a fresh hybrid run.
- *It asked too often at first.* With the first wording, the cloud called the function on 19 of the first set's 21
  listings, mostly for brands the title already named. Told that the device has already searched with the listing's
  own words, it called on 0 of the 21.
- *Limits.* It depends on the cloud model recognising the product; a seller's own photo is harder than a notice
  photo, and that was not measured. A call adds a second round to the cloud step (a median of 16 s in the two-pass
  run, made while other tests were running).

**CPSC safety warnings (`scripts/build-warnings.mjs`).** CPSC's product safety warnings file held 393 notices on
2026-11-20 (144 dated 2026). 392 became cards (189 for babies or children, by the spotter card's own field); 307 name
a brand no recall card has. They are appended after the 10,089 recall cards, which are byte for byte as they were, and
made the careful way cards for new notices are (a product line counts only together with its brand). When a recall
and a warning both match, the recall is shown. `node tools/warnings-check.mjs`: the word match changed for 1 of the
597 test listings (a Summer Infant bassinet, now matched by brand to a warning about its inclined sleeper), and the
cloud cleared it. The warnings file gives no link for each warning, so the card links to CPSC's warnings page and
shows the warning number. New warnings are not fetched live yet.

**Where a check is.** While a page is checked, each listing carries a quiet pill: "Looking on this computer" while
the built-in model looks at it, then "Checking in the cloud" for what the computer flagged. Hidden from screen
readers (the side panel's progress line says it once), still when reduced motion is on.

**Also:** the word rule for inclined sleepers now reads "inclined baby sleeper" (no listing in the 597 has that
form); the practice page's Rock 'n Play is titled "Inclined baby sleeper, pink, folds flat".

**0.10.0 results (2026-11-20).** 67 unit tests pass. The packed extension passed all 16 end-to-end steps on the live
practice page in a new Chrome profile, without the built-in model (17 of 17 listings checked in 30 s, 8 of 8 recalled
listings badged and confirmed, the unnamed sleeper matched to recall 23088 through `lookup_recalls`); report
`tools/e2e-report-release.json`. In the Gemini Nano test profile, with the development build (reCAPTCHA refuses that
automated profile's release tokens, section 13), the 17 listings took 183 s, all 8 flagged listings were looked at on
the computer first, and the unnamed sleeper was matched the same way; `tools/try-run-nano-0.10.0.json`. On the Android
16 emulator (no Gemini Nano) the release APK passed 10 of 10: the example, four shared texts, a CPSC warning ("CPSC
warning", 21 s), and a listing described without its product's name, where the cloud called the function and the
phone answered ("Recalled product", 12 s); checks took 6 to 21 s.

## 18. A third review, the 597 run again, and release 0.11.0 (2026-11-20)

A fourth independent review (an AI judge, not a person) checked every number in section 17 against the files and
found them right. It also found bugs and claims to tighten. What changed, and what was measured.

**A recall the cloud named is never a red "Recalled product" on its own.** When the cloud calls `lookup_recalls`, the
listing's words did not name the brand, so no code checked it, and look-alike products exist. Such a recall is now
shown as "Possible recall", or, when a type flag already stands (words and photo agree on an inclined sleeper), as a
line on that flag's card naming the recall (`shared/confirm.mjs`, `decideFinal`; `shared/present.mjs`, `also`,
`foundBy`). The rule was needed: in the run below, the fallback model named a Kids2 rocking sleeper as a Rock 'n Play.

- `node tools/lookup-generic.mjs --runs=2` under this rule (ten made-up listings with generic titles, each with its
  recall notice's own photo, checked one at a time as the web page and the Android app do): the right recall was
  named on 6 of 10, then 7 of 10. One more each pass named another notice: an earlier notice for the same product
  (Nap Nanny), and the look-alike above. 9 of 10 were flagged for the parent on each pass, against 6 without the
  function. None was a red recall on the cloud's word alone. This run shared its cloud quota with the 597 run, so the
  fallback model answered several times; the earlier run (section 17), on the main model, named 8 of 10.
- In the extension the function reaches only what the device flags or can't settle: 6 of those 10 titles have no
  risky type words, so there they reach the cloud only if Gemini Nano sees a risky type in the photo.
- Section 17's "no listing changed between flagged and not" compared the same cloud answers decided with and without
  the function. It did not compare two separate runs.

**All 597 listings again, on the current engine** (`bash tools/rerun-all.sh`, `node tools/rerun-compare.mjs`,
results in `tools/*-rerun.json` and `tools/rerun-compare.json`; Gemini Nano in the test profile, development build,
cloud at temperature 0, the 392 warnings and the function included). No cloud or device errors; every photo loaded.

| | Caught (of 74) | False alarms (of 481) | Sent to the cloud |
|---|---|---|---|
| First runs, each on the engine of its day (blind) | 58 | 11 | 140 (23%) |
| Run again on 0.11.0: word rules only | 45 | 78 | |
| Run again on 0.11.0: Gemini Nano only | 48 | 66 | |
| Run again on 0.11.0: hybrid | 67 | 13 | 165 (28%) |

- **This is not a blind result.** The first three sets were used to fix the engine after each test, so catching more
  of them (10 to 14 of 14, 28 to 34 of 34) shows the fixes hold, not how it does on unseen listings. The fourth set,
  the newest, came out the same: 18 of 22, with 0 false alarms where it had 1. The blind figures stay 58 and 11.
- 31 listings changed between flagged and not: 19 for the better, 12 for the worse. Two catches were lost in the
  second set (a Mockingbird stroller and a crib headboard cover), where Gemini Nano's look said nothing this time:
  its answer for a listing is not the same on every run.
- Of the 13 false alarms, 11 are soft "possible" flags. Six are UPPAbaby VISTA and CRUZ strollers, five of them titled "V2",
  flagged against the 2015 recall of the first version: the cloud answered "cannot tell" where the listing's "V2"
  places it outside the notice. Not fixed here, so that this table is not tuned to. One, a Graco Swyngomatic swing, was labelled "no"
  before every recall since 1973 was added; the fourth test counts the same swing as a catch.
- The function was called on 14 of the 165 cloud checks, the device had a recall for 1, and no result was shown
  because of it: on these real listings, whose sellers mostly name the brand, it found nothing new.
- 72% of listings never left the laptop, against 77% in the first runs.

**For the person who owns it (`ownerView`).** "I own it" on the web page and in the Android app: the same check, then
"Don't sell it or give it away", that CPSC says it is illegal to sell a recalled product, and the recall's remedy
from the card. For a CPSC warning: no refund to claim. For loungers, no claim of a federal ban. Never "safe to sell".
Unit tests cover each case. Run end to end on the local web page (a typed Boppy lounger: "Don't sell it or give it away", with the refund) and on the Android emulator (`node tools/android-owner.mjs`: the same, with no question for a seller and no report). Not tried with real sellers.

**Bugs fixed.** The recall API fetch for a notice now times out after 15 s (a stalled fetch held a listing at
"Checking in the cloud" and a cloud slot). A model that answers 404 is skipped for the next in Remote Config's list
(web and Android). A function-calling round that ends without text is asked once more without the function. 692 recall
cards hold only 14 of a notice's model numbers; they are marked, and the label check now says "Check this model
against the notice" there, not "Model not listed". The cloud confirmation on the web now uses temperature 0, as Android's does (the web page's hybrid calls followed in 0.12.0).

**Sources.** The three sources the write-up quotes were read at the source and added to `docs/research/sources.md`
(section 9). One line was too strong: CPSC "issued 82,000 takedown notices" in the first half of fiscal 2026, in its
acting chairman's words; the write-up had said "more than 82,000 takedown requests to online platforms".

**0.11.0 results (2026-11-20).** 71 unit tests pass. The packed extension passed all 16 end-to-end steps on the live
practice page in a new Chrome profile, without the built-in model; the unnamed sleeper is flagged "Inclined infant
sleeper" with recall 23088 named on its card through `lookup_recalls`; report `tools/e2e-report-release.json`.
On the Android 16 emulator (no Gemini Nano) the release APK passed 10 of 10: the example, four shared texts, a CPSC
warning, and a shared text that names no brand, only a nickname ("the rock and play one everyone had"), where the cloud
called the function, the phone answered, and the card named recall 23088.

## 19. A fourth review, a fifth blind test, and release 0.12.0 (2026-11-20)

A fifth independent review (an AI judge, not a person) read 0.11.0, recomputed section 18's numbers from the files
and found them right. It also found bugs, three claims the sources did not support, and one idea worth building.
What changed, and what was measured.

**The device asks its own field guide** (`shared/lookup.mjs`, `deviceLookup`). In the extension the cloud's
`lookup_recalls` reaches only what the device flags or can't settle. A baby product with a plain title and no risky
type words never got there. So the model that looks at a listing now also answers one more field, `brand_seen`: a
brand name it can read in the photo. When the listing's words don't already say that brand, the shortlist's code looks
it up with the kind of product, and a recall it finds goes to the cloud as a question, attached to the listing.

- **Gemini Nano guesses more than it reads.** On the ten made-up listings (each with its recall notice's own photo)
  it gave a brand three times, "Fisher-Price" each time, for a Kids2 sleeper, a 4moms MamaRoo and a Summer bedside
  sleeper: wrong each time. On two real Graco swings it read "Graco" off the product, correctly
  (`tools/lookup-nano.json`).
- **So its answer is never shown on its own.** The device's level does not change. The listing goes to the cloud with
  the recall marked "found by the device, unverified", and the cloud is told a small model may have guessed the brand
  from the shape. The recall is shown only when the cloud answers with that recall's number, and then as "Possible
  recall" at most. If the cloud names another product, it calls `lookup_recalls` and that recall is shown instead.
  With the cloud off, or the cloud call failing, nothing from this lookup is shown (`shared/confirm.mjs`,
  `decideFinal`; unit tests in `tests/device-lookup.test.mjs`).
- **The brand left out, real photos** (`node tools/masked-build.mjs`, `node tools/eval-run.mjs --set=masked`).
  23 real listings from the five test sets whose words named a recalled product and whose blind label agrees (8
  labelled "should be flagged", 15 "can't tell" with the same recall named by the reviewer). Code stripped the naming
  words from each title (the card's brand, product line and model numbers), leaving what many sellers write ("Infant
  Floor Seat Baby Sit Up Chair"). The sellers' own photos were kept. The word rules then find a recall on none.
  - **Checked one at a time** (`node tools/lookup-generic.mjs --masked`, `tools/lookup-masked.json`): the right recall
    was named on 12 of 23. Seven came through the device's own lookup, with Gemini's lightest cloud model doing the
    look: it read "Graco" on two swings and "Bumbo" on five floor seats (one recall, 12247), and all seven lookups
    were right. Five came through the cloud's `lookup_recalls`: a
    MamaRoo, a Maclaren Triumph, a Jool Nova and two BOB joggers. No other recall was named and none was a red
    recall. 15 of 23 were flagged in all, against 3 with both lookups taken away. Here the look ran in the cloud
    (Gemini's lightest model), which reads a logo better than Gemini Nano.
  - **In the extension, with Gemini Nano:** the first seven of these (the set as first built, from the third and fourth
    tests) were run through the extension's own pipeline: the right recall was named on 3 of 7, and 6 of 7 were
    flagged. Gemini Nano read "Graco" on both swings. For the MamaRoo it said "Fisher-Price", which was wrong, but the
    lookup still sent the listing to the cloud, and the cloud named the swing (`tools/lookup-nano.json`). The full 23
    have not been run with Gemini Nano.
  - **The ten made-up listings, one at a time, on this version** (`node tools/lookup-generic.mjs`): the right recall
    named on 6 of 10 (two through the device's own lookup), an earlier notice for the same product on 1, and 8 of 10
    flagged against 6 without the lookups. None was a red recall.
- **On the ten made-up listings, in the extension's pipeline with Gemini Nano:** the right recall was named on 4 of
  10. Gemini Nano gave a brand three times and was wrong each time; none of those was shown. One of the four, the
  MamaRoo, reached the cloud only because of the device's lookup: the guess was wrong, the cloud named the swing, and
  the device's field guide had the recall (`tools/lookup-nano.json`, `tools/generic-listings.json`).
- **Taken together:** with Gemini's lightest cloud model doing the look, the device's lookup was right 9 times of 9
  (7 on the real photos, 2 on the made-up set). With Gemini Nano doing it, 2 of 6. That is why the lookup's answer is
  a question for the cloud and never a flag.

**Fifth test, blind, on 0.12.0's engine.** 178 listings collected on 2026-11-20 with searches and cities no earlier
set used (`tools/collect-fifth.sh`, `tools/fifth-listings.json`): eBay, used condition, 10 each for "baby rocker",
"bedside bassinet", "baby sleeper bed", "infant floor seat", "crib bedding set bumper", "baby swing", "newborn lounger
pillow", "baby gear lot", "toddler bed" and "jogging stroller"; Craigslist in Phoenix, Boston, Portland and Miami
(78). Eight of the ten eBay searches are plain, what a parent types; two name a hazard ("crib bedding set bumper",
"newborn lounger pillow"), and six of the nine listings that should be flagged came from those two. Three separate AI
reviewers labelled them blind, from
the title, the price and one photo, against all 10,089 raw CPSC recall records and CPSC's warnings file, with no
access to the product's code, documents or answers (`tools/fifth-labels-a.json`, `-b.json`, `-c.json`; the brief is
in `tools/fifth-label-brief.txt`): 9 must be flagged, 149 must not, 20 can't be settled from the listing alone. The
decision rules were finished before the labels were written, and the hybrid test was run once to the end (a first
start failed before it checked a listing). What weakens it is listed under section 20.

| Same engine, run as | Caught (of 9) | False alarms (of 149) |
|---|---|---|
| Words only | 4 | 23 |
| Built-in model only | 4 | 14 |
| **Hybrid** | **7** | **1** |

- **By kind:** infant loungers 4 of 5; padded crib bumpers 2 of 2 (both bedding sets whose titles never say
  "bumper"); recall matches 1 of 1 (a 4moms mamaRoo); inclined sleepers 0 of 1.
- **The two misses.** A listing titled only "Baby Rocker" whose photo shows a Fisher-Price Rock 'n Play, and a Snuggle
  Me lounger sold as a "baby pillow". Gemini Nano looked at both photos and saw nothing to flag, so neither left the
  laptop. This is the extension's limit, measured: when the words say nothing, the device's model has to notice
  something. Checked alone, the way the web page and the phone check a listing, both are flagged: for the rocker the
  cloud read the Fisher-Price tag, called `lookup_recalls`, the device returned recalls 23088 and 19105, and the card
  says "Possible recall".
- **The one false alarm** is a soft flag: a Fisher-Price giraffe tummy-time roll, taken for a lounger.
- **Where it ran:** the built-in model looked at 156 listings (median 7.0 s each, including the cloud check where
  there was one); 22 were settled by their wording. The cloud saw 38 (21%). No cloud or device call failed.
- **The two lookups found nothing here.** The cloud called `lookup_recalls` on 5 of its 38 checks and the device had
  no recall for any. The device's own lookup fired once in 178 (Gemini Nano gave "Fisher-Price" for an unbranded
  swing); the cloud did not take it up, and nothing was shown.
- **Unclear listings:** 11 of the 20 were flagged, 10 of them softly: Bumbo floor seats (every seat sold through
  2012 is recalled), BOB and InStep joggers, an UPPAbaby Vista, an Oeuf crib. In 10 of the 11 the recall on the card
  is one the reviewer named too.
- **In a shopper's units:** the 9 listings that should be flagged were asking $537; the hybrid flagged $482.
- **Eight Craigslist photos** reached the reviewers as black placeholders; those listings were labelled from the
  title (all "no" or "can't tell").

**The same 178, checked one at a time** (`node tools/single-run.mjs --for=fifth`, `tools/fifth-results-single.json`).
The web page and the Android app check one listing at a time, so every baby product gets the cloud's look. Run that
way on the same 178 (the look in the cloud, as on a device without a built-in model; labels unchanged, engine
unchanged, run once after the extension's run): **9 of 9 caught, 3 false alarms of 149, all three soft.** 147
listings went to the cloud (83%), against 38 (21%) in the extension.

| The same 178 listings | Caught (of 9) | False alarms (of 149) | Sent to the cloud |
|---|---|---|---|
| The extension: only what the device flags or can't settle | 7 | 1 | 38 (21%) |
| One at a time: every baby product gets the cloud's look | 9 | 3 | 147 (83%) |

- The "Baby Rocker" listing is flagged "Inclined infant sleeper", and its card names the Rock 'n Play recall: the
  first look gave "Fisher-Price" for the photo, the device's own lookup found recall 23088, and the cloud, calling
  `lookup_recalls`, settled on the first Rock 'n Play notice, 19105.
- The cloud called `lookup_recalls` on 28 of its 147 checks; the device had a recall for 8; a recall was shown through
  it on 2. One is the rocker. The other is a false alarm: an unbranded "Electric Baby swing" shown as a possible
  4moms MamaRoo (22200). Look-alikes are the cost of naming a product from a photo, and why such a recall is never
  more than "Possible recall".
- The other two false alarms: a Bumbo floor seat of the current model (every seat sold through 2012 is recalled; the
  reviewer judged this one newer), and the giraffe tummy-time roll the extension also flagged.
- This is the choice the extension's thorough mode offers a parent: 21% of listings leaving the computer with the
  unnamed rocker missed, or 83% with it caught.

**Five blind tests together.** 775 listings, 83 that should be flagged. Hybrid: 65 caught, 12 false alarms of 630.
Word rules only: 47 caught, 109 false alarms. Built-in model only: 51 caught, 64 false alarms. The cloud saw 178
listings (23%). Each test was run with the engine of its day.

**The earlier sets again, on 0.12.0: two of the four** (`bash tools/rerun-all.sh -r5`, `node tools/run-compare.mjs
--a=-rerun --b=-r5 --sets=eval,fresh`, `tools/run-compare-r5.json`). Not blind: these sets were used to fix the engine.
Only the first two sets (261 listings) were run. The third and fourth were started and thrown away: other programs
on the test computer left Gemini Nano too little memory, 34 of its looks timed out, and results with timeouts would
measure the computer. `tools/rerun-all.sh` now runs a listing again when its model call fails.

| The first two sets (261 listings) | Caught (of 18) | False alarms (of 232) | Sent to the cloud |
|---|---|---|---|
| First runs, each on the engine of its day (blind) | 12 | 4 | 31 |
| Run again on 0.11.0 | 15 | 3 | 44 |
| Run again on 0.12.0 | 14 | 3 | 45 |

- One listing changed between flagged and not: a "DockATot Deluxe+ ... Lounger Cover" whose photo shows the whole
  lounger. The cloud called it a part this time. The three false alarms are the same three listings as on 0.11.0.
- The device's own lookup fired on 4 of the 261 (Gemini Nano gave "Graco", "Fisher-Price" and, twice, "Delta" for
  products whose titles name no brand). Each went to the cloud only because of it, the cloud took none up, and
  nothing was shown. Its cost here was four cloud checks; its benefit, none.
- The cloud called `lookup_recalls` on 6 of its 45 checks, the device had a recall for 1, and nothing was shown
  because of it. No cloud or device call failed in these two sets.

**Faster with Gemini Nano** (`extension/src/engine.js`, `wordsFirst`). 0.11.0 took 183 s for the 17 practice listings
with the built-in model, against 30 to 81 s without it: the model looks at one listing at a time, and every cloud
check waited its turn behind it. A listing whose words name a risky type goes to the cloud whatever the model says,
and with the cloud's answer the result is the same either way, so those now skip the model's look and their cloud
check starts at once; the queue also no longer waits for a free cloud slot. On the 17 practice
listings that removes 2 of the 10 looks. I could not time the result fairly: the run with Gemini Nano on this version
took 223 s for 8 looks (about 28 s a look) on a computer busy with other programs, against 183 s for 10 looks (about
18 s) on 0.10.0. All 8 recalled listings were flagged, and the label was read on the device in 9 s
(`tools/try-run-nano.json`; the 0.10.0 run is `tools/try-run-nano-0.10.0.json`). No speed gain is claimed.

**Thorough mode** (a setting, off by default). The extension can send every baby product on a page for the cloud's
look, as the web page and the phone do. It is the parent's choice between the two results above: fewer listings
leaving the computer, or the unnamed Rock 'n Play caught.

**CPSC warnings, live.** New recalls already arrived from CPSC's API after install; CPSC's safety warnings, which are
not in that API, did not. The extension now reads CPSC's warnings file with each refresh and gives every warning newer
than the bundled ones a card, written in the cloud like a recall's; the card carries the warning's text for the cloud
check (`shared/warnings.mjs`, `engine.js` `newWarnings`). Extension only: the file has no CORS header, so a web page
cannot read it, and the Android app does not fetch it yet.

**Bugs fixed.**
- When the CPSC recall API did not answer, the cloud check gave up and the device's flag stood unconfirmed. Seen in
  a test run on this day, while the API timed out: six listings, all false alarms. The check now runs on the short
  record on the device's own card (`shared/notice.mjs`, `noticeFromCard`; web and Android).
- The Android label check dropped the mark for a model list cut at 14, so it could still say "Model not listed in
  this recall" where the web says "Check this model against the notice".
- A recall the cloud looked up could replace one the listing's words had matched, with a line saying the listing did
  not name it. The words' recall now stays on the card, soft, and the other is named beside it.
- The line naming a looked-up recall on a type flag now says "It may be", and that other makers sell look-alikes.
- "I own it" still used a buyer's words in four places: the finding ("The listing doesn't show which model"), the
  bumper advice ("before you buy"), the label result ("Don't buy it unless the seller shows...") and the cloud's
  reason ("The listing offers..."). Each now has the owner's words.
- A recall card keeps 140 characters of the remedy, cut mid-word on 6,295 of 10,481 cards. The card now shows whole
  sentences, and the full remedy whenever the notice was fetched for the cloud check.
- On the web page, when the built-in model fails on a photo, Gemini in the cloud now reads or looks instead, as the
  Android app already did.
- The web page's hybrid calls now run at temperature 0 as well. Section 18 said "the web cloud calls now use
  temperature 0"; that was true of the confirmation only.

**Claims corrected.** "Six of the 13 false alarms are UPPAbaby V2 strollers": six are UPPAbaby strollers and five of
those say "V2". "Most sellers don't know (Consumer Reports)" had no source and is removed. The finding that sellers
use generic names is from Consumer Reports' 2019 study, not its 2026 one. The write-up's "6 to 21 s" for an Android
check was 6.6 to 22.7 s. The 183 s run's record was cited from a folder that is not in the repository; it is now
`tools/try-run-nano.json`.

**0.12.0 results (2026-11-20).** 82 unit tests pass.
- **Extension, packed release, new Chrome profile (no built-in model):** all 17 end-to-end steps on the live practice
  page: 17 listings checked in 39 s, 8 flagged and confirmed in the cloud with no cloud error, the unnamed sleeper
  flagged "Inclined infant sleeper" with recall 23088 named through `lookup_recalls`, 9 recalls published since the
  build fetched from CPSC, and, new in this version, 4 CPSC safety warnings fetched live (W27-079, W27-080, W27-081,
  W27-089); report `tools/e2e-report-release.json`.
- **Extension with Gemini Nano, development build:** the 17 practice listings, 8 flagged, 8 looked at on the
  computer, the stroller's label read on the device (`tools/try-run-nano.json`). reCAPTCHA refuses that automated
  profile's release tokens (section 13), so the packed release has not been run with Gemini Nano.
- **Web page, "I own it", development build:** all 10 steps (`node tools/web-owner.mjs`,
  `tools/web-owner-report.json`): a recalled lounger, a product with no match and a padded bumper, each in the
  owner's words, with the remedy whole. A local build, because reCAPTCHA refuses an automated browser on the live site.
- **Android, release APK, Android 16 emulator (2 GB of memory, no Gemini Nano):** all 10 checks
  (`tools/android-e2e-out/report.json`): the App Check token 14 s after launch, the example, four shared texts, a CPSC
  warning, and the nickname listing where the cloud called the function and the phone answered; checks with a model
  call took 8.1 to 17.1 s. "I own it": all 6 checks (`tools/android-owner.mjs`,
  `tools/android-e2e-out/owner-report.json`).
- **A first Android run failed, and found a bug.** On an emulator starved by another test, the App Check page needed
  more than 25 s to load; the app gave up at 25 s, threw the page away and started again, so no token ever arrived
  and every cloud call was refused. A slow load is now left to finish, a failed load is retried at once, and the app
  asks for a token as soon as the page is ready (`appcheck/BridgeAppCheck.kt`).
- **An independent review of this version's code changes** (an AI reviewer, before release) found seven defects,
  all fixed: cached results ignored the new setting; waiting cloud checks no longer followed what is on screen; a
  listing that skipped the built-in model's look was left with words alone when the cloud failed; two faults in the
  Android token bridge; a cap that could skip new warnings for good; and a remedy cut exactly at a full stop.

## 20. A fifth review, and release 0.12.1 (2026-11-20)

A sixth independent review (an AI judge, not a person) recomputed every number in section 19 from the files and found
them right. It also found statements that claimed more than the files show, and ten bugs. No score moved.

**What the fifth test does and does not show.**
- **Not "frozen".** The decision rules were not changed after the labels were written. But one reliability fix (the
  stand-in notice when CPSC's API times out, section 19) was saved at 10:18, after the labels (10:06 to 10:08) and
  before the hybrid run (10:29 to 10:57). It was prompted by timeouts in a run of the first test set that morning,
  not by the fifth set, and it can only remove false alarms that a timeout causes. The release is one commit, so git
  cannot show the order; the file times can.
- **Changes after the run.** The queue shortcut (below), the review fixes and this section's fixes came after it.
  The test page (`tools/eval-test.js`) did not use the queue shortcut then; it does now.
- **One label per listing.** The three reviewers each labelled a third (60, 59, 59). 35 labels are marked low
  confidence, 2 of the 9 "should be flagged" among them. The reviewers are AI, worked on the same computer, and were
  given the product's own definitions of the risky types.
- **Few positives, and where they came from.** Nine, all on eBay; none among the 78 Craigslist listings. Six came from
  the two searches that name a hazard.
- **The 20 unclear listings are left out of both columns.** Eleven of them were flagged.

**The queue shortcut, stated plainly** (`extension/src/engine.js`, `wordsFirst`). In the extension, a listing whose
own words name a risky type (and no recall) no longer gets Gemini Nano's look: it goes straight to the cloud, which
it would reach whatever Gemini Nano said. So "Gemini Nano looks at each baby product" was too wide; it looks at the
ones the words leave open. A unit test checks every answer the built-in model can give against every answer the cloud
can give, for each risky type, and the flag is the same with or without the look
(`tests/round-six.test.mjs`). When the cloud call fails, Gemini Nano looks after all. No speed gain is claimed
(section 19).

**"77% never left the laptop"** adds five tests, each on the engine of its day: 15%, 8%, 33%, 32% and 21% went to the
cloud. When the first four sets were run again on 0.11.0, 28% went.

**The brand-stripped test** (section 19): its seven hits through the device's own lookup were made with Gemini's
lightest cloud model doing the look, as on a phone without Gemini Nano, and five of the seven are one Bumbo recall.
With Gemini Nano doing the look, the lookup fired three times on the first seven of those listings and was right
twice.

**Android shares.** The Android tests send a shared text or a photo with adb. No test shares from inside the Facebook
or OfferUp apps.

**Bugs fixed.**
- **The thorough setting did nothing on a page already open,** and a result could be marked as having had the cloud's
  look when it had not. Turning it on now reads open pages again and re-checks the listings that were cleared without
  the cloud; the engine marks each result itself. A new end-to-end step turns it on with the practice page open.
- **A page read again while it was still being checked queued its listings twice.** A listing is now queued once.
- **A Gemini Nano timeout was cached for a week** as "nothing found". A result whose model call failed is shown but
  not kept.
- **The cloud's lookup left out the recall the device's own lookup had guessed,** so the cloud asking for that very
  product was told "no recall" or given another notice (the fifth set's rocker got recall 19105, not 23088). Only the
  recall the listing's words matched is left out now.
- **A red "Recalled product" could rest on a stand-in notice** (CPSC's API down), which can lack the models a recall
  leaves out. A match made on a stand-in is now "Possible recall" at most (`confirm.mjs`, `capForStandIn`).
- **"Recall 23088" was not read as recall 23088.** The cloud's recall number is now read with words around it, and
  never matched in part.
- **Owner wording:** "the listing's price", "the item for sale" and "the seller's photo" are now the owner's words,
  and "Stop using it" became "Stop using it unless the recall's fix has already been done".
- **A recall API failure stopped the warnings from being read,** and a renamed column in CPSC's warnings file would
  have read as "no warnings". The two sources are now independent, and unexpected columns are an error.
- **Android token bridge:** a page that became ready at 22 s was destroyed by the 25 s timeout before it could answer.
  A request's time now runs from when it reached the page.

**0.12.1 results (2026-11-20).** 87 unit tests pass.
- **Extension, packed release, new Chrome profile (no built-in model):** all 18 end-to-end steps on the live practice
  page (`tools/e2e-report-release.json`). The new step turned the thorough setting on with the page open: 9 listings
  were checked again, the listings that had been to the cloud went from 8 to 10, and the 8 flags stayed 8.
- **Web page, "I own it", development build:** all 10 steps (`tools/web-owner-report.json`).
- **Android, release APK, Android 16 emulator (2 GB, no Gemini Nano):** all 10 checks, the token 18 s after launch,
  and all 6 "I own it" checks. Checks with a model call took 17.9 to 54.1 s in this run, against 8.1 to 17.1 s two
  hours earlier on 0.12.0: the cloud's main model was answering in 36 to 40 s, and twice timed out to the fallback
  model. Two earlier attempts on this version failed for the emulator's sake, not the app's: once the token took more
  than 45 s right after boot, and once Android's own "System UI isn't responding" dialog covered the app (the test
  now chooses Wait). The test computer was short of memory all afternoon.
- **Not run on this version:** anything with Gemini Nano. The computer had under 2 GB free, and Gemini Nano needs
  about 5. The last run with it is 0.12.0's (section 19).

## 21. A design review, and release 0.13.0 (2026-11-24)

Three separate reviews: the website and extension by design heuristics, the same pages by an automated detector, and
the Android app as a native design review. No accuracy rule changed in this release. What changed is how the product
behaves around a check:
- **Cost:** the web page asked Gemini to write field-guide entries for new recalls on every first visit (about 13
  cloud calls before the visitor did anything). There, new recalls are now matched by their words. The extension and
  the Android app, which keep their entries for days, still have Gemini write them.
- **Dark theme** on the website, the extension's side panel and welcome page, and the Android app, from the system
  setting. Badges on a marketplace page stay light, like the page around them. Text contrast was measured in both:
  no pair under 4.5:1 (lowest 5.8:1 light, 6.0:1 dark).
- **Errors by cause** on the web page and the phone: not a picture, offline, cloud busy or slow, App Check. The
  failed step stays marked, "Try again" re-runs the same input, and typing the product, which works offline, is
  offered.
- **Screen readers:** one status line instead of re-reading the whole panel or result; headings, step states, live
  regions and a labelled switch on Android; visible focus on the web page's screenshot picker; the badge says whether
  its card is open.
- **A bug on Android:** once an item was watched, a second "Watch for recalls" button stayed on screen, and tapping it
  removed the watch. Now the card says "Watching this for recalls", with a separate "Stop watching".
- **The practice page** can show the badges from a recorded run of the extension, labelled as a recording with its
  date and version, for anyone who can't install it.

**0.13.0 results (2026-11-24).** 87 unit tests pass.
- **Extension, release build (no debug token) loaded in a new Chrome profile (no built-in model):** all 18 end-to-end
  steps on the live practice page (`tools/e2e-report-dev.json`, named for the unpacked folder it ran from). All 8 recalled listings flagged, the recall published after the build among them; the cloud asked the device's
  field guide for the unnamed sleeper and the device returned 23088; no engine errors. That run wrote
  `web/try/recorded.json`, the practice page's preview.
- **Android, release APK, Android 16 emulator (no Gemini Nano):** all 10 checks, the token 31 s after launch, checks
  with a model call 9.0 to 18.8 s; all 6 "I own it" checks. In dark mode, the result screen and the watch card were
  checked on screen, and after "Watch for recalls" was tapped no second watch button was left.
- **Not run on this version:** anything with Gemini Nano.

## 22. The rest of the design review, and release 0.13.1 (2026-11-24)

The items the three reviews left open, and two kinds of testing that had never been done. No accuracy rule changed.
- **The result survives Android closing the app.** A shopper sends the seller question from Messenger and comes back;
  if Android closed the app meanwhile, the result used to be gone. It is now kept in the app's own cache and comes
  back on return. A fresh launch the next day still starts clean.
- **Logcat no longer holds the cloud's answer.** The line written after each check now holds where each step ran and
  recall numbers only: not the listing's words, the cloud's reasoning, or what the cloud asked the field guide for.
- **Words that name no product** ("this one, like new, pick up only") get "We couldn't tell what the product is", with
  an example of what to type, instead of "No recall found". No model is called, and no watch is offered.
- **One no-match view for the web page and the phone** (`shared/present.mjs noMatchView`): the same words, the same
  count of notices searched, and the safe-sleep line only for things a baby sleeps in.
- **Android:** Back from a result that came from another app's share menu goes back to that app. On a tablet, an open
  foldable or a phone on its side, the tabs move to a rail at the side. "Alerts are off" updates when the user comes
  back from the notification settings. A type flag that also points to a recall links that recall's notice, as the
  extension's card does.
- **Web page:** a sample match beside the form before anything is added: a result the extension produced on the
  practice page, shown with its date.
- **Extension:** "No matches on this page" lists what was checked (how many listings, against what, how many photos
  were looked at, how many went to the cloud). The no-model notice is one line that opens on demand. The side panel
  zoomed to 200 percent (about 180 CSS pixels wide) no longer overflows: the card goes to one column and buttons wrap.
  Badge text went from 12 to 13 px.

**New: automated accessibility checks.**
- `node tools/a11y.mjs` runs axe-core (the engine behind Lighthouse's accessibility score) with the WCAG 2.2 A and AA
  rules on the web page, the practice and privacy pages, six views of the extension's side panel and its welcome page,
  light and dark, at 390 and 1280 px: 40 page views. The first run found one problem (a heading level skipped on the
  welcome page), now fixed; the run after it found **0 violations** (`tools/a11y-report.json`). Every Google and
  Firebase request is blocked during the run, so no model is called.
- `node tools/android-a11y.mjs` goes through the Android app's start, watching, how-it-works and no-match screens at
  normal text size and at 200 percent, scrolling through each, and checks every tappable element: at least 48 by 48 dp,
  a name a screen reader can say, nothing past the screen's edge. **29 screen views, 0 problems, 0 model calls**
  (`tools/android-a11y-out/report.json`). It does not cover the flagged-result screen, which needs the cloud.

**0.13.1 results (2026-11-24).** 90 unit tests pass (three new: the no-product words, the shared no-match view, and
the same view from the Android engine).
- **Android, release APK, Android 16 emulator (no Gemini Nano):** the 10 checks of 0.13.0 again, the token 32 s after
  launch, checks with a model call 8.8 to 47.9 s (the emulator was slow: 8 minutes to boot). New and passing: the log
  keeps no listing words or cloud answers; Back after a share leaves the app; the result survives Android killing the
  app; words that name no product get the new message with no model call. The full run stopped at the kill step
  because the test script's own process check threw once the process was gone (the state being tested); that is fixed,
  and the four checks after it were run from the same point by a short script. `tools/android-e2e-out/report.json`
  records both. In landscape the side rail showed, and at 200 percent text the screens read without clipping.
- **Extension:** unit tests and the panel views in a browser (no overflow at 180 or 360 px, `tools/a11y.mjs` above).
  The 18-step end-to-end run, which calls the cloud, was not repeated for this release: no checking code changed in
  the extension, only how the panel shows results.
- **Still not tested:** a screen reader run by a person (TalkBack, VoiceOver or NVDA), Safari and iPhone, and anything
  with Gemini Nano.

## 23. The Android app on a real phone, with Gemini Nano (2026-11-24)

The builder's own Pixel on Android 17, over Wi-Fi debugging, with Gemini Nano already on the phone (AICore reports
`nano-v4-full`). The release APK of 0.13.1, the same file as the GitHub release, so App Check went through the
reCAPTCHA bridge as it does for anyone who installs it. `node tools/android-e2e.mjs --nano`,
`tools/android-e2e-out/report-nano.json`. The report keeps the phone's family and Android version only, and no names of
the owner's own apps.

**17 of 17 steps passed.**
- The App Check token arrived **3 s** after launch (32 s on the emulator).
- **Every check that reached a model was read by Gemini Nano on the phone**, in about 1 s (0.95 to 1.0 s for shared
  text; 2.2 s and then 1.2 s for the example photo, a look at the picture and then at its words). Gemini in the cloud
  then compared the listing with the recall notice: **5.1 to 14.5 s**. A whole check took **6.5 to 15.8 s**, against
  8.8 to 47.9 s on the emulator, where the cloud did both steps.
- The checks gave the same results as on the emulator:
  - the example lounger was named as recall 26591;
  - the Rock 'n Play was named;
  - the Graco swing was flagged as a possible recall;
  - the Aila+Aiden lounger got the CPSC warning;
  - the listing that names no brand ("the rock and play one") was flagged by type, and the cloud asked the phone's
    field guide and got 23088;
  - the wooden blocks got no match, with no model call;
  - the Kidsview bouncer, recalled after the build, was flagged;
  - words that name no product got "We couldn't tell what the product is", with no model call.
- Also passed on the phone:
  - the log kept no listing words and no cloud answers;
  - Back after a share returned to the app the phone had open before;
  - the result came back after Android closed the app.
- Billed: 6 cloud calls in the app's log, one for each check that reached a model. The nickname check's question to the
  field guide is part of its one call.

**Accessibility on the same phone** (`node tools/android-a11y.mjs`, `tools/android-a11y-out/report-phone.json`): the
start, watching, how-it-works, no-match and nothing-to-match screens at the owner's own text size (115 percent):
**10 screen views, 0 problems, 0 model calls**.

**What the test tools needed for a real phone.**
- **The phone has a second user** (a work profile). Android refuses an install or a reset that does not name the main
  user, so the tools now pass `--user 0`.
- **Over Wi-Fi the phone is listed twice** (its address and its network name), so the tools use one of the two, or the
  one `ANDROID_SERIAL` names.
- **Its log rolls over within seconds**, so the tools now record the app's own log lines as the run happens, instead of
  reading the log back at the end.
- **The tools no longer change a real phone's settings.**
  - The first accessibility run set the phone's text size to 100 percent for the run and set it back afterwards.
  - The tool now checks a real phone at the size its owner chose, and leaves the setting alone. Only with
    `--large-text` does it also check 200 percent.
  - On an emulator it still checks both 100 and 200 percent.

**Gemini Nano download.** The app already offered "Download Gemini Nano" when the phone can get it. It now logs why a
download failed, and gets the model ready as soon as the download ends. These changes come in the next release; the
run above used 0.13.1.

**Not shown by this:**
- **One phone, with one owner.** How Gemini Nano reads listings on other phones, and on a slow mobile connection, is not
  known.
- **A screen reader run by a person** (TalkBack) is still not done.

## 24. The shared field guide, label photos cloud first, and Firebase's agent skills (2026-11-24)

**The shared field guide** (Cloud Firestore, anonymous Firebase Authentication, a server prompt template; README, "The
shared field guide").

Measured on the builder's Pixel with a development build, App Check enforced on Firestore and AI Logic. CPSC had 9
notices newer than the app's recall list.

| Run | New notices | Read from the shared guide | Written by Gemini on this device | Gemini calls |
|---|---|---|---|---|
| First device (empty guide) | 9 | 0 | 9, through the template `field-guide-v1` (1.1 to 1.6 s each) | 9 |
| The same phone again, a fresh install | 9 | 9 | 0 | 0 |
| Again, after App Check was enforced on Firestore | 9 | 9 | 0 | 0 |
| The web page, local development build | 9 | 9 | 0 (the page writes none) | 0 |

- **The 9 entries passed the security rules**, and each one fits its notice by the code check (`fitsNotice`): every
  brand, line and model number in the entry is in the notice.
- **One test call to the template**, on recall 26591, gave an entry of the right shape that fits the notice: brand VEVOR,
  every unit recalled, the print names from the notice.
- **The rules**: 7 tests on the Firestore emulator (`npm run test:rules`). They cover a write by a signed-in device and
  a read by another; nothing without sign-in; the first entry stands (no overwrite, update or delete, even by its
  writer); no listing; the writer's id must be the caller's, with the server's time; 9 wrong shapes refused; every
  other path closed.
- **The code check**: 5 unit tests (`tests/fieldguide.test.mjs`). They cover a planted brand, a planted model number,
  and an entry emptied to hide a branded recall: each is refused.
- **What it changes for cost:** a new recall's entry is paid for once, not once per device. Before this, every phone
  and extension wrote its own entry: one Gemini call per new notice on each device (up to 60 in one refresh).

**Label photos, cloud first** (`PREFER_IN_CLOUD`, Android and web). Gemini Nano misread one recalled model
number on 12 real label photos from CPSC notices (2026-11-18), and a reassuring reading went to the cloud anyway. So a label is now read by
Gemini in the cloud first; with no signal, Firebase AI Logic gives it to Gemini Nano on the device, and that reading can
raise the alarm but not clear it. Not measured with the network off yet.

**Firebase agent skills.** Firebase's official agent skills (github.com/firebase/agent-skills, 14 skills) were installed
for Claude Code. The Firestore, rules-authoring, Authentication and AI Logic skills guided this work. Following them:
- Firestore was set up in the US, with default-deny rules, a data model written at the top of the rules file, a
  validator function for the document, and tests.
- Anonymous Authentication was turned on through `firebase.json`.
- The template was created with the AI Logic REST API and locked.

**Sixth test set, collected, not yet run.** 180 listings collected on 2026-11-24 with searches and cities no earlier
set used. It is aimed at infant sleep products that sellers list without a brand: eBay, used condition, 10 each for
"newborn sleeper", "portable crib", "baby hammock", "moses basket", "baby cradle", "travel bassinet", "mini crib",
"infant sleep positioner", "baby sleep pod" and "crib mattress", plus Craigslist in Minneapolis, Philadelphia, Dallas and
San Diego (`tools/collect-sixth.sh`, `tools/sixth-listings.json`). About half of the Craigslist listings are not baby
products (bike racks, pet playpens); they stay in, as false-alarm tests. Three AI reviewers (Claude) labelled it blind,
60 listings each (`tools/sixth-label-brief.txt`, `tools/sixth-labels-a.json`, `-b.json`, `-c.json`): **7 must be
flagged, 16 can't be settled from the listing alone, 157 must not be flagged.** Of the 7, five are unbranded loungers,
nests or hammocks, the kind the planned rule is for. The run that would score the "no-brand sleep product goes to the
cloud" rule on it is in section 25.

**Yard-sale mode (Android; Gemini Live with function calling).** At a yard sale or a thrift store, the parent points
the phone's camera at the baby gear. Gemini Live (Firebase AI Logic's Live API, `gemini-live-2.5-flash-native-audio`
on the Agent Platform in us-central1) watches one frame a second and listens. For each baby product it calls
`lookup_recalls`, and the phone answers from its own field guide and the banned-type rules (`shared/live.mjs`, run in
the app's rules engine). The rows on screen come from that answer, not from the model. "Check this one closely" sends
the frame through the full check, with Gemini Nano on the phone first. A session is capped at two minutes (Remote
Config `yard_sale_minutes`), and Remote Config can switch the mode off or change the model.
- **The Live flow, tested from the PC** (`tools/live-probe.mjs`): the same endpoint, App Check, prompt,
  function and lookup code, with words in place of the camera ("a pink Fisher-Price Rock n Play sleeper, and next to it
  a padded crib bumper set with no brand on it"). Gemini called `lookup_recalls` within 0.7 s. The lookup answered:
  - Rock 'n Play: recalls 23088 and 19105, and the banned inclined-sleeper type;
  - bumper set: the banned crib-bumper type.
  Gemini then said only that, in about 4 s.
- **A fix it found.** In the first run Gemini warned about the bumper set without asking the lookup, because the
  function then required a brand. The brand is now optional, and the prompt asks for a lookup for every product before
  anything is said about it.
- **The web page has no yard-sale mode.** Firebase AI Logic's web SDK sends no App Check token on the Live
  connection, so App Check refuses it (tested: "Firebase App Check token is invalid"). The Android SDK sends it.
- **On a real phone (Pixel, Android 17, 2026-11-24),** a development build with typed words in place of the camera
  (`dev_yard_text`, which sends no picture or sound): App Check's token arrived, the Live session opened 1.2 s later
  (us-central1), the phone answered `lookup_recalls` 1.8 s after that (2 recalls, 1 banned type: the Rock 'n Play and
  the inclined-sleeper type), and Gemini spoke at 6.9 s. Gemini asked one lookup for the two products in the sentence;
  the bumper set got no lookup of its own in that run (the PC probe asked one each). 5 unit tests cover the lookup
  (`tests/yardsale.test.mjs`).
- **Two things the phone run found.** The test never reached "Test finished": two minutes later the screen still
  said it was running. The likely cause, not proven, is the end of the session cancelling the test's timer. The test
  now catches that, ends either way, and logs what Gemini said.
  And a session ending on the server's side had no follow-up: the app now listens for the server's "going away"
  message and opens the next session with the camera still on. The Live location is now a list (us-central1, us-east4,
  us-east5), tried in order; all three, and europe-west4, accepted a session on 2026-11-24.

## 25. The unnamed-sleep rule, scored on the sixth blind test, and every service backed up (2026-11-24)

**The rule** (`shared/triage.mjs`, `unnamedSleep`; in the extension's queue only, `extension/src/engine.js`). A
listing with no recall candidate, no risky word, no brand any recall or warning card names, and a sleep-type kind in
its title (rocker, sleeper, lounger, nest, pod, pillow, positioner, bassinet, cradle, swing, bouncer, hammock, dock)
gets the cloud's look even when Gemini Nano sees nothing, and the cloud may raise a soft flag on its own. It was
written from the fifth test's two misses, before the sixth set was labelled, and was not changed after the run.
Remote Config `unnamed_sleep_cloud` turns it off for every copy.

**The sixth test, run once** on the sixth set (section 24: 180 listings, labelled blind by three AI reviewers, Claude),
with Gemini Nano on this PC and the cloud (`node tools/eval-run.mjs --set=sixth`, `tools/sixth-results-hybrid.json`,
`tools/sixth-results-words.json`; scored by `node tools/eval-score.mjs --set=sixth`). The run stopped once at 60
listings when the session running it restarted, and went on from there with `--resume` on the same build.

| Same engine, run as | Caught (of 7) | False alarms (of 157) |
|---|---|---|
| Words only | 3 | 14 |
| Built-in model only | 3 | 13 |
| **Hybrid, with the rule** | **6** | **1** |

- **What the rule did.** 37 listings fit it; Gemini Nano cleared 35 of them, so the rule sent those 35 to the cloud
  (one timed out; of the 34 answered, labels: 3 must be flagged, 3 can't tell, 28 must not). The cloud flagged 3, all 3 of the ones that must be: a
  "Baby & Joy" crib hammock, a "Portable Safe Soft Baby Sleeper/Bassinet" and a pack and play with a bassinet (recall
  09265, through `lookup_recalls`). It flagged none of the 28. Without the rule, Nano's "nothing here" would have
  stood for all 34: the same run would have caught 3 of 7.
- **The miss.** "Happiness Baby Safety Baby Cradle Free Hanging Hammock": one recall card lists "Happiness" as a brand,
  so the rule took the title as branded and left it to Gemini Nano, which saw nothing. Not changed here: tuning the
  brand list on this set would spoil its number.
- **The false alarm** is a soft flag: a Stokke Sleepi crib mattress shown as a possible match for an older Stokke
  recall (07286). It did not come from the rule.
- **Cost and speed.** The cloud saw 54 of 180 listings (30%; 20 without the rule's 34); one cloud check timed out (a jet ski
  cradle the rule had sent, which then stayed unflagged). Gemini Nano looked at 132 (median 6.6 s each, including the cloud check where there was
  one). About 60 billed Gemini calls in all.
- **A bookkeeping bug.** The results file's `unnamedSleep` column came out false on every row: `present()` dropped the
  field. The numbers above come from the triage code and the device's answer instead
  (`tools/sixth-rule.mjs`). Fixed for later runs.
- **A duplicate, found by the seventh review.** Two of the 7 are the same Craigslist post listed twice (same title,
  price and photo: "Brand New in a Package Newborn Baby Nest", ids `3QsxrpnbkwhLoXdzkrFawL` and
  `mBK4CPDPmCgSpktyKYkWp4`). Counted once: 5 of 6 caught. Five other titles appear twice or more in the set (each a
  "no"), and the fifth set has three such titles.
- **What weakens it.** Seven listings that must be flagged is few; each is 14 points. The labels are AI labels, not a
  parent's. The searches were aimed at the rule's own kind of listing (section 24), so the share of listings it fires
  on is higher here than on a page a shopper would browse.

**Every service has a backup** ([backups.md](backups.md)). New in 0.14.0:
- A third cloud model, `gemini-3.5-flash`. Probed first: the two newest models answer only at `global`, and older
  stable models were not offered at any location tried.
- A daily mirror of CPSC's recall API (`tools/recall-mirror.mjs`, `.github/workflows/recall-mirror.yml`), read through
  jsDelivr, then `raw.githubusercontent.com`, only when CPSC can't be reached. The extension, the web page and the
  Android app all use it, for new recalls and for one notice's text. 3 unit tests (`tests/mirror.test.mjs`).
- Gemini Live in three locations in turn (us-central1, us-east4, us-east5), and a new session when the server says
  the current one is ending.
- Git bundles of both repositories and a copy of the Android release key on a second local drive.

## 26. A seventh review, and release 0.14.1 (2026-11-25)

A seventh independent review (an AI judge, Claude, not a person) read 0.14.0 from the repository alone, recomputed the
headline numbers from the result files and scored it 4.5 for technology, 4.0 for design, 3.5 for impact and 4.5 for the
idea, with the demo video as the one Stage One item still open. Its numbers matched except where listed below. What
0.14.1 changes from it:

- **An exact model-number match stays a soft flag when the cloud says no** (`shared/confirm.mjs`, `decideFinal`). A
  model number in the listing that the recall lists is matched by code; the cloud's "no", or its "part or accessory",
  used to clear it. Now it can weaken it to "Possible recall, check the label", never to nothing. A brand-only match the
  cloud rules out is still cleared. Test: `tests/round-six.test.mjs`.
- **A shared field-guide entry must fit the notice in its years and in the numbers of its "which units" line**
  (`shared/fieldguide.mjs`, `fitsNotice`). A planted entry with years the notice never states could have dropped a real
  match for a listing that gives its year; one with other model numbers in its "which units" line could have sent a
  shopper away from a recalled unit. Checked against 264 real entries Gemini wrote at build time with their CPSC
  notices (`tools/fits-real.mjs`): 256 fit, the same as before but one. A third check tried, that an "all
  units" entry come from a notice saying "all units", turned away 117 honest entries and was dropped: that claim can
  only make a card more cautious. Test: `tests/fieldguide.test.mjs`.
- **Yard-sale mode shows a banned type as "May be banned to sell"**, not the red "Banned to sell": the type comes from
  the words Gemini Live used for what it saw, and only the full check ("Check this one closely") looks at the item.
- **The docs caught up with 0.14.0:** the label photo is read in the cloud first (README, submission, video plan); the
  sixth test, with the duplicate above, is in the README and the submission; 108 unit tests; the privacy policy covers
  the anonymous sign-in, the shared guide in Firestore, the recall mirror and yard-sale mode's camera and microphone;
  the submission lists Firestore, Authentication, server prompt templates and the Live API; the video plan crops
  marketplace logos (the rules forbid third-party logos in the video).
- **Two small mismatches it found, left as they are and explained here:** the fifth test's "median 7.0 s" is over all
  178 rows (7.2 s over the 156 Gemini Nano looked at); the warning count, 392 in the docs, is right: CPSC's warnings file
  has 393 lines once quoted line breaks are joined, and one of them is the header row (392 records, 392 cards).

## 27. Five AI persona walkthroughs, and release 0.15.0 (2026-11-25)

No parent has used Still Recalled yet. As a stand-in that is clearly not one, five AI agents (Claude) each played a
realistic U.S. user and walked through the real screens: the live site at phone and laptop size, the extension and
Android screenshots, and every sentence a user can read. They ran no check and called no model. **These are AI
persona walkthroughs, not user research**: they find problems worth fixing, and say nothing about how many real people
would use it. The reports are kept outside the repository.

| Persona (played by Claude) | Where they shop | Would use / recommend (their own 1 to 5) |
|---|---|---|
| First-time parent, Columbus, iPhone, Facebook Marketplace | web page | 3 / 4 |
| Grandfather, 67, Tucson, Android at large text, yard sales | Android app, yard-sale mode | 3 / 2 |
| Consignment shop owner, Atlanta, eBay and Mercari | "I own it", extension | 3 / 3 |
| Father of twins, San Antonio, Spanish at home, Craigslist | extension, web page | 2 to 4 / 2 |
| Safe-sleep nurse educator, Milwaukee children's hospital | every result's wording | recommend 2 |

**What 0.15.0 changes because of them:**
- **Safe sleep on every sleep-related result** (`shared/present.mjs`, `sleepLine`). Three of the five found the same
  gap: a result about a product read as the whole answer. Now a crib, bassinet or play yard says "Every sleep: baby
  alone, on their back, in a crib, bassinet or play yard with only a fitted sheet" (AAP 2022, CPSC Safe Sleep); a swing,
  bouncer or car seat says it is not for sleep and to move a sleeping baby; a lounger says "not for sleep, recalled or
  not"; an inclined product says babies sleep flat; a crib bedding set says quilts and comforters are decoration only.
  The line shows on recall cards too (a recalled lounger's card said only "recalled"), on no-match results, and to
  owners.
- **The lounger result says "Skip this one"**, as bumpers and inclined sleepers already did. It said only "Never use it
  for sleep", which a tired parent can read as "fine for awake time"; babies fall asleep in them.
- **The mesh-liner line no longer reads as "mesh is fine"**: mesh liners are outside the sales ban, but safe-sleep
  advice is still nothing in a crib but a fitted sheet.
- **A play-yard pad or mattress taken for "a part"** now says to use only the one that came with it, since extra padding
  can suffocate a baby. It was cleared with "a part, not the product itself".
- **Car seats** get a line on a no-match result: their recalls are kept by NHTSA, not CPSC (nhtsa.gov/recalls). A crib
  gets the June 28, 2011 standard line. The home page now says "every CPSC recall notice", not "every U.S. recall".
- **Spanish titles get checked.** An English-only word list meant "Protector para cuna trenzado" (a braided crib
  bumper) or "Mecedora para bebé" got no look at all, and silence reads as "nothing found". `shared/triage.mjs` and
  `shared/banned.mjs` now know the Spanish names for baby gear and the four sleep types. 1 of the 1,072 listings in the
  earlier test sets is touched (it already counted as baby gear in English), so their results stand. Not yet measured
  on real Spanish listings; 3 unit tests (`tests/spanish.test.mjs`). The screens are still English.
- **Yard-sale mode is firm, on condition.** For a Rock 'n Play it showed "Possible recall" and "May be banned to sell",
  while the typed check said "Don't buy it". Now an every-unit recall reads "Don't buy it: if this is the Rock 'n Play
  Sleepers, every unit is recalled", and a sleep type reads, for example, "If this is an inclined sleeper: don't buy it".
  Gemini Live is told the same lines. A lounger is no longer called illegal to sell: the voice said "cannot legally be
  sold" for every type, and loungers are not banned as a class.
- **Smaller:** the recall notification starts with "Recall:" and the item's name, and says to stop using it until the
  label is checked; the extension's welcome page says labels are read in the cloud first; the cloud switch's words
  match its position; the "new" pill wraps at large text; the site has a link preview for Facebook groups and texts.

**What they asked for that is next, not done:** Spanish screens; a saved last result, so the label check still works
when the seller replies hours later; an intake log with export and batch photos for consignment shops; a seller mode in
the extension; a quiet yard-sale mode with the microphone optional; a printable "never buy secondhand" card with a QR
code for WIC offices, crib programs and grandparents; a named maintainer and the web page as the only route offered to
families until the app is in the Play Store; and a human-checked label set, which the nurse persona put first for any
hospital to recommend it.

## 28. What the personas asked for next, and release 0.16.0 (2026-11-25)

Four requests from the AI persona walkthroughs in section 27, built:

- **A printable card** (`web/card.html`, `?lang=es` for Spanish; PDFs in `web/card/`). One US Letter page for WIC
  offices, crib programs, clinics and grandparents: the four kinds of baby sleep products never to buy secondhand
  (inclined sleepers, padded crib bumpers, loungers and nests, cribs made before June 28, 2011 and drop-side cribs),
  the safe-sleep basics, car seats to NHTSA, and a QR code to the check (`?from=card`). Four of the five personas asked
  for something like it. Its claims are the ones the result cards already make, with their sources on the card.
- **Spanish** (`shared/i18n.mjs`). Every result, the result card, the label check and the web page read in Spanish when
  the visitor chooses it, the link says `?lang=es`, or the browser is set to Spanish. On Android, results follow the
  phone's language; the app's own screens are still English. Seller questions are in Spanish only when the listing
  itself is in Spanish, since the seller reads them; reports to CPSC stay in English, for CPSC's English form. The
  Spanish was written by an AI (Claude) and has not been reviewed by a native speaker; the page says so. Lines that
  come from Gemini's check of a listing, and CPSC's own notices, stay in English.
- **Saved checks** (`web/src/log.js`). Every check on the web page is kept in the browser, with a small copy of the
  picture. "Your checks" on the start page opens one again, label check included, when the seller's label photo
  arrives hours later. Nothing is sent anywhere.
- **An intake log for resale shops.** The same saved checks, as a table: an optional batch or consignor name stamped
  on new checks, several photos at once (checked one after another), a CSV download, and a print view. A label check
  done later is written into the check's row.

**Tested:** `node tools/web-log.mjs` on the development build, 12 of 12 steps (`tools/web-log-report.json`): a check is
saved and opens again with its result, the log and CSV work, `?lang=es` turns the page to Spanish, "Protector para cuna
trenzado" is flagged as a padded crib bumper in Spanish with the safe-sleep line, and a no-match crib in Spanish carries
the 2011 crib line. Three cloud calls. 116 unit tests (`tests/i18n.test.mjs`, `tests/log.test.mjs` new).

## 29. A census: what is for sale on eBay right now (2026-11-25)

The tests above measure Still Recalled. This measures the problem. On 2026-11-25, 12 eBay searches for the four sleep
types (`node tools/census.mjs --site=ebay`, `tools/census-ebay.json`), reading the first page of results of each (about
120 listings; one search, "baby bedding set bumper", returned nothing and is not counted): 1,077 listings. The word
rules flagged 443 by their titles (`node tools/census-score.mjs`): 392 named a sleep type and 51 only a recalled
product line (these 51 were left out: on these searches they were toys sharing a line's words, "Little People Play 'n
Go", "Rock & Play Piano"). An AI reviewer (Claude) then labelled each of the 392 from its title and looked at the photo of 70, including a random 44 of those it called "yes" (none changed)
(`tools/census-ebay-labels.json`).

| What was for sale | Listings | Asking, in all |
|---|---|---|
| Infant loungers and nests a baby lies in | 199 | |
| Padded crib bumpers | 1 | |
| **Together** | **200** | **$12,152** |

- **eBay's own policy** lists infant loungers, nests and positioners, inclined sleepers and crib bumpers among the
  products it does not allow (eBay product safety policy; docs/research/sources.md). CPSC says loungers are never for
  sleep.
- **What eBay's filters do catch:** no recalled Boppy lounger was among the 200, only covers for one; the only
  inclined-sleeper matches were 1980s toy playsets; one padded bumper got through. The named, recalled product is
  filtered. **What gets through:** 58 are Snuggle Me loungers, 45 DockATot (also written "Dock A Tot"), 2 Snuggle
  Nest, 5 other named brands, and about 90 have no brand word in the title (a count by a word list, so a rough one). A lounger with no brand, under a generic title, is the case the hybrid's photo check and the unnamed-sleep
  rule are for (section 25).
- **How to read it.** It is a floor and a snapshot: the first page of each search, on one day, with listings the
  reviewer could not settle (10) left out. Condition: 19 new, 11 used, 170 not stated; many are new products shipped
  by sellers, so this is not only resale. The labels are an AI reviewer's, not a person's. Precision of the word rules
  on these hazard searches was 200 of 392 (covers, patterns and bed rails share the words), which is why nothing here
  is counted on words alone.
- No listing was reported or contacted. Reporting them (eBay's "Report this item", or SaferProducts.gov) is the
  builder's decision.

## 30. An eighth review, of 0.16.0, and release 0.16.1 (2026-11-25)

The eighth AI review (Claude, not a person) scored 0.16.0 at 4.5, 4.0, 3.5 and 4.5, recomputed every headline number
(all matched except the census brand counts and two test lines, corrected above and in the submission), and found:

- **The device could clear an exact model-number match on its own.** When the listing gives a model number the recall
  lists and Gemini Nano said "not the same product" or "a part", the match was dropped and never reached the cloud.
  Now it stays a soft "Possible recall" and goes to the cloud (`shared/judge.mjs`). In every test so far, 2 listings had
  an exact model-number match and Gemini Nano agreed on both, so no test result changes.
- **A shared field-guide entry could make a card less cautious.** `fitsNotice` checks the names, models and years an
  entry gives, but not its "which units" wording or its "every unit" flag, and the first entry for a notice stands. Now
  a device uses a shared entry only to add a match: the "which units" line is dropped (the card says to read the
  notice) and "every unit is recalled" is kept from the entry or from the notice's own words (`cautiousEntry`).
- **A saved check is a snapshot.** Reopened, it now says when it was made and offers "Check it again against today's
  list". The log says it keeps the newest 500.
- **Spanish matching missed accented words** ("cojín", "moisés": JavaScript's word boundary does not see accented
  letters) and a padded crib set named "con protectores acolchados". Fixed, with tests. Two Spanish lines were reworded
  where they could be misread ("Para cada sueño", "Solo.").
- **A label's year against the build's years** now says "Dated outside the years we have for this recall" and to check
  the notice, not "Dated outside this recall": the years come from a model's summary of the notice.
- The CSV guard also blocks a leading tab or carriage return.
- **Noted, not changed:** the test reviewers and the agent that built the engine are the same model family (Claude),
  which is one more reason a person should check the labels. Word-rule recall matches on toys sharing a line's words
  (a "Rock & Play Piano") still reach the device's look and the cloud, which clear them; they are never shown on words
  alone.

## 31. Facebook Marketplace, a Craigslist census, a page for shops, and release 0.17.0 (2026-11-25)

**Facebook Marketplace in the extension.** The extension now reads Facebook Marketplace search pages, item pages, and
an item opened in a dialog over a search (`extension/src/extract.js`). On facebook.com it reads Marketplace pages
only: the feed, messages, profiles and groups are never read (unit test `tests/extract.test.mjs`). The card's title
comes from the link's name ("Baby lounger, $5, Charlotte, NC, listing 1100…"), cut at the price. On an item page,
Facebook's own general recall notice and the seller's profile are left out of the description, so they never count as
the seller's words. Facebook changes its page many times a second, so the content script now scans at least every
2 s while the page keeps changing instead of waiting for it to settle.

Tested on public Marketplace pages, logged out, in a throwaway Chrome profile. No Facebook account was used.
- `node tools/facebook-check.mjs` (the reader): 13 of 13 checks in Charlotte, Houston and Atlanta, among them search
  pages (15 listings each, every one with title, price and photo), an item opened from a search, the item page itself,
  and nothing read outside Marketplace.
- `node tools/e2e.mjs --headful --ext=dist/still-recalled-extension --url=<Marketplace search>` (the packed 0.17.0
  release): **16 of 16** on a Charlotte "baby lounger" search: 15 of 15 listings checked in 54 s, 14 confirmed in the
  cloud with no errors, 14 badges, toolbar count 14, badge click stays on the page, the card offers "Ask the seller".
  The same release on eBay: 16 of 16 (60 listings, 44 flagged); on the practice listings at /try: 18 of 18. Each run
  is kept: `tools/e2e-report-release-facebook-0170.json`, `tools/e2e-report-release.json` (eBay),
  `tools/e2e-report-release-try.json`.
- Development-build runs before that: one where Facebook's logged-out sign-in box covered the card (the test now closes
  it; signed in, Facebook does not show that box, but no signed-in run has been made), and one with 2 cloud calls over the 40 s limit, which also left the
  "thorough setting" step with nothing new to send. Those are cloud slowness on that run, not reader faults.

**The card points to the marketplace's own rules** (`sitePolicy` in `extension/src/ui/detail.js`). For a likely flag,
it says the site's rules don't allow the item and that it can be reported to the site from the listing page: recalled
products on all four sites, and the infant sleep types on Facebook Marketplace and eBay, whose policies name them
(sources.md, section 7). A lounger that no law rules out still breaks those two sites' rules, so the shopper can have
it taken down there.

**A Craigslist reader fix.** The census below found two faults in the Craigslist reader:
- the title kept the photo counter ("… lounger 1");
- the price was read from the card's whole text, so a title's "$100" ran into the counter and read as "$10011".

Now the title comes from the result's own title attribute, and a price must be its own piece of text. The census was
run again with the fix; the first run's numbers are not used. eBay was rechecked: 126 of 126 listings with a price.

**A census of Craigslist** (`node tools/census.mjs`, `tools/census-craigslist.json`). On 2026-11-25 the same four
searches were run on the 30 largest U.S. metro areas with their own Craigslist site: "rock n play", "crib bumper",
"baby lounger" and "baby nest", 120 searches in all, every listing on each results page. That gave 1,261 listings. The
word rules flagged 80 (`node tools/census-score.mjs tools/census-craigslist.json`). An AI reviewer (Claude, a separate
agent) then labelled each one from its title and looked at 42 photos; 21 of those photos changed the title's answer,
mostly generic "baby lounger" titles that the photo settled either way (`tools/census-craigslist-labels.json`).

| What was for sale | Listings | Asking, in all |
|---|---|---|
| Infant loungers and nests a baby lies in | 49 | $2,079 |
| Padded crib bumpers | 2 | $70 |
| OXO Tot Nest booster seats, named in a 2015 recall (model and date not checked) | 2 | $50 |
| **Together** | **53** | **$2,199** |

- Three listings that looked like one ad posted twice are counted once (56 labelled "yes" before that).
- Brands: 13 DockATot, 12 Snuggle Me, 1 La-La-Me, no Boppy; the rest are named with generic words.
- The word rules' precision on these searches was 56 of 80. What they get wrong is "lounger" on bouncer and rocker
  seats, and recall lines on toys, a vehicle harness and video games. That is why nothing here is counted on words
  alone, and why the extension sends such listings to the device's model and the cloud.
- Unlike eBay, Craigslist doesn't ban loungers by name, and private sellers' listings are mostly used items. Selling a
  recalled product or a padded crib bumper is unlawful on any site (sources.md, section 2).
- **eBay and Craigslist together, one day:** 253 listings, $14,351 asked. Its coverage is a floor (the first page of
  each search, four product words), but the count itself rests on AI labels, mostly from titles: 29 of Craigslist's 56
  "yes" were not photo-checked, and 3 of the 21 that were changed. A person checking them is next
  (`tools/label-review.html`).
- No listing was reported or contacted.

**A page for resale shops** (`web/shops.html`, English and Spanish), for consignment sales, thrift stores and kids'
resale shops. It sums up what CPSC's reseller guide and the laws behind it say a shop can't sell, with sources, and
gives a short intake routine. Its button opens the intake log directly (`?log=1`).

**Feedback in public.** A feedback form on GitHub (`.github/ISSUE_TEMPLATE/feedback.yml`) is linked from the web page
and the shops page, so what real users say can be read and checked by anyone.

**A person can check every AI label in one place.** `tools/label-review.html` (served by `node tools/collector.mjs`)
now also holds the sixth test and both censuses (392 eBay and 80 Craigslist listings the word rules flagged), with the
photo, the AI's answer and its reason. Keys 1 to 4 answer and move on. `node tools/review-agreement.mjs` prints how
often the person agreed with the AI, for each set reviewed: the number to publish beside the AI-labelled ones.

**A ninth AI review (Claude, not a person) of 0.17.0** scored it the same as 0.16.0 (4.5, 4.0, 3.5, 4.5) and
recomputed every census and test number (all matched). It found these wordings too broad, now corrected in the README,
the submission, the privacy page and the video script:
- "cleared listings never leave the computer": since 0.14.0 the unnamed-sleep rule sends unbranded infant sleep
  products for the cloud's look even when the device cleared them; the privacy page now says so;
- "never reassure alone": true for exact model-number matches, unbranded sleep products and label readings, not for
  ordinary word matches, which the device clears itself;
- the Android app "shared from Facebook's and OfferUp's apps": no test shares from inside those apps;
- the 775-listing headline is five tests on the engine of each day, now said wherever it appears;
- the unit test count (121), the review numbering (section 30 is the eighth), and the eBay census's 11 searches with
  results (of 12 run).
It also noted that Claude Code wrote the code; the submission's "Built with" and the README now say so. The scripts
this document cites from a scratch folder are now in `tools/` (`sixth-rule.mjs`, `fits-real.mjs`,
`live-probe.mjs`). Still open, and the builder's to do: the video, a person's label check, and a real user.

Unit tests: 121.

## 32. The hybrid on the census (2026-11-25)

Sections 29 and 31 count the problem. This runs Still Recalled on it. Two fixed random samples were drawn by code
from the census listings (seeded, so they can be drawn again): 70 of the 252 an AI reviewer counted (55 eBay, 15
Craigslist; listings posted twice counted once), and 30 of the 202 it ruled out (25 eBay, 5 Craigslist). Each went
through the extension's own pipeline on release 0.17.0's engine, in Chrome with Gemini Nano
(`node tools/eval-run.mjs --set=census-sample --mode=hybrid`, then `--set=census-sample-no`; scored by
`node tools/census-hybrid-score.mjs`). About 100 cloud calls in all, no errors.

| | Listings | Word rules alone | Hybrid |
|---|---|---|---|
| Counted by the reviewer (should be flagged) | 70 | 70 flagged, all amber | **69 flagged: 66 red, 3 amber** |
| of those, no brand word in the title | 28 | 28 | **28 flagged: 25 red, 3 amber** |
| Ruled out by the reviewer (should not be flagged) | 30 | 30 flagged, 29 amber and 1 red | **6 flagged: 5 amber, 1 red; 24 cleared** |

- **How to read it.** Every census listing was picked by the word rules, so the words flag all 100 and cannot tell
  the 70 from the 30. The hybrid's work here is the cloud's look at the photo: it confirmed 66 of the 70 as red
  ("Infant lounger or nest"), and cleared 24 of the 30 that only share the words (covers, bed rails, bouncer seats,
  toys). This measures the confirming step. It does not measure finding products whose titles don't name them; the
  sixth test (section 25) and the brand-stripped tests (sections 19 and 33) do.
- **Where each ran.** A title that names a risky type goes straight to the cloud, so Gemini Nano looked at only 8 of
  the 100 here (the listings matched by a recall line, not a type). On an ordinary search most listings stay on the
  device (77% across the five tests); a search for "baby lounger" is the opposite case, and the write-up says so.
- **The one miss:** an OXO Tot Nest booster seat, named in a 2015 recall. The words matched the product line, and the
  cloud did not confirm it.
- **The six still flagged among the 30:**
  - four amber "padded crib bumper" flags where the words say bumper and the photo could not rule it out: a
    Spanish-titled crib bumper, a fabric panel set, a quilting pattern book, and a toddler bed rail;
  - one amber "possible recall" on a UTV fan wiring kit whose title carries a vehicle model a harness recall lists
    (the 0.16.1 rule that a model-number match is never dropped below amber; it says to check the label);
  - one red: a "Baby Lounger & Changing Mat". The reviewer called it a changing pad; the hybrid called it a lounger
    and described a raised rim that the photo, a flat padded mat, does not show. Counted as a false alarm.
- **In money:** the 70 asked $3,950 in all; the 69 flagged asked $3,920.
- Both the answer key and the tool are AI here (the reviewer is Claude, the tool is Gemini), so agreement between
  them is not ground truth. A person's check of the census labels (`tools/label-review.html`) is the next step.

## 33. The brand left out, on 34 fresh listings (2026-11-25)

The brand-stripped test in section 19 had 23 listings, 5 of them one Bumbo recall. This is a second, fresh set: 34
real eBay listings collected on 2026-11-25 that are in no earlier test (22 searches for recalled product lines, 1,967
listings read). The word rules matched 116 of them to a recall by product line; an AI reviewer (Claude) looked at each
photo and kept the 34 that are that product line and the whole item, not a part, a cover or a look-alike name
(`tools/masked2-review.json`, `tools/masked3-review.json`). Code then stripped the brand, line and model words from
each title (`node tools/masked-build.mjs --from=...`), leaving titles like "Swing for Infants, Bluetooth Music,
Remote (Gray)". The sellers' photos were kept. Nine recalls: Jool Baby Nova swing 10, Baby Jogger City Mini 7,
Britax B-Agile and BOB Motion 6, Fisher-Price Lift & Lock swing 4, 4moms MamaRoo 3, Bugaboo Cameleon 2, and one each
of a Boppy slipcover and a Dream On Me bassinet. Each was checked one at a time, as the web page and the Android app
check a listing (`node tools/lookup-generic.mjs --masked=masked-fresh`, `tools/lookup-masked-fresh.json`), with
Gemini in the cloud doing the look. About 70 cloud calls, no errors.

| Step | Of 34 |
|---|---|
| The word rules find a recall | 0 |
| The cloud named the product from the photo and called `lookup_recalls` | 33 |
| The device's field guide answered with the right recall | 28 |
| The card showed the right recall, as amber "Possible recall" | 13 |
| The card showed another notice | 2 |
| Flagged in all (none red) | 15, against 0 with the lookups taken away |

- **The 14 where the device answered with the right recall and the cloud did not show it** are all later versions of a
  recalled line: 7 City Mini GT, GT2 and GT3 strollers (the notice covers City Minis sold 2007 to 2009), 5 Jool Nova
  swings in other colours or marked "2024 version" (the notice covers the gray model made 2022 to 2023), and 2
  MamaRoo swings (the notice covers versions 1.0 to 4.0). The cloud read the notice the device sent and judged the
  listing outside it. The answer key here says "same product line", not "covered by the recall", so it cannot say
  whether those 14 are misses or correct. On the lines whose listings were plainly inside the notice, the right recall
  was shown on Lift & Lock 4 of 4, Cameleon 2 of 2 and B-Agile 4 of 5.
- **The 6 where the field guide did not answer with it:** the cloud made no call for a Boppy slipcover; asked for
  "Lacy bassinet" and "Signature Swing" (twice), names the notices do not use; asked for a plain "infant swing"; and
  for a BOB Motion asked "BOB stroller", which brought back earlier BOB notices.
- **The 2 other notices:** a B-Agile with a 2014 model number was shown the 2017 notice for the same stroller; the BOB
  Motion was shown a 2011 BOB notice that does not cover it. Both amber, saying to check the label. That second one
  is the only wrong notice named in either brand-stripped test.
- **The device's own lookup** (a brand read in the photo) found a recall on none of the 34, though a brand was read
  on 19. That is by design, and this set shows the cost: a brand with a kind of product counts only for notices that
  name no product line, because "4moms swing" would otherwise flag everything 4moms makes, and every recall in this
  set names a line. Here the cloud's question did the work.
- **Both sets together, 57 listings:** the right recall named on 25, another notice on 2, flagged 30, none red.

**Accessibility, with the new pages.** `node tools/a11y.mjs` now also checks the shops page in English and Spanish,
the printable card and the intake log: 56 page views (light and dark, 390 and 1280 px). The first run found the shops
page had no main landmark and the card's buttons sat outside any landmark; both fixed, and the run is now 56 views,
0 violations (`tools/a11y-report.json`).

## 34. A census of Facebook Marketplace, and the sleepers sold without their name (2026-11-25)

The ninth review pointed out that the census of eBay and Craigslist found no Rock 'n Play, the product the opening
story is about. Facebook Marketplace is where CPSC sent most of its takedown requests for it (sources.md, section 6),
so the same census was run there.

**Method.** `node tools/census.mjs --site=facebook` (`tools/census-facebook.json`): logged out, in a throwaway Chrome
profile, with the extension's own page reader. Seven searches in each of 30 large U.S. metro areas, 210 searches, the
results Facebook shows a logged-out visitor (about 15 a search): 1,528 listings, every one with a photo. No Facebook
account was used. No listing was opened, contacted or reported.

**Facebook answers the product's name with nothing.**

| Search words | What Facebook showed |
|---|---|
| "rock n play", "crib bumper", "boppy lounger" | "No listings found" in 90 of 90 searches (30 metros each) |
| "rock and play", "fisher price rock n play", "boppy newborn lounger", "crib bumpers" | "No listings found" in 12 of 12 (3 metros each, `tools/census-facebook-terms.json`) |
| "baby lounger", "baby nest", "baby rocker sleeper", "baby bumper pads" | 445 to 448 listings each, in 30 of 30 metros |
| "rocking sleeper", "boppy", "bumper", "dockatot", "snuggle me", "nursing pillow" | 42 to 45 listings each, in 3 of 3 metros |

We read this as Facebook filtering those search words; that is our reading of the page, seen logged out, and a
signed-in search has not been run. A filter on search words keeps a parent from finding the product by its name. It does
not take the listing down, and it does not touch a seller who writes "baby rocker".

**What was for sale.** The word rules flagged 717 of the 1,528 by their titles (`node tools/census-score.mjs
tools/census-facebook.json`). Then every flagged listing, and every one of the 566 listings from the three baby
searches that the word rules left open, was labelled from its title and its photo together by AI reviewers (Claude,
four separate agents) on numbered photo sheets (`tools/census-sheets.mjs`), with 216 photos opened at full size:
1,283 listings in all, 515 ruled out, 20 left unclear. This is the first census here where a photo was looked at for
every listing counted. The first column counts only labels the reviewer marked as confident.

| What was for sale | Confident | Asking | With best readings | Asking |
|---|---|---|---|---|
| Infant loungers and nests a baby lies in | 557 | $15,178 | 672 | $17,898 |
| Padded crib bumpers (banned from sale since 2022) | 21 | $387 | 37 | $839 |
| Inclined infant sleepers (banned from sale since 2022) | 11 | $225 | 14 | $280 |
| **Together** | **589** | **$15,790** | **723** | **$19,017** |

- **Every metro area had them:** 14 to 26 confident listings in each of the 30.
- **Most carry no brand:** 348 of the 589 show no brand in the title or the photo. 326 ask $20 or less.
- **Found only by the photo:** 110 of the loungers and all of the inclined sleepers sat under titles the word rules
  leave open.
- **The word rules alone:** 605 of the 717 they flagged were the type (489 confident). 108 were ruled out, among them
  mesh liners and bed rails titled "bumper", and bassinets on legs and bouncers titled "lounger".
- **A judgement call in the count:** in-bed sleepers with stiff mesh walls and no legs (Baby Delight Snuggle Nest and
  the like) are counted as loungers: about 75 of the 672, 45 of them among the confident 589.
- **Banned by law, or against the site's rules.** 32 of the 589 (21 padded bumpers, 11 inclined sleepers; 51 of the
  723) are banned from sale by law whatever their date. The 557 loungers are not, unless made after May 2025, and no
  listing's date or condition is known here; CPSC says a lounger is never for sleep (sources.md, section 2). All three
  kinds are named in Facebook's own Recalled Products policy: inclined sleepers, crib bumpers and "Baby nests and
  loungers" (sources.md, section 7). So the count is of listings Facebook's rules don't allow, most of them lawful
  to sell.
- An ad sharing its title, price and metro area with another is counted once. One pair of ads in two metro areas
  shared a photo and is counted twice.

**The inclined sleepers.** 14 listings (11 confident) in 11 metro areas, asking $5 to $60. Their titles: "Baby
rocker/sleeper", "Baby Rocker-sleeper", "Baby sleeper" (twice), "Rocker sleeper", "Rocker/sleeper", "Infant rocker",
"Baby rocking bed", "Baby lounge rocker", "Baby rocker", "Baby cradle - automatic rocker", "Soothing rocker for Baby",
"Baby/Infant Rocker Sleeper Gently Used", "Urbini Baby Rocker Sleeper". None says Rock 'n Play, inclined, or a model.
In the photos the reviewers saw the Fisher-Price design on three, Ingenuity on three (one a box that reads "Moonlight
Rocking Sleeper"), Urbini on one, and no brand on seven.

A second AI reviewer was then shown the 14 mixed with a random 20 of the other "baby rocker sleeper" results, photos
only, no titles, in shuffled order (`tools/census-fb-blind-labels.json`). It made the same call on 34 of 34. Both
reviewers are Claude, so this shows the call is steady, not that a person agrees; a person's check is next
(`tools/label-review.html`).

**The hybrid on them.** The same 34 listings went through the extension's own pipeline in Chrome with Gemini Nano
(`node tools/eval-run.mjs --set=census-fb-inclined --mode=hybrid`, then `--set=census-fb-rockers`; a development
build of 0.17.1's engine; scored by `node tools/census-fb-score.mjs`).

| | The 14 inclined sleepers | 20 other results of the same search |
|---|---|---|
| Flagged by the word rules alone | 0 | 0 |
| Flagged by the hybrid | **12**, all amber | 8, all amber |
| ... with a recall named | 10 | 7 |
| ... as the banned type, no recall named | 2 | 1 |
| Cleared | 2 | 12 |
| Gemini Nano looked at the photo | 14 | 20 |
| Sent on to the cloud by the unnamed-sleep rule after the device cleared it | 10 | 14 |
| The cloud was asked | 13 | 16 |

- **How the 12 were found.** Gemini Nano cleared 11 of the 14 on the device and asked about 3. The unnamed-sleep rule
  (0.14.0) sent 10 of the cleared ones to the cloud anyway. Gemini in the cloud named the product from the photo and
  asked the device's field guide (`lookup_recalls`), which returned a recall for 10: Rock 'n Play sleepers (recall
  23088) on 7, Kids II or Kids2 rocking sleepers (19112, 23089) on 3. Two more were flagged as an inclined sleeper
  with no recall named.
- **Is the named recall right?** Where the reviewer could see the brand, yes on 6 of 6: the three Fisher-Price ones
  were named Rock 'n Play, and the three Ingenuity ones were named Kids II rocking sleepers (Ingenuity is a Kids2
  brand). The other four, with no brand in the photo, were all named Rock 'n Play: the type agrees with the AI
  reviewers' labels (one of them a less sure one), and the brand can't be checked from the photo.
- **Why amber and never red.** The listing itself never names the product, so the card says to check the label. That
  is the rule: a photo alone can raise an alarm, and never a red one.
- **The 2 misses.** "Baby rocking bed" was cleared by the device and its title has no sleep word, so the cloud was
  never asked. One "Baby sleeper" went to the cloud, which did not confirm it.
- **The 8 flags among the other 20.** Three are 4moms swings and rockers, and the card names the 2022 MamaRoo and
  RockaRoo recall and asks for the version; the reviewers were not looking for those, and by the builder agent's
  reading of the photos the brand is right (one photo shows the 4moms logo). On the other five the models disagree:
  both AI reviewers called them ordinary rocker seats, a bouncer and a rocker napper, while Gemini in the cloud read
  three as a Rock 'n Play and one as a Kids II sleeper, and flagged the fifth by type. No person has settled those
  five. If the reviewers are right, about one ordinary "baby rocker" listing in four gets an amber "check the label"
  it did not need. Bringing that down is next.
- **Where the work ran.** On searches like these nearly every listing goes to the cloud: 29 of these 34, and 98 of
  the 100 in section 32. Gemini Nano's part here is the first look and the field guide's answers; the 77% that never
  leave the computer (sections 1 to 22) is the figure for mixed shopping pages.

**How to read it.**
- It is a floor and a snapshot: one day, seven searches, and only what Facebook shows logged out.
- The labels are AI reviewers', from photos about 526 pixels wide. No person has checked one yet.
- The hybrid numbers are small (14 and 20) and come from a development build with the same engine as the release.
- With eBay (200) and Craigslist (53), the three sites held 842 such listings that day, $30,141 asked, counting
  Facebook's confident labels only. The methods differ a little: on Facebook every counted listing had its photo
  looked at, and listings the word rules left open were looked at too.
- No listing was reported or contacted. Reporting them is the builder's decision.

**A reader fix, and release 0.17.1.** The census showed that Facebook starts a new listing's name with its own "Just
listed, " (43 of the 1,528), and the extension read it as part of the seller's title. It is now left out (unit test
in `tests/extract.test.mjs`; 121 of 121 pass). The packed 0.17.1 release then passed the end-to-end test on a live
Facebook Marketplace search for "baby rocker sleeper" in Chicago, **16 of 16**: 15 of 15 listings checked in 60 s, 14
confirmed in the cloud with no errors, 6 badges for 6 flagged
(kept as `tools/e2e-report-release-facebook-0171.json`; the 0.17.0 run on the lounger search is
`tools/e2e-report-release-facebook-0170.json`). The eBay and practice-listing reports are 0.17.0's; the only change
since is this Facebook title fix.

## 35. A tenth review, of 0.17.1, and release 0.17.2 (2026-11-25)

**A tenth AI review (Claude, not a person)** read the whole entry after section 34 and scored it 4.0, 4.0, 3.5, 4.5
(Technological Implementation, Design, Potential Impact, Quality of the Idea). It recomputed sections 32, 33 and 34
from the saved files with the scoring scripts and by its own count: all matched. Stage One: every requirement met
except the video.

- **Technology went from 4.5 to 4.0, for a release mistake.** The 0.17.1 release on GitHub carried an old Android app
  (0.13.1, from `dist/`), not the 0.16.1 app the site offers. Fixed the same hour: the release now holds the 0.16.1
  app, checked byte for byte against the site's, and `scripts/deploy-web.mjs` now copies both downloads from one
  place and refuses to deploy an extension that was not packed for the current version. The review also noted that
  Gemini Nano adds little on hazard searches, where nearly every listing goes to the cloud (now said in section 34).
- **Impact stayed at 3.5.** The review credits the three censuses and the 12 of 14, and holds against them that every
  answer key is an AI's, no person has used the product, and the samples are 14 and 20. Its route to 4.0 is a
  person's check of the 34 Facebook photos and the 100 census samples, and the video.

**Claims corrected** (README and section 34):
- "Among them were 14 inclined sleepers": 11 are in the confident 589; 14 is the count with best readings.
- The five extra flags on ordinary rockers were called look-alikes; the cloud read four of them as a rocking sleeper
  and both AI reviewers did not, so it is unsettled.
- Counts now say how many listings are banned by law (32 of 589) and how many break only the site's rules (557).
- "Results are kept for 7 days": they were ignored after 7 days and never deleted. Now they are deleted (below).
- For the write-up, when it is cut: the tagline's "Gemini Nano screens" (listings whose words name a type skip Nano),
  the 40 accessibility views (now 56), and the Facebook census are not in `docs/submission.md` yet.

**Fixed in 0.17.2:**
- **A badge on the right heading.** On Facebook an item opened over a search is a dialog; the badge was placed beside
  the page's first heading, and now goes beside the dialog's (`detailHeading` in `extension/src/extract.js`, unit
  test).
- **Work no longer paid for twice.** Opening an item on Facebook changes the address while the search is still being
  checked; results that arrived after that were dropped without being kept. They are now kept for the week.
- **Old results are deleted.** Twice a day, results older than 7 days are removed from the browser's storage.
- **The thorough setting sends less.** With "check every baby product in the cloud" on, a cleared listing the cloud
  had already looked at was sent again. Now it is not.
- **A red type flag says who saw it.** When the listing's words name a banned type and the cloud sees it, and Gemini
  Nano raised nothing or was not asked, the reason no longer says "both models" (`shared/confirm.mjs`, unit test).

**Tested on the packed 0.17.2 release:** Facebook Marketplace ("baby rocker sleeper", Dallas) **16 of 16**; the
practice listings at /try **18 of 18** (17 listings checked in 30 s). Unit tests: 123. The eBay report is 0.17.0's.
A first Facebook run of 0.17.2 scored 15 of 16: every listing on that page had already been to the cloud, so the
thorough step found nothing new to send, and that is how the repeat sending above was found. The step now passes
when there is nothing left to send (`tools/e2e.mjs`).

**For a person's check.** `tools/label-review.html` now has the 34 Facebook photos as their own set ("the inclined
sleepers and 20 others") and the 717 flagged Facebook listings. Photos are shown from the copies the census saved on
this computer, since Marketplace photo addresses stop working after a while; the photos are not in the repository.

**Not fixed, next:** the device's title rules have no "rocking" or "bed", the miss on "Baby rocking bed" in section 34
(adding them now would be tuning on that test); the content script's page observer runs on all of facebook.com,
reading nothing outside Marketplace; a signed-in Facebook run (done the next day, section 36); the Firestore rule that lets any signed-in anonymous
caller write a recall's field-guide card first.

## 36. Signed in on Facebook Marketplace: the blank searches hold (2026-11-26)

Every Facebook search in section 34 was signed out. This is a small check on **one signed-in personal account**, in
its owner's everyday Chrome, in that account's home metro area (Facebook's default 40-mile radius). Six searches,
the first screen of results only, no scrolling. It is a check, not a census.

| Search | Signed in |
|---|---|
| "rock n play" | "No listings found for "rock n play" within 40 miles" |
| "crib bumper" | No listings found |
| "boppy lounger" | No listings found |
| "baby bumper pads" | 54 listings |
| "baby lounger" | 40 listings |
| "baby rocker sleeper" | 39 listings |

- **The blank named searches are the same signed in: 3 of 3.** Signed out it was 90 of 90. The product's name
  returns nothing, and the plain words beside it return a full page.
- **The extension's page reader works on the signed-in page.** The reader (`extension/src/extract.js`, the same
  code the census uses, run in the page) read **39 of 39** listings on the "baby rocker sleeper" search, each with
  a title, a price and a photo.
- **An item opened over the search reads correctly.** For "Baby sleeper, $25" the reader took the title, the photo
  and the seller's own description, and found the heading inside the item's dialog, which is where 0.17.2 puts the
  badge (section 35).

**Then the installed extension, in the same signed-in Chrome** (the packed 0.17.2 release, loaded by its owner; which
model looked at each listing was not recorded):
- **Badges appear on the signed-in search.** On the "baby rocker sleeper" page, between 10 and 14 listings carried
  a badge or a "checking" pill while the checks ran, and when they settled **9 of the 39 listings carried a
  badge**. The ones on screen read "Possible recall", "Possible inclined sleeper" and "Possible lounger", all amber.
- **The card opens without leaving the page.** Clicking "Possible inclined sleeper" opened the card over the search
  ("This may be or include an inclined infant sleeper. Ask the seller what it is before you buy."), and the address
  stayed on the search.
- **An opened item carries its badge beside its own heading.** Opening the first flagged listing ("Baby rocker, $10")
  showed "Possible recall" above the item's title inside the dialog, the placement 0.17.2 fixed (section 35).

**Limits.** One account, one metro area, one day, first screen only. This was watched by hand, not run through the
end-to-end test, which signs in to nothing. No photo on these pages was reviewed, so this adds nothing to the counts
of section 34, and nobody has checked whether those 9 flags are right.

Only Marketplace search and item pages were read; nothing was saved, messaged or reported. The numbers are in
`tools/facebook-signed-in.json`, with no place names and no listing links.

## 37. A person looks at the 34 Facebook photos: 19 of 34 the same (2026-11-26)

Until now every label in this project was an AI's. For the 34 photos of section 34 (the 14 the AI reviewers called
inclined sleepers and 20 other results of the same search), **one person has now answered the same question blind.**
The person is the project's builder, with no training in product safety.

**How.** `tools/label-review.html`, set "the inclined sleepers and 20 others": the photo, the seller's title and the
price, in shuffled order, with the AI's answer hidden. One question, "is this an inclined sleeper?", with the law's
definition at the top of the page (a bed made for a baby's sleep at a tilt of more than 10 degrees; a bouncer, swing
or rocker seat also tilts but is a seat for a baby who is awake). On a first look, before the page gave any
definition, the person said all 34 looked inclined; that look was not recorded as answers.

| | Person: inclined sleeper | Person: not one |
|---|---|---|
| **AI reviewers: inclined sleeper (14)** | 10 | 4 |
| **AI reviewers: not one (20)** | 11 | 9 |

- **The same answer on 19 of 34 (56%, kappa 0.15).** That is low agreement. The two AI reviewers agreed with each
  other on 34 of 34, so their agreement measured how alike two AI readings are, not how right they are.
- **The person saw more inclined sleepers, not fewer: 21, against the AI's 14.** The 11 extra are swings, bouncers
  and rocker seats by the AI's reading. The 4 the person turned down include two sold with "sleeper" in the
  product's own name (one on its box).
- **10 are inclined sleepers to the person and to both AI reviewers** (9 of them confident AI calls). This is the
  firmest count the project has: 10 inclined sleepers under plain titles, in one search, in 30 metro areas.
  Still Recalled flagged **9 of those 10**, all amber.
- **9 are not, to all three.** Still Recalled flagged 2 of those 9.

**The hybrid, scored against each answer key:**

| Answer key | Inclined sleepers flagged | Others flagged |
|---|---|---|
| AI reviewers (section 34) | 12 of 14 | 8 of 20 |
| The person | 15 of 21 | 5 of 13 |
| Where both agree | 9 of 10 | 2 of 9 |

**What this changes.** "14 inclined sleepers" in section 34 stays an AI count; a person agrees on 10 of them. The
"8 flags on ordinary rockers" is less settled than section 34 said: the person calls 6 of those 8 inclined sleepers.
And the plainest finding is the disagreement itself: from one listing photo, a careful adult given the legal
definition and two AI reviewers split on 15 of 34 of these products. That is the case for an amber "check the label"
over a red verdict, and for pointing the shopper to the model number.

**Limits.** One person, not a specialist, 34 photos, one sitting. No one has yet checked a model label on any of
these products, which is what would settle them. The census totals (589, $15,790) have no person's check yet; the
717 flagged listings are a set on the same page. Reproduce: `node tools/census-fb-person.mjs`; answers in
`tools/census-fb-sleepers-review.json`.

## 38. The web page's fallback, checked: one call, read on the device or in the cloud (2026-11-26)

The web page reads a screenshot with one Firebase AI Logic call in `PREFER_ON_DEVICE` mode and prints the source the
SDK reports back (`inferenceSource`). Until today no run on record showed both outcomes. The page's own example
photo, the live site, the same click:

| Where | Built-in model | The page's step line | Time to the result |
|---|---|---|---|
| The builder's everyday Chrome 158 | Gemini Nano, working | "Read on this device" | 23 s |
| A new Chrome profile, phone size | none | "Read in the cloud" | 74 s |

Both then go on to the same result: the example listing matched to recall 26591.

**What went wrong first, and what it showed.** The first attempts read in the cloud even in a Chrome that reported
the model as "available":
- **Cause:** another project's test was running Gemini Nano in its own Chrome on the same computer. This laptop's
  graphics card has 4 GB, and a second Chrome could not start the model: `LanguageModel.create()` failed with "The
  device is unable to create a session to run the model" and "The model process crashed too many times for this
  version", while `LanguageModel.availability()` still answered "available". Closing that test fixed it, with no
  further restart of Chrome.
- **What the page did:** it announced "On this device", the read failed, Gemini in the cloud read the photo
  instead, and the line then said "Read in the cloud". The check finished and the page said truthfully which model
  ran. Here the cloud read came from the page's own retry after the error. The SDK (firebase 13.3.0) falls back by
  itself when the model reports that it is not available, which is the second row of the table.
- **For the extension:** its on-device step is `ONLY_ON_DEVICE`, so while the model cannot start, listings are
  decided by the word rules and the cloud, as on a computer with no built-in model.

**Next:** the page still says "On this device" before it knows the read will succeed; it should ask for a session
first and say "In the cloud" when that fails. `node tools/fallback-probe.mjs` prints the step lines for a profile
with or without the model, and the page now writes the reason to the console when its first read fails.

## Reproduce

```
npm install && npm run build
node tools/collector.mjs                    # local test server on :8766
# in Chrome with the built-in model: open http://localhost:8766/tools/eval-test.html, then in the console:
#   await __eval({ mode: 'words' }); await __eval({ mode: 'hybrid' })                       first test
#   await __eval({ mode: 'words', set: 'fresh' }); await __eval({ mode: 'hybrid', set: 'fresh' })   second test
# or, in a separate test profile with the built-in model (made once by node tools/nano-profile.mjs):
node tools/eval-run.mjs --set=fourth --mode=words && node tools/eval-run.mjs --set=fourth --mode=hybrid
node tools/eval-score.mjs                   # or --set=fresh, --set=third, --set=fourth, --set=fifth
bash tools/collect-fifth.sh                 # how the fifth set was collected (eBay and Craigslist, new searches)
node tools/single-run.mjs --for=fifth       # the fifth set checked one listing at a time, as the web page does
node tools/eval-run.mjs --set=sixth --mode=hybrid && node tools/eval-score.mjs --set=sixth   # the unnamed-sleep rule's test
node tools/recall-mirror.mjs <folder>       # the recall mirror, as the daily job makes it
node tools/web-log.mjs                      # saved checks, the intake log and Spanish on the web page
node tools/census.mjs --site=ebay --out=tools/census-ebay.json && node tools/census-score.mjs tools/census-ebay.json   # the census
node tools/census.mjs --site=facebook --out=tools/census-facebook.json && node tools/census-score.mjs tools/census-facebook.json  # Facebook Marketplace census (section 34)
node tools/census-fb-score.mjs                              # every number of section 34, from the saved census, labels and hybrid runs
node tools/census-fb-person.mjs                             # section 37: a person's blind check of the 34 photos, beside the AI labels
node tools/fallback-probe.mjs                               # section 38: which model the web page's one call ran on (add --profile=<one with the built-in model>)
node scripts/make-card.mjs                  # the printable card's QR codes (web/card.html)
node tools/masked-build.mjs && node tools/lookup-generic.mjs --masked   # real listings with the brand stripped from the title
node tools/lookup-generic.mjs               # the ten made-up generic-title listings, one at a time
bash tools/rerun-all.sh -r5 && node tools/run-compare.mjs --a=-rerun --b=-r5   # the earlier sets again, and two runs compared
node tools/web-owner.mjs; node tools/android-owner.mjs                  # "I own it", web page and Android
node tools/a11y.mjs; node tools/android-a11y.mjs                      # accessibility: axe-core on every web view; Android targets, names, 200% text
npm run e2e -- "crib bedding set"           # or --url=<a Craigslist or Mercari search>
node tools/label-run.mjs                    # the label check on 12 CPSC label photos (--cloud: the cloud alone)
node tools/cards-compare.mjs <old release folder> extension/data/cards.json   # word rules: old cards and code against new
```
