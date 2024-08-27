// implements org node functions
// listen for app registrations, serve meta data

const { createProxyMiddleware } = require('http-proxy-middleware');
const log = require('../lib/util').logpre('node');
const net = require('../lib/net');
const router = require('express').Router();
const apps = { };

function logProvider() {
  return {
    log: log,
    debug: log,
    info: log,
    warn: log,
    error: log
  };  
}

exports.init = function (state) {
  node = state.node = net.node('localhost', state.proxy_port);

  node.subscribe('service-up', (msg, cid) => {
    const { type, subtype, app_id } = msg;
    const app_rec = apps[app_id] || (apps[app_id] = {
      type,
      subtype,
      web: { },
      doc: { }
    });
    if (msg.type !== "web-server") {
      return;
    }
    // handle app web services announcements
    const { web_port, web_addr } = msg;
    const root = `/app/${app_id}`;
    const proxy = createProxyMiddleware({
      target: `http://${web_addr[0]}:${web_port}`,
      // pathRewrite: { [`^${root}`]: /${app_id}' },
      logProvider
    });
    const handler = app_rec.web[root];
    if (handler) {
      // replace proxy handler function
      handler.cid = cid;
      handler.proxy = proxy;
      log({ web_proxy_update: app_id, root, host: web_addr, port: web_port });
    } else {
      // create a proxy handler
      const newh = app_rec.web[root] = { cid, host: web_addr[0], port: web_port, proxy };
      const endpoint = async (req, res, next) => {
        // log({ proxy_url: req.url });
        return newh.proxy(req, res, next);
      }
      router.use(root, endpoint);
      log({ web_proxy_new: app_id, root, host: web_addr, port: web_port });
    }
  });

  // handle doc loading/embedding events
  node.subscribe('doc-loading/*', (msg, cid, topic) => {
    log({ doc_loading: msg, topic });
  });

  // catch-all for any other un-delivered events
  //  node.subscribe('*', (msg, cid, topic) => {
  //   log({ suball: msg, topic });
  //  });
};

exports.web_handler = router;