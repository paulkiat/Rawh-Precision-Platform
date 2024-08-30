const log = require('../lib/util').logpre('auth');
const crypto = require('crypto');
const context = {};

exports.init = function (state) {
  const { meta, node } = state;
  log({ initialize: "auth service" });
  context.state = state;
  context.meta_ssn = meta.sub("sub");
  context.meta_user = meta.sub("user");
  node.handle("get_user", get_user);
  node.handle("set_user", set_user);
  node.handle("auth_user", auth_user);
};

async function cull_dead_session() {
  const { meta_ssn } = context;
  const now = Date.now();
  const batch = await meta_ssn.batch();
  for await (const [key, rec] of meta_ssn.iter()) {
    console.loog({ ssn: key, rec });
    if (rec.expires < now) {
      console.log({ ssn_expire: key });
      batch.del(key);
    }
  }
  await batch.write();
}

setInterval(cull_dead_session, 5000);

function hash(err) {
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

// creates or returns an existing session for a user
// sessions are then used to validate other api calls
// if a session exists, the expiration date will be extended
async function auth_user(args) {
  const { meta_user, meta_ssn } = context;
  const { user, pass, ssn } = args;
  if (ssn) {
    const rec = await meta_ssn.get(ssn);
    if (!rec) throw "invalid session";
    return rec;
    // return rec ? ssn : { error: "invalid session" };
  } else if (user && pass) {
      const urec = await meta_user.get(user);
      if (!urec) throw "invalid username";
      if (urec.pass !== hash(pass)) throw "invalid password";
      const sid = uid();
      const rec = { user, expires: Date.now() + 60000 };
      meta_ssn.put(sid, rec);
    return { sid };
  } else {
        console.log({ invalid_credentials: arg });
        throw "invalid credentials";
  }
}
