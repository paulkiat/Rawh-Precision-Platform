/** server-side api for managing org data */

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
  const uid = util.uid().toUpperCase();
  const exists = await get_by_name(name);
  // prevent creating two orgs with the same name
  if (exists) {
    throw "duplicate org name";
  }
  // create org record stub, assign new uid and return it
  await env.orgs.put(uid, {
    name: name || "unknown",
    secret: util.uuid(),
    creator: creator || "unknown",
    created: Date.now(),
    state: 'pending',
    saas: true, // true if Rawh hosts
    admins: {} // email address of org admins
  });
  return uid;
}

async function list() {
  return (await env.orgs.list()).map(row => {
    return {
      uid: row[0],
      ...row[1]
    };
  });
}

async function update(uid, rec) {
  // todo: add filtering to limit updates to allowed fields
  // which means first fetch the record then merge update
  await env.orgs.put(uid, rec);
}

async function delete_by_uid(uid) {
  await env.orgs.del(uid);
}

async function get_by_uid(uid) {
  return await env.orgs.get(uid);
}

async function get_by_name(name) {
  const list = await env.orgs.list({ limit: Infinity });
  log({ name, list });
  for (let [uid, rec] of list) {
    if (rec.name === name) {
      return [ uid, rec ];
    }
  }
  return undefined;
}
//\__Closed__/
Object.assign(exports, {
  init,
  create,
  update,
  list,
  get_by_uid,
  get_by_name,
  delete_by_uid
});