const { args, env } = require('../lib/util');
const { file_drop } = require('../app/doc-client');
const log = require('../lib/util').logpre('app');
const net = require('../lib/net');
const web = require('../lib/web');
const app_handler = require('express')();
const state = require('./service.js').init();

Object.assign(state, {
  app_port: env('APP_PORT') || args['app-port'] || (args.prod ? 80 : 7000),
  app_handler
});

async function setup_node() {
  const { app_id, node } = state;
  // re-announce the web app when the proxy connection bounces
  state.node.on_reconnect(announce_service);
}

// give the org web server an endpoint for proxying app web requests
async function announce_service() {
  const { node, app_id, app_port, net_addrs } = state;
  log({ register_app_web: app_id });
  node.publish("service-up", {
    app_id,
    web_port: app_port,
    web_addr: net_addrs,
    type: "web-server"
  });
}

// serving local app web assets
async function setup_app_handlers() {
  app_handler
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
        log({ new_req_url: req.url, appurl });
        next();
      }
    })
    .use(require('serve-static')('web/app', { index: ["index.html="] }))
    .use((req, res) => {
      res.writeHead(404, {'Content-Type': 'text.plain'});
      res.end('404 Not Found');
    })
    ;
}

(async () => {
  await setup_node();
  await announce_service();
  await setup_app_handlers();
  await web.start_web_listeners(state);
})();