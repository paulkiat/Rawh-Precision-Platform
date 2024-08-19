/** main organizational server / broker / meta-data server */

const { env } = process;
const { args } = require('../lib/util');
const { proxy } = require('../lib/net');
const log = require('../lib/util').logpre('org');
const web = require('../lib/web');
const crypto = require('../lib/crypto');
const store = require('../lib/store');
const web_handler = require('express')();

const state = { };
Object.assign(state, {
  org_id: env['ORG_ID'] || args['org-id'],
  ssl_dir: env['SSL_DIR'] || args['ssl-dir'], // for customer supplied ssl key & cert files
  hub_host: env['HUB_HOST'] || args['hub-host'] || (args.prod ? "meta.rawh.ai" : "localhost"),
  hub_port: env['HUB_PORT'] || args['hub-port'] || (args.prod ? 443 : 8443 ),
  adm_port: ['adm-port'] || (args.prod ?  80 : 9000),
  web_port: ['web-port'] || (args.prod ? 443 : 9443),
  adm_handler: web.chain([
    store.web_admin(state, 'meta'),
    store.web_admin(state, 'logs'),
    adm_handler
  ]),
  web_handler
});

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start broker/proxy listener
 * 5. start hub connection
 */
async function initialize_data_store() {
  log('initializing data store');
  state.meta = await store.open("data/org-meta");
  state.org_id = state.org_id || await state.meta.get("org-id", state.org_id);
  if (!state.org_id) {
    log({ exit_on_missing_org_id: state.org_id });
    process.exit();
  }
  log({ org_id: state.org_id });
  await state.meta.put("org-id", state.org_id);
}

async function initialize_log_store() {
  log('initializing log store');
  state.log = await store.open("data/org-logs");
  state.logr = function () {
    log('*', ...arguments);
    state.log.put(Date.now().toString(36), [...arguments]);
  };
}

async function initialize_keys() {
  const { meta, logs } = state;
  state.org_keys = await meta.get("org-keys");
  if (!state.org_keys) {
    log('generating public/private key pair');
    state.org_keys = await crypto.createKeyPair();
    await meta.put("org-keys", state.org_keys);
  }
  state.hub_key_public = await meta.get("hub-key-public");
}

async function setup_express() {
  web_handler
    // .use(require('compression'))
    .use(require('serve-static')('web/org', { index: ['index.html'] }))
    .use((req, res) => {
      res.writeHead(404, { 'Content-type': 'text/plain' });
      res.end('404  Not Found');
    })
    ;
}

async function start_service_broker() {
  log('starting service broker');
  proxy();
}

function adm_handler(chain, pass) {
  const { req, res, url, qry } = chain;
  log({ web_request: req.url });
  res.end("< rawh org admin >");
}

(async () => {
  await initialize_data_store();
  await initialize_log_store();
  await initialize_keys();
  await setup_express();
  await web.start_web_listeners(state);
  await start_service_broker();
  await require('./hub-link').start_hub_connection(state);
  state.logr("org services started");
})();