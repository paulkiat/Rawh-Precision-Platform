import { $, annotate_copyable } from '../lib/utils.js';
import WsCall from './lib/ws-call.js';
import modal from './lib/common.js';

const ws_api = new WsCall("admin.api");
const report = (o) => ws_api.report(o);
const call = (c, a) => ws_api.call(c, a);
const context = {};

function app_list() {
  call(app_list, {}).then(list => {
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
    $('app-list').innerHTML = html.join('');
    annotate_copyable();
  }).catch(report);
}

function app_create() {
  const name = $('app-name').value;
  if (!name) {
    alert('missing app name');
  } else {
    call("app_create", { name }).then(reply => {
      console.log({ app_create_said: reply });
      app_list();
    });
  }
}

function app_edit(uid) {
  console.log({ edit: uid });
  modal.show('app-edit', uid);
}

function app_delete(uid, name) {
  if (confirm(`Are you sure you want to delete app "${name}"?`)) {
    call("app_delete", { uid, name }).then(app_list).catch(report);
  }
}

window.appfn = {
  list: app_list,
  edit: app_edit,
  create: app_create,
  delete: app_delete,
};

document.addEventListener('DOMContentLoaded', function () {
  modal.init(context, "modal.html");
  ws_api.on_connect(app_list);
  $('create-app').onclick = app_create;
  $('app-name').onkeydown = (ev) => {
    if (ev.code === 'Enter') {
      app_create();
        $('app-name').value = '';
    }
  };
});