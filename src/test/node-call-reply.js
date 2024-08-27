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

(async () => {
  const rec = await node2.promise.locate("test-ep")
    .catch (loc_error => {
      console.log({ loc_error });
      return "no ep found";
    });
  console.log({ async_loc_rec: rec });
})();

node2.locate("test-ep", (locate, error) => {
  console.log({ locate, error });
  if (error) {
    console.log({ locate_error: error });
    return;
  }
  const { direct } = locate;
  node2.call(direct[0], "test-ep", { luke: "i am your father" }, (reply, error) => {
    console.log({ call_1_reply: reply, error });
  });
  node2.call(direct[0], "test-ep", { luke: "i am your mother" }, (reply, error) => {
    console.log({ call_2_reply: reply, error });
  });
  (async () => {
    const r3 = await node2.promise.call(direct[0], "test-ep", { abc: 123 }).catch(error_r3 => console.log({ error_r3}));
    console.log({ call_3_reply: r3 });
    const r4 = await node2.promise.call(direct[0], "test-ep", { abc: 123 }).catch(error_4 => console.log({ error_r4 }));
    console.log({ call_4_reply: r4 });
  })();
});
