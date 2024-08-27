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

  setup_file_drop();
}

document.getElementById('circuit-board-toggle').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.toggle('active');
});

document.getElementById('close-circuit-board').addEventListener('click', function() {
    document.getElementById('circuit-board-overlay').classList.remove('active');
});

document.addEventListener('DOMContentLoaded', on_load);
window.proxy_test = on_load;
