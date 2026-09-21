import { useEffect } from 'react';
import { Livraisons } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { versInputDateHeure, LIBELLES_STATUT_LIVRAISON } from '../../lib/format.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, SaisieMontant, Selection, ZoneTexte } from '../../components/ui/Champs.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

/** Valeurs par défaut : le client de la vente et ses coordonnées. */
const vide = (vente) => ({
  libelle: '',
  idClient: vente?.client ? String(vente.client.id) : '',
  adresse: vente?.client?.adresse ?? '',
  telephone: vente?.client?.telephone ?? '',
  livreur: '',
  fraisAr: '',
  statut: 'a_programmer',
  dateHeureAppelLivreur: '',
  dateHeureLivraison: '',
  note: '',
});

const depuisLivraison = (l) => ({
  libelle: l.libelle ?? '',
  idClient: l.idClient ? String(l.idClient) : '',
  adresse: l.adresse ?? '',
  telephone: l.telephone ?? '',
  livreur: l.livreur ?? '',
  fraisAr: Number(l.fraisAr) ? l.fraisAr : '',
  statut: l.statut,
  dateHeureAppelLivreur: versInputDateHeure(l.dateHeureAppelLivreur),
  dateHeureLivraison: versInputDateHeure(l.dateHeureLivraison),
  note: l.note ?? '',
});

export function FormulaireLivraison({ ouvert, livraison, vente, clients, onFermer, onEnregistre }) {
  const f = useFormulaire(vide(vente));

  useEffect(() => {
    if (ouvert) f.reinitialiser(livraison ? depuisLivraison(livraison) : vide(vente));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, livraison?.id, vente?.id]);

  // Changer de client propose ses coordonnées si les champs sont vides
  const changerClient = (e) => {
    const idClient = e.target.value;
    const c = clients.find((x) => String(x.id) === idClient);
    f.setValeurs((v) => ({
      ...v,
      idClient,
      adresse: v.adresse || c?.adresse || '',
      telephone: v.telephone || c?.telephone || '',
    }));
  };

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      livraison ? Livraisons.modifier(livraison.id, f.valeurs) : Livraisons.creer({ ...f.valeurs, idVente: vente.id }),
    );
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={livraison ? 'Modifier la livraison' : 'Programmer une livraison'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-livraison" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-livraison" className="formulaire" onSubmit={soumettre} noValidate>
        <div className="formulaire__ligne">
          <Champ libelle="Client">
            {(id) => <Selection id={id} name="idClient" value={f.valeurs.idClient} onChange={changerClient} placeholder="Client anonyme" options={clients.map((c) => ({ valeur: String(c.id), libelle: c.nom }))} />}
          </Champ>
          <Champ libelle="Statut">
            {(id) => <Selection id={id} name="statut" value={f.valeurs.statut} onChange={f.surChangement} options={Object.entries(LIBELLES_STATUT_LIVRAISON).map(([valeur, libelle]) => ({ valeur, libelle }))} />}
          </Champ>
        </div>
        <Champ libelle="Adresse de livraison">
          {(id) => <ZoneTexte id={id} name="adresse" rows={2} value={f.valeurs.adresse} onChange={f.surChangement} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Téléphone">
            {(id) => <Saisie id={id} name="telephone" type="tel" inputMode="tel" value={f.valeurs.telephone} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Livreur" aide="Nom ou contact">
            {(id) => <Saisie id={id} name="livreur" value={f.valeurs.livreur} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Frais de livraison (Ar)">
            {(id) => <SaisieMontant id={id} name="fraisAr" suffixe="Ar" value={f.valeurs.fraisAr} onChange={f.surChangement} />}
          </Champ>
        </div>
        <div className="formulaire__ligne">
          <Champ libelle="Appeler les livreurs le" aide="Rappel dans les tâches du jour">
            {(id) => <Saisie id={id} name="dateHeureAppelLivreur" type="datetime-local" value={f.valeurs.dateHeureAppelLivreur} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Livraison prévue le">
            {(id) => <Saisie id={id} name="dateHeureLivraison" type="datetime-local" value={f.valeurs.dateHeureLivraison} onChange={f.surChangement} />}
          </Champ>
        </div>
        <Champ libelle="Libellé" aide="Facultatif">
          {(id) => <Saisie id={id} name="libelle" value={f.valeurs.libelle} onChange={f.surChangement} placeholder="Ex. Livraison Analakely" />}
        </Champ>
        <Champ libelle="Note">
          {(id) => <ZoneTexte id={id} name="note" rows={2} value={f.valeurs.note} onChange={f.surChangement} placeholder="Instructions, point de rendez-vous…" />}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
