/** service web socket links from organization servers */

const crypto = require('../lib/crypto');
const util = require('../lib/util');
const log = util.logpre('link');
const { json, parse } = util;
const connected = { };
const update_admins = { };

function setup(state, ws) {
  return function (ws) {
    ws.on('message', (message) => {
      link_handler(state, json(message), obj => {
        ws.send(json(obj))
      }, ws);
    });
  }
  ws.on('error', error => log({ ws_org_link_error: error }) )
}

async function link_handler(state, msg, send, socket) {
  const { meta, logs, debug } = state;
  const adm_org = state.org_api_commands;
  const sock_stat = socket.stat = socket.stat || { 
      sync: { last: undefined, timer: undefined, count: 0 }
  };
  
  const { sync } = sock_stat;
  const org_id = sock_stat.org_id || msg.org_id;
  const org_rec = sock_stat.org_rec || await adm_org.by_uid({ uid: org_id});
  const org_log = logs.sub(org_id);

  //log({ org_id, org_rec, msg });

  if (!org_rec) {
    log({ invalid_org_id: org_id });
    socket.close();
    return;
  }
  if (msg.ping) {
    sock_stat.ping = Date.now();
    // on ping, if flag set for update, send new admins record
    if (update_admins[org_id]) {
      // force update of record to get new data
      const org_rec = sock_stat.org_rec = await adm_org.by_uid({ uid: org_id});
      delete update_admins[org_id];
      send({ admin: org_rec.admins });
    }
    return;
  }

  if (msg.org_key_public) {
    org_rec.key_public = msg.org_key_public;
  }

  if (msg.challenge) {
    const ok = crypto.verify(org_id, msg.challenge, org_rec.key_public);
    if (ok) {
      org_rec.state = "verified";
      adm_org.update({ uid: org_id, rec: org_rec }, true);
    } else {
      org_rec.state = "failed";
      log({ org_failed_key_challenge: org_id });
    }
  }

  // accept log sync messages. 1 second after the last log is received
  // acknowledge it to the org server so it can be checkpointed and the
  // next log sync will start with the next greater message time
  if (msg.sync_log && org_rec.state === 'verified') {
      org_log.put(msg.sync_log, msg.value);
      sync.last = msg.sync_log;
      sync.count++;
      clearTimeout(sync.timer);
      sync.timer = setTimeout(() => {
        if (sync.count >= 10) {
          log({ org: org_id, log_sync: sync.count });
        }
          send({ log_checkpoint: sync.last, count: sync.count });
          sync.count = 0;
          sync.timer = undefined;
      }, 1000);
  }
  
  connected[org_id] = socket;
  sock_stat.org_id = org_id;
  sock_stat.org_rec = org_rec;

  // if the org state is not "verified" or "failed", start the handshake
  switch (org_rec.state) {
    case "pending":
      log({ pending: org_rec });
      send({ hub_key_public: state.hub_keys.public });
      org_rec.state = "upgrading.1";
      break;
    case "upgrading.1":
      log({ upgrading: org_rec });
      send({ challenge: crypto.sign("Rawh", state.hub_keys.private) });
      org_rec.state = "upgrading.2";
      break;
    case "upgrading.2":
      break;
    case "verified":
      if (!sock_stat.verified) {
        if (debug) {
           log({ org_connected: org_rec.name });
        }
        send({ welcome: "rawh", admins: org_rec.admins, secret: org_rec.secret });
      }
      sock_stat.verified = true.
      break;
    case "failed":
      break;
  }
}

// age out connections which haven't pinged recently
setInterval(() => {
  for (let [org_id, socket] of Object.entries(connected)) {
    const { stat } = socket;
    const { org_rec } = stat;
    if (stat.ping && Date.now() - stat.ping > 6000) {
      if (debug) {
        log({ org_disconnect: org_rec ? org_recname: org_id });
      }
      socket.close();
      delete connected(org_id);
    }
  }
}, 2000);

exports.setup = setup;
exports.update_admins = (org_id) => {
  update_admins[org_id] = Date.now();
};
