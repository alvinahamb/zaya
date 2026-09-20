import { ariary, euro, pourcentage, nombre, taux as formatTaux } from '../../lib/format.js';
import { Carte, Indicateur } from '../../components/ui/Carte.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

const couleurMarge = (pct) => (pct === null || pct === undefined ? undefined : pct >= 0 ? 'var(--succes)' : 'var(--danger)');

/** Six indicateurs du cahier des charges, plus le détail des montants qui les composent. */
export function OngletRecap({ achat }) {
  const r = achat.recap;
  return (
    <div className="colonne" style={{ gap: 20 }}>
      {!achat.fige && (
        <Encart ton="attention">La tarification n'est pas figée : l'estimation de vente et la marge estimée reflètent le brouillon en cours.</Encart>
      )}
      <div className="bandeau-recap">
        <Indicateur libelle="Somme d'achat avec frais" valeur={ariary(r.achatAvecFrais)} sous={`Payé ${ariary(r.sommeAr)} + frais ${ariary(r.fraisAchat)}`} />
        <Indicateur libelle="Estimation de vente" valeur={ariary(r.estimationVente)} sous={`${nombre(r.quantiteAchetee)} article${r.quantiteAchetee > 1 ? 's' : ''} au prix posé`} />
        <Indicateur libelle="Somme des boosts" valeur={ariary(r.sommeBoosts)} sous="Boosts et leurs frais" />
        <Indicateur libelle="Vente actuelle" valeur={ariary(r.venteActuelle)} sous={`${nombre(r.quantiteVendue)} vendu${r.quantiteVendue > 1 ? 's' : ''}, ${nombre(r.stockRestant)} restant${r.stockRestant > 1 ? 's' : ''}`} />
        <Indicateur libelle="Marge estimée" valeur={pourcentage(r.margeEstimeePct)} couleur={couleurMarge(r.margeEstimeePct)} sous="Sur l'achat avec frais" />
        <Indicateur libelle="Marge réelle" valeur={pourcentage(r.margeReellePct)} couleur={couleurMarge(r.margeReellePct)} sous="Vente − boosts − achat" />
      </div>

      <Carte titre="Détail">
        <dl className="definitions">
          <dt>Somme de la commande</dt>
          <dd>{euro(r.sommeEuro)}</dd>
          <dt>Somme payée</dt>
          <dd>{ariary(r.sommeAr)}</dd>
          <dt>Taux d'un euro</dt>
          <dd>{formatTaux(r.tauxEuro)}</dd>
          <dt>Frais de la commande</dt>
          <dd>{ariary(r.fraisAchat)}</dd>
          <dt>Boosts et frais de boosts</dt>
          <dd>{ariary(r.sommeBoosts)}</dd>
          <dt>Articles achetés / vendus / restants</dt>
          <dd>{nombre(r.quantiteAchetee)} / {nombre(r.quantiteVendue)} / {nombre(r.stockRestant)}</dd>
        </dl>
      </Carte>
    </div>
  );
}
