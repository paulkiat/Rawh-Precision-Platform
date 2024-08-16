const log = require('../lib/util').logpre('link');
const WebSocket = require('ws');
const states = {
  unknown: 0,
  starting: 1,
  opened: 2,
  authenticated: 3
};

let status = states.unknown;
let timer;

/**
 * maintains a persistant connection to the rawh hub
 * allowing sync of org and application meta-data as well
 * as a channel to push usage and event logging to rawh
 */

async function start_hub_connection(context) {
  if (status !== states.unknown) {
    log({ exit_on_invalid_state: status });
    return;
  }

  status = states.starting;
  const ws = new WebSocket('wss://localhost:8443', {
    rejectUnauthorized: false // allows self-signing certificates
  });

  ws.on('open', function open() {
    status = states.opened;
    timer = setInterval(() => {
      context.hub_send({ ping: Date.now() });
    }, 2500);
    context.hub_send = (msg) => {
      ws.send(JSON.stringify(msg));
    };
  });

  ws.on('message', function (data) {
    log({ ws_recv: data.toString() });
  });
 
  ws.on('close', () => {
    status = states.unknown;
    context.hub_send = (msg) => {
      log('hub link down. message dropped')
    }
    clearTimeout(timer);
    setTimeout(() => { start_hub_connection(context) }, 5000);
  });

  ws.on('error', (error) => {
    log('hub_conn_error', JSON.stringify(error));
  });
}

exports.start_hub_connection = start_hub_connection;