const util = require('../lib/util');
const log = util.logpre('auth');
const web_api = require('./web-api');
const crypto = require('crypto');
const context = {};

exports.init = function (state) {
  const { meta, node } = state;
  log({ initialize: "auth service" });
  context.state = state;
  context.meta_ssn = meta.sub("sub");
  context.meta_user = meta.sub("user");
  node.handle("list_users", list_user);
  node.handle("get_user", get_user);
  node.handle("set_user", set_user);
  node.handle("auth_user", auth_user);
  node.handle("ssn_logout", ssn_logout);
};

async function cull_dead_session() {
  const { meta_ssn } = context;
  const now = Date.now();
  const batch = await meta_ssn.batch();
  for await (const [key, rec] of meta_ssn.iter()) {
    if (rec.expires < now) {
      log({ ssn_expire: key });
      batch.del(key);
    }
  }
  await batch.write();
}

setInterval(cull_dead_session, 5000);

function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function get_user(args) {
  const { meta_user } = context;
  return await meta_user.get(args.username);
}

async function set_user(args) {
  const { meta_ssn, meta_user } = context;
  const { ssn } = args;
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
async function auth_user(args) {
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
        const is_admin = org_admin =  await web_api_is_admin(user);
        if (is_admin && pass === pass2 && secret === state.secret) {
          // todo validate secret and create admin account
          log({ creating_admin_record: user, pass, pass2, secret });
          await meta_user.put(user, urec = {
            password: hash(pass),
          });
        } else {
            return is_admin ? { init: true } : error("invalid credentials");
        }
      } else {
        org_admin = await web_api.is_admin(user);
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
