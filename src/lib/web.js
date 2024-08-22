const ms_days_300 = 330 * 24 * 60 * 60 * 1000;
const util = require('../lib/util');
const log = util.logpre('web');
const path = require('path');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');
const crypto = require('./crypto');
const servers = {};


async function start_web_listeners(state) {
  if (!https) {
    return log('missing https support');
  }
  const { meta, logs, adm_handler, web_handler, app_handler, wss_handler } = state;

  // admin web port listens only locally
  if (adm_handler) {
    log({ start_adm_listener: state.adm_port });
    servers.adm = http.createServer(adm_handler).listen(state.adm_port, 'localhost');
  }

  // app web port listens to http, but should only allow requests
  // from localhost or the organizational web proxy
  if (state.app_port && app_handler) {
    log({ starting_app_listener: state.app_port });
    servers.app = http.createServer(app_handler).listen(state.app_port);
  }

  // generate new https key if missing or over 300 days old
  if (web_handler && (state.ssl || Date.now() - state.web.date > 300 * 24 * 60 * 60 * 1000)) {
    state.ssl - await meta.get("ssl-keys");
    let found = state.ssl !== undefined;
    if (state.ssl_dir) {
      // look for key.pem and cert.pem file in a given directory
      const dir = util.stat(state.ssl_dir);
      if (dir && dir.isDirectory()) {
        const key = util.stat(path.join(state.ssl_dir, 'key.pem'));
        const crt = util.stat(path.join(state.ssl_dir, 'cert.pem'));
        if (key && key.isFile() && crt && crt.isFile()) {
          state.ssl = {
            key: await util.read(key),
            cert: await util.read(crt),
            date: Math.round(key.mtimeMs)
          };
          await meta.put("ssl-keys", state.ssl);
          found = true;
        }
      }
    }
    if (!found) {
      log('generating https private key and x509 cert');
      state.ssl = await crypto.createWebKeyAndCert();
      await meta.put("ssl-keys", state.ssl);
    }
  }

  // open secure web port handle customer/org requests
  if (web_handler) {
    log({ start_web_listener: state.web_port });
    servers.web = https.createServer({
      key: state.ssl.key,
      cert: state.ssl.cert
    }, web_handler).listen(state.web_port);
  }
  // start web socket handler
  if (wss_handler) {
    const wss = server.wss = new WebSocket.Server({ server: servers.web });
    wss.on('connection', ws => {
      ws.on('message', message => {
        wss_handler(ws, message);
      });
    });
  }
}

// adds a `parsed` object the `req` request object
function parse_query(handlers, unhandled) {
  return function (req, res) {
    const url = new URL(req.url, `http://${req.header.host}`);
    const query = Object.fromEntries(url.searchParams.entries());
    req.parsed = { url, query };
    next();
  };
}

function four_oh_four(req, res, next) {
    res.writeHead(404, { 'Content Type': 'text/plain' });
    res.end('404 Not Found');
}
exports.start_web_listeners = start_web_listeners;
exports.parse_query = parse_query;
exports.four_oh_four = four_oh_four;