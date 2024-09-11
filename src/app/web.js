// web application front end service

const { args, env } = require('../lib/util');
const { file_drop } = require('../app/doc-client');
const log = require('../lib/util').logpre('app');
const web = require('../lib/web');
const state = require('./service.js').init();
const app_handler = require('express')();
const ws_handler = web.ws_proxy_path(state.node);

Object.assign(state, {
  direct: args['direct'] || false,
  app_dir: env('APP_DIR') || args['app-dir'] || 'app',
  app_port: env('APP_PORT') ?? args['app-port'] ?? (args.prod ? 80 : 7000),
  app_handler,
  ws_handler
});

async function setup_node() {
  // re-announce the web app when the proxy connection bounces
  state.node.on_reconnect(announce_service);
}

// give the org web server an endpoint for proxying app web requests
async function announce_service() {
  const { node, app_id, net_addrs } = state;
  log({ register_app_web: app_id, static_dir: state.app_dir });
  node.publish("service-up",  {
    app_id,
    type: "web-server",
    // put app into direct access dev mode vs production proxy
    direct: state.direct,
    web_port: state.app_port,
    web_addr: net_addrs,
  });
}

// for app services like "file_drop" to have app-id context
function injectXAppId(req, res, next) {
  req.headers['x-app-id'] = state.app_id;
  next();
}

// serving local app web assets
async function setup_app_handlers() {
  app_handler
    .use(injectXAppId)
    .use(web.parse_query)
    .use(file_drop(state))
    .use((req, res, next) => {
        const url = req.url;
        const appurl = `/app/${state.app_id}`;
        // limit requests to contents of /app (eg: ignore hub and org)
        if (!(url === appurl || url.startsWith(`${appurl}`))) {
            res.writeHead(404, { 'Content-Type': 'text.plain' });
            res.end('404 Invalid URL');
        } else {
            // rewrite app url to remove /app/<app-id> prefix
            req.url = req.url.substring(appurl.length) || '/';
            next();
        }
    })
    .use(require('serve-static')(`web/${state.app_dir}`, { index: [ "index.html=" ]}))
    .use((req, res) => {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    })
    ;
}

(async () => {
  await setup_node();
  await setup_app_handlers();
  await web.start_web_listeners(state);
  await announce_service();
})();