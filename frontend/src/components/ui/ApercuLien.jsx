import { useEffect, useState } from 'react';
import { Pin, ImageOff } from 'lucide-react';
import { Apercu } from '../../services/api.js';

// Aperçus déjà résolus, partagés entre les cartes (false = pas d'image)
const cache = new Map();

/** Vignette Open Graph d'un lien (idée Pinterest, contenu publié). */
export function ApercuLien({ url, alt = '' }) {
  const [etat, setEtat] = useState(() => ({ url, image: url ? cache.get(url) : false }));
  if (etat.url !== url) setEtat({ url, image: url ? cache.get(url) : false });

  useEffect(() => {
    if (!url || cache.has(url)) return undefined;
    let annule = false;
    Apercu.lire(url)
      .then((r) => {
        cache.set(url, r.image || false);
        if (!annule) setEtat({ url, image: r.image || false });
      })
      .catch(() => {
        cache.set(url, false);
        if (!annule) setEtat({ url, image: false });
      });
    return () => {
      annule = true;
    };
  }, [url]);

  if (etat.image) {
    return (
      <div className="apercu-lien">
        <img src={etat.image} alt={alt} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </div>
    );
  }
  const Icone = url ? (etat.image === false ? ImageOff : Pin) : Pin;
  return (
    <div className="apercu-lien apercu-lien--vide" aria-hidden="true">
      <Icone size={36} strokeWidth={1.5} />
      <span className="tres-petit">{!url ? 'Pas de lien Pinterest' : etat.image === false ? 'Aperçu indisponible' : 'Chargement…'}</span>
    </div>
  );
}
