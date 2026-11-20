# Video script (about 2:50)

`scripts/make-video.mjs` builds a draft from real footage (`scripts/record-demo.mjs`: the extension on the practice
listings and the label check; `scripts/record-phone.mjs`: the web page at phone size), slides drawn from the test
reports, a neural voice and burned-in captions. The Android scenes are screen recordings from a phone or the emulator
(`adb shell screenrecord`). To narrate it yourself, record over the same words.

| Time | Picture | Words |
|---|---|---|
| 0:00 | A Marketplace-style feed of baby gear scrolls by | "A mother whose son died in a recalled sleeper still searches Marketplace every week for that sleeper, by hand, because sellers don't use its name. Recalls reach the first owner. The next one never hears." |
| 0:14 | Practice listings at still-recalled.web.app/try; the page says "Extension on"; badges appear in real time, not sped up (or marked "2× speed" if it is) | "Still Recalled puts the warning on the listing. These are practice listings, and eight of the seventeen are recalled products. All eight get a badge; the toys and the bottle are left alone." |
| 0:30 | The crib bedding card opens: the bumper outlined, "Skip this one" | "This set hides padded bumpers, banned from sale since 2022. The title never says bumper. Gemini Nano saw it in the photo on the laptop, the cloud confirmed it and outlined it, and the card says what to do." |
| 0:50 | Slide: the cloud teaches the device, the device screens, only what it flags leaves | "That's the hybrid design. The cloud read every CPSC recall since 1973 once, through Firebase AI Logic, and wrote the device a field guide. The device screens every listing, privately and for free. Only what it flags, or can't settle, goes to the cloud, with the full recall notice. In four tests, 77% of listings never left the laptop." |
| 1:18 | The stroller's label photo is added; read on the device | "When it comes down to a model number, add a photo of the label. Gemini Nano reads it on the device, and code compares it with the notice. The device can raise the alarm, but anything reassuring is read again in the cloud first." |
| 1:36 | Android: Facebook Marketplace screenshot shared to Still Recalled; the result; "How it was checked" open, showing where each step ran | "On Android, share any listing to it, Facebook Marketplace included, where no extension can reach. The same rules run on the phone, and Firebase AI Logic prefers Gemini Nano where the phone has it. This phone has none, so the same call ran in the cloud, and the app says so." (On a phone with Gemini Nano, say "read on this phone" instead, only if the screen shows it.) |
| 1:56 | Android: Watch for recalls; then the notification "A watched listing matches a new recall" | "Bought it already? Watch it. Twice a day the app fetches new recalls from CPSC. This bouncer was recalled the day after the build; the phone matched it and sent this notification." |
| 2:14 | Slide: results of the four tests | "On 597 real listings from eBay, Mercari and Craigslist it had never seen, word rules alone raised 86 false alarms. The hybrid raised 11, and caught 58 of the 74 that should be flagged." |
| 2:32 | Firebase console: the Remote Config cloud switch | "Remote Config holds the models and a switch for the cloud step, so a retired model is fixed on every install within about an hour." |
| 2:42 | Logo, links | "It never says a product is safe. Still Recalled: free, open source, in Chrome, on Android and on the web." |
