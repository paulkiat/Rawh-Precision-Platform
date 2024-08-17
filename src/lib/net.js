/** ZeroMQ export helpers for client/server nodes */

const zeromq = require("zeromq");
const util = require('./util');
const log = util.logpre('zmq');
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

  (async function () {
    await sock.bind(`${proto}://*:${port}`);
    log('server bound', proto, 'port', port, 'opt', opt);
  
    for await (const [id, msg] of sock) {
      const cid = id.readUint32BE(1).toString(36);
      cidmap[cid] = id;
      const req = JSON.parse(msg);
      const rep = await onmsg(req, cid, (cid, msg) => {
        sock.send([ cidmap[cid], msg ]);
      });
      if (rep !== undefined) {
        const pro = sock.send([id, json(rep)]);
        if (opt.sync) await pro;
      }
    }
  }());
  
  return {
    send: function (cid, msg) {
      sock.send([ cidmap[cid], json(msg) ]);
    }
  };
}

function zmq_client(host = "127.0.0.1", port) {
  const sock = new Dealer;
  sock.connect(`${proto}://${host}:${port}`);
  log(`client connected to ${host}:${port}`);

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
  const topics = { };
  const clients = { };
  const server = zmq_server(port, (recv, cid, send) => {
    clients[cid] = Date.now();
    if (typeof recv == 'number') {
      // let heartbeat keep client data fresh
      // log ({ cid, heartbeat: recv });
      return;
    }
    const [ action, topic, msg ] = recv;
    const topto = topic || cid;
    const subs = topics[topto] = topics[topto] || [];
    switch (action) {
      case 'sub':
        subs.push(cid);
        break;
      case 'pub':
        for (let tid of subs) {
          send( tid, json([ topto, msg, cid ]));
        }
        break;
      default:
        log({ invalid_action: action });
        break;
    }
  });

  setInterval(() => {
    // heartbeat all clients
    for (let cid of Object.keys(clients)) {
      const delta = Date.now() - clients[cid];
      if (delta > settings.dead_client) {
        log({ removing_client: cid });
        delete clients[cid]
        for (let [key, topic] of Object.entries(topics)) {
          topics[key] = topics.filter(match => match !== cid);
        }
        continue;
      }
      server.send(cid, seed);
    }
  }, settings.heartbeat);
}

/** broker node capable of pub, sub, and direct messaging */
function zmq_node(host = "127.0.0.1", port = 6000) {
  const client = zmq_client(host, port);
  const self_key = "{self}";
  const handlers = {};
  const seed = Date.now();
  let lastHB = Infinity;

  setInterval(() => client.send(seed), settings.heartbeat);

  (async function () {
    while (true) {
      const rec = await client.recv();
      if (typeof rec === 'number') {
        if (rec !== lastHB) {
          if (lastHB !== Infinity) {
            for(let [ topic, handler ] of Object.entries(handlers)) {
              client.send([ "sub", topic === self_key ? undefined : topic ]);
              log('proxy re-sub', topic);
            }
          }
          lastHB = rec;
        }
        continue;
      }
      const [ topic, msg, cid ] = rec;
      if (topic) {
        const handler = handlers[topic] || handlers[self_key];
        if (handler) {
          handler(msg, cid, topic);
        } else {
          log( id, { missing_handler_for_topic: topic });
        }
      } else {
         log(id, 'no.topic.recv', { msg, cid, topic });
      }
    }
  }());

  const api = {
    publish: (topic, message) => {
      client.send([ "pub", topic, message ]);
    },
    subscribe: (topic, handler) => {
      client.send([ "sub", topic ]);
      handlers[topic] = handler;
    },
    on_direct: (handler) => {
      client.send([ "sub", undefined ]);
      handlers[self_key] = handler;
    },
  };

  return api;
}

Object.assign(exports, {
  zmq: {
    server: zmq_server,
    client: zmq_client,
    proxy: zmq_proxy,
    node: zmq_node,
    set: zmq_settings
  }
});

if (require.main === module) {
  if (args.run === "proxy") {
    zmq_proxy(args.port);
  }
 
  if (args.test === "proxy1") (async function () {
    log('--- test proxy bounding ---');
    const n1 = zmq_node;
      n1.on_direct(msg => {
      log({ n1:'direct', msg });
    });
    n1.subscribe('cats', (msg, cid) => {
      log({ n1:'from-sub-cats', msg, from: cid });
      n1.publish(cid, `thanks for: ${msg}`);
    });
    setInterval(() => {
      n1.publish('cats', "a cat message");
    }, 2000);
  }());
    
  if (args.test === "proxy2") (async function () {
    log('--- test proxy ---');
    zmq_proxy();
    const n1 = zmq_node();
    const n2 = zmq_node();
    n1.on_direct((msg, cid) => {
      log('n1-direct', { msg, from: cid });
    });
    n1.subscribe('cats', (msg, cid) => {
      log({ n1: 'from-sub-cats', msg, from: cid });
      n1.publish(cid, `thanks for: ${msg}`);
    });
    n2.on_direct((msg, cid) => {
      log({n2:'from-direct', msg, from: cid });
    });
    n2.publish('cats', "a cats message");
  }());

  if (args.test === "server") (async function () {
    log('--- test clients/server ---');
    zmq_server(7000, async (msg, sock) => {
      log('server got', { msg, sock });
      return "!" + msg;
    });

    const c1 = zmq_client("127.0.0.1", 7000);
    const c2 = zmq_client("127.0.0.1", 7000);

    await c1.send("c1 m1");
    const c1a1 = await c1.recv();
    const c1a2 = await c1.call("c1 m2");
    const c2a1 = await c1.call("c2 m1");

    log({ c1a1, c1a2, c2a1 });
  }());
}