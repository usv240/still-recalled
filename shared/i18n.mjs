// English and Spanish for what a shopper reads (0.16.0). An AI persona walkthrough of a family that speaks Spanish at
// home found every screen in English. The Spanish was written by an AI (Claude) and has not yet been reviewed by a
// native-speaking health educator; docs/accuracy.md says so.
//
// One language at a time, for the whole page or extension: the web page sets it from its switch, ?lang=es, or the
// browser's language; the extension follows the browser. Strings are written in place as tr(english, spanish), so
// each sentence and its translation sit side by side and cannot drift apart.
let lang = 'en';
try { if (typeof navigator !== 'undefined' && /^es\b/i.test(navigator.language || '')) lang = 'es'; } catch { /* no navigator */ }

export const getLang = () => lang;
export function setLang(l) { lang = l === 'es' ? 'es' : 'en'; }
/** The string in the current language. A missing Spanish falls back to the English. */
export const tr = (en, es) => (lang === 'es' && es ? es : en);

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "July 2026" / "julio de 2026", from an ISO date, without Intl (the Android sandbox may have no locale data). */
export function monthYearOf(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const i = Number(m[2]) - 1;
  return lang === 'es' ? `${MONTHS_ES[i]} de ${m[1]}` : `${MONTHS_EN[i]} ${m[1]}`;
}

/** "Nov 19, 2026" / "19 nov 2026". */
export function shortDateOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const i = Number(m[2]) - 1, d = Number(m[3]);
  return lang === 'es' ? `${d} ${MONTHS_ES[i].slice(0, 3)} ${m[1]}` : `${MONTHS_EN[i].slice(0, 3)} ${d}, ${m[1]}`;
}
