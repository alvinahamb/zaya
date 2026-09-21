import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Bouton } from './Bouton.jsx';

export function Modale({ ouverte, titre, onFermer, pied, large = false, children }) {
  const idTitre = useId();

  useEffect(() => {
    if (!ouverte) return undefined;
    const surTouche = (e) => e.key === 'Escape' && onFermer?.();
    document.addEventListener('keydown', surTouche);
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = debordement;
    };
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  return createPortal(
    <div className="modale__voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer?.()}>
      <div className={`modale ${large ? 'modale--large' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitre}>
        <div className="modale__entete">
          <h2 id={idTitre}>{titre}</h2>
          <Bouton variante="discret" icone={X} onClick={onFermer} aria-label="Fermer" />
        </div>
        <div className="modale__corps">{children}</div>
        {pied && <div className="modale__pied">{pied}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirmation({
  ouverte,
  titre,
  message,
  libelleConfirmer = 'Confirmer',
  ton = 'principal',
  chargement = false,
  onConfirmer,
  onAnnuler,
}) {
  return (
    <Modale
      ouverte={ouverte}
      titre={titre}
      onFermer={onAnnuler}
      pied={
        <>
          <Bouton onClick={onAnnuler} disabled={chargement}>
            Annuler
          </Bouton>
          <Bouton variante={ton} onClick={onConfirmer} chargement={chargement}>
            {libelleConfirmer}
          </Bouton>
        </>
      }
    >
      <p>{message}</p>
    </Modale>
  );
}
