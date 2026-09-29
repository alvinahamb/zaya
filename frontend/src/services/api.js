import axios from 'axios';

const CLE_TOKEN = 'zaya.token';

export function lireToken() {
  try {
    return localStorage.getItem(CLE_TOKEN);
  } catch {
    return null;
  }
}

export function ecrireToken(token) {
  try {
    if (token) localStorage.setItem(CLE_TOKEN, token);
    else localStorage.removeItem(CLE_TOKEN);
  } catch {
    /* stockage indisponible (navigation privée) : la session ne survivra pas au rechargement */
  }
}

// Vide en local (proxy Vite) ; URL de l'API déployée en production, sans slash final
const RACINE_API = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const api = axios.create({ baseURL: `${RACINE_API}/api` });

/** Les images téléversées en local (`/uploads/…`) sont servies par l'API, pas par le front. */
export function urlFichier(src) {
  return src?.startsWith('/uploads/') ? `${RACINE_API}${src}` : src;
}

api.interceptors.request.use((config) => {
  const token = lireToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    const statut = erreur.response?.status;
    const url = erreur.config?.url ?? '';
    if (statut === 401 && !url.includes('/auth/connexion')) {
      ecrireToken(null);
      window.dispatchEvent(new Event('zaya:deconnexion'));
    }
    return Promise.reject(erreur);
  },
);

/** Message lisible pour l'utilisateur à partir d'une erreur axios. */
export function messageErreur(erreur) {
  if (erreur?.response?.data?.message) return erreur.response.data.message;
  if (erreur?.code === 'ERR_NETWORK') return 'Serveur injoignable';
  return erreur?.message || 'Erreur inattendue';
}

const donnees = (promesse) => promesse.then((r) => r.data);

function crud(chemin) {
  return {
    lister: (params) => donnees(api.get(chemin, { params })),
    lire: (id) => donnees(api.get(`${chemin}/${id}`)),
    creer: (corps) => donnees(api.post(chemin, corps)),
    modifier: (id, corps) => donnees(api.put(`${chemin}/${id}`, corps)),
    supprimer: (id) => donnees(api.delete(`${chemin}/${id}`)),
  };
}

export const Auth = {
  connexion: (email, motDePasse) => donnees(api.post('/auth/connexion', { email, motDePasse })),
  moi: () => donnees(api.get('/auth/moi')),
};

export const Categories = crud('/categories');
export const Reseaux = crud('/reseaux');

export const Utilisateurs = {
  lister: () => donnees(api.get('/utilisateurs')),
  creer: (corps) => donnees(api.post('/utilisateurs', corps)),
  modifier: (id, corps) => donnees(api.patch(`/utilisateurs/${id}`, corps)),
};

export const Produits = {
  ...crud('/produits'),
  televerserImage: (fichier) => {
    const formulaire = new FormData();
    formulaire.append('image', fichier);
    return donnees(api.post('/produits/image', formulaire, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
};

export const Achats = {
  ...crud('/achats'),
  lignesDisponibles: (params) => donnees(api.get('/achats/lignes-disponibles', { params })),
  ajouterLigne: (id, corps) => donnees(api.post(`/achats/${id}/lignes`, corps)),
  modifierLigne: (id, idLigne, corps) => donnees(api.put(`/achats/${id}/lignes/${idLigne}`, corps)),
  supprimerLigne: (id, idLigne) => donnees(api.delete(`/achats/${id}/lignes/${idLigne}`)),
  tarifer: (id, corps) => donnees(api.put(`/achats/${id}/tarification`, corps)),
};

export const Frais = {
  creer: (corps) => donnees(api.post('/frais', corps)),
  modifier: (id, corps) => donnees(api.put(`/frais/${id}`, corps)),
  supprimer: (id) => donnees(api.delete(`/frais/${id}`)),
};

export const Boosts = {
  lister: (params) => donnees(api.get('/boosts', { params })),
  creer: (corps) => donnees(api.post('/boosts', corps)),
  modifier: (id, corps) => donnees(api.put(`/boosts/${id}`, corps)),
  supprimer: (id) => donnees(api.delete(`/boosts/${id}`)),
};

export const Budgets = {
  lister: (params) => donnees(api.get('/budgets', { params })),
  creer: (corps) => donnees(api.post('/budgets', corps)),
  modifier: (id, corps) => donnees(api.put(`/budgets/${id}`, corps)),
  supprimer: (id) => donnees(api.delete(`/budgets/${id}`)),
};

export const Ventes = crud('/ventes');

export const Clients = crud('/clients');

export const Livraisons = {
  ...crud('/livraisons'),
  changerStatut: (id, statut) => donnees(api.patch(`/livraisons/${id}/statut`, { statut })),
};

export const Publications = {
  ...crud('/publications'),
  changerStatut: (id, statut) => donnees(api.patch(`/publications/${id}/statut`, { statut })),
  // Sans `definitif`, la publication part à la corbeille (statut « supprimee ») et reste restaurable
  supprimer: (id, definitif = false) => donnees(api.delete(`/publications/${id}`, { params: definitif ? { definitif: 1 } : undefined })),
  restaurer: (id) => donnees(api.patch(`/publications/${id}/statut`, { statut: 'a_faire' })),
};

export const Objectifs = {
  ...crud('/objectifs'),
  // { currentValue } ou { delta }
  progresser: (id, corps) => donnees(api.patch(`/objectifs/${id}/progression`, corps)),
  changerStatut: (id, status) => donnees(api.patch(`/objectifs/${id}/statut`, { status })),
};

export const Notifications = {
  // Clés renvoyées par l'accueil (« id|échéance ») : la notification disparaît jusqu'à sa prochaine échéance
  marquerVues: (cles) => donnees(api.post('/notifications/vues', { cles })),
};

export const Stats = { lire: (params) => donnees(api.get('/stats', { params })) };
export const Accueil = { lire: () => donnees(api.get('/accueil')) };
export const Recherche = { chercher: (q) => donnees(api.get('/recherche', { params: { q } })) };
export const Apercu = { lire: (url) => donnees(api.get('/apercu', { params: { url } })) };
