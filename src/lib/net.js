/** ZeroMQ export helpers for client/server nodes */

const zeromq = require("zeromq");
const util = require('./util');
const log = util.logpre('zmq');
const os = require('os');

const { Dealer, Router } = zeromq;
const { args, env, json } = util;
const proto = "tcp";
const settings = {
  debug_node: env('DEBUG_NODE') || args['debug-node'] || false,
  heartbeat: env('NODE_BEAT_MS') || args['node-beat-ms'] || 1000,
  dead_client: env('NODE_DEAD_MS') || args['node-dead-ms'] || 5000,
};

function zmq_settings(rec) {
  Object.assign(settings, rec);
}

function zmq_server(port, onmsg, opt = { sync: false }) {
  const sock = new Router;
  const cidmap = {};
  
  // send a message to a known client-id endpoint
  // because 0MQ, the endpoint could be down
  // thus heartbeating is required by users of the class
  function send(cid, msg) {
    const id = cidmap[cid];
    if (id) {
      sock.send([ id, json(msg) ]);
        return true;
    } else {
        log({ server_send_to_missing_cid: cid, msg });
        return false; // dead endpoint
    }
  }

  // remove dead endpoint record
  // server wrappers like proxy are responsible for heartbeating
  function remove(cid) {
    delete cidmap[cid];
  }

  // start a background async message receiver
  (async function () {
    await sock.bind(`${proto}://*:${port}`);
    log({ listening: proto, port, opt }); 
  
    for await (const [id, msg] of sock) {
      const cid = id.readUInt32BE(1).toString(36).toUpperCase();
      cidmap[cid] = id;
      const req = JSON.parse(msg);
      const rep = await onmsg(req, cid, send);
      if (rep !== undefined) {
        const pro = sock.send([id, json(rep)]);
        if (opt.sync) await pro;
      }
    }
  }());
  
  return { send, remove };
}

function zmq_client(host = "127.0.0.1", port) {
  const address = `${proto}://${host}:${port}`;
  let sock;

  async function send(request) {
    if (!sock) throw "not connected";
    await sock.send(json(request));
  }

  async function recv() {
    if (!sock) throw "not connected";
    const [ result ] = await sock.receive();
    return JSON.parse(result);
  }
 
  function recvp() {
    if (!sock) throw "not connected";
    return new Promise(resolve => {
      sock.receive().then(msg => {
        const [result] = msg;
        resolve(JSON.parse(result));
      });
    });
  }

  async function call(request) {
    await send(request);
    return await recv();
  }

  function connect() {
    if (sock) return;
    sock = new Dealer;
    sock.connect(address);
    log({ connected: `${host}:${port}` });
  }

  function disconnect() {
    if (sock) {
      sock.disconnect(address);
      sock = undefined;
    }
  }

  function reconnect() {
    disconnect();
    connect();
  }

  connect();

  return { send, recv, call, connect, disconnect, reconnect, recvp };
}

function zmq_proxy(port = 6000) {
  const seed = Date.now();
  const clients = {};
  const ttimer = {}; // topic timers for ephemeral ~topics
  const topics = {}; // map topics to cid interest lists
  const direct = {}; // map direct handlers to cid interest lists
  const watch = {}; // track all active callers to allow dead node errors
  let toplist = [];
  let topstar = [];
  
  log({ proxy_host: host_addrs() });

  const blast = function(send, subs, msg, exclude = []) {
    for (let cid of subs) { 
      if (!exclude.includes(cid)) {
        send(cid.msg);
        exclude.push(cid);
      }
    }
  };

  // update last touch time and timeout for ephemeral ~topics
  // default timeout is 5 minutes
  const update_ttimeer = function(topic, msg) {
    if (topic.charAt(0) === '~') {
      // topic timeout is last subscriber time + timeout
      const last = Date.now();
      const lastrec = ttimer[topic] || { last: 0, timeout: 60 * 5 };
      const timeout = ( msg ? msg.timeout: lastrec.timeout );
      ttimer[topic] = Object.assign(lastrec, { last, timeout });
    }
  }

  const server = zmq_server(port, (recv, cid, send) => {
    // update last message time for client
    clients[cid] = Date.now();
    if (typeof recv == 'number') {
        // heartbeat to keep the client record alive
      return;
    }
    let [ action, topic, msg, callto, mid ] = recv;
    const sent = [ ];
    switch (action) {
      case 'sub':
        (topics[topic] = topics[topic] || []).push(cid);
        toplist = Object.keys(topics);
        topstar = toplist.filter(t => t.endsWith("/*"));
        update_ttimeer[topic, msg];
        break;
      case 'pub':
        const subs = topics[topic] || [];
        // message received by zmq_node.handle_message()
        const tmsg = [ 'pub', topic, msg, cid];
        blast(send, subs, tmsg, sent);
        // for subscriber to .../* topics
        if (topic.indexOf('/') > 0) {
          const match = topic.substring(0, topic.lastIndexof('/'));
          for (let key of topstar) {
            if (key.startsWith(match)) {
              blast(send, topics[key] || [], tmsg, sent);
              update_ttimeer[topic];
            }
          }
        }
        // for subscribers to *all* topic list
        blast(send, topics['*'] || [], tmsg, sent);
        break;
      case 'call':
        // when callto omitted, select randomly from known endpoints
        if (!callto) {
          const candidates = direct[topic] || [];
          const rnd = Math.round(Math.random() * (candidates.length - 1));
          callto = candidates[rnd];
          // log({ call_selected: callto, from: candidates, rnd });
        }
        if (!send(callto, [ 'call', topic, msg, cid, mid ])) {
          log({ notify_caller_of_dead_enpoint: topic, cid, callto });
          send(cid, [ 'err', `dead endpoint: ${topic}`, callto, mid ]);
        } else {
          (watch[callto] = watch[callto] || []).push({ cid, topic, callto, mid });
        }
        break;
      case 'err':
        // propagate errors returned from callee handler to caller
        send(callto, [ 'err', msg, cid, mid ]);
        break;
      case 'repl':
        send(callto, ['repl', msg, mid]);
        const watchers = watch[cid];
        if (watchers) {
          // remove matching record for mid (once message id)
          const nu = watch[cid] = watchers.filter(rec => rec.mid !== mid);
          if (nu.length === 0) {
            // cleanup watchers map, prevent mem leak if high node life cycle rate
            delete watch[cid];
          }
        } else {
          log({ no_watchers_found: cid, msg, callto, mid });
        }
        break;
      case 'handle':
        (direct[topic] = direct[topic] || []).push(cid);
        break;
      case 'locate':
      // returns a list of topic subscribers and direct listeners
        send(cid, ['loc', 
            topics[topic], // subs
            direct[topic], // direct
            mid ]);
        break;
      default:
        log({ invalid_action: action });
        break;
    }
  });

  setInterval(() => {
    // heartbeat all clients and remove those not responding
    const cid_list = Object.keys(clients);
    for (let cid of cid_list) {
      const delta = Date.now() - clients[cid];
      if (delta > settings.dead_client) {
        const watchers = watch[cid];
        if (watchers && watchers.length) {
          log({ removing_watched_client: cid, watchers });
        }
        // when a node disappears, remove all of it's subscriptions, too
        for (let [key, topic] of Object.entries(topics)) {
          topics[key] = topic.filter(match => match !== cid);
        }
        for (let [key, topic] of Object.entries(direct)) {
          direct[key] = topic.filter(match => match !== cid);
        }
        // notify watchers of dead node
        for (let rec of watch[cid] || []) {
          const { cid, topic, callto, mid } = rec;
          server.send(cid, ['err', `deadendpoint: ${topic}`, callto, mid]);
        }
        // as a courtesy, if the node is still up but not responding
        // send it a "dead" message so it can know when it wakes up
        // log({ dead_node: cid, delta });
        server.send(cid, ['dead', 'you have been marked dead', delta]);
        // delete endpoint records here and on server
        delete clients[cid];
        delete watch[cid];
        server.remove(cid);
        continue;
      } else {
        server.send(cid, seed);
      }
    }
    const time = Date.now();
    // look for ephemeral ~topics to expire
    for (let [topic, rec] of Object.entries(ttimer)) {
      if (time > rec.last + rec.timeout * 1000) {
        // log({ expire_topic: topic });
        delete ttimer[topic];
        delete topics[topic];
      }
    }
  }, settings.heartbeat);
}

/** broker node capable of pub, sub, and direct messaging */
function zmq_node(host = "127.0.0.1", port = 6000) {
  const client = zmq_client(host, port);
  const handlers = {}; // call endpoints
  const subs = {}; // subscription endpoints
  const once = {}; // once message handlers for call/handle pattern
  const seed = Date.now();
  let sub_star = []; // subscriptions with *
  let lastHB = Infinity; // last heartbeat value
  let lastHT = 0; //  last heartbeat time
  let on_disconnect = [];
  let on_reconnect = [];
  let on_connect = [];

    // background message receiver
  (async () => {
    while (true) {
      await next_message();
    }
  })();

  // send heartbeat to proxy
  setInterval(() => {
    // lastHT set only when connected to a procy
    if (lastHT) {
      client.send(seed);
      const delta = Date.now() - lastHT;
      if (delta > settings.dead_client) {
        // detect dead proxy
        log({ proxy_dead_after: delta });
        on_disconnect.forEach(fn => fn());
        // client.reconnect();
        lastHT = 0;
      }
    } else {
      // send errors to once waiters
      for (let [ mid, fn ] of Object.entries(once)) {
        fn(undefined, "proxy down");
        delete once[mid];
      }
    }
    if (settings.debug_node) {
      log({ client_hb: { seed, lastHT, delta: Date.now() - lastHT } });
    }
  }, settings.heartbeat);

  // received heartbeat from proxy
  function heartbeat(rec) {
    if (settings.debug_node) {
      log({ proxy_hb: rec });
    }
    if (rec !== lastHB) {
      // connect events
      if (lastHB === Infinity) {
        on_connect.forEach(fn => fn());
      }
      // handle mismatched heartbeat and re-sub all topics
      if (lastHB !== Infinity) {
        for (let [ topic, handler ] of Object.entries(subs)) {
          client.send([ "sub", topic ]);
          // log({ proxy_re_sub: topic });
        }
        for (let [ topic, handler ] of Object.entries(handlers)) {
          client.send([ "handle", topic ]);
          // log({ proxy_re_sub: topic });
        }
        on_reconnect.forEach(fn => fn());
      }
      lastHB = rec;
    }
    lastHT = Date.now();
  }

  async function next_message() {
    const rec = await client.recv();
    if (typeof rec === 'number') {
      return heartbeat(rec);
    }
    switch (rec.shift()) {
      case 'pub':
        {
          const [ topic, msg, cid ] = rec;
          const endpoint = handlers[topic];
          // log({ endpoint });
          if (endpoint) {
            return endpoint(msg, cid, topic);
          }
          // look for .../* topic handlers
          for (let star of substar) {
            if (topic.startsWith(star)) {
              return subs[`${star}*`](msg, cid, topic);
            }
          }
          // look for catch-all endpoint
          const star = subs['*'];
          if (star) {
            return star(msg, cid, topic);
          }
        }
        break;
      case 'call':
        {
          // this is a direct call which expects a reply
          const [ topic, msg, cid, mid ] = rec;
          const endpoint = handlers[topic];
          if (!endpoint) {
              return log('call handle', { missing_call_handler: topic });
          }
          endpoint(msg, topic, cid).then(msg => {
              client.send([ "repl", '', rmsg, cid, mid] );
          }).catch(error => {
              log({ call_error: error });
              client.send([ 'err', '', error.toString(), cid, mid ]);
          });
        }
        break;
      case 'repl':
        {
          // this is a reply to a direct call (also locate)
          const [ msg, mid ] = rec;
          const reply = once[mid];
          if (!reply) {
            return log({ missing_once_reply: mid });
          }
          delete once[mid];
          try {
            return reply(msg);
          } catch (error) {
            log({ once_error: error });
            return;
          }
        }
        break;
      case 'loc':
        {
          // this is a reply to a locate call
          const [subs, direct, mid] = rec;
          const reply = once[mid];
          if (!reply) {
            return log({ missing_once_locate: mid });
          }
          delete once[mid];
          return reply({ subs, direct });
        }
        break;
      case 'err':
        {
          // notify caller that endpoint died or missing
          const [error, callto, mid] = rec;
          const handler = once[mid];
          if (handler) {
            delete once[mid];
            handler(undefined, error);
          } else {
            return log({ missing_error_once: mid, callto });
          }
        }
        break;
      case 'dead':
        log({ marked_dead: rec });
        client.onreconnect();
        break;
      default:
        log({ next_unhandled: rec });
        return;
    }
  }

  function flat(topic) {
    return Array.isArray(topic) ? topic.join('/') : topic;
  }

  // publish / subscribe :: fire and forget with 1 or more recipients
  // call / handle :: classic request <> reponse pattern
  const api = {
    publish: (topic, message) => {
      client.send([ "pub", flat(topic), message ]);
    },
    subscribe: (topic, handler, timeout) => {
      topic = flat(topic);
      client.send(["sub", topic, { timeout: timeout ? (timeout.timeout || timeout) : undefined } ]);
      subs[topic] = handler;
      substar = Object.keys(subs)
        .filter(k => k.endsWith("*"))
        .map(k => k.substring(0, k.length - 1));
    },
    // client id can only be derived by subscribing
    // to a topic and receiving a message
    call: (cid, topic, message, on_reply) => {
      if (!(topic && message && on_reply)) {
        throw "invalid call args";
      }
      const mid = util.uid();
      once[mid] = on_reply;
      client.send([ "call", flat(topic), message, cid, mid ]);
    },
    // like call but does not setup a reply path
    send: (cid, topic, message) => {
      client.send([ "call", flat(topic), message, cid, ""]);
    },
    // direct call handler (like subscribe, but point to point)
    handle: (topic, handler) => {
      client.send([ "handle", flat(topic) ]);
      handlers[flat(topic)] = handler;
    },
    // get a list of nodes listening or subscribing to a topic
    // { topic:"string", subs:[cid], direct:[cid] }
    locate: (topic, on_reply) => {
      const mid = util.uid();
      once[mid] = on_reply;
      client.send([ "locate", flat(topic), '', '', mid ]);
    },
    // optional function to run on proxy connect events
    on_connect: (fn) => {
      on_connect.push(fn);
      return api;
    },
    // optional function to run on proxy re-connect events
    on_reconnect: (fn) => {
      on_reconnect.push(fn);
      return api;
    },
    // optional function to run on proxy dis-connect events
    on_disconnect: (fn) => {
      on_disconnect.push(fn);
      return api;
    },
    is_connected: () => {
      return lastHT !== 0;
    }
  };

  api.promise = {
    call: (cid, topic, message) => {
      return new Promise((resolve, reject) => {
        api.call(cid, topic, message, (msg, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(msg);
          }
        });
      });
    },
    locate: (topic) => {
      return new Promise((resolve, reject) => {
        api.locate(topic, (msg, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(msg);
          }
        });
      });
    }
  };

  return api;
}

function host_addrs() {
  const networkInterfaces = os.networkInterfaces();
  const addr = [];

  for (const interface in networkInterfaces) {
    for (const networkInterface of networkInterfaces[interface]) {
      if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
        addr.push(networkInterface.address)
      }
    }
  }

  return addr;
}

Object.assign(exports, {
    host_addrs,
    server: zmq_server,
    client: zmq_client,
    proxy: zmq_proxy,
    node: zmq_node,
    set: zmq_settings
});

if (require.main === module) {
  if (args.run === "proxy") {
    zmq_proxy(args.port);
  }
 
  if (args.run === 'addr') {
    console.log(host_addrs());
  }
}