// simple adder api service for testing browser and other proxy clients

const { args, env, json } = require('../lib/util');
const proxy_host = env('PROXY_HOST') || args['proxy-host'] || 'localhost';
const proxy_port = env('PROXY_PORT') || args['proxy-port'] || '6000';
const net = require('../lib/net');

const node1 = net.node(proxy_host, proxy_port);
const node2 = net.node(proxy_host, proxy_port)
  .on_connect(() => console.log('node 2 connect'))
  .on_reconnect(() => console.log('node 2 reconnect'))
  .on_disconnect(() => console.log('node 2 disconnect'))

node1.subscribe("test-sub", (message) => {
  console.log({ test_sub: message });
});

node2.publish("test-sub", { a_test_message: "number one" });
node2.publish("test-sub", { a_test_message: "number two" });