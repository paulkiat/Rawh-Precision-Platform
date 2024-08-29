/** simnple curl-able web admin api */

const crypto = require('../lib/crypto');
const util = require('../lib/util');
const log = util.logpre('link');
const { json, parse } = util;
const connected = { };

function setup(state) {
  // wss_handler function
  return function (ws) {
    ws.on('message', (message) => {
      link_handler(state, json(message), obj => {
        ws.send(json(obj))
      }, ws);
    });
  }
}

async function link_handler(state, msg, send, socket) {
  const { meta, logs, adm_org } = state;
  const sock_stat = socket.stat = socket.stat || { };
  
  const org_id = sock_stat.org_id || msg.org_id;
  const org_rec = sock_stat.org_rec || await adm_org.get_by_uid(org_id);

  //log({ org_id, org_rec, msg });

  if (!org_rec) {
    log({ invalid_org_id: org_id });
    socket.close();
    return;
  }
  if (msg.ping) {
    sock_stat.ping = Date.now();
    return;
  }

  if (msg.org_key_public) {
    org_rec.key_public = msg.org_key_public;
  }

  if (msg.challenge) {
    const ok = crypto.verify(org_id, msg.challenge, org_rec.key_public);
    if (ok) {
      org_rec.state = "verified";
      adm_org.update(org_id, org_rec);
    } else {
      org_rec.state = "failed";
      log({ org_failed_key_challenge: org_id });
    }
  }
  
  connected[org_id] = socket;
  sock_stat.org_id = org_id;
  sock_stat.org_rec = org_rec;

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
        log({ org_connected: org_rec.name });
        send({ welcome: "rawh " });
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
      log({ org_disconnect: org_rec ? org_recname: org_id });
      socket.close();
      delete connected(org_id);
    }
  }
}, 2000);

exports.setup = setup;