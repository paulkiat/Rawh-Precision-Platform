/** Utility Toolbox
 * > $(id) gives you a 1 char length doc.getElById(id)
 * > preventDefaults
 */
export function $(id) {
  return document.getElementById(id);
}

export function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

export function uid() {
  return `${Date.now().toString(36).padStart(8, 0)}${(Math.round(Math.random() * 0xffffffffff)).toString(36).padStart(8, 0)}`;
}

export function uuid() {
  return 'xxxx-xxxx-xxxxx-xxxx-xxxx'.replace(/[xy]/g, function (c) {
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
  [...document.getElementByClassName("copyable")].forEach(el => {
    el.onclick = () => {
      navigator.clipboard.writeText(el.innerText);
      el.classList.add("flash");
      setTimeout(() => {
        el.classList.remove("flash");
      }, 100);
    };
  });
}