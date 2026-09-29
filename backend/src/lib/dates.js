const FUSEAU = process.env.TZ || 'Indian/Antananarivo';

/** Date du jour au format YYYY-MM-DD dans le fuseau de l'activité. */
export function aujourdhui() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU }).format(new Date());
}

/** Partie date (YYYY-MM-DD) d'une Date ou d'une chaîne ISO ; null si vide. */
export function jour(valeur) {
  if (!valeur) return null;
  return new Date(valeur).toISOString().slice(0, 10);
}

/** Décale une date YYYY-MM-DD de n jours. */
export function ajouterJours(yyyymmdd, n) {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Date et heure locales « YYYY-MM-DD HH:MM » dans le fuseau de l'activité. */
export function dateHeureLocale(valeur) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(valeur))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
