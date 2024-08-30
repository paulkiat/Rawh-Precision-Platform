import { $, $class, annotate_copyable } from './lib/utils.js';
import { on_key, flash, show, hide, LS } from './lib/utils.js';
import { ws_proxy_api } from "./lib/ws-net.js";
import { users_header, users_line } from "./html.js";
import { apps_header, apps_line } from "./html.js";
import WsCall from './lib/ws-call.js';
import modal from './lib/modal.js';

const ws_api = new WsCall("admin.api");
const report = (o) => ws_api.report(o);
const call = (c, a) => ws_api.call(c, a);
const context = {};

function set_user_mode(mode) {
  switch (mode) {
    case "admin":
      show($class('admin-mode'));
      break;
    case "user":
      hide($class('admin-mode'));
      break;
  }
}

function set_edit_mode(mode) {
  switch (mode) {
    case "app":
      show($class('edit-app'));
      hide($class('edit-user'));
      $('set-edit-app').classList.add("selected");
      $('set-edit-user').classList.remove("selected");
      break;
    case "user":
      hide($class('edit-app'));
      show($class('edit-user'));
      $('set-edit-app').classList.remove("selected");
      $('set-edit-user').classList.add("selected");
      user_list();
      break;
  }
}

function user_list() {
  context.api.pcall("list_users", {},).then(list => {
    const html = [];
    users_header(html);
    const users = context.users = {};
    for (let name of list) {
      users_line(html, { name });
      users[name] = name;
      users_list_set(html);
    }
    annotate_copyable();
  }).catch(report);
}

function user_list_set(html) {
  $("user-list").innerHTML = html.join('');
}

function app_list() {
  call(app_list, {}).then(list => {
    const html = [];
    apps_header(html);
    const apps = context.apps = {};
    for (let app of list) {
      const { uid, created } = app;
      const date = dayjs(created).format('YYYY/MM/DD HH:mm');
      apps_line(html, { date, ...app });
      apps[uid] = app;
      app_list_set(html);
    }
    annotate_copyable();
  }).catch(report);
}

function app_list_set(html = []) {
    $('app-list').innerHTML = html.join('');
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
function set_iam(iam, indicate = true) {
  LS.set('iam', context.iam = $('iam').value = iam);
  if (indicate) {
    flash($('iam'));
  }
  call("is_admin", { username: iam }).then(ok => {
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

function login_submit() {
  if (!modal.show) {
    console.log({ cannot_login_submit: "modal not showing" });
    return;
  }
  const user = $('username').value;
  const pass = $('password').value;
  if (context.login.init) {
    ssn_heartbeat(user, pass, $('password2').value, $('secret').value);
  } else {
    ssn_heartbeat(user, pass);
  }
      modal.hide(true);
}
  
function login_show(error, init) {
  if (!context.login_init) {
    hide("login_init");
  }
  const show = error ? [ "login", "login-error" ] : [ "login" ];
  modal.show(show, "login", { login: login_submit }, { cancellable: false });
  $('password').focus();
  $('username').value = context.iam || LS.get("iam") ||"";
  if (init) {
    $('secret').value =  "";
  } else {
    $('password').value = "";
  }
  $("login-error").innerText = error || "...";
}

async function logout() {
  const { api, ssn } = context;
  LS.delete("session");
  await api.call("ssn_logout", { ssn }, ssn_heartbeat);
  set_user_mode('user');
  set_edit_mode('app');
  app_list_set();
  delete context.app_list;
}

function ssn_heartbeat(user, pass, pass2, secret) {
  clearTimeout(context.ssn_hb);
  const ssn = LS.get("session");
  if (ssn || (user && pass)) {
    if (user) {
      set_iam(user, false);
    }
    context.api.pcall("auth_user", { ssn, user, pass, pass2, secret })
      .then((msg, error) => {
        const { sid, init, user, org_admin } = msg;
        if (init) {
          console.log("init", msg);
          $("login-error").classList.add("hidden");
          if (context.login_init) {
            console.log({ failed_admin: user });
            login_show("invalid secret", true);
          }
          show("login-init");
          context.login_init = true;
        } else {
          if (sid) {
            LS.set("session", sid);
          } if (context.login_init) {
              modal.hide(true);
          }
          if (user) {
            set_iam(user, false);
          }
          if (org_admin) {
            set_user_mode('admin');
          } else {
            set_user_mode('user');
          }
          delete context.login_init;
          context.org_admin = org_admin;
          context.ssn_hb = setTimeout(ssn_heartbeat, 10000);
          if (!context.app_list) {
            context.app_list = (context.app_list || 0) + 1;
            app_list();
          }
        } 
      })
      .catch(error => {
        delete context.login_init;
        LS.delete("session");
        login_show(error);
        console.log({ auth_error: error });
      });
  } else {
      login_show();
  }
}

window.appfn = {
  list: app_list,
  edit: app_edit,
  create: app_create,
  delete: app_delete,
};

window.userfn = {
  edit: undefined,
  delete: undefined,
};

document.addEventListener('DOMContentLoaded', async function () {
  context.api = (context.api || await ws_proxy_api());
  modal.init(context, "modal.html").then(() => {
    on_key('Enter', 'password', login_submit);
    show('org', 'flex');
    ssn_heartbeat();
  });
  $('logout').onclick = logout;
  $('create-app').onclick = app_create;
  $('set-edit-app').onclick = () => set_edit_mode('app');
  $('set-edit-user').onclick = () => set_edit_mode('user');
  on_key('Enter', 'app-name', ev => {
      app_create();
      $('app-name').value = '';
  });
  set_user_mode('user');
  set_edit_mode('app');
});