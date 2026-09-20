/** Outils de calendrier pour le planning des publications (semaines du lundi au dimanche). */

export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function cleJour(d) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Lundi de la semaine contenant la date. */
export function debutSemaine(date) {
  const d = new Date(date);
  const decalage = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decalage);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Jours d'une grille mensuelle : semaines complètes, 5 ou 6 selon le mois. */
export function joursDuMois(annee, mois) {
  const depart = debutSemaine(new Date(annee, mois, 1));
  const jours = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(depart);
    d.setDate(depart.getDate() + i);
    if (i >= 35 && d.getMonth() !== mois) break;
    jours.push(d);
  }
  return jours;
}

export function regrouperParJour(publications) {
  const parJour = new Map();
  for (const p of publications) {
    if (!p.dateHeurePublication) continue;
    const cle = cleJour(new Date(p.dateHeurePublication));
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle).push(p);
  }
  return parJour;
}
