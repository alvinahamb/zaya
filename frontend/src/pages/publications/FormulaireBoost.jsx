import { useEffect } from 'react';
import { Boosts } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { versInputDate, aujourdhuiISO } from '../../lib/format.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, SaisieMontant, ZoneTexte } from '../../components/ui/Champs.jsx';
import { ChoixReseaux } from '../../components/ui/ChoixReseaux.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

/** Boost (promotion payante) d'une publication, sur un de ses réseaux. */
export function FormulaireBoost({ ouvert, boost, idPublication, reseaux, onFermer, onEnregistre }) {
  const f = useFormulaire({ nom: '', idReseaux: [], dateBoost: aujourdhuiISO(), montantAr: '', raison: '' });

  useEffect(() => {
    if (ouvert) {
      f.reinitialiser(
        boost
          ? { nom: boost.nom ?? '', idReseaux: boost.idReseaux ?? [], dateBoost: versInputDate(boost.dateBoost), montantAr: boost.montantAr ?? '', raison: boost.raison ?? '' }
          : { nom: '', idReseaux: reseaux[0] ? [reseaux[0].id] : [], dateBoost: aujourdhuiISO(), montantAr: '', raison: '' },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, boost?.id]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      boost ? Boosts.modifier(boost.id, f.valeurs) : Boosts.creer({ ...f.valeurs, idPublication }),
    );
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={boost ? 'Modifier le boost' : 'Nouveau boost'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-boost" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-boost" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Nom">
          {(id) => <Saisie id={id} name="nom" autoFocus value={f.valeurs.nom} onChange={f.surChangement} placeholder="Ex. Boost lancement" />}
        </Champ>
        <Champ libelle="Réseaux sociaux" requis>
          <ChoixReseaux reseaux={reseaux} valeurs={f.valeurs.idReseaux} onChange={(v) => f.changer('idReseaux', v)} requis />
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Date">
            {(id) => <Saisie id={id} name="dateBoost" type="date" value={f.valeurs.dateBoost} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Montant (Ar)" requis>
            {(id) => <SaisieMontant id={id} name="montantAr" suffixe="Ar" required value={f.valeurs.montantAr} onChange={f.surChangement} />}
          </Champ>
        </div>
        <Champ libelle="Raison" aide="Objectif du boost">
          {(id) => <ZoneTexte id={id} name="raison" rows={2} value={f.valeurs.raison} onChange={f.surChangement} />}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
