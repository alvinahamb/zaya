import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Saisie } from './Champs.jsx';
import { Bouton } from './Bouton.jsx';

/**
 * Recherche d'une liste. En mode `repliable` (mobile, dans l'en-tête de page),
 * seule une loupe s'affiche ; le champ s'ouvre par-dessus le titre et reste
 * ouvert tant qu'une recherche est saisie. La croix vide et referme.
 */
export function RechercheListe({ valeur, onChange, placeholder, libelle = 'Rechercher', repliable = false }) {
  const [ouverte, setOuverte] = useState(false);

  const champ = (autoFocus) => (
    <div className="outils__recherche">
      <Search size={18} aria-hidden="true" />
      <Saisie type="search" placeholder={placeholder} value={valeur} onChange={(e) => onChange(e.target.value)} aria-label={libelle} autoFocus={autoFocus} />
    </div>
  );

  if (!repliable) return champ(false);

  if (!ouverte && !valeur) {
    return <Bouton variante="discret" icone={Search} onClick={() => setOuverte(true)} aria-label={libelle} title={libelle} />;
  }

  return (
    <div className="recherche-repliable">
      {champ(true)}
      <Bouton
        variante="discret"
        icone={X}
        onClick={() => {
          onChange('');
          setOuverte(false);
        }}
        aria-label="Fermer la recherche"
      />
    </div>
  );
}
