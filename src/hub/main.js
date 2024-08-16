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
  adm_port: args['adm-port'] || (args.prod ? 80 : 8000),
  web_port: args['web-port'] || (args.prod ? 443 : 8443),
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
  state.meta = await store.open("data/hub-meta");
}

async function init_log_store() {
  log('initializing log store');
  state.log = await store.open("data/hub-logs");
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
  const { meta, logs } = state;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const qry = Object.fromEntries(url.searchParams.entries());
  res.end('< rawh hub admin >');
  switch (url.pathname) {
    case '/state':
      log({ state });
      break;
    case '/meta.get':
      meta.get(qry.key).then(rec => {
        log(rec);
      })
      break;
    case '/meta.keys':
      meta.list({ ...qry, keys: true, values: false, }).then(rec => {
        log(rec.map(a => a[0]));
      });
      break;
    case '/meta.recs':
      meta.list({ ...qry, keys: true, values: false, }).then(recs => {
        for (let rec of recs) {
          log(rec);
        }
        log(rec.map(a => a[0]));
      });
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