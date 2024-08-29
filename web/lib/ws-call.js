// web socket api client (browser) for implement function calls

import { json, parse, uid } from './utils.js';
import { ws_connect } from './ws-net.js';

class WsCall {
  #context = {
    on_connect: [],
    calls: {},
    ws: undefined
  };

  constructor(wsPath) {
    ws_connect(wsPath, ws => this.#_on_connect(ws), msg => this.#_on_message(msg));
  }

  report(error) {
    console.error(error);
  }

  on_connect(fn) {
    this.#context.on_connect.push(fn);
    this.#context.ws && fn();
  }

  #_on_connect(fn) {
    this.#context.ws = socket;
    this.#context.on_connect.forEach(fn => fn());
  }

  #_on_message(msg) {
    const { cid, args, error } = parse(msg.data);
    const handler = this.#context.calls[cid];
    if (handler) {
      delete this.#context.calls[cid];
      handler(args, error);
    } else {
      // todo: something else
      console.log({ api_ws_msg: msg });
    }
  }

  #_send(msg) {
    this.#context.ws.send(json(msg));
  }

  async call(cmd, args) {
    const msg = {
      cid: uid(),
      cmd,
      args,
    };
    const calls = this.#context.calls;
    return new Promise((resolve, reject) => {
      calls[msg.cid] = function (args, error) {
        if (error) {
          reject(error)
        } else {
          resolve(args);
        }
      };
      this.#_send(msg);
    });
  }

}


export default WsCall;
