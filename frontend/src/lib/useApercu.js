import { useEffect, useState } from 'react';
import { Apercu } from '../services/api.js';

// Aperçus déjà résolus, partagés entre les composants (false = pas d'image)
const cache = new Map();

/**
 * Image Open Graph d'un lien : `undefined` tant qu'on ne sait pas, `false` si
 * la page n'en expose pas, sinon l'URL de l'image.
 */
export function useApercu(url) {
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

  return etat.image;
}
