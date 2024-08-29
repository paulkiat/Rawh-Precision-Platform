// web socket api client to org admin serfic
import { json, parse, uid } from '../lib/util.js';

const context = {
  calls: {}
};

function report(error) {
  console.error(error);
}

export function on_connect(socket) {
  context.ws = socket;
}

export function on_message(msg) {
  const { cid, args, error } = parse(msg.data);
  const handler = context.calls[cid];
  if (handler) {
    delete context.calls[cid];
    handler(args, error);
  } else {
    // todo: something else
    console.log({ api_ws_msg: msg });
  }
}

function send(msg) {
  context.ws.send(json(msg));
}

async function call(cmd, args) {
  const msg = {
    cid: uid(),
    cmd,
    args,
  };
  return new Promise((resolve, reject) => {
    context.calls[msg.cid] = function (args, error) {
      if (error) {
        reject(error)
      } else {
        resolve(args);
      }
    };
    send(msg);
  });
}

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