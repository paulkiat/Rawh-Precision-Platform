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
// 01
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
  const { orgs } = env;
  const uid = util.uid();
  const exists = await get_by_name(name);

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
  return uid;
}
// 03
async function update(uid, rec) {
  const { orgs } = env; // User Action --> Objects Re-Action
  await orgs.put(uid, rec);
}
async function get_by_uid(uid) {
  const { orgs } = env;
  return await orgs.get(uid);
}

async function get_by_name(name) {
  const { orgs } = env;
  const list = await orgs.list({ limit: Infinity });
  log({ name, list });
  for (let [uid, rec] of list) {
    if (rec.name === name) {
      return [ uid, rec ];
    }
  }
  return undefined;
}
// 04
Object.assign(exports, {
  init,
  create,
  update,
  get_by_uid,
  get_by_name
});