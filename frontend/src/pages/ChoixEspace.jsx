import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Logo } from '../components/layout/Logo.jsx';

/** Espaces proposés avant la connexion ; chacun mène à son écran de connexion. */
const ESPACES = [{ cle: 'zaya', nom: 'Zaya', description: 'Backoffice : achats, ventes, stock et publications', connexion: '/connexion' }];

/** Premier écran hors session : choix de l'espace, puis connexion. */
export function ChoixEspace() {
  const { utilisateur, pret } = useAuth();
  const naviguer = useNavigate();
  const location = useLocation();

  if (pret && utilisateur) return <Navigate to="/" replace />;

  return (
    <div className="espaces">
      <div className="espaces__contenu">
        <h1 className="espaces__titre">Choisissez votre espace</h1>
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
              <Logo />
              {/* Au survol : nom et description sur un voile flouté */}
              <span className="espace__voile">
                <span className="espace__nom">{e.nom}</span>
                <span className="espace__description">{e.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
