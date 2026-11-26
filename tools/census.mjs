// A census of what is for sale right now: Craigslist searches for the infant sleep products CPSC bans or warns about,
// in 30 large U.S. cities, read with the extension's own page reader (extension/src/extract.js) in a throwaway Chrome
// profile. Keeps every listing on each results page (not a sample), once each. No model is called: what the listings
// are is decided afterwards by the word rules (tools/census-score.mjs) and, for the ones they flag, by a review.
// Usage: node tools/census.mjs [--out=tools/census-listings.json] [--cities=boston,denver] [--queries="rock n play"]
import puppeteer from 'puppeteer-core';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const outFile = path.resolve(opt('out', 'tools/census-listings.json'));
// The 30 largest U.S. metro areas with their own Craigslist site.
const CITIES = opt('cities', 'newyork,losangeles,chicago,dallas,houston,washingtondc,philadelphia,miami,atlanta,boston,phoenix,sfbay,inlandempire,detroit,seattle,minneapolis,sandiego,tampa,denver,baltimore,stlouis,orlando,charlotte,sanantonio,portland,sac,pittsburgh,austin,lasvegas,cincinnati').split(',');
// What a parent might search, and what the four types are sold as. Plain words, no hazard terms a parent would not type.
const QUERIES = opt('queries', 'rock n play,crib bumper,baby lounger,baby nest').split(',');
// --site=ebay: one national search per query (eBay is one market), each in its own browser with a pause between, since
// eBay answers an automated browser with an error page after a search or two in the same one.
const SITE = opt('site', 'craigslist');
// --site=facebook: Facebook Marketplace, logged out, by the metro names Facebook uses in its own addresses.
const FB_CITIES = opt('cities', 'nyc,la,chicago,dallas,houston,dc,philly,miami,atlanta,boston,phoenix,sanfrancisco,detroit,seattle,minneapolis,sandiego,tampa,denver,baltimore,stlouis,orlando,charlotte,sanantonio,portland,sac,pittsburgh,austin,vegas,cincinnati,kansascity').split(',');
const PLAN = SITE === 'facebook'
  ? FB_CITIES.flatMap(city => QUERIES.map(q => ({ key: `${city}: ${q}`, city, url: `https://www.facebook.com/marketplace/${city}/search?query=${encodeURIComponent(q)}` })))
  : SITE === 'ebay'
  ? QUERIES.map(q => ({ key: `ebay: ${q}`, city: 'us', url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_ipg=120` }))
  : CITIES.flatMap(city => QUERIES.map(q => ({ key: `${city}: ${q}`, city, url: `https://${city}.craigslist.org/search/sss?query=${encodeURIComponent(q)}` })));

const reader = (await build({ entryPoints: ['extension/src/extract.js'], bundle: true, format: 'iife', globalName: '__srExtract', write: false })).outputFiles[0].text;
const launch = async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 'sr-census-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, pipe: true, userDataDir: profile,
    defaultViewport: { width: 1366, height: 900 }, args: ['--window-size=1366,1000', '--no-first-run', '--no-default-browser-check'],
  });
  return { browser, profile, page: await browser.newPage() };
};
const close = async b => { await b.browser.close().catch(() => {}); try { rmSync(b.profile, { recursive: true, force: true }); } catch { /* fine */ } };
const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : { at: new Date().toISOString(), searches: {}, listings: {} };
let b = await launch();
for (const { key, city, url } of PLAN) {
  {
    if (out.searches[key]) continue;
    if (SITE === 'ebay') { await close(b); b = await launch(); }
    const page = b.page;
    let listings = [], said = '';
    for (let attempt = 0; attempt < 2 && !listings.length; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        for (let i = 0; i < 10; i++) { await page.evaluate(() => scrollBy(0, 900)); await new Promise(r => setTimeout(r, 300)); }
        await new Promise(r => setTimeout(r, SITE === 'facebook' ? 4000 : 1200));
        if (SITE === 'facebook' && !page.url().includes(`/marketplace/${city}/search`)) { console.log(`  ${key}: sent to ${page.url().slice(0, 70)}`); break; }
        listings = await page.evaluate(`(() => { ${reader}; return __srExtract.listingsOnPage().listings.map(({ el, ...l }) => l); })()`);
        if (!listings.length) {
          // What the page says when it shows nothing (kept, so a search the site answers with no listings is on record).
          said = await page.evaluate(() => ((document.querySelector('[role=main]') || document.body).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300));
          const none = /no results|nothing found|no listings found|didn't find|did not find/i.test(said);
          if (none) break;
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (e) { console.log(`  retry ${key}: ${String(e).slice(0, 80)}`); await new Promise(r => setTimeout(r, 3000)); }
    }
    let fresh = 0;
    for (const l of listings) {
      if (out.listings[l.id]) { out.listings[l.id].searches.push(key); continue; }
      out.listings[l.id] = { ...l, url: l.site === 'ebay' ? `https://www.ebay.com/itm/${l.id}` : l.site === 'facebook' ? `https://www.facebook.com/marketplace/item/${l.id}/` : String(l.url || '').split('?')[0], city, searches: [key] };
      fresh++;
    }
    out.searches[key] = { results: listings.length, fresh, at: new Date().toISOString(), ...(listings.length || !said ? {} : { said }) };
    console.log(`${key}: ${listings.length} on page, ${fresh} new (total ${Object.keys(out.listings).length})`);
    writeFileSync(outFile, JSON.stringify(out, null, 1));
    await new Promise(r => setTimeout(r, SITE === 'ebay' ? 40000 : SITE === 'facebook' ? 6000 : 4000));
  }
}
await close(b);
console.log(`done: ${Object.keys(out.searches).length} searches, ${Object.keys(out.listings).length} listings -> ${outFile}`);
