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
node tools/masked-build.mjs && node tools/lookup-generic.mjs --masked   # real listings with the brand stripped from the title
node tools/lookup-generic.mjs               # the ten made-up generic-title listings, one at a time
bash tools/rerun-all.sh -r5 && node tools/run-compare.mjs --a=-rerun --b=-r5   # the earlier sets again, and two runs compared
node tools/web-owner.mjs; node tools/android-owner.mjs                  # "I own it", web page and Android
npm run e2e -- "crib bedding set"           # or --url=<a Craigslist or Mercari search>
node tools/label-run.mjs                    # the label check on 12 CPSC label photos (--cloud: the cloud alone)
node tools/cards-compare.mjs <old release folder> extension/data/cards.json   # word rules: old cards and code against new
```
