# Demo script: Still Recalled (2:55)

A take you record yourself, scene by scene. Each scene says what is on screen, where to point and click, where to
go next, and the words to say in **bold**. Record each scene as its own clip; the clips are cut, cropped and joined
afterwards. The limit is 3:00, and only the first three minutes are judged. This is the take to record; it replaces
the scene table in `docs/video.md`.

## What each scene is for

The four judging criteria count equally, so every scene earns its place on one of them.

| Criterion (Rules.md) | What the judge must see | Scenes |
|---|---|---|
| Technological Implementation: "how effectively does it use Firebase AI Logic hybrid inference" | The cloud asks the device, the device answers, on screen; then the whole design in one slide | 3, 5, 6, 8 |
| Design: "a complete, coherent product experience" | Badge, card, next step, label check, phone: one product, no dead ends | 2, 4, 5, 8, 10 |
| Potential Impact: "a credible, specific case ... a real problem for a real audience" | Babies died; it is still sold; a real search with badges on it; the count | 1, 7, 9 |
| Quality of the Idea: "creative, non-obvious use" | A listing with no brand in it, named anyway, by a question that runs cloud to device | 3, 6 |

## Before you record (10 minutes)

1. **Chrome:** the Still Recalled extension is loaded (it is). Hide the bookmarks bar (Ctrl+Shift+B). Close other tabs.
2. **Window:** one Chrome window, full screen (F11), zoom 100%.
3. **Quiet:** turn on Do Not Disturb in Windows so no notification pops up.
4. **Save the label photo.** Open https://still-recalled.web.app/try/item/compact-stroller.html, click **Save it**
   under the sticker photo, and save it to the Desktop. Scene 5 uses it.
5. **Warm-up run.** Open https://still-recalled.web.app/try/ once, scroll down to the listings, and wait until the
   red line near the top reads "8 of the 8". This loads Gemini Nano. Then go through scenes 2 to 5 once without
   recording.
6. **Recorder:** Windows key + Alt + R starts and stops a recording of the window (saved in Videos\Captures).
   Record your voice at the same time, or record the voice afterwards over the finished cut; both work. The
   recorder may leave out the "choose a file" box in scene 5; that is fine, the card's answer is what matters.
7. **Save clips** as `scene-1.mp4` to `scene-10.mp4` in `E:\still-recalled-video\takes\`.

**Three rules while recording**
- **Move slowly.** Rest the pointer on the thing you are talking about for a full second before you click.
- **No logos.** Scenes 1 to 6 use the practice listings, which carry none. Scene 7 is a real marketplace page: its
  header is cropped out afterwards, so do not open a listing there (an open listing shows the seller's name).
- **Say what the screen shows.** If a card says something different from this script, read the card.

## The scenes

### Scene 1 · The problem · 0:00 to 0:17

- **Screen:** the practice listings with no badges. Open an Incognito window (Ctrl+Shift+N), where the extension is
  off, go to https://still-recalled.web.app/try/ and scroll down until "baby gear · Seattle area" is at the top.
- **Do:** scroll slowly down the listings and back up. Stop with the pointer on the first listing, the pink sleeper.
- **Say:** **"About a hundred babies died in one inclined sleeper. Selling it is against federal law. It is still
  sold secondhand, under other names. One mother who lost her son still searches for it by hand, every week."**
- **Next:** close the Incognito window.

### Scene 2 · It works · 0:17 to 0:34

- **Screen:** your normal Chrome window, https://still-recalled.web.app/try/, top of the page.
- **Do:** point at the red line "Extension on". Scroll down to the listings. Badges appear one after another; let
  them. Then move the pointer along the top row: red badge, no badge on the xylophone, red badge, no badge on the toys.
- **Say:** **"Still Recalled puts the warning on the listing. These are seventeen practice listings. Eight are
  recalled or banned products, written the way sellers write them. All eight get a badge. The toys and the bottle
  get nothing."**
- **Note:** the first check takes about 30 seconds. Keep recording; the wait is sped up afterwards and marked "2x".
- **Next:** stay here.

### Scene 3 · The cloud asks the device · 0:34 to 0:58 · the scene that wins

- **Screen:** the first listing, "Inclined baby sleeper, pink, folds flat", with its red badge "Inclined infant sleeper".
- **Do:**
  1. Point at the listing's **title** under the photo. Hold for two seconds: there is no brand in it.
  2. Click the red badge. The card opens over the page.
  3. Point at the third paragraph of the card, the one that begins "It may be the Rock 'n Play Sleepers, recalled
     January 2023 (recall 23088)" and ends "asked the recall field guide on this device, which had it." Run the
     pointer along that last sentence.
- **Say:** **"Look at this title. "Inclined baby sleeper, pink." No brand, no model. A keyword filter sees
  nothing. Gemini in the cloud recognised it in the photo, then asked this laptop which recall it is. The laptop
  answered from its own field guide: recall 23088. That is a Firebase AI Logic function call, answered on the
  device."**
- **Next:** stay in the card.

### Scene 4 · What to do next · 0:58 to 1:07

- **Screen:** the same card.
- **Do:** scroll down inside the card. Point at "Skip this one" near the top as you pass, then stop on the black
  **Ask the seller** button, then on **Report to CPSC** below it.
- **Say:** **"And the card says what to do: skip it, ask the seller this question, or report the listing to
  CPSC."**
- **Next:** click the X at the top of the card. Scroll down to the fourth row and click the title of
  "Baby Trend Tango Mini compact stroller, gray" (first listing in that row). Its page opens.

### Scene 5 · Settle it with the label · 1:07 to 1:25

- **Screen:** the stroller's page. An amber badge, "Possible recall", sits above the title, and the seller's photo
  of the sticker is on the right.
- **Do:**
  1. Point at the amber badge, then at the sticker photo.
  2. Click the amber badge. In the card, find "Settle it with the label" and click **Add label photo**.
  3. Choose the label photo you saved to the Desktop.
  4. Wait for the answer, "The label matches the recall", and point at it.
- **Say:** **"Amber means maybe. This stroller was recalled for four model numbers only. So add a photo of its
  label. Gemini reads the model number, code checks it against the notice, and now it is certain: recalled."**
- **Note:** the line under the answer says where the label was read, on this device or in the cloud. Leave it on
  screen for a second; do not say which unless you read it off the card.
- **Next:** open `docs/gallery/5-hybrid.png` full screen.

### Scene 6 · The whole design in one picture · 1:25 to 1:47

- **Screen:** the slide `docs/gallery/5-hybrid.png`, headed "Every listing is checked on your laptop. Only what it
  flags, or can't settle, goes to the cloud."
- **Do:** move the pointer in the order you speak: the "On the laptop" box (**Word rules**, then **Gemini Nano**),
  across to the "In the cloud" box (**Gemini**), and finish on the bold line "Each can ask the other."
- **Afterwards:** the slide's last line names the test sites and is cropped off.
- **Say:** **"Here is the whole design. The cloud read every CPSC recall since 1973, once, and wrote the device a
  field guide. The device screens every listing with word rules and Gemini Nano. Only what it can't settle goes to
  the cloud. Three listings in four never left the computer."**
- **Next:** open a real marketplace search for **baby rocker sleeper**, signed in.

### Scene 7 · A real search, today · 1:47 to 2:06

- **Screen:** the real search results for "baby rocker sleeper", with Still Recalled's badges on some of the photos.
  Wait until the badges have settled before you start.
- **Do:** scroll slowly down two rows and back. Rest the pointer on a badged listing, then on another. Do not click
  a listing.
- **Say:** **"This is a real marketplace search, today. Type the recalled sleeper's name: no results. Type "baby
  rocker sleeper", and here they are, with our badges on them. In one day, AI reviewers counted 842 products like
  these on three sites, thirty thousand dollars' worth."**
- **Afterwards:** the site's header, logo and your profile picture are cropped off, leaving the results grid.
- **Next:** nothing to record on screen for scene 8.

### Scene 8 · On the phone · 2:06 to 2:22

- **Screen:** the clip already recorded on your Pixel, `E:\still-recalled-video\android-nano-shared-clean.mp4`:
  a listing shared to the app, the result 11 seconds later naming recall 23088, and the line
  "Looked at on this phone · Gemini Nano".
- **Do:** nothing; the clip is cut in. Record only the voice.
- **Say:** **"On Android, share a listing from any app. Gemini Nano looks at it on the phone itself and names the
  recall in eleven seconds. Same rules, same field guide, through Firebase AI Logic for Android."**
- **Next:** open `docs/gallery/6-results.png` full screen.

### Scene 9 · Does it work? · 2:22 to 2:38

- **Screen:** the slide `docs/gallery/6-results.png`. Only its top half is used: the two sets of bars.
- **Do:** point at "Word rules only 109", then "Hybrid 12", then "Hybrid 65".
- **Say:** **"We tested it blind on 775 real listings. Word rules alone raised 109 false alarms. The hybrid raised
  12, and caught 65 of 83. The answer keys are AI-labelled, and every miss is in the repo."**
- **Next:** open https://still-recalled.web.app/?lang=es in one tab and https://still-recalled.web.app/card.html
  in another.

### Scene 10 · More, and the close · 2:38 to 2:55

- **Screen:** three quick shots, about three seconds each, then the home page.
  1. The stroller card from scene 5: point at **Watch for recalls**.
  2. The web page in Spanish.
  3. The printable one-page card.
  4. https://still-recalled.web.app, top of the page, and hold.
- **Say:** **"It also watches what you bought for new recalls, speaks Spanish, and prints a one-page card. It
  never says a product is safe. Still Recalled: free and open source, in Chrome, on Android and on the web."**

## The words alone (387 words in 175 seconds, about 2.2 a second)

1. About a hundred babies died in one inclined sleeper. Selling it is against federal law. It is still sold
   secondhand, under other names. One mother who lost her son still searches for it by hand, every week.
2. Still Recalled puts the warning on the listing. These are seventeen practice listings. Eight are recalled or
   banned products, written the way sellers write them. All eight get a badge. The toys and the bottle get
   nothing.
3. Look at this title. "Inclined baby sleeper, pink." No brand, no model. A keyword filter sees nothing. Gemini in
   the cloud recognised it in the photo, then asked this laptop which recall it is. The laptop answered from its
   own field guide: recall 23088. That is a Firebase AI Logic function call, answered on the device.
4. And the card says what to do: skip it, ask the seller this question, or report the listing to CPSC.
5. Amber means maybe. This stroller was recalled for four model numbers only. So add a photo of its label. Gemini
   reads the model number, code checks it against the notice, and now it is certain: recalled.
6. Here is the whole design. The cloud read every CPSC recall since 1973, once, and wrote the device a field
   guide. The device screens every listing with word rules and Gemini Nano. Only what it can't settle goes to the
   cloud. Three listings in four never left the computer.
7. This is a real marketplace search, today. Type the recalled sleeper's name: no results. Type "baby rocker
   sleeper", and here they are, with our badges on them. In one day, AI reviewers counted 842 products like these
   on three sites, thirty thousand dollars' worth.
8. On Android, share a listing from any app. Gemini Nano looks at it on the phone itself and names the recall in
   eleven seconds. Same rules, same field guide, through Firebase AI Logic for Android.
9. We tested it blind on 775 real listings. Word rules alone raised 109 false alarms. The hybrid raised 12, and
   caught 65 of 83. The answer keys are AI-labelled, and every miss is in the repo.
10. It also watches what you bought for new recalls, speaks Spanish, and prints a one-page card. It never says a
    product is safe. Still Recalled: free and open source, in Chrome, on Android and on the web.

## Where each spoken fact comes from

| Said | Source |
|---|---|
| About a hundred deaths in one inclined sleeper | CPSC, 2023 (README, "The problem") |
| The mother who searches by hand every week | NBC News, April 21, 2023 (`docs/submission.md`) |
| Selling it is against federal law | Banned from sale since November 2022 (README, "The problem") |
| Seventeen practice listings, eight flagged | Packed 0.17.2 release, 18 of 18 checks (`tools/e2e-report-release-try.json`) |
| The cloud asked the device; recall 23088 | Same report, the function-call step; the card's own text |
| Four model numbers; the label matches | The practice stroller, recall 20052; label model ST31D11A |
| Three listings in four never left the computer | 77% across the five blind tests (README) |
| The recalled name returns no results | 90 of 90 searches signed out, 3 of 3 signed in (`docs/accuracy.md`, sections 34 and 36) |
| 842 listings, about $30,000, three sites, one day | $30,141; AI reviewers' count (section 34) |
| Gemini Nano on the phone, eleven seconds | The recorded Pixel clip (`docs/video.md`) |
| 775 listings, 109, 12, 65 of 83 | Five blind tests, AI-labelled (README; `docs/gallery/6-results.png`) |

## After recording

1. Put the clips in `E:\still-recalled-video\takes\`.
2. They are then cut to the times above, the scene 2 wait sped up and marked, the scene 7 header cropped off, the
   phone clip and English captions added, and the length checked to be under 3:00.
3. You watch the result, upload it to YouTube as **Public**, and put the link in the Devpost form.
