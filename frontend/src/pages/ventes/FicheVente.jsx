import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2, Truck, Banknote, RotateCcw } from 'lucide-react';
import { Ventes, messageErreur } from '../../services/api.js';
import { useApi, useMediaQuery, REQUETE_MOBILE } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, dateCourte, nombre } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton, BoutonLien } from '../../components/ui/Bouton.jsx';
import { Tableau } from '../../components/ui/Tableau.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Montant } from '../../components/ui/Montant.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { Chargement, Encart, ImageProduit } from '../../components/ui/Divers.jsx';
import { SectionLivraison } from './SectionLivraison.jsx';
import { BadgeStatutLivraison, BadgeStatutVente } from '../../components/ui/Badge.jsx';

/** Étapes suivantes d'une vente : créée → en livraison → payée (on peut aussi encaisser directement). */
const ETAPES = {
  creee: [
    { statut: 'en_livraison', libelle: 'Mettre en livraison', icone: Truck },
    { statut: 'payee', libelle: 'Marquer payée', icone: Banknote, principal: true },
  ],
  en_livraison: [{ statut: 'payee', libelle: 'Marquer payée', icone: Banknote, principal: true }],
  payee: [{ statut: 'en_livraison', libelle: 'Annuler le paiement', icone: RotateCcw }],
};

/** Article vendu, version mobile : visuel, produit, quantité × prix et net. */
function ArticleVendu({ ligne: l, avecReduction }) {
  return (
    <div className="ligne-article">
      <ImageProduit src={l.produit.image} alt="" taille="moyenne" />
      <div className="ligne-article__corps">
        <Link to={`/produits/${l.produit.id}`} className="gras" style={{ color: 'inherit' }}>{l.produit.nom}</Link>
        <div className="tres-petit secondaire">
          Commande <Link to={`/achats/${l.achat.id}`}>{l.achat.nom}</Link>
        </div>
        <div className="ligne-article__rang" style={{ marginTop: 4 }}>
          <span className="secondaire">{nombre(l.quantite)} × {ariary(l.prixVenteAr)}</span>
          <span className="gras tabulaire">{ariary(l.netAr)}</span>
        </div>
        {avecReduction && (
          <div className="tres-petit secondaire droite">avant réduction {ariary(l.totalAr)}</div>
        )}
      </div>
    </div>
  );
}

export function FicheVente() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { notifier } = useToast();
  const mobile = useMediaQuery(REQUETE_MOBILE);
  const charger = useCallback(() => Ventes.lire(id), [id]);
  const { donnees: vente, chargement, erreur, recharger } = useApi(charger);
  const [suppression, setSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [changement, setChangement] = useState(null);

  const changerStatut = async (statut) => {
    setChangement(statut);
    try {
      await Ventes.changerStatut(vente.id, statut);
      notifier(statut === 'payee' ? 'Vente payée : comptée dans le chiffre d’affaires' : 'Statut mis à jour');
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setChangement(null);
    }
  };

  const supprimer = async () => {
    setSuppressionEnCours(true);
    try {
      await Ventes.supprimer(vente.id);
      notifier('Vente supprimée');
      naviguer('/ventes');
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
      setSuppression(false);
    } finally {
      setSuppressionEnCours(false);
    }
  };

  if (chargement && !vente) return <Page retour={{ to: '/ventes', libelle: 'Ventes' }}><Chargement /></Page>;
  if (erreur && !vente) return <Page retour={{ to: '/ventes', libelle: 'Ventes' }}><Encart ton="erreur">{erreur}</Encart></Page>;
  if (!vente) return null;

  const avecReduction = Number(vente.reductionAr) > 0;

  const colonnes = [
    { cle: 'produit', titre: 'Article', principal: true, rendu: (l) => (
      <div className="tarif__produit">
        <ImageProduit src={l.produit.image} alt="" />
        <div style={{ minWidth: 0 }}>
          <Link to={`/produits/${l.produit.id}`} className="gras" style={{ color: 'inherit' }}>{l.produit.nom}</Link>
          <div className="tres-petit secondaire">
            Commande <Link to={`/achats/${l.achat.id}`}>{l.achat.nom}</Link>
          </div>
        </div>
      </div>
    ) },
    { cle: 'quantite', titre: 'Quantité', align: 'droite', rendu: (l) => nombre(l.quantite) },
    { cle: 'prixVenteAr', titre: 'Prix unitaire (Ar)', align: 'droite', rendu: (l) => <Montant valeur={l.prixVenteAr} /> },
    { cle: 'totalAr', titre: 'Total (Ar)', align: 'droite', rendu: (l) => <Montant valeur={l.totalAr} /> },
    { cle: 'netAr', titre: 'Net après réduction', align: 'droite', rendu: (l) => <Montant valeur={l.netAr} className="gras" /> },
  ];

  return (
    <Page
      retour={{ to: '/ventes', libelle: 'Ventes' }}
      titre={vente.nom || `Vente n° ${vente.id}`}
      badge={
        <>
          <BadgeStatutVente statut={vente.statut} />
          {(vente.reseaux ?? []).map((r) => <Badge key={r.id} ton="info">{r.nom}</Badge>)}
          {vente.livraison && <BadgeStatutLivraison statut={vente.livraison.statut} />}
        </>
      }
      sousTitre={`${dateCourte(vente.dateVente)} · ${nombre(vente.nbArticles)} article${vente.nbArticles > 1 ? 's' : ''}${vente.client ? ` · ${vente.client.nom}${vente.client.telephone ? ` (${vente.client.telephone})` : ''}` : ' · client anonyme'}`}
      actions={
        <>
          {(ETAPES[vente.statut] ?? []).map((e) => (
            <Bouton key={e.statut} variante={e.principal ? 'principal' : 'secondaire'} icone={e.icone} compact chargement={changement === e.statut} disabled={changement !== null} onClick={() => changerStatut(e.statut)}>
              {e.libelle}
            </Bouton>
          ))}
          <BoutonLien icone={Pencil} compact to={`/ventes/${vente.id}/modifier`}>Modifier</BoutonLien>
          <Bouton variante="danger" icone={Trash2} onClick={() => setSuppression(true)} aria-label="Supprimer la vente" />
        </>
      }
    >
      {vente.statut !== 'payee' && (
        <div className="espace-bas">
          <Encart ton="attention">Pas encore payée : cette vente ne compte pas dans le chiffre d’affaires, mais ses articles sont réservés dans le stock.</Encart>
        </div>
      )}
      <Carte nu className="espace-bas">
        {mobile ? (
          <div className="liste-cartes">
            {vente.lignes.map((l) => <ArticleVendu key={l.id} ligne={l} avecReduction={avecReduction} />)}
          </div>
        ) : (
          <Tableau colonnes={colonnes} lignes={vente.lignes} cartes={false} />
        )}
        <div className="total-vente">
          <div className="total-vente__ligne">
            <span>Sous-total</span>
            <span className="tabulaire">{ariary(vente.brutAr)}</span>
          </div>
          {avecReduction && (
            <div className="total-vente__ligne">
              <span>Réduction</span>
              <span className="tabulaire">− {ariary(vente.reductionAr)}</span>
            </div>
          )}
          <div className="total-vente__ligne total-vente__ligne--total">
            <span>Total</span>
            <span className="tabulaire">{ariary(vente.sommeAr)}</span>
          </div>
        </div>
      </Carte>

      <SectionLivraison vente={vente} recharger={recharger} />

      <Confirmation
        ouverte={suppression}
        titre="Supprimer la vente ?"
        message="Les articles retourneront dans le stock restant de leur commande."
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppressionEnCours}
        onConfirmer={supprimer}
        onAnnuler={() => setSuppression(false)}
      />
    </Page>
  );
}
