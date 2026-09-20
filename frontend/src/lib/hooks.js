import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { messageErreur } from '../services/api.js';

/**
 * Charge des données à l'affichage et expose recharger() / setDonnees().
 * `charger` doit être stable (useCallback) : tout changement relance le chargement.
 */
export function useApi(charger) {
  const [etat, setEtat] = useState({ donnees: null, chargement: true, erreur: null });

  const recharger = useCallback(async () => {
    setEtat((e) => ({ ...e, chargement: e.donnees === null, erreur: null }));
    try {
      const donnees = await charger();
      setEtat({ donnees, chargement: false, erreur: null });
      return donnees;
    } catch (erreur) {
      setEtat((e) => ({ donnees: e.donnees, chargement: false, erreur: messageErreur(erreur) }));
      return null;
    }
  }, [charger]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const setDonnees = useCallback((maj) => {
    setEtat((e) => ({ ...e, donnees: typeof maj === 'function' ? maj(e.donnees) : maj }));
  }, []);

  return { ...etat, recharger, setDonnees };
}

export function useDebounce(valeur, delai = 250) {
  const [retardee, setRetardee] = useState(valeur);
  useEffect(() => {
    const t = setTimeout(() => setRetardee(valeur), delai);
    return () => clearTimeout(t);
  }, [valeur, delai]);
  return retardee;
}

/** Vrai quand la requête média correspond (ex. '(max-width: 767px)'). */
export function useMediaQuery(requete) {
  return useSyncExternalStore(
    (rappel) => {
      const mq = window.matchMedia(requete);
      mq.addEventListener('change', rappel);
      return () => mq.removeEventListener('change', rappel);
    },
    () => window.matchMedia(requete).matches,
  );
}

export const REQUETE_MOBILE = '(max-width: 767px)';

/** Ferme un panneau au clic à l'extérieur ou sur Échap. */
export function useFermerDehors(ref, ouvert, fermer) {
  useEffect(() => {
    if (!ouvert) return undefined;
    const surClic = (e) => {
      if (ref.current && !ref.current.contains(e.target)) fermer();
    };
    const surTouche = (e) => {
      if (e.key === 'Escape') fermer();
    };
    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surTouche);
    };
  }, [ref, ouvert, fermer]);
}

/** État d'un formulaire : valeurs, mise à jour par champ, soumission avec erreur. */
export function useFormulaire(initial) {
  const [valeurs, setValeurs] = useState(initial);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const initialRef = useRef(initial);

  const changer = useCallback((nom, valeur) => {
    setValeurs((v) => ({ ...v, [nom]: valeur }));
  }, []);

  const surChangement = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValeurs((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const soumettre = useCallback(async (action) => {
    setEnvoi(true);
    setErreur(null);
    try {
      return await action();
    } catch (err) {
      setErreur(messageErreur(err));
      return undefined;
    } finally {
      setEnvoi(false);
    }
  }, []);

  const reinitialiser = useCallback((nouvelles) => {
    const v = nouvelles ?? initialRef.current;
    initialRef.current = v;
    setValeurs(v);
    setErreur(null);
  }, []);

  return { valeurs, setValeurs, changer, surChangement, erreur, setErreur, envoi, soumettre, reinitialiser };
}
