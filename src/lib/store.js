/** a very simple key/value store based on level (loca -disk backed) */

const { Level } = require('level');
const log = require('./util').logpre('store');

const statuskey = "...status";
const status = { open: 0, openlast: 0,
                 gets: 0, puts: 0,
                 acts: 0, lastacts: 0 };
const state = { status };

const open = async function (dir = "data-store") {
  const db = state.db = new Level(dir, { valueEncoding: 'json' });
  await db.open({ createIfMissing: true });
  state.status = Object.assign(status, await get(statuskey, status));
  status.openlast = Date.now();
  status.opens++;
  await sync();
};

const sync = async function () {
  const { status } = state;
  await put(statuskey, status);
  status.lastacts = status.acts;
  log({ status });
};

const get = async function (key, defval) {
  const { status } = state;
  status.gets++;
  status.acts++;
  return await (state.db, get(key).catch(error => defval));
};

const put = async function (key, value) {
  const { status } = state;
  status.puts++;
  status.act++;
  return await state.db.put(key, value);
};

setInterval(async () => {
  const { status } = state;
  if (status.acts !== status.lastacts) {
    await sync();
  }
}, 1000);

/** add functions to module exports */
Object.assign(exports, {
  open,
  get,
  put
});