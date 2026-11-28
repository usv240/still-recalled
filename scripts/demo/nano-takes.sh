#!/bin/bash
# Records the takes that need Chrome's built-in model (Gemini Nano), then builds the video.
# Gemini Nano needs about 6 GB of free Windows commit memory to load, and only one Chrome on this computer can hold
# it. This waits (up to WAIT_HOURS, default 8) until at least NEED_GB (default 7) is free and no other Chrome is
# running the model, then:
#   1. the web page with the model ("Read on this device"), from the local build (tools/collector.mjs);
#   2. the extension on the practice listings, in the profile that has the model;
#   3. every scene, joined with the narration.
# The takes recorded without the model are kept in takes/without-model/ and put back if a recording fails.
# Usage: bash scripts/demo/nano-takes.sh    (from the repo's root; log: E:/still-recalled-video/build/nano-takes.log)
cd "$(dirname "$0")/../.." || exit 1
DIR=${DIR:-/e/still-recalled-video}
# node reads Windows paths, not /e/...
DIRW=$(cygpath -m "$DIR")
NEED_KB=$(( ${NEED_GB:-7} * 1048576 ))
END=$(( $(date +%s) + ${WAIT_HOURS:-8} * 3600 ))
say() { echo "$(date +%H:%M:%S) $*"; }
free_kb() { powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory" | tr -d '\r'; }
model_busy() { powershell -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -match 'on_device_model' }).Count" | tr -d '\r'; }

say "waiting for $(( NEED_KB / 1048576 )) GB of free memory and no other Chrome running the model"
ready=0
while [ "$(date +%s)" -lt "$END" ]; do
  kb=$(free_kb); busy=$(model_busy)
  if [ "${kb:-0}" -ge "$NEED_KB" ] && [ "${busy:-1}" = "0" ]; then
    # Twice, half a minute apart: a moment of free memory is not enough.
    sleep 30; kb=$(free_kb); busy=$(model_busy)
    if [ "${kb:-0}" -ge "$NEED_KB" ] && [ "${busy:-1}" = "0" ]; then ready=1; break; fi
  fi
  sleep 30
done
if [ "$ready" != "1" ]; then say "memory never came free: $(( $(free_kb) / 1048576 )) GB free now. Nothing recorded."; exit 3; fi
say "memory is free: $(( kb / 1048576 )) GB. Recording."

curl -s -o /dev/null http://localhost:8766/web/index.html || { say "starting the local page server"; (node tools/collector.mjs > "$DIR/build/collector.log" 2>&1 &); sleep 4; }

# 1. The web page, with the model. A take that already read on the device is kept (PAGE=again records it anew).
page_ok() { node -e "const t=require('$DIRW/takes/page-device/take.json');const r=t.marks.find(m=>m.name==='read'),s=t.marks.find(m=>m.name==='result');process.exit(r&&/Read on this device/.test(r.text)&&s&&s.ok?0:1)" 2>/dev/null; }
if [ "$PAGE" != "again" ] && page_ok; then say "the web page take on disk already read on the device; keeping it"; else
node scripts/demo/record.mjs page-device --page=http://localhost:8766/web/index.html > "$DIR/build/rec-device.log" 2>&1
grep -v "^\s*at " "$DIR/build/rec-device.log" | tail -4 | cut -c1-240
if ! page_ok; then
  say "the page did not read on the device: Gemini Nano is not running here. Stopping before the extension take."
  node -e "const fs=require('fs');const f='$DIRW/takes/page-device/take.json';try{const t=JSON.parse(fs.readFileSync(f,'utf8'));t.marks=t.marks.map(m=>m.name==='read'?{...m,name:'read (not on the device)'}:m);fs.writeFileSync(f,JSON.stringify(t));}catch{}"
  exit 4
fi
say "the web page read on the device"
fi

# 2. The extension, with the model. Keep the takes made without it.
mkdir -p "$DIR/takes/without-model"
for t in flow label bouncer; do [ -d "$DIR/takes/without-model/$t" ] || cp -r "$DIR/takes/$t" "$DIR/takes/without-model/$t"; done
node scripts/demo/record.mjs ext > "$DIR/build/rec-ext-nano.log" 2>&1
ok=$?
grep -v "^\s*at " "$DIR/build/rec-ext-nano.log" | grep -E "nano|pill|engine done|take |Error" | cut -c1-200
if [ "$ok" != "0" ] || ! node -e "const t=require('$DIRW/takes/flow/take.json');process.exit(t.marks.some(m=>m.name==='pill device')&&t.marks.some(m=>m.name==='card closed')?0:1)"; then
  say "the extension take with the model did not finish; putting back the takes made without it"
  for t in flow label bouncer; do cp -r "$DIR/takes/without-model/$t/." "$DIR/takes/$t/"; done
else
  say "the extension takes show the model at work"
fi

# 3. The video.
bash scripts/demo/render-all.sh
say "done"
