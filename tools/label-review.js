// A person checks the AI's blind labels: open http://localhost:8766/tools/label-review.html with tools/collector.mjs
// running. Shows every "must flag" and "unclear" label, plus every "must not" label in a fixed order after them, with
// the listing's photo. Each answer is saved to tools/<set>-review.json; tools/eval-score.mjs uses the person's answer
// where there is one.
//
// "Quick review" (the default) shows, across all four tests, only the labels that decide the published numbers: every
// "must flag" and "unclear" listing, and every "must not" listing that any of the three ways (word rules, built-in
// model, hybrid) flagged. Keys 1 to 4 answer the listing in view and move to the next one.
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
};
const CHOICES = [
  ['agree', 'AI label is right'],
  ['yes', 'Should be flagged'],
  ['no', 'Should not be flagged'],
  ['maybe', "Can't tell from this"],
];
const proxied = u => (u ? `/img?u=${encodeURIComponent(u)}` : '');

const SETS = ['eval', 'fresh', 'third', 'fourth', 'fifth', 'sixth'];

// The census sets (docs/accuracy.md, sections 29 and 31): every listing the word rules flagged, with the AI reviewer's
// yes / no / unclear. A person's answers save to tools/census-<site>-review.json.
async function loadCensus(set) {
  const site = set.replace('census-', '');
  const [flagged, labelled, review] = await Promise.all([
    fetch(`/tools/census-${site}-flagged.json`).then(r => r.json()),
    fetch(`/tools/census-${site}-labels.json`).then(r => r.json()),
    fetch(`/tools/${set}-review.json`).then(r => r.json()).catch(() => ({ answers: {} })),
  ]);
  const warn = { yes: 'yes', unclear: 'maybe', no: 'no' };
  const order = { yes: 0, maybe: 1, no: 2 };
  return flagged.flagged.filter(f => labelled.labels[f.id]).map(f => {
    const a = labelled.labels[f.id];
    return { ...f, search: f.city || '', set, review, lab: { should_warn: warn[a.is_it] || 'maybe', type: a.type, item: '', note: a.why + (a.photo_checked ? ' (photo checked)' : '') } };
  }).sort((x, y) => order[x.lab.should_warn] - order[y.lab.should_warn]);
}

async function loadQuick() {
  const parts = await Promise.all(SETS.map(async set => {
    const got = await load(set);
    const rows = f => fetch(`/tools/${set}-results-${f}.json`).then(r => r.json()).then(j => j.rows).catch(() => []);
    const [words, hybrid] = await Promise.all([rows('words'), rows('hybrid')]);
    const raised = new Set([...words, ...hybrid].filter(r => r.final !== 'none' || (r.device && r.device !== 'none')).map(r => r.id));
    return got.all.filter(l => got.labels[l.id].should_warn !== 'no' || raised.has(l.id)).map(l => ({ ...l, set, lab: got.labels[l.id], review: got.review }));
  }));
  const all = parts.flat();
  const order = { yes: 0, maybe: 1, no: 2 };
  all.sort((a, b) => order[a.lab.should_warn] - order[b.lab.should_warn]);
  return all;
}

async function load(set) {
  const labelFiles = {
    eval: ['eval-labels.json'],
    fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'],
    third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'],
    fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'],
    fifth: ['fifth-labels-a.json', 'fifth-labels-b.json', 'fifth-labels-c.json'],
    sixth: ['sixth-labels-a.json', 'sixth-labels-b.json', 'sixth-labels-c.json'],
  }[set];
  const [listings, ...labelSets] = await Promise.all([
    fetch(`/tools/${set}-listings.json`).then(r => r.json()),
    ...labelFiles.map(f => fetch(`/tools/${f}`).then(r => r.json()).catch(() => ({ labels: {} }))),
  ]);
  const labels = Object.assign({}, ...labelSets.map(s => s.labels));
  const review = await fetch(`/tools/${set}-review.json`).then(r => r.json()).catch(() => ({ answers: {} }));
  const all = Object.values(listings).flat().filter(l => labels[l.id]);
  const order = { yes: 0, maybe: 1, no: 2 };
  all.sort((a, b) => order[labels[a.id].should_warn] - order[labels[b.id].should_warn]);
  return { all, labels, review };
}

async function render() {
  const set = $('#set').value;
  const items = set === 'quick' ? await loadQuick() : set.startsWith('census-') ? await loadCensus(set)
    : await load(set).then(({ all, labels, review }) => all.map(l => ({ ...l, set, lab: labels[l.id], review })));
  const list = $('#list');
  list.replaceChildren();
  const progress = () => {
    const n = items.filter(l => l.review.answers[l.id]).length;
    $('#progress').textContent = `${n} of ${items.length} reviewed`;
  };
  const save = l => fetch(`/save-as?name=${l.set}-review`, { method: 'POST', body: JSON.stringify({ reviewer: 'person', updated: new Date().toISOString(), answers: l.review.answers }) });
  for (const l of items) {
    const lab = l.lab;
    const row = el('article', { class: `row ${l.review.answers[l.id] ? 'done' : ''}`, tabindex: '-1' });
    const answer = async value => {
      l.review.answers[l.id] = value;
      for (const x of row.querySelectorAll('.choices button')) x.setAttribute('aria-pressed', String(x.dataset.value === value));
      row.classList.add('done');
      progress();
      await save(l);
    };
    row.answer = answer;
    const buttons = CHOICES.map(([value, text], i) => {
      const b = el('button', { type: 'button', 'data-value': value, 'aria-pressed': String(l.review.answers[l.id] === value) }, `${i + 1} · ${text}`);
      b.addEventListener('click', () => answer(value));
      return b;
    });
    row.append(
      el('img', { src: proxied(l.image), alt: '', loading: 'lazy' }),
      el('div', {},
        el('div', { class: 'title' }, l.title),
        el('div', { class: 'meta' }, [l.price, l.search].filter(Boolean).join(' · '), ' · ', el('a', { href: l.url, target: '_blank', rel: 'noopener' }, 'listing')),
        el('div', { class: 'label' },
          el('span', { class: `chip ${lab.should_warn}` }, lab.should_warn === 'yes' ? 'Must flag' : lab.should_warn === 'maybe' ? 'Unclear' : 'Must not flag'),
          [lab.item, lab.type, (lab.recall_ids || []).length ? `recall ${lab.recall_ids.join(', ')}` : null].filter(Boolean).join(' · '),
          el('div', {}, lab.note)),
        el('div', { class: 'choices' }, buttons)));
    list.append(row);
  }
  progress();
  focusNext();
}

// The listing in view: the first one not yet answered, or the one last clicked.
let current = null;
function focusNext() {
  const rows = [...document.querySelectorAll('.row')];
  current = rows.find(r => !r.classList.contains('done')) || rows.at(-1) || null;
  if (current) { current.focus({ preventScroll: true }); current.scrollIntoView({ block: 'center' }); }
}
document.addEventListener('click', e => { const r = e.target.closest('.row'); if (r) current = r; });
document.addEventListener('keydown', async e => {
  const i = ['1', '2', '3', '4'].indexOf(e.key);
  if (i < 0 || !current || e.target.closest('select')) return;
  e.preventDefault();
  await current.answer(CHOICES[i][0]);
  focusNext();
});
$('#set').addEventListener('change', render);
render();
