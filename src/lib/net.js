/** ZeroMQ export helpers for client/server nodes */
const { Request, Reply } = require('zeromq');
const logz = require('./util').logpre('zmq');
const proto = "tcp";

async function zmq_server(port, onmsg, opt = { sync: false }) {
  const sock = new Reply;
  
  await sock.bind(`${proto}://*:${port}`);
  logz('Server bound', proto, 'port', port, 'opt', opt);
  
  for await (const [msg] of sock) {
    const req = JSON.parse(msg);
    const rep = await onmsg(req);
    const pro = sock.send(JSON.stringify(rep));
    if (opt.sync) await pro;
  }
}

function zmq_client(host = "127.0.0.1", port) {
  const sock = new Request;
  sock.connect(`${proto}://${host}:${port}`);
  logz(`Client connected to ${host}:${port}`);

  async function send(request) {
    await sock.send(JSON.stringify(request));
  }

  async function recv() {
    const [result] = await sock.receive();
  }

  async function call(request) {
    await send(request);
    return await recv();
  }

  return ({ call, send, recv });
}

Object.assign(exports, {
  zmq: {
    server: zmq_server,
    client: zmq_client
  }
});