// What the shopper reads. Turns a decision (judge.decide or confirm.decideFinal) into a plain, serialisable result:
// no RegExps, no functions, so it can travel between extension pages and be stored.
//
// Wording rules: never "safe"; never a legal verdict on the listing ("banned", "illegal"): the tool can be wrong about
// what a listing is. The risk lines state each type's own rule and CPSC's guidance, checked against primary sources on
// 2026-11-15 (docs/research/sources.md).
import { clip } from './text.mjs';
import { INFANT, INFANT_ES } from './triage.mjs';
import { tr, getLang, monthYearOf } from './i18n.mjs';

export const SAFE_SLEEP_URL = 'https://www.cpsc.gov/SafeSleep';

// One entry per type key in banned.mjs.
export const TYPE_COPY_EN = {
  inclined_sleeper: {
    name: 'Inclined infant sleeper',
    short: 'inclined sleeper',
    risk: 'Selling an inclined infant sleeper has been against federal law since November 2022. CPSC says products with an incline over 10° should never be used for infant sleep; about 100 deaths were reported in one recalled model alone.',
    advice: 'Never use it for sleep. Many inclined sleepers are also recalled, so ask for the brand and model.',
    ask: 'Hi, before I buy: what brand and model is this, and what is the manufacture date on its label?',
  },
  crib_bumper: {
    name: 'Padded crib bumper',
    short: 'crib bumper',
    risk: 'Selling a padded crib bumper has been against federal law since November 2022. CPSC lists bumpers among the soft items that can suffocate a baby; its advice is nothing but a fitted sheet in a crib.',
    advice: "Mesh liners aren't covered by the sales ban, but safe-sleep advice is still nothing in a crib but a fitted sheet, so you don't need either. Ask which this is before you buy.",
    ask: 'Hi, before I buy: is this a padded bumper or a thin mesh liner? Could you send a photo of the label?',
  },
  in_bed_sleeper: {
    name: 'Infant lounger or nest',
    short: 'lounger',
    risk: 'Many young babies can\'t lift their heads to pull away from soft padding. CPSC says these are never for sleep, eBay and Facebook Marketplace don\'t allow them, and many have been recalled.',
    advice: 'Never use it for sleep, not even for a nap. Several loungers have been recalled, so ask for the brand and model.',
    ask: 'Hi, before I buy: what brand and model is this? Could you send a photo of the label?',
  },
  drop_side_crib: {
    name: 'Drop-side crib',
    short: 'drop-side crib',
    risk: 'Drop-side cribs don\'t meet the federal crib standard in force since June 2011, and CPSC says older cribs very likely can\'t be legally sold.',
    advice: 'Ask whether a side of the crib slides down, and for the manufacture date on its label.',
    ask: 'Hi, before I buy: does one side of the crib slide down? What is the manufacture date on its label?',
  },
};
const TYPE_COPY_ES = {
  inclined_sleeper: {
    name: 'Dormidor inclinado para bebé',
    short: 'dormidor inclinado',
    a: 'un dormidor inclinado para bebé',
    risk: 'Vender un dormidor inclinado para bebé es ilegal en EE. UU. desde noviembre de 2022. La CPSC dice que los productos con más de 10° de inclinación nunca deben usarse para que duerma un bebé; solo en un modelo retirado del mercado se reportaron unas 100 muertes.',
    advice: 'Nunca lo use para dormir. Muchos dormidores inclinados también han sido retirados del mercado, así que pida la marca y el modelo.',
    ask: 'Hola, antes de comprarlo: ¿qué marca y modelo es, y qué fecha de fabricación dice la etiqueta?',
  },
  crib_bumper: {
    name: 'Protector acolchado para cuna',
    short: 'protector de cuna',
    a: 'un protector acolchado para cuna',
    risk: 'Vender un protector acolchado para cuna es ilegal en EE. UU. desde noviembre de 2022. La CPSC incluye los protectores entre los objetos blandos que pueden asfixiar a un bebé; su consejo es no poner nada en la cuna más que una sábana ajustable.',
    advice: 'Los protectores de malla no están prohibidos para la venta, pero el consejo de sueño seguro sigue siendo no poner nada en la cuna más que una sábana ajustable, así que no necesita ninguno. Pregunte cuál es antes de comprar.',
    ask: 'Hola, antes de comprarlo: ¿es un protector acolchado o uno de malla delgada? ¿Me puede mandar una foto de la etiqueta?',
  },
  in_bed_sleeper: {
    name: 'Nido o cojín para bebé',
    short: 'nido para bebé',
    a: 'un nido o cojín para bebé',
    risk: 'Muchos bebés pequeños no pueden levantar la cabeza para apartarse del acolchado. La CPSC dice que estos nunca son para dormir, eBay y Facebook Marketplace no los permiten, y muchos han sido retirados del mercado.',
    advice: 'Nunca lo use para dormir, ni siquiera para una siesta. Varios nidos han sido retirados del mercado, así que pida la marca y el modelo.',
    ask: 'Hola, antes de comprarlo: ¿qué marca y modelo es? ¿Me puede mandar una foto de la etiqueta?',
  },
  drop_side_crib: {
    name: 'Cuna de baranda corrediza',
    short: 'cuna de baranda corrediza',
    a: 'una cuna de baranda corrediza',
    risk: 'Las cunas de baranda corrediza no cumplen la norma federal de cunas vigente desde junio de 2011, y la CPSC dice que las cunas más antiguas muy probablemente no se pueden vender legalmente.',
    advice: 'Pregunte si un lado de la cuna se desliza hacia abajo, y la fecha de fabricación de la etiqueta.',
    ask: 'Hola, antes de comprarla: ¿uno de los lados de la cuna se desliza hacia abajo? ¿Qué fecha de fabricación dice la etiqueta?',
  },
};
// Read in the current language (shared/i18n.mjs): TYPE_COPY[key] is the Spanish entry when the page is in Spanish.
export const TYPE_COPY = new Proxy(TYPE_COPY_EN, {
  get: (en, k) => (getLang() === 'es' && TYPE_COPY_ES[k] ? TYPE_COPY_ES[k] : en[k]),
});

/** Recall product names as a sentence can carry them: "All Models of Fisher-Price Snuga Swings" -> "Fisher-Price Snuga Swings". */
export function productName(product) {
  return clip(String(product || '').replace(/^all\s+(models\s+of\s+|units\s+of\s+)?/i, '').replace(/^the\s+/i, ''), 90);
}

/**
 * A recall card keeps the first 140 characters of the notice's remedy, which often ends mid-word. For reading: the
 * whole sentences that fit, or, when the first sentence itself was cut, whole words and a note that the notice has
 * the rest. A remedy that was not cut is returned as it is.
 */
export function remedyText(remedy) {
  const s = String(remedy || '').trim();
  if (!/…$/.test(s)) return s;
  const body = s.slice(0, -1).trim();
  // Cut exactly at the end of a sentence: nothing is missing from what is shown.
  if (/[.!?]$/.test(body)) return body;
  const stop = body.search(/[.!?](?=\s+[A-Z][^.!?]*$)/);
  if (stop > 40) return body.slice(0, stop + 1);
  // No whole sentence: drop the cut word (and a cut web address), and say where the rest is.
  const words = body.replace(/\s*\S*$/, '').replace(/\s+https?:\S*$/i, '').replace(/(?:[\s,;:(]+(?:and|or|to|go|visit|at|for|the|a|an|of|with|by|on|in))*[\s,;:(]*$/i, '');
  return `${words}… (the notice has the rest)`;
}

/** The badge text on the listing: short, specific, never "safe". */
export function badgeText(r) {
  // A CPSC safety warning: the maker did not recall the product, so CPSC warned the public itself.
  if (r.kind === 'recall' && r.recall && r.recall.warning) return r.level === 'likely' ? tr('CPSC warning', 'Advertencia de la CPSC') : tr('Possible CPSC warning', 'Posible advertencia de la CPSC');
  if (r.kind === 'recall') return r.level === 'likely' ? tr('Recalled product', 'Retirado del mercado') : tr('Possible recall', 'Posible retiro');
  if (r.kind === 'banned') return r.level === 'likely' ? (TYPE_COPY[r.banned.key] || {}).name || tr('Sleep risk', 'Riesgo al dormir') : tr(`Possible ${(TYPE_COPY[r.banned.key] || {}).short || 'sleep risk'}`, `Posible ${(TYPE_COPY[r.banned.key] || {}).short || 'riesgo al dormir'}`);
  return '';
}

/** One sentence saying what was found, for the panel row and the top of the detail. */
export function verdictLine(r) {
  // Found by the cloud's question to the device's field guide: the listing itself does not name the product.
  const p = r.recall ? productName(r.recall.product) : '', when = r.recall ? monthYear(r.recall.date) : '';
  if (r.kind === 'recall' && r.lookedUp) {
    return tr(`Looks like the ${p}, ${r.recall.warning ? 'which CPSC warned people to stop using in' : 'recalled'} ${when}. The listing's words don't name this product, so check the brand before you buy.`,
      `Parece ser «${p}», ${r.recall.warning ? 'que la CPSC pidió dejar de usar en' : 'retirado del mercado en'} ${when}. El anuncio no nombra este producto, así que revise la marca antes de comprar.`);
  }
  if (r.kind === 'recall' && r.recall.warning) {
    return r.level === 'likely'
      ? tr(`Looks like the ${p}. CPSC warned people to stop using them in ${when}; the seller behind them did not recall them.`,
        `Parece ser «${p}». La CPSC pidió dejar de usarlos en ${when}; quien los vendía no los retiró del mercado.`)
      : tr(`Same brand and kind as the ${p}, which CPSC warned people to stop using in ${when}.`, `Misma marca y tipo que «${p}», que la CPSC pidió dejar de usar en ${when}.`);
  }
  if (r.kind === 'recall') {
    return r.level === 'likely'
      ? tr(`Looks like the ${p}, recalled ${when}.`, `Parece ser «${p}», retirado del mercado en ${when}.`)
      : tr(`Same brand and kind as the ${p}, recalled ${when}. The listing doesn't show which model.`, `Misma marca y tipo que «${p}», retirado del mercado en ${when}. El anuncio no muestra el modelo.`);
  }
  if (r.kind === 'banned') {
    if (getLang() === 'es') {
      const a = (TYPE_COPY[r.banned.key] || {}).a || 'un producto de riesgo para dormir';
      return r.level === 'likely' ? `Parece ser ${a}.` : `Puede ser o incluir ${a}.`;
    }
    const name = (TYPE_COPY[r.banned.key] || { name: 'infant sleep product' }).name.toLowerCase();
    const a = /^[aeiou]/.test(name) ? 'an' : 'a';
    return r.level === 'likely' ? `This looks like ${a} ${name}.` : `This may be or include ${a} ${name}.`;
  }
  return '';
}

/**
 * What to do, in one line, at the top of the card: a flag that only names a product leaves the shopper asking "so can
 * I buy it?". Advice, not a verdict on the listing, which the tool can be wrong about.
 */
export function actionLine(r) {
  if (r.kind === 'recall' && r.lookedUp) {
    return r.recall && r.recall.all
      ? tr("Don't buy it until you know it isn't this product: every unit of it is recalled.", 'No lo compre hasta saber que no es este producto: todas sus unidades fueron retiradas del mercado.')
      : tr("Don't buy it until the seller shows the brand and the label, and it isn't one of the recalled units.", 'No lo compre hasta que el vendedor muestre la marca y la etiqueta, y no sea una de las unidades retiradas.');
  }
  if (r.kind === 'recall' && r.recall && r.recall.warning) {
    return r.level === 'possible'
      ? tr("Don't buy it until you know it isn't the product CPSC warned about.", 'No lo compre hasta saber que no es el producto sobre el que advirtió la CPSC.')
      : tr("Don't buy it. CPSC has told people to stop using this product.", 'No lo compre. La CPSC pidió dejar de usar este producto.');
  }
  if (r.kind === 'recall') {
    if (r.level === 'possible') return tr("Don't buy it until the seller's label shows it isn't one of the recalled units.", 'No lo compre hasta que la etiqueta muestre que no es una de las unidades retiradas.');
    return r.recall && r.recall.all
      ? tr("Don't buy it. Every unit of this product is recalled.", 'No lo compre. Todas las unidades de este producto fueron retiradas del mercado.')
      : tr("Don't buy it unless the seller's label shows it isn't one of the recalled units.", 'No lo compre a menos que la etiqueta muestre que no es una de las unidades retiradas.');
  }
  if (r.kind === 'banned') {
    if (r.level === 'possible') return r.banned && r.banned.key === 'in_bed_sleeper'
      ? tr("Ask the seller what it is. If it's a soft padded nest or cushion for a baby to lie in, skip it, whatever it's called.", 'Pregúntele al vendedor qué es. Si es un nido o cojín acolchado para acostar a un bebé, no lo compre, se llame como se llame.')
      : tr('Ask the seller what it is before you buy.', 'Pregúntele al vendedor qué es antes de comprarlo.');
    return ({
      crib_bumper: tr("Skip this one. CPSC's advice: nothing in a crib but a fitted sheet.", 'No lo compre. El consejo de la CPSC: nada en la cuna más que una sábana ajustable.'),
      inclined_sleeper: tr('Skip this one, and never use an inclined sleeper for sleep.', 'No lo compre, y nunca use un dormidor inclinado para dormir.'),
      in_bed_sleeper: tr('Skip this one. Babies fall asleep in loungers, and infants have died in them, even during naps.', 'No lo compre. Los bebés se duermen en los nidos, y algunos han muerto en ellos, incluso durante siestas.'),
      drop_side_crib: tr("Skip this one: drop-side cribs don't meet today's crib standard.", 'No la compre: las cunas de baranda corrediza no cumplen la norma de cunas actual.'),
    })[r.banned && r.banned.key] || tr('Never use it for sleep.', 'Nunca lo use para dormir.');
  }
  return '';
}

/** What the shopper reads when nothing matched: never an all-clear. */
export function noMatchLine(count, since, input = 'listing') {
  const what = input === 'typed' ? tr('the words you typed', 'las palabras que escribió') : tr('what the listing shows', 'lo que muestra el anuncio');
  return tr(`No recall found for what we could read. That doesn't mean it's safe. We searched ${count} recall notices since ${since}, and can only match ${what}.`,
    `No encontramos un retiro del mercado para lo que pudimos leer. Eso no quiere decir que sea seguro. Buscamos en ${count} avisos de retiro desde ${since}, y solo podemos comparar ${what}.`);
}

// Safe sleep, said on every result about something a baby sleeps in, sits in or lies on (AAP 2022, CPSC Safe Sleep):
// alone, on the back, in a crib, bassinet or play yard with only a fitted sheet. Most sleep deaths involve no recalled
// product, so a result about a product must not read as the whole answer.
const SLEEP_PLACE = /\b(cribs?|cots?|bassinets?|cradles?|moses|play\s*yards?|playards?|pack\s*'?n\s*'?play|playpens?|bed(ding)?|mattress(es)?|sleep\w*|co-?sleep\w*|cunas?|moises|corral(ito)?s?)\b/i;
const SITTING = /\b(swings?|bouncers?|rockers?|car\s*seats?|infant\s*seats?|carriers?|slings?|strollers?|columpios?|mecedor(a|es)?)\b/i;
const LOUNGE = /\b(loungers?|nests?|nids?|pods?|pillows?|cushions?|positioners?|docks?|inclined|nido|almohadas?|cojin(es)?)\b/i;
const BEDDING_SET = /\b(bedding|quilts?|comforters?|blankets?|crib\s*sets?)\b/i;
const SLEEP_PART = /\b(pads?|mattress(es)?|inserts?|sheets?)\b/i;
export const CAR_SEAT = /\b(car\s*seats?|infant\s*seats?|booster\s*seats?|boosters?|silla\s+(de\s+)?(auto|carro))\b/i;
export const carSeatLine = () => tr("Car seat recalls are kept by NHTSA, not CPSC, so they aren't checked here. Look up the seat's model and date at nhtsa.gov/recalls.",
  'Los retiros de asientos de auto los lleva la NHTSA, no la CPSC, así que aquí no se revisan. Busque el modelo y la fecha del asiento en nhtsa.gov/recalls.');
const abc = () => tr('Every sleep: baby alone, on their back, in a crib, bassinet or play yard with only a fitted sheet.',
  'Cada vez que duerma, de día o de noche: el bebé solito, boca arriba, en una cuna, moisés o corral, con nada más que una sábana ajustable.');

/** The safe-sleep line for a product, or ''. `part`: the listing was taken for a part (a play-yard pad, a mattress). */
export function sleepLine(text, part = false, r = null) {
  // Accents removed first: \b does not see "í" or "é" as letters, so "cojín" and "moisés" would never match.
  const t = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const key = r && r.kind === 'banned' && r.banned ? r.banned.key : '';
  if (part && SLEEP_PART.test(t) && SLEEP_PLACE.test(t)) {
    return tr('This looks like a part, so a recall may not cover it. Use only the mattress or pad that came with the crib, bassinet or play yard: extra padding can suffocate a baby.',
      'Parece ser una pieza, así que un retiro puede no cubrirla. Use solo el colchón o la almohadilla que vino con la cuna, el moisés o el corral: el acolchado extra puede asfixiar a un bebé.');
  }
  if (part) return '';
  if (key === 'inclined_sleeper' || /\b(inclined|rock\s*'?n\s*'?play)\b/i.test(t)) return tr(`Babies should sleep flat, never in an inclined sleeper, recalled or not. ${abc()}`, `Los bebés deben dormir sobre una superficie plana, nunca en un dormidor inclinado, esté retirado del mercado o no. ${abc()}`);
  if (key === 'in_bed_sleeper' || (LOUNGE.test(t) && /\b(baby|babies|infant|newborn|bebes?|bebés?)\b/i.test(t))) {
    return tr('Not for sleep, recalled or not. If your baby gets sleepy, move them to their crib or bassinet, on their back.',
      'No es para dormir, esté retirado del mercado o no. Si su bebé se duerme, páselo a su cuna o moisés, boca arriba.');
  }
  if (key === 'crib_bumper' || BEDDING_SET.test(t)) return tr(`Quilts, comforters, pillows and bumpers from crib sets are for decoration only. ${abc()}`, `Las colchas, edredones, almohadas y protectores de los juegos de cuna son solo de decoración. ${abc()}`);
  if (SLEEP_PLACE.test(t)) return abc();
  if (SITTING.test(t)) return tr('Not for sleep. If your baby falls asleep in it, move them to their crib or bassinet, on their back.', 'No es para dormir. Si su bebé se queda dormido ahí, páselo a su cuna o moisés, boca arriba.');
  return '';
}

/** Any full-size crib made before June 28, 2011 very likely does not meet today's standard (CPSC Crib Information Center). */
function oldCribLine(text) {
  text = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /\b(cribs?|cunas?)\b/i.test(text) && !/\b(mini|portable|travel)\b/i.test(text)
    ? tr("A crib made before June 28, 2011 likely doesn't meet today's crib standard. Check the date on its label, and that it has every part.",
      'Una cuna fabricada antes del 28 de junio de 2011 probablemente no cumple la norma de cunas actual. Revise la fecha en la etiqueta y que tenga todas sus piezas.')
    : '';
}

// Words that never name a product: greetings, sale talk, condition, pronouns.
const FILLER = new Set(`a an the this that these those one ones it its is are was be my your our their his her i me we you
  and or but for with of to in on at by from as so if not no yes ok okay hi hello hey thanks thank please
  used new like good great nice excellent perfect condition works working clean cheap free price priced obo firm cash
  pickup pick up only must go sale selling sell sold item items thing things stuff listing post here there what how much
  any some all very really just still check see look this one`.split(/\s+/));

/** Typed or shared words that name no product ("this one", "hi", "$40 obo"): nothing a recall could be matched to. */
export function namesNothing(text) {
  const words = (String(text || '').toLowerCase().match(/[a-z][a-z'&+-]*/g) || [])
    .map(w => w.replace(/['&+-]+$/, ''))
    .filter(w => w.length > 1 && !FILLER.has(w));
  return words.length === 0;
}

/** "10,089", without Intl: the Android sandbox runs this file and may have no locale data. */
const grouped = n => String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Everything a no-match result says, for the web page and the Android app alike, so the two cannot drift:
 * { pill, line, heading, lines, safeSleep, vague }. `input`: 'listing' (a screenshot or photo) or 'typed'.
 * `count` and `since` (an ISO date) describe the recall list that was searched.
 */
export function noMatchView(r, listing, { input = 'listing', audience = 'buyer', count = 0, since = '' } = {}) {
  const title = (listing && listing.title) || '';
  const partOrToy = r.why === 'part or toy' || /part or a toy/.test(r.why || '');
  const vague = !partOrToy && input === 'typed' && namesNothing(title);
  const owner = audience === 'owner' ? ownerView(r) : null;
  const sleep = sleepLine(title, partOrToy);
  const safeSleep = !!sleep || INFANT.test(title) || INFANT_ES.test(title);
  if (vague) {
    return {
      vague, safeSleep: false, pill: tr('Nothing to match', 'Nada que comparar'),
      line: tr("We couldn't tell what the product is. Type its brand and name, like “Graco Pack 'n Play”, or check a screenshot of the listing.",
        'No pudimos saber qué producto es. Escriba la marca y el nombre, como “Graco Pack \'n Play”, o revise una captura de pantalla del anuncio.'),
      heading: tr('What helps', 'Qué ayuda'), lines: [tr('The brand and the product name are enough. A model number, if you have one, settles most recalls.', 'La marca y el nombre del producto bastan. Un número de modelo, si lo tiene, resuelve la mayoría de los retiros.')],
    };
  }
  const line = partOrToy ? tr('This looks like a part or a toy version, not the product itself.', 'Parece ser una pieza o una versión de juguete, no el producto en sí.')
    : owner ? owner.action
    : noMatchLine(grouped(count), monthYear(since || '1973-01-01'), input);
  const plain = String(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const extra = [sleep, CAR_SEAT.test(plain) ? carSeatLine() : '', oldCribLine(title)].filter(Boolean);
  const pill = tr('No match found', 'Sin coincidencias');
  if (owner) return { vague, safeSleep, pill, line, heading: owner.heading, lines: [...owner.lines, ...extra] };
  return {
    vague, safeSleep, pill, line, heading: tr('Before you buy', 'Antes de comprar'),
    lines: [
      tr('A listing rarely shows the model number, and many recalls cover only some models. Ask the seller for a photo of the label, then search the model number on SaferProducts.gov.',
        'Un anuncio rara vez muestra el número de modelo, y muchos retiros cubren solo algunos modelos. Pídale al vendedor una foto de la etiqueta y busque el número de modelo en SaferProducts.gov.'),
      ...extra,
    ].filter(Boolean),
  };
}

/** A message the shopper can paste to the seller. Plain, polite, and asks for the one fact that settles it. */
export function sellerQuestion(r) {
  const es = getLang() === 'es' && INFANT_ES.test(`${(r.listing && r.listing.title) || ''}`);
  const q = (en, sp) => (es ? sp : en);
  const p = r.recall ? productName(r.recall.product) : '';
  if (r.kind === 'recall' && r.lookedUp) {
    return q(`Hi, before I buy: what brand and model is this? Could you send a photo of its label? ` +
      `It looks like a product CPSC ${r.recall.warning ? 'warned about' : 'recalled'} (${r.recall.warning ? 'warning' : 'recall'} ${r.recall.number}, ${p}).`,
      `Hola, antes de comprarlo: ¿qué marca y modelo es? ¿Me puede mandar una foto de la etiqueta? ` +
      `Se parece a un producto que la CPSC ${r.recall.warning ? 'pidió dejar de usar' : 'retiró del mercado'} (${r.recall.warning ? 'advertencia' : 'retiro'} ${r.recall.number}, ${p}).`);
  }
  if (r.kind === 'recall' && r.recall.warning) {
    return q(`Hi, before I buy: what brand is this, and could you send a photo of its tag or label? ` +
      `CPSC has warned people to stop using a product like it (warning ${r.recall.number}, ${p}).`,
      `Hola, antes de comprarlo: ¿qué marca es, y me puede mandar una foto de la etiqueta? ` +
      `La CPSC pidió dejar de usar un producto como este (advertencia ${r.recall.number}, ${p}).`);
  }
  if (r.kind === 'recall') {
    return q(`Hi, before I buy: could you send a photo of the label showing the model number and manufacture date? ` +
      `I'd like to check it against a CPSC recall (${r.recall.id}, ${p}).`,
      `Hola, antes de comprarlo: ¿me puede mandar una foto de la etiqueta con el número de modelo y la fecha de fabricación? ` +
      `Quiero compararla con un retiro de la CPSC (${r.recall.id}, ${p}).`);
  }
  if (r.kind === 'banned' && r.banned.key === 'crib_bumper' && r.level === 'possible') {
    return q('Hi, before I buy: does this set include padded crib bumpers? Could you list every piece that comes with it?',
      'Hola, antes de comprarlo: ¿este juego incluye protectores acolchados para cuna? ¿Me puede decir todas las piezas que trae?');
  }
  if (r.kind === 'banned') return es ? (TYPE_COPY_ES[r.banned.key] || {}).ask || '' : (TYPE_COPY_EN[r.banned.key] || {}).ask || '';
  return '';
}

// CPSC's advice to shoppers who find a recalled product for sale online: "report the sale through saferproducts.gov",
// with a screenshot and a link to the listing (cpsc.gov, FAQs for Buying and Selling Products Online, read
// 2026-11-15). Its e-commerce team asks sites to take recalled and banned products down.
export const CPSC_REPORT_URL = 'https://www.saferproducts.gov/IncidentReporting';

// For the person who owns the thing: about to list it, give it away, or keep using a hand-me-down. A listing that is
// never posted needs no takedown. Same check, other words: what to do with it, and what the recall offers its owner.
const OWNER_TYPE_EN = {
  inclined_sleeper: 'Selling an inclined infant sleeper has been against federal law since November 2022, whatever its age. CPSC says never to use one for sleep.',
  crib_bumper: 'Selling a padded crib bumper has been against federal law since November 2022, whatever its age. CPSC\'s advice is nothing in a crib but a fitted sheet.',
  in_bed_sleeper: 'eBay and Facebook Marketplace don\'t allow loungers and nests, many have been recalled, and CPSC says never to use one for sleep.',
  drop_side_crib: 'CPSC says cribs made before June 28, 2011, drop-sides included, are very likely illegal to sell.',
};

// What to check on a possible type flag, said to the person holding the item (TYPE_COPY's advice speaks to a buyer).
const OWNER_ADVICE_EN = {
  inclined_sleeper: 'Many inclined sleepers are also recalled: look for the brand and model on its label.',
  crib_bumper: "Mesh liners aren't covered by the sales ban, but safe-sleep advice is still nothing in a crib but a fitted sheet. Check which one yours is.",
  in_bed_sleeper: 'Several loungers have been recalled: look for the brand and model on its label.',
  drop_side_crib: 'Check whether a side of the crib slides down, and the manufacture date on its label.',
};

const OWNER_TYPE_ES = {
  inclined_sleeper: 'Vender un dormidor inclinado para bebé es ilegal en EE. UU. desde noviembre de 2022, sin importar su antigüedad. La CPSC dice que nunca se use para dormir.',
  crib_bumper: 'Vender un protector acolchado para cuna es ilegal en EE. UU. desde noviembre de 2022, sin importar su antigüedad. El consejo de la CPSC es no poner nada en la cuna más que una sábana ajustable.',
  in_bed_sleeper: 'eBay y Facebook Marketplace no permiten nidos ni cojines para bebé, muchos han sido retirados del mercado, y la CPSC dice que nunca se usen para dormir.',
  drop_side_crib: 'La CPSC dice que las cunas fabricadas antes del 28 de junio de 2011, incluidas las de baranda corrediza, muy probablemente no se pueden vender legalmente.',
};
const OWNER_ADVICE_ES = {
  inclined_sleeper: 'Muchos dormidores inclinados también han sido retirados del mercado: busque la marca y el modelo en su etiqueta.',
  crib_bumper: 'Los protectores de malla no están prohibidos para la venta, pero el consejo de sueño seguro sigue siendo no poner nada en la cuna más que una sábana ajustable. Revise cuál es el suyo.',
  in_bed_sleeper: 'Varios nidos han sido retirados del mercado: busque la marca y el modelo en su etiqueta.',
  drop_side_crib: 'Revise si un lado de la cuna se desliza hacia abajo, y la fecha de fabricación en la etiqueta.',
};
const OWNER_TYPE = new Proxy(OWNER_TYPE_EN, { get: (en, k) => (getLang() === 'es' ? OWNER_TYPE_ES[k] : en[k]) });
const OWNER_ADVICE = new Proxy(OWNER_ADVICE_EN, { get: (en, k) => (getLang() === 'es' ? OWNER_ADVICE_ES[k] : en[k]) });

/** The one-line finding, said to the owner: no "listing", no "before you buy". */
function ownerVerdict(r) {
  if (r.kind !== 'recall' || !r.recall) return r.verdict || '';
  const product = productName(r.recall.product);
  const when = monthYear(r.recall.date);
  if (r.lookedUp) return tr(`Looks like the ${product}, ${r.recall.warning ? 'which CPSC warned people to stop using in' : 'recalled'} ${when}. Check the brand on yours.`,
    `Parece ser «${product}», ${r.recall.warning ? 'que la CPSC pidió dejar de usar en' : 'retirado del mercado en'} ${when}. Revise la marca del suyo.`);
  if (r.recall.warning) return r.verdict || '';
  return r.level === 'likely' ? tr(`Looks like the ${product}, recalled ${when}.`, `Parece ser «${product}», retirado del mercado en ${when}.`)
    : tr(`Same brand and kind as the ${product}, recalled ${when}. Its label shows which model you have.`, `Misma marca y tipo que «${product}», retirado del mercado en ${when}. Su etiqueta muestra qué modelo tiene.`);
}

/**
 * What the owner of a checked item reads: { verdict, foundBy, action, heading, lines }. `r` is a presented result
 * (present()), flagged or not. Advice, in CPSC's terms; never "safe to sell".
 */
export function ownerView(r) {
  return { verdict: ownerVerdict(r), evidence: ownerWords(r.evidence), foundBy: String(r.foundBy || '').replace(/The listing's words/g, 'The words you gave').replace(/Las palabras del anuncio/g, 'Las palabras que usted dio'), ...ownerAdvice(r) };
}

/** The cloud's one-line reason speaks of "the listing"; the owner gave a photo or typed words, and has no listing. */
function ownerWords(text) {
  const s = String(text || '')
    .replace(/\bthe listing(?:['’]s)? (?:photo|image|picture)\b/gi, 'your photo')
    .replace(/\bthe seller['’]s (?:photo|image|picture)s?\b/gi, 'your photo')
    .replace(/\bthe listing(?:['’]s)? (?:title|description|text|words|wording)\b/gi, 'what you entered')
    .replace(/\bthe listing['’]s\b/gi, 'its')
    .replace(/\bthe (?:item|product) for sale\b/gi, 'your item')
    .replace(/\bthe listing\b/gi, 'what you entered')
    .replace(/\bthis listing\b/gi, 'this item');
  return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

function ownerAdvice(r) {
  const heading = tr('Before you sell it or give it away', 'Antes de venderlo o regalarlo');
  if (r.kind === 'recall' && r.recall) {
    const c = r.recall;
    const sure = r.level === 'likely';
    const p = productName(c.product);
    if (c.warning) {
      return { heading, action: sure ? tr("Don't sell it or give it away. CPSC has told people to stop using this product.", 'No lo venda ni lo regale. La CPSC pidió dejar de usar este producto.') : tr('Check the brand before you sell it or give it away.', 'Revise la marca antes de venderlo o regalarlo.'),
        lines: [sure ? tr('Its seller did not recall it, so there is no refund to claim. CPSC warned the public itself.', 'Quien lo vendía no lo retiró del mercado, así que no hay reembolso que reclamar. La CPSC advirtió al público directamente.')
          : tr(`CPSC warned people to stop using the ${p}. If yours is that brand, don't pass it on.`, `La CPSC pidió dejar de usar «${p}». Si el suyo es de esa marca, no se lo pase a nadie.`),
          c.remedy ? tr(`CPSC says: ${c.remedy}`, `La CPSC dice: ${c.remedy}`) : ''].filter(Boolean) };
    }
    if (!sure || r.lookedUp) {
      return { heading, action: r.lookedUp ? tr('Check the brand and the label before you sell it or give it away: it looks like a recalled product.', 'Revise la marca y la etiqueta antes de venderlo o regalarlo: parece un producto retirado del mercado.')
        : tr('Check its label before you sell it or give it away.', 'Revise su etiqueta antes de venderlo o regalarlo.'),
        lines: [c.all ? tr(`Every unit of the ${p} is recalled. If that is what you have, don't pass it on.`, `Todas las unidades de «${p}» fueron retiradas del mercado. Si es lo que tiene, no se lo pase a nadie.`)
          : c.tell ? tr(`Which units are recalled: ${c.tell}`, `Qué unidades fueron retiradas: ${c.tell}`) : tr(`Some ${p} are recalled. The notice says which.`, `Algunas unidades de «${p}» fueron retiradas. El aviso dice cuáles.`),
          tr('CPSC says it is illegal to sell any recalled product.', 'La CPSC dice que es ilegal vender cualquier producto retirado del mercado.'),
          c.remedy ? tr(`If yours is recalled, the recall's remedy: ${c.remedy} The notice says how to claim it.`, `Si el suyo fue retirado, lo que ofrece el retiro: ${c.remedy} El aviso dice cómo reclamarlo.`) : ''].filter(Boolean) };
    }
    return { heading, action: tr("Don't sell it or give it away: it looks like a recalled product.", 'No lo venda ni lo regale: parece un producto retirado del mercado.'),
      lines: [tr("Stop using it unless the recall's fix has already been done. CPSC says it is illegal to sell any recalled product.", 'Deje de usarlo, a menos que ya se haya hecho la reparación del retiro. La CPSC dice que es ilegal vender cualquier producto retirado del mercado.'),
        c.remedy ? tr(`The recall's remedy: ${c.remedy} The notice says how to claim it.`, `Lo que ofrece el retiro: ${c.remedy} El aviso dice cómo reclamarlo.`) : tr('The notice says what the maker offers and how to claim it.', 'El aviso dice qué ofrece el fabricante y cómo reclamarlo.'),
        c.all ? '' : c.tell ? tr(`Which units are recalled: ${c.tell}`, `Qué unidades fueron retiradas: ${c.tell}`) : ''].filter(Boolean) };
  }
  if (r.kind === 'banned' && r.banned) {
    const rule = OWNER_TYPE[r.banned.key] || '';
    return r.level === 'likely'
      ? { heading, action: tr("Don't sell it or give it away.", 'No lo venda ni lo regale.'), lines: [rule, r.also ? tr(`It also looks like the ${productName(r.also.product)} (${r.also.warning ? 'CPSC warning' : 'recall'} ${r.also.number}): the notice says what its maker offers.`, `También parece ser «${productName(r.also.product)}» (${r.also.warning ? 'advertencia de la CPSC' : 'retiro'} ${r.also.number}): el aviso dice qué ofrece su fabricante.`) : ''].filter(Boolean) }
      : { heading, action: tr('Check what it is before you sell it or give it away.', 'Revise qué es antes de venderlo o regalarlo.'), lines: [OWNER_ADVICE[r.banned.key] || r.banned.advice, rule].filter(Boolean) };
  }
  return { heading, action: tr("No recall found for what we could read. That doesn't mean it's safe to pass on.", 'No encontramos un retiro del mercado para lo que pudimos leer. Eso no quiere decir que sea seguro pasárselo a alguien.'),
    lines: [tr('Many recalls cover only some models. Find the model number and date on its label and search them at SaferProducts.gov before you sell it or give it away.', 'Muchos retiros cubren solo algunos modelos. Busque el número de modelo y la fecha en la etiqueta y búsquelos en SaferProducts.gov antes de venderlo o regalarlo.')] };
}

// The rule a CPSC reader needs, per type: only the types whose sale the law itself rules out. Loungers and nests are
// not offered a report unless a recall names them, since older ones are not covered by a sales ban.
const SALE_RULE = {
  inclined_sleeper: 'Under the Safe Sleep for Babies Act of 2021 (Pub. L. 117-126) and 16 CFR 1310, inclined sleepers for infants may not be sold after November 12, 2022.',
  crib_bumper: 'Under the Safe Sleep for Babies Act of 2021 (Pub. L. 117-126) and 16 CFR 1309, padded crib bumpers may not be sold after November 12, 2022.',
  drop_side_crib: 'Full-size cribs sold since June 28, 2011 must meet the federal crib standard (16 CFR 1219), which drop-side designs do not meet.',
};

/** Whether the card offers a report to CPSC: only a likely flag, and only where the sale itself is ruled out. */
export function reportable(r) {
  if (r.level !== 'likely') return false;
  // A warning is not a recall: the report text's wording would not hold, so none is offered.
  if (r.kind === 'recall') return !!r.recall && !r.recall.warning;
  return r.kind === 'banned' && !!SALE_RULE[r.banned && r.banned.key];
}

/**
 * The text a shopper pastes into the SaferProducts.gov form. Factual and hedged ("appears to be"): it reports what the
 * listing shows, with the link CPSC asks for, and never states a verdict the tool can't make.
 */
export function cpscReport(r, seen = new Date()) {
  if (!reportable(r)) return '';
  const day = seen.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const what = r.kind === 'recall'
    ? `It appears to be the ${productName(r.recall.product)}, recalled ${monthYear(r.recall.date)} (CPSC recall ${r.recall.id}). The listing does not say the recall remedy has been applied.`
    : `It appears to be ${/^[aeiou]/i.test(TYPE_COPY_EN[r.banned.key].name) ? 'an' : 'a'} ${TYPE_COPY_EN[r.banned.key].name.toLowerCase()}. ${SALE_RULE[r.banned.key]}`;
  const head = r.kind === 'recall' ? 'A recalled product listed for sale online.' : 'An infant sleep product listed for sale online.';
  const facts = [
    listingLink(r) ? `Listing: ${listingLink(r)}` : 'Listing: see the attached screenshot.',
    `Title: ${r.listing.title}`,
    r.listing.price ? `Asking price: ${r.listing.price}` : '',
    `Seen on: ${day}`,
  ].filter(Boolean).join('\n');
  const why = [what, r.confirmed && r.evidence ? `What the listing shows: ${r.evidence}` : ''].filter(Boolean).join('\n');
  return [head, facts, why].join('\n\n');
}

/** A made-up listing on the practice page (still-recalled.web.app/try): nothing there to report or message. */
export function isPractice(r) {
  return /^https:\/\/still-recalled\.web\.app\/try\//.test((r.listing && r.listing.url) || '');
}

/** The listing's own address without search-page tracking: what a report or a message should point at. */
export function listingLink(r) {
  let u;
  try { u = new URL(r.listing.url); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  if (/(^|\.)ebay\.com$/.test(u.hostname) && /^\d{9,}$/.test(String(r.id))) return `https://www.ebay.com/itm/${r.id}`;
  return `${u.origin}${u.pathname}`;
}

/** Where "Ask the seller" goes: eBay opens its own message box on the listing; other sites keep it on the listing. */
export function sellerMessageUrl(r) {
  const link = listingLink(r);
  return link && /^https:\/\/www\.ebay\.com\/itm\//.test(link) ? `${link}?m2mOpen=1` : link;
}

function monthYear(isoDate) {
  const [y, m] = String(isoDate || '').split('-').map(Number);
  if (!y || !m) return tr('by CPSC', 'por la CPSC');
  return monthYearOf(isoDate);
}

/**
 * The stored result for one listing.
 * `decision`: output of decide or decideFinal. `listing`: { id, title, price, image, url }.
 * `how`: { words: true } | { device: true, cloud: { model } | null, cloudError? }.
 */
export function present(listing, decision, how = {}) {
  // A recall the listing's words did not lead to (lookup.mjs), and which question to the device's field guide did:
  // the cloud's (`asked`), or the device's own, from a brand read in the photo (`seenIt`).
  const via = decision.alsoRecall || (decision.lookedUp && decision.card) || null;
  const asked = via ? (how.lookups || []).find(l => l.found.includes(via.id)) : null;
  const askedFor = asked ? clip([asked.asked.brand, asked.asked.product].filter(Boolean).join(' '), 70) : '';
  const seenIt = via && !asked && how.seen && how.seen.id === via.id ? how.seen : null;
  const ledBy = seenIt
    ? tr(`${how.device ? 'Gemini Nano, on this device,' : 'Gemini'} read “${clip(seenIt.brand, 40)}” in the photo and asked the recall field guide on this device, which had it.`,
      `${how.device ? 'Gemini Nano, en este dispositivo,' : 'Gemini'} leyó “${clip(seenIt.brand, 40)}” en la foto y consultó la guía de retiros de este dispositivo, que lo tenía.`)
    : tr(`Gemini in the cloud named the product (${askedFor}) and asked the recall field guide on this device, which had it.`,
      `Gemini en la nube identificó el producto (${askedFor}) y consultó la guía de retiros de este dispositivo, que lo tenía.`);
  const viaNumber = via ? `${via.warning ? tr('warning', 'advertencia') : tr('recall', 'retiro')} ${via.id.replace(/^W/, '')}` : '';
  const base = {
    id: listing.id,
    listing: { title: listing.title, price: listing.price || '', image: listing.image || '', url: listing.url || '' },
    level: decision.level,
    kind: decision.level === 'none' ? null : decision.kind,
    why: decision.why || '',
    check: decision.check || '',
    evidence: decision.evidence || '',
    confirmed: !!decision.confirmed,
    // Where in the listing photo the cloud check saw it: { x, y, w, h } as fractions of the photo, or null.
    where: (decision.level !== 'none' && decision.where) || null,
    how: {
      device: !!how.device,
      deviceLevel: how.deviceLevel || (how.words ? 'words' : ''),
      // The built-in model's reading of "which units", and the cloud's answer on the recall, for comparing the two.
      candidate: how.candidate || '',     // the recall the word rules proposed, and how strongly
      deviceUnit: how.deviceUnit || '',
      cloudMatch: (how.cloud && how.cloud.answer && how.cloud.answer.matches_recall) || '',
      judgedInCloud: !!how.judgedInCloud,
      deviceError: how.deviceError || "",
      cloudModel: (how.cloud && how.cloud.model) || '',
      cloudError: how.cloudError || '',
      // What the cloud asked the device's field guide, and the recalls the device returned.
      lookups: (how.lookups || []).slice(0, 3),
      // The device's own question to its field guide: the brand read in the photo, and the recall it found.
      seen: how.seen ? { brand: clip(how.seen.brand, 40), id: how.seen.id } : null,
      // Sent to the cloud by the unnamed-sleep rule (shared/triage.mjs), whatever the built-in model said.
      unnamedSleep: !!how.unnamedSleep,
    },
    // Said on the card when the listing's own words did not lead to the recall.
    // Hedged on purpose: other makers sell look-alikes (a Kids2 rocking sleeper was once named as a Rock 'n Play), so
    // the line sends the reader to the brand on the label.
    foundBy: !(asked || seenIt) ? '' : decision.alsoRecall
      ? tr(`${decision.kind === 'recall' ? 'It may also be' : 'It may be'} the ${productName(via.product)}, ${via.warning ? 'which CPSC warned about in' : 'recalled'} ${monthYear(via.date)} (${viaNumber}). Other makers sell look-alikes, so check the brand on its label. The listing's words didn't name it: ${ledBy}`,
        `${decision.kind === 'recall' ? 'También puede ser' : 'Puede ser'} «${productName(via.product)}», ${via.warning ? 'sobre el que advirtió la CPSC en' : 'retirado del mercado en'} ${monthYear(via.date)} (${viaNumber}). Otros fabricantes venden productos parecidos, así que revise la marca en la etiqueta. Las palabras del anuncio no lo nombraban: ${ledBy}`)
      : tr(`The listing's words didn't lead to this recall. ${ledBy}`, `Las palabras del anuncio no llevaron a este retiro. ${ledBy}`),
    // A recall shown because the cloud named the product, not because the listing's words did.
    lookedUp: !!(decision.lookedUp && decision.card && decision.level !== 'none'),
    // On a type flag that stands on its own: the recall the cloud and the device's field guide pointed to as well.
    also: decision.alsoRecall && decision.level !== 'none' ? { id: via.id, number: via.id.replace(/^W/, ''), warning: !!via.warning, product: via.product, date: via.date, url: via.url } : null,
    recall: null,
    banned: null,
    checkedAt: new Date().toISOString(),
  };
  if (base.kind === 'recall' && decision.card) {
    const c = decision.card;
    // The remedy in full when the notice was fetched for the cloud check; otherwise the card's, cut back to whole words.
    const remedy = how.remedies && how.remedies[c.id] ? clip(how.remedies[c.id], 700) : remedyText(c.remedy);
    base.recall = { id: c.id, warning: !!c.warning, number: c.warning ? c.id.replace(/^W/, '') : c.id, date: c.date, product: c.product, title: c.title, hazard: c.hazard, remedy, url: c.url, image: c.image,
      // For the card's "which units" line and the label check.
      tell: c.tell || '', codes: (c.codes || []).slice(0, 14), more: !!c.more, from: c.from || 0, to: c.to || 0, all: !!c.all };
  }
  if (base.kind === 'banned' && decision.banned) {
    const t = TYPE_COPY[decision.banned.key] || {};
    base.banned = { key: decision.banned.key, name: t.name || decision.banned.label, risk: t.risk || '', advice: t.advice || '', source: SAFE_SLEEP_URL };
  }
  if (base.kind) {
    base.badge = badgeText(base);
    base.verdict = verdictLine(base);
    base.action = actionLine(base);
    base.question = sellerQuestion(base);
    base.sleep = sleepLine(`${listing.title || ''} ${base.recall ? base.recall.product : ''}`, false, base);
    base.messageUrl = sellerMessageUrl(base);
    base.report = cpscReport(base);
  }
  return base;
}

/** Order for display: likely before possible, recalls before types, then page order. */
export function byConcern(a, b) {
  const rank = r => (r.level === 'likely' ? 0 : r.level === 'possible' ? 1 : 2) * 2 + (r.kind === 'recall' ? 0 : 1);
  return rank(a) - rank(b) || (a.order ?? 0) - (b.order ?? 0);
}
