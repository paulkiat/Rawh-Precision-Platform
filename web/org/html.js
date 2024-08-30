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
  const { uid, type, name, creator, created, users, date } = data;
  html.push(
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
  );
}

export function user_header(html) {
  html.push(
    '<div class="head">',
    '<label>name</label>',
    '<label>actions</label>',
    '</div>',
  );
}

export function user_line(html, data) {
  const { name } = data;
  html.push(
    '<div class="data">',
    `<label>${name}</label>`,
    `<label class="actions">`,
    `<button onClick="appfn.edit('${uid}')">?</button>`,
    `<button onClick="appfn.delete('${uid}','${name}')">X</button>`,
    `</label>`,
    '</div>',
  );
}