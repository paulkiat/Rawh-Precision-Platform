import { $, annotate_copyable } from '../lib/utils.js';
import { ws_connect} from '../lib/ws-net.js';
import ws_api from './ws-api.js';

function app_list() {
  ws_api.app_list().then(list => {
    const html = [
      '<div class="head">',
      '<label>name</label>',
      '<label>app-id</label>',
      '<label>created</label>',
      '<label>creator</label>',
      '<label>actions</label>',
      '</div>',
    ];
    for (let org of list) {
      const { uid, name, creator, created } = org;
      const date = dayjs(created).format('YYYY/MM/DD HH:mm');
      html.push([
        '<div class="data">',
        `<label class="copyable">${name}</label>`,
        `<label class="copyable">${uid}</label>`,
        `<label>${date}</label>`,
        `<label>${creator}</label>`,
        `<label class="actions">`,
        `<button onClick="appfn.edit('${uid}')">?</button>`,
        `<button onClick="appfn.delete('${uid}','${name}')">X</button>`,
        `</label>`,
        '</div>',
      ].join(''));
    }
    annotate_copyable();
    $('app-list').innerHTML = html.join('');
  });
}

function app_create() {
  const name = $('app-name').value;
  if (!name) {
    alert('missing app name');
  } else {
    ws_api.app_create(name).then(reply => {
      console.log({ app_create_said: reply });
      app_list();
    });
  }
}

function app_edit(uid) {
  console.log({ edit: uid });
}

function app_delete(uid, name) {
  if (confirm(`Are you sure you want to delete app "${name}"?`)) {
    ws_api.app_delete(uid, name).then(app_list);
  }
}

window.appfn = {
  list: app_list,
  edit: app_edit,
  create: app_create,
  delete: app_delete,
};

document.addEventListener('DOMContentLoaded', function() {
  ws_connect('admin.api', (ws) => {
    ws_api.on_connect(ws);
    app_list();
  }, ws_api.on_message);
  $('create-app').onclick = app_create;
  $('app-name').onkeydown = (ev) => {
    if (ev.code === 'Enter') {
      app_create();
        $('app-name').value = '';
    }
  };
});