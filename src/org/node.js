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

// inject x-app-id header for proxied urls
// allowing shared app services like 'file_drop' to have app-id context
function onProxyReq(ctx) {
  return function (proxyReq, req, res) {
    proxyReq.setHeader("x-app-id", ctx.app_id);
  }
}

function get_app_rec(app_id, overlay = {}) {
  return apps[app_id] || (apps[app_id] = Object.assign({
    web: { },
    doc: { },
    url: [ ]
  }, overlay));
}

exports.init = function (state) {
  node = state.node = net.node('localhost', state.proxy_port);

  // allow an app to capture an url under its proxy root
  // and redirect it to a common url outside of the app
  // space, but retaining the app-id context (file-drop)
  node.subscribe('app-url', (msg, cid) => {
    const { app_id, path } = msg;
    const app_rec = get_app_rec(app_id);
    const match = `/app/${app_id}${path}`
    log({ app_url_escape: app_id, app_path });
    app_rec.url.push({ path, match });
  });

  // listen for application web-server service coming up
  node.subscribe('service-up', (msg, cid) => {
    const { app_id, type, subtype } = msg;
    const app_rec = get_app_rec(app_id, { type, subtype });
    if (msg.type !== "web-server") {
      return;
    }
    // handle app web services announcements
    const { web_port, web_addr } = msg;
    const root = `/app/${app_id}`;
    const proxy = createProxyMiddleware({
      // pathRewrite: { [`^${root}`]: /${app_id}' },
      target: `http://${web_addr[0]}:${web_port}`,
      logProvider,
      onProxyReq: onProxyReq(msg)
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
        // look for captured app url rewrites
        for (let url of app_rec.url) {
          if (req.parsed.url.pathname === url.match) {
              req.url = url.path;
              req.parsed.url.pathname = url.path;
              req.headers["x-app-id"] = app_id;
            return next();
          }
        }
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