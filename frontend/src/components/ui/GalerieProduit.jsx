import { useState } from 'react';
import { urlFichier } from '../../services/api.js';
import { ImageProduit } from './Divers.jsx';

/**
 * Photo principale en grand, les autres en vignettes carrées à sa droite.
 * Un clic sur une vignette l'affiche en grand.
 */
export function GalerieProduit({ image, images = [], alt = '' }) {
  const photos = [image, ...images].filter(Boolean);
  const [active, setActive] = useState(0);
  const courante = photos[Math.min(active, photos.length - 1)] ?? null;

  if (photos.length <= 1) return <ImageProduit src={courante} alt={alt} taille="grande" />;

  return (
    <div className="galerie">
      <ImageProduit src={courante} alt={alt} taille="grande" />
      <div className="galerie__vignettes" role="group" aria-label="Photos du produit">
        {photos.map((src, i) => (
          <button
            key={src}
            type="button"
            className="galerie__vignette"
            aria-pressed={i === active}
            aria-label={`Photo ${i + 1} sur ${photos.length}`}
            onClick={() => setActive(i)}
          >
            <img src={urlFichier(src)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
