/**
 * main hub for rawh that services customer/orgs
 * acts as the master for all org meta-data
 * collects log and usage data from orgs
*/

const { args } = require('../lib/util');
const log = require('../lib/util').logpre('hub');
const web = require('../lib/web');
const net = require('../lib/net');
const store = require('../lib/store');
const crypto = require('../lib/crypto');
const adm_handler = require('express')();
const web_handler = require('express')();

const state = { };
Object.assign(state, {
  adm_port: args['adm-port'] || (args.prod ? 80 : 8000),
  web_port: args['web-port'] || (args.prod ? 443 : 8443),
  adm_handler,
  web_handler,
  wss_handler: require('./org-link.js').setup(state)
});

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start http / https listening endpoints
 */

async function setup_data_store() {
  log({ initializing: 'data store' });
  state.meta = await store.open("data/hub-meta");
}

async function setup_log_store() {
  log({ initializing: 'log store' });
  state.log = await store.open("data/hub-logs");
}

async function setup_org_adm() {
  state.adm_org = require('./adm_org');
  state.adm_org.init(state);
}
async function setup_keys() {
  const { meta, logs } = state;
  state.hub_keys = await meta.get("hub-keys");
  if (!state.hub_keys) {
    log('generating public/private key pair');
    state.hub_keys = await crypto.createKeyPair();
    await meta.put("hub-keys", state.hub_keys);
  }
}

function setup_web_handlers() {
  const static = require('serve-static')('web/hub', { index: ["index.html" ]});
  // localhost only admin / test interface
  adm_handler
    .use(web.parse_query())
    .use(store.web_admin(state, 'meta'))
    .use(store.web_admin(state, 'logs'))
    .use(require('./adm_web').setup(state))
    .use(static)
    .use(web.four_oh_four)
  // production https web interface
  web_handler
    .use(static)
    .use(web.four_oh_four)
    ;
}

(async () => {
  log({ rawh_hub_addr: net.host_addrs() });
  await setup_data_store();
  await setup_log_store();
  await setup_keys();
  await setup_org_adm();
  await setup_web_handlers();
  await web.start_web_listeners(state);
  // log({ state });
})();