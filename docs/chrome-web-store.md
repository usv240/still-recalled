# Chrome Web Store listing

Everything the store's listing form asks for. Publishing needs a Chrome Web Store developer account (a one-time fee).

## Steps

1. `node scripts/pack-extension.mjs --store` writes `dist/still-recalled-store.zip`. It is the release build without the
   manifest `key`, which the store rejects.
2. In the developer dashboard, add a new item and upload the zip. The store gives the item its own ID.
3. Add that ID to `extensionIds` in `extension/src/firebase-config.js`, and add `chrome-extension://<id>` to the
   `frame-ancestors` header for `/appcheck-bridge.html` in `firebase.json`. Then run `node scripts/deploy-web.mjs`.
   Without this step, the store copy works with word rules and the built-in model, but its cloud check gets no App Check
   token.
4. Fill in the form below and submit for review.

## Store listing

**Name:** Still Recalled

**Summary (132 characters at most):**
Flags secondhand listings on eBay, Mercari and Craigslist that look like a recalled product or a risky baby sleep product.

**Category:** Shopping

**Description:**

Still Recalled puts a warning on secondhand listings that look like a recalled product or a baby sleep product that
may no longer be sold, such as padded crib bumpers, inclined sleepers and infant loungers.

How it works
- On eBay, Mercari and Craigslist search pages, a badge appears on each listing that needs a look.
- Click the badge for the seller's photo beside the photo from the government recall notice, what to check, a question
  to ask the seller, and for listings the law rules out, a ready report for the U.S. Consumer Product Safety Commission.
- The side panel lists every flag on the page.

Private by design
- Every listing is checked on your computer first: by word rules against every CPSC recall since 1973 (10,089), and by Chrome's
  built-in model (Gemini Nano) where your computer has it.
- Only listings flagged on your computer go to Gemini in the cloud for a double check, with the recall notice.
  You can turn this off.
- No account, no tracking.

It never says a product is safe. No match means no recall was found. Still Recalled is not affiliated with CPSC.

Open source: https://github.com/usv240/still-recalled

**Single purpose:** Warn shoppers when a secondhand listing looks like a recalled or banned infant product.

## Permissions

| Permission | Why |
|---|---|
| Host access to eBay, Mercari, Craigslist and the project's practice listings (still-recalled.web.app/try) | Read the listings on search pages and place the warning badges beside them. |
| Host access to ebayimg.com, mercdn.net, fbcdn.net | Load a flagged listing's photo so the built-in model and the cloud check can look at it. |
| Host access to saferproducts.gov and cpsc.gov | Load the full recall notice and its photo for the cloud check. |
| `offscreen` | Run the checking engine, including Chrome's built-in model, in a hidden extension page, so listings are checked with the side panel closed. |
| `sidePanel` | Show every flag on the page in the side panel. |
| `storage` | Keep results for 7 days and the shopper's settings. |

The development manifest also lists `scripting` and `activeTab` for a developer page; the release package drops both.

**Remote code:** No. All code ships in the package. Model calls go to Google's Firebase AI Logic API.

## Privacy practices

**Data collected:** Website content: the title, description and photo of listings flagged on the computer are sent to
Google's Firebase AI Logic (Gemini) for the cloud check. Nothing else.

Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy:** https://still-recalled.web.app/privacy.html

## Images

- Icon: `extension/icons/icon-128.png`.
- Screenshots (1280 x 800): `docs/gallery/1-extension.png`, `2-label-check.png`, `3-hybrid.png` and
  `4-results.png`, resized. They show the practice listings, whose photos are CPSC notice photos or public domain.
