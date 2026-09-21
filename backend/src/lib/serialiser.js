/**
 * Prépare une valeur Prisma pour la réponse JSON : les Decimal deviennent des
 * nombres (le front n'a pas à parser des chaînes), les Date des ISO strings.
 */
export function serialiser(valeur) {
  if (valeur === null || valeur === undefined) return valeur;
  if (Array.isArray(valeur)) return valeur.map(serialiser);
  if (valeur instanceof Date) return valeur.toISOString();
  if (typeof valeur === 'object') {
    // Decimal (decimal.js) : expose toNumber() et ses chiffres dans `d`
    if (typeof valeur.toNumber === 'function' && Array.isArray(valeur.d)) return valeur.toNumber();
    const objet = {};
    for (const [cle, v] of Object.entries(valeur)) objet[cle] = serialiser(v);
    return objet;
  }
  return valeur;
}
