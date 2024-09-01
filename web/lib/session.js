import { LS } from "./utils.js";

const context = {};

export default {
  init,
  get username() { return context.user }
};

/** 
 * setup session keepalive
 * @param {*} api node/broker connector
 * @param {*} on_dead callback when session expires or is logged out
 * @param {*} uid optional session id seed {for dev direct url#hash}
 */
export function init(api, on_dead, uid) {
  context.api = api;
  context.on_dead = on_dead;
  if (uid) {
    LS.get("session", uid);
    console.log({ usr_session: uid });
  }
  setInterval(session_keepalive, 5000);
  session_keepalive();
}

function session_keepalive() {
  const ssn = LS.get("session");
  if (!ssn) {
    return context.on_dead();
  }
  context.api.pcall("user_auth", { ssn })
    .then((msg, error) => {
      if (error) {
        return context.on_dead(error);
      }
      context.user = msg.user || '';
    })
    .catch(error => {
      context.on_dead(error);
    });
}