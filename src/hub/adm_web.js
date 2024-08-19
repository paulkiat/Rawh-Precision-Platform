/** simple curl-able web admin api */

const util = require('../lib/util');
const log = util.logpre('adm');
const { json } = util;

function setup(state) {
  return function (chain, pass) {
    admin_handler(state, chain, pass);
  }
}

function admin_handler(state, chain, pass) {
  const { req, res, url, qry } = chain;
  const { meta, logs, adm_org } = state;
  const { name, creator, uid } = qry;
  switch (url.pathname) {
    case '/state':
      log({ state });
      break;
    case '/uid':
      return res.end(util.uid());
    case 'org/create':
      adm_org(name, creator)
        .then (uid => res.end(json({ orgid: uid })))
        .catch (error => res.end(json({ error })));
      return;
    case '/org.byname':
      adm_org.get_by_name(name)
        .then(kv => {
          if (!kv) {
            res.end(json({ error: "`no org: ${name" }));
          } else {
            const [uid, rec] = kv;
            res.end(json({ uid, rec }));
          }
        })
        .catch(error => res.end(json({ error })));
      return;
    case '/org.byuid':
      adm_org.get_by_uid(uid)
        .then(rec => {
          if (rec) {
            res.end(json(rec));
          } else {
            res.end(json({ error: `no org id: ${uid}` }));
         }
        })
        .catch (error => res.end(json({ error })));
      return;
    default:
        return pass();
  }
}

exports.setup = setup;