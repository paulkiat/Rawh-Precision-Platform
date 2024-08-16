/** main organizational server / broker / meta-data server */

const { args } = require('../lib/util');
const { server, client } = require('../lib/net').zmq;
const log = require('../lib/util').logpre('org');
const crypto = require('../lib/crypto');
const store = require('../lib/store');
const state = {};

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
  state.meta = await store.open("org-meta-data");
  state.org_id = await state.meta.get("org-id", process.env['ORG-ID']);
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
  state.log = await store.open("org-log-store");
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

(async () => {
  await init_data_store();
  await init_log_store();
  await detect_first_time_setup();
  await start_broker_listener();
  await require('./hub-link').start_hub_connection(state);
  if (args.test) await test_broker();
})();