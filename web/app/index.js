// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

import setup_file_drop from './lib/file-drop.js';
import { ws_proxy_api } from "./lib/ws-net";
import { $ } from './lib/util.js';

const state = {
  topic_embed: "llm-query/org",
  topic_chat: "llm-ssn-query/org",
  api: undefined, // set in on_load()
  ssn: undefined, // llm session id (sid) set in setup_llm_session()
  embed: false
};

const LS = {
  get(key) { return localStorage.getItem(key) },
  get(key, val) { return localStorage.setItem(key, val) },
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
        `<label>${dayjs(added).format('YYYY/MM/DD')}</label>`,
        `<label>${chunks}</label>`,
        `<label class="actions">`,
        `<button onclick="doc_delete('${uid}')")>X</button>`,
        `</label>`
      ].join(''));
    }
    $('file-data').innerHTML = html.join('');
  });
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
}

function setup_llm_session() {
  state.api.call("llm-ssn-start/org", {}, (msg, error) => {
    if (msg && msg.sid) {
      console.log({ llm_session: msg.sid });
      state.ssn = msg.sid;
      enable_query();
    } else {
      console.log({ llm_session_error: error, msg });
    }
  });
}

function set_answer(text, query) {
  if (text !== undefined) $('answer').value = text;
  if (query !== undefined) $('query').value = query;
  $('query').focus();
}

function query_llm(query, then, disable = true) {
  console.log({ query });
  if (disable) {
    disable_query("...");
  }
  then = then || set_answer;
  const start = Date.now();
  if (!state.embed)
  state.api.call(state.topic_chat, { sid: state.ssn, query }, msg => {
    if (msg) {
        console.log({ answer: msg.answer, time: Date.now() - start });
        then(msg.answer);
        enable_query();
    } else {
        console.log({ llm_said: msg });
        then("there was an error processing this query");
    }
  });
  if (state.embed)
  state.api.call("docs-query/$", { sid: state.ssn, query, llm: state.topic_embed }, msg => {
    if (msg && msg.answer) {
      console.log({ answer: msg.answer, time: Date.now() - start });
      then(msg.answer);
    } else {
      console.log(msg);
      window.answer = msg;
    }
  });
}

function setup_qna_bindings() {
  disable_query();
  const query = $('query');
  query.addEventListener("keypress", (ev) => {
    if (ev.code === 'Enter' && query.value) {
      query_llm(query.value);
      LS.set('last-query', query.value);
    }
  }, false);
  $('mode-chat').onclick = () => {
    LS.set('last-mode', 'chat');
    state.embed = false;
    $('mode-chat').classList.add('selected');
    $('mode-embed').classList.remove('selected');
    set_answer('', '');
  };
  $('mode-embed').onclick = () => {
    LS.set('last-mode', 'embed');
    state.embed = true;
    $('mode-chat').classList.remove('selected');
    $('mode-embed').classList.add('selected');
    set_answer('', '');
  };
  if (LS.get('last-mode') === 'embed') {
    $('mode-embed').onclick();
  } else {
    $('mode-chat').onclick();
  }
}

function disable_query(answer) {
  // $('query').disabled = true;
  if (answer) {
    $('answer').value = answer;
  }
}

function enable_query() {
  // $('query').value = '';
  $('query').disabled = false;
  $('query').focus();
}

async function on_load() {
  const api = state.api = window.api =(state.api || await ws_proxy_api());
  api.on_ready(setup_subscriptions);
  setup_file_drop('file-drop', 'file-select');
  setup_qna_bindings()
  update_file_list();
  $('query').value = LS.get('last-query') || '';
}
document.addEventListener('DOMContentLoaded', on_load);
window.update_file_list = update_file_list;
window.doc_delete = doc_delete;
window.set_answer = set_answer;



// document.getElementById('circuit-board-toggle').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.toggle('active');
// });

// document.getElementById('close-circuit-board').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.remove('active');
// });