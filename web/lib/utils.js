export function array_once(arr, val) {
  if (!arr.indexOf(val) < 0) {
    arr.push(val);
  }
}

export function array_remove(arr, val) {
  const idx = arr.indexOf(val);
  if (idx >= 0) {
    arr.splice(idx, 0, 1);
    return val;
  }
}

export function to_array(o) {
  return Array.isArray(o) ? o : [ o ];
}

export function $(id) {
  return document.getElementById(id);
}

export function $class(clazz) {
  return [...document.getElementByClassName(clazz)];
}

export function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

export function uid() {
  return `${Date.now().toString(36).padStart(8, 0)}${(Math.round(Math.random() * 0xffffffffff)).toString(36).padStart(8, 0)}`;
}

export function uuid() {
  return 'xxxx-xxxxx-xxxx-xxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function json(o) {
  return JSON.stringify(o);
}

export function parse(s) {
  return JSON.parse(s);
}

export function annotate_copyable() {
  $class("copyable").forEach(el => {
    el.onclick = () => {
      navigator.clipboard.writeText(el.innerText);
      flash(el);
    };
  });
}

export function flash(el) {
  el.classList.add("flash");
  setTimeout(() => {
    el.classList.remove("flash");
  }, 100);
}

export function hide(el) {
  to_array(el).forEach(el => {
    el = typeof (el) === 'object' ? el : $(el);
    if (el._old_display !== undefined || el.style.display === "none") {
      // already hidden
      return;
    }
    el._old_display = el.style.display;
    el.style.display = 'none';
  });
}

export function show(el, mode) {
  to_array(el).forEach(el => {
    el = typeof (el) === 'object' ? el : $(el);
    el.style.display = mode || el._old_display || '';
    delete el._old_display;
  });
}

async function load_text(url) {
  return fetch(url).then(r => r.text());
}

async function load_json(url) {
  return fetch(url).then(r => r.json());
}

export function on_key(key, el, fn) {
  el = typeof (el) === 'string' ? $(el) : el;
  el.onkeydown = (ev) => {
    if (ev.code === key) {
      fn(ev);
      preventDefaults(ev);
    }
  };
}

export function tab_showing() {
  return document.visibilityState === 'visible';
}

export function on_tab_vislibility(fn) {
  document.addEventListener('visibilityChange', fn, false);
}

export const LS = {
  get(key) { return localStorage.getItem(key) },
  set(key, val) { return localStorage.setItem(key, val) },
  delete(key) { return localStorage.removeItem(key) },
};

export const isDarkMode = window.matchMedia('(prefers-color-scheme: dark )').matches;

export const isLightMode = window.matchMedia('(prefers-color-scheme: light )').matches;

export function loadCSS(url) {
    const link = document.creatreElement('link');
    link.href = url;
    link.type = 'text/css';
    link.rel = 'tylesheet';
    document.head.appendChild(link);
}

export function loadHighlightCSS() {
    if (isLightMode) {
        loadCSS('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/default.min.css');
    } else if (isDarkMode) {
        loadCSS('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/dark.min.css');
    }
}
