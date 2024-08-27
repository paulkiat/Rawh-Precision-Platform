// simple adder api service for testing browser and other proxy clients

const { args, env, json } = require('../lib/util');
const proxy_host = env('PROXY_HOST') || args['proxy-host'] || 'localhost';
const proxy_port = env('PROXY_PORT') || args['proxy-port'] || '6000';
const net = require('../lib/net');

const node1 = net.node(proxy_host, proxy_port);
const node2 = net.node(proxy_host, proxy_port);

node1.handle("test-ep", (message) => {
  console.log({ test_ep: message });
  return `got your message: ${json(message)}`;
});

node2.locate("test-ep", (locate) => {
  console.log({ locate });
  const { direct } = locate;
  node2.call(direct[0], "test-ep", { luke: "i am your father" }, (reply, error) => {
    console.log({ call_1_reply: reply, error });
  });
  node2.call(direct[0], "test-ep", { luke: "i am your mother" }, (reply, error) => {
    console.log({ call_2_reply: reply, error });
  });
  (async () => {
    const r3 = await node2.promise.call(direct[0], "test-ep", { abc: 123 });
    console.log({ call_3_reply: r3 });
    const r4 = await node2.promise.call(direct[0], "test-ep", { abc: 123 });
    console.log({ call_3_reply: r4 });
  })();
});
