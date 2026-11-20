#!/usr/bin/env bash
# Re-runs the four accuracy tests on the current engine, beside the first runs (tag "-rerun"), and scores them.
# Each set: the words pass (no model), then the hybrid pass in the Gemini Nano test profile. A hybrid pass that stops
# (the browser tab can freeze) is resumed until its results file is complete. Needs: npm run build, and Chrome's
# built-in model in C:/tmp/sr-nano-profile (tools/nano-profile.mjs).
#   bash tools/rerun-all.sh [tag]        default tag: -rerun
cd "$(dirname "$0")/.." || exit 1
TAG="${1:--rerun}"
curl -s -o /dev/null http://localhost:8766/tools/eval-test.html || { node tools/collector.mjs > /dev/null 2>&1 & sleep 2; }
done_file() { node -e "try{const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));process.exit(r.partial||!r.when?1:0)}catch{process.exit(1)}" "$1"; }
for s in eval fresh third fourth; do
  done_file "tools/$s-results-words$TAG.json" || node tools/eval-run.mjs --set=$s --mode=words --tag=$TAG | tail -1
  tries=0
  until done_file "tools/$s-results-hybrid$TAG.json" || [ $tries -ge 8 ]; do
    tries=$((tries + 1))
    echo "$(date +%H:%M:%S) $s hybrid, try $tries"
    node tools/eval-run.mjs --set=$s --mode=hybrid --tag=$TAG --resume | tail -1
    sleep 3
  done
  node tools/eval-score.mjs --set=$s --tag=$TAG | grep -E "listings:|words only|on-device|hybrid|cost"
done
echo "RERUN-DONE $(date +%H:%M:%S)"
