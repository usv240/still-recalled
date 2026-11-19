// The page that opens once, on install: what Still Recalled does, and whether this computer has the built-in model.
import { h } from './ui/dom.js';
import { mark } from './ui/icons.js';
import { deviceModel, deviceStatus } from './ai.js';

document.getElementById('mark').append(mark(20));
const $model = document.getElementById('model');

async function show() {
  const status = await deviceStatus();
  if (status === 'available') {
    $model.replaceChildren(h('div', { class: 'status is-ready' },
      h('span', { class: 'status-dot' }), h('div', {}, h('h3', {}, 'Gemini Nano is ready on this computer'),
        h('p', {}, 'Photos are checked here, privately and at no cost. Only flagged listings go to the cloud.'))));
    return;
  }
  if (status === 'downloadable' || status === 'downloading') {
    const label = h('span', {}, status === 'downloading' ? 'Downloading…' : 'Download Gemini Nano');
    const bar = h('div', { class: 'meter', hidden: true }, h('div', { class: 'meter-fill' }));
    const btn = h('button', { class: 'btn btn-secondary', type: 'button' }, label);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      bar.hidden = false;
      try {
        await deviceModel({}).initializeDeviceModel(p => {
          label.textContent = `Downloading ${Math.round(p * 100)}%`;
          bar.firstChild.style.transform = `scaleX(${p})`;
        });
        show();
      } catch {
        label.textContent = 'Download failed. Try again';
        btn.disabled = false;
      }
    });
    $model.replaceChildren(h('div', { class: 'status' },
      h('span', { class: 'status-dot is-wait' }), h('div', {},
        h('h3', {}, 'One step left: Chrome’s built-in model'),
        h('p', {}, 'Gemini Nano checks listing photos on this computer. Chrome downloads it once (a few GB). Until then, listings are matched by their words, and flagged ones are checked in the cloud.'),
        bar, btn)));
    return;
  }
  $model.replaceChildren(h('div', { class: 'status' },
    h('span', { class: 'status-dot is-off' }), h('div', {},
      h('h3', {}, 'This computer can’t run Chrome’s built-in model'),
      h('p', {}, 'Still Recalled still works: listings are matched by their words against every recall, and the ones that match are checked by Gemini in the cloud, with their photos.'))));
}
show();
