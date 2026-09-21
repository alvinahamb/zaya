/**
 * Formats français. Deux devises cohabitent : € (prix d'achat, 2 décimales)
 * et Ar (tout le reste, arrondi à l'unité). L'unité est toujours affichée.
 */

const formatEuro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const formatDecimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const vide = (v) => v === null || v === undefined || v === '' || Number.isNaN(Number(v));

export function euro(valeur) {
  if (vide(valeur)) return '—';
  return formatEuro.format(Number(valeur));
}

export function ariary(valeur) {
  if (vide(valeur)) return '—';
  return `${formatEntier.format(Math.round(Number(valeur)))}\u00a0Ar`;
}

export function nombre(valeur) {
  if (vide(valeur)) return '—';
  return formatEntier.format(Number(valeur));
}

/** Pourcentage signé : « +12,5 % » / « −3,0 % ». */
export function pourcentage(valeur, { signe = true } = {}) {
  if (vide(valeur)) return '—';
  const n = Number(valeur);
  const texte = formatDecimal.format(Math.abs(n));
  const prefixe = n < 0 ? '−' : signe && n > 0 ? '+' : '';
  return `${prefixe}${texte}\u00a0%`;
}

/** Taux d'un euro : « 1 € = 5 000 Ar ». */
export function taux(valeur) {
  if (vide(valeur)) return '—';
  return `1\u00a0€ = ${ariary(valeur)}`;
}

const formatDateCourte = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDateLongue = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatDateMoyenne = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const formatHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Les colonnes DATE arrivent en ISO à minuit UTC : on lit la partie date sans décalage. */
function versDateLocale(iso) {
  if (!iso) return null;
  const texte = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texte) || texte.endsWith('T00:00:00.000Z')) {
    const [a, m, j] = texte.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, j);
  }
  const d = new Date(texte);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateCourte(iso) {
  const d = versDateLocale(iso);
  return d ? formatDateCourte.format(d) : '—';
}

export function dateMoyenne(iso) {
  const d = versDateLocale(iso);
  return d ? formatDateMoyenne.format(d) : '—';
}

export function dateLongue(iso) {
  const d = versDateLocale(iso);
  return d ? formatDateLongue.format(d) : '—';
}

export function dateHeure(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDateCourte.format(d)} à ${formatHeure.format(d)}`;
}

export function heure(iso) {
  if (!iso) return '';
  return formatHeure.format(new Date(iso));
}

/** ISO → valeur d'un <input type="date"> (YYYY-MM-DD). */
export function versInputDate(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

/** ISO → valeur d'un <input type="datetime-local"> en heure locale. */
export function versInputDateHeure(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const deux = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

/** Date du jour au format YYYY-MM-DD (heure locale). */
export function aujourdhuiISO(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  const deux = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

export function pluriel(n, singulier, plurielTexte = `${singulier}s`) {
  return `${nombre(n)} ${Number(n) > 1 ? plurielTexte : singulier}`;
}

export const LIBELLES_STATUT_ACHAT = {
  en_route: 'En route',
  recue: 'Reçue',
  en_retard: 'En retard',
};

export const LIBELLES_STATUT_PUBLICATION = {
  a_faire: 'À faire',
  creee: 'Créée',
  publiee: 'Publiée',
  supprimee: 'Supprimée',
};

/** Statuts qu'on peut choisir dans un formulaire (la corbeille se gère par les actions). */
export const STATUTS_PUBLICATION_ACTIFS = ['a_faire', 'creee', 'publiee'];

export const LIBELLES_STATUT_LIVRAISON = {
  a_programmer: 'À programmer',
  programmee: 'Programmée',
  en_cours: 'En cours de livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

/** Étape suivante d'une livraison, avec le libellé du bouton. */
export const SUIVANT_LIVRAISON = {
  a_programmer: { statut: 'programmee', libelle: 'Livreur appelé' },
  programmee: { statut: 'en_cours', libelle: 'Remise au livreur' },
  en_cours: { statut: 'livree', libelle: 'Marquer livrée' },
};
