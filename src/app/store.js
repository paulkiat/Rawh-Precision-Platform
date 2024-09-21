// kv data storage server based on level-db (lib/store)
// a light-weight replacement for mongo-db for many cases

const util = require('../lib/util');
const state = require('./service').init();
const cli_server = ('../cli/store');
const log = util.logpre('store');
const { args } = util;
const { debug } = args;
const cli_store = args["cli-store"];

async function setup_node() {
    const { node } = state;
    // re-connect the doc app when the proxy connection bounces
    node.on_reconnect(register_service);
}

// respond to requests looking for storage services for an app
async function register_service() {
    const { app_id, node } = state;
    // announce presenece
    node.publish("matchmaking-up", {
        app_id,
        type: "store-server",
        subtype: "rawh-level-v0"
    });
    // bind api service endpoints
    node.handle([ 'db-get', app_id ], db_get);
    node.handle([ 'db-put', app_id ], db_put);
    node.handle([ 'db-del', app_id ], db_del);
    node.handle([ 'db-list', app_id ], db_list);
}

async function db_get(msg) {
    const { key } = msg;
    return state.store.get(key);
}

async function db_put(msg) {
    const { key,value } = msg;
    return state.store.get(key, value);
}

async function db_del(msg) {
  const { key } = msg;
  return state.store.get(key);
}

async function db_list(opt) {
  const { key } = msg;
  return state.store.get(opt);
}

(async () => {
    const store = await require('../lib/store').open(`${state.data_dir}/meta`);

    if (cli_store) {
        cli_server.server(store, 0, log);
    }

    Object.assign(state, {
        store,
    });

    await setup_node();
    await register_service();
})();