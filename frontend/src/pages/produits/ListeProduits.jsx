import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List, Package } from 'lucide-react';
import { Produits, Categories } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { euro, ariary } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Tableau } from '../../components/ui/Tableau.jsx';
import { BadgeStock } from '../../components/ui/Badge.jsx';
import { Montant } from '../../components/ui/Montant.jsx';
import { Saisie, Selection } from '../../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide, Segment, ImageProduit, BoutonsExport } from '../../components/ui/Divers.jsx';
import { FormulaireProduit } from './FormulaireProduit.jsx';

const COLONNES_EXPORT = [
  { cle: 'nom', titre: 'Nom' },
  { cle: 'categorie', titre: 'Catégorie', valeur: (p) => p.categorie?.nom },
  { cle: 'materiel', titre: 'Matériel' },
  { cle: 'codeShein', titre: 'Code Shein' },
  { cle: 'prix', titre: "Prix d'achat (€)", valeur: (p) => (p.prix === null ? null : Number(p.prix)), texte: (p) => euro(p.prix), align: 'droite' },
  { cle: 'prixVenteAr', titre: 'Prix de vente (Ar)', valeur: (p) => (p.prixVenteAr === null ? null : Number(p.prixVenteAr)), texte: (p) => ariary(p.prixVenteAr), align: 'droite' },
  { cle: 'stockRestant', titre: 'Stock restant', align: 'droite' },
];

const CLE_VUE = 'zaya.produits.vue';

function CarteProduit({ produit }) {
  return (
    <Link to={`/produits/${produit.id}`} className="carte carte--cliquable carte-produit">
      <ImageProduit src={produit.image} alt="" taille="grande" />
      <div className="carte-produit__corps">
        <div className="carte-produit__nom">{produit.nom}</div>
        <div className="tres-petit secondaire">{produit.categorie?.nom}</div>
        <div className="carte-produit__prix">
          <span className="tabulaire">{euro(produit.prix)}</span>
          <span className="tabulaire gras">{ariary(produit.prixVenteAr)}</span>
        </div>
        <div>
          <BadgeStock restant={produit.stockRestant} />
        </div>
      </div>
    </Link>
  );
}

export function ListeProduits() {
  const naviguer = useNavigate();
  const { notifier } = useToast();
  const [params, setParams] = useSearchParams();
  const chargerProduits = useCallback(() => Produits.lister(), []);
  const chargerCategories = useCallback(() => Categories.lister(), []);
  const { donnees: produits, chargement, erreur, recharger } = useApi(chargerProduits);
  const { donnees: categories } = useApi(chargerCategories);
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('');
  const [vue, setVue] = useState(() => {
    try {
      return localStorage.getItem(CLE_VUE) || 'grille';
    } catch {
      return 'grille';
    }
  });

  const changerVue = (v) => {
    setVue(v);
    try {
      localStorage.setItem(CLE_VUE, v);
    } catch {
      /* ignoré */
    }
  };

  const modaleOuverte = params.get('nouveau') === '1';
  const fermerModale = () => {
    params.delete('nouveau');
    setParams(params, { replace: true });
  };

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (produits ?? []).filter(
      (p) =>
        (!q || p.nom.toLowerCase().includes(q) || (p.codeShein ?? '').toLowerCase().includes(q)) &&
        (!categorie || String(p.idCategorie) === categorie),
    );
  }, [produits, recherche, categorie]);

  const colonnes = [
    { cle: 'nom', titre: 'Produit', principal: true, rendu: (p) => (
      <div className="tarif__produit">
        <ImageProduit src={p.image} alt="" />
        <div style={{ minWidth: 0 }}>
          <div className="gras">{p.nom}</div>
          <div className="tres-petit secondaire">{p.materiel}</div>
        </div>
      </div>
    ) },
    { cle: 'categorie', titre: 'Catégorie', rendu: (p) => p.categorie?.nom },
    { cle: 'codeShein', titre: 'Code Shein', rendu: (p) => p.codeShein || '—' },
    { cle: 'prix', titre: "Prix d'achat (€)", align: 'droite', classe: 'colonne-euro', rendu: (p) => <Montant valeur={p.prix} devise="€" /> },
    { cle: 'prixVenteAr', titre: 'Prix de vente (Ar)', align: 'droite', classe: 'colonne-ar', rendu: (p) => <Montant valeur={p.prixVenteAr} /> },
    { cle: 'stockRestant', titre: 'Stock restant', align: 'droite', rendu: (p) => <BadgeStock restant={p.stockRestant} /> },
  ];

  const etatVide = (
    <EtatVide
      icone={Package}
      titre={produits?.length ? 'Aucun produit ne correspond' : 'Aucun produit'}
      description={produits?.length ? 'Modifiez la recherche ou le filtre.' : 'Ajoutez vos produits pour les retrouver dans les commandes et les ventes.'}
      action={!produits?.length && <Bouton variante="principal" icone={Plus} onClick={() => setParams({ nouveau: '1' })}>Nouveau produit</Bouton>}
    />
  );

  return (
    <Page
      titre="Produits"
      actions={<Bouton variante="principal" icone={Plus} onClick={() => setParams({ nouveau: '1' })}>Nouveau produit</Bouton>}
    >
      <div className="outils">
        <div className="outils__recherche">
          <Search size={18} aria-hidden="true" />
          <Saisie type="search" placeholder="Nom ou code Shein" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un produit" />
        </div>
        <Selection value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Toutes les catégories" options={(categories ?? []).map((c) => ({ valeur: String(c.id), libelle: c.nom }))} aria-label="Filtrer par catégorie" />
        <Segment libelle="Affichage" valeur={vue} onChange={changerVue} options={[{ valeur: 'grille', libelle: 'Grille', icone: LayoutGrid }, { valeur: 'tableau', libelle: 'Tableau', icone: List }]} />
        <div className="pousser">
          <BoutonsExport nomFichier="produits" titre="Produits" colonnes={COLONNES_EXPORT} lignes={filtres} />
        </div>
      </div>

      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      {chargement ? (
        <Chargement />
      ) : vue === 'grille' ? (
        filtres.length === 0 ? (
          <Carte nu>{etatVide}</Carte>
        ) : (
          <div className="grille-produits">
            {filtres.map((p) => <CarteProduit key={p.id} produit={p} />)}
          </div>
        )
      ) : (
        <Carte nu>
          <Tableau colonnes={colonnes} lignes={filtres} surClic={(p) => naviguer(`/produits/${p.id}`)} vide={etatVide} />
        </Carte>
      )}

      <FormulaireProduit
        ouvert={modaleOuverte}
        categories={categories ?? []}
        onFermer={fermerModale}
        onEnregistre={(p) => {
          fermerModale();
          notifier('Produit créé');
          recharger();
          naviguer(`/produits/${p.id}`);
        }}
      />
    </Page>
  );
}
