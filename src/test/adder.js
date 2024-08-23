// simple adder service for testing browser snd oyhrt proxy clients

const { args, env } = require('../lib/util');
const proxy_host = env('PROXY_HOST') || args['proxy-host'] || 'localhost';
const proxy_port = env('PROXY_port') || args['proxy-host'] || 6000;
const net = require('../lib/net');

const node1 = net.node(proxy_host, proxy_port);
const node2 = net.node(proxy_host, proxy_port);

// good addr
node1.handle("add", msg => {
  console.log({ good_add: msg });
  return msg.a + msg.b;
});

// bad addr
node2.handle("add", msg => {
  console.log({ bad_answer: msg });
    return msg.a + msg.b + 1;
});