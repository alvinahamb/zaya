/**
 * CSV simple, compatible Excel FR (séparateur « ; », BOM UTF-8).
 * Colonnes : { cle, titre, valeur?(ligne) } — même forme que les colonnes d'export.
 */
const BOM = String.fromCharCode(0xfeff);

const echapper = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function versCsv(colonnes, lignes) {
  const entete = colonnes.map((c) => echapper(c.titre)).join(';');
  const corps = lignes.map((l) => colonnes.map((c) => echapper(c.valeur ? c.valeur(l) : l[c.cle])).join(';'));
  return BOM + [entete, ...corps].join('\r\n');
}

/** Découpe un texte CSV en tableau de cellules (guillemets, retours à la ligne dans les champs). */
export function lireCsv(texte) {
  const contenu = texte.startsWith(BOM) ? texte.slice(1) : texte;
  const premiereLigne = contenu.split(/\r?\n/, 1)[0];
  const separateur = [';', ',', '\t'].reduce((a, b) => (premiereLigne.split(b).length > premiereLigne.split(a).length ? b : a));

  const rangees = [];
  let rangee = [];
  let cellule = '';
  let guillemets = false;
  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i];
    if (guillemets) {
      if (c === '"' && contenu[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === separateur) {
      rangee.push(cellule);
      cellule = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && contenu[i + 1] === '\n') i++;
      rangee.push(cellule);
      rangees.push(rangee);
      rangee = [];
      cellule = '';
    } else cellule += c;
  }
  if (cellule || rangee.length) {
    rangee.push(cellule);
    rangees.push(rangee);
  }
  return rangees.filter((r) => r.some((x) => x.trim()));
}

export const normaliser = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

/** Rangées CSV → objets indexés par `cle`, en reconnaissant l'en-tête par titre ou par clé. */
export function enregistrements(colonnes, rangees) {
  const [entete = [], ...corps] = rangees;
  const cles = entete.map((t) => colonnes.find((c) => normaliser(c.titre) === normaliser(t) || normaliser(c.cle) === normaliser(t))?.cle);
  return corps.map((r) => Object.fromEntries(cles.map((cle, i) => [cle, (r[i] ?? '').trim()]).filter(([cle]) => cle)));
}

/* ---- Conversions à l'import ---- */

/** « 1 234,50 », « 1234.5 », « 12 000 Ar » → nombre ; vide → null. */
export function nombreCsv(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const s = String(v).replace(/[^\d,.-]/g, '');
  const n = Number(s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : v;
}

/** « 2026-09-28 », « 28/09/2026 », « 28/09/2026 14:30 » → format accepté par l'API ; vide → null. */
export function dateCsv(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (fr) {
    const [, j, m, a, h, min] = fr;
    const jour = `${a}-${m.padStart(2, '0')}-${j.padStart(2, '0')}`;
    return h ? `${jour}T${h.padStart(2, '0')}:${min}` : jour;
  }
  return s.replace(' ', 'T');
}

/** Code d'une liste de libellés ({ code: 'Libellé' }) à partir du code ou du libellé ; vide → undefined. */
export function codeCsv(v, libelles) {
  if (!v) return undefined;
  const n = normaliser(v);
  return Object.entries(libelles).find(([code, libelle]) => normaliser(code) === n || normaliser(libelle) === n)?.[0] ?? v;
}

/** Identifiant d'un élément retrouvé par son nom (ou son id) ; lève une erreur lisible sinon. */
export function idParNom(v, liste, quoi, champ = 'nom') {
  if (!v) return null;
  const n = normaliser(v);
  const trouve = (liste ?? []).find((x) => normaliser(x[champ]) === n || String(x.id) === String(v).trim());
  if (!trouve) throw new Error(`${quoi} « ${v} » introuvable`);
  return trouve.id;
}

/** « Instagram, Facebook » → ids. */
export function idsParNoms(v, liste, quoi) {
  return String(v ?? '')
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => idParNom(x, liste, quoi));
}
