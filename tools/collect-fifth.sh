#!/usr/bin/env bash
# Development only: collects the fifth test set (tools/fifth-listings.json), searches and cities no earlier set used.
# Craigslist in one test browser; eBay one search per test browser with a pause between, because eBay answers an
# automated browser with an error page after a search or two. Safe to run again: searches already saved are skipped.
#   bash tools/collect-fifth.sh
OUT=tools/fifth-listings.json
node tools/collect-live.mjs --out=$OUT --per=10 --ebay="" \
  --craigslist="phoenix:bassinet,phoenix:baby swing,boston:crib,boston:baby rocker,portland:bassinet,portland:crib bedding,miami:baby sleeper,miami:crib"
for q in "baby rocker" "bedside bassinet" "baby sleeper bed" "infant floor seat" "crib bedding set bumper" "baby swing" "newborn lounger pillow" "baby gear lot" "toddler bed" "jogging stroller"; do
  node tools/collect-live.mjs --out=$OUT --per=10 --ebay="$q" --craigslist=""
  sleep 40
done
node -e "const o=JSON.parse(require('fs').readFileSync('$OUT','utf8'));for(const [k,v] of Object.entries(o))console.log(k+': '+v.length);console.log('total',Object.values(o).flat().length)"
