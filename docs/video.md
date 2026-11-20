# Video script (about 2:55)

`scripts/make-video.mjs` builds a draft from real footage (`scripts/record-demo.mjs`: the extension on the practice
listings and the label check; `scripts/record-phone.mjs`: the web page at phone size), slides drawn from the test
reports, a neural voice and burned-in captions. The Android scenes are screen recordings from a phone or the emulator
(`adb shell screenrecord`). To narrate it yourself, record over the same words.

Pace: 389 words in 176 seconds, a little over two words a second. No scene asks for more than 2.7.

| Time | Seconds | Picture | Words |
|---|---|---|---|
| 0:00 | 13 | A Marketplace-style feed of baby gear scrolls by | "A mother whose son died in a recalled sleeper still searches Marketplace for it every week, by hand, because sellers don't use its name. Recalls reach the first owner. The next one never hears." |
| 0:13 | 14 | Practice listings at still-recalled.web.app/try; the page says "Extension on"; badges appear in real time (or marked "2× speed" if it is sped up) | "Still Recalled puts the warning on the listing. These are practice listings. Eight of the seventeen are recalled products, and all eight get a badge. The toys and the bottle don't." |
| 0:27 | 20 | The first listing, "Inclined baby sleeper, pink, folds flat": the pill "Checking in the cloud", then **Inclined infant sleeper**; its card names the Rock 'n Play recall and says how it was found | "This seller never wrote Rock 'n Play, so the laptop's word rules saw only a risky type. Gemini in the cloud recognised the sleeper in the photo, and asked the laptop which recall it is. That question is a Firebase AI Logic function call, answered on the device." |
| 0:47 | 15 | The crib bedding card opens: the bumper outlined, "Skip this one" | "This set hides padded bumpers, banned from sale since 2022. The title never says bumper. The cloud confirmed it and outlined it, and the card says what to do." |
| 1:02 | 24 | Slide 5: where each step runs | "The design runs both ways. The cloud read every CPSC recall since 1973, once, and wrote the device a field guide. The device screens every listing, privately. Only what it flags, or can't settle, goes to the cloud. In the tests, about three listings in four never left the laptop." |
| 1:26 | 15 | The stroller's label photo is added; read on the device | "When it comes down to a model number, add a photo of the label. Gemini Nano reads it on the device, and code compares it with the notice. Anything that would reassure is read again in the cloud." |
| 1:41 | 18 | Android: a Facebook Marketplace screenshot shared to Still Recalled; the result; "How it was checked" open | "On Android, share any listing to it, Facebook Marketplace included. The same rules run on the phone, through Firebase AI Logic for Android. This phone has no Gemini Nano, so the look ran in the cloud, and the app says so." (On a phone with Gemini Nano, say "looked at on this phone" instead, only if the screen shows it.) |
| 1:59 | 11 | Android: Watch for recalls; then the notification "Something you're watching may be recalled" | "Bought it already? Watch it. This bouncer was recalled the day after the build. The phone fetched the recall and sent this." |
| 2:10 | 11 | The web page, "I own it": a typed "Boppy newborn lounger"; "Don't sell it or give it away" | "Selling instead? Choose I own it. The same check says don't pass it on, and what the recall offers you." |
| 2:21 | 18 | Slide 6: the results of the tests | "On 775 real listings it had never seen, in five blind tests, word rules alone raised 109 false alarms. The hybrid raised 12, and caught 65 of the 83 that should be flagged." |
| 2:39 | 9 | Firebase console: the Remote Config cloud switch | "Remote Config holds the model list and a cloud switch, so a retired model is replaced on every install within the hour." |
| 2:48 | 8 | Logo, links | "It never says a product is safe. Still Recalled: free and open source, in Chrome, on Android and on the web." |
