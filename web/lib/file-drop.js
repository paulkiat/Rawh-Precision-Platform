import { $, preventDefaults } from './utils.js';

export default function(drop_el, sel_files, css_hover = "drop-hover") {
  const dropZone = typeof drop_el === 'string' ? $(drop_el) : drop_el;
  const fileSelect = typeof sel_files === 'string' ? $(sel_files) : sel_files;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add(css_hover);
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove(css_hover);
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

  function uploadFile(file, type) {
    console.log(`[uploading] (${type})`, file.name)

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

    dropTarget.onclick = () => {
      fileSelect.click();
    };
}