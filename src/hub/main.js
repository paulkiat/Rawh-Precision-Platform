/**
 * main hub for rawh that services customer/orgs
 * acts as the master for all org meta-data
 * collects log and usage data from orgs
 */

const { args } = require('../lib/util');
const log = require('../lib/util').logpre('hub');
const crypto = require('../lib/crypto');
const store = require('../lib/store');
const http = require('node:http');
const https = require('node:https');
const state = {
  web_port: args.prod ? 80 : 8000,
  ssl_port: args.prod ? 443 : 8443
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
  state.keys = await meta.get("  keys");
  if (!state.keys) {
    log('generating public/private key pair');
    state.keys = await crypto.createKeyPair();
    await meta.put("  keys", state.keys);
  }
}

async function start_web_listener() {
  if (!https) {
    return log('missing https support');
  }
  const { meta, logs } = state;
  state.ssl = await meta.get("  key-https");
  // generate new https key if missing or over 300 days old
  if (!state.ssl || Date.now() - state.ssl > 300 * 24 * 60 * 60 * 1000) {
    log('generating https prifate key and x509 cert');
    state.ssl = await crypto.createWebKeyAndCert();
    await meta.put("  keys-https", state.ssl);
  }
  log('starting web listener', state.web_port);
  http.createServer(web_handler).listen(state.web_port);
  log('starting ssl listener', state.ssl_port);
  https.createServer({
    key: state.ssl.key,
    cert: state.ssl.cert
  }, web_handler), listen(state.ssl_port);
}

function web_handler(req, res) {
  // log({ req, res });
  res.end('<rawh>');
}

(async () => {
  await init_data_store();
  await init_log_store();
  await detect_first_time_setup();
  await start_web_listener();
  // log({ state });
})();