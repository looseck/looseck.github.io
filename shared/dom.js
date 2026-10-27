/* Shared DOM helpers. Kept dependency-free so every module can use them. */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
};

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ESCAPE_MAP[character]);
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
