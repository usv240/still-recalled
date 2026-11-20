// The detail of one flagged listing. Used in the side panel (full) and in the popover on the listing (compact).
// Its signature is the photo pair: the seller's photo beside the photo from the government recall notice.
import { h, copyWithFeedback, safeUrl } from './dom.js';
import { icon } from './icons.js';
import { CPSC_REPORT_URL, isPractice, ownerView } from '../../../shared/present.mjs';
import { judgeLabel, labelCopy } from '../../../shared/label.mjs';

const DEFAULT_CHECK = {
  recall: 'Ask for a photo of the label. The model number and manufacture date decide whether this unit is one of the recalled ones.',
  banned: 'Check the photos and the description for what the product is. A name in the title is not enough to rule it out.',
};

export function levelClass(r) {
  return r.level === 'likely' ? 'is-likely' : 'is-possible';
}

/** The status pill: the same words as the badge on the listing. */
export function statusPill(r) {
  return h('span', { class: `pill ${levelClass(r)}` }, r.badge);
}

// Search pages carry small thumbnails; the detail shows the photo large enough to compare. eBay names its sizes in
// the path (s-l140 ... s-l1600).
const larger = src => String(src || '').replace(/(\/\/i\.ebayimg\.com\/.+\/s-l)\d+(\.\w+)$/, '$1500$2');

/**
 * Put the outline where the cloud check saw the thing. The photo is shown whole (object-fit: contain) in a frame of
 * known shape, so the place is worked out from the photo's own shape, in percent: it holds at any size, and while the
 * card is still hidden and has no size to measure.
 */
function placeOutline(img, mark, where, frameShape) {
  if (!img.naturalWidth || !img.naturalHeight) return;
  const shape = img.naturalWidth / img.naturalHeight;
  const w = shape > frameShape ? 1 : shape / frameShape;      // the photo's share of the frame's width
  const h = shape > frameShape ? frameShape / shape : 1;      // and of its height
  const left = (1 - w) / 2, top = (1 - h) / 2;
  mark.style.left = `${(left + where.x * w) * 100}%`;
  mark.style.top = `${(top + where.y * h) * 100}%`;
  mark.style.width = `${where.w * w * 100}%`;
  mark.style.height = `${where.h * h * 100}%`;
  mark.classList.add('is-placed');
}

/** One photo with its caption. `where` ({ x, y, w, h }, fractions of the photo) outlines a part of it. */
function photo(src, caption, fallbackHref, { where = null, wide = false } = {}) {
  const box = h('div', { class: `ph${where ? ' has-outline' : ''}${wide ? ' is-wide' : ''}` });
  // blob: URLs are the shopper's own screenshot on the web page.
  const url = safeUrl(larger(src)) || (/^blob:/.test(String(src || '')) ? src : null);
  if (url) {
    const img = h('img', { src: url, alt: caption, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    const frame = h('div', { class: 'ph-frame' }, img);
    // Some marketplaces block outside images; fall back to a link to the source.
    img.addEventListener('error', () => {
      frame.replaceWith(h('a', { class: 'ph-missing', href: safeUrl(fallbackHref) || url, target: '_blank', rel: 'noopener' }, 'Photo on the notice'));
    }, { once: true });
    if (where) {
      const mark = h('span', { class: 'ph-outline', 'aria-hidden': 'true' });
      frame.append(mark);
      const place = () => {
        if (!img.naturalWidth) return;
        // A wide frame takes the photo's own shape, within limits, so a tall photo isn't flanked by empty bars.
        const shape = wide ? Math.min(1.6, Math.max(0.8, img.naturalWidth / img.naturalHeight)) : 1;
        if (wide) img.style.aspectRatio = String(shape);
        placeOutline(img, mark, where, shape);
      };
      img.addEventListener('load', place, { once: true });
      if (img.complete) place();
    }
    box.append(frame);
  } else {
    box.append(h('span', { class: 'ph-missing' }, 'No photo'));
  }
  box.append(h('span', { class: 'ph-cap' }, caption));
  return box;
}

/** A label photo as a JPEG data URL, at most 1280 px on its long side: small enough to pass between extension pages. */
async function labelPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * "Settle it with the label": the shopper adds a photo of the product's label; `onLabel(dataUrl, recall)` has a model
 * read it and compare it with the notice in plain code (label.mjs), and resolves to { reading, source, verdict }.
 */
function labelSection(r, onLabel, owner = false) {
  const input = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  const text = h('span', {}, 'Add a label photo');
  const button = h('button', { class: 'btn btn-secondary', type: 'button' }, icon('tag'), text);
  const out = h('div', { class: 'label-out', 'aria-live': 'polite' });
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    button.disabled = true;
    text.textContent = 'Reading the label…';
    try {
      const recall = { codes: r.recall.codes || [], more: !!r.recall.more, from: r.recall.from || 0, to: r.recall.to || 0 };
      const { reading, source, verdict } = await onLabel(await labelPhoto(file), recall);
      const copy = labelCopy(verdict || judgeLabel(reading, recall), { owner });
      const read = [reading.brand, ...(reading.model_numbers || []).slice(0, 3), reading.manufacture_date].filter(Boolean).join(' · ');
      out.replaceChildren(h('div', { class: `label-result is-${copy.tone}` },
        h('p', { class: 'label-title' }, copy.title),
        h('p', {}, copy.text),
        h('p', { class: 'hint' }, `${{ on_device: 'Read on this device; the photo did not leave it.', device_then_cloud: 'Read on this device, then read again in the cloud before ruling it out.' }[source] || 'Read in the cloud.'}${read ? ` On the label: ${read}.` : ''}`)));
      text.textContent = 'Try another photo';
    } catch {
      out.replaceChildren(h('p', { class: 'hint' }, 'The label could not be read right now. Try again in a moment.'));
      text.textContent = 'Add a label photo';
    } finally {
      button.disabled = false;
    }
  });
  return h('section', { class: 'check label-check' },
    h('h3', {}, 'Settle it with the label'),
    h('p', {}, owner ? 'Take a photo of the label on your item. Its model number and date are read and compared with the notice.'
      : 'Have a photo of the label, from the seller or of the item itself? Its model number and date are read and compared with the notice.'),
    input, button, out);
}

function howLine(r) {
  const device = r.how && r.how.device;
  const cloud = r.how && r.how.cloudModel;
  if (r.how && r.how.judgedInCloud) return cloud ? 'Looked at in the cloud, then confirmed against the full notice.' : 'Looked at in the cloud.';
  if (device && cloud) return 'Checked on this device, then confirmed in the cloud against the full notice.';
  if (device && r.how.cloudError) return 'Checked on this device. The cloud double-check could not run.';
  if (device) return 'Checked on this device.';
  if (cloud) return 'Matched by its words, then confirmed in the cloud.';
  return 'Matched by its words only.';
}

/**
 * Build the detail. `compact` drops the recall facts table (the popover links out to the panel for those).
 * `onOpenPanel` adds a "More in the side panel" action when given.
 * `onLabel(dataUrl, recall)` reads a label photo and resolves to { reading, source, verdict }; it adds "Settle it with the label".
 * `watch` ({ get(): Promise<boolean>, set(on): Promise }) adds "Watch for recalls", on a listing's own page.
 * `audience` "owner": for someone who owns the item (about to sell it or give it away): what to do with it and what
 * the recall offers, in place of the question for a seller and the report.
 */
export function detailView(r, { compact = false, onOpenPanel = null, onLabel = null, watch = null, audience = 'buyer' } = {}) {
  const root = h('div', { class: `detail ${compact ? 'is-compact' : ''}` });
  const owner = audience === 'owner' ? ownerView(r) : null;
  const mine = owner ? 'Your item' : 'This listing';

  root.append(h('div', { class: 'verdict' },
    statusPill(r),
    h('p', { class: 'verdict-line' }, owner ? owner.verdict : r.verdict),
    (owner ? owner.action : r.action) ? h('p', { class: `action-line ${levelClass(r)}` }, owner ? owner.action : r.action) : null,
    r.confirmed && r.evidence ? h('p', { class: 'evidence' }, owner ? owner.evidence : r.evidence) : null,
    r.foundBy ? h('p', { class: 'evidence found-by' }, owner ? owner.foundBy : r.foundBy) : null,
  ));

  // The cloud check's outline of what it saw in the seller's photo. Only when the photo was there to look at.
  const where = r.where && r.listing.image ? r.where : null;
  if (r.kind === 'recall' && r.recall) {
    // A CPSC warning comes without a photo: the hazard, in CPSC's words, stands beside the listing instead.
    root.append(r.recall.image
      ? h('div', { class: 'pair' },
        photo(r.listing.image, where ? `${mine}. Outlined: what the cloud check matched.` : mine, r.listing.url, { where }),
        photo(r.recall.image, 'Recall notice', r.recall.url))
      : h('div', { class: 'pair is-single' },
        photo(r.listing.image, where ? `${mine}. Outlined: what the cloud check matched.` : mine, r.listing.url, { where }),
        h('div', { class: 'risk' }, h('p', { class: 'risk-text' }, r.recall.hazard || r.recall.title))));
    // Which units the notice recalls, in one sentence written from the notice.
    if (r.recall.tell && r.recall.tell !== r.check) root.append(h('p', { class: 'tell' }, h('b', {}, 'Which units: '), r.recall.tell));
  } else if (r.kind === 'banned' && r.banned && where) {
    // The photo large, with the part that matters outlined: a bumper among the bedding is easy to miss.
    root.append(h('div', { class: 'spot' },
      photo(r.listing.image, `Outlined by the cloud check: what it saw as ${/^[aeiou]/i.test(r.banned.name) ? 'an' : 'a'} ${r.banned.name.toLowerCase()}.`, r.listing.url, { where, wide: true }),
      h('div', { class: 'risk' }, h('p', { class: 'risk-text' }, r.banned.risk)),
    ));
  } else if (r.kind === 'banned' && r.banned) {
    root.append(h('div', { class: 'pair is-single' },
      photo(r.listing.image, mine, r.listing.url),
      h('div', { class: 'risk' }, h('p', { class: 'risk-text' }, r.banned.risk)),
    ));
  }

  // Ask the seller: copy the question first (the page must still have focus to write the clipboard), then open the
  // seller's message box on eBay, or the listing elsewhere, where the message button is.
  const askUrl = safeUrl(r.messageUrl);
  const label = h('span', {}, askUrl ? 'Ask the seller' : 'Copy question for seller');
  const askBtn = h('button', { class: 'btn btn-primary', type: 'button' }, icon(askUrl ? 'message' : 'copy'), label);
  askBtn.addEventListener('click', async () => {
    await copyWithFeedback(askBtn, r.question, label);
    if (askUrl) window.open(askUrl, '_blank', 'noopener');
  });
  if (owner) root.append(h('section', { class: 'check' }, h('h3', {}, owner.heading), ...owner.lines.map(l => h('p', {}, l))));
  else root.append(h('section', { class: 'check' },
    h('h3', {}, 'Before you buy'),
    // The cloud's own line names the notice's models and label; without it, the type's advice or a plain default.
    h('p', {}, r.recall && r.recall.all ? `${r.recall.warning ? "CPSC's warning covers every unit of this product" : 'Every unit of this product is recalled'}, whatever its model number or date. Check that it is this product: the brand and the photos.`
      : r.check || (r.banned && r.banned.advice) || DEFAULT_CHECK[r.kind] || ''),
    h('blockquote', { class: 'question' }, r.question),
    askBtn,
    isPractice(r) ? h('p', { class: 'hint' }, 'Practice listing: the question is copied, but there is no seller to message.')
    : askUrl ? h('p', { class: 'hint' }, /m2mOpen/.test(askUrl)
      ? 'Copies the question and opens eBay\'s message box for this seller.'
      : 'Copies the question and opens the listing, where the seller\'s message button is.') : null,
  ));

  // Settle it with the label: the one fact a "possible recall" is missing. Not offered when the notice recalls every
  // unit (no model number would change the answer) or lists no models and no years to compare with.
  if (onLabel && r.kind === 'recall' && r.recall && !r.recall.all && ((r.recall.codes || []).length || r.recall.from)) {
    root.append(labelSection(r, onLabel, !!owner));
  }

  // The last step: a report to CPSC, which asks shoppers to report recalled products for sale online at
  // SaferProducts.gov with the listing's link. Offered only for likely flags whose sale the law rules out.
  if (r.report && !owner) {
    const repLabel = h('span', {}, 'Report to CPSC');
    const repBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, icon('flag'), repLabel);
    repBtn.addEventListener('click', async () => {
      await copyWithFeedback(repBtn, r.report, repLabel);
      // A made-up practice listing must never reach CPSC's real form.
      if (!isPractice(r)) window.open(CPSC_REPORT_URL, '_blank', 'noopener');
    });
    root.append(h('section', { class: 'report' },
      h('h3', {}, 'Report the listing'),
      h('p', {}, r.kind === 'recall'
        ? 'CPSC asks shoppers who find a recalled product for sale online to report it at SaferProducts.gov, with the listing\'s link and a screenshot. Its e-commerce team has such listings taken down.'
        : 'CPSC\'s e-commerce team looks for recalled and banned products listed for sale and has the listings taken down. You can report this one at SaferProducts.gov, with its link and a screenshot.'),
      compact ? null : h('details', { class: 'report-text' }, h('summary', {}, 'The report text'), h('pre', {}, r.report)),
      repBtn,
      h('p', { class: 'hint' }, isPractice(r) ? 'Practice listing: the report is copied so you can see it, and the CPSC form is not opened.'
        : 'Copies the report, with the listing link, and opens the CPSC form. Paste it into the description.'),
    ));
  }

  if (watch) root.append(watchSection(watch));

  if (!compact && r.kind === 'recall' && r.recall) {
    root.append(h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, r.recall.warning ? 'CPSC warning' : 'Recall'), h('dd', { class: 'num' }, r.recall.number || r.recall.id)),
      h('div', {}, h('dt', {}, r.recall.warning ? 'Warned' : 'Recalled'), h('dd', { class: 'num' }, r.recall.date)),
      h('div', {}, h('dt', {}, 'Product'), h('dd', {}, r.recall.product)),
      r.recall.hazard ? h('div', {}, h('dt', {}, 'Hazard'), h('dd', {}, r.recall.hazard)) : null,
      r.recall.remedy ? h('div', {}, h('dt', {}, r.recall.warning ? 'CPSC says' : 'Remedy'), h('dd', {}, r.recall.remedy)) : null,
    ));
  }

  const source = r.kind === 'recall' ? safeUrl(r.recall && r.recall.url) : safeUrl(r.banned && r.banned.source);
  root.append(h('div', { class: 'links' },
    source ? h('a', { class: 'link', href: source, target: '_blank', rel: 'noopener' },
      r.kind === 'recall' ? (r.recall.warning ? `Find warning ${r.recall.number} on CPSC's warnings page` : 'Read the CPSC recall notice') : 'CPSC safe sleep guidance', icon('external', { size: 14 })) : null,
    r.also && !r.also.warning && safeUrl(r.also.url) ? h('a', { class: 'link', href: safeUrl(r.also.url), target: '_blank', rel: 'noopener' }, `CPSC recall ${r.also.number}`, icon('external', { size: 14 })) : null,
    onOpenPanel ? h('button', { class: 'link', type: 'button', onclick: onOpenPanel }, 'More in the side panel', icon('panel', { size: 14 })) : null,
  ));

  root.append(h('p', { class: 'how' }, howLine(r)));
  return root;
}

/** "Watch for recalls" on a listing's own page: a recall announced after the purchase still reaches the buyer. */
function watchSection(watch) {
  const label = h('span', {}, 'Watch for recalls');
  const btn = h('button', { class: 'btn btn-secondary', type: 'button', 'aria-pressed': 'false' }, icon('bell', { size: 16 }), label);
  let on = false;
  const show = v => { on = v; btn.setAttribute('aria-pressed', String(v)); label.textContent = v ? 'Watching for recalls' : 'Watch for recalls'; };
  watch.get().then(show, () => {});
  btn.addEventListener('click', async () => { const next = !on; show(next); try { await watch.set(next); } catch { show(!next); } });
  return h('section', { class: 'watch' },
    h('h3', {}, 'Bought it, or already own one?'),
    h('p', {}, 'Recall notices reach the first owner, not the next one. Watch this listing and Still Recalled checks it against every new CPSC recall, on this computer.'),
    btn);
}
