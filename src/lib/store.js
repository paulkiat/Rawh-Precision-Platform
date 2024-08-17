/** a very simple key/value store based on level db (local-disk backed) */

const { Level } = require('level');
const log = require('./util').logpre('store');
const fsp = require('fs/promises');
const util = require('./util');
const byline = require('readline');
const { json, parse } = util;

async function open(dir = "data-store") {

  const state = { };

  const db = state.db = new Level(dir, { valueEncoding: 'json' });
  await db.open({ createIfMissing: true });


  const get = async function (key, defval) {
    return await (db.get(key).catch(error => defval));
  };

  const put = async function (key, value) {
    return await db.put(key, value);
  };

  const del = async function (key) {
    return await db.del(key).catch(error => 0);
  };

  const list = async function (opt = { limit: 100 }) {
    return await db.iterator(opt).all();
  };

  const clear = async function (opt = {}) {
    return await db.clear(opt);
  };

  const dump = async function (pre = "db") {
    const path = `${pre}-${util.uid()}`;
    const handle = await fsp.open(path, 'w');
    let recs = 0;
    for await (const [key, value] of db.iterator({})) {
      handle.write(json([key, value]));
      handle.write("\n");
      recs++;
    }
    handle.close();
    return { path, recs };
  };

  const load = async function (path) {
    const handle = await fsp.open(path, 'r');
    let recs = 0;
    const reader = byline.createInterface({
      input: handle.createReadStream(),
      crlfDelay: Infinity
    });

    for await (const line of reader) {
      const [key, value] = parse(line);
      await db.put(key, value);
      console.log(key, value);
      recs++;
    }

      await handle.close();
      return { recs };
    };

  return {
    get,
    put,
    del,
    list,
    dump,
    load,
    clear
  };
};

/** http(s) endpoint handler for storing admin/exploration */
function web_admin(state, key) {
  return function (chain, pass) {
    const { req, res, url, qry } =  chain;
    const store = state[key];
    if (qry.limit !== undefined) {
      qry.limit = parseInt(qry.limit);
    }
    switch (url.pathname) {
      case `/${key}.get`:
        store.get(qry.key).then(rec => {
          res.end(json(rec, 4));
        });
        return;
      case `/${key}.del`:
        store.del(qry.key).then(ok => {
          res.end(ok === undefined ? 'ok' : 'fail' );
        });
        return;
      case `/${key}.keys`:
        store.list({ ...qry, keys: true, values: false }).then(rec => {
          res.end(json(rec.map(a => a[0]), 4));
        });
        return;
      case `/${key}.recs`:
        store.list({ ...qry, keys: true, values: true }).then(recs => {
          res.end(json(recs, 4));
        });
        return;
      case `/${key}.dump`:
        store.dump(key).then((out) => {
          res.end(json(out));
        });
        return;
      case `/${key}.clear`:
        store.clear().then((out) => {
          res.end(json(out || "ok"));
        });
        return;
      case `/${key}.load`:
        store.load(qry.path).then((out) => {
          res.end(json(out));
        });
        return;
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