# Demo script: Still Recalled (2:55)

The video is recorded and edited by scripts in this repo (`scripts/demo/`). A recorder drives Chrome through each
scene on the real product, a neural voice reads the words below, and the edit is drawn frame by frame from those
recordings. Each scene here says what is on screen, what the recorder does, what the edit adds, and the words in
**bold**. The limit is 3:00, and only the first three minutes are judged.

## The one idea the video carries

**The cloud teaches the device. The device screens every listing. And when either needs help, it asks the other.**
Every scene shows one part of that sentence working, on a product a parent would use.

The order: the danger, the product working, the technical moment, a next step, the phone, the fallback, the proof,
the scale, the close.

| # | Starts | Scene | Footage |
|---|---|---|---|
| 1 | 0:00 | The hidden danger | Takes `off` and `flow` |
| 2 | 0:10 | It works, and where it runs | Take `flow` |
| 3 | 0:26 | The cloud asks the device | Take `flow` |
| 4 | 0:54 | From a warning to something you can do | Takes `flow` and `label` |
| 5 | 1:15 | Native Android, with Gemini Nano | The clip from the builder's Pixel |
| 6 | 1:29 | One call, either model | Takes `page-device` and `page-cloud`, side by side |
| 7 | 1:48 | The need, and the proof | Take `market`, then a card of the test results |
| 8 | 2:23 | Why it keeps up, and scales | Take `bouncer` |
| 9 | 2:41 | The close | Take `flow`, then the closing card |

The starts come from the narration: each scene lasts as long as its words, plus a hold where the screen needs
reading.

## What each scene is for

The four judging criteria count equally. Technological Implementation breaks a tie first, then Design.

| Criterion (Rules.md) | What the judge must see | Scenes |
|---|---|---|
| Technological Implementation: "how effectively does it use Firebase AI Logic hybrid inference" | Device first, cloud second (2); the cloud's function call answered by the device (3); Gemini Nano on a phone (5); the same call on the device and in the cloud, both to the same answer (6); Firestore, App Check and new recalls (8) | 2, 3, 5, 6, 8 |
| Design: "a complete, coherent product experience" | Badge, card, next step, label check, phone, watch list: one product with no dead ends | 2, 3, 4, 5, 8 |
| Potential Impact: "a credible, specific case ... a real problem for a real audience" | The danger in one listing; a real search with our badges on it; the counts, with how they were measured on screen | 1, 7, 9 |
| Quality of the Idea: "creative, non-obvious use" | A listing with no brand, named anyway, by a question that runs from the cloud to the device, which holds the facts | 3, 8 |

## Rules check (Rules.md, the video)

| Rule | How this video meets it |
|---|---|
| Not longer than 3 minutes | 2:55; `scripts/demo/build.mjs` prints the length of every build |
| Shows the project working on the platforms it was built for | Chrome extension (scenes 1 to 4, 7, 8), Android (5) and the web page (6) |
| In English, or with English subtitles | Spoken in English, with English captions burned in; the same captions are saved as `still-recalled-demo.srt` |
| Public on YouTube, link on the form | The builder's last step |
| No third-party advertising, slogan, logo or trademark | Practice listings carry no logos; the real search has its header and side column hidden; the words say "marketplace", never a company. Recalled products' names appear on the cards, as they do on the CPSC notices |
| Nothing that violates a third party's privacy, publicity or IP rights | No seller names; strangers' photos and towns blurred; practice photos are CPSC's or public domain |
| The project must work as shown | Every scene is a recording of the product at work: the packed 0.17.3 extension, the web page and the Android app. A sped-up wait carries its speed and its real time on screen. The overlays are drawn from the same recordings and test reports |

## How it is made

Everything is in `scripts/demo/`. The recordings and the finished video are kept outside the repo, in
`E:/still-recalled-video/`.

| Step | Command | What it does |
|---|---|---|
| The voice | `python scripts/demo/voice.py --rate=-8%` | Reads the nine lines under "The words alone" with a neural voice (edge-tts, `en-US-AndrewNeural`) and saves the time of every word. Captions and every overlay are timed from those words, so picture and voice stay together |
| The recordings | `node scripts/demo/record.mjs off`, `ext`, `page-cloud`, `market` | Puppeteer drives a real Chrome window through each scene. Each take is saved as screen frames with their own clock, plus a mark for every moment the edit needs ("first badge", "card open", "result") |
| The recordings that use Gemini Nano | `bash scripts/demo/nano-takes.sh` | Records the web page reading on the device (`page-device`) and the extension with the built-in model, in the Chrome profile that holds Gemini Nano. Gemini Nano needs the computer's model slot to itself and about 7 GB of free memory, so the script waits for both |
| The edit | `bash scripts/demo/render-all.sh` | `stage.js` draws every frame at 1920 x 1080 as a function of time: the footage, the camera moves, the callouts and the captions. `build.mjs` captures the frames, encodes each scene, joins them and lays the narration under |

**How the takes are set up**
- **The extension** is the packed release build (`dist/still-recalled-extension`, 0.17.3), installed fresh for the
  take, on the practice listings at https://still-recalled.web.app/try/.
- **The pointer** is drawn by the recorder and moves the way a hand does: it rests on a thing for a second before
  it clicks.
- **The web page** in scene 6 is this repo's own build of the page, served by `node tools/collector.mjs`: the same
  page code as https://still-recalled.web.app. App Check on the live site turns away an automated Chrome, as it is
  meant to, so the recorder uses the local build with App Check's debug provider.
- **The marketplace search** in scene 7 is signed out, in a new Chrome profile. The recorder hides the site's
  header and side column and blurs the sellers' photos and town names before the first frame is saved.

## The scenes

### Scene 1 · The hidden danger · 0:00 to 0:10

- **Screen:** the first practice listing, "Inclined baby sleeper, pink, folds flat, $25", once without a badge and
  once with it.
- **Recorded:** take `off` is the practice page in a Chrome with no extension: the pointer rests on the listing's
  title, then its price. Take `flow` is the same page with the extension installed and the red badge "Inclined
  infant sleeper" on that listing.
- **Added in the edit:** a slow zoom on the title and price; the cut to the badged page just before "Still Recalled
  does", with a small push-in as the badge appears; and one caption: "About 100 infant deaths were reported in one
  recalled sleeper. CPSC, 2023".
- **Say:** **"This ordinary baby sleeper looks harmless. But this type has been linked to infant deaths. The
  listing doesn't warn the parent. Still Recalled does."**

### Scene 2 · It works, and where it runs · 0:10 to 0:26

- **Screen:** https://still-recalled.web.app/try/, just loaded, from the top of the page.
- **Recorded:** the pointer shows the red line "Extension on", then the page scrolls to the listings. Small grey
  pills appear on the photos while each listing is checked: "Looking on this computer", then "Checking in the
  cloud". When the badges have settled the pointer moves along the top row: badge, none on the xylophone, badge,
  none on the toys.
- **Added in the edit:** a two-line legend, "On your computer: every listing is screened here first" and "In the
  cloud: only flagged or uncertain listings". The wait is sped up and marked with its speed, and a second chip
  gives the real time for the page.
- **Say:** **"It checks every listing as you scroll, on your computer first. Only flagged or uncertain listings go
  to the cloud for a closer look. Of these seventeen practice listings, the eight recalled or banned products get
  a badge, and the ordinary ones get none."**

### Scene 3 · The cloud asks the device · 0:26 to 0:54 · the scene that wins

- **Screen:** the first listing and its red badge "Inclined infant sleeper".
- **Recorded:** the pointer rests on the listing's **title**, clicks the red badge, and the card opens over the
  page. The pointer then runs along the card's third paragraph, which begins "It may be the Rock 'n Play Sleepers,
  recalled January 2023 (recall 23088)" and ends "asked the recall field guide on this device, which had it."
- **Added in the edit:** a panel headed "How an unnamed listing gets its recall", with three steps that light up as
  they are spoken, using the real call from the release test report:
  1. **Risk detected** · on the laptop · the word rules read the title: a banned type. No brand, no model.
  2. **Product recognised** · in the cloud · Gemini sees the product in the photo.
  3. **Recall retrieved** · the cloud asks the laptop · the laptop's field guide of 10,089 notices answers.
  Under them, a black box headed "Firebase AI Logic function calling", with the call's two legs: "Cloud → laptop",
  `lookup_recalls("Fisher-Price", "Rock 'n Play sleeper")`, then "Laptop → cloud" and the answer, **23088**, as the
  largest thing on screen, arriving as it is spoken: "recall retrieved from the laptop's field guide". The
  arguments and the answer are read from the recording's own check. Last line: "Our code shows only recalls the
  guide returned."
- **Smart use of each part:** this title names the product type, so the word rules settle that at once and no model
  call is spent on it. Gemini Nano does its part in scenes 2, 5 and 6.
- **Say:** **"This title has no brand and no model: nothing to look a recall up by. The laptop's word rules see
  only a risky type. Gemini in the cloud recognises the product in the photo. Then, through Firebase AI Logic
  function calling, it asks the laptop which recall this is. The laptop answers from its own field guide of ten
  thousand notices: recall 23088. And our code accepts only recalls that guide returned."**

### Scene 4 · From a warning to something you can do · 0:54 to 1:15

- **Screen:** the same card, then the stroller's page.
- **Recorded (take `flow`):** the card scrolls to the black **Ask the seller** button, then **Report to CPSC**, and
  closes.
- **Recorded (take `label`):** the page of "Baby Trend Tango Mini compact stroller, gray" with its amber badge
  "Possible recall". The pointer clicks the badge, then **Add label photo** under "Settle it with the label", and
  the practice label photo is added. The answer arrives: "The label matches the recall".
- **Added in the edit:** a panel of four facts beside the card, arriving in order: "Read from the label: Model
  ST31D11A", "CPSC recall 20052, four model numbers: ST31D11A is one of them", "Compared in code: the label matches
  the recall" and "What the card says: don't buy it unless the fix was done". The answer is held for four seconds
  after the words end, and a chip gives the real time the label took to read.
- **Say:** **"The card says what to do next: ask the seller, or report the listing. And when a photo can't settle
  it, like this stroller recalled for four model numbers only, add the label. Gemini reads the model number, code
  checks it against the notice, and it matches."**

### Scene 5 · Native Android, with Gemini Nano · 1:15 to 1:29

- **Screen:** the clip from the builder's Pixel, `E:\still-recalled-video\android-nano-shared-clean.mp4`: a listing
  arrives through the share menu, the result follows 11 seconds later naming recall 23088, and "How it was checked"
  reads "Looked at on this phone · Gemini Nano".
- **Added in the edit:** the clip plays at its real speed, under the heading "Android app · recorded on a Pixel,
  real speed". The phone's own lines "Gemini Nano is ready on this phone" and "Looked at on this phone · Gemini
  Nano" are outlined as they appear.
- **Say:** **"Shopping happens on phones too. On Android, share a listing from any app. Gemini Nano looks at it on
  the phone, and the phone's own recall guide names the recall, in eleven seconds."**

### Scene 6 · One call, either model · 1:29 to 1:48

- **Screen:** the web page checking the same example photo in two browsers, side by side, at phone size. One step
  line reads "Read on this device", the other "Read in the cloud". Both then show the same result: the example
  listing matched to recall 26591.
- **Recorded (take `page-device`):** the page in the Chrome profile that holds Gemini Nano. The pointer clicks
  **See an example match**; the first step, "Reading the screenshot", turns into "Read on this device"; the result
  card follows.
- **Recorded (take `page-cloud`):** the same page and the same click in a new Chrome profile with no built-in
  model. The step line reads "Read in the cloud", and the same result follows.
- **Added in the edit:** the heading "One Firebase AI Logic call" with `PREFER_ON_DEVICE`; both step lines
  outlined; and under each pane, in large type, the page's own words for where the read ran, "Read on this device"
  and "Read in the cloud", with the real seconds. Both stay up beside the results, which hold for more than three
  seconds with "Same code. Same photo. Same answer."
- **Why this is the real fallback:** it is one page making one `PREFER_ON_DEVICE` call, and each line prints the
  source Firebase AI Logic reported. The same two outcomes were checked by hand on the live site on November 26,
  2026 (`docs/accuracy.md`, section 38).
- **Say:** **"Not every device has Gemini Nano. It is one Firebase AI Logic call either way. This browser reads
  the photo on the device. This one has no built-in model, so the same call runs in the cloud, and the page says
  so."**

### Scene 7 · The need, and the proof · 1:48 to 2:23

- **Screen, first half:** a real marketplace search. First the recalled sleeper's name, which returns no listings;
  then **baby rocker sleeper**, with Still Recalled's "Possible recall" badges on the photos. Each search is named
  in a chip at the top left.
- **Recorded (take `market`):** signed out, in a new profile with the extension installed. The recorder waits until
  the badges have settled, then frames them. No listing is opened. On the "no listings" page the edit covers the
  site's own drawing and button, so the picture keeps the site's words only.
- **Added in the edit:** an outline on each badge, then the number **842**: "listings AI reviewers identified
  as banned or prohibited products. Three marketplaces. One day. Judged from each listing's title and photo.
  Method: docs/accuracy.md", in type large enough to read at a glance.
- **Screen, second half:** one card headed "Why hybrid works better". It stays up for the whole second half and holds three
  seconds after the last word:
  - **775** real listings tested
  - **89%** fewer false alarms than word rules
  - **77%** never left the computer
  - two small charts: "False alarms · lower is better, among 630 listings that were fine" (word rules 109,
    built-in model only 64, hybrid 12) and "Caught · higher is better, of 83 listings that should be flagged"
    (47, 51, 65)
  - under them, in bold: "Five blind tests on real listings, each on the build of its day. Answer keys by AI
    reviewers." Then: "Scored on the
    713 listings they settled. Method and every result: docs/accuracy.md"
- **Say:** **"Is the need real? On a real marketplace today, the recalled sleeper's name returns nothing, but
  "baby rocker sleeper" returns these. In one day, AI reviewers identified 842 banned or prohibited listings on
  three sites. And across 775 real listings, AI-labelled, the hybrid cut false alarms by 89 percent against word
  rules, caught more, and kept 77 percent on the computer. Every result is in the repo."**

### Scene 8 · Why it keeps up, and scales · 2:23 to 2:41

- **Screen:** the practice listing "Kidsview baby bouncer with toy bar, khaki", with an amber badge.
- **Recorded (take `bouncer`):** the pointer shows the bouncer's amber badge, opens its page and its card, rests on
  the recall's date (November 2026), and clicks **Watch for recalls**, which changes to "Watching for recalls".
- **Added in the edit:** a panel headed "How a new recall reaches every device": CPSC publishes recall 27092 on November
  19, 2026, the extension fetches it, Gemini in the cloud writes its field-guide entry once, Firestore shares it with Chrome, Android and
  the web, and App Check guards both. Then the counts from this recording's own install, in large figures: **9**
  entries read from the shared guide, **0** written again.
- **Say:** **"New recalls arrive every week. This bouncer's recall is newer than the list the extension ships
  with. The extension fetched it, Gemini wrote its field-guide entry once, and Firestore shares it with every
  device. App Check guards both. And it keeps watching what you bought."**

### Scene 9 · The close · 2:41 to 2:55

- **Screen:** back to the first listing with its red badge, then a closing card: the logo, "The warning belongs on
  the listing.", "Chrome extension · Android app · Web", "still-recalled.web.app · free and open source". The card
  holds for three seconds after the last word.
- **Say:** **"No match never means safe. But buying secondhand should save families money, not put their children
  at risk. Still Recalled puts the warning on the listing, before they buy."**

## The words alone (403 words in 175 seconds, about 2.3 a second)

1. This ordinary baby sleeper looks harmless. But this type has been linked to infant deaths. The listing doesn't
   warn the parent. Still Recalled does.
2. It checks every listing as you scroll, on your computer first. Only flagged or uncertain listings go to the
   cloud for a closer look. Of these seventeen practice listings, the eight recalled or banned products get a
   badge, and the ordinary ones get none.
3. This title has no brand and no model: nothing to look a recall up by. The laptop's word rules see only a risky
   type. Gemini in the cloud recognises the product in the photo. Then, through Firebase AI Logic function
   calling, it asks the laptop which recall this is. The laptop answers from its own field guide of ten thousand
   notices: recall 23088. And our code accepts only recalls that guide returned.
4. The card says what to do next: ask the seller, or report the listing. And when a photo can't settle it, like
   this stroller recalled for four model numbers only, add the label. Gemini reads the model number, code checks
   it against the notice, and it matches.
5. Shopping happens on phones too. On Android, share a listing from any app. Gemini Nano looks at it on the phone,
   and the phone's own recall guide names the recall, in eleven seconds.
6. Not every device has Gemini Nano. It is one Firebase AI Logic call either way. This browser reads the photo on
   the device. This one has no built-in model, so the same call runs in the cloud, and the page says so.
7. Is the need real? On a real marketplace today, the recalled sleeper's name returns nothing, but "baby rocker
   sleeper" returns these. In one day, AI reviewers identified 842 banned or prohibited listings on three sites.
   And across 775 real listings, AI-labelled, the hybrid cut false alarms by 89 percent against word rules, caught
   more, and kept 77 percent on the computer. Every result is in the repo.
8. New recalls arrive every week. This bouncer's recall is newer than the list the extension ships with. The
   extension fetched it, Gemini wrote its field-guide entry once, and Firestore shares it with every device. App
   Check guards both. And it keeps watching what you bought.
9. No match never means safe. But buying secondhand should save families money, not put their children at risk.
   Still Recalled puts the warning on the listing, before they buy.

## Where each spoken fact comes from

| Said | Source |
|---|---|
| This type of product has been linked to infant deaths | About 100 deaths reported in the Rock 'n Play sleeper (CPSC, 2023; README, "The problem") |
| On your computer first; only flagged or uncertain listings go to the cloud | The pipeline (README, "How the hybrid AI works"); the pills on the page |
| Seventeen practice listings, eight flagged | Packed 0.17.3 release, 18 of 18 checks (`tools/e2e-report-release-try.json`) |
| The cloud asked the laptop; recall 23088 | Same report, the function-call step; the card's own text |
| Field guide of ten thousand notices | 10,089 CPSC recalls since 1973 (README) |
| Our code accepts only recalls the guide returned | A recall the cloud names counts only when the device returned it (`shared/lookup.mjs`) |
| Four model numbers; the label matches | The practice stroller, recall 20052; label model ST31D11A |
| Gemini Nano on the phone, eleven seconds | The recorded Pixel clip (`docs/video.md`) |
| One call, either model | The web page's one `PREFER_ON_DEVICE` call: "Read on this device" with Gemini Nano, "Read in the cloud" without (`docs/accuracy.md`, section 38) |
| The recalled name returns nothing | 90 of 90 searches signed out, 3 of 3 signed in (`docs/accuracy.md`, sections 34 and 36) |
| 842 banned or prohibited listings, three sites, one day | AI reviewers' count: products banned from sale by law or by the sites' own policies (section 34) |
| 775 listings; 89% fewer false alarms; caught more; 77% | 109 to 12 false alarms; 65 against 47 caught; five blind tests, AI-labelled (README) |
| Newer than the list the extension ships with | Kidsview bouncer, recall 27092, November 19, 2026; not in the shipped list, fetched from CPSC after install (release test report) |
| Written once, shared through Firestore | `shared/fieldguide.mjs`; in the release test, 9 entries read from the shared guide, 0 written |
| App Check guards both | Enforced on Firebase AI Logic and on Firestore (README) |

## Saved for the write-up

The Spanish page, the printable one-page card, the resale-shop page, yard-sale mode, "I own it", and the story of the
mother who still searches listings by hand. Each is real and is told in the write-up, so the video can spend its time
on one journey and one idea.

## Build it again

```
python scripts/demo/voice.py --rate=-8%      # the narration and the time of every word
node tools/collector.mjs                     # the local page server, for the scene 6 takes
node scripts/demo/record.mjs off             # scene 1, the page with no extension
node scripts/demo/record.mjs ext             # scenes 1 to 4, 8 and 9: the takes flow, label and bouncer
node scripts/demo/record.mjs page-cloud --profile=none --page=http://localhost:8766/web/index.html
node scripts/demo/record.mjs market --profile=none --url1=<the blank search> --url2=<the search with results>
bash scripts/demo/nano-takes.sh              # the Gemini Nano takes, then the whole video
bash scripts/demo/render-all.sh              # the video alone, from the takes on disk
```

The video is `E:/still-recalled-video/still-recalled-demo.mp4`, with its captions beside it as
`still-recalled-demo.srt`. The builder watches it, uploads it to YouTube as **Public**, and puts the link in the
Devpost form.
