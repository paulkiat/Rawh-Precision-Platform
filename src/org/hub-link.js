const log = require('../lib/util').logpre('link');
const WebSocket = require('ws');
const conn_states = {
  unknown: 0,
  starting: 1,
  opened: 2,
  authenticated: 3
};

let conn_status = conn_states.unknown;
let heartbeat_timer;

/**
 * maintains a persistant connection to the rawh hub
 * allowing sync of org and application meta-data as well
 * as a channel to push usage and event logging to rawh
 */

async function start_hub_connection(state) {
  if (conn_status !== conn_states.unknown) {
    log({ exit_on_invalid_state: conn_status });
    return;
  }

  conn_status = conn_states.starting;
  const ws = new WebSocket('wss://localhost:8443', {
    rejectUnauthorized: false // allows self-signing certificates
  });

  ws.on('open', function open() {
    conn_status = conn_states.opened;
    // hearbeat ping every 5 seconds will allow link error detection and reset
    heartbeat_timer = setInterval(() => { state.hub_send({ ping: Date.now() }); }, 5000);
    state.hub_send = (msg) => {
      ws.send(JSON.stringify(msg));
    };
  });

  ws.on('message', function (data) {
    log({ ws_recv: data.toString() });
  });
 
  ws.on('close', () => {
    conn_status = conn_states.unknown;
    state.hub_send = (msg) => {
      log('hub link down. message dropped')
    }
    clearTimeout(heartbeat_timer);
    setTimeout(() => { start_hub_connection(state) }, 5000);
  });

  ws.on('error', (error) => {
    log('hub_conn_error', JSON.stringify(error));
  });
}

exports.start_hub_connection = start_hub_connection;