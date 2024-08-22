function $(id) {
  return document.getElementById(id);
}

function app_edit(uid) {
  console.log({ edit: uid });
}

function app_delete(uid, name) {
  const params = new URLSearchParams({ uid }).toString();
  const url = `/org.delete?${params}`;
  const ok = confirm(`Are you sure you want to delete "${name}"?`);
  if (ok)
    fetch.url().then(r => r.text()).then(text => {
      console.log({ app_delete: text });
      app_list();
  });
}

function app_list() {
  fetch("/org.list").then(r => r.json()).then(json => {
    const html = [
      '<div class="head">',
      '<label>name</label>',
      '<label>uid</label>',
      '<label>secret</label>',
      '<label>state</label>',
      '<label>creator</label>',
      '<label>created</label>',
      '<label>actions</label>',
      '</div>',
    ];
    for (let org of json) {
      const { uid, name, secret, creator, created, state } = org;
      const date = dayjs(created).format('YYYY/MM/DD HH:mm');
      html.push([
        '<div class="data">',
        `<label>${name}</label>`,
        `<label>${uid}</label>`,
        `<label>${secret}</label>`,
        `<label>${state}</label>`,
        `<label>${creator}</label>`,
        `<label>${date}</label>`,
        `<label class="actions">`,
        `<button onClick="app_edit('${uid}')">?</button>`,
        `<button onClick="app_delete('${uid}','${name}')">X</button>`,
        '</div>',
      ]).join('');
    }
    $('app-list').innerHTML = html.join('');
  });
}

function app_create() {
  const name = $('app-name').value;
  if (!name) {
    alert('missing org name');
  } else {
    const params = new URLSearchParams({ name, creator: "unknown" }).toString();
    const url = `/org.create?${params}`;
    fetch(url).then(r = r.json()).then(json => {
      app_list();
    });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // $('create-org').onclick = app_create;
  // $('app-name').onkeydown = (ev) => {
  //   if (ev.code === 'Enter') {
  //     app_create();
  //     $('app-name').value = '';
  //   }
  // };
  // app_list();
});