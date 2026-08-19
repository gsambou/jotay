// Rendu à échappement automatique — JS ESM natif, zéro dépendance (ADR-004).
// Usage : el.replaceChildren(render(html`<div>${donneeServeur}</div>`));
// Chaque ${...} interpolé est échappé ; le HTML statique du gabarit ne l'est pas.

const escapeHtml = (v) =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Marque une chaîne comme HTML déjà sûr (composition de fragments). À n'utiliser que sur
 *  du contenu que TON code a produit, jamais sur de la donnée serveur brute. */
export const safe = (s) => ({ __safe: String(s) });

/** Tagged template : assemble le HTML en échappant chaque interpolation non marquée safe(). */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const chunk = Array.isArray(v)
      ? v.map((x) => (x && x.__safe !== undefined ? x.__safe : escapeHtml(x))).join('')
      : v && v.__safe !== undefined ? v.__safe : escapeHtml(v);
    out += chunk + strings[i + 1];
  }
  return { __safe: out };
}

/** Transforme un fragment html`` en noeuds DOM insérables. */
export function render(fragment) {
  const tpl = document.createElement('template');
  tpl.innerHTML = fragment && fragment.__safe !== undefined ? fragment.__safe : escapeHtml(fragment);
  return tpl.content;
}
