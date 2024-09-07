// listen for app registrations and sets up dynamic web proxy
// from the org web rfront end server to the app back end web server
// secured, encrypted, authenticated endpoint for all apps

const { createProxyMiddleware } = require('http-proxy-middleware');
const log = require('../lib/util').logpre('node');
const web = require('../lib/web');
const api_app = require('./api-app');
const user_auth = require('./api-user');
const router = require('express').Router();
const apps = { };
const ctx = { };

function logProvider() {
  const logfn = ctx.debug ? log : () => { };
  return {
    log: logfn,
    debug: logfn,
    info: logfn,
    warn: logfn,
    error: logfn
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
  const { node } = state;

  // for now it's assumed that this code runs in the same process space
  // as the broker, if not, then node will have to handle on_reconnect events
  Object.assign(ctx, state);

  // initialize authentication services
  user_auth.init(state);

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
  node.subscribe('service-up', async (msg, cid) => {
    const { app_id, type, subtype } = msg;
    const app_rec = get_app_rec(app_id, { type, subtype });
    state.logr('org', msg);
    if (msg.type !== "web-server") {
      return;
    }
    const is_valid = await api_app.register_app(app_id);
    if (!is_valid) {
      log({ invalid_app_id: app_id, error: "will not proxy" });
      return;
    }
    // handle app web services announcements
    const { web_port, web_addr, direct } = msg;
    const root = `/app/${app_id}`;
    const proxy = createProxyMiddleware({
      // pathRewrite: { [`^${root}`]: /${app_id}' },
      target: `http://${web_addr[0]}:${web_port}`,
      logProvider,
      onProxyReq: onProxyReq(msg)
    });
    if (direct) { 
        api_app.set_app_direct(app_id, web_addr[0], web_port);
    } else {
        api_app.set_app_proxy(app_id);
    }
    const handler = app_rec.web[root];
    if (handler) {
      // replace proxy handler function
      handler.cid = cid;
      handler.proxy = proxy;
      log({ web_proxy: app_id, root, host: web_addr, port: web_port });
    } else {
      // create a proxy handler
      const newh = app_rec.web[root] = { cid, host: web_addr[0], port: web_port, proxy };
      const endpoint = async (req, res, next) => {
        const session =  (req.headers.cookies || '')
          .split(';')
          .map(v => v.trim.split('='))
          .filter(v => v[0] === 'rawh-session')
          .map(v => v[1]);
        const is_valid = await user_auth.is_session_valid(session, app_id);
        // log({ proxy: req.parsed.url.pathname, is_valid, session });
        if (!is_valid) {
          // this is an invalid or expired sessions
          const path = req.parsed.url.pathname;
          if (path.indexOf(".") > 0) {
            // 404 file assets
            log({ "proxy ssn 404": path });
            return web.four_oh_four(req, res);
          } else {
            // redirect all html and page requests to /
            log({ "proxy ssn redirect": path });
            return res.redirect("/");
          }
        }
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
      log({ web_proxy: app_id, root, host: web_addr, port: web_port });
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