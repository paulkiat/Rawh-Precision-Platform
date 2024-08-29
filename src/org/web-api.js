/** simple curl-able web admin api (for now) */

const log = require('../lib/util').logpre('api');
const router = require('express').Router();
const { file_drop } = require('../app/doc-client');
const { json, parse, uuid, uid } = require('../lib/util');
const context = { };

exports.init = function (state) {
  context.state = state;
  const { meta, logs } = context.state;
  context.meta_app = meta.sub("apps");
  // setup file drop handler
  router.use(file_drop(state));
};

function send(msg) {
  context.ws.send(json(msg));
}

exports.on_ws_connect = function(ws) {
  context.ws = ws;
}

exports.on_ws_msg = async function (ws, msg) {
  msg = parse(msg.toString());
  const { cmd, cid, args } = msg;
  // get a sub-level for application meta-data
  const cmd_fn = commands[cmd];
  if (cmd_fn) {
    // console.log({ cid, cmd_fn, args });
    if (cid) {
      cmd_fn(args)
        .then(reply => send({ cid, args: reply }))
        .catch(error => {
        log({ cid, args, error });
        send({ cid, error: error.toString() });
      });
    } else {
      cmd_fn(args);
    }
  } else {
    return send({ cid, error: `no matching command: ${cmd}` });
  }
};

async function app_create(args) {
  const { meta_app } = context;
  const { name, creator } = args;
  const app_names = (await meta_app.vals()).map(r => r.name);
  if (app_names.indexOf(name) >= 0) {
    throw "app name already exists";
  }
  const app_uid = uid().toUpperCase();
  const app_rec = {
    uid: app_uid,
    name,
    creator: creator || "unknown",
    created: Date.now()
  };
  await meta_app.put(app_rec.uid, app_rec);
  return app_rec;
}

async function app_delete(args) {
  const { meta_app } = context;
  const { uid } = args;
  return await meta_app.del(uid);
}

async function app_list() {
  const { meta_app } = context;
  const apps = await meta_app.list();
  return apps.map(rec => rec[1]);
}

const commands = {
  app_create,
  app_delete,
  app_list
}

exports.web_handler = router;