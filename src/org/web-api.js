/** web socket api handler (node/server) for org site admin (apps/users) */

const log = require('../lib/util').logpre('api');
const router = require('express').Router();
const { file_drop } = require('../app/doc-client');
const { json, parse, uuid, uid } = require('../lib/util');
const context = { };

exports.init = function (state) {
  context.state = state;
  const { meta, logs } = context.state;
  context.meta_app = meta.sub("app");
  // attach file drop handler (for proxied apps)
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
}

const commands = {
  is_admin,
  app_list,
  app_create,
  app_update,
  app_delete,
};
async function app_create(args) {
  const { meta_app } = context;
  const { type, name, creator } = args;
  const app_names = (await meta_app.vals()).map(r => r.name);
  if (app_names.indexOf(name) >= 0) {
    throw "app name already exists";
  }
  const app_uid = uid().toUpperCase();
  const app_rec = {
    uid: app_uid,
    type,
    name,
    creator: creator || "unknown",
    created: Date.now(),
    users: 0
  };
  await meta_app.put(app_rec.uid, app_rec);
  return app_rec;
}

async function app_list() {
  const { meta_app } = context;
  const apps = await meta_app.list();
  return apps.map(rec => rec[1]);
}

async function app_update(args) {
  const { uid, rec } = args;
  // limits updates to a subset of fields
  const old = await context.orgs.get(uid);
  if (old) {
    Object.assign(old, {
      name: rec.name ?? old.name,
    });
    return await context.orgs.put(uid, old);
  }
}

async function app_delete(args) {
  const { meta_app } = context;
  const { uid } = args;
  return await meta_app.del(uid);
}

async function is_admin(args) {
  const { meta } = context.state;
  return (await meta.get("org-admins")).indexOf(args.iam) >= 0;
}

exports.web_handler = router;