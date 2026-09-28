import { Link } from 'react-router-dom';
import { Case } from './Champs.jsx';
import { Badge } from './Badge.jsx';
import { heure, dateHeure } from '../../lib/format.js';

const memeJour = (a, b) => a && b && String(a).slice(0, 10) === String(b).slice(0, 10);

/**
 * Badges des réseaux d'une publication. Un réseau qui a sa propre heure
 * l'affiche à côté de son nom (heure seule si c'est le même jour).
 */
export function ReseauxPublication({ publication, reseaux = publication?.reseaux }) {
  return (reseaux ?? []).map((r) => {
    const propre = r.dateHeurePropre && r.dateHeurePropre !== publication?.dateHeurePublication;
    const complement = !propre ? '' : memeJour(r.dateHeurePropre, publication?.dateHeurePublication) ? ` · ${heure(r.dateHeurePropre)}` : ` · ${dateHeure(r.dateHeurePropre)}`;
    return (
      <Badge key={r.id} ton="info">
        {r.nom}
        {complement}
      </Badge>
    );
  });
}

/** Sélection de plusieurs réseaux sociaux par cases à cocher, commune à tous les formulaires. */
export function ChoixReseaux({ reseaux, valeurs, onChange, requis = false }) {
  const basculer = (id) => onChange(valeurs.includes(id) ? valeurs.filter((x) => x !== id) : [...valeurs, id]);

  if (!reseaux.length) {
    return (
      <p className="petit secondaire">
        Aucun réseau social enregistré : <Link to="/parametres?section=reseaux">ajoutez-en un dans les paramètres</Link>.
      </p>
    );
  }
  return (
    <div className="choix-reseaux" role="group" aria-label="Réseaux sociaux" aria-required={requis || undefined}>
      {reseaux.map((r) => (
        <Case key={r.id} libelle={r.nom} checked={valeurs.includes(r.id)} onChange={() => basculer(r.id)} />
      ))}
    </div>
  );
}
