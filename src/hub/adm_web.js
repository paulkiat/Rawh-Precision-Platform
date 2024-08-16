/** simple curl-able web admin api */

const orgadm = require('./adm_org');
const util = require('../lib/util');
const log = prelog('./webadm.js');
const { json } = util;

function handler(state) {
  return function (chain, pass) {
    admin_handler(state, chain, pass);
  }
}

function admin_handler(state, chain, pass) {
  const { req, res, url, qry } = chain;
  const { meta, logs } = state;
  switch (url.pathname) {
    case '/state':
      log({ state });
      break;
    case '/uid':
      return res.end(util.uid());
    case 'org/create':
      const { name, creator } = qry;
      orgadm.create(state, name, creator)
        .then((uid) => {
          res.end(json({ orgid: uid }));
        })
        .catch(err => {
          log({ err });
          res.end('error creating org');
        });
      return;
    default:
      break;
  }
  res.end('< rawh hub admin >');
}

exports.handler = handler;