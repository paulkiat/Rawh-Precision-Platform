/** main organizational server / broker / meta-data server */

const { env } = process;
const { args } = require('../lib/util');
const { server, client } = require('../lib/net').zmq;
const log = require('../lib/util').logpre('org');
const web = require('../lib/web');
const crypto = require('../lib/crypto');
const store = require('../lib/store');
const state = { };

Object.assign(state, {
  org_id: env['ORG_ID'] || args['org-id'],
  hub_host: env['HUB_HOST'] || args['hub-host'] || (args.prod ? "meta.rawh.ai" : "localhost"),
  hub_port: env['HUB_PORT'] || args['hub-port'] || (args.prod ? 443 : 8443 ),
  adm_port: ['adm-port'] || (args.prod ?  80 : 9000),
  web_port: ['web-port'] || (args.prod ? 443 : 9443),
  adm_handler: web.chain([
    store.web_admin(state, 'meta'),
    store.web_admin(state, 'logs'),
    adm_handler
  ]),
});

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. starts broker listener
 * 5. start hub connection
 */
async function init_data_store() {
  log('initializing data store');
  state.meta = await store.open("data/org-meta");
  state.org_id = await state.meta.get("org-id", state.org_id);
  if (!state.org_id) {
    log({ exit_on_missing_org_id: state.org_id });
    process.exit();
  } else {
    log({ org_id: state.org_id });
    await state.meta.put("org-id", state.org_id);
  }
}

async function init_log_store() {
  log('initializing log store');
  state.log = await store.open("data/org-logs");
  state.logr = function () {
    log('*', ...arguments);
    state.log.put(Date.now().toString(36), [...arguments]);
  };
}

async function detect_first_time_setup() {
  const { meta, logs } = state;
  state.org_keys = await meta.get("org-keys");
  if (!state.org_keys) {
    log('generating public/private key pair');
    state.org_keys = await crypto.createKeyPair();
    await meta.put("org-keys", state.org_keys);
  }
}

async function start_broker_listener() {
  log('start broker listener');
  server(3000, async req => {
    log(`<<< ${JSON.stringify(req)}`);
    req.ok = 1;
    return req;
  });
}

async function test_broker() {
  const client1 = client("127.0.0.1", 3000);
  const client2 = client("127.0.0.1", 3000);
  
  // test clients
  for (let i = 0; i < 0; i++) {

    const r1 = await client1.call({ seed: 1, i });
    const r2 = await client2.call({ seed: 2, i });

    log(`>>>`, { r1, r2 });
  }
}

function adm_handler(chain, pass) {
  const { req, res, url, qry } = chain;
  log({ web_request: req.url });
  res.end("< rawh org admin >");
}

(async () => {
  await init_data_store();
  await init_log_store();
  await detect_first_time_setup();
  await web.start_web_listeners(state);
  await start_broker_listener();
  await require('./hub-link').start_hub_connection(state);
  if (args.test) await test_broker();
  state.logr("service started");
})();