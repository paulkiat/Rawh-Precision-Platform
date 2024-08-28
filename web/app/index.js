// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

import setup_file_drop from './lib/file-drop.js';
import { ws_proxy_api } from "./lib/ws-net";
import { $ } from './lib/util.js';

function update_file_list() {
  proxy_api.call("doc-list/$", {}, (msg) => {
    if (!Array.isArray(msg)) {
      return;
    }
    const html = [];
    for (let rec of msg) {
      const { uid, name, type, state, added, chunks, length } = rec[1];
      html.push([
        `<label>${name}</label>`,
        `<label>${length}</label>`,
        `<label>${added}</label>`,
        `<label>${chunks}</label>`,
        `<label class="actions">`,
        `<button onclick="doc_delete('${uid}')")>X</button>`,
        `</label>`
      ].join(''))
    }
    $('file-data').innerHTML = html.join('');
  })
}

function doc_delete(uid) {
  proxy_api.call("doc-delete/$", {uid}, (msg) => {
    console.log({ doc_delete: msg });
    update_file_list();
  });
}

function setup_subscriptions() {
  proxy_api.subscribe("doc-loading/$", msg => {
    if (msg.state === 'ready') {
      update_file_list();
    }
  });
  proxy_api.subscribe("doc-delete/$", msg => {
    update_file_list();
  });
};

// document.getElementById('circuit-board-toggle').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.toggle('active');
// });

// document.getElementById('close-circuit-board').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.remove('active');
// });

async function on_load() {
  const api = window.proxy_api = (window.proxy_api || await ws_proxy_api());
  api.on_ready(setup_subscriptions);
  setup_file_drop('file-drop', 'file-select');
  update_file_list();
}
document.addEventListener('DOMContentLoaded', on_load);
window.doc_delete = doc_delete;
window.update_file_list = update_file_list;