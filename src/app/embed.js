// text embedding service takes text chunks and returns vectors
// TODO: modify doc service to use embed service for better scaling options

const util = require('../lib/util');
const state = require('./service').init();
const log = util.logpre('embed');
const { debug, model } = util.args;

// respond to requests looking for docs services for an app
async function register_service() {
  const { app_id, node } = state;
  // announce presence
  node.publish("service-up", {
    app_id,
    type: "embed-server",
    subtype: "rawh-v0"
  });
  // bind api service endpoints
  node.handle([ "embed", app_id ], embed);
}

async function embed(msg) {
  return state.embed.vectorize(msg.text);
}

(async () => {
  const { embed } = await require('../llm/api').init();
  await embed.setup({ modelName: model });

  Object.assign(state, { embed });

  // re-connect the doc app when the proxy connection bounces
  state.node.on_reconnect(register_service);
  await register_service();
})();
