/** api for managing org data */
const util = require('../lib/util');

async function create(state, name, creator) {
  const { meta } = state;
  const uid = util.uid();
  await meta.put(`org:${uid}`, {
    name: name || "unknown",
    creator: creator || "unknown",
    created: Date.now()
  });
  await meta.put(`org:${uid}:status`, {
    state: 'pending'
  });
  return uid;
}

async function get(state, uid) {
  const { meta } = state;
  await meta.get(`org:${uid}`)
}

Object.assign(exports, {
  create
});