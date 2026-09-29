import { useEffect } from 'react';
import { Publications } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { versInputDateHeure, LIBELLES_STATUT_PUBLICATION, STATUTS_PUBLICATION_ACTIFS, LIBELLES_TYPE_CONTENU } from '../../lib/format.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, Selection, ZoneTexte } from '../../components/ui/Champs.jsx';
import { ChoixReseaux } from '../../components/ui/ChoixReseaux.jsx';
import { Encart, Segment } from '../../components/ui/Divers.jsx';
import { ChoixBijoux } from './ChoixBijoux.jsx';

const vide = ({ date, idAchat } = {}) => ({
  nom: '',
  description: '',
  type: 'publication',
  statut: 'a_faire',
  dateHeurePublication: date ? `${date}T10:00` : '',
  idReseaux: [],
  // Heure propre à chaque réseau coché (id → datetime-local) ; vide = date principale
  datesReseaux: {},
  idAchat: idAchat ? String(idAchat) : '',
  idProduits: [],
  lienPinterest: '',
  lienContenu: '',
});

const depuisPublication = (p) => ({
  nom: p.nom ?? '',
  description: p.description ?? '',
  type: p.type ?? 'publication',
  statut: p.statut,
  dateHeurePublication: versInputDateHeure(p.dateHeurePublication),
  idReseaux: p.idReseaux ?? [],
  datesReseaux: Object.fromEntries((p.reseaux ?? []).filter((r) => r.dateHeurePropre).map((r) => [r.id, versInputDateHeure(r.dateHeurePropre)])),
  idAchat: p.idAchat ? String(p.idAchat) : '',
  idProduits: p.idProduits ?? [],
  lienPinterest: p.lienPinterest ?? '',
  lienContenu: p.lienContenu ?? '',
});

/** Corps envoyé à l'API : chaque réseau porte sa propre date, ou null pour suivre la date principale. */
const versCorps = (v) => ({
  ...v,
  reseaux: v.idReseaux.map((id) => ({ idReseau: id, dateHeurePublication: v.datesReseaux[id] || null })),
});

/** Création / modification d'un contenu (publication ou story) ; plusieurs réseaux possibles, chacun avec son heure. */
export function FormulairePublication({ ouvert, publication, dateParDefaut, achatParDefaut, reseaux, achats, onFermer, onEnregistre }) {
  const f = useFormulaire(vide());

  useEffect(() => {
    if (ouvert) f.reinitialiser(publication ? depuisPublication(publication) : vide({ date: dateParDefaut, idAchat: achatParDefaut }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, publication?.id, dateParDefaut, achatParDefaut]);

  const soumettre = async (e) => {
    e.preventDefault();
    const corps = versCorps(f.valeurs);
    const resultat = await f.soumettre(() => (publication ? Publications.modifier(publication.id, corps) : Publications.creer(corps)));
    if (resultat) onEnregistre(resultat);
  };

  // Bijoux disponibles : ceux de la commande choisie
  const articles = achats.find((a) => String(a.id) === f.valeurs.idAchat)?.articles ?? [];
  const changerAchat = (e) => {
    const idAchat = e.target.value;
    const disponibles = new Set((achats.find((a) => String(a.id) === idAchat)?.articles ?? []).map((a) => a.idProduit));
    f.changer('idAchat', idAchat);
    // Les bijoux qui ne sont pas dans la nouvelle commande sont retirés
    f.changer('idProduits', f.valeurs.idProduits.filter((id) => disponibles.has(id)));
  };

  const changerDateReseau = (id, valeur) => f.changer('datesReseaux', { ...f.valeurs.datesReseaux, [id]: valeur });
  const reseauxCoches = f.valeurs.idReseaux.map((id) => reseaux.find((r) => r.id === id)).filter(Boolean);

  // Une publication à la corbeille garde son statut tant qu'on ne la restaure pas
  const statuts = f.valeurs.statut === 'supprimee' ? ['supprimee'] : STATUTS_PUBLICATION_ACTIFS;

  return (
    <Modale
      ouverte={ouvert}
      titre={publication ? 'Modifier le contenu' : 'Nouveau contenu'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-publication" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-publication" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Type">
          <Segment
            libelle="Type de contenu"
            valeur={f.valeurs.type}
            onChange={(type) => f.changer('type', type)}
            options={Object.entries(LIBELLES_TYPE_CONTENU).map(([valeur, libelle]) => ({ valeur, libelle }))}
          />
        </Champ>
        <Champ libelle="Nom" requis>
          {(id) => <Saisie id={id} name="nom" required autoFocus value={f.valeurs.nom} onChange={f.surChangement} placeholder="Ex. Reel nouveautés colliers" />}
        </Champ>
        <Champ libelle="Description">
          {(id) => <ZoneTexte id={id} name="description" rows={3} value={f.valeurs.description} onChange={f.surChangement} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Date et heure prévues" aide={reseauxCoches.length > 1 ? 'Date par défaut, ajustable réseau par réseau ci-dessous' : undefined}>
            {(id) => <Saisie id={id} name="dateHeurePublication" type="datetime-local" value={f.valeurs.dateHeurePublication} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Statut">
            {(id) => (
              <Selection id={id} name="statut" value={f.valeurs.statut} onChange={f.surChangement} disabled={statuts.length === 1} options={statuts.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT_PUBLICATION[s] }))} />
            )}
          </Champ>
        </div>
        <Champ libelle="Réseaux sociaux" aide="Cochez tous les réseaux où le contenu paraîtra">
          <ChoixReseaux reseaux={reseaux} valeurs={f.valeurs.idReseaux} onChange={(v) => f.changer('idReseaux', v)} />
        </Champ>
        {reseauxCoches.length > 0 && (
          <Champ libelle="Heure de publication par réseau" aide="Laissez vide pour reprendre la date et l'heure prévues ci-dessus">
            <div className="dates-reseaux">
              {reseauxCoches.map((r) => (
                <div key={r.id} className="dates-reseaux__ligne">
                  <span className="dates-reseaux__nom">{r.nom}</span>
                  <Saisie
                    type="datetime-local"
                    value={f.valeurs.datesReseaux[r.id] ?? ''}
                    placeholder={f.valeurs.dateHeurePublication}
                    onChange={(e) => changerDateReseau(r.id, e.target.value)}
                    aria-label={`Date et heure de publication sur ${r.nom}`}
                  />
                  {f.valeurs.datesReseaux[r.id] && (
                    <Bouton variante="discret" taille="petit" onClick={() => changerDateReseau(r.id, '')} aria-label={`Reprendre la date principale pour ${r.nom}`} title="Reprendre la date principale">
                      ×
                    </Bouton>
                  )}
                </div>
              ))}
            </div>
          </Champ>
        )}
        <Champ libelle="Commande liée">
          {(id) => <Selection id={id} name="idAchat" value={f.valeurs.idAchat} onChange={changerAchat} placeholder="Aucune" options={achats.map((a) => ({ valeur: String(a.id), libelle: a.nom }))} />}
        </Champ>
        <Champ
          libelle="Bijoux dans le contenu"
          aide={!f.valeurs.idAchat ? "Choisissez d'abord la commande liée" : articles.length ? 'Touchez les bijoux qui apparaîtront dans le contenu' : undefined}
        >
          {f.valeurs.idAchat && (
            <ChoixBijoux articles={articles} valeurs={f.valeurs.idProduits} onChange={(v) => f.changer('idProduits', v)} />
          )}
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
