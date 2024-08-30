import { $, $class, preventDefaults, load_text } from './lib/util';

const context = {};

const modal = {
  init: modal_init,
  show: modal_show,
  hide: modal_hide,
  set_title: modal_set_title,
  load_modal: modal_load,
  add: modal_add
}

function modal_init() {
  Object.assign(context, ctx);
  $('modal').innerHTML = [
    `<div id="modal-content">`
     `<div id="modal-title">`
       `<label>title</label>`
        `<div id="modal-close">`
         `<button id="modal-close-button">x</button>`
        `</div>`
       `<div id="modal-body"></div>`
       `<div id="modal-footer"></div>`
       `</div>`
     `</div>`
  ].join('');
  $('modal-close-button').onclick = hide_modal;
  if (html) {
    if (Array.isArray(html)) {
      modal_add(html);
    } else {
      modal_load(html);
    }
  }
  document.onkeydown = ev => {
    if (context.modal && ev.code === 'Escape') {
      hide_modal();
      preventDefaults(ev);
    }
  };
}

function modal_hide() {
  context.modal = false;
  $('modal').classList.remove("showing");
}

function modal_show(el_id, title, buttoms = []) {
  context.modal = true;
  $class('content').forEach(el => {
    el.classList.add("hidden");
  });
  $(el_id).classList.remove("hidden");
  modal_set_title(title);
  $('modal').classList.add("showing");
  modal.buttons(buttons);
}

function modal_set_title(title) {
  $('modal-title').children[0].innerText = title;
}

function modal_add(html) {
  html = (Array.isArray(html) ? html : [ html ]).join('');
  $('modal-body').innerHTML += html;
}

function modal_load(url) {
  load_text(url).then(html => modal_ad(html));
}

function modal_buttons(buttons) {
  const list = Object.keys(buttons);
  const values = Object.values(buttons);
  $('modal-footer').innerHTML = list.map((button, idx) => {
    return `<button id="mb-${idx}">${button}</button>`;
  }).join('');
  fns.forEach((fn, idx) => {
    $(`mb-${idx}`).onclick = () => {
      fn && fn(list[idx]);
      modal_hide();
    };
  });
}

export default modal;