// document storage, retrieval, and query library based on level-db (lib/store)
// storage also chunks and creates embeddings for each document with some level
// of scoping, which is usually by application id

const { args, env } = require('../lib/util');
const log = require('../lib/util').logpre('doc');
const state = require('./service').init();
const store = require('../lib/store').open(`data/app/${state.appid}/doc`);

Object.assign(state, {
  store
});

async function setup_node() {
  // re-connect the doc app when the proxy connection bounces
  node.on_reconnect(register_service);
}

// respond to rewquests looking for docs servicing an app
async function register_service() {
  const { app_id, net_addrs, node } = state;
  log({ register_app_docs: state.app_id });
  // announce presence
  node.publish("doc-up", {
    app_id,
    net_addrs,
    type: "rawh-level-v0"
  });
  // bind api service endpoints
  node.subscribe([app_id, "doc-load"], (msg, cid) => {
    
  });
}

(async () => {
  const { embed, token } = await require('../llm/api').init();
  const { node } = state;

  await register_service();
})();