export class ErreurHttp extends Error {
  constructor(statut, message, details) {
    super(message);
    this.statut = statut;
    this.details = details;
  }
}

/** Lève une 400 si la condition est fausse. */
export function exiger(condition, message) {
  if (!condition) throw new ErreurHttp(400, message);
}

export function introuvable(quoi = 'Élément') {
  return new ErreurHttp(404, `${quoi} introuvable`);
}

/** Convertit une valeur de formulaire en nombre, ou null si vide. */
export function nombre(valeur, { min, entier = false, nom = 'Valeur' } = {}) {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  const n = Number(valeur);
  exiger(Number.isFinite(n), `${nom} doit être un nombre`);
  if (entier) exiger(Number.isInteger(n), `${nom} doit être un entier`);
  if (min !== undefined) exiger(n >= min, `${nom} doit être supérieur ou égal à ${min}`);
  return n;
}

/** Convertit une date de formulaire (YYYY-MM-DD ou ISO) en Date, ou null si vide. */
export function date(valeur, nom = 'Date') {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  const d = new Date(valeur);
  exiger(!Number.isNaN(d.getTime()), `${nom} invalide`);
  return d;
}

export function entierId(valeur, nom = 'Identifiant') {
  const n = Number(valeur);
  if (!Number.isInteger(n) || n <= 0) throw new ErreurHttp(400, `${nom} invalide`);
  return n;
}
