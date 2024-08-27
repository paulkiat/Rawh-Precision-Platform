/** ZeroMQ export helpers for client/server nodes */

const zeromq = require("zeromq");
const util = require('./util');
const log = util.logpre('zmq');
const os = require('os');

const { Dealer, Router } = zeromq;
const { args, json } = util;
const proto = "tcp";
const settings = {
  heartbeat: 1000,
  dead_client: 5000
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
  const sock = new Dealer;
  sock.connect(`${proto}://${host}:${port}`);
  log({ connected: `${host}:${port}` });

  async function send(request) {
    await sock.send(json(request));
  }

  async function recv() {
    const [result] = await sock.receive();
    return JSON.parse(result);
  }
 
  async function call(request) {
    await send(request);
    return await recv();
  }

  return { send, recv, call };
}

function zmq_proxy(port = 6000) {
  const seed = Date.now();
  const clients = { };
  const topics = { }; // map topics to cid interest lists
  const direct = { }; // map direct handlers to cid interest lists
  const watch = { }; // track all active callers to allow dead node errors
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

  const server = zmq_server(port, (recv, cid, send) => {
    // update last message time for client
    clients[cid] = Date.now();
    if (typeof recv == 'number') {
        // heartbeat to keep the client record alive
      return;
    }
    const [ action, topic, msg, callto, mid ] = recv;
    const sent = [ ];
    switch (action) {
      case 'sub':
        (topics[topic] = topics[topic] || []).push(cid);
        toplist = Object.keys(topics);
        topstar = toplist.filter(t => t.endsWith("/*"));
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
            }
          }
        }
        // for subscribers to *all* topic list
        blast(send, topics['*'] || [], tmsg, sent);
        break;
      case 'call':
        if (!send(callto, [ 'call', topic, msg, cid, mid ])) {
          log({ notify_caller_of_dead_enpoint: topic, cid, callto });
          send(cid, [ 'err', `dead endpoint: ${topic}`, callto, mid ]);
        } else {
          (watch[callto] = watch[callto] || []).push({ cid, topic, callto, mid });
        }
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
    for (let cid of Object.keys(clients)) {
      const delta = Date.now() - clients[cid];
      if (delta > settings.dead_client) {
        const watchers = watch[cid];
        if (watchers && watchers.length) {
          log({ removing_watched_client: cid, watchers });
        }
        delete clients[cid]
        for (let [key, topic] of Object.entries(topics)) {
          topics[key] = topic.filter(match => match !== cid);
        }
        for (let [key, topic] of Object.entries(direct)) {
          direct[key] = topic.filter(match => match !== cid);
        }
        // notify watchers of dead node
        for (let rec of watch[cid] || []) {
          const { cid, topic, callto, mid } = rec;
          server.send(cid, [ 'err', `deadendpoint: ${topic}`, callto, mid ]);
        }
        delete watch[cid];
        server.remove(cid);
        continue;
      }
      server.send(cid, seed);
    }
  }, settings.heartbeat);
}

/** broker node capable of pub, sub, and direct messaging */
function zmq_node(host = "127.0.0.1", port = 6000) {
  const client = zmq_client(host, port);
  const handlers = {}; // call endpoints
  const subs = {}; // subscription endpoints
  const once = { }; // once message handlers for call/handle pattern
  const seed = Date.now();
  let lastHB = Infinity;
  let on_reconnect;
  let sub_star = [];

  setInterval(() => client.send(seed), settings.heartbeat);

  function heartbeat(rec) {
    if (rec !== lastHB) {
      // handle mismatched heartbeat and re-sub all topics
      if (lastHB !== Infinity) {
        for (let [ topic, handler ] of Object.entries(subs)) {
          client.send([ "sub", topic ]);
          log({ proxy_re_sub: topic });
        }
        for (let [ topic, handler ] of Object.entries(handlers)) {
          client.send([ "handle", topic ]);
          log({ proxy_re_sub: topic });
        }
      if (on_reconnect) {
          on_reconnect();
      }
    }
    lastHB = rec;
    }
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
          const rmsg = await endpoint(msg, topic, cid);
          client.send(["repl", '', rmsg, cid, mid]);
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
          return await reply(msg);
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
          return await reply({ subs, direct });
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
      default:
        log({ next_unhandled: rec });
        return;
    }
  }
  
  // background message receiver
  (async function () {
    while (true) {
      await next_message();
    }
  }());

  function flat(topic) {
    return Array.isArray(topic) ? topic.join('/') : topic;
  }

  // publish / subscribe :: fire and forget with 1 or more recipients
  // call / handle :: classic request <> reponse pattern
  const api = {
    publish: (topic, message) => {
      client.send([ "pub", flat(topic), message ]);
    },
    subscribe: (topic, handler) => {
      topic = flat(topic);
      client.send([ "sub", topic ]);
      subs[topic] = handler;
      substar = Object.keys(subs)
        .filter(k => k.endsWith("*"))
        .map(k => k.substring(0, k.length - 1));
    },
    // client id can only be derived by subscribing
    // to a topic and receiving a message
    call: (cid, topic, message, on_reply) => {
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
    // optional function to run on proxy re-connect events
    on_reconnect: (fn) => {
      on_reconnect = fn;
    }
  };

  api.promise = {
    call: (cid, topic, message) => {
      return new Promise(resolve => {
        api.call(cid, topic, message, resolve);
      });
    },
    locate: (topic) => {
      return new Promise(resolve => {
        api.locate(topic, resolve);
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