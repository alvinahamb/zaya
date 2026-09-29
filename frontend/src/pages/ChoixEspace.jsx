import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Logo } from '../components/layout/Logo.jsx';

/** Espaces proposés avant la connexion ; chacun mène à son écran de connexion. */
const ESPACES = [{ cle: 'zaya', nom: 'Zaya', description: 'Achats, ventes, stock et contenus', connexion: '/connexion' }];

/** Premier écran hors session : choix de l'espace, puis connexion. */
export function ChoixEspace() {
  const { utilisateur, pret } = useAuth();
  const naviguer = useNavigate();
  const location = useLocation();

  if (pret && utilisateur) return <Navigate to="/" replace />;

  return (
    <div className="espaces">
      <div className="espaces__contenu">
        <header className="espaces__entete">
          <h1 className="espaces__titre">Choisissez votre espace</h1>
          <p className="espaces__sous-titre">Sélectionnez l'espace auquel vous souhaitez vous connecter.</p>
        </header>
        <div className="espaces__grille">
          {ESPACES.map((e) => (
            <button
              key={e.cle}
              type="button"
              className="espace"
              aria-label={`${e.nom} : ${e.description}`}
              // On transmet la page demandée au départ pour y revenir après la connexion
              onClick={() => naviguer(e.connexion, { state: location.state })}
            >
              <Logo className="espace__logo" />
              {/* Au survol : nom et description sur un voile de verre dépoli */}
              <span className="espace__voile" aria-hidden="true">
                <span className="espace__nom">{e.nom}</span>
                <span className="espace__description">{e.description}</span>
                <span className="espace__entrer">
                  Entrer
                  <ArrowRight size={15} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
