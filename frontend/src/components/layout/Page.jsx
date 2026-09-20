import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function Page({ titre, sousTitre, badge, actions, retour, children }) {
  return (
    <div className="page">
      {(titre || actions) && (
        <header className="page__entete">
          <div>
            {retour && (
              <Link className="page__retour" to={retour.to}>
                <ChevronLeft size={16} aria-hidden="true" />
                {retour.libelle}
              </Link>
            )}
            <div className="page__titre">
              <h1>{titre}</h1>
              {badge}
            </div>
            {sousTitre && <div className="page__sous-titre">{sousTitre}</div>}
          </div>
          {actions && <div className="page__actions">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}
