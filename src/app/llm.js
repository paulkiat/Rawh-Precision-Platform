// llm application service

const { fork } = require('child_process');
const worker = fork('./src/app/llm-work.js');
const util = require('../lib/util');
const { context } = require('zeromq/lib');
const { error } = require('console');
const state = require('./service').init();
const log = util.logpre('llm');
const { args, env } = util;

const ctx = {};
const once = {};
const settings = {
  gpu: env['LLM_GPU'] || args['gpu'] || 0,
  debug: env['DEBUG_LLM'] || args['debug'] || false,
  batch: env['LLM_BATCH'] || args['batch'],
  model: env['LLM_MODEL'] || args['model'],
  alpaca: env['LLM_ALPACA'] || args['alpaca'],
  context: env['LLM_CONTEXT'] || args['context'],
  threads: env['LLM_THREADS'] || args['threads'],
  mlock: (env('LLM_MLOCK') || args['mlock']) ? true : false,
  mmap: (env('LLM_MMAP') || args['mmap']) ? true : false,
};

async function start_worker() {
  worker.on("message", message => {
    const { mid, msg, topic, token, debug } = message;
    if (topic) {
        state.node.publish(topic, token);
        return;
    }
    if (debug) {
        log(debug);
        return;
    }
    const fn = once[mid];
    delete once[mid];
    if (fn) {
        fn(msg);
    } else {
        log({ missing_fn: mid, msg });
    }
  });

  worker.on("error", error => {
    log({ worker_error: error });
  });

  worker.on("exit", (code, signal) => {
    log({ worker_exit: code, signal, once });
    if (code === null) {
      log({ killing_worker: worker });
      worker.kill();
    }
    start_worker();
  });

  // intialize llm
  await call("init", {
    alpaca: settings.alpaca,
    threads: settings.threads,
    context: settings.context,
    batch: settings.batch,
    mlock: settings.mlock,
    mmap: settings.mmap,
    model: settings.model,
    gpu: settings.gpu,
  });
}

function call(cmd, msg = {}) {
  return new Promise(resolve => {
    const mid = util.uid();
    once[mid] = resolve;
    ctx.worker.send({ mid, cmd, msg, debug: settings.debug });
  });
}

async function llm_ssn_keepalive(msg) {
  const sid = await call("ssn-keepalive", { sid: msg.sid });
  if (settings.debug) {
    // log({ ssn_keepalive: sid });
  }
  return sid;
}

async function llm_ssn_start(msg) {
  const { node } = state;
  const reply = await call("ssn-start", {});
  // listen for browser heartbeats to keep session alive
  // if the browser tab closes or refreshes, this stops
  // which lets us remove the context/session so they can GC
  node.subscribe(`~${reply.sid}`, llm_ssn_keepalive, 30);
  return reply;
}

async function llm_ssn_end(msg) {
  const ok = await call("ssn-end", { sid: msg.sid });
  return ok;
}

async function llm_ssn_query(msg) {
  return await call("ssn-query", msg);
}

async function llm_query(msg) {
  return await call("query", msg);
}

async function register_service() {
  const { app_id, node } = state;
  // announce the presence
  node.publish("service-up", {
    app_id,
    type: "llm-server",
    subtype: "llama-2"
  });
  // bind api service endpoints
  // node.handle([ "llm-ssn-keepalive", app_id ], llm_ssn_keepalive);
  node.handle([ "llm-ssn-start", app_id ], llm_ssn_start);
  node.handle([ "llm-ssn-query", app_id ], llm_ssn_query);
  node.handle([ "llm-ssn-end", app_id ], llm_ssn_end);
  node.handle([ "llm-query", app_id ], llm_query);

  log({ service_up: app_id, type: "llm-server" });
}

(async () => {
  const { node } = state;
  const { chat } = await require('../llm/api');
  const chat_ssn = {};

  Object.assign(state, { chat, chat_ssn });

  await node.on_recconect(register_service);
  await start_worker();
  await register_service();
})();