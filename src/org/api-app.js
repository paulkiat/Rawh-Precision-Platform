/** 
 * web socket api handler (node/server) for org site admin (apps/users) 
 */

const log = require('../lib/util').logpre('api');
const router = require('express').Router();
const { file_drop } = require('../app/doc-client');
const { json, parse, uuid, uid } = require('../lib/util');
const context = { 
    alive: {},
    direct: {}
};

exports.init = function (state) {
  context.state = state;
  const { meta, logs, node } = context.state;
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
  app_list,
  app_create,
  app_update,
  app_delete,
};

async function app_create(args) {
  const { meta_app } = context;
  const { type, name, creator, admins, users, app_id } = args;
  const app_names = (await meta_app.vals()).map(r => r.name);
  if (app_names.indexOf(name) >= 0) {
    throw "app name already exists";
  }
  const app_uid = app_id || uid().toUpperCase();
  const app_rec = {
    uid: app_uid,
    type,
    name,
    creator: creator || "unknown",
    created: Date.now(),
    admins: admins || [],
    users: users || [],
  };
  await meta_app.put(app_rec.uid, app_rec);
  return app_rec;
}

async function app_list(args) {
  const { meta_app } = context;
  // TODO: user and org admin status should come from session id/record
  const { user, admin } = args;
  const apps = (await meta_app.list())
    .map(rec => rec[1])
    .filter(app => {
      app.alive = context.alive[app.uid];
      app.direct = context.direct[app.uid];
      return admin
          || (app.users && app.users.indexOf(user) >= 0)
          || (app.admins && app.admins.indexOf(user) >= 0)
      
    });
  return apps;
}

async function app_update(args) {
  const { uid, rec } = args;
  // limits updates to a subset of fields
  const apprec = await context.meta_app.get(uid);
  const { name, users, admins } = rec;
  if (apprec) {
    Object.assign(apprec, {
      name: name || apprec.name,
      users: users || apprec.users,
      admins: admins || apprec.admins,
    });
    await context.orgs.put(uid, apprec);
  } else {
    throw `invalid update app name "${name}`;
  }
}

async function app_delete(args) {
  const { meta_app } = context;
  const { uid } = args;
  return await meta_app.del(uid);
}

// marks an app as alive for the app_list()
// returns false if app_id is invalid
async function regiester_app(args) {
  const { meta_app } = context;
  const { app_id } = args;
  const apprec = await meta_app.get(app_id);
  if (apprec) {
      context.alive[app_id] = Date.now();
  }
  return apprec ? true : false;
}

async function is_org_admin(args) {
  const { meta } = context.state;
  return (await meta.get("org-admins")).indexOf(args.username) >= 0;
}

async function has_app_perms(args) {
    const { app_id, user } = args;
    const apprec = await context_meta_app.get(app_id);
    const { users, admins } = apprec || {};
    return (users || []).indexOf(user) >= 0 || (admins || []).indexOf(user) >= 0;
}

function set_app_direct(args) {
  const { app_id, host, port } = args;
  log({ app_direct: app_id, host, port });
  context.direct[app_id] = { host, port };
}

function set_app_proxy(args) {
  const { app_id } = args;
  log({ app_proxy: app_id });
  delete context.direct[app_id];
}

exports.commands = commands;
exports.web_handler = router;
exports.regiester_app = (app_id) => regiester_app({ app_id });
exports.is_org_admin = (username) => is_org_admin({ username });
exports.has_app_perms = (app_id, user) => has_app_perms({ app_id, user });
exports.set_app_direct = (app_id, host, port) => set_app_direct({ app_id, host, port });
exports.set_app_proxy = (app_id) => set_app_proxy({ app_id });
