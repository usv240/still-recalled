// A person checks the AI's blind labels: open http://localhost:8766/tools/label-review.html with tools/collector.mjs
// running. Shows every "must flag" and "unclear" label, plus every "must not" label in a fixed order after them, with
// the listing's photo. Each answer is saved to tools/<set>-review.json; tools/eval-score.mjs uses the person's answer
// where there is one.
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

async function load(set) {
  const labelFiles = {
    eval: ['eval-labels.json'],
    fresh: ['fresh-labels-ebay.json', 'fresh-labels-craigslist.json'],
    third: ['third-labels-a.json', 'third-labels-b.json', 'third-labels-c.json'],
    fourth: ['fourth-labels-a.json', 'fourth-labels-b.json', 'fourth-labels-c.json'],
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
  const { all, labels, review } = await load(set);
  const list = $('#list');
  list.replaceChildren();
  const progress = () => {
    const n = Object.keys(review.answers).length;
    $('#progress').textContent = `${n} of ${all.length} reviewed`;
  };
  const save = () => fetch(`/save-as?name=${set}-review`, { method: 'POST', body: JSON.stringify({ reviewer: 'person', updated: new Date().toISOString(), answers: review.answers }) });
  for (const l of all) {
    const lab = labels[l.id];
    const buttons = CHOICES.map(([value, text]) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(review.answers[l.id] === value) }, text);
      b.addEventListener('click', async () => {
        review.answers[l.id] = value;
        for (const x of b.parentElement.children) x.setAttribute('aria-pressed', String(x === b));
        row.classList.add('done');
        progress();
        await save();
      });
      return b;
    });
    const row = el('article', { class: `row ${review.answers[l.id] ? 'done' : ''}` },
      el('img', { src: proxied(l.image), alt: '', loading: 'lazy' }),
      el('div', {},
        el('div', { class: 'title' }, l.title),
        el('div', { class: 'meta' }, [l.price, l.search, ''].filter(Boolean).join(' · '), el('a', { href: l.url, target: '_blank', rel: 'noopener' }, 'listing')),
        el('div', { class: 'label' },
          el('span', { class: `chip ${lab.should_warn}` }, lab.should_warn === 'yes' ? 'Must flag' : lab.should_warn === 'maybe' ? 'Unclear' : 'Must not flag'),
          [lab.item, lab.type, (lab.recall_ids || []).length ? `recall ${lab.recall_ids.join(', ')}` : null].filter(Boolean).join(' · '),
          el('div', {}, lab.note)),
        el('div', { class: 'choices' }, buttons)));
    list.append(row);
  }
  progress();
}
$('#set').addEventListener('change', render);
render();
