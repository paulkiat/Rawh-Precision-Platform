// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

import session from "./lib/session.js";
import setup_file_drop from './lib/file-drop.js';
import { ws_proxy_api } from "./lib/ws-net";
import { $, LS, on_key, uid } from './lib/util.js';

const state = {
  topic_embed: "llm-query/org",
  topic_chat: "llm-ssn-query/org",
  api: undefined, // set in on_load()
  embed: false,
  // max_tokens: 4096,
  // min_match: 0.75,
  // max_tokens: 8192,
  // min_match: 0.5,
};

function update_file_list() {
  state.api.call("doc-list/$", {}, (msg) => {
    if (!Array.isArray(msg)) {
      return;
    }
    const html = [];
    for (let rec of msg) {
      const { uid, name, type, state, added, chunks, length } = rec[1];
      const title = [
          `length: ${length}`,
          `chunks: ${chunks}`,
          `added: ${dayjs(added).format('YYYY/MM/DD')}`
      ].join("\n");
      html.push([
          `<label title=${title}>${name}</label>`,
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

function setup_session() {
  setup_subscriptions();
  session_init(state.api, session_dead, session_uid);
  setTimeout(() => {
    $('username').value = session.username;
  }, 100);
}

function session_dead(error) {
  console.log({ DEAD_SESSION: error });
  setTimeout(() => {
    // alert(error || "you have been logged out");
    window.location = "/";
  }, 2000);
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
      state.llm_ssn = msg.sid;
      enable_query();
      // heartbeat ~ssn topic to keep from being cleaned up
      // this will end when the page or tab reloads or is closed
      setInterval(() => {
        state.api.publish(`~${msg.sid}`, { sid: msg.sid })
      }, 10000);
    } else {
      console.log({ llm_session_error: error, msg });
    }
  });
}

function set_answer(text, query) {
  if (text !== undefined && state.output) {
    state.output.innerText = text;
    const hwrap = $('hwrap');
    hwrap.scrollTop = hwrap.scrollHeight;
  }
  if (query !== undefined) $('query').value = query;
  $('query').focus();
}

function append_history(label, text, clazz) {
  const elid = uid();
  const hlog = $('chat-history');
  const hwrap = $('hwrap');
  hlog.innerHTML += [
      `<div class="label ${clazz}">${label}</div>`,
      `<div id="${elid} class="text ${clazz}">${text}</div>`,
  ].join('');
  hwrap.scrollTop = hwrap.scrollHeight;
  state.output = $(elid);
  return elid;
}

// Make append_history available globally
window.ah = append_history;


function query_llm(query, then, disable = true) {
  console.log({ query });
  if (disable) {
    disable_query("...");
  }
  then = then || set_answer;
  const start = Date.now();
  const rand = Math.round(Math.random() * 0xffffffff).toString(36);
  const topic = `~${start.toString(36)}:${rand}`;
  // ephemeral ~topic for receiving llm token strema
  const tokens = [];
  state.api.subscribe(topic, (token) => {
    tokens.push(token);
    set_answer(tokens.join(''));
  }, 120);
  append_history("user", query, "query");
  append_history("ai", "thinking...", "ai");
  // embed and chat nodes are different endpoints
  if (state.embed) {
    query_embed(query, topic, start, then);
  } else {
    query_chat(query, topic, start, then);
  }
}

function query_chat(query, topic, start, then) {
  state.api.call(state.topic_chat, {
       sid: state.llm_ssn,
       query,
       topic,
  }, msg => {
      if (msg) {
          console.log({ answer: msg.answer, time: Date.now() - start });
          then(msg.answer);
          enable_query();
      } else {
          console.log({ llm_said: msg });
          then("there was an error processing this query");
      }
  });
}

function query_embed(query, topic, start, then) {
  state.api.call("docs-query/$", {
       query,
       topic,
       llm: state.topic_embed, 
       min_match: state.min_match,
       max_tokens: state.max_tokens,
  }, msg => {
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
  on_key('Enter', query, () => {
    query_llm(query.value);
    LS.set('last-query', query.value);
  });
  $('mode-chat').onclick = () => {
    LS.set('last-mode', 'chat');
    state.embed = false;
    $('mode-chat').classList.add('selected');
    $('mode-embed').classList.remove('selected');
  };
  $('mode-embed').onclick = () => {
    LS.set('last-mode', 'embed');
    state.embed = true;
    $('mode-chat').classList.remove('selected');
    $('mode-embed').classList.add('selected');
  };
  if (LS.get('last-mode') === 'embed') {
    $('mode-embed').onclick();
  } else {
    $('mode-chat').onclick();
  }
}

function disable_query(answer) {
  // $('query').disabled = true;
  // if (answer) {
  //   $('answer').value = answer;
  // }
}

function enable_query() {
  // $('query').value = '';
  $('query').disabled = false;
  $('query').focus();
}

async function on_load() {
  const api = state.api = window.api =(state.api || await ws_proxy_api());
  api.on_ready(setup_session);
  setup_file_drop('file-drop', 'file-select');
  setup_qna_bindings();
  update_file_list();
  $('query').value = LS.get('last-query') || '';
}
document.addEventListener('DOMContentLoaded', on_load);
window.update_file_list = update_file_list;
window.doc_delete = doc_delete;



// document.getElementById('circuit-board-toggle').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.toggle('active');
// });

// document.getElementById('close-circuit-board').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.remove('active');
// });