// simple adder api service for testing browser and other proxy clients

const { args, env, json } = require('../lib/util');
const proxy_host = env('PROXY_HOST') || args['proxy-host'] || 'localhost';
const proxy_port = env('PROXY_PORT') || args['proxy-port'] || '6000';
const net = require('../lib/net');

const node1 = net.node(proxy_host, proxy_port);
const node2 = net.node(proxy_host, proxy_port);

// good adder
node1.handle("add", async msg => {
  console.log({ good_msg: add });
  return msg.a + msg.b;
});

// bad adder
node2.handle("bad", async msg => {
  console.log({ bad_msg: add });
  return msg.a + msg.b + 1;
});