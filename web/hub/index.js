import { $, annotate_copyable, on_key, loadHighlightCSS } from '../lib/utils.js';
import WsCall from './lib/ws-call.js';
import modal from './lib/modal.js';

const dayms = 1000 * 60 * 60 * 24;
const ws_api = new WsCall("admin.api");
const report = (o) => ws_api.report(o);
const call = (c, a) => ws_api.call(c, a);
const context = { };

loadHighlightCSS();

function org_list() {
  call("org_list", {}).then(list => {
    const html = [
      '<div class="head">',
      '<label>name</label>',
      '<label>uid</label>',
      '<label>secret</label>',
      '<label>status</label>',
      '<label>creator</label>',
      '<label>created</label>',
      '<label>actions</label>',
      '</div>',
    ];
    const orgs = context.orgs = {};
    for (let org of list) {
      const { uid, name, secret, creator, created, state, up } = org;
      const date = dayjs(created).format('YYYY/MM/DD HH:mm');
      html.push([
        `<div class="data${up ? " connected": ""}">`,
        `<label class="copyable">${name}</label>`,
        `<label class="copyable">${uid}</label>`,
        `<label class="copyable">${secret}</label>`,
        `<label>${state}</label>`,
        `<label>${creator}</label>`,
        `<label>${date}</label>`,
        `<label class="actions">`,
        `<button onClick="orgfn_edit('${uid}')">?</button>`,
        `<button onClick="orgfn_delete('${uid}','${name}')">X</button>`,
        `</label>`,
        '</div>',
      ].join(''));
      orgs[uid] = org;
    }
    $('org-list').innerHTML = html.join('');
    annotate_copyable();
  }).catch(report);
}

function org_edit(uid) {
  const rec = context.orgs[uid];
  if (!rec) throw `invalid org uid: ${uid}`;
  const edit = {
    name: $('edit-name'),
    admin: $('edit-admin'),
  }
  modal.show('org-edit', "edit org record", {
    update(b) {
      org_update(rec.uid, {
        name: edit.name.value,
        admins: edit.admin.value.split('\n').map(t => t.trim()),
      });
    },
    cancel: undefined,
  });
  edit.name.value = rec.name;
  edit.admin.value = (rec.admins || []).join('\n');
}

function org_logs(uid) {
    const rec = context.orgs[uid];
    if (!rec) throw `Invalid org uid: ${uid}`;
    const range = { };
    const buttons = { };
    const nb = modal.show('org-logs', "org logs", {
      '<<': () => {
          const from = parseInt(range.from, 36) - dayms;
          range.update(from.toString(36), (from + dayms).toString(36));
          return false;
      },
      '>>': () => {
          const from = parseInt(range.from, 36) + dayms;
          range.update(range.from.toString(36), (from + dayms).toString(36));
          return false;
      },
      closed: undefined,
    });
    Object.assign(buttons, nb);
    range.update = (start, end) => 
          call("org logs", { 
                org_id: uid, 
                start, end 
          }).then(logs => {
                if (!(logs && logs.length)) {
                  return;
                }
                  const first = range.from = logs[0][0];
                  const last = range.to = logs[logs.length-1][0];
                  const output = $('show-logs');
                  if (!range.min || first < range.min) range.min = first;
                  if (!range.max || last > range.min) range.max = last;
                  buttons['>>'].disabled = range.to >= range.max;
                  output.innerHTML = logs.map(row => {
                      return [
                          '<div>',
                          '<label>',
                          dayjs(parseInt(row[0],36)).format('YYYY/MMM/DD HH:mm:ss'),
                          '</label>',
                          hljs.highlight(JSON.stringify(row[1]), { language: 'json' }).value,
                          '</div>'
                      ].join(" ");
        }).join("\n");
        output.scrollTop = output.scrollHeight;
    });
    range.update();
}

function org_delete(uid, name) {
  confirm(`Are you sure you want to delete "${name}"?`) &&
    call("org_delete", { uid }).then(org_list).catch(report);
}

function org_create() {
  const name = $('org-name').value;
  if (!name) {
    alert('missing org name');
  } else {
    call("org_create", { name, creator: "unknown" }).then(org_list).catch(report);
  }
}

function org_update(uid, rec) {
    call("org_update", { uid, rec }).then(org_list).catch(report);
}

window.orgfn = {
  list: org_list,
  edit: org_edit,
  logs: org_logs,
  create: org_create,
  delete: org_delete,
};

window.$ = $;

document.addEventListener('DOMContentLoaded', function () {
  modal.init(context, "modal.html");
  ws_api.on_connect(org_list);
  $('create-org').onclick = org_create;
  on_key('Enter', 'org-name', (ev) => {
      org_create();
      $('org-name').value = '';
  });
});