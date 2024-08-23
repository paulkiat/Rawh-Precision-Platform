// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

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
      return new Promise(resolve => {
        api.call(topic, msg, resolve);
      });
    }
  };
  return new Promise(resolve => {
    ws_connect("/proxy.api", ws => {
      ctx.ws = ws;
      resolve(api);
    }, event => {
      console.log({ data: event_data });
      const { mid, msg, topic, error } = JSON.parse(event.data);
      console.log({ mid, msg, topic, error });
      const handler = ctx.once[mid];
      delete ctx.once[mid];
      if (error) {
        throw error;
      }
      handler(msg, topic);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const api = await ws_proxy_api();
  console.log({ api });
  const add = await api.pcall("add", { a: 100, b: 200 }).catch(error => {
    console.log({ error });
  });
  console.log({ add });
  api.call("add", { a: 200, b: 400 }, (result, topic) => {
    console.log({ result, topic });
  });
});

document.getElementById('circuit-board-toggle').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.toggle('active');
});

document.getElementById('close-circuit-board').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.remove('active');
});


