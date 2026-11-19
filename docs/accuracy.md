# How well it works: the tests

Four tests ran on 2026-11-15, 16 and 18 on a Windows PC with Chrome 157 and Chrome's built-in model (Gemini
Nano). Each test set was collected after the fixes the test before it led to, so every set is new to the rules it
measures. Cloud model: Gemini through Firebase AI Logic (`gemini-4-hydrogen`, falling back to `gemini-3.5-flash-lite`
when it was busy).

Each test runs the same engine three ways (`tools/eval-test.html`, scored by `tools/eval-score.mjs`):
- **Words only:** no model at all, which is what a computer without Chrome's built-in model gets with the cloud off.
- **Built-in model only:** words, then Gemini Nano on the listings that need a look. Nothing leaves the computer.
- **Hybrid:** the same, then the cloud double-checks only what the built-in model flagged.

A listing counts as flagged at "possible" or "likely".

## Results

All four tests together: 597 listings, of which 74 must be flagged and 481 must not (42 can't be settled from the
listing alone and are left out).

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

- **The built-in model cuts the word rules' false alarms by looking at the photo, and the cloud check cuts them to an
  eighth.** It also catches what words miss: products whose risky part shows only in the photo.
- **By kind, across the four tests:** recall matches 6 of 8; infant loungers and nests 35 of 44; padded crib bumpers
  17 of 22.
- **Each test changed the product.** Loungers were the weak spot after two tests (4 of 10); the changes that followed
  raised that to 23 of 25 in the third and 8 of 9 in the fourth. The fourth test was the first with every recall since
  1973, and two of its three recall catches were recalls the earlier data didn't have.
- **In a shopper's units:** the listings that should be flagged were asking $5,527 in total; the hybrid flagged $4,540
  of it.
- **77% of the listings never left the computer.** The cloud saw 15%, 8%, 33% and 32% of the listings in the four tests
  (the last two searched mostly for loungers, recalled brands and old gear, which go to the cloud to be confirmed).

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

## Reproduce

```
npm install && npm run build
node tools/collector.mjs                    # local test server on :8766
# in Chrome with the built-in model: open http://localhost:8766/tools/eval-test.html, then in the console:
#   await __eval({ mode: 'words' }); await __eval({ mode: 'hybrid' })                       first test
#   await __eval({ mode: 'words', set: 'fresh' }); await __eval({ mode: 'hybrid', set: 'fresh' })   second test
# or, in a separate test profile with the built-in model (made once by node tools/nano-profile.mjs):
node tools/eval-run.mjs --set=fourth --mode=words && node tools/eval-run.mjs --set=fourth --mode=hybrid
node tools/eval-score.mjs                   # or --set=fresh, --set=third, --set=fourth
npm run e2e -- "crib bedding set"           # or --url=<a Craigslist or Mercari search>
node tools/label-run.mjs                    # the label check on 12 CPSC label photos (--cloud: the cloud alone)
node tools/cards-compare.mjs <old release folder> extension/data/cards.json   # word rules: old cards and code against new
```
