import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Wallet, Rocket } from 'lucide-react';
import { Budgets, messageErreur } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, dateCourte, versInputDate, aujourdhuiISO, pourcentage } from '../../lib/format.js';
import { Carte, Indicateur } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modale, Confirmation } from '../../components/ui/Modale.jsx';
import { Champ, Saisie, SaisieMontant } from '../../components/ui/Champs.jsx';
import { EtatVide, Encart } from '../../components/ui/Divers.jsx';
import { Montant } from '../../components/ui/Montant.jsx';

function FormulaireBudget({ ouvert, budget, idAchat, onFermer, onEnregistre }) {
  const f = useFormulaire({ libelle: '', montantAr: '', dateBudget: aujourdhuiISO() });

  useEffect(() => {
    if (ouvert) {
      f.reinitialiser(
        budget
          ? { libelle: budget.libelle ?? '', montantAr: budget.montantAr ?? '', dateBudget: versInputDate(budget.dateBudget) }
          : { libelle: '', montantAr: '', dateBudget: aujourdhuiISO() },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, budget?.id]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      budget ? Budgets.modifier(budget.id, f.valeurs) : Budgets.creer({ ...f.valeurs, idAchat }),
    );
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={budget ? 'Modifier le budget' : 'Nouveau budget'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-budget" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-budget" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Libellé" aide="Ex. Budget communication septembre">
          {(id) => <Saisie id={id} name="libelle" autoFocus value={f.valeurs.libelle} onChange={f.surChangement} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Montant (Ar)" requis>
            {(id) => <SaisieMontant id={id} name="montantAr" suffixe="Ar" required value={f.valeurs.montantAr} onChange={f.surChangement} placeholder="50000" />}
          </Champ>
          <Champ libelle="Date">
            {(id) => <Saisie id={id} name="dateBudget" type="date" value={f.valeurs.dateBudget} onChange={f.surChangement} />}
          </Champ>
        </div>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}

/** Budget de communication de la commande, consommé par les boosts de ses publications. */
export function OngletBudget({ achat, recharger }) {
  const { notifier } = useToast();
  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const { budgetAr, depenseAr, resteAr } = achat.budget;
  const taux = budgetAr > 0 ? (depenseAr / budgetAr) * 100 : null;
  const depasse = resteAr < 0;

  const supprimer = async () => {
    setSuppression(true);
    try {
      await Budgets.supprimer(aSupprimer.id);
      notifier('Budget supprimé');
      setASupprimer(null);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setSuppression(false);
    }
  };

  return (
    <div className="colonne" style={{ gap: 20 }}>
      <div className="indicateurs">
        <Indicateur libelle="Budget alloué" valeur={ariary(budgetAr)} sous={`${achat.budgets.length} ligne${achat.budgets.length > 1 ? 's' : ''}`} />
        <Indicateur libelle="Dépensé en boosts" valeur={ariary(depenseAr)} sous={taux === null ? 'Aucun budget défini' : `${pourcentage(taux, { signe: false })} du budget`} />
        <Indicateur libelle={depasse ? 'Dépassement' : 'Reste disponible'} valeur={ariary(Math.abs(resteAr))} couleur={depasse ? 'var(--danger)' : budgetAr > 0 ? 'var(--succes)' : undefined} />
      </div>

      {budgetAr > 0 && (
        <div>
          <div className="jauge" role="progressbar" aria-valuenow={Math.round(Math.min(100, taux))} aria-valuemin={0} aria-valuemax={100} aria-label="Consommation du budget">
            <div className={`jauge__barre ${depasse ? 'jauge__barre--depasse' : ''}`} style={{ width: `${Math.min(100, taux)}%` }} />
          </div>
          {depasse && <p className="petit" style={{ color: 'var(--danger)', marginTop: 6 }}>Les boosts dépassent le budget de {ariary(-resteAr)}.</p>}
        </div>
      )}

      <Carte titre="Budgets" actions={<Bouton variante="principal" taille="petit" icone={Plus} onClick={() => setFormulaire({})}>Ajouter</Bouton>} nu>
        {achat.budgets.length === 0 ? (
          <EtatVide icone={Wallet} titre="Aucun budget" description="Définissez le budget de communication de cette commande, par exemple 50 000 Ar." action={<Bouton variante="principal" icone={Plus} onClick={() => setFormulaire({})}>Ajouter un budget</Bouton>} />
        ) : (
          <div className="liste-elements">
            {achat.budgets.map((b) => (
              <div key={b.id} className="element">
                <div className="element__corps">
                  <div className="element__titre">{b.libelle || 'Budget'}</div>
                  <div className="element__meta">{dateCourte(b.dateBudget)}</div>
                </div>
                <Montant valeur={b.montantAr} className="gras" />
                <div className="element__actions">
                  <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaire({ budget: b })} aria-label="Modifier" />
                  <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer(b)} aria-label="Supprimer" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      <Carte titre="Dépenses : boosts des publications" actions={<span className="petit secondaire">Total : <strong className="tabulaire">{ariary(depenseAr)}</strong></span>} nu>
        {achat.boosts.length === 0 ? (
          <EtatVide icone={Rocket} titre="Aucun boost" description="Les boosts se créent depuis la fiche d'une publication liée à cette commande." />
        ) : (
          <div className="liste-elements">
            {achat.boosts.map((b) => (
              <div key={b.id} className="element">
                <div className="element__corps">
                  <div className="flex" style={{ flexWrap: 'wrap' }}>
                    <span className="element__titre">{b.nom || 'Boost'}</span>
                    {(b.reseaux ?? []).map((r) => <Badge key={r.id} ton="info">{r.nom}</Badge>)}
                  </div>
                  <div className="element__meta">
                    {dateCourte(b.dateBoost)} · <Link to={`/publications/${b.publication.id}`}>{b.publication.nom}</Link>
                    {b.Frais.length > 0 && ` · frais ${ariary(b.totalAr - Number(b.montantAr))}`}
                  </div>
                </div>
                <Montant valeur={b.totalAr} className="gras" />
              </div>
            ))}
          </div>
        )}
      </Carte>

      <FormulaireBudget
        ouvert={formulaire !== null}
        budget={formulaire?.budget}
        idAchat={achat.id}
        onFermer={() => setFormulaire(null)}
        onEnregistre={() => {
          setFormulaire(null);
          notifier('Budget enregistré');
          recharger();
        }}
      />
      <Confirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer ce budget ?"
        message={`${aSupprimer?.libelle || 'Ce budget'} (${ariary(aSupprimer?.montantAr)}) sera retiré de la commande.`}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppression}
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </div>
  );
}
