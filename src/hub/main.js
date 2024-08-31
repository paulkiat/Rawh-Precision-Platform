/**
 * main hub for rawh that services customer/orgs
 * acts as the master for all org meta-data
 * collects log and usage data from orgs
*/

const { args } = require('../lib/util');
const log = require('../lib/util').logpre('hub');
const web = require('../lib/web');
const api = require('./org-api');
const net = require('../lib/net');
const store = require('../lib/store');
const crypto = require('../lib/crypto');
const app_handler = require('express')();
const web_handler = require('express')();

const state = { };
Object.assign(state, {
  app_port: args['app-port'] || (args.prod ? 80 : 8000),
  web_port: args['web-port'] || (args.prod ? 443 : 8443),
  app_handler,
  web_handler,
  org_api: api,
  org_link: require('./org-link.js'),
  wss_handler: ws_handler,
  ws_handler: ws_handler,
});

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start http / https listening endpoints
 */

// directs web socket messages to the `web-api.js` handler
// look in `src/lib/web` for `ws_proxy_path()` as an
// example of how to handle a new web socket connection
function ws_handler(ws, req) {
  // todo: add a little auth here :)
  if (req.url === "/") {
      state.org_link.setup(state, ws);
  } else if (req.url === "/admin.api") {
    api.on_ws_connect(ws);
    ws.on("message", msg => api.on_ws_msg(ws, msg));
    ws.on("error", error => log({ ws_error: error }) )
    } else {
  log({ invalid_ws_url: req.url, host: req.headers.host });
  ws.close();
  }
}

async function setup_data_store() {
  log({ initializing: 'data store' });
  state.meta = await store.open("data/hub/meta");
}

async function setup_log_store() {
  log({ initializing: 'log store' });
  state.log = await store.open("data/hub/logs");
}

async function setup_org_adm() {
  app.init(state);
}
async function setup_keys() {
  const { meta, logs } = state;
  state.hub_keys = await meta.get("hub-keys");
  if (!state.hub_keys) {
    log({ generating: "public/private key pair" });
    state.hub_keys = await crypto.createKeyPair();
    await meta.put("hub-keys", state.hub_keys);
  }
}

function setup_web_handlers() {
  const static = require('serve-static')('web/hub', { index: [ "index.html" ]});
  // localhost only admin interface
  app_handler
    .use(web.parse_query)
    .use(store.web_admin(state, 'meta'))
    .use(store.web_admin(state, 'logs'))
    .use(api.web_handler)
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