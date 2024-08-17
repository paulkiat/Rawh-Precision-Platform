/** ZeroMQ export helpers for client/server nodes */

const zeromq = require('zeromq');
const { Request, Reply, Dealer, Router } = zeromq;
const util = require('./util');
const log = util.logpre('zmq');
const proto = "tcp";

async function zmq_server(port, onmsg, opt = { sync: false }) {
  const sock = new Router;
  
  await sock.bind(`${proto}://*:${port}`);
  log('Server bound', proto, 'port', port, 'opt', opt);
  
  for await (const [id, msg] of sock) {
    const cid = id; //(id.readUnit32BE(1)).toString(36);
    const req = JSON.parse(msg);
    const rep = await onmsg(req, cid, sock);
    if (rep !== undefined) {
      const pro = sock.send([ cid, JSON.stringify(rep) ]);
      if (opt.sync) await pro;
    }
  }

  log('Server done');
}

function zmq_client(host = "127.0.0.1", port) {
  const sock = new Dealer;
  sock.connect(`${proto}://${host}:${port}`);
  log(`Client connected to ${host}:${port}`);

  async function send(request) {
    await sock.send(JSON.stringify(request));
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

async function zmq_proxy(port = 6000) {
  const topics = {};
  const server = zmq_server(port, (recv, id, sock) => {
    const [ action, topic, msg ] = recv;
    const subs = topics[topic] = topics[topic] || [];
    switch (action) {
      case 'sub':
        subs.push(id);
        break;
      case 'pub':
        // log({ topic, msg, to: subs, from: id });
        for (let id of subs) {
          sock.send([ id, JSON.stringify([ topic, msg ]) ]);
        }
        break;
      default:
        log({ invalid_action: action });
        break;
    }
  });
}

/** sends messages to topics */
function zmq_pub(host = "127.0.0.1", port = 6000) {
  const client = zmq_client(host, port);
  return {
    send: (topic, message) => {
      log('send', { topic, message });
      client.send([ "pub", topic, message ]);
    }
  };
}

/** receives message from topics */
function zmq_sub(host = "127.0.0.1", port = 6000) {
  const client = zmq_client(host, port);
  (async function () {
    while (true) {
      const [ topic, msg ] = await client.recv();
      log('recv', { topic, msg });
    }
    log('sub-exited');
  }());
  return {
    listen: (topic, handler) => {
      client.send([ "sub", topic ]);
    }
  };
}

function zmq_node(host = "127.0.0.1", port = 6000) {
  const client = zmq_client(host, port);
  const handlers = {};

  (async function () {
    while (true) {
      const [topic, msg] = await client.recv();
      log('recv', { topic, msg });
      }
      log('sub exited');
  }());
  return {
    publish: (topic, message) => {
      log('send', { topic, message })
      client.send([ "pub", topic, message ]);
    },
    subscribe: (topic, message) => {
      client.send([ "sub", topic, message ]);
      handlers[topic] = handler;
    }
  };
}

Object.assign(exports, {
  zmq: {
    server: zmq_server,
    client: zmq_client,
    proxy: zmq_proxy
  }
});

if (require.main === module) {
  log('text proxy');
  if (true) (async function () {
    await zmq_proxy();
    const sub = await zmq_sub();
    const pub = await zmq_pub();
    sub.listen('cats', catmsg => {
      log({ catmsg });
    })
    pub.send('cats', "a cat message");
  }());

  log('test clients/server');
  if (false) (async function () {
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