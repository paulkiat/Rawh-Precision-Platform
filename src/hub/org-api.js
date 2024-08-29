/** api for managing org data */
/**00|--> swim-lane pre-flight checklist -> */
/**01|------> init(sate) -----------------> */
/**02|-------> create: your creator ------> */
/**03|---------> refresh: timestep state attr from (a) -> (b) */
/****\__Closed__/->_object( environment, [state, meta, orgs] ) */

// 00
const util = require('../lib/util');
const log = util.logpre('org');
const env = { };

// 01.i
function init(state) {
  const { meta } = state;
  Object.assign(env, {
    state,
    meta,
    orgs: meta.sub('org')
  })
}

// 02
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
// 02.ii
async function list() {
  return (await env.orgs.list()).map(row => {
    return {
      uid: row[0],
      ...row[1]
    };
  });
}

// 03
async function update(uid, rec) {
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