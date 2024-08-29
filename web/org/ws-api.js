// web socket api client (browser) to org admin services
import { json, parse, uid } from './lib/util.js';
import { on_connect, on_message, call, report } from './lib/ws-call.js'

export async function app_create(name) {
  return call("app_create", { name }).catch(report);
}

export function app_delete(uid, name) {
  return call("app_delete", { uid, name }).catch(report);
}

export async function app_list() {
  return call("app_list");
}

export default {
  on_connect,
  on_message,
  app_create,
  app_delete,
  app_list
}