/** simnple curl-able web admin api */

const util = require('../lib/util');
const log = util.logpre('link');
const { json } = util;

function setup(state) {
  return function (ws, message) {
    link_handler(state, ws, message);
  }
}

function link_handler(state, ws, message) {
  log({ ws_message: message.toString() });
  ws.send('hello enemy!');
}

exports.setup = setup;