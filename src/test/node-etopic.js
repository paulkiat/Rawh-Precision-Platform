// test ephemeral expiring ~topics

const { args, env } = require('../lib/util');
const proxy_host = env('PROXY_HOST') || args['proxy-host'] || 'localhost';
const proxy_port = env('PROXY_PORT') || args['proxy-port'] || '6000';
const net = require('../lib/net');
const topic = "~expiring";

const node1 = net.node(proxy_host, proxy_port);
const node2 = net.node(proxy_host, proxy_port);

node1.subscribe(topic, (message) => {
  console.log({ test_sub: message });
}, 5);

node2.publish(topic, { a_test_message: "number one" });
node2.publish(topic, { a_test_message: "number two" });

setTimeout(() => {
  // this should be dropped
  node2.publish(topic, { a_test_message: "message three" });
}, 10 * 1000);