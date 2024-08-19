const crypto = require('../lib/crypto');
const util = require('../lib/util');
const log = util.logpre('link');
const { json, parse } = util;
const WebSocket = require('ws');
const link_states = {
  offline: 0,
  starting: 1,
  opened: 2,
  authenticated: 3
};
const link = {
  state: link_states.offline,
  send: undefined,
  end: undefined,
}

let heartbeat_timer;

/**
 * maintains a persistant connection to the rawh hub
 * allowing sync of org and application meta-data as well
 * as a channel to push usage and event logging to rawh
 */

async function start_hub_connection(state) {
  if (link.state !== link_states.offline) {
    log({ exit_on_invalid_state: link.state });
    return;
  }

  state.link = link;
  link.state = link_states.starting; 
  const ws = new WebSocket(`wss://${state.hub_host} : ${state.hub_port}`, {
    rejectUnauthorized: false // allows self-signing certificates
  });

  ws.on('open', function open() {
    link.state = link_states.opened;
    // hearbeat ping every 5 seconds will allow link error detection and reset
    heartbeat_timer = setInterval(() => { link.send({ ping: Date.now() }) }, 2500);
    link.send = (msg) => ws.send(json(msg));
    link.send({ org_id: state.org_id });
  });

  ws.on('message', function (data) {
    handle(state, parse(data.toString()));
  });
 
  ws.on('close', () => {
    link.state = link_states.offline;
    link.send = (msg) => {
      // maybe perma-log this to records management
      log('hub link down. message dropped')
    }
    clearTimeout(heartbeat_timer);
    setTimeout(() => { start_hub_connection(state) }, 5000);
  });

  ws.on('error', (error) => {
    log('hub_conn_error', json(error));
  });
}

async function handle(state, msg) {
  const { meta, logs } = state;
  if (msg.hub_key_public) {
    state.hub_key_public = msg.hub_key_public;
    await meta.put('hub-key-public', state.hub_key_public);
    link.send({ org_key_public: state.org_keys.public });
  }
  if (msg.challenge) {
    const ok = crypto.verify('rawh', msg.challenge, state.hub_key_public);
    if (ok) {
      link.send({ challenge: crypto.sign(state.org_id, state.org_keys_private) });
    } else {
      log({ failed_hub_key: "rawh" });
    }
  }
  if (msg.welcome) {
    log({ hub_connected: msg.welcome });
  }
}

exports.start_hub_connection = start_hub_connection;