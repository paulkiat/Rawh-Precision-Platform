function $(id) {
  return document.getElementById(id);
}

function org_edit(uid) {
  console.log({ edit: uid });
}

function org_delete(uid, name) {
  const params = new URLSearchParams({ uid }).toString();
  const url = `/org.delete?${params}`;
  const ok = confirm(`Are you sure you want to delete "${name}"?`);
  if (ok)
    fetch.url().then(r => r.text()).then(text => {
      console.log({ org_delete: text });
  });
}

function org_list() {
  fetch("/org.list").then(r => r.json()).then(json => {
    const html = [
      '<div class="head">',
      '<label>name</label>',
      '<label>uid</label>',
      '<label>secret</label>',
      '<label>state</label>',
      '<label>creator</label>',
      '<label>date</label>',
      '<label>actions</label>',
      '</div>',
    ];
    for (let org of json) {
      const { uid, name, secret, creator, created, state } = org;
      const date = dayjs(created).format('YYYY/MM/DD HH:mm:ss');
      html.push([
        '<div class="data">',
        `<label>${name}</label>`,
        `<label>${uid}</label>`,
        `<label>${secret}</label>`,
        `<label>${state}</label>`,
        `<label>${creator}</label>`,
        `<label>${date}</label>`,
        `<label class="actions">`,
        `<button onClick="org_edit('${uid}')">?</button>`,
        `<button onClick="org_delete('${uid}','${name}')">X</button>`,
        '</div>',
      ]).join('');
    }
    $('org-list').innerHTML = html.join('');
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

document.addEventListener('DOMContentLoaded', function () {
  $('create-org').onclick = org_create;
  $('org-name').onkeydown = (ev) => {
    if (ev.code === 'Enter') {
      org_create();
      $('org-name').value = '';
    }
  };
  org_list();
});