// implements org node functions
// listen for app registrations, serve meta data

const log = require('../lib/util').logpre('node');
const net = require('../lib/net');
const { createProxyMiddleware } = require('http-proxy-middleware');
const apps = {};
const router = require('express').Router();

function logProvider() {
  return {
    log: log,
    debug: log,
    info: log,
    warn: log,
    error: log
  };  
}

exports.init = function (state, web_handler) {
  node = state.node = net.node('localhost', state.proxy_port);

  // handle app web services announcements
  node.subscribe('web-up', (msg, cid) => {
    const { app_id, web_port, web_addr } = msg;
    log({  web_svc_up: app_id, host: web_addr, port: web_port});
    // node.publish(cid, { too_u: { "dog": "poo" } });
    // node.publish([app_id, "config"], { config: { for: "real" } })
    apps[app_id] = { host: web_addr[0], port: web_port };
    const root = `app/${app_id}`;
    router.use(root, createProxyMiddleware({
      target: `http://${web_addr[0]}:${web_port}`,
      // pathRewrite: { [`^${root}`]: /${app_id}' },
      logProvider
    }))
  });

  // handle doc loading/embedding events
  node.subscribe('doc-up', (msg, cid) => {
    const { app_id, net_addrs, type } = msg;
    log({ doc_svc_up: app_id, host: net_addrs, type });
  });

  // test
  node.subscribe('*', (msg, cid, topic) => {
    log({ suball: msg, topic });
  })
};

exports.web_handler = router;