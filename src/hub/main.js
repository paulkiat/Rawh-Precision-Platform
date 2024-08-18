/**
 * main hub for rawh that services customer/orgs
 * acts as the master for all org meta-data
 * collects log and usage data from orgs
*/

const { args } = require('../lib/util');
const log = require('../lib/util').logpre('hub');
const web = require('../lib/web');
const net = require('../lib/net');
const crypto = require('../lib/crypto');
const store = require('../lib/store');

const state = { };
Object.assign(state, {
  adm_port: args['adm-port'] || (args.prod ? 80 : 8000),
  web_port: args['web-port'] || (args.prod ? 443 : 8443),
  adm_handler: web.chain([
    store.web_admin(state, 'meta'),
    store.web_admin(state, 'logs'),
    require('./adm_web').setup(state)
  ]),
  web_handler,
  wss_handler: require('./org-link.js').setup(state)
});

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start https listening endpoints
 */

async function initialize_data_store() {
  log('initializing data store');
  state.meta = await store.open("data/hub-meta");
}

async function initialize_log_store() {
  log('initializing log store');
  state.log = await store.open("data/hub-logs");
}

async function initialize_org_adm() {
  state.adm_org = require('./adm_org');
  state.adm_org.init(state);
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

function web_handler(req, res) {
  // log({ req, res });
  res.end('< rawh hub >');
}

(async () => {
  log('rawh hub addr', net.host_addrs());
  await initialize_data_store();
  await initialize_log_store();
  await detect_first_time_setup();
  await initialize_org_adm();
  await web.start_web_listeners(state);
  // log({ state });
})();