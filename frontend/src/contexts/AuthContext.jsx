import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Auth, ecrireToken, lireToken } from '../services/api.js';

const ContexteAuth = createContext(null);

export function FournisseurAuth({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  // Sans jeton, rien à vérifier : la session est prête (et vide) immédiatement
  const [pret, setPret] = useState(() => !lireToken());

  useEffect(() => {
    if (!lireToken()) return;
    Auth.moi()
      .then(setUtilisateur)
      .catch(() => ecrireToken(null))
      .finally(() => setPret(true));
  }, []);

  // Déclenché par le client API sur une réponse 401
  useEffect(() => {
    const surDeconnexion = () => setUtilisateur(null);
    window.addEventListener('zaya:deconnexion', surDeconnexion);
    return () => window.removeEventListener('zaya:deconnexion', surDeconnexion);
  }, []);

  const connecter = useCallback(async (email, motDePasse) => {
    const reponse = await Auth.connexion(email, motDePasse);
    ecrireToken(reponse.token);
    setUtilisateur(reponse.utilisateur);
  }, []);

  const deconnecter = useCallback(() => {
    ecrireToken(null);
    setUtilisateur(null);
  }, []);

  const valeur = useMemo(
    () => ({ utilisateur, pret, connecter, deconnecter }),
    [utilisateur, pret, connecter, deconnecter],
  );

  return <ContexteAuth.Provider value={valeur}>{children}</ContexteAuth.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(ContexteAuth);
}
