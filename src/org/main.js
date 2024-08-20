/** main organizational server / broker / meta-data server */

const { env } = process;
const { args } = require('../lib/util');
const { proxy } = require('../lib/net');
const log = require('../lib/util').logpre('org');
const web = require('../lib/web');
const node = require('./node');
const store = require('../lib/store');
const crypto = require('../lib/crypto');
const adm_handler = require('express')();
const web_handler = require('express')();

const state = { };
Object.assign(state, {
  org_id: env['ORG_ID'] || args['org-id'],
  ssl_dir: env['SSL_DIR'] || args['ssl-dir'], // for customer supplied ssl key & cert files
  hub_host: env['HUB_HOST'] || args['hub-host'] || (args.prod ? "meta.rawh.ai" : "localhost"),
  hub_port: env['HUB_PORT'] || args['hub-port'] || (args.prod ? 443 : 8443 ),
  adm_port: args['adm-port'] || (args.prod ?  80 : 9000),
  web_port: args['web-port'] || (args.prod ? 443 : 9443),
  app_port: args['app-port'],
  proxy_port: env['PROXY_PORT'] || args['proxy-port'] || 6000,
  adm_handler: adm_handler
    .use(web.parse_query())
    .use(store.web_admin(state, 'meta'))
    .use(store.web_admin(state, 'meta')),
  web_handler,
  app_handler: web_handler
});

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start proxy listener (aka broker)
 * 5. start node services (app listeners, etc)
 * 5. start connection to rawh hub
 */

async function setup_data_store() {
  log({ initialize: 'data store'});
  state.meta = await store.open("data/org-meta");
  state.org_id = state.org_id || await state.meta.get("org-id", state.org_id);
  if (!state.org_id) {
    log({ exit_on_missing_org_id: state.org_id });
    process.exit();
  }
  log({ org_id: state.org_id });
  await state.meta.put("org-id", state.org_id);
}

async function setup_log_store() {
  log({ initialize: 'log store' });
  state.log = await store.open("data/org-logs");
  state.logr = function () {
    log('*', ...arguments);
    state.log.put(Date.now().toString(36), [...arguments]);
  };
}

async function setup_keys() {
  const { meta, logs } = state;
  state.org_keys = await meta.get("org-keys");
  if (!state.org_keys) {
    log('generating public/private key pair');
    state.org_keys = await crypto.createKeyPair();
    await meta.put("org-keys", state.org_keys);
  }
  state.hub_key_public = await meta.get("hub-key-public");
}

async function setup_web_handlers() {
  const static = require('serve-static')('web/hub', { index: ["index.html" ]});
  // localhost only admin / test interface
  adm_handler
    .use(web.parse_query())
    .use(store.web_admin(state, 'meta'))
    .use(store.web_admin(state, 'logs'))
    .use(static)
    .use(web.four_oh_four)
  // production https web interface
  web_handler
    .use(static)
    .use(web.four_oh_four)
    ;
}

async function start_org_proxy() {
  log({ initialize: "service_broker" });
  proxy(state.proxy_port);
}

async function setup_org_node() {
  node.init(state);
}

(async () => {
  await setup_data_store();
  await setup_log_store();
  await setup_keys();
  await setup_web_handlers();
  await start_org_proxy();
  await start_org_node();
  await web.start_web_listeners(state);
  await require('./hub-link').start_hub_connection(state);
  state.logr("org services started");
})();