import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Publications, messageErreur } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { versInputDateHeure, LIBELLES_STATUT_PUBLICATION } from '../../lib/format.js';
import { Modale, Confirmation } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, Selection, ZoneTexte } from '../../components/ui/Champs.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

const vide = (dateParDefaut) => ({
  nom: '',
  description: '',
  statut: 'a_faire',
  dateHeurePublication: dateParDefaut ? `${dateParDefaut}T10:00` : '',
  idReseau: '',
  idAchat: '',
  lienPinterest: '',
  lienContenu: '',
});

const depuisPublication = (p) => ({
  nom: p.nom ?? '',
  description: p.description ?? '',
  statut: p.statut,
  dateHeurePublication: versInputDateHeure(p.dateHeurePublication),
  idReseau: p.idReseau ? String(p.idReseau) : '',
  idAchat: p.idAchat ? String(p.idAchat) : '',
  lienPinterest: p.lienPinterest ?? '',
  lienContenu: p.lienContenu ?? '',
});

export function FormulairePublication({ ouvert, publication, dateParDefaut, reseaux, achats, onFermer, onEnregistre, onSupprime }) {
  const { notifier } = useToast();
  const f = useFormulaire(vide());
  const [suppression, setSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  useEffect(() => {
    if (ouvert) f.reinitialiser(publication ? depuisPublication(publication) : vide(dateParDefaut));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, publication?.id, dateParDefaut]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      publication ? Publications.modifier(publication.id, f.valeurs) : Publications.creer(f.valeurs),
    );
    if (resultat) onEnregistre(resultat);
  };

  const supprimer = async () => {
    setSuppressionEnCours(true);
    try {
      await Publications.supprimer(publication.id);
      setSuppression(false);
      onSupprime();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setSuppressionEnCours(false);
    }
  };

  return (
    <>
      <Modale
        ouverte={ouvert}
        titre={publication ? 'Modifier la publication' : 'Nouvelle publication'}
        onFermer={onFermer}
        pied={
          <>
            {publication && (
              <Bouton variante="danger" icone={Trash2} onClick={() => setSuppression(true)} style={{ marginRight: 'auto' }}>
                Supprimer
              </Bouton>
            )}
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
                <Selection id={id} name="statut" value={f.valeurs.statut} onChange={f.surChangement} options={Object.entries(LIBELLES_STATUT_PUBLICATION).map(([valeur, libelle]) => ({ valeur, libelle }))} />
              )}
            </Champ>
          </div>
          <div className="formulaire__ligne">
            <Champ libelle="Réseau social">
              {(id) => <Selection id={id} name="idReseau" value={f.valeurs.idReseau} onChange={f.surChangement} placeholder="Aucun" options={reseaux.map((r) => ({ valeur: String(r.id), libelle: r.nom }))} />}
            </Champ>
            <Champ libelle="Commande liée">
              {(id) => <Selection id={id} name="idAchat" value={f.valeurs.idAchat} onChange={f.surChangement} placeholder="Aucune" options={achats.map((a) => ({ valeur: String(a.id), libelle: a.nom }))} />}
            </Champ>
          </div>
          <Champ libelle="Lien Pinterest" aide="Idée d'origine">
            {(id) => <Saisie id={id} name="lienPinterest" type="url" value={f.valeurs.lienPinterest} onChange={f.surChangement} placeholder="https://pinterest.com/…" />}
          </Champ>
          <Champ libelle="Lien du contenu créé">
            {(id) => <Saisie id={id} name="lienContenu" type="url" value={f.valeurs.lienContenu} onChange={f.surChangement} placeholder="https://…" />}
          </Champ>
          {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
        </form>
      </Modale>
      <Confirmation
        ouverte={suppression}
        titre="Supprimer la publication ?"
        message={`« ${publication?.nom} » sera retirée du planning.`}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppressionEnCours}
        onConfirmer={supprimer}
        onAnnuler={() => setSuppression(false)}
      />
    </>
  );
}
