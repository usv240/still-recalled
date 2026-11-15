// The detail of one flagged listing. Used in the side panel (full) and in the popover on the listing (compact).
// Its signature is the photo pair: the seller's photo beside the photo from the government recall notice.
import { h, copyWithFeedback, safeUrl } from './dom.js';
import { icon } from './icons.js';
import { CPSC_REPORT_URL } from '../../../shared/present.mjs';

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

function photo(src, caption, fallbackHref) {
  const box = h('div', { class: 'ph' });
  // blob: URLs are the shopper's own screenshot on the web page.
  const url = safeUrl(larger(src)) || (/^blob:/.test(String(src || '')) ? src : null);
  if (url) {
    const img = h('img', { src: url, alt: caption, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    // Some marketplaces block outside images; fall back to a link to the source.
    img.addEventListener('error', () => {
      img.replaceWith(h('a', { class: 'ph-missing', href: safeUrl(fallbackHref) || url, target: '_blank', rel: 'noopener' }, 'Photo on the notice'));
    }, { once: true });
    box.append(img);
  } else {
    box.append(h('span', { class: 'ph-missing' }, 'No photo'));
  }
  box.append(h('span', { class: 'ph-cap' }, caption));
  return box;
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
 */
export function detailView(r, { compact = false, onOpenPanel = null } = {}) {
  const root = h('div', { class: `detail ${compact ? 'is-compact' : ''}` });

  root.append(h('div', { class: 'verdict' },
    statusPill(r),
    h('p', { class: 'verdict-line' }, r.verdict),
    r.confirmed && r.evidence ? h('p', { class: 'evidence' }, r.evidence) : null,
  ));

  if (r.kind === 'recall' && r.recall) {
    root.append(h('div', { class: 'pair' },
      photo(r.listing.image, 'This listing', r.listing.url),
      photo(r.recall.image, 'Recall notice', r.recall.url),
    ));
  } else if (r.kind === 'banned' && r.banned) {
    root.append(h('div', { class: 'pair is-single' },
      photo(r.listing.image, 'This listing', r.listing.url),
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
  root.append(h('section', { class: 'check' },
    h('h3', {}, 'Before you buy'),
    // The cloud's own line names the notice's models and label; without it, the type's advice or a plain default.
    h('p', {}, r.check || (r.banned && r.banned.advice) || DEFAULT_CHECK[r.kind] || ''),
    h('blockquote', { class: 'question' }, r.question),
    askBtn,
    askUrl ? h('p', { class: 'hint' }, /m2mOpen/.test(askUrl)
      ? 'Copies the question and opens eBay\'s message box for this seller.'
      : 'Copies the question and opens the listing, where the seller\'s message button is.') : null,
  ));

  // The last step: a report to CPSC, which asks shoppers to report recalled products for sale online at
  // SaferProducts.gov with the listing's link. Offered only for likely flags whose sale the law rules out.
  if (r.report) {
    const repLabel = h('span', {}, 'Report to CPSC');
    const repBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, icon('flag'), repLabel);
    repBtn.addEventListener('click', async () => {
      await copyWithFeedback(repBtn, r.report, repLabel);
      window.open(CPSC_REPORT_URL, '_blank', 'noopener');
    });
    root.append(h('section', { class: 'report' },
      h('h3', {}, 'Report the listing'),
      h('p', {}, r.kind === 'recall'
        ? 'CPSC asks shoppers who find a recalled product for sale online to report it at SaferProducts.gov, with the listing\'s link and a screenshot. Its e-commerce team has such listings taken down.'
        : 'CPSC\'s e-commerce team looks for recalled and banned products listed for sale and has the listings taken down. You can report this one at SaferProducts.gov, with its link and a screenshot.'),
      compact ? null : h('details', { class: 'report-text' }, h('summary', {}, 'The report text'), h('pre', {}, r.report)),
      repBtn,
      h('p', { class: 'hint' }, 'Copies the report, with the listing link, and opens the CPSC form. Paste it into the description.'),
    ));
  }

  if (!compact && r.kind === 'recall' && r.recall) {
    root.append(h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, 'Recall'), h('dd', { class: 'num' }, r.recall.id)),
      h('div', {}, h('dt', {}, 'Recalled'), h('dd', { class: 'num' }, r.recall.date)),
      h('div', {}, h('dt', {}, 'Product'), h('dd', {}, r.recall.product)),
      r.recall.hazard ? h('div', {}, h('dt', {}, 'Hazard'), h('dd', {}, r.recall.hazard)) : null,
      r.recall.remedy ? h('div', {}, h('dt', {}, 'Remedy'), h('dd', {}, r.recall.remedy)) : null,
    ));
  }

  const source = r.kind === 'recall' ? safeUrl(r.recall && r.recall.url) : safeUrl(r.banned && r.banned.source);
  root.append(h('div', { class: 'links' },
    source ? h('a', { class: 'link', href: source, target: '_blank', rel: 'noopener' },
      r.kind === 'recall' ? 'Read the CPSC recall notice' : 'CPSC safe sleep guidance', icon('external', { size: 14 })) : null,
    onOpenPanel ? h('button', { class: 'link', type: 'button', onclick: onOpenPanel }, 'More in the side panel', icon('panel', { size: 14 })) : null,
  ));

  root.append(h('p', { class: 'how' }, howLine(r)));
  return root;
}
