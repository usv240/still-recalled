# Chrome Web Store listing

Everything the developer dashboard asks for, in the order it asks. Chrome does not let another extension fill in
this dashboard, so each box is pasted by hand. Publishing needs a Chrome Web Store developer account (a one-time fee).

## Steps

1. `node scripts/pack-extension.mjs --store` writes `dist/still-recalled-store.zip`. It is the release build without the
   manifest `key`, which the store rejects.
2. In the developer dashboard (https://chrome.google.com/webstore/devconsole), click **New item** and upload the zip.
   The store gives the item its own ID: the 32 letters in the page's address.
3. Add that ID to `extensionIds` in `extension/src/firebase-config.js`, and add `chrome-extension://<id>` to the
   `frame-ancestors` header for `/appcheck-bridge.html` in `firebase.json`. Then run `node scripts/deploy-web.mjs`.
   The uploaded package does not change: the list of allowed IDs lives on the site. Until this is done, the store copy
   works with word rules and the built-in model, but its cloud check gets no App Check token.
4. Fill in the three tabs below and click **Submit for review**.

Files to upload:
- Package: `dist\still-recalled-store.zip`
- Screenshots (1280 x 800, made from the gallery): `dist\store-screens\1-extension.png`, `3-label-check.png`,
  `4-new-recalls.png`, `5-hybrid.png`, `6-results.png`. They show the practice listings, whose photos are CPSC notice
  photos or public domain.
- Store icon: taken from the package (`icons/icon-128.png`).

## Tab 1: Store listing

**Title and summary** come from the package and cannot be typed here. The summary is the manifest's description
(131 characters; the limit is 132):
"Flags secondhand listings that look like a recalled product or a risky baby sleep product, and watches what you
bought for recalls."

**Description** (paste):

```
Still Recalled puts a warning on secondhand listings that look like a recalled product or a baby sleep product that may no longer be sold, such as padded crib bumpers, inclined sleepers and infant loungers.

HOW IT WORKS
- On Facebook Marketplace, eBay, Mercari and Craigslist search pages, a badge appears on each listing that needs a look.
- Click the badge for the seller's photo beside the photo from the government recall notice, what to check, a question to ask the seller, and for listings the law rules out, a ready report for the U.S. Consumer Product Safety Commission (CPSC).
- Bought it already? Choose "Watch for recalls" and you are told if it is recalled later.
- The side panel lists every flag on the page.

PRIVATE BY DESIGN
- Every listing is checked on your computer first: by word rules against every CPSC recall since 1973, and by Chrome's built-in model (Gemini Nano) where your computer has it.
- Only listings flagged on your computer, or that it can't settle, go to Gemini in the cloud for a double check, with the recall notice. You can turn this off.
- No account, no tracking.

It never says a product is safe. No match means no recall was found. Still Recalled is not affiliated with CPSC or with any marketplace.

Try it on practice listings: https://still-recalled.web.app/try/
Open source: https://github.com/usv240/still-recalled
```

**Category:** Shopping

**Language:** English (United States)

**Screenshots:** the five files in `dist\store-screens\`, in number order.

**Homepage URL:** https://still-recalled.web.app

**Support URL:** https://github.com/usv240/still-recalled/issues

**Mature content:** No.

## Tab 2: Privacy practices

**Single purpose** (paste):

```
Warn shoppers when a secondhand listing looks like a recalled or banned infant product.
```

**Permission justification**, one box per permission (paste each):

| Box | Paste |
|---|---|
| sidePanel | Shows every flagged listing on the current page, with its recall details, in Chrome's side panel. |
| storage | Keeps check results for 7 days (then deletes them), the shopper's settings, recalls published since the build, and the listings the shopper chose to watch. All stay in the browser. |
| offscreen | Runs the checking engine, including Chrome's built-in model, in a hidden extension page, so listings are checked while the side panel is closed. |
| alarms | Fetches newly published recalls from the CPSC recall API twice a day and deletes results older than 7 days. |
| notifications | Tells the shopper when a newly published recall matches a listing they chose to watch. |
| Host permission | Marketplace sites (facebook.com, ebay.com, mercari.com, craigslist.org): read the listings on search and item pages and place warning badges beside them; on Facebook only Marketplace pages are read. Photo hosts (fbcdn.net, ebayimg.com, mercdn.net): load a flagged listing's photo so the built-in model and the cloud check can look at it. cpsc.gov and saferproducts.gov: fetch recall notices and newly published recalls. still-recalled.web.app: the project's own practice listings and its App Check page. |

**Are you using remote code?** No, I am not using remote code. (All code ships in the package. Model calls go to
Google's Firebase AI Logic API.)

**Data usage: what the extension collects.** Tick **Website content** only.
The title, description, price and photo of a listing flagged on the computer are sent to Google's Firebase AI Logic
(Gemini) for the cloud check. Nothing else leaves the browser.

**Certifications:** tick all three (not sold to third parties; not used or transferred for unrelated purposes; not
used for creditworthiness or lending).

**Privacy policy URL:** https://still-recalled.web.app/privacy.html

## Tab 3: Distribution

- **Payments:** Free of charge.
- **Visibility:** Public.
- **Distribution:** All regions.

## Review

The host permissions cover several sites, so the store may give it an in-depth review, which can take longer than
a few days. Until it is approved, say "submitted to the Chrome Web Store", not "available on".
