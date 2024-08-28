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