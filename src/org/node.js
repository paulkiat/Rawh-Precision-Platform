// implements org node functions
// listen for app registrations, serve meta data

const log = require('../lib/util').logpre('node');
const net = require('../lib/net');

exports.init = (state) => {
  node = net.node('localhost', state.proxy_port);
  node.subscribe('app-up', (msg, cid, topic) => {
    log({ topic, cid, msg });
    const app_id = msg;
    node.publish(cid, { too_u: { "dog": "poo" } });
    node.publish([ app_id, "config" ],  { config: { for: "real" } })
  });
};
