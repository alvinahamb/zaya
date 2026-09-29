import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ShoppingBag } from 'lucide-react';
import { Achats, Produits, Frais, Budgets } from '../../services/api.js';
import { useApi, useMediaQuery, REQUETE_MOBILE } from '../../lib/hooks.js';
import { dateCourte, versInputDate, euro, ariary, LIBELLES_STATUT_ACHAT } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Tableau } from '../../components/ui/Tableau.jsx';
import { BadgeStatutAchat } from '../../components/ui/Badge.jsx';
import { Montant, Marge } from '../../components/ui/Montant.jsx';
import { Selection } from '../../components/ui/Champs.jsx';
import { RechercheListe } from '../../components/ui/RechercheListe.jsx';
import { Chargement, Encart, EtatVide, BoutonsCsv } from '../../components/ui/Divers.jsx';
import { nombreCsv, dateCsv, idParNom, normaliser } from '../../lib/csv.js';
import { FormulaireAchat } from './FormulaireAchat.jsx';

/*
 * CSV des commandes, complet : une ligne par élément de la commande, dont les
 * colonnes (nom, dates, sommes) sont répétées sur chaque ligne.
 *   - Article : produit, quantité, prix d'achat, prix de vente, marge
 *   - Frais   : libellé, montant, date
 *   - Budget  : budget de communication (libellé, montant, date)
 * Une commande vide tient sur une ligne sans élément. À l'import, les lignes
 * consécutives de même nom et même date forment une commande ; le produit est
 * retrouvé par son code Shein, sinon par son nom.
 */
const ELEMENTS = { article: 'Article', frais: 'Frais', budget: 'Budget' };

const COLONNES_CSV = [
  { cle: 'nom', titre: 'Commande' },
  { cle: 'description', titre: 'Description' },
  { cle: 'dateCommande', titre: 'Commandée le', valeur: (r) => versInputDate(r.dateCommande) },
  { cle: 'dateArriveeEstimee', titre: 'Arrivée estimée', valeur: (r) => versInputDate(r.dateArriveeEstimee) },
  { cle: 'dateArrivee', titre: 'Arrivée réelle', valeur: (r) => versInputDate(r.dateArrivee) },
  { cle: 'sommeTotale', titre: 'Total commande (€)' },
  { cle: 'sommeAr', titre: 'Payé (Ar)' },
  { cle: 'statut', titre: 'Statut', valeur: (r) => LIBELLES_STATUT_ACHAT[r.statut] },
  { cle: 'element', titre: 'Élément', valeur: (r) => ELEMENTS[r.type] ?? '' },
  { cle: 'produit', titre: 'Produit', valeur: (r) => r.article?.produit },
  { cle: 'codeShein', titre: 'Code Shein', valeur: (r) => r.article?.codeShein },
  { cle: 'quantite', titre: 'Quantité', valeur: (r) => r.article?.quantite },
  { cle: 'prix', titre: 'Prix unitaire (€)', valeur: (r) => r.article?.prix },
  { cle: 'prixVenteAr', titre: 'Prix de vente (Ar)', valeur: (r) => r.article?.prixVenteAr },
  { cle: 'margePct', titre: 'Marge (%)', valeur: (r) => r.article?.margePct },
  { cle: 'libelle', titre: 'Libellé', valeur: (r) => r.montant?.libelle },
  { cle: 'montantAr', titre: 'Montant (Ar)', valeur: (r) => r.montant?.montantAr },
  { cle: 'dateMontant', titre: 'Date', valeur: (r) => versInputDate(r.montant?.dateFrais ?? r.montant?.dateBudget) },
];

/** Commandes → lignes CSV (une par article, frais et budget). */
const lignesCsv = (achats) =>
  achats.flatMap((a) => {
    const lignes = [
      ...(a.articles ?? []).map((article) => ({ ...a, type: 'article', article })),
      ...(a.frais ?? []).map((montant) => ({ ...a, type: 'frais', montant })),
      ...(a.budgets ?? []).map((montant) => ({ ...a, type: 'budget', montant })),
    ];
    return lignes.length ? lignes : [{ ...a, type: null }];
  });

/** Lignes consécutives d'une même commande (nom + date de commande) → un groupe. */
function regrouperCommandes(lignes) {
  const groupes = [];
  for (const l of lignes) {
    const cle = `${normaliser(l.nom)}|${dateCsv(l.dateCommande) ?? ''}`;
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.cle === cle) dernier.lignes.push(l);
    else groupes.push({ cle, lignes: [l] });
  }
  return groupes.map((g) => g.lignes);
}

/** Nature d'une ligne importée ; sans colonne « Élément », un produit désigne un article. */
function typeLigne(l) {
  const e = normaliser(l.element);
  if (e) return Object.keys(ELEMENTS).find((k) => normaliser(ELEMENTS[k]) === e) ?? null;
  return l.produit || l.codeShein ? 'article' : null;
}

function idProduitCsv(ligne, produits) {
  if (ligne.codeShein) {
    const parCode = produits.find((p) => normaliser(p.codeShein) === normaliser(ligne.codeShein));
    if (parCode) return parCode.id;
  }
  return idParNom(ligne.produit || ligne.codeShein, produits, 'Produit');
}

/**
 * Recrée une commande complète : en-tête et articles, puis tarification
 * (prix de vente), puis frais et budgets.
 */
async function importerAchat(groupe, produits) {
  const [r] = groupe;
  const articles = groupe.filter((l) => typeLigne(l) === 'article');
  const sommeAr = nombreCsv(r.sommeAr);
  const sommeTotale = nombreCsv(r.sommeTotale);

  // Produits résolus avant toute création : un produit inconnu n'en laisse pas une à moitié
  const idsProduits = articles.map((l) => idProduitCsv(l, produits));
  const achat = await Achats.creer({
    nom: r.nom,
    description: r.description,
    dateCommande: dateCsv(r.dateCommande),
    dateArriveeEstimee: dateCsv(r.dateArriveeEstimee),
    dateArrivee: dateCsv(r.dateArrivee),
    sommeTotale,
    sommeAr,
    lignes: articles.map((l, i) => ({ idProduit: idsProduits[i], quantite: nombreCsv(l.quantite), prix: nombreCsv(l.prix) })),
  });

  const prixVente = new Map(articles.map((l, i) => [idsProduits[i], nombreCsv(l.prixVenteAr)]));
  if ([...prixVente.values()].some((p) => p !== null)) {
    await Achats.tarifer(achat.id, {
      sommeAr,
      sommeTotale,
      lignes: achat.lignes.map((l) => ({ id: l.id, prixVenteAr: prixVente.get(l.idProduit) ?? null })),
    });
  }

  for (const l of groupe) {
    const montant = { libelle: l.libelle, montantAr: nombreCsv(l.montantAr) };
    if (typeLigne(l) === 'frais') await Frais.creer({ ...montant, idAchat: achat.id, dateFrais: dateCsv(l.dateMontant) });
    if (typeLigne(l) === 'budget') await Budgets.creer({ ...montant, idAchat: achat.id, dateBudget: dateCsv(l.dateMontant) });
  }
}

/** Carte mobile d'une commande : titre, dates, statut, puis trois chiffres clés. */
function CarteAchat({ achat: a }) {
  const arrivee = a.dateArrivee
    ? `reçue le ${dateCourte(a.dateArrivee)}`
    : a.dateArriveeEstimee
      ? `attendue le ${dateCourte(a.dateArriveeEstimee)}`
      : null;
  return (
    <Link to={`/achats/${a.id}`} className="carte-ligne">
      <div className="carte-ligne__entete">
        <div style={{ minWidth: 0 }}>
          <div className="carte-ligne__titre">{a.nom}</div>
          <div className="carte-ligne__sous">
            {a.dateCommande ? `Commandée le ${dateCourte(a.dateCommande)}` : 'Date non renseignée'}
            {arrivee && ` · ${arrivee}`}
            {` · ${a.nbProduits} produit${a.nbProduits > 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="carte-ligne__droite">
          <BadgeStatutAchat statut={a.statut} />
        </div>
      </div>
      <div className="stats-mini">
        <div>
          <div className="stats-mini__libelle">Total</div>
          <div className="stats-mini__valeur">{euro(a.sommeEffective)}</div>
        </div>
        <div>
          <div className="stats-mini__libelle">Payé</div>
          <div className="stats-mini__valeur">{ariary(a.sommeAr)}</div>
        </div>
        <div>
          <div className="stats-mini__libelle">Marge estimée</div>
          <div className="stats-mini__valeur"><Marge pct={a.recap.margeEstimeePct} /></div>
        </div>
      </div>
    </Link>
  );
}

export function ListeAchats() {
  const naviguer = useNavigate();
  const [params, setParams] = useSearchParams();
  const mobile = useMediaQuery(REQUETE_MOBILE);
  const charger = useCallback(() => Achats.lister(), []);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  // Catalogue : pour retrouver les produits des articles importés
  const chargerProduits = useCallback(() => Produits.lister(), []);
  const { donnees: produits } = useApi(chargerProduits);
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('');

  const modaleOuverte = params.get('nouveau') === '1';
  const fermerModale = () => {
    params.delete('nouveau');
    setParams(params, { replace: true });
  };

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (donnees ?? []).filter((a) => (!q || a.nom.toLowerCase().includes(q)) && (!statut || a.statut === statut));
  }, [donnees, recherche, statut]);

  const colonnes = [
    { cle: 'nom', titre: 'Nom', principal: true, rendu: (a) => (
      <span className="gras">{a.nom}</span>
    ) },
    { cle: 'dateCommande', titre: 'Commandée le', rendu: (a) => dateCourte(a.dateCommande) },
    { cle: 'arrivee', titre: 'Arrivée', rendu: (a) => (
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span>{dateCourte(a.dateArrivee || a.dateArriveeEstimee)}</span>
        <BadgeStatutAchat statut={a.statut} />
      </div>
    ) },
    { cle: 'nbProduits', titre: 'Produits', align: 'droite' },
    { cle: 'somme', titre: 'Total (€)', align: 'droite', classe: 'colonne-euro', rendu: (a) => <Montant valeur={a.sommeEffective} devise="€" /> },
    { cle: 'sommeAr', titre: 'Payé (Ar)', align: 'droite', classe: 'colonne-ar', rendu: (a) => <Montant valeur={a.sommeAr} /> },
    { cle: 'marge', titre: 'Marge estimée', align: 'droite', rendu: (a) => <Marge pct={a.recap.margeEstimeePct} /> },
  ];

  const etatVide = (
    <EtatVide
      icone={ShoppingBag}
      titre={donnees?.length ? 'Aucune commande ne correspond' : 'Aucune commande'}
      description={donnees?.length ? 'Modifiez la recherche ou le filtre.' : 'Créez votre première commande pour commencer la tarification.'}
      action={!donnees?.length && <Bouton variante="principal" icone={Plus} onClick={() => setParams({ nouveau: '1' })}>Nouvelle commande</Bouton>}
    />
  );

  return (
    <Page
      titre="Achats"
      actions={
        <>
          {mobile && <RechercheListe repliable valeur={recherche} onChange={setRecherche} placeholder="Rechercher une commande" />}
          <Bouton variante="principal" icone={Plus} compact onClick={() => setParams({ nouveau: '1' })}>
            Nouvelle commande
          </Bouton>
        </>
      }
    >
      <div className="outils">
        {!mobile && <RechercheListe valeur={recherche} onChange={setRecherche} placeholder="Rechercher une commande" />}
        <Selection
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          placeholder="Tous les statuts"
          options={Object.entries(LIBELLES_STATUT_ACHAT).map(([valeur, libelle]) => ({ valeur, libelle }))}
          aria-label="Filtrer par statut"
        />
        <div className="pousser">
          <BoutonsCsv
            nomFichier="achats"
            colonnes={COLONNES_CSV}
            lignes={lignesCsv(filtres)}
            regrouper={regrouperCommandes}
            importer={(groupe) => importerAchat(groupe, produits ?? [])}
            onImporte={recharger}
          />
        </div>
      </div>

      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      <Carte nu>
        {chargement ? (
          <Chargement />
        ) : mobile ? (
          filtres.length === 0 ? etatVide : (
            <div className="liste-cartes">
              {filtres.map((a) => <CarteAchat key={a.id} achat={a} />)}
            </div>
          )
        ) : (
          <Tableau colonnes={colonnes} lignes={filtres} surClic={(a) => naviguer(`/achats/${a.id}`)} vide={etatVide} cartes={false} />
        )}
      </Carte>

      <FormulaireAchat
        ouvert={modaleOuverte}
        onFermer={fermerModale}
        onEnregistre={(achat) => naviguer(`/achats/${achat.id}`)}
      />
    </Page>
  );
}
