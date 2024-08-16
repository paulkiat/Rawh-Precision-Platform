/**
 * main hub for rawh that services customer/orgs
 * acts as the master for all org meta-data
 * collects log and usage data from orgs
 */

const { args } = require('../lib/util');
const log = require('../lib/util').logpre('hub');
const crypto = require('../lib/crypto');
const store = require('../lib/store');
const state = {
  web_port: args.prod ? 80 : args['web-port'] || 8000,
  ssl_port: args.prod ? 443 : args['ssl-port'] || 8443
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



(async () => {
  await init_data_store();
  await init_log_store();
  await detect_first_time_setup();
  await require('./web').start_web_listeners(state);
  // log({ state });
})();