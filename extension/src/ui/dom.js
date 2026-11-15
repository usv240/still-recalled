// A tiny element builder. Strings always become text nodes: listing titles come from marketplace pages and are
// never parsed as HTML.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Copy text and flip the button's label to "Copied" for a moment. */
export async function copyWithFeedback(button, text, labelEl) {
  try {
    await navigator.clipboard.writeText(text);
    const before = labelEl.textContent;
    labelEl.textContent = 'Copied';
    button.dataset.state = 'done';
    setTimeout(() => { labelEl.textContent = before; delete button.dataset.state; }, 1600);
  } catch {
    labelEl.textContent = 'Select the text to copy';
  }
}

/** Only http(s) links from results are ever used as hrefs. */
export const safeUrl = u => (/^https:\/\//i.test(String(u || '')) ? u : null);
