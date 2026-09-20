import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react';
import { Frais, messageErreur } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, dateCourte, versInputDate, aujourdhuiISO } from '../../lib/format.js';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Modale, Confirmation } from '../../components/ui/Modale.jsx';
import { Champ, Saisie, SaisieMontant } from '../../components/ui/Champs.jsx';
import { EtatVide, Encart } from '../../components/ui/Divers.jsx';
import { Montant } from '../../components/ui/Montant.jsx';

/** Formulaire d'un frais, rattaché à une commande (idAchat) ou à un boost (idBoost). */
export function FormulaireFrais({ ouvert, frais, cible, onFermer, onEnregistre }) {
  const f = useFormulaire({ libelle: '', montantAr: '', dateFrais: aujourdhuiISO() });

  useEffect(() => {
    if (ouvert) {
      f.reinitialiser(
        frais
          ? { libelle: frais.libelle ?? '', montantAr: frais.montantAr ?? '', dateFrais: versInputDate(frais.dateFrais) }
          : { libelle: '', montantAr: '', dateFrais: aujourdhuiISO() },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, frais?.id]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      frais ? Frais.modifier(frais.id, f.valeurs) : Frais.creer({ ...f.valeurs, ...cible }),
    );
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={frais ? 'Modifier le frais' : 'Nouveau frais'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-frais" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-frais" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Libellé" aide="Transport, douane, commission…">
          {(id) => <Saisie id={id} name="libelle" autoFocus value={f.valeurs.libelle} onChange={f.surChangement} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Montant (Ar)" requis>
            {(id) => <SaisieMontant id={id} name="montantAr" suffixe="Ar" required value={f.valeurs.montantAr} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Date">
            {(id) => <Saisie id={id} name="dateFrais" type="date" value={f.valeurs.dateFrais} onChange={f.surChangement} />}
          </Champ>
        </div>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}

export function OngletFrais({ achat, recharger }) {
  const { notifier } = useToast();
  const [formulaire, setFormulaire] = useState(null); // null | { frais? }
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const total = achat.frais.reduce((s, x) => s + Number(x.montantAr), 0);

  const supprimer = async () => {
    setSuppression(true);
    try {
      await Frais.supprimer(aSupprimer.id);
      notifier('Frais supprimé');
      setASupprimer(null);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setSuppression(false);
    }
  };

  return (
    <>
      <Carte
        titre="Frais de la commande"
        actions={
          <>
            <span className="petit secondaire">Total : <strong className="tabulaire">{ariary(total)}</strong></span>
            <Bouton variante="principal" taille="petit" icone={Plus} onClick={() => setFormulaire({})}>Ajouter</Bouton>
          </>
        }
        nu
      >
        {achat.frais.length === 0 ? (
          <EtatVide icone={Receipt} titre="Aucun frais" description="Transport, douane, commissions… ajoutez les frais liés à cette commande." />
        ) : (
          <div className="liste-elements">
            {achat.frais.map((x) => (
              <div key={x.id} className="element">
                <div className="element__corps">
                  <div className="element__titre">{x.libelle || 'Frais'}</div>
                  <div className="element__meta">{dateCourte(x.dateFrais)}</div>
                </div>
                <Montant valeur={x.montantAr} className="gras" />
                <div className="element__actions">
                  <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaire({ frais: x })} aria-label="Modifier" />
                  <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer(x)} aria-label="Supprimer" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      <FormulaireFrais
        ouvert={formulaire !== null}
        frais={formulaire?.frais}
        cible={{ idAchat: achat.id }}
        onFermer={() => setFormulaire(null)}
        onEnregistre={() => {
          setFormulaire(null);
          notifier('Frais enregistré');
          recharger();
        }}
      />
      <Confirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer ce frais ?"
        message={`${aSupprimer?.libelle || 'Ce frais'} (${ariary(aSupprimer?.montantAr)}) sera retiré de la commande.`}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppression}
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}
