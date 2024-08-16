const log = require('./util').logpre('web');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');
const crypto = require('./crypto');
const servers = {};


async function start_web_listeners(state) {
  if (!https) {
    return log('missing https support');
  }
  const { meta, logs, adm_handler, web_handler, wss_handler } = state;

  // admin web port listens only locally
  log('starting adm listener', state.adm_port);
  servers.adm = http.createServer(adm_handler).listen(state.adm_port, 'localhost');

  state.ssl = await meta.get("ssl-keys");

  // generate new https key if missing or over 300 days old
  if (!state.ssl || Date.now() - state.web.date > 300 * 24 * 60 * 60 * 1000) {
    log('generating https prifate key and x509 cert');
    state.ssl = await crypto.createWebKeyAndCert();
    await meta.put("ssl-keys", state.ssl);
  }

  // open secure web port handle customer/org requests
  if (web_handler) {
    log('starting web listener', state.web_port);
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

exports.start_web_listeners = start_web_listeners;