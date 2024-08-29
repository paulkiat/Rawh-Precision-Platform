import { $, $class, annotate_copyable, preventDefaults } from '../lib/utils.js';

const context = {};

function org_list() {
  fetch("/org.list").then(r => r.json()).then(list => {
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
      const { uid, name, secret, creator, created, state } = org;
      const date = dayjs(created).format('YYYY/MM/DD HH:mm');
      html.push([
        '<div class="data">',
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
  });
}

function setup_modal() {
  $('modal-close-button').onclick = hide_modal;
  document.onkeydown = ev => {
    if (context.modal && ev.code === 'Escape') {
      hide_modal();
      preventDefaults(ev);
    }
  };
}

function hide_modal() {
  context.modal = false;
  $('modal').classList.remove("showing");
}

function show_modal(el_id) {
  context.modal = true;
  $class('content').forEach(el => {
    el.classList.add("hidden");
  });
  $(el_id).classList.remove("hidden");
  $('modal').classList.add("showing");
}

function org_edit(uid) {
  const rec = context.orgs[uid];
  console.log({ edit: uid, rec });
  if (!rec) throw `invalid org uid: ${uid}`;
  show-modal('org-edit');
}

function org_delete(uid, name) {
  const params = new URLSearchParams({ uid }).toString();
  const url = `/org.delete?${params}`;
  const ok = confirm(`Are you sure you want to delete "${name}"?`);
  if (ok) fetch(url).then(r => r.text()).then(text => {
      console.log({ org_delete: text });
      org_list();
  });
}

function org_create() {
  const name = $('org-name').value;
  if (!name) {
    alert('missing org name');
  } else {
    const params = new URLSearchParams({ name, creator: "unknown" }).toString();
    const url = `/org.create?${params}`;
    fetch(url).then(r = r.json()).then(json => {
      org_list();
    });
  }
}

window.orgfn = {
  list: org_list,
  edit: org_edit,
  create: org_create,
  delete: org_delete,
};

document.addEventListener('DOMContentLoaded', function() {
  setup_modal();
  $('create-org').onclick = org_create;
  $('org-name').onkeydown = (ev) => {
    if (ev.code === 'Enter') {
      org_create();
      $('org-name').value = '';
    }
  };
  org_list();
});