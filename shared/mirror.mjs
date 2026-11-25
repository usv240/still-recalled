// The second source for new CPSC recalls: tools/recall-mirror.mjs copies CPSC's recall API, unchanged, to this repo's
// recall-mirror branch once a day (.github/workflows/recall-mirror.yml). Read only when www.saferproducts.gov can't be
// reached, through two CDNs in turn. The records are CPSC's own; a field-guide entry still has to fit the notice
// (shared/fieldguide.mjs), and a recall can only ever add a warning, never clear one.
export const MIRROR_URLS = [
  'https://cdn.jsdelivr.net/gh/usv240/still-recalled@recall-mirror/recalls.json',
  'https://raw.githubusercontent.com/usv240/still-recalled/recall-mirror/recalls.json',
];

/** CPSC records dated `from` (YYYY-MM-DD) or later, from the first mirror that answers. Throws when none does. */
export async function mirrorRecalls(from, { fetchImpl = fetch, urls = MIRROR_URLS } = {}) {
  let last;
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`mirror ${res.status}`);
      const all = await res.json();
      if (!Array.isArray(all)) throw new Error('mirror: not a list');
      return all.filter(r => r && r.RecallNumber && String(r.RecallDate || '').slice(0, 10) >= from);
    } catch (e) { last = e; }
  }
  throw last || new Error('no mirror');
}
