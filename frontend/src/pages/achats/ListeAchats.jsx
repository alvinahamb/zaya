import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ShoppingBag } from 'lucide-react';
import { Achats } from '../../services/api.js';
import { useApi, useMediaQuery, REQUETE_MOBILE } from '../../lib/hooks.js';
import { dateCourte, versInputDate, euro, ariary, pourcentage, LIBELLES_STATUT_ACHAT } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Tableau } from '../../components/ui/Tableau.jsx';
import { BadgeStatutAchat, BadgeFigement } from '../../components/ui/Badge.jsx';
import { Montant, Marge } from '../../components/ui/Montant.jsx';
import { Selection } from '../../components/ui/Champs.jsx';
import { RechercheListe } from '../../components/ui/RechercheListe.jsx';
import { Chargement, Encart, EtatVide, BoutonsExport, BoutonsCsv } from '../../components/ui/Divers.jsx';
import { nombreCsv, dateCsv } from '../../lib/csv.js';
import { FormulaireAchat } from './FormulaireAchat.jsx';

const COLONNES_EXPORT = [
  { cle: 'nom', titre: 'Nom' },
  { cle: 'dateCommande', titre: 'Commandée le', valeur: (a) => dateCourte(a.dateCommande) },
  { cle: 'dateArriveeEstimee', titre: 'Arrivée estimée', valeur: (a) => dateCourte(a.dateArriveeEstimee) },
  { cle: 'dateArrivee', titre: 'Arrivée réelle', valeur: (a) => dateCourte(a.dateArrivee) },
  { cle: 'statut', titre: 'Statut', valeur: (a) => LIBELLES_STATUT_ACHAT[a.statut] },
  { cle: 'nbProduits', titre: 'Produits' },
  { cle: 'somme', titre: 'Total (€)', valeur: (a) => Number(a.sommeEffective), texte: (a) => euro(a.sommeEffective), align: 'droite' },
  { cle: 'sommeAr', titre: 'Payé (Ar)', valeur: (a) => Number(a.sommeAr), texte: (a) => ariary(a.sommeAr), align: 'droite' },
  { cle: 'margeEstimee', titre: 'Marge estimée', valeur: (a) => a.recap.margeEstimeePct, texte: (a) => pourcentage(a.recap.margeEstimeePct), align: 'droite' },
];

// Import : crée l'en-tête de la commande ; les produits se tarifent ensuite dans la fiche
const COLONNES_CSV = [
  { cle: 'nom', titre: 'Nom' },
  { cle: 'description', titre: 'Description' },
  { cle: 'dateCommande', titre: 'Commandée le', valeur: (a) => versInputDate(a.dateCommande) },
  { cle: 'dateArriveeEstimee', titre: 'Arrivée estimée', valeur: (a) => versInputDate(a.dateArriveeEstimee) },
  { cle: 'dateArrivee', titre: 'Arrivée réelle', valeur: (a) => versInputDate(a.dateArrivee) },
  { cle: 'sommeTotale', titre: 'Total (€)', valeur: (a) => a.sommeEffective },
  { cle: 'sommeAr', titre: 'Payé (Ar)' },
  { cle: 'statut', titre: 'Statut', valeur: (a) => LIBELLES_STATUT_ACHAT[a.statut] },
  { cle: 'nbProduits', titre: 'Produits' },
];

const importerAchat = (r) =>
  Achats.creer({
    nom: r.nom,
    description: r.description,
    dateCommande: dateCsv(r.dateCommande),
    dateArriveeEstimee: dateCsv(r.dateArriveeEstimee),
    dateArrivee: dateCsv(r.dateArrivee),
    sommeTotale: nombreCsv(r.sommeTotale),
    sommeAr: nombreCsv(r.sommeAr),
  });

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
          {!a.fige && <BadgeFigement fige={false} />}
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
          <div className="stats-mini__valeur"><Marge pct={a.fige ? a.recap.margeEstimeePct : null} /></div>
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
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="gras">{a.nom}</span>
        {!a.fige && <BadgeFigement fige={false} />}
      </div>
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
    { cle: 'marge', titre: 'Marge estimée', align: 'droite', rendu: (a) => <Marge pct={a.fige ? a.recap.margeEstimeePct : null} /> },
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
        <div className="pousser flex" style={{ gap: 4 }}>
          <BoutonsCsv nomFichier="achats" colonnes={COLONNES_CSV} lignes={filtres} importer={importerAchat} onImporte={recharger} />
          <BoutonsExport nomFichier="achats" titre="Achats" colonnes={COLONNES_EXPORT} lignes={filtres} />
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
