import { useEffect } from 'react';
import { Publications } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { versInputDateHeure, LIBELLES_STATUT_PUBLICATION, STATUTS_PUBLICATION_ACTIFS } from '../../lib/format.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, Selection, ZoneTexte } from '../../components/ui/Champs.jsx';
import { ChoixReseaux } from '../../components/ui/ChoixReseaux.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

const vide = ({ date, idAchat } = {}) => ({
  nom: '',
  description: '',
  statut: 'a_faire',
  dateHeurePublication: date ? `${date}T10:00` : '',
  idReseaux: [],
  idAchat: idAchat ? String(idAchat) : '',
  lienPinterest: '',
  lienContenu: '',
});

const depuisPublication = (p) => ({
  nom: p.nom ?? '',
  description: p.description ?? '',
  statut: p.statut,
  dateHeurePublication: versInputDateHeure(p.dateHeurePublication),
  idReseaux: p.idReseaux ?? [],
  idAchat: p.idAchat ? String(p.idAchat) : '',
  lienPinterest: p.lienPinterest ?? '',
  lienContenu: p.lienContenu ?? '',
});

/** Création / modification d'une publication ; plusieurs réseaux possibles. */
export function FormulairePublication({ ouvert, publication, dateParDefaut, achatParDefaut, reseaux, achats, onFermer, onEnregistre }) {
  const f = useFormulaire(vide());

  useEffect(() => {
    if (ouvert) f.reinitialiser(publication ? depuisPublication(publication) : vide({ date: dateParDefaut, idAchat: achatParDefaut }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, publication?.id, dateParDefaut, achatParDefaut]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      publication ? Publications.modifier(publication.id, f.valeurs) : Publications.creer(f.valeurs),
    );
    if (resultat) onEnregistre(resultat);
  };

  // Une publication à la corbeille garde son statut tant qu'on ne la restaure pas
  const statuts = f.valeurs.statut === 'supprimee' ? ['supprimee'] : STATUTS_PUBLICATION_ACTIFS;

  return (
    <Modale
      ouverte={ouvert}
      titre={publication ? 'Modifier la publication' : 'Nouvelle publication'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-publication" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-publication" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Nom" requis>
          {(id) => <Saisie id={id} name="nom" required autoFocus value={f.valeurs.nom} onChange={f.surChangement} placeholder="Ex. Reel nouveautés colliers" />}
        </Champ>
        <Champ libelle="Description">
          {(id) => <ZoneTexte id={id} name="description" rows={3} value={f.valeurs.description} onChange={f.surChangement} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Date et heure prévues">
            {(id) => <Saisie id={id} name="dateHeurePublication" type="datetime-local" value={f.valeurs.dateHeurePublication} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Statut">
            {(id) => (
              <Selection id={id} name="statut" value={f.valeurs.statut} onChange={f.surChangement} disabled={statuts.length === 1} options={statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT_PUBLICATION[s] }))} />
            )}
          </Champ>
        </div>
        <Champ libelle="Réseaux sociaux" aide="Cochez tous les réseaux où la publication paraîtra">
          <ChoixReseaux reseaux={reseaux} valeurs={f.valeurs.idReseaux} onChange={(v) => f.changer('idReseaux', v)} />
        </Champ>
        <Champ libelle="Commande liée">
          {(id) => <Selection id={id} name="idAchat" value={f.valeurs.idAchat} onChange={f.surChangement} placeholder="Aucune" options={achats.map((a) => ({ valeur: String(a.id), libelle: a.nom }))} />}
        </Champ>
        <Champ libelle="Lien Pinterest" aide="Idée d'origine">
          {(id) => <Saisie id={id} name="lienPinterest" type="url" value={f.valeurs.lienPinterest} onChange={f.surChangement} placeholder="https://pinterest.com/…" />}
        </Champ>
        <Champ libelle="Lien du contenu créé">
          {(id) => <Saisie id={id} name="lienContenu" type="url" value={f.valeurs.lienContenu} onChange={f.surChangement} placeholder="https://…" />}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
