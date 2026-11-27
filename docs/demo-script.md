# Demo script: Still Recalled (2:54)

A take you record yourself, scene by scene. Each scene says what is on screen, where to point and click, where to
go next, and the words to say in **bold**. Record each scene as its own clip; the clips are cut, cropped, captioned
and joined afterwards. The limit is 3:00, and only the first three minutes are judged. This replaces the scene table
in `docs/video.md`.

## The one idea the video carries

**The cloud teaches the device. The device screens every listing. And when either needs help, it asks the other.**
Every scene shows one part of that sentence working, on a product a parent would use.

The order: the danger, the product working, the technical moment, a next step, the phone, the fallback, the proof,
the scale, the close.

| # | Starts | Scene | Who records it |
|---|---|---|---|
| 1 | 0:00 | The hidden danger | You record two short clips |
| 2 | 0:12 | It works, and where it runs | You record |
| 3 | 0:31 | The cloud asks the device | You record |
| 4 | 1:01 | From a warning to something you can do | You record |
| 5 | 1:22 | Native Android, with Gemini Nano | Already recorded |
| 6 | 1:37 | One call, either model | Made in the edit |
| 7 | 1:55 | The need, and the proof | You record the first half |
| 8 | 2:22 | Why it keeps up, and scales | You record |
| 9 | 2:41 | The close | Made in the edit |

You record five scenes (1, 2, 3, 4, 8) and half of scene 7. Scenes 5, 6 and 9 need your voice only.

## What each scene is for

The four judging criteria count equally. Technological Implementation breaks a tie first, then Design.

| Criterion (Rules.md) | What the judge must see | Scenes |
|---|---|---|
| Technological Implementation: "how effectively does it use Firebase AI Logic hybrid inference" | Device first, cloud second (2); the cloud's function call answered by the device (3); Gemini Nano on a phone (5); the same call falling back to the cloud (6); Firestore, App Check and new recalls (8) | 2, 3, 5, 6, 8 |
| Design: "a complete, coherent product experience" | Badge, card, next step, label check, phone, watch list: one product with no dead ends | 2, 3, 4, 5, 8 |
| Potential Impact: "a credible, specific case ... a real problem for a real audience" | The danger in one listing; a real search with our badges on it; the counts, with their limits on screen | 1, 7, 9 |
| Quality of the Idea: "creative, non-obvious use" | A listing with no brand, named anyway, by a question that runs from the cloud to the device, which holds the facts | 3, 8 |

## Rules check (Rules.md, the video)

| Rule | How this take meets it |
|---|---|
| Not longer than 3 minutes | 2:54 of words and pictures; checked again after the cut |
| Shows the project working on the platforms it was built for | Chrome extension (scenes 1 to 4, 7, 8), Android (5, 6) and the web page (6) |
| In English, or with English subtitles | Spoken in English, with English captions |
| Public on YouTube, link on the form | Your last step |
| No third-party advertising, slogan, logo or trademark | Practice listings carry no logos; the real search is cropped to its grid; say "marketplace", never a company. Recalled products' names appear on the cards, as they do on the CPSC notices |
| Nothing that violates a third party's privacy, publicity or IP rights | No seller names; strangers' photos and towns blurred; practice photos are CPSC's or public domain |
| The project must work as shown | Every scene is the released build or a recording of it; a sped-up wait is marked on screen; nothing is simulated |

## Before you record (15 minutes)

1. **Give Gemini Nano the computer to itself, then restart Chrome.** This computer's graphics card holds one copy of
   the model. On November 26 a test in another project was running Gemini Nano in its own Chrome, and the model in
   your Chrome could not start. Make sure no other test is running, then close every Chrome window and open it
   again. Scene 2 needs it: the grey pill "Looking on this computer" is Gemini Nano at work.
2. **Chrome:** the Still Recalled extension is loaded. In `chrome://extensions`, click the reload arrow on its card
   so it runs 0.17.3. Hide the bookmarks bar (Ctrl+Shift+B). Close other tabs.
3. **Window:** one Chrome window, full screen (F11), zoom 100%.
4. **Quiet:** turn on Do Not Disturb in Windows so no notification pops up.
5. **Save the label photo.** Open https://still-recalled.web.app/try/item/compact-stroller.html, click **Save it**
   under the sticker photo, and save it to the Desktop. Scene 4 uses it.
6. **Warm-up run.** Open https://still-recalled.web.app/try/ once, scroll down to the listings, and wait until the
   red line near the top reads "8 of the 8". This loads Gemini Nano: you should see "Looking on this computer" pills
   on some photos while it checks. If you see none, say so before recording. Then go through scenes 2, 3, 4 and 8 once
   without recording. If you clicked **Watch for recalls** in the warm-up, click it again to turn it off.
7. **Recorder:** Windows key + Alt + R starts and stops a recording of the window (saved in Videos\Captures).
   Record your voice at the same time, or record the voice afterwards over the finished cut; both work. The
   recorder may leave out the "choose a file" box in scene 4; that is fine, the card's answer is what matters.
8. **Save clips** as `scene-1a.mp4`, `scene-1b.mp4`, `scene-2.mp4` and so on, in `E:\still-recalled-video\takes\`.

**Three rules while recording**
- **Move slowly.** Rest the pointer on the thing you are talking about for a full second before you click.
- **No logos.** The practice listings carry none. Scene 7 is a real marketplace page: do not open a listing there
  (an open listing shows the seller's name).
- **Say what the screen shows.** If a card says something different from this script, read the card.

## The scenes

### Scene 1 · The hidden danger · 0:00 to 0:12

- **Screen:** the first practice listing, "Inclined baby sleeper, pink, folds flat, $25", once without a badge and
  once with it.
- **Do:**
  1. Clip 1a: open an Incognito window (Ctrl+Shift+N), where the extension is off. Go to
     https://still-recalled.web.app/try/ and scroll until "baby gear · Seattle area" is at the top. Rest the pointer
     on the first listing's title, then its price. Hold four seconds. Close the Incognito window.
  2. Clip 1b: the same page in your normal window, scrolled to the same place, with the red badge
     "Inclined infant sleeper" on that listing. Hold three seconds.
- **Added in the edit:** a slow zoom on the title and price, the cut from 1a to 1b on "Still Recalled does", and one
  caption: "About 100 infant deaths were reported in one recalled sleeper (CPSC, 2023)".
- **Say:** **"This looks like an ordinary secondhand baby sleeper. This type of product has been linked to infant
  deaths, and nothing on the listing warns the parent. Still Recalled does."**
- **Next:** reload the page in your normal window for scene 2.

### Scene 2 · It works, and where it runs · 0:12 to 0:31

- **Screen:** https://still-recalled.web.app/try/ in your normal window, just reloaded, top of the page.
- **Do:**
  1. Point at the red line "Extension on".
  2. Scroll down to the listings. Small grey pills appear on the photos: "Looking on this computer", then
     "Checking in the cloud". Rest the pointer beside one of each as you say those words.
  3. When the badges have settled, move the pointer along the top row: badge, none on the xylophone, badge, none
     on the toys.
- **Note:** the first check takes about 30 seconds. Keep recording; the wait is sped up in the edit and marked "2x".
- **Say:** **"It checks every listing as you scroll, on your computer first. Only what it can't settle goes to the
  cloud. Of these seventeen practice listings, the eight recalled or banned products get a badge, and the ordinary
  ones get none."**
- **Next:** stay here.

### Scene 3 · The cloud asks the device · 0:31 to 1:01 · the scene that wins

- **Screen:** the first listing and its red badge "Inclined infant sleeper".
- **Do:**
  1. Point at the listing's **title** under the photo. Hold two seconds.
  2. Click the red badge. The card opens over the page.
  3. Point at the third paragraph of the card. It begins "It may be the Rock 'n Play Sleepers, recalled January
     2023 (recall 23088)" and ends "asked the recall field guide on this device, which had it." Run the pointer
     slowly along that last sentence, and hold.
- **Added in the edit:** three small steps that light up beside the card as you speak, using the real call from the
  release test report:
  1. On the laptop · word rules: "inclined sleeper", a banned type. No brand.
  2. In the cloud · Gemini sees a Fisher-Price Rock 'n Play in the photo.
  3. Cloud asks laptop · `lookup_recalls("Fisher-Price", "Rock 'n Play sleeper")` → the field guide answers 23088.
- **Why the words say "word rules" here and not Gemini Nano:** this title names the product type, so the word rules
  flag it and Gemini Nano is not asked. Gemini Nano is shown doing its part in scenes 2, 5 and 6.
- **Say:** **"This title has no brand and no model: nothing to look a recall up by. The laptop's word rules see
  only a risky type. Gemini in the cloud recognises the product in the photo, then asks the laptop which recall it
  is. The laptop answers from its own field guide of ten thousand notices: recall 23088. It's a Firebase AI Logic
  function call, so the cloud can't invent a recall."**
- **Next:** stay in the card.

### Scene 4 · From a warning to something you can do · 1:01 to 1:22

- **Screen:** the same card, then the stroller's page.
- **Do:**
  1. Scroll down inside the card. Stop on the black **Ask the seller** button, then on **Report to CPSC**.
  2. Click the X at the top of the card. Scroll to the fourth row and click the title of "Baby Trend Tango Mini
     compact stroller, gray". Its page opens with an amber badge, "Possible recall", above the title.
  3. Click the amber badge. In the card, find "Settle it with the label" and click **Add label photo**. Choose the
     label photo you saved to the Desktop.
  4. Wait for the answer, "The label matches the recall", and point at it. Hold two seconds.
- **Note:** the line under the answer says where the label was read. Leave it on screen; the words don't name it.
- **Say:** **"The card says what to do next: ask the seller, or report the listing. And when a photo can't settle
  it, like this stroller recalled for four model numbers only, add the label. Gemini reads the model number, code
  checks it against the notice, and it matches."**
- **Next:** nothing to record for scenes 5 and 6.

### Scene 5 · Native Android, with Gemini Nano · 1:22 to 1:37

- **Screen:** the clip from your Pixel, `E:\still-recalled-video\android-nano-shared-clean.mp4`: a listing arrives
  through the share menu, the result follows 11 seconds later naming recall 23088, and "How it was checked" reads
  "Looked at on this phone · Gemini Nano".
- **Do:** nothing on screen. Record the voice only.
- **Added in the edit:** the 11-second wait is shown whole, with a small timer, so the speed is the real one.
- **Say:** **"Shopping happens on phones too. On Android, share a listing from any app. Gemini Nano looks at it on
  the phone, and the phone's own recall guide names the recall, in eleven seconds."**

### Scene 6 · One call, either model · 1:37 to 1:55

- **Screen:** two real recordings of the same app checking the same example photo, side by side, each with its
  step line enlarged: "Read on this device" on one, "Read in the cloud" on the other.
- **Do:** nothing on screen. Record the voice only.
- **Which two recordings.** It has to be one app and one call on both sides, or it does not show the fallback:
  - **First choice: the web page**, in Chrome with Gemini Nano and in a Chrome with none. The page makes one
    `PREFER_ON_DEVICE` call and prints what Firebase AI Logic reports back. The side with no model is recorded
    ("Read in the cloud"). The side with Gemini Nano is **not confirmed yet**: on November 26 the built-in model in
    this computer's Chrome had stopped ("the model process crashed too many times"), so that read also went to the
    cloud. It is checked again after Chrome is restarted (`node tools/fallback-probe.mjs`).
  - **Second choice: the Android app**, on your Pixel ("Read on this phone by Gemini Nano", already recorded) and on
    an emulator with no Gemini Nano ("Read in the cloud").
- **Rule for this scene:** only what was recorded goes in. If neither pair can be shown, the scene is cut and its
  18 seconds go to scenes 3 and 7.
- **Say:** **"Not every device has Gemini Nano. It is one Firebase AI Logic call either way. This device reads the
  photo itself. This one has no built-in model, so the same call runs in the cloud, and the screen says so."**

### Scene 7 · The need, and the proof · 1:55 to 2:22

- **Screen, first half (you record, about 12 seconds):** a real marketplace search for **baby rocker sleeper**,
  signed in, with Still Recalled's badges settled on some of the photos.
- **Do:** scroll slowly down two rows and back. Rest the pointer on one badged listing, then another. Do not click
  a listing.
- **Changed in the edit:** the site's header, logo and your profile picture are cropped off, and the sellers' photos
  and town names are blurred, so the picture shows titles, prices and our badges. These are strangers' listings.
- **Screen, second half (made in the edit, about 15 seconds):** one card with three large numbers:
  - **775** real listings tested
  - **89%** fewer false alarms than word rules (12 against 109)
  - **77%** never left the computer
  - Under them, three bars of false alarms: word rules 109, built-in model only 64, hybrid 12.
  - In text large enough to read at a glance, under the numbers: "A first evaluation. The answer keys are AI
    reviewers', not yet confirmed by people."
  - Smaller, below that: "Five blind tests, each on the engine of its day. Caught 65 of 83; the 18 misses are listed
    in docs/accuracy.md. 62 listings the reviewers could not settle are left out."
- **Say:** **"Is the need real? On a real marketplace today, the recalled sleeper's name returns nothing, but
  "baby rocker sleeper" returns these. In one day, AI reviewers counted 842 such listings on three sites. And
  across 775 real listings, AI-labelled, the hybrid cut false alarms by 89 percent against word rules, caught
  more, and kept 77 percent on the computer. Every miss is documented."**
- **Next:** go back to https://still-recalled.web.app/try/ for scene 8.

### Scene 8 · Why it keeps up, and scales · 2:22 to 2:41

- **Screen:** the practice listings, fourth row: "Kidsview baby bouncer with toy bar, khaki", with an amber badge.
- **Do:**
  1. Point at the bouncer's amber badge.
  2. Click the listing's title. On its page, click the amber badge to open the card.
  3. Point at the recall's date in the card (November 2026), and hold.
  4. Click **Watch for recalls** in the card. It changes to "Watching for recalls". Hold two seconds.
- **Added in the edit:** a thin strip under the card as you say "shares it": one field-guide entry, three arrows,
  "Chrome · Android · Web". In the release test, 9 new recalls' entries were read from the shared guide and none
  had to be written again.
- **Say:** **"New recalls arrive every week. This bouncer was recalled after this version shipped. The extension
  fetched the notice, Gemini wrote its field-guide entry once, and Firestore shares it with every device. App
  Check protects every call. And it keeps watching what you bought."**
- **Next:** nothing more to record.

### Scene 9 · The close · 2:41 to 2:54

- **Screen:** back to the first listing with its red badge (from clip 1b), then a closing card: the logo, "The
  warning belongs on the listing", "Chrome · Android · Web", "Free and open source", still-recalled.web.app.
- **Do:** nothing on screen. Record the voice only. Say the last sentence slowly.
- **Say:** **"No match never means safe. But buying secondhand should save families money, not put their children
  at risk. Still Recalled puts the warning on the listing, before they buy."**

## The words alone (394 words in 174 seconds, about 2.3 a second)

1. This looks like an ordinary secondhand baby sleeper. This type of product has been linked to infant deaths, and
   nothing on the listing warns the parent. Still Recalled does.
2. It checks every listing as you scroll, on your computer first. Only what it can't settle goes to the cloud. Of
   these seventeen practice listings, the eight recalled or banned products get a badge, and the ordinary ones get
   none.
3. This title has no brand and no model: nothing to look a recall up by. The laptop's word rules see only a risky
   type. Gemini in the cloud recognises the product in the photo, then asks the laptop which recall it is. The
   laptop answers from its own field guide of ten thousand notices: recall 23088. It's a Firebase AI Logic
   function call, so the cloud can't invent a recall.
4. The card says what to do next: ask the seller, or report the listing. And when a photo can't settle it, like
   this stroller recalled for four model numbers only, add the label. Gemini reads the model number, code checks
   it against the notice, and it matches.
5. Shopping happens on phones too. On Android, share a listing from any app. Gemini Nano looks at it on the phone,
   and the phone's own recall guide names the recall, in eleven seconds.
6. Not every device has Gemini Nano. It is one Firebase AI Logic call either way. This device reads the photo
   itself. This one has no built-in model, so the same call runs in the cloud, and the screen says so.
7. Is the need real? On a real marketplace today, the recalled sleeper's name returns nothing, but "baby rocker
   sleeper" returns these. In one day, AI reviewers counted 842 such listings on three sites. And across 775 real
   listings, AI-labelled, the hybrid cut false alarms by 89 percent against word rules, caught more, and kept 77
   percent on the computer. Every miss is documented.
8. New recalls arrive every week. This bouncer was recalled after this version shipped. The extension fetched the
   notice, Gemini wrote its field-guide entry once, and Firestore shares it with every device. App Check protects
   every call. And it keeps watching what you bought.
9. No match never means safe. But buying secondhand should save families money, not put their children at risk.
   Still Recalled puts the warning on the listing, before they buy.

## Where each spoken fact comes from

| Said | Source |
|---|---|
| This type of product has been linked to infant deaths | About 100 deaths reported in the Rock 'n Play sleeper (CPSC, 2023; README, "The problem") |
| On your computer first; only what it can't settle goes to the cloud | The pipeline (README, "How the hybrid AI works"); the pills on the page |
| Seventeen practice listings, eight flagged | Packed 0.17.3 release, 18 of 18 checks (`tools/e2e-report-release-try.json`) |
| The cloud asked the laptop; recall 23088 | Same report, the function-call step; the card's own text |
| Field guide of ten thousand notices | 10,089 CPSC recalls since 1973 (README) |
| The cloud can't invent a recall | A recall the cloud names counts only when the device returned it (`shared/lookup.mjs`) |
| Four model numbers; the label matches | The practice stroller, recall 20052; label model ST31D11A |
| Gemini Nano on the phone, eleven seconds | The recorded Pixel clip (`docs/video.md`) |
| One call, either model | `PREFER_ON_DEVICE` in the web page and the Android app; each prints the source Firebase AI Logic reports. Shown only as recorded (scene 6) |
| The recalled name returns nothing | 90 of 90 searches signed out, 3 of 3 signed in (`docs/accuracy.md`, sections 34 and 36) |
| 842 listings, three sites, one day | AI reviewers' count (section 34) |
| 775 listings; 89% fewer false alarms; caught more; 77% | 109 to 12 false alarms; 65 against 47 caught; five blind tests, AI-labelled (README) |
| Recalled after this version shipped | Kidsview bouncer, recall 27092, November 19, 2026; not in the shipped list, fetched from CPSC after install (release test report) |
| Written once, shared through Firestore | `shared/fieldguide.mjs`; in the release test, 9 entries read from the shared guide, 0 written |
| App Check protects every call | Enforced on Firebase AI Logic and Firestore (README, "Security") |

## Left out on purpose

- **The mother's story, the Spanish page, the printable card, the resale-shop page, yard-sale mode.** All real, all in
  the write-up. Each one in the video would take time from the scenes above.
- **The person's check of 34 photos** (the same answer as the AI on 19 of 34). It is in the README and section 37;
  the video says "AI-labelled" wherever a count appears.

## After recording

1. Put the clips in `E:\still-recalled-video\takes\`.
2. They are then cut to the times above. The edit adds the scene 3 steps, the fallback clip, the number card, the
   Firestore strip, the closing card and English captions, speeds up and marks the scene 2 wait, crops and blurs
   scene 7, and checks the length is under 3:00.
3. You watch the result, upload it to YouTube as **Public**, and put the link in the Devpost form.
