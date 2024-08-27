// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

const { protocol, hostname, port } = location;

function $(id) {
  return document.getElementById(id);
}

function uuid() {
  return 'xxxx-xxxx-xxxxx-xxxx-xxxx'.replace(/[x]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ws_connect(wsPath = "/", on_open, on_msg, retry = 2000) {
  const wsProtocol = protocol === 'https:' ? 'wss://' : 'ws://';
  const wsHost = hostName;
  const wsPort = port ? ':' + port : '';
  const wsUrl = wsProtocol + wsHost + wsPort + wsPath;
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
    once: {}
  };
  const api = {
    publish: (topic, msg) => {
      ctx.send({ fn: "publish", topic, msg });
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
    }
  };
  return new Promise(resolve => {
    ws_connect("/proxy.api", ws => {
      ctx.ws = ws;
      resolve(api);
    }, event => {
      const { mid, msg, topic, error } = JSON.parse(event.data);
      const handler = ctx.once[mid];
      delete ctx.once[mid];
      if (!handler) {
        console.log({ missing_once: mid });
      } else if (error) {
        handler(undefined, error, topic)
      } else {
        handler(msg, undefined, topic);
      }
    });
  });
}

async function on_load() {
  const api = window.proxy_api = (window.proxy_api || await ws_proxy_api());
  
  api.pcall("add", { a: 100, b: 200 })
    .then((add1) => {
      console.log({ add1 });
    }).catch((ad1_error) => {
      console.log({ ad1_error });
    });
  // const add1 = await api.pcall("add", { a: 100, b:200 });
  // console.log({ add1 });
  api.call("add", { a: 200, b: 400 }, (add2, error, topic) => {
    console.log({ add2, topic, error });
  });
}

document.getElementById('circuit-board-toggle').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.toggle('active');
});

document.getElementById('close-circuit-board').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.remove('active');
});

document.addEventListener('DOMContentLoaded', on_load);
window.proxy_test = on_load;
