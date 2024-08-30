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
};
const link_err = {
  msg: undefined,
  count: 0,
  repeat: 10
};

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
    // reset error state on successful connection
    link_err.msg = undefined;
    link_err.count = 1;
    link_err.repeat = 10;
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
    // retry connection to hub on a downed link
    setTimeout(() => { start_hub_connection(state) }, 5000);
  });

  ws.on('error', (error) => {
    const msg = json(error);
    if (msg === link_err.msg) {
      if ((++link_err.count) % link_err.repeat === 0) {
        link_err.repeat = Math.min(50, link_err.repeat + 10);
      } else {
          return;
      }
    } else {
        link_err.count = 1;
        link_err.repeat = 10;
    }
    link_err.msg = msg;
    if (link_err.count > 1) {
      errobj.repeated = link_err.count;
    }
    log(errobj);
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
    const ok = crypto.verify("rawh", msg.challenge, state.hub_key_public);
    if (ok) {
      link.send({ challenge: crypto.sign(state.org_id, state.org_keys_private) });
    } else {
      log({ failed_hub_key: "rawh" });
    }
  }
  if (msg.welcome) {
    log({ hub_connected: msg.welcome });
  }
  if (msg.admins) {
    const admins = msg.admins;
    // update org admin list when provided during welcome
    await meta.put('org-admins', Array.isArray(admins) ? admins : [ admins ]);
  }
}

exports.start_hub_connection = start_hub_connection;