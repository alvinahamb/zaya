import { useEffect } from 'react';
import { Achats } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { versInputDate, aujourdhuiISO } from '../../lib/format.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, SaisieMontant, ZoneTexte } from '../../components/ui/Champs.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

const vide = () => ({
  nom: '',
  description: '',
  dateCommande: aujourdhuiISO(),
  dateArriveeEstimee: '',
  dateArrivee: '',
  sommeAr: '',
});

const depuisAchat = (a) => ({
  nom: a.nom ?? '',
  description: a.description ?? '',
  dateCommande: versInputDate(a.dateCommande),
  dateArriveeEstimee: versInputDate(a.dateArriveeEstimee),
  dateArrivee: versInputDate(a.dateArrivee),
  sommeAr: a.sommeAr ?? '',
});

/** Création et modification de l'en-tête d'une commande. */
export function FormulaireAchat({ ouvert, achat, onFermer, onEnregistre }) {
  const f = useFormulaire(vide());

  useEffect(() => {
    if (ouvert) f.reinitialiser(achat ? depuisAchat(achat) : vide());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, achat?.id]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      achat ? Achats.modifier(achat.id, f.valeurs) : Achats.creer(f.valeurs),
    );
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={achat ? 'Modifier la commande' : 'Nouvelle commande'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-achat" chargement={f.envoi}>
            {achat ? 'Enregistrer' : 'Créer la commande'}
          </Bouton>
        </>
      }
    >
      <form id="formulaire-achat" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Nom" requis>
          {(id) => <Saisie id={id} name="nom" required autoFocus value={f.valeurs.nom} onChange={f.surChangement} placeholder="Ex. Commande de septembre" />}
        </Champ>
        <Champ libelle="Description">
          {(id) => <ZoneTexte id={id} name="description" value={f.valeurs.description} onChange={f.surChangement} rows={2} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Date de commande">
            {(id) => <Saisie id={id} name="dateCommande" type="date" value={f.valeurs.dateCommande} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Arrivée estimée">
            {(id) => <Saisie id={id} name="dateArriveeEstimee" type="date" value={f.valeurs.dateArriveeEstimee} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Arrivée réelle" aide="À renseigner à la réception">
            {(id) => <Saisie id={id} name="dateArrivee" type="date" value={f.valeurs.dateArrivee} onChange={f.surChangement} />}
          </Champ>
        </div>
        <Champ
          libelle="Somme payée (Ar)"
          aide={achat?.fige ? 'Figée avec la tarification : elle détermine le taux.' : 'Montant réellement payé en Ariary. Sert à calculer le taux d’un euro.'}
        >
          {(id) => (
            <SaisieMontant id={id} name="sommeAr" suffixe="Ar" value={f.valeurs.sommeAr} onChange={f.surChangement} disabled={Boolean(achat?.fige)} />
          )}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
