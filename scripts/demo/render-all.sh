#!/bin/bash
# Renders every scene, then joins them with the narration.
cd "/c/Hackathons/#BuildHybridAI 2026/still-recalled" || exit 1
for s in danger works asks do android fallback proof scales; do
  node scripts/demo/build.mjs --scene=$s --enc=nvenc 2>&1 | grep -v "^\s*at " | tail -1 | cut -c1-160
done
node scripts/demo/build.mjs --scene=close --enc=nvenc --join 2>&1 | grep -v "^\s*at " | tail -2 | cut -c1-200
ffprobe -v error -show_entries format=duration -of csv=p=0 /e/still-recalled-video/still-recalled-demo.mp4
