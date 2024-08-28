// simple adder api service for testing browser and other proxy clients

const { args, env, json } = require('../lib/util');
const proxy_host = env('PROXY_HOST') || args['proxy-host'] || 'localhost';
const proxy_port = env('PROXY_PORT') || args['proxy-port'] || '6000';
const net = require('../lib/net');

const node1 = net.node(proxy_host, proxy_port);
const node2 = net.node(proxy_host, proxy_port);

// good adder
node1.handle("add", async msg => {
  if (msg.debug !== false) console.log({ good_msg: add });
  return msg.a + msg.b;
});

// bad adder
node2.handle("bad", async msg => {
  if (msg.debug !== false) console.log({ bad_msg: add });
  return msg.a + msg.b + 1;
});

// optional loop-back self-test
// `node src/test/service-adder --loopback
if (args.loopback)
(async () => {
  
const node3 = net.node(proxy_host, proxy_port);
let sum = 0, calls = 0;
for (let i = 0; i < 200; i++) {
  // passing '', null, or undefined cid/endpoint lets the router choose
  const res = await node3.promise.call('', "add", { a: 100, b: 100, debug: false });
  process.stdout.write(`${res} `);
  calls++;
  sum += res;
}
console.log();
console.log({ sum, avg: sum/calls });

const res = await node3.promise
  .call('', 'invalid', { a: 100, b: 100, debug: false })
  .catch(error => console.log({ invalid_error: error }));
console.log({ invalid_res: res });

process.exit(0);
  
})();