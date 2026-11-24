#!/usr/bin/env bash
# Development only: collects the sixth test set (tools/sixth-listings.json), searches and cities no earlier set used.
# Aimed at infant sleep products that sellers often list without a brand: plain searches a parent would type.
# Craigslist in one test browser; eBay one search per test browser with a pause between, because eBay answers an
# automated browser with an error page after a search or two. Safe to run again: searches already saved are skipped.
#   bash tools/collect-sixth.sh
OUT=tools/sixth-listings.json
node tools/collect-live.mjs --out=$OUT --per=10 --ebay="" \
  --craigslist="minneapolis:pack n play,minneapolis:baby cradle,philadelphia:pack and play,philadelphia:playpen,dallas:playard,dallas:baby bed,sandiego:cradle,sandiego:baby nest"
# Philadelphia "co sleeper" and "mini crib", Dallas "portable crib" and San Diego "play yard" were tried first and
# dropped: most of their first results were keyword-stuffed ads (old motorcycles, sheds, building supplies).
for q in "newborn sleeper" "portable crib" "baby hammock" "moses basket" "baby cradle" "travel bassinet" "mini crib" "infant sleep positioner" "baby sleep pod" "crib mattress"; do
  node tools/collect-live.mjs --out=$OUT --per=10 --ebay="$q" --craigslist=""
  sleep 40
done
node -e "const o=JSON.parse(require('fs').readFileSync('$OUT','utf8'));for(const [k,v] of Object.entries(o))console.log(k+': '+v.length);console.log('total',Object.values(o).flat().length)"
