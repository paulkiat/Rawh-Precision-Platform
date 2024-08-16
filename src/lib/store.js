/** a very simple key/value store based on level (loca -disk backed) */

const { Level } = require('level');
const log = require('./util').logpre('store');

async function open(dir = "data-store") {
  const statuskey = "...status";
  const status = { opens: 0, openlast: 0, gets: 0, puts: 0, lists: 0, acts: 0, lastacts: 0 };
  const state = { status };

  const db = state.db = new Level(dir, { valueEncoding: 'json' });
  await db.open({ createIfMissing: true });

  const sync = async function () {
    await put(statuskey, status);
    status.lastacts = status.acts;
    // log({ status });
  };

  const get = async function (key, defval) {
    status.gets++;
    status.acts++;
    return await (db.get(key).catch(error => defval));
  };

  const put = async function (key, value) {
    status.puts++;
    status.acts++;
    return await db.put(key, value);
  };

  const list = async function (opt = {}) {
    status.lists++;
    status.acts++;
    return await db.iterator(opt).all();
  };

  state.status = Object.assign(status, await get(statuskey, status));
  status.openlast = Date.now();
  status.opens++;
  await sync();

  setInterval(async () => {
    const { status } = state;
    if (status.acts !== status.lastacts) {
      await sync();
    }
  }, 1000);

  return {
    get,
    put,
    list
  };
};

/** http(s) endpoint handler for storing admin/exploration */
function web_admin(state, key) {
  return function (chain, pass) {
    const { req, res, url, qry } =  chain;
    const store = state[key];
    switch (url.pathname) {
      case `/${key}.get`:
      store.get(qry.key).then(rec => {
        res.end(JSON.stringify(rec, undefined, 4));
      });
        return;
    case `/${key}.keys`:
      store.list({ ...qry, keys: true, values: false }).then(rec => {
        res.end(JSON.stringify(rec.map(a => a[0]), undefined, 4));
      });
        return;
    case `/${key}.recs`:
      store.list({ ...qry, keys: true, values: true }).then(recs => {
        res.end(JSON.stringify(recs, undefined, 4));
      });
        break;
    default:
      return pass();
    }
  }
}

/** add functions to module exports */
Object.assign(exports, {
  open,
  web_admin
});