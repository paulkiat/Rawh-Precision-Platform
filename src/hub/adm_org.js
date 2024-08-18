/** api for managing org data */
const util = require('../lib/util');
const log = util.logpre('org');
const env = { };

function init(state) {
  const { meta } = state;
  Object.assign(env, {
    state,
    meta,
    orgs: meta.sub('org')
  })
}

async function create(name, creator) {
  const { orgs } = env;
  const uid = util.uid();
  const exists = get_by_name(name);
  // prevent creating two orgs with the same name

  if (exists) {
    throw "duplicate org name";
  }
  // create org record stub, assign new uid and return it
  await orgs.put(uid, {
    name: name || "unknown",
    creator: creator || "unknown",
    created: Date.now(),
    state: 'pending'
  });
  return { uid };
}

async function get_by_uid(uid) {
  const { orgs } = env;
  const rec = await orgs.get(uid);
  if (!rec) throw `no org with uid: ${uid}`;
  return rec;
}

async function get_by_name(name) {
  const { orgs } = env;
  const list = await orgs.list({ limit: Infinity });
  log({ name, list });
  for (let [uid, rec] of list) {
    log({ uid, rec });
    if (rec.name === name) {
      return [ uid, rec ];
    }
  }
  throw `no org named: ${name}`;
}

Object.assign(exports, {
  create,
  init,
  get_by_uid,
  get_by_name
});