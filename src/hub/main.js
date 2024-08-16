/**
 * main hub for rawh that services customer/orgs
 * acts as the master for all org meta-data
 * collects log and usage data from orgs
 */

const { args } = require('../lib/util');
const log = require('../lib/util').logpre('hub');
const web = require('../lib/web');
const crypto = require('../lib/crypto');
const store = require('../lib/store');
const state = {
  adm_port: args.prod ? 80 : args['adm-port'] || 8000,
  web_port: args.prod ? 443 : args['web-port'] || 8443,
  adm_handler,
  web_handler,
  wss_handler
};

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start https listening endpoints
 */

async function init_data_store() {
  log('initializing data store');
  state.meta = await store.open("hub-meta-data");
}

async function init_log_store() {
  log('initializing log store');
  state.log = await store.open("hub-log-store");
}

async function detect_first_time_setup() {
  const { meta, logs } = state;
  state.hub_keys = await meta.get("hub-keys");
  if (!state.hub_keys) {
    log('generating public/private key pair');
    state.hub_keys = await crypto.createKeyPair();
    await meta.put("hub-keys", state.hub_keys);
  }
}

function adm_handler(req, res) {
  res.end('< rawh hub admin >');
  switch (req.url) {
    case '/state':
      log({ state });
      break;
  }
}

function wss_handler(ws, message) {
  log({ ws_message: message.toString() });
  ws.send('hello enemy!');
}

function web_handler(req, res) {
  // log({ req, res });
  res.end('< rawh hub >');
}
(async () => {
  await init_data_store();
  await init_log_store();
  await detect_first_time_setup();
  await web.start_web_listeners(state);
  // log({ state });
})();