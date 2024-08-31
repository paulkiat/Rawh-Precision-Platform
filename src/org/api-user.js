const util = require('../lib/util');
const log = util.logpre('auth');
const crypto = require('crypto');
const api_app = require('./api-app');
const context = {};

exports.init = function (state) {
  const { meta, node } = state;
  log({ initialize: "auth service" });
  context.state = state;
  context.meta_ssn = meta.sub("sub");
  context.meta_user = meta.sub("user");
  node.handle("user_add", user_add);
  node.handle("user_del", user_del);
  node.handle("user_get", user_get);
  node.handle("user_set", user_set);
  node.handle("user_list", user_list);
  node.handle("user_auth", user_auth);
  node.handle("user_reset", user_reset);
  node.handle("ssn_logout", ssn_logout);
};

async function cull_dead_session() {
  const { meta_ssn } = context;
  const now = Date.now();
  const batch = await meta_ssn.batch();
  for await (const [key, rec] of meta_ssn.iter()) {
    if (rec.expires < now) {
      // log({ ssn_expire: key });
      batch.del(key);
    }
  }
  await batch.write();
}

setInterval(cull_dead_session, 5000);

function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function user_add(args) {
  // TODO requires authenticated session
  const { meta_user } = context;
  const { user, pass } = args;
  const users = await user_list();
  if (users.indexOf(user) >= 0) {
    throw "username already exists";
  }
  return await meta_user.put(user, {
    created: Date.now(),
    password: hash(pass || ''),
  });
}

async function user_list(args) {
  // TODO requires authenticated session
  const { meta_user } = context;
  const list = (await meta_user.keys()).map(name => { return { name } });
  for (let rec of list) {
    rec.is_admin = await api_app.is_org_admin(rec.name);
  }
  return list;
}

async function user_del(args) {
  // TODO requires authenticated session
  const { meta_user } = context;
  return await neta_user.del(args.user);
}
async function user_get(args) {
  const { meta_user } = context;
  // TODO requires authenticated session
  return await meta_user.get(args.user);
}

async function user_set(args) {
  const { meta_user } = context;
  const { user, rec } = args;
  const orec = await user_get({ user });
  const nurec = Object.assign(orec, rec);
  return await meta_user.put(user, nurec);
}

async function user_reset(args) {
  // TODO requires authenticated session
  const { user, pass } = args;
  const rec = await user_get(args);
  if (rec) {
    await user_set({
      user,
      rec: {
        ...rec,
        updated: Date.now(),
        password: hash(pass || '')
      }
    });
  }
}

function error(msg) {
  throw msg;
}

async function ssn_logout(args) {
  const { ssn } = args;
  ssn && await meta_ssn.del(ssn);
  return { ssn };
}

// creates or returns an existing session for a user
// sessions are then used to validate other api calls
// if a session exists, the expiration date will be extended
async function user_auth(args) {
  const { state, meta_user, meta_ssn } = context;
  const { ssn, user, pass, pass2, secret } = args;
  if (ssn) {
    const rec = await meta_ssn.get(ssn);
    if (rec) {
      rec.expires = Date.now() + 60000;
      await meta_ssn.put(ssn, rec);
      return rec;
    } else {
        throw "invalid session";
    }
  } else if (user && pass) {
      let urec = await meta_user.get(user);
      let org_admin = false;
      if (!urec) {
        const is_admin = org_admin =  await api_app.is_org_admin(user);
        if (is_admin && pass === pass2 && secret === state.secret) {
          // todo validate secret and create admin account
          log({ creating_admin_record: user, pass, pass2, secret });
          await user_add({ user, pass });
          urec = await user_get(user);
        } else {
            return is_admin ? { init: true } : error("invalid credentials");
        }
      } else {
        org_admin = await api_app.is_org_admin(user);
      }
      if (urec.pass !== hash(pass)) {
        throw "invalid password";
      }
      const sid = util.uid();
      const srec = {
        sid,
        user,
        org_admin,
        expires: Date.now() + 60000
      };
      meta_ssn.put(sid, srec);
    return srec;
  } else {
        console.log({ invalid_credentials: arg });
        throw "missing session and credentials";
  }
}
