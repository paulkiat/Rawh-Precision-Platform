// base service class for any application service
// this includes web and front end, document storage, llm services, etc

const { node, host_addrs } = require('../lib/net');
const { args, env } = require('../lib/util');

const state = { };
const app_id = env('APP-ID') || args['app-id'];
let is_init = false;

Object.assign(state, {
  app_id,
  data_dir: `data/app/${app_id}`,
  net_addrs: host_addrs(),
  proxy_host: env('PROXY_HOST') || args['proxy-host'] || 'localhost',
  proxy_host: env('PROXY_POST') || args['proxy-port'] || 6000,
  node: undefined, // added during init()
  orglog
});

// org-wide persisted events log which are synced to rawh hub
function orglog(msg, scope) {
    state.node.publish(`logger/${scope || state.app_id || "org"}`, msg);
}

exports.init = function () {
  if (!is_init) {
    if (!app_id) {
      throw ("missing app id");
    }
    const { proxy_host, proxy_port } = state;
    state.node = node(proxy_host, proxy_port);
    is_init = true;
  }
  return state;
};