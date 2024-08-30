import { $, $class, preventDefaults } from './lib/util';

const context = {};

const modal = {
  init: modal_init,
  show: modal_show,
  hide: modal_hide,
  set_title: modal_set_title,
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
       `</div>`
     `</div>`
  ].join('');
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
  modal_set_title(title);
  $('modal').classList.add("showing");
}

function modal_set_title(title) {
  $('modal-title').children[0].innerText = title;
}

function modal_add(html) {
  html = (Array.isArray(html) ? html : [ html ]).join('');
  const pre = $('modal.content').innerHTML;
  $('modal.content').innerHTML = pre + html;
}

export default modal;