/** a local key/value store based on level db (local-disk backed) */

const { Level } = require('level');
const log = require('./util').logpre('store');
const fsp = require('fs/promises');
const util = require('./util');
const byline = require('readline');
const { json, parse } = util;

async function open(dir = "data-store", opt = { valueEncoding: 'json' }) {
  const db = new Level(dir, opt);
  await db.open({ createIfMissing: true });
  return wrap(db, dir, true);
};

function wrap(db, name, closeable) {
  // a sub-level is like a prefix with the added benefit
  // of a global db operations being bound by it (like clear)
  const sub = function (pre, opt = { valueEncoding: 'json' }) {
    return wrap(db.sublevel(pre, opt), pre, false);
  };

  const get = async function (key, defval) {
    return await (db.get(key).catch(error => defval));
  };

  const put = async function (key, value) {
    return await db.put(key, value);
  };

  const del = async function (key) {
    return await db.del(key).catch(error => 0);
  };

  const keys = async function (opt = {}) {
    return (await list(Object.assign(opt, { values: false }))).map(r => r[0]);
  }

  const list = async function(opt = { limit: 100 }) {
    return await db.iterator(opt).all();
  };

  const vals = async function (opt = {}) {
    return (await list(Object.assign(opt, { keys: false, values: true }))).map(r => r[1]);
  };

  const iter = function(opt = {}) {
    return db.iterator(opt);
  };

  const batch = async function (arg) {
    return arg ? db.batch(arg) : db.batch();
  };

  const clear = async function (opt = {}) {
    return await db.clear(opt);
  };

  const close = async function () {
    if (closeable) {
      return await db.close();
    }
  }

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
      // console.log(key, value);
      recs++;
    }

      await handle.close();
      return { recs };
    };

  return {
      name,
      sub,
      get,
      put,
      del,
      keys,
      list,
      vals,
      iter,
      dump,
      load,
      clear,
      close,
      batch
  };
}

/** http(s) endpoint handler for storing admin/exploration */
function web_admin(state, dbkey) {
  return function (req, res, next) {
    const { url, query } =  req.parsed;
    const store = state[dbkey];
    if (query.limit !== undefined) {
      query.limit = parseInt(query.limit);
    }
    let tok, db = store;
    const { sub, key } = query;
    delete query.sub;
    delete query.key;
    const subtok = sub ? sub.split('/') : undefined;
    while (subtok && (tok = subtok.shift())) {
      db = db.sub(tok);
    }
    switch (url.pathname) {
      case `/${dbkey}.get`:
        db.get(query.key).then(rec => {
          res.end(json(rec, 4));
        });
        break;
      case `/${dbkey}.del`:
        db.del(query.key).then(ok => {
          res.end(ok === undefined ? 'ok' : 'fail');
        });
        break;
      case `/${dbkey}.keys`:
        db.list({ ...query, keys: true, values: false }).then(rec => {
          res.end(json(rec.map(a => a[0]), 4));
        });
        break;
      case `/${dbkey}.recs`:
        db.list({ ...qry, keys: true, values: true }).then(recs => {
          res.end(json(recs, 4));
        });
        break;
      case `/${dbkey}.dump`:
        db.dump(key).then((out) => {
          res.end(json(out));
        });
        break;
      case `/${dbkey}.clear`:
        db.clear().then((out) => {
          res.end(json(out || "ok"));
        });
        break;
      case `/${dbkey}.load`:
        db.load(qry.path).then((out) => {
          res.end(json(out));
        });
        break;
    default:
      return next();
    }
  }
}

/** add functions to module exports */
Object.assign(exports, {
  open,
  web_admin
});