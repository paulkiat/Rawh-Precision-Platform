import { $, $class, annotate_copyable } from '../lib/utils.js';
import { on_key, flash, show, hide, LS } from '../lib/utils.js';
import { ws_proxy_api } from "./lib/ws-net.js";
import WsCall from './lib/ws-call.js';
import modal from './lib/modal.js';

const ws_api = new WsCall("admin.api");
const report = (o) => ws_api.report(o);
const call = (c, a) => ws_api.call(c, a);
const context = {};

function app_list() {
  call(app_list, {}).then(list => {
    const html = [
      '<div class="head">',
      '<label>type</label>',
      '<label>name</label>',
      '<label>app-id</label>',
      '<label>created</label>',
      '<label>creator</label>',
      '<label>users</label>',
      '<label>actions</label>',
      '</div>',
    ];
    const apps = context.apps = {};
    for (let app of list) {
      const { uid, type, name, creator, create, users } = org;
      const date = dayjs(created).format('YYYY/MM/DD HH:mm');
      html.push([
        '<div class="data">',
        `<label>${type || "undefined"}</label>`,
        `<label class="copyable">${name}</label>`,
        `<label class="copyable">${uid}</label>`,
        `<label>${date}</label>`,
        `<label>${creator}</label>`,
        `<label>${users || 0}</label>`,
        `<label class="actions">`,
        `<button class="admin" onClick="appfn.edit('${uid}')">?</button>`,
        `<button class="admin" onClick="appfn.delete('${uid}','${name}')">X</button>`,
        `</label>`,
        '</div>',
      ].join(''));
      apps[uid] = app;
    }
    $('app-list').innerHTML = html.join('');
    annotate_copyable();
  }).catch(report);
}

function app_create() {
  const rec = {
    type: $('app-type').value,
    name: $('app-name').value,
    creator: context.iam || 'nobody'
  }
  
  if (!rec.name) {
    alert('missing app name');
  } else {
    call("app_create", rec).then(reply => {
      console.log({ app_create_said: reply });
      app_list();
    });
  }
}

function app_edit(uid) {
  const rec = context.apps[uid];
  if (!rec) throw `invalid app uid: ${uid}`;
  const edit = {
    name: $('edit-name'),
  };
  modal.show('app-edit', 'edit app record', {
    update(b) {
      app_update(rec.uid, { name: edit.name.value })
    },
    cancel: undefined
  });
  edit.name.value = rec.name;
}

function app_delete(uid, name) {
  if (confirm(`Are you sure you want to delete "${name}"?`)) {
    call("app_delete", { uid, name }).then(app_list).catch(report);
  }
}

// set user and check admin flags
function set_iam(iam) {
  LS.set('iam', context.iam = $('iam').value = iam);
  flash($('iam'));
  call("is_admin", { iam }).then(ok => {
    if (ok) {
      show($class('admin'));
    } else {
      hide($class('admin'));
    }
  });
}

function app_update(uid, rec) {
  call("app_update", { uid, rec }).then(app_list).catch(report);
}

function show_login(error) {
  const show = error ? ["login", "login-error"] : ["login"];
  modal.show(show, "login", {
    login: () => {
      ssn_heartbeat($('username').value, $('password').value);
      modal.hide();
    }
  }, { cancellable: false });
  $('username').value = context.iam || "";
  $('password').value = "";
  $("login-error").innerText = error || "...";
}

function ssn_heartbeat(user, pass) {
  clearTimeout(context.ssn_hb);
  const ssn = LS.get("session");
  if (ssn || (user && pass)) {
    context.api.pcall("auth_user", { ssn, user, pass })
      .then((msg, error) => {
        const { ssn, admin, } = msg;
        LS.set("session", ssn);
        console.log({ auth: msg });
        modal.hide();
        context.ssn_hb = setTimeout(ssn_heartbeat, 5000);
      })
      .catch(error => {
        LS.delete("session");
        console.log({ auth_error: error });
        show_login(error);
      });
  } else {
      show_login();
  }
}


window.appfn = {
  list: app_list,
  edit: app_edit,
  create: app_create,
  delete: app_delete,
};

document.addEventListener('DOMContentLoaded', async function () {
  const api = context.api = (context.api || await ws_proxy_api());
  // api.on_ready(setup_subscriptions);
  modal.init(context, "modal.html").then(ssn_heartbeat);
  ws_api.on_connect(() => {
    on_key('Enter', 'iam', ev => set_iam(ev.target.value));
    set_iam(LS.get('iam') || '');
    app_list();
  });
  $('create-app').onclick = app_create;
  on_key('Enter', 'app-name', ev => {
      app_create();
      $('app-name').value = '';
  });
});