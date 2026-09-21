import { useEffect } from 'react';
import { Clients } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, ZoneTexte } from '../../components/ui/Champs.jsx';
import { ChoixReseaux } from '../../components/ui/ChoixReseaux.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

const vide = () => ({ nom: '', telephone: '', adresse: '', idReseaux: [], note: '' });

const depuisClient = (c) => ({
  nom: c.nom ?? '',
  telephone: c.telephone ?? '',
  adresse: c.adresse ?? '',
  idReseaux: c.idReseaux ?? [],
  note: c.note ?? '',
});

/** Création / modification d'un client (partagé entre Paramètres et le formulaire de vente). */
export function FormulaireClient({ ouvert, client, reseaux, onFermer, onEnregistre }) {
  const f = useFormulaire(vide());

  useEffect(() => {
    if (ouvert) f.reinitialiser(client ? depuisClient(client) : vide());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, client?.id]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() => (client ? Clients.modifier(client.id, f.valeurs) : Clients.creer(f.valeurs)));
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={client ? 'Modifier le client' : 'Nouveau client'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-client" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-client" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Nom et prénom" requis>
          {(id) => <Saisie id={id} name="nom" required autoFocus value={f.valeurs.nom} onChange={f.surChangement} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Téléphone">
            {(id) => <Saisie id={id} name="telephone" type="tel" inputMode="tel" value={f.valeurs.telephone} onChange={f.surChangement} placeholder="034 00 000 00" />}
          </Champ>
        </div>
        <Champ libelle="Réseaux sociaux" aide="Par lesquels il commande">
          <ChoixReseaux reseaux={reseaux} valeurs={f.valeurs.idReseaux} onChange={(v) => f.changer('idReseaux', v)} />
        </Champ>
        <Champ libelle="Adresse" aide="Reprise par défaut sur ses livraisons">
          {(id) => <ZoneTexte id={id} name="adresse" rows={2} value={f.valeurs.adresse} onChange={f.surChangement} />}
        </Champ>
        <Champ libelle="Note">
          {(id) => <ZoneTexte id={id} name="note" rows={2} value={f.valeurs.note} onChange={f.surChangement} placeholder="Préférences, horaires, remarques…" />}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
