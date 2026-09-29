import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, BellRing, Settings, LogOut, ShoppingBag, Receipt, Package, Megaphone, Inbox, Target, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Accueil, Notifications } from '../../services/api.js';
import { Bouton } from '../ui/Bouton.jsx';
import { MenuDeroulant, ElementMenu } from '../ui/Divers.jsx';
import { Recherche } from './Recherche.jsx';
import { RecapJour } from './RecapJour.jsx';
import { permissionNavigateur, afficherNotification } from '../../lib/notifications.js';
import { Logo } from './Logo.jsx';
import { dateCourte, aujourdhuiISO, LIBELLES_QUAND } from '../../lib/format.js';

const RUBRIQUES = [
  { to: '/', libelle: 'Accueil', exact: true },
  { to: '/achats', libelle: 'Achats' },
  { to: '/produits', libelle: 'Produits' },
  { to: '/ventes', libelle: 'Ventes' },
  { to: '/contenus', libelle: 'Contenus' },
  { to: '/objectifs', libelle: 'Objectifs' },
  { to: '/statistiques', libelle: 'Statistiques' },
];

const NOUVEAUX = [
  { to: '/achats?nouveau=1', libelle: 'Nouvel achat', icone: ShoppingBag },
  { to: '/ventes/nouvelle', libelle: 'Nouvelle vente', icone: Receipt },
  { to: '/produits?nouveau=1', libelle: 'Nouveau produit', icone: Package },
  { to: '/contenus?nouveau=1', libelle: 'Nouveau contenu', icone: Megaphone },
  { to: '/objectifs?nouveau=1', libelle: 'Nouvel objectif', icone: Target },
];

function initiales(utilisateur) {
  const base = utilisateur?.nom || utilisateur?.email || '?';
  return base
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join('');
}

const CLE_SIGNALEES = 'zaya.notifications.signalees';

/**
 * Rappels du navigateur : une notification système par tâche à faire demain
 * ou aujourd'hui, une seule fois par jour et par tâche (mémorisé localement).
 */
function signalerNavigateur(notifications) {
  if (permissionNavigateur() !== 'granted') return;
  const ceJour = aujourdhuiISO();
  let signalees = {};
  try {
    signalees = JSON.parse(localStorage.getItem(CLE_SIGNALEES) || '{}');
  } catch {
    signalees = {};
  }
  const nouvelles = notifications.filter((n) => (n.quand === 'demain' || n.quand === 'jour') && signalees[n.id] !== ceJour);
  for (const n of nouvelles.slice(0, 5)) {
    afficherNotification(`${LIBELLES_QUAND[n.quand]} : ${n.libelle}`, {
      corps: [n.module, n.detail, n.echeance ? dateCourte(n.echeance) : null].filter(Boolean).join(' · '),
      tag: n.id,
      lien: n.lien,
    });
    signalees[n.id] = ceJour;
  }
  // On ne garde que les rappels du jour
  const propre = Object.fromEntries(Object.entries(signalees).filter(([, j]) => j === ceJour));
  try {
    localStorage.setItem(CLE_SIGNALEES, JSON.stringify(propre));
  } catch {
    /* stockage indisponible */
  }
}

/** Alertes dérivées des données (stock, retards, publications, objectifs), rafraîchies à chaque navigation. */
function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const { pathname } = useLocation();
  const charger = useCallback(() => {
    Accueil.lire()
      .then((r) => {
        const liste = r.notifications ?? [];
        setNotifications(liste);
        signalerNavigateur(liste);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    charger();
  }, [charger, pathname]);
  useEffect(() => {
    const t = setInterval(charger, 5 * 60 * 1000);
    window.addEventListener('focus', charger);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', charger);
    };
  }, [charger]);

  // Marquer vu : retrait immédiat de la liste, puis enregistrement (rechargement si l'appel échoue)
  const marquerVues = useCallback(
    (cles) => {
      if (!cles.length) return;
      setNotifications((liste) => liste.filter((n) => !cles.includes(n.cle)));
      Notifications.marquerVues(cles).catch(charger);
    },
    [charger],
  );
  return { notifications, marquerVues };
}

export function BarreHaut() {
  const { utilisateur, deconnecter } = useAuth();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const { notifications, marquerVues } = useNotifications();
  const [permission, setPermission] = useState(permissionNavigateur);
  const naviguer = useNavigate();

  const activerRappels = async () => {
    try {
      const reponse = await Notification.requestPermission();
      setPermission(reponse);
      if (reponse === 'granted') signalerNavigateur(notifications);
    } catch {
      setPermission(permissionNavigateur());
    }
  };

  // Clic sur une notification système : le service worker demande d'ouvrir la page liée
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const surMessage = (e) => e.data?.type === 'zaya:naviguer' && naviguer(e.data.lien);
    navigator.serviceWorker.addEventListener('message', surMessage);
    return () => navigator.serviceWorker.removeEventListener('message', surMessage);
  }, [naviguer]);

  useEffect(() => {
    const surTouche = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setRechercheOuverte((o) => !o);
      }
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, []);

  return (
    <>
      <header className="barre-haut">
        <div className="barre-haut__haut">
          <div className="barre-haut__interieur" style={{ height: '100%' }}>
            <Link to="/" className="logo" aria-label="Zaya, accueil">
              <Logo />
            </Link>

            <div className="barre-haut__actions">
              <Bouton variante="discret" icone={Search} onClick={() => setRechercheOuverte(true)} aria-label="Rechercher (Ctrl K)" title="Rechercher (Ctrl K)" />

              <MenuDeroulant
                bouton={({ basculer, ouvert }) => (
                  <Bouton variante="principal" icone={Plus} onClick={basculer} aria-label="Nouveau" title="Nouveau" aria-expanded={ouvert} />
                )}
              >
                {NOUVEAUX.map((n) => (
                  <ElementMenu key={n.to} to={n.to} icone={n.icone}>
                    {n.libelle}
                  </ElementMenu>
                ))}
              </MenuDeroulant>

              <MenuDeroulant
                bouton={({ basculer, ouvert }) => (
                  <span className="pastille">
                    <Bouton variante="discret" icone={Bell} onClick={basculer} aria-label={`Notifications (${notifications.length})`} aria-expanded={ouvert} />
                    {notifications.length > 0 && <span className="pastille__compte" aria-hidden="true">{notifications.length}</span>}
                  </span>
                )}
              >
                <div className="notifications">
                  <div className="notifications__entete">
                    <span className="menu-deroulant__titre">Alertes</span>
                    {notifications.length > 1 && (
                      <button
                        type="button"
                        className="notifications__tout-vu"
                        // Le menu reste ouvert
                        onClick={(e) => {
                          e.stopPropagation();
                          marquerVues(notifications.map((n) => n.cle));
                        }}
                      >
                        <CheckCheck size={14} aria-hidden="true" />
                        Tout marquer vu
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 && (
                    <div className="etat-vide" style={{ padding: 20 }}>
                      <Inbox size={28} strokeWidth={1.5} />
                      <p className="petit">Rien à signaler</p>
                    </div>
                  )}
                  {notifications.map((n) => (
                    <div key={n.cle ?? n.id} className="notification__ligne">
                      <Link className="notification" to={n.lien}>
                        <span className={`notification__point notification__point--${n.niveau}`} aria-hidden="true" />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block' }}>{n.libelle}</span>
                          <span className="tres-petit secondaire" style={{ display: 'block' }}>
                            {[LIBELLES_QUAND[n.quand], n.module, n.detail, n.echeance && !n.detail ? dateCourte(n.echeance) : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="notification__vu"
                        onClick={(e) => {
                          e.stopPropagation();
                          marquerVues([n.cle]);
                        }}
                        aria-label={`Marquer vu : ${n.libelle}`}
                        title="Marquer vu"
                      >
                        <Check size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {permission === 'default' && (
                    <>
                      <div className="menu-deroulant__separateur" />
                      <ElementMenu onClick={activerRappels} icone={BellRing}>Activer les rappels du navigateur</ElementMenu>
                    </>
                  )}
                </div>
              </MenuDeroulant>

              <MenuDeroulant
                bouton={({ basculer, ouvert }) => (
                  <button type="button" className="bouton bouton--discret bouton--icone" onClick={basculer} aria-label="Menu du profil" aria-expanded={ouvert}>
                    <span className="avatar">{initiales(utilisateur)}</span>
                  </button>
                )}
              >
                <div className="menu-deroulant__titre" style={{ textTransform: 'none' }}>
                  <span style={{ display: 'block', color: 'var(--texte)', fontSize: '0.9rem' }}>{utilisateur?.nom || 'Admin'}</span>
                  <span style={{ fontWeight: 400 }}>{utilisateur?.email}</span>
                </div>
                <div className="menu-deroulant__separateur" />
                <ElementMenu to="/parametres" icone={Settings}>Paramètres</ElementMenu>
                <ElementMenu onClick={deconnecter} icone={LogOut}>Déconnexion</ElementMenu>
              </MenuDeroulant>
            </div>
          </div>
        </div>

        <nav className="nav" aria-label="Rubriques">
          <div className="barre-haut__interieur">
            {RUBRIQUES.map((r) => (
              <NavLink key={r.to} to={r.to} end={r.exact} className="nav__lien">
                {r.libelle}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {rechercheOuverte && <Recherche onFermer={() => setRechercheOuverte(false)} />}
      <RecapJour notifications={notifications} permission={permission} onActiverRappels={activerRappels} />
    </>
  );
}
