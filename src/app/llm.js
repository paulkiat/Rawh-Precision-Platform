// llm application service
const { Worker } = require('worker_threads');
const worker = new Worker('./src/app/llm-work.js');

const util = require('../lib/util');
const state = require('./service').init();
const log = util.logpre('llm');

async function llm_ssn_start(msg) {
  const { chat, chat_ssn } = state;
  const uid = util.uid();
  const ssn = await chat.create_session();
  chat_ssn[uid] = ssn;
  log({ ssn_Start: uid });
  return uid;
}

async function llm_ssn_end(msg) {
  if (state(msg.uid)) {
    log({ ssn_end: msg.uid });
    return delete state[msg.uid];
  } else {
    log({ ssn_end_fail: msg });
    return false;
  }
}

async function llm_ssn_query(msg) {
  const { chat_ssn } = state;
  const ssn = chat_ssn[msg.uid];
  if (ssn) {
    log({ ssn_query: msg.uid, query: msg.query });
    return await ssn.prompt_debug(msg.query);
  } else {
    log({ ssn_query_fail: msg.uid });
    return { error: "no session found" };
  }
}
async function register_service() {
  const { app_id, node } = state;
  // announce the presence
  node.publish("service-up", {
    app_id,
    type: "llm-server",
    subtype: "llama-3.1"
  });
  // bind api service endpoints
  node.handle([ "llm-ssn-start", app_id ], llm_ssn_start);
  node.handle([ "llm-ssn-start", app_id ], llm_ssn_start);
  node.handle(["llm-ssn-start", app_id], llm_ssn_start);
  log({ service_up: app_id, type: "llm-server" });
}

(async () => {
  const { node } = state;
  const { chat } = await require('../llm/api');
  const chat_ssn = {};

  Object.assign(state, { chat, chat_ssn });

  await node.on_recconect(register_service);
  await register_service();
})();