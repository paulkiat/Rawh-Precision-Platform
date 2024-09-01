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
 */
export function init(api, on_dead) {
  context.api = api;
  context.on_dead = on_dead;
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