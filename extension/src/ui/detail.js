// The detail of one flagged listing. Used in the side panel (full) and in the popover on the listing (compact).
// Its signature is the photo pair: the seller's photo beside the photo from the government recall notice.
import { h, copyWithFeedback, safeUrl } from './dom.js';
import { icon } from './icons.js';
import { CPSC_REPORT_URL, isPractice, ownerView } from '../../../shared/present.mjs';
import { judgeLabel, labelCopy } from '../../../shared/label.mjs';
import { tr, shortDateOf } from '../../../shared/i18n.mjs';

const DEFAULT_CHECK = {
  get recall() { return tr('Ask for a photo of the label. The model number and manufacture date decide whether this unit is one of the recalled ones.', 'Pida una foto de la etiqueta. El número de modelo y la fecha de fabricación deciden si esta unidad es una de las retiradas.'); },
  get banned() { return tr('Check the photos and the description for what the product is. A name in the title is not enough to rule it out.', 'Revise las fotos y la descripción para ver qué producto es. Un nombre en el título no basta para descartarlo.'); },
};

const longDay = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? shortDateOf(iso) : iso);

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
      frame.replaceWith(h('a', { class: 'ph-missing', href: safeUrl(fallbackHref) || url, target: '_blank', rel: 'noopener' }, tr('Photo on the notice', 'Foto del aviso')));
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
    box.append(h('span', { class: 'ph-missing' }, tr('No photo', 'Sin foto')));
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
  const text = h('span', {}, tr('Add a label photo', 'Agregar foto de la etiqueta'));
  const button = h('button', { class: 'btn btn-secondary', type: 'button' }, icon('tag'), text);
  const out = h('div', { class: 'label-out', 'aria-live': 'polite' });
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    button.disabled = true;
    text.textContent = tr('Reading the label…', 'Leyendo la etiqueta…');
    try {
      const recall = { codes: r.recall.codes || [], more: !!r.recall.more, from: r.recall.from || 0, to: r.recall.to || 0 };
      const { reading, source, verdict } = await onLabel(await labelPhoto(file), recall);
      const copy = labelCopy(verdict || judgeLabel(reading, recall), { owner });
      // Kept with the check in the web page's log (web/src/log.js), so a shop's record shows the label too.
      root.dispatchEvent(new CustomEvent('sr-label', { bubbles: true, detail: { title: copy.title, read: [reading.brand, ...(reading.model_numbers || []).slice(0, 3), reading.manufacture_date].filter(Boolean).join(' · ') } }));
      const read = [reading.brand, ...(reading.model_numbers || []).slice(0, 3), reading.manufacture_date].filter(Boolean).join(' · ');
      out.replaceChildren(h('div', { class: `label-result is-${copy.tone}` },
        h('p', { class: 'label-title' }, copy.title),
        h('p', {}, copy.text),
        h('p', { class: 'hint' }, `${{ on_device: tr('Read on this device; the photo did not leave it.', 'Leída en este dispositivo; la foto no salió de él.'), device_then_cloud: tr('Read on this device, then read again in the cloud before ruling it out.', 'Leída en este dispositivo y luego otra vez en la nube antes de descartarlo.') }[source] || tr('Read in the cloud.', 'Leída en la nube.')}${read ? tr(` On the label: ${read}.`, ` En la etiqueta: ${read}.`) : ''}`)));
      text.textContent = tr('Try another photo', 'Probar con otra foto');
    } catch {
      out.replaceChildren(h('p', { class: 'hint' }, tr('The label could not be read right now. Try again in a moment.', 'No se pudo leer la etiqueta ahora. Inténtelo de nuevo en un momento.')));
      text.textContent = tr('Add a label photo', 'Agregar foto de la etiqueta');
    } finally {
      button.disabled = false;
    }
  });
  const root = h('section', { class: 'check label-check' },
    h('h2', {}, tr('Settle it with the label', 'Resuélvalo con la etiqueta')),
    h('p', {}, owner ? tr('Take a photo of the label on your item. Its model number and date are read and compared with the notice.', 'Tome una foto de la etiqueta de su artículo. Se leen el número de modelo y la fecha y se comparan con el aviso.')
      : tr('Have a photo of the label, from the seller or of the item itself? Its model number and date are read and compared with the notice.', '¿Tiene una foto de la etiqueta, del vendedor o del artículo? Se leen el número de modelo y la fecha y se comparan con el aviso.')),
    input, button, out);
  return root;
}

function howLine(r) {
  const device = r.how && r.how.device;
  const cloud = r.how && r.how.cloudModel;
  if (r.how && r.how.judgedInCloud) return cloud ? tr('Looked at in the cloud, then confirmed against the full notice.', 'Revisado en la nube y luego confirmado con el aviso completo.') : tr('Looked at in the cloud.', 'Revisado en la nube.');
  if (device && cloud) return tr('Checked on this device, then confirmed in the cloud against the full notice.', 'Revisado en este dispositivo y luego confirmado en la nube con el aviso completo.');
  if (device && r.how.cloudError) return tr('Checked on this device. The cloud double-check could not run.', 'Revisado en este dispositivo. La segunda revisión en la nube no se pudo hacer.');
  if (device) return tr('Checked on this device.', 'Revisado en este dispositivo.');
  if (cloud) return tr('Matched by its words, then confirmed in the cloud.', 'Encontrado por sus palabras y luego confirmado en la nube.');
  return tr('Matched by its words only.', 'Encontrado solo por sus palabras.');
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
  const mine = owner ? tr('Your item', 'Su artículo') : tr('This listing', 'Este anuncio');

  root.append(h('div', { class: 'verdict' },
    statusPill(r),
    h('p', { class: 'verdict-line' }, owner ? owner.verdict : r.verdict),
    (owner ? owner.action : r.action) ? h('p', { class: `action-line ${levelClass(r)}` }, owner ? owner.action : r.action) : null,
    r.sleep ? h('p', { class: 'evidence sleep-line' }, r.sleep) : null,
    r.confirmed && r.evidence ? h('p', { class: 'evidence' }, owner ? owner.evidence : r.evidence) : null,
    r.foundBy ? h('p', { class: 'evidence found-by' }, owner ? owner.foundBy : r.foundBy) : null,
  ));

  // The cloud check's outline of what it saw in the seller's photo. Only when the photo was there to look at.
  const where = r.where && r.listing.image ? r.where : null;
  if (r.kind === 'recall' && r.recall) {
    // A CPSC warning comes without a photo: the hazard, in CPSC's words, stands beside the listing instead.
    root.append(r.recall.image
      ? h('div', { class: 'pair' },
        photo(r.listing.image, where ? tr(`${mine}. Outlined: what the cloud check matched.`, `${mine}. Marcado: lo que coincidió en la revisión en la nube.`) : mine, r.listing.url, { where }),
        photo(r.recall.image, tr('Recall notice', 'Aviso de retiro'), r.recall.url))
      : h('div', { class: 'pair is-single' },
        photo(r.listing.image, where ? tr(`${mine}. Outlined: what the cloud check matched.`, `${mine}. Marcado: lo que coincidió en la revisión en la nube.`) : mine, r.listing.url, { where }),
        h('div', { class: 'risk' }, h('p', { class: 'risk-text' }, r.recall.hazard || r.recall.title))));
    // Which units the notice recalls, in one sentence written from the notice.
    if (r.recall.tell && r.recall.tell !== r.check) root.append(h('p', { class: 'tell' }, h('b', {}, tr('Which units: ', 'Qué unidades: ')), r.recall.tell));
  } else if (r.kind === 'banned' && r.banned && where) {
    // The photo large, with the part that matters outlined: a bumper among the bedding is easy to miss.
    root.append(h('div', { class: 'spot' },
      photo(r.listing.image, tr(`Outlined by the cloud check: what it saw as ${/^[aeiou]/i.test(r.banned.name) ? 'an' : 'a'} ${r.banned.name.toLowerCase()}.`, `Marcado por la revisión en la nube: lo que vio como ${r.banned.name.toLowerCase()}.`), r.listing.url, { where, wide: true }),
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
  const label = h('span', {}, askUrl ? tr('Ask the seller', 'Preguntar al vendedor') : tr('Copy question for seller', 'Copiar pregunta para el vendedor'));
  const askBtn = h('button', { class: 'btn btn-primary', type: 'button' }, icon(askUrl ? 'message' : 'copy'), label);
  askBtn.addEventListener('click', async () => {
    await copyWithFeedback(askBtn, r.question, label);
    if (askUrl) window.open(askUrl, '_blank', 'noopener');
  });
  if (owner) root.append(h('section', { class: 'check' }, h('h2', {}, owner.heading), ...owner.lines.map(l => h('p', {}, l))));
  else root.append(h('section', { class: 'check' },
    h('h2', {}, tr('Before you buy', 'Antes de comprar')),
    // The cloud's own line names the notice's models and label; without it, the type's advice or a plain default.
    h('p', {}, r.recall && r.recall.all ? tr(`${r.recall.warning ? "CPSC's warning covers every unit of this product" : 'Every unit of this product is recalled'}, whatever its model number or date. Check that it is this product: the brand and the photos.`,
      `${r.recall.warning ? 'La advertencia de la CPSC cubre todas las unidades de este producto' : 'Todas las unidades de este producto fueron retiradas del mercado'}, sin importar el número de modelo o la fecha. Revise que sea este producto: la marca y las fotos.`)
      : r.check || (r.banned && r.banned.advice) || DEFAULT_CHECK[r.kind] || ''),
    h('blockquote', { class: 'question' }, r.question),
    askBtn,
    isPractice(r) ? h('p', { class: 'hint' }, tr('Practice listing: the question is copied, but there is no seller to message.', 'Anuncio de práctica: la pregunta se copia, pero no hay vendedor a quien escribir.'))
    : askUrl ? h('p', { class: 'hint' }, /m2mOpen/.test(askUrl)
      ? tr('Copies the question and opens eBay\'s message box for this seller.', 'Copia la pregunta y abre los mensajes de eBay para este vendedor.')
      : tr('Copies the question and opens the listing, where the seller\'s message button is.', 'Copia la pregunta y abre el anuncio, donde está el botón para escribir al vendedor.')) : null,
  ));

  // Settle it with the label: the one fact a "possible recall" is missing. Not offered when the notice recalls every
  // unit (no model number would change the answer) or lists no models and no years to compare with.
  if (onLabel && r.kind === 'recall' && r.recall && !r.recall.all && ((r.recall.codes || []).length || r.recall.from)) {
    root.append(labelSection(r, onLabel, !!owner));
  }

  // The last step: a report to CPSC, which asks shoppers to report recalled products for sale online at
  // SaferProducts.gov with the listing's link. Offered only for likely flags whose sale the law rules out.
  if (r.report && !owner) {
    const repLabel = h('span', {}, tr('Report to CPSC', 'Reportar a la CPSC'));
    const repBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, icon('flag'), repLabel);
    repBtn.addEventListener('click', async () => {
      await copyWithFeedback(repBtn, r.report, repLabel);
      // A made-up practice listing must never reach CPSC's real form.
      if (!isPractice(r)) window.open(CPSC_REPORT_URL, '_blank', 'noopener');
    });
    root.append(h('section', { class: 'report' },
      h('h2', {}, tr('Report the listing', 'Reportar el anuncio')),
      h('p', {}, r.kind === 'recall'
        ? tr('CPSC asks shoppers who find a recalled product for sale online to report it at SaferProducts.gov, with the listing\'s link and a screenshot. Its e-commerce team has such listings taken down.', 'La CPSC pide a quien encuentre a la venta en internet un producto retirado del mercado que lo reporte en SaferProducts.gov, con el enlace del anuncio y una captura de pantalla. Su equipo de comercio electrónico hace que quiten esos anuncios.')
        : tr('CPSC\'s e-commerce team looks for recalled and banned products listed for sale and has the listings taken down. You can report this one at SaferProducts.gov, with its link and a screenshot.', 'El equipo de comercio electrónico de la CPSC busca productos retirados o prohibidos que estén a la venta y hace que quiten los anuncios. Puede reportar este en SaferProducts.gov, con su enlace y una captura de pantalla.')),
      compact ? null : h('details', { class: 'report-text' }, h('summary', {}, tr('The report text', 'El texto del reporte (en inglés)')), h('pre', {}, r.report)),
      repBtn,
      h('p', { class: 'hint' }, isPractice(r) ? tr('Practice listing: the report is copied so you can see it, and the CPSC form is not opened.', 'Anuncio de práctica: el reporte se copia para que lo vea, y no se abre el formulario de la CPSC.')
        : tr('Copies the report, with the listing link, and opens the CPSC form. Paste it into the description.', 'Copia el reporte, con el enlace del anuncio, y abre el formulario de la CPSC. Péguelo en la descripción.')),
    ));
  }

  if (watch) root.append(watchSection(watch));

  if (!compact && r.kind === 'recall' && r.recall) {
    root.append(h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, r.recall.warning ? tr('CPSC warning', 'Advertencia de la CPSC') : tr('Recall', 'Retiro')), h('dd', { class: 'num' }, r.recall.number || r.recall.id)),
      h('div', {}, h('dt', {}, r.recall.warning ? tr('Warned', 'Fecha de advertencia') : tr('Recalled', 'Fecha de retiro')), h('dd', { class: 'num' }, longDay(r.recall.date))),
      h('div', {}, h('dt', {}, tr('Product', 'Producto')), h('dd', {}, r.recall.product)),
      r.recall.hazard ? h('div', {}, h('dt', {}, tr('Hazard', 'Peligro')), h('dd', {}, r.recall.hazard)) : null,
      r.recall.remedy ? h('div', {}, h('dt', {}, r.recall.warning ? tr('CPSC says', 'La CPSC dice') : tr('What owners get', 'Qué reciben los dueños')), h('dd', {}, r.recall.remedy)) : null,
    ));
  }

  const source = r.kind === 'recall' ? safeUrl(r.recall && r.recall.url) : safeUrl(r.banned && r.banned.source);
  root.append(h('div', { class: 'links' },
    source ? h('a', { class: 'link', href: source, target: '_blank', rel: 'noopener' },
      r.kind === 'recall' ? (r.recall.warning ? tr(`Find warning ${r.recall.number} on CPSC's warnings page`, `Buscar la advertencia ${r.recall.number} en la página de la CPSC`) : tr('Read the CPSC recall notice', 'Leer el aviso de retiro de la CPSC (en inglés)')) : tr('CPSC safe sleep guidance', 'Guía de sueño seguro de la CPSC'), icon('external', { size: 14 })) : null,
    r.also && !r.also.warning && safeUrl(r.also.url) ? h('a', { class: 'link', href: safeUrl(r.also.url), target: '_blank', rel: 'noopener' }, tr(`CPSC recall ${r.also.number}`, `Retiro ${r.also.number} de la CPSC`), icon('external', { size: 14 })) : null,
    onOpenPanel ? h('button', { class: 'link', type: 'button', onclick: onOpenPanel }, tr('More in the side panel', 'Más en el panel lateral'), icon('panel', { size: 14 })) : null,
  ));

  root.append(h('p', { class: 'how' }, howLine(r)));
  return root;
}

/** "Watch for recalls" on a listing's own page: a recall announced after the purchase still reaches the buyer. */
function watchSection(watch) {
  const label = h('span', {}, tr('Watch for recalls', 'Vigilar retiros'));
  const btn = h('button', { class: 'btn btn-secondary', type: 'button', 'aria-pressed': 'false' }, icon('bell', { size: 16 }), label);
  let on = false;
  const show = v => { on = v; btn.setAttribute('aria-pressed', String(v)); label.textContent = v ? tr('Watching for recalls', 'Vigilando retiros') : tr('Watch for recalls', 'Vigilar retiros'); };
  watch.get().then(show, () => {});
  btn.addEventListener('click', async () => { const next = !on; show(next); try { await watch.set(next); } catch { show(!next); } });
  return h('section', { class: 'watch' },
    h('h2', {}, tr('Bought it, or already own one?', '¿Lo compró, o ya tiene uno?')),
    h('p', {}, tr('Recall notices reach the first owner, not the next one. Watch this listing and Still Recalled checks it against every new CPSC recall, on this computer.', 'Los avisos de retiro le llegan al primer dueño, no al siguiente. Vigile este anuncio y Still Recalled lo compara con cada nuevo retiro de la CPSC, en esta computadora.')),
    btn);
}
