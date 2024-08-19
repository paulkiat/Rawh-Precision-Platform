const { env } = process;
const { args } = require('../lib/util');
const { proxy } = require('../lib/net');
const log = require('../lib/util').logpre('app');
const net = require('../lib/net');
const web = require('../lib/web');
const app_handler = require('express')();

const state = {};
Object.assign(state, {
  app_id: env['APP_ID'] || args(['app-id']),
  app_port: args['app-port'] || (args.prod ? 80 : 7000),
  app_handler,
  proxy_host: env['PROXY_HOST'] || args['proxy-host'] || 'localhost',
  proxy_port: env['PROXY_PORT'] || args['proxy-port'] || 6000
});

if (!state.app_id) {
  log("missing app id");
  process.exit();
}

async function connect_to_proxy() {
  const node = state.node = net.node(state.proxy_host, state.proxy_port);
  node.subscribe(state.app_id, (msg, cid, topic) => {
    log({ topic, msg, cid });
  });
}

async function validate_app() {
  // fetch app cert from meta-data server (thru proxy)
  log({ starting_app: state.app_id });
  state.node.publish("app-up", state.app_id);
}

async function initialize_app_handlers() {
  app_handler
    .use(require('serve-static')('web/org', { index: [ "index.html" ]}))
    .use((req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    })
  ;
}

(async () => {
  await connect_to_proxy();
  await validate_app();
  await initialize_app_handlers();
  await web.start_web_listeners(state);
})();