// provides web-socket handlers for net (node/api/proxy) access

const { protocol, hostname, port, pathname } = location;

function uuid() {
  return 'xxxx-xxxx-xxxxx-xxxx-xxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ws_connect(wsPath = "/", on_open, on_msg, retry = 10000) {
  const wsProtocol = protocol === 'https:' ? 'wss://' : 'ws://';
  const wsHost = hostname;
  const wsPort = port ? ':' + port : '';
  const wsUrl = wsProtocol + wsHost + wsPort + pathname + wsPath;
  const ws = new WebSocket(wsUrl);

  ws.onopen = (event) => {
    // ws.send(JSON.stringify({ fn: "call", topic: "ping", msg: "123" }));
    on_open(ws, event);
  }

  ws.onmessage = on_msg;

  ws.onerror = (event) => {
    console.error('ws error:', event);
  };

  ws.onclose = (event) => {
    console.log('ws connection closed:', event);
    setTimeout(() => { ws_connect(wsPath, on_open, on_msg, retry) }, retry);
  };
}

async function ws_proxy_api() {
  const ctx = {
    send: (msg) => {
      ctx.ws.send(JSON.stringify(msg));
    },
    once: {},
    subs: {},
    ready: []
  };
  const api = {
    publish: (topic, msg) => {
      ctx.send({ fn: "publish", topic, msg });
    },
    subscribe: (topic, handler) => {
      topic = topic.replace("$", ctx.app_id || 'unknown');
      ctx.subs[topic] = handler;
      ctx.send({ fn: "subscribe", topic });
    },
    call: (topic, msg, handler) => {
      const mid = uuid();
      ctx.once[mid] = handler;
      ctx.send({ fn: "call", topic, msg, mid });
    },
    send: (topic, msg) => {
      ctx.send({ fn: "send", topic, msg });
    },
    pcall: (topic, msg) => {
      return new Promise((resolve, reject) => {
        api.call(topic, msg, (msg, error, topic) => {
          if (error) {
            reject(error);
          } else {
            resolve(msg);
          }
        });
      });
    },
    on_ready: (fn) => {
      if (ctx.app_id) {
        fn(ctx.app_id);
      } else {
        ctx.ready.push(fn);
      }
    }
  };

  return new Promise(resolve => {
    ws_connect("proxy.api", ws => {
      ctx.ws = ws;
      resolve(api);
    }, event => {
      const ws_msg = JSON.parse(event.data);
      const { pub, msg, app_id } = ws_msg;
      if (app_id) {
        ctx.app_id = app_id;
        console.log({ app_id });
        ctx.ready.forEach(fn => fn(app_id));
      } else if (pub) {
          const handler = ctx.subs[pub];
          if (handler) {
            handler(msg, pub);
          } else {
            console.log({ missing_sub: pub, subs: ctx.subs });
          }
       } else {
          const handler = ctx.once[mid];
          delete ctx.once[mid];
          if (!handler) {
            console.log({ missing_once: mid });
          } else if (error) {
            handler(undefined, error, topic)
            } else {
            handler(msg, undefined, topic);
          }
        }
    });
  });
}