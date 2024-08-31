/** generate html fragments for apps and users tables */

export function apps_headers(html) {
  html.push(
    '<div class="head">',
    '<label>type</label>',
    '<label>name</label>',
    '<label>app-id</label>',
    '<label>created</label>',
    '<label>creator</label>',
    '<label>users</label>',
    '<label>actions</label>',
    '</div>',
  );
}

export function apps_line(html, data) {
  const { uid, type, name, creator, created, users, admins, date, admin, alive } = data;
  const app_admin = (admins || []).indexOf(iam) >= 0;
  html.push(
    '<div class="data">',
    `<label>${type || "undefined"}</label>`,
    `<label class="copyable">${name}</label>`,
    `<label class="copyable">${uid}</label>`,
    `<label>${date}</label>`,
    `<label>${creator}</label>`,
    `<label>${users || 0}</label>`,
    `<label class="actions">`,
    (admin || app_admin) ? `<button class="admin" onClick="appfn.edit('${uid}')">?</button>` : '',
    admin ? `<button class="admin" onClick="appfn.delete('${uid}','${name}')">X</button>` : '',
    `<button  ${alive ? '' : 'diabled'} onClick="appfn.launch('${uid}')">launch</button>`,
    `</label>`,
    '</div>',
  );
}

export function users_header(html) {
  html.push(
    '<div class="head">',
    '<label>name</label>',
    '<label>org admin</label>',
    '<label>actions</label>',
    '</div>',
  );
}

export function users_line(html, data) {
  const { name, is_admin } = data;
  html.push(
    '<div class="data">',
    `<label>${name}</label>`,
    `<label>${is_admin}</label>`,
    `<label class="actions">`,
    `<button onClick="userfn.reset('${name}')">reset</button>`,
    `<button onClick="userfn.delete('${name}','${name}')">X</button>`,
    `</label>`,
    '</div>',
  );
}