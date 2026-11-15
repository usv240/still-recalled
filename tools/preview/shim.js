// Development only: a stand-in for the extension APIs the side panel uses, fed from a fixture, so the panel can be
// looked at in an ordinary tab. ?fixture=mixed|lounger|checking|cosori|clear|none  &detail=<listing id>|first
(() => {
  const q = new URLSearchParams(location.search);
  const name = q.get('fixture') || 'mixed';
  const listeners = [];
  const store = (initial) => {
    let data = initial;
    return {
      async get(key) {
        const d = await data;
        if (key == null) return { ...d };
        const keys = Array.isArray(key) ? key : [key];
        return Object.fromEntries(keys.filter(k => k in d).map(k => [k, d[k]]));
      },
      async set(obj) { const d = await data; Object.assign(d, obj); },
      async remove(keys) { const d = await data; for (const k of [].concat(keys)) delete d[k]; },
    };
  };
  const session = (async () => {
    if (name === 'none') return {};
    const state = await (await fetch(`/tools/fixtures/${name}.json`)).json();
    const out = { 'tab:1': state };
    const detail = q.get('detail');
    if (detail) {
      const flagged = Object.values(state.results).filter(r => r.level !== 'none').sort((a, b) => (a.level === 'likely' ? 0 : 1) - (b.level === 'likely' ? 0 : 1));
      const id = detail === 'first' ? flagged[0].id : detail === 'banned' ? flagged.find(r => r.kind === 'banned').id : detail === 'recall' ? flagged.find(r => r.kind === 'recall').id : detail;
      out['focus:1'] = { id, at: Date.now() };
    }
    return out;
  })();
  const url = name === 'none' ? 'https://www.google.com/' : 'https://www.ebay.com/sch/i.html?_nkw=preview';
  window.chrome = {
    runtime: { getURL: p => `/extension/${p}`, sendMessage: async () => ({}), onMessage: { addListener() {} } },
    tabs: { query: async () => [{ id: 1, url }], sendMessage: async () => ({}), onActivated: { addListener() {} }, onUpdated: { addListener() {} } },
    storage: { session: store(session), local: store({}), onChanged: { addListener: fn => listeners.push(fn) } },
  };
  if (q.get('settings')) addEventListener('load', () => setTimeout(() => document.getElementById('settings').click(), 300));
})();
