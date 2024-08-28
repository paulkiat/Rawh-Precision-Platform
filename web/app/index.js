// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

import setup_file_drop from './lib/file-drop.js';
import { ws_proxy_api } from "./lib/ws-net";
import { $ } from './lib/util.js';
const state = {
  api: undefined, // set in on_load()
  ssn: undefined, // llm session id (sid) set in setup_llm_session()
};

function update_file_list() {
  state.api.call("doc-list/$", {}, (msg) => {
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
  state.api.call("doc-delete/$", {uid}, (msg) => {
    console.log({ doc_delete: msg });
    update_file_list();
  });
}

function setup_subscriptions() {
  state.api.subscribe("doc-loading/$", msg => {
    if (msg.state === 'ready') {
      update_file_list();
    }
  });
  state.api.subscribe("doc-delete/$", msg => {
    update_file_list();
  });
  setup_llm_session();
};

function setup_llm_session() {
  state.api.call("llm-ssn-start/org", {}, (msg, error) => {
    if (msg && msg.sid) {
      console.log({ llm_session: msg.sid });
      state.ssn = msg.sid;
    } else {
      console.log({ llm_session_error: error, msg });
    }
  });
}

function query_llm(query) {
  console.log({ query });
  state.api.call("llm-ssn-query/org", { sid: state.ssn, query }, msg => {
    if (msg) {
      $('answer').value = msg.answer;
      console.log({ answer: msg.answer });
    } else {
      console.log({ llm_said: msg });
    }
  });
}

function setup_qna_bindings() {
  const query = $('query');
  query.addEventListener("keypress", (ev) => {
    if (ev.code === 'Enter') {
      query_llm(query.value);
    }
  }, false);
}

async function on_load() {
  const api = state.api = (state.api || await ws_proxy_api());
  api.on_ready(setup_subscriptions);
  setup_file_drop('file-drop', 'file-select');
  setup_qna_bindings()
  update_file_list();
}
document.addEventListener('DOMContentLoaded', on_load);
window.doc_delete = doc_delete;
window.update_file_list = update_file_list;



// document.getElementById('circuit-board-toggle').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.toggle('active');
// });

// document.getElementById('close-circuit-board').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.remove('active');
// });