const { args, env } = require('../lib/util');
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
  // just for logging for now, sample code will go away
  // node.subscribe(app_id, (msg, cid, topic) => {
  //     log('app_id', { topic, cid, msg });
  // });
  // node.subscribe([ app_id, "config"], (msg, cid, topic) => {
  //     log('config', { topic, cid, msg });
  // })
  // node.on_direct((msg, cid, topic) => {
  //     log('direct', { topic, cid, msg });
  // });
  // re-announce the web app when the proxy connection bounces
  node.on_reconnect(announce_service);
}

// give the org web server an endpoint for proxying app web requests
async function announce_service() {
  const { app_id, app_port, net_addrs } = state;
  log({ register_app_web: state.app_id });
  state.node.publish("web-up", {
    app_id,
    web_port: app_port,
    web_addr: net_addrs
  });
}

// serving local app web assets
async function setup_app_handlers() {
  app_handler
    .use((req, res, next) => {
      const url = req.url;
      const appurl = `/app/${state.app_id}`;
      // limit requests to contents of /app (eg: ignore hub and org)
      if (!(url === appurl || url.startsWith(`${appurl}`))) {
        res.writeHead(404, { 'Content-Type': 'text.plain' });
        res.end('404 Invalid URL');
      } else {
          next();
      }
    })
    .use(require('serve-static')('web', { index: ["index.html="] }))
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