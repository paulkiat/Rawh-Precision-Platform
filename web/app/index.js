// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

import { ws_proxy_api } from "./lib/ws-net.js";

function $(id) {
  return document.getElementById(id);
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
