import { useCallback, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Achats, messageErreur } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { dateCourte, dateHeure, taux as formatTaux, ariary, pourcentage } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { BadgeStatutAchat, BadgeFigement } from '../../components/ui/Badge.jsx';
import { Onglets, Chargement, Encart } from '../../components/ui/Divers.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { FormulaireAchat } from './FormulaireAchat.jsx';
import { Tarification } from './Tarification.jsx';
import { OngletFrais } from './OngletFrais.jsx';
import { OngletBudget } from './OngletBudget.jsx';
import { OngletPublications } from './OngletPublications.jsx';
import { OngletVentes } from './OngletVentes.jsx';
import { OngletRecap } from './OngletRecap.jsx';

const ONGLETS = ['tarification', 'frais', 'budget', 'publications', 'ventes', 'recap'];

export function FicheAchat() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { notifier } = useToast();
  const [params, setParams] = useSearchParams();
  const charger = useCallback(() => Achats.lire(id), [id]);
  const { donnees: achat, chargement, erreur, recharger, setDonnees: setAchat } = useApi(charger);
  const [modification, setModification] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const onglet = ONGLETS.includes(params.get('onglet')) ? params.get('onglet') : 'tarification';
  const changerOnglet = (cle) => {
    params.set('onglet', cle);
    setParams(params, { replace: true });
  };

  const supprimer = async () => {
    setSuppressionEnCours(true);
    try {
      await Achats.supprimer(achat.id);
      notifier('Commande supprimée');
      naviguer('/achats');
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
      setSuppression(false);
    } finally {
      setSuppressionEnCours(false);
    }
  };

  if (chargement && !achat) return <Page retour={{ to: '/achats', libelle: 'Achats' }}><Chargement /></Page>;
  if (erreur && !achat) return <Page retour={{ to: '/achats', libelle: 'Achats' }}><Encart ton="erreur">{erreur}</Encart></Page>;
  if (!achat) return null;

  const r = achat.recap;
  const onglets = [
    { cle: 'tarification', libelle: 'Produits et tarification', compteur: achat.nbProduits },
    { cle: 'frais', libelle: 'Frais', compteur: achat.frais.length },
    { cle: 'budget', libelle: 'Budget', compteur: achat.boosts.length },
    { cle: 'publications', libelle: 'Publications', compteur: achat.publications.length },
    { cle: 'ventes', libelle: 'Ventes', compteur: achat.ventes.length },
    { cle: 'recap', libelle: 'Récapitulatif' },
  ];

  return (
    <Page
      retour={{ to: '/achats', libelle: 'Achats' }}
      titre={achat.nom}
      badge={
        <>
          <BadgeStatutAchat statut={achat.statut} />
          <BadgeFigement fige={achat.fige} />
        </>
      }
      sousTitre={
        <div className="fiche-entete__meta">
          <span className="meta"><span className="meta__libelle">Commandée le</span><strong>{dateCourte(achat.dateCommande)}</strong></span>
          <span className="meta"><span className="meta__libelle">Arrivée estimée</span><strong>{dateCourte(achat.dateArriveeEstimee)}</strong></span>
          {achat.dateArrivee && <span className="meta"><span className="meta__libelle">Reçue le</span><strong>{dateCourte(achat.dateArrivee)}</strong></span>}
          {achat.fige && <span className="meta"><span className="meta__libelle">Figée le</span><strong>{dateHeure(achat.dateFigement)}</strong></span>}
          <span className="taux" title="Taux d'un euro sur cette commande">{formatTaux(achat.taux)}</span>
        </div>
      }
      actions={
        <>
          <Bouton icone={Pencil} onClick={() => setModification(true)}>Modifier</Bouton>
          <Bouton variante="danger" icone={Trash2} onClick={() => setSuppression(true)} aria-label="Supprimer la commande" />
        </>
      }
    >
      {achat.description && <p className="secondaire espace-bas">{achat.description}</p>}

      {/* Résumé collant, mobile uniquement */}
      <div className="recap-collant" aria-label="Résumé">
        <div className="recap-collant__item">
          <div className="recap-collant__libelle">Achat + frais</div>
          <div className="recap-collant__valeur">{ariary(r.achatAvecFrais)}</div>
        </div>
        <div className="recap-collant__item">
          <div className="recap-collant__libelle">Vente actuelle</div>
          <div className="recap-collant__valeur">{ariary(r.venteActuelle)}</div>
        </div>
        <div className="recap-collant__item">
          <div className="recap-collant__libelle">Marge réelle</div>
          <div className="recap-collant__valeur" style={{ color: r.margeReellePct === null ? undefined : r.margeReellePct >= 0 ? 'var(--succes)' : 'var(--danger)' }}>
            {pourcentage(r.margeReellePct)}
          </div>
        </div>
      </div>

      <div className="espace-bas">
        <Onglets onglets={onglets} actif={onglet} onChange={changerOnglet} />
      </div>

      {onglet === 'tarification' && <Tarification achat={achat} setAchat={setAchat} />}
      {onglet === 'frais' && <OngletFrais achat={achat} recharger={recharger} />}
      {onglet === 'budget' && <OngletBudget achat={achat} recharger={recharger} />}
      {onglet === 'publications' && <OngletPublications achat={achat} />}
      {onglet === 'ventes' && <OngletVentes achat={achat} />}
      {onglet === 'recap' && <OngletRecap achat={achat} />}

      <FormulaireAchat
        ouvert={modification}
        achat={achat}
        onFermer={() => setModification(false)}
        onEnregistre={(maj) => {
          setAchat(maj);
          setModification(false);
          notifier('Commande enregistrée');
        }}
      />
      <Confirmation
        ouverte={suppression}
        titre="Supprimer la commande ?"
        message={`« ${achat.nom} » et ses lignes, frais et boosts seront supprimés. Cette action est définitive.`}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppressionEnCours}
        onConfirmer={supprimer}
        onAnnuler={() => setSuppression(false)}
      />
    </Page>
  );
}
