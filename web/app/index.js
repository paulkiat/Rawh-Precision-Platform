// isHot(); = onHover(), onMouseMove(x,y)
// active(); = onClick(), onMouseDown(), onDrag(), onHover(), onMouseUp()

import { ws_proxy_api } from "./lib/ws-net";

function $(id) {
  return document.getElementById(id);
}
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function setup_file_drop() {
  const dropZone = $('upload');
  const fileSelect = $('abc');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('highlight');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('highlight');
    }, false);
  });
  
  dropZone.addEventListener('drop', (e) => {
    uploadFiles([...e.dataTransfer.files]);
  }, false);

  function uploadFiles(files) {
    files.forEach(file => {
      const type = file.name.split(".").pop().toLowerCase();
      uploadFiles(file, type);
    });
  }

  function uploadFiles(file, type) {
    console.log(`[uploading] ${type}`, file.name)

    const params = { name: file.name, type };
    const formData = new FormData();
    formData.append('file', file);

    let query = Object.keys(params).map(key => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
    }).join('&');

    fetch(`drop?${query}`, {
      method: 'POST',
      body: formData
    })
      .then(response => response.text())
      .then(data => {
        console.log({ drop_ok: data });
      })
      .catch((error) => {
        console.error({ drop_fail: error });
      });
  }

    fileSelect.onchange = function (ev) {
      uploadFiles([...fileSelect.files]);
    };

    dropZone.onclick = () => {
      fileSelect.click();
    };
}

function update_file_list() {
  proxy_api.call("doc-list/$", {}, (msg) => {
    if (!Array.isArray(msg)) {
      return;
    }
    const html = [];
    for (let rec of msg) {
      const { uid, name, type, state, added, chunks, length } = rec[1];
      html.push([
        `<label>${name}</label>`,
        `<label>${length}</label>`,
        `<label>${added}</label>`,
        `<label>${chunks}</label>`,
        `<label class="actions">`,
        `<button onclick="doc_delete('${uid}')")>X</button>`,
        `</label>`
      ].join(''))
    }
    $('file-data').innerHTML = html.join('');
  })
}

function doc_delete(uid) {
  proxy_api.call("doc-delete/$", {uid}, (msg) => {
    console.log({ doc_delete: msg });
    update_file_list();
  });
}

function add_test() {
  proxy_api.pcall("add", { a: 100, b: 200 })
    .then((add1) => {
      console.log({ add1 });
    }).catch((ad1_error) => {
      console.log({ ad1_error });
    });
  // const add1 = await proxy_api.pcall("add", { a: 100, b:200 });
  // console.log({ add1 });
  proxy_api.call("add", { a: 200, b: 400 }, (add2, error, topic) => {
    console.log({ add2, topic, error });
  });
}

function setup_subscriptions() {
  proxy_api.subscribe("doc-loading/$", msg => {
    if (msg.state === 'ready') {
      update_file_list();
    }
  });
  proxy_api.subscribe("doc-delete/$", msg => {
    update_file_list();
  });
};

// document.getElementById('circuit-board-toggle').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.toggle('active');
// });

// document.getElementById('close-circuit-board').addEventListener('click', function() {
//     document.getElementById('circuit-board-overlay').classList.remove('active');
// });

async function on_load() {
  const api = window.proxy_api = (window.proxy_api || await ws_proxy_api());
  api.on_ready(setup_subscriptions);
  setup_file_drop();
  update_file_list();
}
document.addEventListener('DOMContentLoaded', on_load);
window.doc_delete = doc_delete;
window.add_test = add_test;
window.update_file_list = update_file_list;