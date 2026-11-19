// Builds the practice listings at still-recalled.web.app/try/: a made-up secondhand search page the extension runs on,
// so anyone can try it in a minute without hunting for a risky listing on a live marketplace.
//
// Six listings are products the CPSC has recalled (their photos come from the recall notices, U.S. government works);
// six are ordinary toys and baby things (public-domain photos, credited on the page). Titles and descriptions are
// written the way sellers write them: no recall words, a nickname instead of the model name, the year left out.
// Usage: node scripts/make-try.mjs   (writes web/try/index.html and web/try/item/*.html; build.mjs builds try.css)
import { writeFile, mkdir, rm } from 'node:fs/promises';

const RELEASE = 'https://github.com/usv240/still-recalled/releases/latest/download/still-recalled-extension.zip';

const listings = [
  { id: 'rock-n-play', title: "Fisher-Price Rock 'n Play sleeper, pink, folds flat", price: 25, place: 'Tacoma', days: 2, img: 'rocknplay.jpg',
    text: 'Used for about four months. Gentle rocking, folds flat for travel. Clean, from a smoke-free home. Pickup only.', source: 'cpsc' },
  { id: 'xylophone', title: 'Kids xylophone with two mallets', price: 6, place: 'Seattle', days: 1, img: 'colorful-xylophone-kids.jpg',
    text: 'All the keys work. A few scratches on the frame.', source: 'cc0' },
  { id: 'newborn-lounger', title: 'Boppy newborn lounger, floral cover, washed', price: 15, place: 'Bellevue', days: 4, img: 'boppy.jpg',
    text: 'Great for tummy time and naps on the couch. Cover just washed. Barely used, baby outgrew it.', source: 'cpsc' },
  { id: 'baby-toys', title: 'Lot of baby toys: mirror, soft books, teethers', price: 12, place: 'Renton', days: 3, img: 'baby-toys.jpg',
    text: 'Everything in the photo. All washed. Good for 3 to 12 months.', source: 'cc0' },
  { id: 'braided-bumper', title: 'Braided crib bumper, mint, fits a standard crib', price: 18, place: 'Kent', days: 6, img: 'bumper.jpg',
    text: 'Soft knotted braid, wraps around the crib. Also have it in gray and salmon. Tag says model 1374.', source: 'cpsc' },
  { id: 'glass-bottle', title: 'Glass baby bottle, never used', price: 4, place: 'Seattle', days: 1, img: 'baby-bottle.jpg',
    text: 'Still has the sticker. 8 oz.', source: 'cc0' },
  { id: 'wind-up-swing', title: 'Graco baby swing, wind-up, still swings', price: 10, place: 'Everett', days: 5, img: 'swing.jpg',
    text: 'Older swing from my first kid, wind-up crank, waist belt and a flip-up tray. Works fine.', source: 'cpsc' },
  { id: 'train-tracks', title: 'Wooden train tracks with a bridge, about 30 pieces', price: 20, place: 'Lynnwood', days: 2, img: 'wooden-toy-train-tracks-and-bridge.jpg',
    text: 'Works with the common wooden train brands. Some pieces show wear.', source: 'cc0' },
  { id: 'rocking-sleeper', title: 'Bright Starts rocking sleeper, vibrates, pink', price: 20, place: 'Auburn', days: 3, img: 'rocking-sleeper.jpg',
    text: 'Rocks on its own, soothing vibration. Baby slept great in it. Smoke-free home.', source: 'cpsc' },
  { id: 'wooden-train', title: 'Small wooden train and tree', price: 5, place: 'Tacoma', days: 7, img: 'wooden-toy-train.jpg',
    text: 'Two pieces. Magnet coupler works.', source: 'cc0' },
  { id: 'bedside-bassinet', title: 'AirClub bedside bassinet QX-831, gray mesh, with pad', price: 45, place: 'Redmond', days: 2, img: 'bassinet.jpg',
    text: 'Converts from bassinet to bedside sleeper. Folds for travel. Label under the pad says QX-831.', source: 'cpsc' },
  { id: 'ride-on-car', title: 'Yellow ride-on car, metal, vintage style', price: 30, place: 'Bothell', days: 3, img: 'ride-on-car.jpg',
    text: 'Steering wheel turns. Some paint wear, adds to the look. Ages 1 to 3.', source: 'cc0' },
  { id: 'compact-stroller', title: 'Baby Trend Tango Mini compact stroller, gray', price: 40, place: 'Puyallup', days: 2, img: 'stroller.jpg',
    label: 'stroller-label.jpg',
    text: 'Folds with one hand, fits in a small trunk. Canopy and basket in good shape. Photo of the sticker on the leg below.', source: 'cpsc' },
  { id: 'wooden-blocks', title: 'Wooden building blocks, painted', price: 8, place: 'Seattle', days: 6, img: 'wooden-blocks.jpg',
    text: 'About 40 blocks in a bag. Paint is worn on a few.', source: 'cc0' },
  { id: 'wooden-puzzle', title: 'Blank wooden jigsaw puzzle, 20 pieces', price: 3, place: 'Burien', days: 1, img: 'wooden-puzzle.jpg',
    text: 'Paint your own. Never used.', source: 'cc0' },
  { id: 'peg-people', title: 'Wooden peg people and stable set', price: 14, place: 'Shoreline', days: 4, img: 'wooden-toys-2.jpg',
    text: 'Hand-painted figures, stable and tree. No pieces missing.', source: 'cc0' },
];

const credits = [
  '"Colorful xylophone kids", CC0, via rawpixel',
  '"Baby toys" by Mvolz, CC0, via Wikimedia Commons',
  '"Baby Bottle" by Burst, CC0, via StockSnap',
  '"Wooden toy train • tracks and bridge" by Thane Keller, CC0, via Wikimedia Commons',
  '"Wooden toy train" by Markus Spiske, CC0, via rawpixel',
  '"Wooden Toys" by Kristin Hardwick, CC0, via StockSnap',
  '"Yellow toy car" by Jebulon, CC0, via Wikimedia Commons',
  '"Geometric wood kids toy", CC0, via rawpixel',
  '"Wooden jigsaw puzzle" by Markus Spiske, CC0, via rawpixel',
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ago = d => (d === 1 ? 'yesterday' : `${d} days ago`);

const head = (title, depth) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Made-up secondhand listings for trying the Still Recalled Chrome extension. Nothing here is for sale.">
<meta name="robots" content="noindex">
<link rel="icon" type="image/png" sizes="32x32" href="${depth}icon-32.png">
<link rel="stylesheet" href="${depth}build/try.css">
</head>`;

const bar = depth => `<header class="bar">
  <a class="brand" href="${depth}">Still Recalled</a>
  <span class="tag">Practice listings · nothing here is for sale</span>
</header>`;

const foot = depth => `<footer class="foot">
  <p>A made-up search page for trying <a href="${depth}">Still Recalled</a>. The recalled products' photos, and the label photo, are from their
  U.S. Consumer Product Safety Commission recall notices. Other photos, all public domain (CC0): ${credits.map(esc).join('; ')}.</p>
</footer>`;

const card = l => `<li class="item">
    <a class="photo" href="./item/${l.id}.html"><img src="img/${l.img}" alt="" width="400" height="300" loading="lazy"></a>
    <a class="title" href="./item/${l.id}.html">${esc(l.title)}</a>
    <p class="meta"><span class="price">$${l.price}</span> · ${esc(l.place)} · ${ago(l.days)}</p>
  </li>`;

const index = `${head('Practice listings: Still Recalled', '../')}
<body>
${bar('../')}
<main class="wrap">
  <section class="intro" aria-labelledby="intro-title">
    <h1 id="intro-title">Try the extension on sixteen made-up listings</h1>
    <p class="lede">Seven of these are products the CPSC has recalled, written the way sellers write them: a nickname,
    often no model number, never the year. With the extension on, each of the seven gets a badge. Click it to see the recall, where the
    problem is in the photo, and what to do. The Tango Mini stroller was recalled for four model numbers only:
    open its listing, save the seller's label photo, and add it to the card to settle it.</p>
    <ol class="steps">
      <li><a class="btn" href="${RELEASE}">Download the extension</a> and unzip it.</li>
      <li>Open <code>chrome://extensions</code>, turn on Developer mode, choose Load unpacked, pick the folder.</li>
      <li>Reload this page. Badges appear as listings are checked, the matched ones first.</li>
    </ol>
    <p class="note">Chrome's built-in model (Gemini Nano) does the first look on your computer when Chrome has it. Without it the
    extension still works: the listing's words decide what the cloud looks at. No Chrome? <a href="../">Check a screenshot on the web page</a>.</p>
  </section>
  <section aria-labelledby="results-title">
    <div class="results-head">
      <h2 id="results-title">baby gear · Seattle area</h2>
      <p class="muted">${listings.length} results</p>
    </div>
    <ul class="grid">
  ${listings.map(card).join('\n  ')}
    </ul>
  </section>
</main>
${foot('../')}
</body>
</html>
`;

const item = l => `${head(`${l.title}: practice listing`, '../../')}
<body>
${bar('../../')}
<main class="wrap detail">
  <p><a class="back" href="../">← Back to results</a></p>
  <article class="listing">
    <img class="big" src="../img/${l.img}" alt="${esc(l.title)}">
    <div>
      <h1>${esc(l.title)}</h1>
      <p class="price big-price">$${l.price}</p>
      <p class="muted">${esc(l.place)} · posted ${ago(l.days)}</p>
      <p class="desc">${esc(l.text)}</p>${l.label ? `
      <figure class="label-photo">
        <img src="../img/${l.label}" alt="The model sticker on the stroller's leg">
        <figcaption>Seller's photo of the label. <a href="../img/${l.label}" download>Save it</a>, then add it to the card's label check.</figcaption>
      </figure>` : ''}
    </div>
  </article>
</main>
${foot('../../')}
</body>
</html>
`;

await rm('web/try/item', { recursive: true, force: true });
await mkdir('web/try/item', { recursive: true });
await writeFile('web/try/index.html', index);
for (const l of listings) await writeFile(`web/try/item/${l.id}.html`, item(l));
// The answer key, for the end-to-end test and the docs.
await writeFile('web/try/answers.json', JSON.stringify(listings.map(({ id, title, source }) => ({ id, title, recalled: source === 'cpsc' })), null, 2));
console.log(`web/try: ${listings.length} listings, ${listings.filter(l => l.source === 'cpsc').length} recalled`);
