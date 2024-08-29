/** main organizational server / broker / meta-data server */

const { args, env } = require('../lib/util');
const { proxy } = require('../lib/net');
const log = require('../lib/util').logpre('org');
const web = require('../lib/web');
const api = require('./web-api');
const node = require('./node');
const store = require('../lib/store');
const crypto = require('../lib/crypto');
const adm_handler = require('express')();
const app_handler = require('express')();
const web_handler = require('express')();

const state = { };
Object.assign(state, {
  org_id: env('ORG_ID') || args['org-id'],
  org_id: env('ORG_ID') || args['org-id'],
  ssl_dir: env('SSL_DIR') || args['ssl-dir'], // for customer supplied ssl key & cert files
  hub_host: env('HUB_HOST') || args['hub-host'] || (args.prod ? "meta.rawh.ai" : "localhost"),
  hub_port: env('HUB_PORT') || args['hub-port'] || (args.prod ? 443 : 8443 ),
  adm_port: args['adm-port'] || (args.prod ?  80 : 9001),
  app_port: args['adm-port'] || (args.prod ?  81 : 9000),
  web_port: args['web-port'] || (args.prod ? 443 : 9443),
  proxy_port: env('PROXY_PORT') || args['proxy-port'] || 6000,
  adm_handler: adm_handler
    .use(web.parse_query)
    .use(store.web_admin(state, 'meta'))
    .use(store.web_admin(state, 'logs')),
  web_handler,
  app_handler: web_handler,
  wss_handler: ws_handler,
  ws_handler: ws_handler
});

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start proxy listener (aka broker)
 * 5. start node services (app listeners, etc)
 * 6. start connection to rawh hub
 */

// directs web socket messages to the `web-api.js` handler
// look in `src/lib/web` for `ws_proxy_path()` as an
// example of how to handle a new web socket connection
function ws_handler(ws, req) {
  // todo: add a little auth here :)
  if (req.url === "/admin.api") {
    api.on_ws_connect(ws);
    ws.on("message", msg => api.on_ws_msg(ws, msg));
    ws.on("error", error => log({ ws_error: error }) )
  } else {
    log({ invalid_ws_url: req.url });
    ws.close();
  }
}

async function setup_data_store() {
  log({ initialize: 'data store'});
  state.meta = await store.open(`data/org/${state.org_id}/meta`);
  if (!state.org_id) {
    log({ exit_on_missing_org_id: state.org_id });
    process.exit();
  }
  log({ org_id: state.org_id });
  await state.meta.put("org-id", state.org_id);
}

async function setup_log_store() {
  log({ initialize: 'log store' });
  state.log = await store.open(`data/org/${state.org_id}/logs`);
  state.logr = function () {
    log(...arguments);
    state.log.put(Date.now().toString(36), [...arguments]);
  };
}

async function setup_keys() {
  const { meta, logs } = state;
  state.org_keys = await meta.get("org-keys");
  if (!state.org_keys) {
    log({ generating: 'public/private key pair' });
    state.org_keys = await crypto.createKeyPair();
    await meta.put("org-keys", state.org_keys);
  }
  state.hub_key_public = await meta.get("hub-key-public");
}

async function setup_web_handlers() {
  const static = require('serve-static')('web/hub', { index: ["index.html" ]});
  // localhost only admin api
  adm_handler
    .use(store.web_admin(state, 'meta'))
    .use(store.web_admin(state, 'logs'))
    .use(web.four_oh_four)
    ;
    // localhost http app test interface
  app_handler
    .use(web.parse_query)
    .use(node.web_handler)
    .use(api.web_handler)
    .use(static)
    .use(web.four_oh_four)
    ;
  // production https app production interface
  web_handler
    .use(web.parse_query)
    .use(node.web_handler)
    .use(api.web_handler)
    .use(static)
    .use(web.four_oh_four)
    ;
}

async function setup_org_proxy() {
  log({ initialize: "service_broker" });
  proxy(state.proxy_port);
}

async function setup_org_apis() {
  app.init(state);
  node.init(state);
  // inject wss handlers prior to `web.start_web_listeners()`
  // this proxy to node is needed so that proxied apps have
  // access to the broker api endpoint
  const wss_handler = web.ws_proxy_path(state.node, undefined, ws_handler);
  Object.assign(state, {
    wss_handler,
    ws_handler: wss_handler
  });
}

(async () => {
  await setup_data_store();
  await setup_log_store();
  await setup_keys();
  await setup_org_proxy();
  await setup_org_apis();
  await setup_web_handlers();
  await web.start_web_listeners(state);
  await require('./hub-link').start_hub_connection(state);
  state.logr({ started: "org services" });
})();