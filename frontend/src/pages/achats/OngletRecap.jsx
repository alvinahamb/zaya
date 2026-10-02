import { ariary, euro, pourcentage, nombre, taux as formatTaux } from '../../lib/format.js';
import { Carte, Indicateur } from '../../components/ui/Carte.jsx';

const couleurMarge = (pct) => (pct === null || pct === undefined ? undefined : pct >= 0 ? 'var(--succes)' : 'var(--danger)');

/** Indicateurs du cahier des charges, estimation avec le budget de communication, et détail des montants. */
export function OngletRecap({ achat }) {
  const r = achat.recap;
  // Montants des marges en Ariary, calculés à partir des mêmes bases que les pourcentages du serveur
  const margeEstimeeAr = r.achatAvecFrais ? r.estimationVente - r.achatAvecFrais : null;
  const margeReelleAr = r.achatAvecFrais ? r.venteActuelle - r.sommeBoosts - r.achatAvecFrais : null;
  // Communication prévue : le budget alloué, ou les boosts réels s'ils le dépassent déjà
  const { budgetAr, depenseAr, resteAr } = achat.budget;
  const communication = Math.max(budgetAr, r.sommeBoosts);
  const margeBudgetAr = r.achatAvecFrais ? r.estimationVente - r.achatAvecFrais - communication : null;
  const margeBudgetPct = r.achatAvecFrais ? (margeBudgetAr / r.achatAvecFrais) * 100 : null;
  const depasse = r.sommeBoosts > budgetAr;
  return (
    <div className="colonne" style={{ gap: 20 }}>
      <div className="bandeau-recap">
        <Indicateur libelle="Somme d'achat avec frais" valeur={ariary(r.achatAvecFrais)} sous={`Payé ${ariary(r.sommeAr)} + frais ${ariary(r.fraisAchat)}`} />
        <Indicateur libelle="Estimation de vente" valeur={ariary(r.estimationVente)} sous={`${nombre(r.quantiteAchetee)} article${r.quantiteAchetee > 1 ? 's' : ''} au prix posé`} />
        <Indicateur libelle="Somme des boosts" valeur={ariary(r.sommeBoosts)} sous="Boosts des contenus et leurs frais" />
        <Indicateur libelle="Vente actuelle" valeur={ariary(r.venteActuelle)} sous={`${nombre(r.quantiteVendue)} vendu${r.quantiteVendue > 1 ? 's' : ''}, ${nombre(r.stockRestant)} restant${r.stockRestant > 1 ? 's' : ''}`} />
        <Indicateur
          libelle="Marge estimée"
          valeur={ariary(margeEstimeeAr)}
          couleur={couleurMarge(r.margeEstimeePct)}
          sous={`${pourcentage(r.margeEstimeePct)} · Estimation − achat avec frais`}
        />
        <Indicateur
          libelle="Marge réelle"
          valeur={ariary(margeReelleAr)}
          couleur={couleurMarge(r.margeReellePct)}
          sous={`${pourcentage(r.margeReellePct)} · Vente − boosts − achat avec frais`}
        />
        <Indicateur
          libelle="Budget de communication"
          valeur={ariary(budgetAr)}
          couleur={depasse ? 'var(--danger)' : undefined}
          sous={budgetAr ? `Dépensé ${ariary(depenseAr)} · ${depasse ? `dépassé de ${ariary(-resteAr)}` : `reste ${ariary(resteAr)}`}` : 'Aucun budget alloué'}
        />
        <Indicateur
          libelle="Marge estimée avec budget"
          valeur={ariary(margeBudgetAr)}
          couleur={couleurMarge(margeBudgetPct)}
          sous={`${pourcentage(margeBudgetPct)} · Estimation − achat avec frais − ${depasse ? 'boosts (budget dépassé)' : 'budget'}`}
        />
      </div>

      <Carte titre="Détail">
        <dl className="definitions">
          <dt>Total de la commande</dt>
          <dd>
            {euro(r.sommeEuro)}
            {achat.sommeTotale !== null && <span className="tres-petit secondaire"> (somme des lignes : {euro(achat.somme)})</span>}
          </dd>
          <dt>Somme payée</dt>
          <dd>{ariary(r.sommeAr)}</dd>
          <dt>Taux d'un euro</dt>
          <dd>{formatTaux(r.tauxEuro)}</dd>
          <dt>Frais de la commande</dt>
          <dd>{ariary(r.fraisAchat)}</dd>
          <dt>Budget de communication alloué</dt>
          <dd>{ariary(budgetAr)}</dd>
          <dt>Boosts et frais de boosts</dt>
          <dd>{ariary(r.sommeBoosts)}</dd>
          <dt>Coût total estimé</dt>
          <dd>
            {ariary(r.achatAvecFrais + communication)}{' '}
            <span className="tres-petit secondaire">(achat avec frais + {depasse ? 'boosts' : 'budget'})</span>
          </dd>
          <dt>Articles achetés / vendus / réservés / restants</dt>
          <dd>{nombre(r.quantiteAchetee)} / {nombre(r.quantiteVendue)} / {nombre(r.quantiteReservee ?? 0)} / {nombre(r.stockRestant)}</dd>
        </dl>
      </Carte>
    </div>
  );
}
