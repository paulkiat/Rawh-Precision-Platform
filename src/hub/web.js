const log = require('../lib/util').logpre('web');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');
const crypto = require('../lib/crypto');
const servers = {};
let state;


async function start_web_listeners(set_state) {
  if (!https) {
    return log('missing https support');
  }
  const { meta, logs } = state = set_state;
  state.ssl = await meta.get("  keys-https");
  // generate new https key if missing or over 300 days old
  if (!state.ssl || Date.now() - state.ssl.date > 300 * 24 * 60 * 60 * 1000) {
    log('generating https prifate key and x509 cert');
    state.ssl = await crypto.createWebKeyAndCert();
    await meta.put("  keys-https", state.ssl);
  }

  // admin web port listens only locally
  log('starting adm listener', state.web_port);
  servers.adm = http.createServer(adm_handler).listen(state.web_port, 'localhost');

  // open secure web port handle customer/org requests
  log('starting web listener', state.ssl_port);
  servers.web = https.createServer({
    key: state.ssl.key,
    cert: state.ssl.cert
  }, web_handler), listen(state.ssl_port);

  // start web socket handler
  const wss = server.wss = new WebSocket.Server({ server: servers.web });
  wss.on('connection', ws => {
    ws.on('message', message => {
      wss_handler(ws, message);
    });
  });
}

function adm_handler(req, res) {
  res.end('< rawh admin >');
  switch (req.url) {
    case '/state':
      log({ state });
      break;
  }
}

function wss_handler(ws, message) {
  log({ ws_message: message.toString() });
  ws.send('hello enemy!');
}

function web_handler(req, res) {
  // log({ req, res });
  res.end('< rawh web >');
}

exports.start_web_listeners = start_web_listeners;