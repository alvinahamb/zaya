import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Search, Plus, Bell, Settings, LogOut, ShoppingBag, Receipt, Package, Megaphone, Inbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Accueil } from '../../services/api.js';
import { Bouton } from '../ui/Bouton.jsx';
import { MenuDeroulant, ElementMenu } from '../ui/Divers.jsx';
import { Recherche } from './Recherche.jsx';
import { Logo } from './Logo.jsx';
import { dateCourte } from '../../lib/format.js';

const RUBRIQUES = [
  { to: '/', libelle: 'Accueil', exact: true },
  { to: '/achats', libelle: 'Achats' },
  { to: '/produits', libelle: 'Produits' },
  { to: '/ventes', libelle: 'Ventes' },
  { to: '/publications', libelle: 'Publications' },
  { to: '/statistiques', libelle: 'Statistiques' },
];

const NOUVEAUX = [
  { to: '/achats?nouveau=1', libelle: 'Nouvel achat', icone: ShoppingBag },
  { to: '/ventes/nouvelle', libelle: 'Nouvelle vente', icone: Receipt },
  { to: '/produits?nouveau=1', libelle: 'Nouveau produit', icone: Package },
  { to: '/publications?nouveau=1', libelle: 'Nouvelle publication', icone: Megaphone },
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

/** Alertes dérivées des données (stock, retards, publications), rafraîchies à chaque navigation. */
function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const { pathname } = useLocation();
  const charger = useCallback(() => {
    Accueil.lire()
      .then((r) => setNotifications(r.notifications ?? []))
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
  return notifications;
}

export function BarreHaut() {
  const { utilisateur, deconnecter } = useAuth();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const notifications = useNotifications();

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
                  <div className="menu-deroulant__titre">Alertes</div>
                  {notifications.length === 0 && (
                    <div className="etat-vide" style={{ padding: 20 }}>
                      <Inbox size={28} strokeWidth={1.5} />
                      <p className="petit">Rien à signaler</p>
                    </div>
                  )}
                  {notifications.map((n) => (
                    <Link key={n.id} className="notification" to={n.lien}>
                      <span className={`notification__point notification__point--${n.niveau}`} aria-hidden="true" />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block' }}>{n.libelle}</span>
                        <span className="tres-petit secondaire" style={{ display: 'block' }}>
                          {[n.module, n.detail, n.echeance && !n.detail ? dateCourte(n.echeance) : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  ))}
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
    </>
  );
}
