import { Link } from 'react-router-dom';
import { Case } from './Champs.jsx';

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
