import { $, $class, preventDefaults, load_text, to_array } from './lib/util';

const context = {};

const modal = {
  init: modal_init,
  show: modal_show,
  hide: modal_hide,
  set_title: modal_set_title,
  load_modal: modal_load,
  add: modal_add,
  get showing() { return context.showing ? true : false }
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
  document.onkeydown = ev => {
    if (context.showing && ev.code === 'Escape') {
      hide_modal();
      preventDefaults(ev);
    }
  };
  if (html) {
    if (Array.isArray(html)) {
      modal_add(html);
    } else {
      return modal_load(html);
    }
  }
}

function modal_hide(force) {
  if (force || context.cancellable) {
    context.showing = false;
    $('modal').classList.remove("showing");
  }
}

function modal_show(el_id, title, buttoms = []) {
  context.showing = true;
  const cc = context.cancellable = opt.cancellable !== false;
  $('modal-close-button').style.display = cc ? '' : 'none';
  $class('content').forEach(el => {
    el.classList.add("hidden");
  });
  to_array(el_id).forEach(el_id => {
    $(el_id).classList.remove("hidden");
  });
  modal_set_title(title);
  $('modal').classList.add("showing");
  return modal.buttons(buttons);
}

function modal_set_title(title) {
  $('modal-title').children[0].innerText = title;
}

function modal_add(html) {
  html = (Array.isArray(html) ? html : [ html ]).join('');
  $('modal-body').innerHTML += html;
}

function modal_load(url) {
  return load_text(url).then(html => modal_ad(html));
}

function modal_buttons(buttons) {
  const list = Object.keys(buttons);
  const fns = Object.values(buttons);
  const btns = {};
  $('modal-footer').innerHTML = list.map((button, idx) => {
    return `<button id="mb-${idx}">${button}</button>`;
  }).join('');
  fns.forEach((fn, idx) => {
  const btn = $(`mb-${idx}`);
  btns[list[idx]] = btn;
  btn.onClick = () => {
      const res = (fn && fn(list[idx]));
      if (res !== false) {
          modal_hide();
      }
    };
  });
  return btns;
}

export default modal;