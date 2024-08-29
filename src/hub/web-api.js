/** server-side simple curl-able REST admin api */

const util = require('../lib/util');
const log = util.logpre('adm');
const { json } = util;

function setup(state) {
  return function (req, res, next) {
    admin_handler(req, res, next, state);
  }
}

async function admin_handler(req, res, next, state) {
  const { url, query } = req.parsed;
  const { meta, logs, adm_org } = state;
  const { name, creator, uid } = query;
  switch (url.pathname) {
    case '/state':
      return log({ state });
    case '/uid':
      return res.end(util.uid());
    case 'org/list':
      return res.end(json(await adm_org.list()));
    case 'org/create':
      return res.end(json({ orgid: await adm_org.create(name, creator) }));
    case 'org/delete':
      return res.end(json({ orgid: await adm_org.delete_by_uid(uid) }));
    case '/org.byname':
      const kv = await adm_org.get_by_name(name);
        if (!kv) {
          res.end(json({ error: "`no org: ${name" }));
        } else {
          const [ uid, rec ] = kv;
          res.end(json({ uid, rec }));
        }
      return;
    case '/org.byuid':
      const rec = adm_org.get_by_uid(uid);
        if (rec) {
          res.end(json(rec));
        } else {
          res.end(json({ error: `no org id: ${uid}`}));
        }
      return;
    default:
        return next();
  }
}

exports.setup = setup;