import { $, $class, annotate_copyable } from './lib/utils.js';
import { on_key, uid, flash, show, hide, LS } from './lib/utils.js';
import { ws_proxy_api } from "./lib/ws-net.js";
import { users_header, users_line } from "./html.js";
import { apps_header, apps_line } from "./html.js";
import WsCall from './lib/ws-call.js';
import modal from './lib/modal.js';

const ws_api = new WsCall("admin.api");
const report = (o) => ws_api.report(o);
const call = (c, a) => ws_api.call(c, a);
const context = {
  login: true
};

function set_user_mode(mode) {
  console.log({ set_user_mode: mode });
  switch (mode) {
    case "admin":
      show($class('admin-mode'));
      break;
    case "user":
      hide($class('admin-mode'));
      break;
    default:
      console.log({ invalid_user_mode: mode });
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
      show($class('edit-user'));
      hide($class('edit-app'));
      $('set-edit-app').classList.remove("selected");
      $('set-edit-user').classList.add("selected");
      user_list();
      break;
    default:
      console.log({ invalid_edit_mode: mode });
      break;
  }
}

function user_list() {
  context.api.pcall("user_list", {},).then(list => {
    const html = [];
    users_header(html);
    const users = context.users = {};
    for (let { name, is_admin } of list) {
      users_line(html, { name, is_admin });
      users[name] = name;
      users_list_set(html);
    }
    annotate_copyable();
  }).catch(report);
}

function user_list_set(html) {
  $("user-list").innerHTML = html.join('');
}

function user_create() {
  const rec = {
    user: $('user-name').value,
    pass: Math.round(Math.random() & 0xffffffff).toString(36)
  };
  if (!rec.user) {
    return alert('missing user name');
  } else {
    context.api.pcall("user_add", rec).then(reply => {
      console.log({ user_create_said: reply });
      user_list();
    }).catch(report);
  }
}

function user_delete(user) {
  if (!user) {
   return alert('missing user name');
  } else {
    if (confirm(`Are you sure you want to delete "${user}"?`)) {
      context.api.pcall("user_del", { user }).then(reply => {
        console.log({ user_delete_said: reply });
        user_list();
      }).catch(report);
    }
  }
}

function user_reset(user) {
  if (!user) {
    return alert('missing user name');
  }
  const pass = prompt(`Set a new password for "${user}`, uid());
  if (pass) {
    context.api.pcall("user_reset", { user, pass }).then(reply => {
      console.log({ user_reset_said: reply });
      user_list();
    }).catch(report);
  }
}


function app_list() {
  call("app_list", { user: context.iam, admin: context.admin }).then(list => {
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
    users: $('edit-users'),
    admins: $('edit-admins'),
  };
  console.log(rec);
  modal.show('app-edit', 'edit app record', {
    update(b) {
      app_update(rec.uid, {
        name: edit.name.value,
        users: edit.users.value.split('\n').map(n => n.trim()),
        admins: edit.admins.value.split('\n').map(n => n.trim())
      })
    },
    cancel: undefined
  });
  edit.name.value = rec.name;
  edit.users.value = (rec.users || []).join("\n");
  edit.admins.value = (rec.admins  || []).join("\n");
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
}

function app_update(uid, rec) {
  call("app_update", { uid, rec }).then(app_list).catch(report);
}

function login_submit() {
  if (!modal.show) {
    console.log({ cannot_login: "modal not showing" });
    return;
  }
  const user = $('username').value;
  const pass = $('password').value;
  if (!(user && pass)) {
    console.log({ cannot_login: "missing user and/or pass" });
    return;
  }
  set_iam(user, false);
  if (context.admin_init) {
    ssn_heartbeat(user, pass, $('password2').value, $('secret').value);
  } else {
    ssn_heartbeat(user, pass);
  }
      modal.hide(true);
}
  
function login_show(error, init) {
  if (!context.admin_init) {
    hide("login_init");
  }
  context.login = true;
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
  console.log({ logout: ssn });
  set_user_mode('user');
  set_edit_mode('app');
  app_list_set();
  LS.delete("session");
  delete context.ssn;
  delete context.app_list;
  api.call("ssn_logout", { ssn }, ssn_heartbeat);
}

function ssn_heartbeat(user, pass, pass2, secret) {
  clearTimeout(context.ssn_hb);
  const ssn = LS.get("session");
  if (ssn || (user && pass)) {
    context.api.pcall("user_auth", { ssn, user, pass, pass2, secret })
      .then((msg, error) => {
        const { sid, init, user, org_admin } = msg;
        // console.log(msg);
        if (init) {
          $("login-error").classList.add("hidden");
          if (context.admin_init) {
            console.log({ failed_admin: user });
            login_show("invalid secret", true);
          }
          show("login-init");
          context.admin_init = true;
        } else {
          delete context.admin_init;
          context.org_admin = org_admin;
          context.ssn_hb = setTimeout(ssn_heartbeat, 5000);
          if (sid) {
            context.ssn = sid;
            LS.set("session", sid);
            if (context.admin_init) {
              modal.hide(true);
            } 
          }
          if (context.login) {
            console.log({ login: sid, user });
            // run once only after successful login or
            // page/session reload, not on heartbeats
            if (org_admin) {
              context.admin = true;
              set_user_mode('admin');
              set_edit_mode('app');
            } else {
              context.admin = false;
              set_user_mode('user');
            }
            if (user) {
              set_iam(user, false);
            }
            delete context.login_init;
          }
          if (!context.app_list) {
            context.app_list = (context.app_list || 0) + 1;
            app_list();
          }
      } 
      })
      .catch(error => {
        delete context.admin_init;
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
  list: user_list,
  reset: user_reset,
  create: user_create,
  delete: user_delete,
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
  $('create-user').onclick = user_create;
  $('set-edit-app').onclick = () => set_edit_mode('app');
  $('set-edit-user').onclick = () => set_edit_mode('user');
  on_key('Enter', 'app-name', ev => {
      app_create();
      $('app-name').value = '';
  });
  on_key('Enter', 'user-name', ev => {
    user_create();
    $('user-name').value = '';
  })
  set_user_mode('user');
  set_edit_mode('app');
});