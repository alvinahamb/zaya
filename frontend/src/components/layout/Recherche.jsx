import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShoppingBag, Receipt, Megaphone, Contact, X } from 'lucide-react';
import { Recherche as ApiRecherche } from '../../services/api.js';
import { useDebounce } from '../../lib/hooks.js';
import { dateCourte, ariary, LIBELLES_STATUT_PUBLICATION } from '../../lib/format.js';

const GROUPES = [
  { cle: 'produits', titre: 'Produits', icone: Package, lien: (p) => `/produits/${p.id}`, libelle: (p) => p.nom, detail: (p) => [p.Categorie?.nom, p.codeShein].filter(Boolean).join(' · ') },
  { cle: 'achats', titre: 'Achats', icone: ShoppingBag, lien: (a) => `/achats/${a.id}`, libelle: (a) => a.nom, detail: (a) => (a.dateCommande ? `Commandée le ${dateCourte(a.dateCommande)}` : `N° ${a.id}`) },
  { cle: 'ventes', titre: 'Ventes', icone: Receipt, lien: (v) => `/ventes/${v.id}`, libelle: (v) => v.nom || `Vente n° ${v.id}`, detail: (v) => [dateCourte(v.dateVente), (v.reseaux ?? []).join(', '), ariary(v.sommeAr)].filter(Boolean).join(' · ') },
  { cle: 'publications', titre: 'Publications', icone: Megaphone, lien: (p) => `/publications/${p.id}`, libelle: (p) => p.nom, detail: (p) => [LIBELLES_STATUT_PUBLICATION[p.statut], p.dateHeurePublication && dateCourte(p.dateHeurePublication)].filter(Boolean).join(' · ') },
  { cle: 'clients', titre: 'Clients', icone: Contact, lien: (c) => `/parametres?section=clients&q=${encodeURIComponent(c.nom)}`, libelle: (c) => c.nom, detail: (c) => [c.telephone, (c.reseaux ?? []).join(', ')].filter(Boolean).join(' · ') },
];

/**
 * Palette de recherche globale (Ctrl/Cmd + K). Montée uniquement quand elle
 * est ouverte : son état repart de zéro à chaque ouverture.
 */
export function Recherche({ onFermer }) {
  const [texte, setTexte] = useState('');
  const [reponse, setReponse] = useState({ requete: '', donnees: null });
  const [selection, setSelection] = useState({ requete: '', index: 0 });
  const requete = useDebounce(texte.trim(), 250);
  const naviguer = useNavigate();

  useEffect(() => {
    const surEchap = (e) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', surEchap);
    return () => document.removeEventListener('keydown', surEchap);
  }, [onFermer]);

  useEffect(() => {
    if (requete.length < 2) return undefined;
    let annule = false;
    ApiRecherche.chercher(requete)
      .then((donnees) => !annule && setReponse({ requete, donnees }))
      .catch(() => !annule && setReponse({ requete, donnees: null }));
    return () => {
      annule = true;
    };
  }, [requete]);

  // Résultats et sélection ne valent que pour la requête courante
  const resultats = reponse.requete === requete && requete.length >= 2 ? reponse.donnees : null;
  const plats = useMemo(() => {
    if (!resultats) return [];
    let i = 0;
    return GROUPES.flatMap((g) => (resultats[g.cle] ?? []).map((element) => ({ groupe: g, element, i: i++ })));
  }, [resultats]);
  const actif = selection.requete === requete ? Math.min(selection.index, Math.max(plats.length - 1, 0)) : 0;
  const choisir = (index) => setSelection({ requete, index });

  const ouvrir = (entree) => {
    naviguer(entree.groupe.lien(entree.element));
    onFermer();
  };

  const surTouche = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      choisir(Math.min(actif + 1, plats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      choisir(Math.max(actif - 1, 0));
    } else if (e.key === 'Enter' && plats[actif]) {
      ouvrir(plats[actif]);
    }
  };

  return createPortal(
    <div className="palette__voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Recherche">
        <div className="palette__champ">
          <Search size={20} aria-hidden="true" />
          <input
            autoFocus
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={surTouche}
            placeholder="Produit, commande, vente, publication, client…"
            aria-label="Rechercher"
          />
          <button type="button" className="bouton bouton--discret bouton--icone bouton--petit" onClick={onFermer} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="palette__resultats">
          {requete.length < 2 && <p className="secondaire petit" style={{ padding: 12 }}>Tapez au moins deux caractères.</p>}
          {requete.length >= 2 && resultats && plats.length === 0 && (
            <p className="secondaire petit" style={{ padding: 12 }}>Aucun résultat pour « {requete} ».</p>
          )}
          {GROUPES.map((g) => {
            const entrees = plats.filter((p) => p.groupe.cle === g.cle);
            if (entrees.length === 0) return null;
            return (
              <div key={g.cle}>
                <div className="palette__groupe">{g.titre}</div>
                {entrees.map((entree) => (
                  <button
                    key={`${g.cle}-${entree.element.id}`}
                    type="button"
                    className="palette__element"
                    data-actif={entree.i === actif}
                    onMouseEnter={() => choisir(entree.i)}
                    onClick={() => ouvrir(entree)}
                  >
                    <g.icone size={18} aria-hidden="true" />
                    <span style={{ minWidth: 0 }}>
                      <span className="tronque" style={{ display: 'block' }}>{g.libelle(entree.element)}</span>
                      <span className="tres-petit secondaire tronque" style={{ display: 'block' }}>{g.detail(entree.element)}</span>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
