import { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';
import { Ventes, Reseaux } from '../../services/api.js';
import { useApi, useMediaQuery, REQUETE_MOBILE } from '../../lib/hooks.js';
import { dateCourte, versInputDate, ariary, nombre, aujourdhuiISO, LIBELLES_STATUT_LIVRAISON } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { BoutonLien } from '../../components/ui/Bouton.jsx';
import { Tableau } from '../../components/ui/Tableau.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Montant } from '../../components/ui/Montant.jsx';
import { Saisie, Selection } from '../../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide, BoutonsCsv, Onglets } from '../../components/ui/Divers.jsx';
import { BadgeStatutLivraison } from '../../components/ui/Badge.jsx';
import { OngletLivraisons } from './OngletLivraisons.jsx';

const COLONNES_CSV = [
  { cle: 'id', titre: 'N° vente' },
  { cle: 'dateVente', titre: 'Date', valeur: (v) => versInputDate(v.dateVente) },
  { cle: 'nom', titre: 'Libellé' },
  { cle: 'client', titre: 'Client', valeur: (v) => v.client?.nom },
  { cle: 'reseaux', titre: 'Réseaux', valeur: (v) => (v.reseaux ?? []).map((r) => r.nom).join(', ') },
  { cle: 'livraison', titre: 'Livraison', valeur: (v) => (v.livraison ? LIBELLES_STATUT_LIVRAISON[v.livraison.statut] : '') },
  { cle: 'nbArticles', titre: 'Articles' },
  { cle: 'reductionAr', titre: 'Réduction (Ar)' },
  { cle: 'sommeAr', titre: 'Total (Ar)' },
];

function debutMois() {
  return `${aujourdhuiISO().slice(0, 7)}-01`;
}

/** Carte mobile d'une vente : date et libellé à gauche, total et réseau à droite. */
function CarteVente({ vente: v }) {
  return (
    <Link to={`/ventes/${v.id}`} className="carte-ligne">
      <div className="carte-ligne__entete">
        <div style={{ minWidth: 0 }}>
          <div className="carte-ligne__titre">{dateCourte(v.dateVente)}</div>
          <div className="carte-ligne__sous">
            {v.client ? v.client.nom : v.nom || `Vente n° ${v.id}`} · {nombre(v.nbArticles)} article{v.nbArticles > 1 ? 's' : ''}
            {Number(v.reductionAr) > 0 && ` · réduction ${ariary(v.reductionAr)}`}
          </div>
        </div>
        <div className="carte-ligne__droite">
          <span className="carte-ligne__montant">{ariary(v.sommeAr)}</span>
          <span className="flex" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{(v.reseaux ?? []).map((r) => <Badge key={r.id} ton="info">{r.nom}</Badge>)}</span>
          {v.livraison && <BadgeStatutLivraison statut={v.livraison.statut} />}
        </div>
      </div>
    </Link>
  );
}

export function ListeVentes() {
  const naviguer = useNavigate();
  const mobile = useMediaQuery(REQUETE_MOBILE);
  const [params, setParams] = useSearchParams();
  const onglet = params.get('onglet') === 'livraisons' ? 'livraisons' : 'ventes';
  const [du, setDu] = useState(debutMois);
  const [au, setAu] = useState(() => aujourdhuiISO());
  const [reseau, setReseau] = useState('');
  const charger = useCallback(() => Ventes.lister({ du: du || undefined, au: au || undefined, reseau: reseau || undefined }), [du, au, reseau]);
  const chargerReseaux = useCallback(() => Reseaux.lister(), []);
  const { donnees: ventes, chargement, erreur } = useApi(charger);
  const { donnees: reseaux } = useApi(chargerReseaux);

  const liste = ventes ?? [];
  const total = liste.reduce((s, v) => s + Number(v.sommeAr), 0);
  const articles = liste.reduce((s, v) => s + v.nbArticles, 0);
  const resume = `${nombre(liste.length)} vente${liste.length > 1 ? 's' : ''} · ${nombre(articles)} article${articles > 1 ? 's' : ''}`;

  const colonnes = [
    { cle: 'dateVente', titre: 'Date', principal: true, rendu: (v) => (
      <div>
        <div className="gras">{dateCourte(v.dateVente)}</div>
        <div className="tres-petit secondaire">{v.nom || `Vente n° ${v.id}`}</div>
      </div>
    ) },
    { cle: 'client', titre: 'Client', rendu: (v) => (v.client ? v.client.nom : <span className="secondaire">Anonyme</span>) },
    { cle: 'reseaux', titre: 'Réseaux', rendu: (v) => <span className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>{(v.reseaux ?? []).map((r) => <Badge key={r.id} ton="info">{r.nom}</Badge>)}</span> },
    { cle: 'livraison', titre: 'Livraison', rendu: (v) => (v.livraison ? <BadgeStatutLivraison statut={v.livraison.statut} /> : '—') },
    { cle: 'nbArticles', titre: 'Articles', align: 'droite', rendu: (v) => nombre(v.nbArticles) },
    { cle: 'reductionAr', titre: 'Réduction', align: 'droite', rendu: (v) => (Number(v.reductionAr) ? <Montant valeur={v.reductionAr} /> : '—') },
    { cle: 'sommeAr', titre: 'Total (Ar)', align: 'droite', rendu: (v) => <Montant valeur={v.sommeAr} className="gras" /> },
  ];

  const etatVide = (
    <EtatVide
      icone={Receipt}
      titre="Aucune vente sur la période"
      description="Modifiez les dates ou enregistrez une nouvelle vente."
      action={<BoutonLien variante="principal" icone={Plus} to="/ventes/nouvelle">Nouvelle vente</BoutonLien>}
    />
  );

  return (
    <Page titre="Ventes" actions={<BoutonLien variante="principal" icone={Plus} compact to="/ventes/nouvelle">Nouvelle vente</BoutonLien>}>
      <div className="espace-bas">
        <Onglets
          onglets={[{ cle: 'ventes', libelle: 'Ventes' }, { cle: 'livraisons', libelle: 'Livraisons' }]}
          actif={onglet}
          onChange={(cle) => setParams(cle === 'ventes' ? {} : { onglet: cle }, { replace: true })}
        />
      </div>
      {onglet === 'livraisons' ? <OngletLivraisons /> : (
      <>
      <div className="outils">
        <div className="outils__dates">
          <Saisie type="date" value={du} onChange={(e) => setDu(e.target.value)} aria-label="Du" />
          <span className="secondaire petit">au</span>
          <Saisie type="date" value={au} onChange={(e) => setAu(e.target.value)} aria-label="Au" />
        </div>
        <Selection value={reseau} onChange={(e) => setReseau(e.target.value)} placeholder="Tous les réseaux" options={(reseaux ?? []).map((r) => ({ valeur: String(r.id), libelle: r.nom }))} aria-label="Filtrer par réseau" />
        <div className="pousser">
          <BoutonsCsv nomFichier="ventes" colonnes={COLONNES_CSV} lignes={liste} />
        </div>
      </div>

      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      <Carte nu>
        {chargement && !ventes ? (
          <Chargement />
        ) : liste.length === 0 ? (
          etatVide
        ) : mobile ? (
          <>
            <div className="liste-cartes">
              {liste.map((v) => <CarteVente key={v.id} vente={v} />)}
            </div>
            <div className="barre-total">
              <span>{resume}</span>
              <span>{ariary(total)}</span>
            </div>
          </>
        ) : (
          <Tableau
            colonnes={colonnes}
            lignes={liste}
            surClic={(v) => naviguer(`/ventes/${v.id}`)}
            cartes={false}
            pied={
              <tr>
                <td>{resume}</td>
                <td />
                <td />
                <td />
                <td className="droite">{nombre(articles)}</td>
                <td />
                <td className="droite">{ariary(total)}</td>
              </tr>
            }
          />
        )}
      </Carte>
      </>
      )}
    </Page>
  );
}
