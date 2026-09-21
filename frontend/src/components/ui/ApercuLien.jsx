import { Pin, ImageOff } from 'lucide-react';
import { useApercu } from '../../lib/useApercu.js';

/** Vignette Open Graph d'un lien (idée Pinterest, contenu publié). */
export function ApercuLien({ url, alt = '' }) {
  const image = useApercu(url);

  if (image) {
    return (
      <div className="apercu-lien">
        <img src={image} alt={alt} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </div>
    );
  }
  const Icone = url ? (image === false ? ImageOff : Pin) : Pin;
  return (
    <div className="apercu-lien apercu-lien--vide" aria-hidden="true">
      <Icone size={36} strokeWidth={1.5} />
      <span className="tres-petit">{!url ? 'Pas de lien Pinterest' : image === false ? 'Aperçu indisponible' : 'Chargement…'}</span>
    </div>
  );
}
