// The demo video's edit, drawn in a page: for any moment t, render(t) puts the right footage frame, camera, overlays
// and caption on a 1920 x 1080 stage. scripts/demo/build.mjs asks for every frame in turn and encodes them.
// Everything is a function of t (no CSS transitions), so the same t always draws the same picture.
// Footage comes from scripts/demo/record.mjs (frames with their own times and named moments); the words and their
// timing from scripts/demo/voice.py. Scene times follow the voice, so the cut cannot drift from the narration.
/* eslint-env browser */
const W = 1920, H = 1080;
let D = null;
const SC = [];
const pending = [];
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const outCubic = k => 1 - Math.pow(1 - clamp(k), 3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const T = name => D.takes[name];
const M = (take, name, nth = 0) => { const m = T(take) && T(take).marks.filter(x => x.name === name)[nth]; if (!m) throw new Error(`no mark "${name}" in take ${take}`); return m; };
const has = (take, name) => !!(T(take) && (!name || T(take).marks.some(x => x.name === name)));

// ---- Footage -----------------------------------------------------------------------------------------------------
class Shot {
  constructor(parent, take, { x = 0, y = 0, w = W, h = H, radius = 0 } = {}) {
    this.take = T(take); this.x = x; this.y = y; this.w = w; this.h = h; this.cur = -1;
    this.el = el(`<div class="shot" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${radius}px"><img alt=""></div>`);
    this.img = this.el.firstChild;
    this.img.style.width = `${this.take.width}px`;
    this.img.style.height = `${this.take.height}px`;
    parent.append(this.el);
  }
  frameAt(src) {
    const f = this.take.frames;
    let lo = 0, hi = f.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (f[mid].t <= src) lo = mid; else hi = mid - 1; }
    return lo;
  }
  /** Draw the take as it was at `src` seconds, through a camera { cx, cy, z } given in the take's own CSS pixels. */
  show(src, cam = { cx: this.take.width / 2, cy: this.take.height / 2, z: 1 }) {
    const i = this.frameAt(src);
    if (i !== this.cur) {
      this.cur = i;
      this.img.src = `${D.takesUrl}/${this.take.name}/${this.take.frames[i].f}`;
      pending.push(this.img.decode().catch(() => {}));
    }
    const tw = this.take.width, th = this.take.height;
    const s = Math.max(this.w / tw, this.h / th) * (cam.z || 1);
    this.s = s;
    this.tx = clamp(this.w / 2 - cam.cx * s, this.w - tw * s, 0);
    this.ty = clamp(this.h / 2 - cam.cy * s, this.h - th * s, 0);
    this.img.style.transform = `translate(${this.tx.toFixed(2)}px,${this.ty.toFixed(2)}px) scale(${s.toFixed(5)})`;
  }
  /** Where a point of the take lands on the stage. */
  at(px, py) { return [this.x + this.tx + px * this.s, this.y + this.ty + py * this.s]; }
}
/** Output time to source time. segs: [[o0, o1, s0, s1]]; s1 null plays at real speed. Between segments the picture holds. */
function remap(segs, t) {
  let cur = segs[0];
  for (const s of segs) if (t >= s[0]) cur = s;
  if (cur[4] === 'hold') return Math.min(cur[3], cur[2] + Math.max(0, t - cur[0]));
  const s1 = cur[3] == null ? cur[2] + (cur[1] - cur[0]) : cur[3];
  return cur[2] + (s1 - cur[2]) * clamp((t - cur[0]) / Math.max(0.001, cur[1] - cur[0]));
}
const speedOf = (segs, t) => { let cur = segs[0]; for (const s of segs) if (t >= s[0]) cur = s; return cur[3] == null || cur[4] === 'hold' || t > cur[1] ? 1 : (cur[3] - cur[2]) / Math.max(0.001, cur[1] - cur[0]); };
/** Camera keys [[t, cx, cy, z]]: eased between keys, held before the first and after the last. */
function camAt(keys, t) {
  const o = k => ({ cx: k[1], cy: k[2], z: k[3] });
  if (t <= keys[0][0]) return o(keys[0]);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], k = ease((t - a[0]) / Math.max(0.001, b[0] - a[0]));
    return { cx: a[1] + (b[1] - a[1]) * k, cy: a[2] + (b[2] - a[2]) * k, z: a[3] * Math.pow(b[3] / a[3], k) };
  }
  return o(keys[keys.length - 1]);
}
/** A camera that puts a box's top-left corner at a stage position, at zoom z (for a full-stage take 1280 wide). */
const aim = (box, z, { left = 90, top = 40, base = 1.5 } = {}) => [box.x + (W / 2 - left) / (base * z), box.y + (H / 2 - top) / (base * z), z];
/** Fade and rise in at a, out at b. */
function vis(node, t, a, b = 1e9, { dy = 16, din = 0.42, dout = 0.24 } = {}) {
  const kin = outCubic((t - a) / din), kout = clamp((t - b) / dout);
  const o = t < a ? 0 : kin * (1 - kout);
  node.style.opacity = o.toFixed(3);
  node.style.transform = `translateY(${((1 - kin) * dy).toFixed(2)}px)`;
  node.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  return o;
}
/** An outline that follows a box of the footage through the camera. */
function ring(parent, cls = '') { const r = el(`<div class="ring ${cls}"></div>`); parent.append(r); return r; }
function placeRing(r, shot, box, pad = 6) {
  const [x, y] = shot.at(box.x - pad, box.y - pad);
  r.style.left = `${x}px`; r.style.top = `${y}px`;
  r.style.width = `${(box.w + pad * 2) * shot.s}px`; r.style.height = `${(box.h + pad * 2) * shot.s}px`;
}
const chip = (parent, text, cls = '') => { const c = el(`<div class="chip ${cls}">${text}</div>`); parent.append(c); return c; };

// ---- The voice: cues and captions --------------------------------------------------------------------------------
const norm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '');
function spokenTokens(i) {
  const out = [];
  for (const b of D.voice.scenes[i].words) {
    const parts = b.w.split(/\s+/);
    parts.forEach((p, k) => out.push({ w: norm(p), t: b.t + (b.d * k) / parts.length, e: b.t + (b.d * (k + 1)) / parts.length }));
  }
  return out;
}
/** When a phrase is said, in seconds from the scene's start. */
function cue(i, phrase, nth = 0) {
  const tk = spokenTokens(i), want = phrase.split(/\s+/).map(norm).filter(Boolean);
  for (let a = 0; a + want.length <= tk.length; a++) if (want.every((w, k) => tk[a + k].w === w) && nth-- === 0) return SC[i].lead + tk[a].t;
  throw new Error(`scene ${i + 1}: the words "${phrase}" are not in the narration`);
}
const voiceEnd = i => { const w = D.voice.scenes[i].words; return w[w.length - 1].t + w[w.length - 1].d; };
function captionsFor(i) {
  const v = D.voice.scenes[i], tk = spokenTokens(i), shown = v.shown.split(' ');
  const toks = [];
  let si = 0;
  for (const w of shown) {
    const as = D.voice.spokenAs[w.replace(/[^A-Za-z0-9]/g, '')];
    const n = as ? as.split(' ').length : 1;
    toks.push({ w, t: tk[si].t, e: tk[si + n - 1].e });
    si += n;
  }
  const MAX = 62, chunks = [];
  let cur = [];
  const flush = () => { if (cur.length) chunks.push({ text: cur.map(x => x.w).join(' '), t: cur[0].t, e: cur[cur.length - 1].e }); cur = []; };
  toks.forEach((tok, k) => {
    cur.push(tok);
    const len = cur.map(x => x.w).join(' ').length, next = toks[k + 1];
    if (!next || /[.?!]["”]?$/.test(tok.w)) return flush();
    // Words left in the sentence after this one: don't strand one or two on their own line.
    let rest = 0, restLen = 0;
    for (let j = k + 1; j < toks.length; j++) { rest++; restLen += toks[j].w.length + 1; if (/[.?!]["”]?$/.test(toks[j].w)) break; }
    if (/[,:;]$/.test(tok.w) && len >= 26 && len + restLen > MAX) return flush();
    if (len + 1 + next.w.length > MAX && !(rest <= 2 && len + restLen <= MAX + 12)) flush();
  });
  return chunks.map((c, k) => {
    const next = chunks[k + 1];
    return { text: c.text, a: SC[i].start + SC[i].lead + c.t - 0.06, b: SC[i].start + SC[i].lead + (next && next.t - c.e < 0.75 ? next.t - 0.06 : c.e + 0.4) };
  });
}

// ---- Scenes ---------------------------------------------------------------------------------------------------------
// Each: { id, lead (silence before the voice), tail (after it), min (seconds, optional), build(root, i) -> draw(t) }
const firstListing = take => {
  const it = M(take, take === 'off' ? 'listing' : 'badged').item;
  const y0 = it.y0 != null ? it.y0 : it.card.y - 55;   // the grid is scrolled so its heading sits at the top
  return { x: it.card.x, y: it.card.y - y0, w: it.card.w, h: it.card.h, title: { ...it.title, y: it.title.y - y0 }, photo: { ...it.photo, y: it.photo.y - y0 } };
};

const scenes = [
  // 1. The hidden danger: the listing without a badge, then with it.
  { id: 'danger', lead: 0.4, tail: 0.35, build(root, i) {
    const a = new Shot(root, 'off'), b = new Shot(root, 'flow');
    const L = firstListing('off'), B = firstListing('flow');
    const tCut = cue(i, 'Still Recalled does') - 0.1, tWarn = cue(i, "The listing doesn't"), tFact = cue(i, 'But this type') + 0.2;
    const keys = [[0, 640, 360, 1], [0.35, 640, 360, 1], [3.2, ...aim(L, 1.86, { left: 110, top: 44 })], [SC[i].dur, ...aim(L, 2.0, { left: 110, top: 44 })]];
    const segsA = [[0, tWarn - 1.0, 0.3, 0.3 + (tWarn - 1.0)], [tWarn - 1.0, tCut, M('off', 'title').t - 1.05, null]];
    const note = el(`<div class="note" style="left:1010px;top:300px;width:790px"><p class="big">About 100 infant deaths were reported in one recalled sleeper.</p><p class="src">CPSC, 2023 · Fisher-Price Rock ’n Play</p></div>`);
    const badge = M('flow', 'at badge').box, r = ring(root, 'is-red');
    root.append(note);
    return t => {
      const cam = camAt(keys, t), cut = t >= tCut;
      a.el.style.visibility = cut ? 'hidden' : 'visible';
      b.el.style.visibility = cut ? 'visible' : 'hidden';
      // A small push in as the badge appears, so the eye lands on it.
      if (cut) b.show(M('flow', 'badged').t + 0.6 + (t - tCut), { ...cam, cy: cam.cy + (B.y - L.y), z: cam.z * (1 + 0.08 * outCubic((t - tCut) / 0.7)) });
      else a.show(remap(segsA, t), cam);
      vis(note, t, tFact, tCut - 0.15);
      placeRing(r, b, badge, 7);
      const k = clamp((t - tCut) / 0.5);
      r.style.opacity = cut ? (0.9 * (1 - clamp((t - tCut - 1.3) / 0.5))).toFixed(3) : '0';
      r.style.transform = `scale(${(1.25 - 0.25 * outCubic(k)).toFixed(4)})`;
    };
  } },

  // 2. It works, and where it runs.
  { id: 'works', lead: 0.45, tail: 0.4, build(root, i) {
    const s = new Shot(root, 'flow');
    const tDev = cue(i, 'on your computer'), tCloud = cue(i, 'Only flagged'), tAll = cue(i, 'Of these seventeen'), tBadge = cue(i, 'the eight'), end = SC[i].dur;
    const st = M('flow', 'status'), g = M('flow', 'grid'), done = M('flow', 'engine done'), sw = M('flow', 'sweep'), swe = M('flow', 'sweep end'), tour = M('flow', 'tour'), tb = M('flow', 'tour bottom');
    const pd = has('flow', 'pill device') ? M('flow', 'pill device') : null, pc = has('flow', 'pill cloud') ? M('flow', 'pill cloud') : null;
    const p1 = pd || pc, p2 = pc || pd;
    // A pill is shown only while it is on the page: the picture holds on its last moment if the words run longer.
    const gone = (name, m) => (has('flow', `pill ${name} gone`) ? M('flow', `pill ${name} gone`).t - 0.12 : m.t + 2.5);
    const g1 = gone(pd ? 'device' : 'cloud', p1), g2 = gone(pc ? 'cloud' : 'device', p2);
    const sweepLen = Math.min(swe.t - sw.t + 0.3, tBadge + 1.6 - tAll);
    const segs = [
      [0, tDev - 0.35, st.t - 0.9, g.t + 0.15],
      [tDev - 0.35, tCloud + 0.5, p1.t - 0.25, g1, 'hold'],
      [tCloud + 0.5, tAll - 0.25, p1 === p2 ? Math.min(g2, p2.t - 0.25 + tCloud + 0.85 - tDev) : p2.t - 0.25, g2, 'hold'],
      [tAll - 0.25, tAll - 0.25 + sweepLen, sw.t - 0.1, null],
      [tAll - 0.25 + sweepLen, end - 0.4, tour.t - 0.1, tour.t + 0.8 * (tb.t - tour.t)],
    ];
    const zoomOn = b => [b.x + b.w / 2 + 110, b.y + 150, 1.9];
    const top = aim(st.box, 1.55, { left: 150, top: 560 });
    const keys = [[0, ...top], [Math.max(0.6, tDev - 1.9), ...top], [tDev - 0.9, 640, 360, 1.15], [tDev - 0.1, ...zoomOn(p1.box)], [tCloud + 0.3, ...zoomOn(p1.box)], [tCloud + 1.0, ...zoomOn(p2.box)], [tAll - 0.7, ...zoomOn(p2.box)], [tAll, 640, 360, 1.15]];
    const r1 = ring(root), r2 = ring(root);
    const pillBox = b => ({ x: b.x - 20, y: b.y - 4, w: b.w + 30, h: b.h + 8 });
    const secs = Math.round(done.t - M('flow', 'loaded').t);
    const c1 = chip(root, '', 'is-speed'), c2 = chip(root, `Real time for this page: 17 listings checked in ${secs} seconds`);
    const legend = el(`<div class="panel" style="left:1090px;top:560px;width:760px">
      <div class="step is-first" data-k="1"><span class="where is-device">On your computer</span><p><b>Every listing is screened here first.</b> Fast and private.</p></div>
      <div class="step" data-k="2"><span class="where is-cloud">In the cloud</span><p><b>Only flagged or uncertain listings</b> get a closer look.</p></div>
    </div>`);
    root.append(legend);
    const rows = [...legend.querySelectorAll('.step')];
    return t => {
      s.show(remap(segs, t), camAt(keys, t));
      vis(legend, t, tDev - 0.3, tAll - 0.45);
      rows[0].style.opacity = '1';
      rows[1].style.opacity = (0.26 + 0.74 * outCubic((t - tCloud) / 0.4)).toFixed(3);
      placeRing(r1, s, pillBox(p1.box), 3); placeRing(r2, s, pillBox(p2.box), 3);
      r1.style.opacity = pd ? (clamp((t - tDev + 0.1) / 0.25) * (1 - clamp((t - tCloud - 0.3) / 0.2))).toFixed(3) : '0';
      r2.style.opacity = pc ? (clamp((t - tCloud - 1.0) / 0.25) * (1 - clamp((t - tAll + 0.75) / 0.2))).toFixed(3) : '0';
      const sp = speedOf(segs, t);
      c1.textContent = `Sped up ${sp.toFixed(1).replace(/\.0$/, '')}×`;
      vis(c1, t, sp > 1.2 ? 0 : 1e9, sp > 1.2 ? 1e9 : 0, { dy: 0, din: 0.01, dout: 0.01 });
      vis(c2, t, tAll - 0.1, end - 0.35, { dy: 10 });
    };
  } },

  // 3. The cloud asks the device.
  { id: 'asks', lead: 0.45, tail: 0.45, build(root, i) {
    const s = new Shot(root, 'flow');
    const L = firstListing('flow');
    const t2 = cue(i, "The laptop's word rules"), t3 = cue(i, 'Gemini in the cloud'), t4 = cue(i, 'Then through'), t5 = cue(i, 'The laptop answers'), tNum = cue(i, 'recall 2 3'), t6 = cue(i, 'And our code'), end = SC[i].dur;
    const ti = M('flow', 'title'), ab = M('flow', 'at badge'), co = M('flow', 'card open'), cardBox = M('flow', 'card').box, pa = has('flow', 'para') ? M('flow', 'para') : null, pr = has('flow', 'para read') ? M('flow', 'para read') : null;
    const segs = [
      [0, t2 - 0.2, ti.t - 1.0, ti.t + 2.4],
      [t2 - 0.2, t3 - 0.45, ab.t - 0.85, ab.t + 0.35],
      [t3 - 0.45, t5 - 0.6, co.t - 0.12, null],
      ...(pa ? [[t5 - 0.6, t6, pa.t - 0.1, pr.t + 0.4]] : []),
    ];
    const title = [L.x + L.w / 2 + 70, L.title.y - 50, 2.1];
    // With the card open: the card on the left third, room for the steps on the right.
    const cardCam = aim(cardBox, 1.5, { left: 70, top: 28 });
    const paraCam = pa ? aim({ x: cardBox.x, y: pa.box.y }, 1.8, { left: 70, top: 300 }) : cardCam;
    const keys = [[0, ...title], [t2 - 0.4, ...title], [t2 + 0.4, L.x + L.w / 2 + 210, L.y + 150, 1.75], [t3 - 0.5, L.x + L.w / 2 + 210, L.y + 150, 1.75], [t3 + 0.3, ...cardCam], [t5 - 0.7, ...cardCam], [t5 + 0.1, ...paraCam], [end, ...paraCam]];
    const look = (T('flow').notes.flagged || []).find(f => /^Inclined baby sleeper/.test(f.title)) || {};
    const lk = (look.lookups || [])[0] || { asked: { brand: 'Fisher-Price', product: "Rock 'n Play sleeper" }, found: ['23088'] };
    const asked = [lk.asked.brand, lk.asked.product].filter(Boolean).map(x => `"${x}"`).join(', ');
    const panel = el(`<div class="panel is-three" style="left:1040px;top:56px;width:830px">
      <p class="eyebrow">How an unnamed listing gets its recall</p>
      <div class="b3" data-k="1"><span class="no is-device">01 · On the laptop</span><h3>Risk detected</h3><p>Word rules read the title: a banned type. No brand, no model.</p></div>
      <div class="b3" data-k="2"><span class="no is-cloud">02 · In the cloud</span><h3>Product recognised</h3><p>Gemini sees the product in the photo.</p></div>
      <div class="b3" data-k="3"><span class="no is-both">03 · Cloud asks laptop</span><h3>Recall retrieved</h3><p>The laptop’s field guide of 10,089 notices answers.</p></div>
      <div class="call">
        <p class="lab">Firebase AI Logic function calling</p>
        <div class="leg"><span class="dir">Cloud → laptop</span><code>lookup_recalls(${esc(asked)})</code></div>
        <div class="leg is-ans"><span class="dir">Laptop → cloud</span><p class="ans"><b>${esc((lk.found || ['23088'])[0])}</b><span>recall retrieved from<br>the laptop’s field guide</span></p></div>
      </div>
      <p class="foot">Our code shows only recalls the guide returned.</p>
    </div>`);
    root.append(panel);
    const steps = [...panel.querySelectorAll('.b3')], at = [t2, t3, t4];
    const call = panel.querySelector('.call'), ans = panel.querySelector('.leg.is-ans'), foot = panel.querySelector('.foot');
    const rT = ring(root), rP = ring(root, 'is-red');
    return t => {
      s.show(remap(segs, t), camAt(keys, t));
      vis(panel, t, t2 - 0.25);
      steps.forEach((st, k) => {
        const on = outCubic((t - at[k]) / 0.4), next = at[k + 1] != null ? clamp((t - at[k + 1]) / 0.4) : 0;
        st.style.opacity = (t < at[k] - 0.01 ? 0.26 : 0.26 + 0.74 * on - 0.22 * next).toFixed(3);
      });
      call.style.opacity = (0.26 + 0.74 * outCubic((t - t4) / 0.4)).toFixed(3);
      // The answer leg waits, dim, until the laptop answers; the number arrives as it is spoken.
      ans.style.opacity = (0.3 * outCubic((t - t4) / 0.4) + 0.7 * outCubic((t - tNum + 0.15) / 0.4)).toFixed(3);
      ans.querySelector('.ans').style.opacity = outCubic((t - tNum + 0.15) / 0.4).toFixed(3);
      foot.style.opacity = (0.26 + 0.74 * outCubic((t - t6) / 0.4)).toFixed(3);
      placeRing(rT, s, L.title, 6);
      rT.style.opacity = (clamp((t - 0.5) / 0.3) * (1 - clamp((t - t2 + 0.5) / 0.25))).toFixed(3);
      if (pa) { placeRing(rP, s, pa.box, 7); rP.style.opacity = (clamp((t - tNum + 0.2) / 0.3)).toFixed(3); } else rP.style.opacity = '0';
    };
  } },

  // 4. From a warning to something you can do.
  { id: 'do', lead: 0.4, tail: 3.6, build(root, i) {
    const a = new Shot(root, 'flow'), b = new Shot(root, 'label');
    const t2 = cue(i, "And when a photo"), tAdd = cue(i, 'add the label'), t3 = cue(i, 'Gemini reads'), tMatch = cue(i, 'and it matches'), end = SC[i].dur;
    const ask = M('flow', 'ask'), rep = has('flow', 'report') ? M('flow', 'report') : ask, cardBox = M('flow', 'card').box;
    const ib = M('label', 'item badge'), co = M('label', 'card open'), ls = M('label', 'label section'), la = M('label', 'label added'), lr = M('label', 'label read'), res = M('label', 'label result'), lc = M('label', 'card').box;
    const tCut = t2 - 0.3;
    const segsA = [[0, tCut, ask.t - 1.0, rep.t + 1.6]];
    const waited = lr.t - la.t, room = tMatch - 0.5 - (t3 - 0.2);
    const segsB = [
      [tCut, tCut + 1.5, ib.t - 0.25, ib.t + 1.25],
      [tCut + 1.5, tAdd - 0.5, co.t - 0.5, co.t + 1.6],
      [tAdd - 0.5, t3 - 0.2, la.t - 1.5, la.t + 0.3],
      [t3 - 0.2, tMatch - 0.5, la.t + 0.3, Math.max(la.t + 0.3, lr.t - 0.4)],
      [tMatch - 0.5, end, lr.t - 0.4, res.t + 3.6, 'hold'],
    ];
    const stroller = (T('flow').notes.flagged || []).find(f => /Tango Mini/.test(f.title)) || {};
    const model = (/Model (\S+) is one/.exec(res.text || '') || [])[1] || '';
    const proof = el(`<div class="panel is-facts" style="left:60px;top:236px;width:880px">
      <p class="eyebrow">The label check</p>
      <div class="fact"><span>Read from the label</span><b>${esc(model ? `Model ${model}` : 'The model number')}</b></div>
      <div class="fact"><span>CPSC recall ${esc(stroller.recall || '20052')} · four model numbers</span><b>${esc(model || 'This model')} is one of them</b></div>
      <div class="fact is-result"><span>Compared in code</span><b>The label matches the recall</b></div>
      <div class="fact is-advice"><span>What the card says</span><b>Don’t buy it unless the fix was done</b></div>
    </div>`);
    root.append(proof);
    const facts = [...proof.querySelectorAll('.fact')];
    const camA = [[0, ...aim({ x: cardBox.x, y: ask.box.y - 250 }, 1.6, { left: 70, top: 0 })]];
    const box = res.whole || res.box || ls.button;
    const camB = [[tCut, 640, 330, 1.15], [tCut + 1.2, 640, 330, 1.15], [tCut + 2.2, lc.x + lc.w / 2 + 150, lc.y + 250, 1.45], [tAdd - 0.8, lc.x + lc.w / 2 + 150, lc.y + 250, 1.45], [tAdd, ls.button.x + ls.button.w / 2 + 100, ls.button.y - 60, 1.8], [tMatch - 0.9, ls.button.x + ls.button.w / 2 + 100, ls.button.y - 60, 1.8], [tMatch - 0.2, ...aim({ x: lc.x, y: box.y - 150 }, 1.75, { left: 960, top: 60 })]];
    const rA = ring(root), rB = ring(root), rR = ring(root, 'is-red');
    const sp = waited > room * 1.2 ? `Sped up ${(waited / room).toFixed(1).replace(/\.0$/, '')}×` : '';
    const c = chip(root, sp, 'is-speed');
    const c2 = chip(root, `Real time: the label was read in ${Math.max(1, Math.round(waited))} seconds`);
    c2.style.right = 'auto'; c2.style.left = '80px'; c2.style.top = '170px';
    return t => {
      const cut = t >= tCut;
      a.el.style.visibility = cut ? 'hidden' : 'visible'; b.el.style.visibility = cut ? 'visible' : 'hidden';
      if (cut) b.show(remap(segsB, t), camAt(camB, t)); else a.show(remap(segsA, t), camAt(camA, t));
      const tReport = cue(i, 'or report');
      placeRing(rA, a, ask.box, 5); placeRing(rB, a, rep.box, 5);
      // The card scrolls between the two buttons, so each outline shows only while its button is where it was marked.
      const src = remap(segsA, t);
      rA.style.opacity = cut ? '0' : (clamp((src - ask.t + 0.3) / 0.25) * (1 - clamp((src - ask.t - 1.7) / 0.15))).toFixed(3);
      rB.style.opacity = cut || rep === ask ? '0' : clamp((src - rep.t + 0.3) / 0.25).toFixed(3);
      placeRing(rR, b, box, 6);
      rR.style.opacity = cut ? clamp((t - tMatch) / 0.3).toFixed(3) : '0';
      vis(c, t, sp && t >= t3 - 0.2 && t < tMatch - 0.5 ? 0 : 1e9, 1e9, { dy: 0, din: 0.01 });
      vis(c2, t, tMatch - 0.3, end - 0.3, { dy: 10 });
      vis(proof, t, tMatch + 0.45, 1e9);
      // The facts arrive one after another, so the eye reads them in order: the label, the notice, the match, the advice.
      facts.forEach((f, k) => { f.style.opacity = outCubic((t - tMatch - 0.55 - 0.32 * k) / 0.4).toFixed(3); });
    };
  } },

  // 5. Native Android, with Gemini Nano: the clip from the Pixel, at its real speed.
  { id: 'android', lead: 0.7, tail: 0.3, min: 14.6, build(root, i) {
    const P = T('pixel'), ph = 968, pw = Math.round(ph * P.width / P.height);
    const frame = el(`<div class="phone" style="left:176px;top:44px;width:${pw + 28}px;height:${ph + 28}px"></div>`);
    root.append(frame);
    const phone = new Shot(root, 'pixel', { x: 190, y: 58, w: pw, h: ph, radius: 30 });
    const zoom = new Shot(root, 'pixel', { x: 800, y: 330, w: 960, h: 420, radius: 18 });
    const share = M('pixel', 'share').t, result = M('pixel', 'result').t, how = M('pixel', 'how').t;
    const t0 = 1.5, tRes = result - t0, tHow = Math.max(tRes + 2.3, SC[i].dur - 2.7);
    const segs = [[0, tHow, t0, null], [tHow, SC[i].dur, how, null]];
    const head = el(`<div class="side" style="left:800px;top:120px;width:960px"><p class="eyebrow">Android app · recorded on a Pixel, real speed</p><h2>Gemini Nano looks at it on the phone</h2></div>`);
    const foot = el(`<div class="side" style="left:800px;top:786px;width:960px"><p class="line"></p></div>`);
    root.append(head, foot);
    const line = foot.firstChild;
    // What the enlarged window shows of the phone's screen: the steps, then the result, then how it was checked.
    const win = { home: [336, 985, 1.0], steps: [336, 540, 1.0], res: [336, 470, 1.0], how: [336, 1100, 1.0] };
    // The phone's own Gemini Nano lines, outlined in the enlarged window: "ready on this phone", then "Looked at on this phone".
    const rReady = ring(root, 'is-light'), rHow = ring(root, 'is-light');
    return t => {
      const src = remap(segs, t);
      phone.show(src);
      const w = t >= tHow ? win.how : t >= tRes ? win.res : t >= share - t0 ? win.steps : win.home;
      zoom.show(src, { cx: w[0], cy: w[1], z: w[2] });
      placeRing(rReady, zoom, { x: 44, y: 912, w: 462, h: 46 }, 4);
      rReady.style.opacity = t < share - t0 ? clamp((t - 0.3) / 0.3).toFixed(3) : '0';
      placeRing(rHow, zoom, { x: 31, y: 1003, w: 434, h: 44 }, 4);
      rHow.style.opacity = t >= tHow ? clamp((t - tHow - 0.2) / 0.3).toFixed(3) : '0';
      line.textContent = t >= tHow ? 'How it was checked: looked at on this phone, by Gemini Nano.' : t >= tRes ? 'The phone’s own recall guide names it: recall 23088.' : t >= share - t0 ? 'A listing shared from another app. The phone is checking it.' : 'Gemini Nano is ready on this phone.';
    };
  } },

  // 6. One call, either model: the web page in two browsers, each pane showing the page's own line.
  { id: 'fallback', lead: 0.45, tail: 4.6, build(root, i) {
    const tCall = cue(i, 'It is one'), tDev = cue(i, 'This browser reads'), tCloud = cue(i, 'This one has'), tRuns = cue(i, 'so the same call'), end = SC[i].dur;
    // After the words: both panes go on to their result, the same one.
    const tRes = SC[i].lead + voiceEnd(i) + 0.25;
    root.classList.add('is-dark');
    const PW = 560, PH = 668, PY = 112;
    const mk = (name, x, label, tShow, tRead) => {
      const tag = el(`<div class="pane-tag" style="left:${x}px;top:${PY - 70}px;width:${PW}px">${label}</div>`);
      root.append(tag);
      if (!has(name, 'read')) { root.append(el(`<div class="pane-missing" style="left:${x}px;top:${PY}px;width:${PW}px;height:${PH}px">This side is recorded with Gemini Nano running</div>`)); return t => { vis(tag, t, tShow, 1e9, { dy: 0 }); }; }
      const s = new Shot(root, name, { x, y: PY, w: PW, h: PH, radius: 26 });
      const c = M(name, 'click'), r = M(name, 'read'), res = M(name, 'result'), tk = T(name);
      const shown = has(name, 'result shown') ? M(name, 'result shown') : { t: res.t + 1.2, cy: 258 };
      const real = r.realSeconds || Math.round(r.t - c.t), realRes = res.realSeconds || Math.round(res.t - c.t);
      // The page's own line, in the page's own words, large: where this read ran. It stays up beside the result.
      const where = (/Read (on this device|in the cloud)/.exec(r.text) || [r.text.split(':')[0].trim()])[0];
      const ran = el(`<div class="pane-ran ${/device/.test(where) ? 'is-device' : 'is-cloud'}" style="left:${x}px;top:${PY + PH + 20}px">${esc(where)}</div>`);
      const took = el(`<div class="pane-took" style="left:${x}px;top:${PY + PH + 104}px;width:${PW}px">The page’s own line · <b>${real} s</b> in real time</div>`);
      const took2 = el(`<div class="pane-took" style="left:${x}px;top:${PY + PH + 104}px;width:${PW}px"><b>Recalled product found</b> · ${realRes} s</div>`);
      const rg = ring(root, 'is-light');
      root.append(ran, took, took2);
      // The waits are shortened to fit the words; the real seconds are printed under each pane.
      const segs = [[0, tCall, c.t - Math.min(1.4, tCall), null], [tCall, tRead - 0.45, c.t + 0.3, r.t - 0.45], [tRead - 0.45, tRes, r.t - 0.45, r.t + 2.2, 'hold'], [tRes, end, shown.t, shown.t + 0.1, 'hold']];
      const cam = { cx: tk.width / 2, cy: r.box.y + 120, z: 1 }, camRes = { cx: tk.width / 2, cy: shown.cy || 258, z: 1 };
      return t => {
        s.show(remap(segs, t), t >= tRes ? camRes : cam);
        s.el.style.opacity = (clamp((t - tShow + 0.1) / 0.35) * (t >= tRes ? 0.35 + 0.65 * clamp((t - tRes) / 0.3) : 1)).toFixed(3);
        vis(tag, t, tShow, 1e9, { dy: 0 });
        placeRing(rg, s, r.box, 5);
        rg.style.opacity = t >= tRes ? '0' : (clamp((t - tRead + 0.1) / 0.3)).toFixed(3);
        vis(ran, t, tRead + 0.1, 1e9, { dy: 10 });
        vis(took, t, tRead + 0.3, tRes - 0.2, { dy: 10 });
        vis(took2, t, tRes + 0.25, 1e9, { dy: 10 });
      };
    };
    const head = el(`<div class="fb-head"><p class="eyebrow">Still Recalled on the web · the same page, the same photo</p><h2>One Firebase AI Logic call</h2><code>mode: PREFER_ON_DEVICE</code><p class="sub">The page prints the source Firebase AI Logic reports back.</p><p class="same">Same code.<br>Same photo.<br>Same answer.</p></div>`);
    root.append(head);
    const same = head.querySelector('.same');
    const A = mk('page-device', 660, 'Chrome with Gemini Nano', 0, tDev), B = mk(has('page-cloud', 'read') ? 'page-cloud' : 'cloud-earlier', 1270, 'Chrome with no built-in model', tCloud - 0.3, tRuns);
    return t => { A(t); B(t); vis(head, t, 0.1, 1e9, { dy: 0 }); vis(same, t, tRes + 0.6, 1e9, { dy: 12 }); };
  } },

  // 7. The need, and the proof.
  { id: 'proof', lead: 0.45, tail: 3.4, build(root, i) {
    const tReal = cue(i, 'On a real'), tBut = cue(i, 'but baby rocker'), t842 = cue(i, 'In one day'), tCard = cue(i, 'And across') - 0.35, t775 = cue(i, '775'), tCut = cue(i, 'the hybrid cut'), t89 = cue(i, '89 percent'), tCaught = cue(i, 'caught more'), t77 = cue(i, '77 percent'), tRepo = cue(i, 'Every result'), end = SC[i].dur;
    let market = null;
    if (has('market', 'results')) {
      const s = new Shot(root, 'market');
      const bl = M('market', 'blank'), rs = M('market', 'results'), en = M('market', 'end');
      const bd = has('market', 'badges') ? M('market', 'badges') : null;
      const segs = [[0, tBut - 0.15, bl.t + 0.2, bl.t + 3.6, 'hold'], bd ? [tBut - 0.15, tCard + 0.4, bd.t + 0.1, en.t - 0.2, 'hold'] : [tBut - 0.15, tCard + 0.4, rs.t + 0.2, Math.min(en.t - 0.2, rs.t + 0.2 + (tCard + 0.4 - tBut + 0.15) * 1.0)]];
      const rings = bd ? bd.boxes.map(() => ring(root, 'is-amber')) : [];
      const bcam = bd ? (() => { const [cx, cy, z] = aim(bd.boxes[0], 1.25, { left: 330, top: 230 }); return { cx, cy, z }; })() : null;
      const q1 = chip(root, `Marketplace search: <b>${esc(bl.query || 'rock n play')}</b>`, 'is-search'), q2 = chip(root, `Marketplace search: <b>${esc(rs.query || 'baby rocker sleeper')}</b>`, 'is-search');
      // The site's own drawing and button on its "no listings" page are covered: the picture keeps the site's words only.
      const covers = [{ x: 730, y: 205, w: 180, h: 142 }, { x: 715, y: 472, w: 210, h: 66 }].map(box => { const m = el('<div class="cover"></div>'); root.insertBefore(m, q1); return { m, box }; });
      const mcam = { cx: 820, cy: 400, z: 1.7 };
      market = t => {
        const blank = t < tBut - 0.15;
        s.show(remap(segs, t), bd && !blank ? bcam : mcam);
        covers.forEach(({ m, box }) => { placeRing(m, s, box, 0); m.style.visibility = blank ? 'visible' : 'hidden'; });
        vis(q1, t, 0.15, tBut - 0.2, { dy: 0 }); vis(q2, t, tBut - 0.1, tCard, { dy: 0 });
        rings.forEach((r, k) => { placeRing(r, s, bd.boxes[k], 5); r.style.opacity = (t >= tBut - 0.15 ? clamp((t - tBut - 0.2 - 0.25 * k) / 0.3) * (1 - clamp((t - t842 + 0.3) / 0.2)) : 0).toFixed(3); });
      };
    } else root.append(el('<div class="missing">Scene 7 footage: the marketplace take</div>'));
    const veil = el('<div class="veil"></div>');
    const big = el(`<div class="bignum"><p class="n">842</p><p class="l">listings identified as banned or prohibited products</p><p class="l2">Three marketplaces. One day.</p><p class="s">Identified by AI reviewers from each listing’s title and photo. Method: docs/accuracy.md</p></div>`);
    const bars = (title, rows, max) => `<div class="chart"><h3>${title}</h3>${rows.map(([lab, v, hy]) => `<div class="row"><span class="lab">${lab}</span><span class="track"><span class="bar${hy ? ' is-h' : ''}" data-w="${(v / max) * 100}"></span><span class="val">${v}</span></span></div>`).join('')}</div>`;
    const card = el(`<div class="proofcard">
      <p class="eyebrow">Why hybrid works better</p>
      <div class="tiles">
        <div class="tile" data-k="a"><p class="n">775</p><p class="l">real listings tested</p></div>
        <div class="tile" data-k="b"><p class="n">89%</p><p class="l">fewer false alarms than word rules</p></div>
        <div class="tile" data-k="c"><p class="n">77%</p><p class="l">never left the computer</p></div>
      </div>
      <div class="charts">
        ${bars('<b>False alarms · lower is better</b><br>among 630 listings that were fine', [['Word rules', 109], ['Built-in model only', 64], ['Hybrid', 12, 1]], 109 / 0.82)}
        ${bars('<b>Caught · higher is better</b><br>of 83 listings that should be flagged', [['Word rules', 47], ['Built-in model only', 51], ['Hybrid', 65, 1]], 83 / 0.82)}
      </div>
      <p class="fine"><b>Five blind tests on real listings. Answer keys by AI reviewers.</b><br>Scored on the 713 listings they settled. Method and every result: <b>docs/accuracy.md</b></p>
    </div>`);
    root.append(veil, big, card);
    const tile = k => card.querySelector(`.tile[data-k="${k}"]`), charts = [...card.querySelectorAll('.chart')];
    const grow = (chart, t, t0) => { vis(chart, t, t0, 1e9, { dy: 10 }); chart.querySelectorAll('.row').forEach((r, k) => { const g = outCubic((t - t0 - 0.12 * k) / 0.7); r.querySelector('.bar').style.width = `${(+r.querySelector('.bar').dataset.w * g).toFixed(2)}%`; r.querySelector('.val').style.opacity = clamp((t - t0 - 0.12 * k - 0.25) / 0.3).toFixed(3); }); };
    return t => {
      if (market) market(t);
      veil.style.opacity = (0.95 * clamp((t - t842 + 0.25) / 0.4) + 0.05 * clamp((t - tCard) / 0.3)).toFixed(3);
      vis(big, t, t842 - 0.05, tCard - 0.05);
      vis(card, t, tCard + 0.15, 1e9, { dy: 0 });
      vis(tile('a'), t, t775 - 0.15); vis(tile('b'), t, t89 - 0.15); vis(tile('c'), t, t77 - 0.15);
      grow(charts[0], t, tCut - 0.1); grow(charts[1], t, tCaught - 0.1);
      vis(card.querySelector('.fine'), t, tRepo - 0.3, 1e9, { dy: 8 });
    };
  } },

  // 8. Why it keeps up, and scales.
  { id: 'scales', lead: 0.45, tail: 0.5, build(root, i) {
    const s = new Shot(root, 'bouncer');
    const t2 = cue(i, "This bouncer's recall"), t3 = cue(i, 'The extension fetched'), tGem = cue(i, 'Gemini wrote'), tFs = cue(i, 'and Firestore'), t4 = cue(i, 'App Check'), t5 = cue(i, 'And it keeps'), end = SC[i].dur;
    const row = M('bouncer', 'row'), bb = has('bouncer', 'bouncer badge') ? M('bouncer', 'bouncer badge') : null, ib = M('bouncer', 'item badge'), co = M('bouncer', 'card open'), cardBox = M('bouncer', 'card').box;
    const dt = has('bouncer', 'date') ? M('bouncer', 'date') : null, wt = has('bouncer', 'watch') ? M('bouncer', 'watch') : null, wd = has('bouncer', 'watching') ? M('bouncer', 'watching') : null;
    const it = row.item, y0 = it.y0;
    const segs = [
      [0, t2 - 0.2, (bb ? bb.t : row.t) - 1.0, null],
      [t2 - 0.2, t2 + 1.3, ib.t - 0.2, ib.t + 1.3],
      [t2 + 1.3, t3 - 0.3, co.t - 0.4, null],
      ...(dt ? [[t3 - 0.3, t5 - 0.9, dt.t - 0.6, dt.t + 2.4]] : []),
      ...(wt ? [[t5 - 0.9, end, wt.t - 0.9, null]] : []),
    ];
    const gridCam = [it.card.x + it.card.w / 2 + 40, it.card.y - y0 + it.card.h / 2 - 10, 1.9];
    const cardCam = aim(cardBox, 1.5, { left: 990, top: 28 });
    const dateCam = dt ? aim({ x: cardBox.x, y: dt.box.y - 96 }, 1.7, { left: 990, top: 60 }) : cardCam;
    const watchCam = wt ? aim({ x: cardBox.x, y: wt.box.y - 190 }, 1.7, { left: 990, top: 60 }) : cardCam;
    const keys = [[0, ...gridCam], [t2 - 0.3, ...gridCam], [t2, 640, 330, 1.15], [t2 + 1.2, 640, 330, 1.15], [t2 + 2.0, ...cardCam], [t3 - 1.6, ...cardCam], [t3 - 0.9, ...dateCam], [t5 - 1.0, ...dateCam], [t5 - 0.3, ...watchCam]];
    const fresh = T('flow').notes.caught || {};
    const panel = el(`<div class="panel" style="left:70px;top:70px;width:860px">
      <p class="eyebrow">How a new recall reaches every device</p>
      <div class="step" data-k="1"><span class="where is-code">CPSC</span><p>publishes <b>recall 27092</b> on November 19, 2026, after this version’s list was built.</p></div>
      <div class="step" data-k="2"><span class="where is-device">Extension</span><p>fetches the new notice from CPSC.</p></div>
      <div class="step" data-k="3"><span class="where is-cloud">In the cloud</span><p><b>Gemini</b> writes its field-guide entry, once.</p></div>
      <div class="step" data-k="4"><span class="where is-both">Firestore</span><p>shares that entry with <b>Chrome · Android · Web</b>.</p></div>
      <div class="step" data-k="5"><span class="where is-code">App Check</span><p>guards Firebase AI Logic and Firestore.</p></div>
      ${fresh.shared != null ? `<div class="reuse"><div><b>${fresh.shared}</b><span>entries read from the shared guide</span></div><div><b>${fresh.written}</b><span>written again</span></div><p>This recording’s own install: ${fresh.added} new recalls fetched.</p></div>` : ''}
    </div>`);
    root.append(panel);
    const steps = [...panel.querySelectorAll('.step')], at = [t2, t3, tGem, tFs, t4];
    const reuse = panel.querySelector('.reuse');
    const rD = ring(root, 'is-amber'), rW = ring(root);
    return t => {
      s.show(remap(segs, t), camAt(keys, t));
      vis(panel, t, t2 + 1.9, t5 - 0.5);
      if (reuse) reuse.style.opacity = (0.2 + 0.8 * outCubic((t - tFs - 0.3) / 0.4)).toFixed(3);
      steps.forEach((st, k) => {
        const on = outCubic((t - at[k]) / 0.4), next = at[k + 1] != null ? clamp((t - at[k + 1]) / 0.4) : 0;
        st.style.opacity = (t < at[k] - 0.01 ? 0.26 : 0.26 + 0.74 * on - 0.3 * next).toFixed(3);
        st.classList.toggle('is-on', t >= at[k] && (at[k + 1] == null || t < at[k + 1]));
      });
      if (dt) { placeRing(rD, s, dt.box, 6); rD.style.opacity = (clamp((t - t3 + 0.7) / 0.3) * (1 - clamp((t - t5 + 1.0) / 0.2))).toFixed(3); } else rD.style.opacity = '0';
      // The button grows when it turns into "Watching for recalls": the outline follows it.
      if (wt) { placeRing(rW, s, wd && remap(segs, t) >= wd.t ? (wd.box || { ...wt.box, w: wt.box.w * 1.11 }) : wt.box, 5); rW.style.opacity = clamp((t - t5 - 0.1) / 0.3).toFixed(3); } else rW.style.opacity = '0';
    };
  } },

  // 9. The close.
  { id: 'close', lead: 0.5, tail: 3.3, build(root, i) {
    const s = new Shot(root, 'flow'), B = firstListing('flow');
    const tLast = cue(i, 'Still Recalled puts'), end = SC[i].dur;
    const keys = [[0, ...aim(B, 1.7, { left: 110, top: 44 })], [tLast, ...aim(B, 2.0, { left: 110, top: 44 })]];
    const card = el(`<div class="closing"><div class="brand"><svg viewBox="0 0 24 24" width="112" height="112" aria-hidden="true"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h6.1a2.5 2.5 0 0 1 1.77.73l7.4 7.4a2.5 2.5 0 0 1 0 3.54l-6.1 6.1a2.5 2.5 0 0 1-3.54 0l-7.4-7.4A2.5 2.5 0 0 1 3 11.6Z" fill="#c4242a"/><circle cx="7.6" cy="7.6" r="1.6" fill="#f8f8f8"/><path d="M11.2 12.8h5.2" stroke="#f8f8f8" stroke-width="1.8" stroke-linecap="round"/></svg><span>Still Recalled</span></div>
      <p class="tag">The warning belongs on the listing.</p>
      <p class="where3">Chrome extension · Android app · Web</p>
      <p class="url"><b>still-recalled.web.app</b> · free and open source</p></div>`);
    root.append(card);
    return t => {
      s.show(M('flow', 'badged').t + 0.6 + Math.min(t, 3), camAt(keys, t));
      const k = clamp((t - tLast + 0.2) / 0.5);
      card.style.opacity = ease(k).toFixed(3);
      card.style.visibility = k <= 0 ? 'hidden' : 'visible';
      for (const [n, p] of [...card.children].entries()) vis(p, t, tLast + 0.15 + n * 0.22, 1e9, { dy: 14 });
    };
  } },
];

// ---- Setup and render ---------------------------------------------------------------------------------------------
let CAPS = [];
window.setup = data => {
  D = data;
  const stage = document.getElementById('stage');
  let clock = 0;
  scenes.forEach((sc, i) => {
    const dur = Math.max(sc.min || 0, sc.lead + voiceEnd(i) + sc.tail);
    SC.push({ id: sc.id, start: clock, dur, lead: sc.lead });
    clock += dur;
  });
  // Whole frames, so a scene never ends between two frames.
  let acc = 0;
  for (const s of SC) { s.start = acc; s.dur = Math.round(s.dur * D.fps) / D.fps; acc += s.dur; }
  scenes.forEach((sc, i) => {
    const root = el(`<section class="scene" data-id="${sc.id}"></section>`);
    stage.append(root);
    SC[i].root = root;
    SC[i].draw = sc.build(root, i);
    root.style.visibility = 'hidden';
  });
  CAPS = SC.flatMap((_, i) => captionsFor(i));
  return { duration: acc, scenes: SC.map(s => ({ id: s.id, start: s.start, dur: s.dur, lead: s.lead })), captions: CAPS };
};
window.render = async t => {
  const i = Math.max(0, SC.findIndex(s => t < s.start + s.dur - 1e-6));
  const cur = SC[i === -1 ? SC.length - 1 : i];
  for (const s of SC) s.root.style.visibility = s === cur ? 'visible' : 'hidden';
  cur.draw(t - cur.start);
  const c = CAPS.find(x => t >= x.a && t < x.b), cap = document.getElementById('cap');
  cap.style.visibility = c ? 'visible' : 'hidden';
  if (c && cap.firstChild.textContent !== c.text) cap.firstChild.textContent = c.text;
  await Promise.all(pending.splice(0));
  await document.fonts.ready;
  return cur.id;
};
