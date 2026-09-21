import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useFormulaire } from '../lib/hooks.js';
import { Champ, Saisie } from '../components/ui/Champs.jsx';
import { Bouton } from '../components/ui/Bouton.jsx';
import { Encart } from '../components/ui/Divers.jsx';
import { Logo } from '../components/layout/Logo.jsx';

export function Connexion() {
  const { connecter, utilisateur, pret } = useAuth();
  const naviguer = useNavigate();
  const location = useLocation();
  const f = useFormulaire({ email: '', motDePasse: '' });
  const destination = location.state?.depuis || '/';

  if (pret && utilisateur) return <Navigate to={destination} replace />;

  const soumettre = async (e) => {
    e.preventDefault();
    const ok = await f.soumettre(async () => {
      await connecter(f.valeurs.email, f.valeurs.motDePasse);
      return true;
    });
    if (ok) naviguer(destination, { replace: true });
  };

  return (
    <div className="connexion">
      <div className="carte connexion__carte">
        <div className="connexion__logo">
          <Logo />
          <h1 className="sr-only">Zaya</h1>
          <p className="secondaire petit">Backoffice</p>
        </div>
        <form className="formulaire" onSubmit={soumettre} noValidate>
          <Champ libelle="Email">
            {(id) => (
              <Saisie
                id={id}
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={f.valeurs.email}
                onChange={f.surChangement}
              />
            )}
          </Champ>
          <Champ libelle="Mot de passe">
            {(id) => (
              <Saisie
                id={id}
                name="motDePasse"
                type="password"
                autoComplete="current-password"
                required
                value={f.valeurs.motDePasse}
                onChange={f.surChangement}
              />
            )}
          </Champ>
          {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
          <Bouton type="submit" variante="principal" bloc icone={LogIn} chargement={f.envoi}>
            Se connecter
          </Bouton>
        </form>
      </div>
    </div>
  );
}
