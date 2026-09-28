import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2, MoreHorizontal, RotateCcw, Plus, ExternalLink, Pin, Rocket, CheckCircle2 } from 'lucide-react';
import { Publications, Boosts, Frais, Reseaux, Achats, messageErreur } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, dateHeure, dateCourte } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Badge, BadgeStatutPublication } from '../../components/ui/Badge.jsx';
import { Montant } from '../../components/ui/Montant.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { Chargement, Encart, EtatVide, MenuDeroulant, ElementMenu } from '../../components/ui/Divers.jsx';
import { ApercuLien } from '../../components/ui/ApercuLien.jsx';
import { FormulairePublication } from './FormulairePublication.jsx';
import { ReseauxPublication } from '../../components/ui/ChoixReseaux.jsx';
import { FormulaireBoost } from './FormulaireBoost.jsx';
import { FormulaireFrais } from '../achats/OngletFrais.jsx';

const STATUT_SUIVANT = { a_faire: { statut: 'creee', libelle: 'Marquer créée' }, creee: { statut: 'publiee', libelle: 'Marquer publiée' } };

/** Un lien et son aperçu Open Graph, affiché en grand. */
function Visuel({ titre, url, icone: Icone, vide }) {
  return (
    <Carte nu className="fiche-pub__visuel">
      <div className="carte__entete"><h3>{titre}</h3></div>
      {url ? (
        <>
          <ApercuLien url={url} alt={titre} />
          <div className="fiche-pub__pied">
            <span className="fiche-pub__lien" title={url}>{url}</span>
            <a className="bouton bouton--secondaire bouton--petit" href={url} target="_blank" rel="noreferrer">
              <Icone size={16} aria-hidden="true" />
              Ouvrir
            </a>
          </div>
        </>
      ) : (
        <EtatVide icone={Icone} titre={vide} />
      )}
    </Carte>
  );
}

/** Boosts de la publication, avec leurs frais. */
function SectionBoosts({ publication, reseaux, recharger }) {
  const { notifier } = useToast();
  const [formulaire, setFormulaire] = useState(null);
  const [formulaireFrais, setFormulaireFrais] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const supprimer = async () => {
    setSuppression(true);
    try {
      if (aSupprimer.type === 'boost') await Boosts.supprimer(aSupprimer.element.id);
      else await Frais.supprimer(aSupprimer.element.id);
      notifier(aSupprimer.type === 'boost' ? 'Boost supprimé' : 'Frais supprimé');
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
        titre="Boosts"
        actions={
          <>
            <span className="petit secondaire">Total : <strong className="tabulaire">{ariary(publication.totalBoostsAr)}</strong></span>
            <Bouton variante="principal" taille="petit" icone={Plus} onClick={() => setFormulaire({})} disabled={!reseaux.length}>Ajouter</Bouton>
          </>
        }
        nu
      >
        {publication.boosts.length === 0 ? (
          <EtatVide icone={Rocket} titre="Aucun boost" description="Les promotions payantes de cette publication apparaîtront ici, avec leurs frais." />
        ) : (
          publication.boosts.map((b) => (
            <div key={b.id} className="boost">
              <div className="element">
                <div className="element__corps">
                  <div className="flex" style={{ flexWrap: 'wrap' }}>
                    <span className="element__titre">{b.nom || 'Boost'}</span>
                    {(b.reseaux ?? []).map((r) => <Badge key={r.id} ton="info">{r.nom}</Badge>)}
                  </div>
                  <div className="element__meta">
                    {dateCourte(b.dateBoost)}
                    {b.raison && ` · ${b.raison}`}
                  </div>
                </div>
                <Montant valeur={b.montantAr} className="gras" />
                <div className="element__actions">
                  <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaire({ boost: b })} aria-label="Modifier le boost" />
                  <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer({ type: 'boost', element: b })} aria-label="Supprimer le boost" />
                </div>
              </div>
              <div className="boost__frais">
                <div className="flex-entre">
                  <span className="petit gras">Frais du boost{b.Frais.length ? ` · ${ariary(b.totalAr - Number(b.montantAr))}` : ''}</span>
                  <Bouton variante="discret" taille="petit" icone={Plus} onClick={() => setFormulaireFrais({ idBoost: b.id })}>Frais</Bouton>
                </div>
                {b.Frais.map((x) => (
                  <div key={x.id} className="element petit">
                    <div className="element__corps">
                      {x.libelle || 'Frais'} <span className="secondaire">· {dateCourte(x.dateFrais)}</span>
                    </div>
                    <Montant valeur={x.montantAr} />
                    <div className="element__actions">
                      <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaireFrais({ idBoost: b.id, frais: x })} aria-label="Modifier le frais" />
                      <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer({ type: 'frais', element: x })} aria-label="Supprimer le frais" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </Carte>

      <FormulaireBoost
        ouvert={formulaire !== null}
        boost={formulaire?.boost}
        idPublication={publication.id}
        reseaux={reseaux}
        onFermer={() => setFormulaire(null)}
        onEnregistre={() => {
          setFormulaire(null);
          notifier('Boost enregistré');
          recharger();
        }}
      />
      <FormulaireFrais
        ouvert={formulaireFrais !== null}
        frais={formulaireFrais?.frais}
        cible={{ idBoost: formulaireFrais?.idBoost }}
        onFermer={() => setFormulaireFrais(null)}
        onEnregistre={() => {
          setFormulaireFrais(null);
          notifier('Frais enregistré');
          recharger();
        }}
      />
      <Confirmation
        ouverte={aSupprimer !== null}
        titre={aSupprimer?.type === 'boost' ? 'Supprimer ce boost ?' : 'Supprimer ce frais ?'}
        message={aSupprimer?.type === 'boost' ? 'Le boost et ses frais seront supprimés.' : 'Ce frais sera retiré du boost.'}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppression}
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}

export function FichePublication() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { notifier } = useToast();
  const charger = useCallback(() => Publications.lire(id), [id]);
  const chargerReseaux = useCallback(() => Reseaux.lister(), []);
  const chargerAchats = useCallback(() => Achats.lister(), []);
  const { donnees: publication, chargement, erreur, recharger, setDonnees } = useApi(charger);
  const { donnees: reseaux } = useApi(chargerReseaux);
  const { donnees: achats } = useApi(chargerAchats);
  const [modification, setModification] = useState(false);
  const [confirmation, setConfirmation] = useState(null); // 'corbeille' | 'definitif'
  const [enCours, setEnCours] = useState(false);

  const agir = async (action, message, apres) => {
    setEnCours(true);
    try {
      const resultat = await action();
      notifier(message);
      if (apres) apres(resultat);
      else setDonnees(resultat);
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnCours(false);
      setConfirmation(null);
    }
  };

  if (chargement && !publication) return <Page retour={{ to: '/publications', libelle: 'Publications' }}><Chargement /></Page>;
  if (erreur && !publication) return <Page retour={{ to: '/publications', libelle: 'Publications' }}><Encart ton="erreur">{erreur}</Encart></Page>;
  if (!publication) return null;

  const p = publication;
  const supprimee = p.statut === 'supprimee';
  const suivant = STATUT_SUIVANT[p.statut];

  return (
    <Page
      retour={{ to: '/publications', libelle: 'Publications' }}
      titre={p.nom}
      badge={<BadgeStatutPublication statut={p.statut} />}
      sousTitre={
        <div className="flex" style={{ flexWrap: 'wrap', gap: '4px 12px' }}>
          <span>{dateHeure(p.dateHeurePublication)}</span>
          <ReseauxPublication publication={p} />
          {p.achat && <span>Commande <Link to={`/achats/${p.achat.id}`}>{p.achat.nom}</Link></span>}
        </div>
      }
      actions={
        <>
          {supprimee ? (
            <Bouton variante="principal" icone={RotateCcw} chargement={enCours} onClick={() => agir(() => Publications.restaurer(p.id), 'Publication restaurée')}>
              Restaurer
            </Bouton>
          ) : (
            <>
              {suivant && (
                <Bouton variante="principal" icone={CheckCircle2} chargement={enCours} onClick={() => agir(() => Publications.changerStatut(p.id, suivant.statut), 'Statut mis à jour')}>
                  {suivant.libelle}
                </Bouton>
              )}
              <Bouton icone={Pencil} onClick={() => setModification(true)}>Modifier</Bouton>
            </>
          )}
          <MenuDeroulant bouton={({ basculer, ouvert }) => <Bouton icone={MoreHorizontal} onClick={basculer} aria-label="Plus d'actions" aria-expanded={ouvert} />}>
            {supprimee ? (
              <ElementMenu icone={Trash2} onClick={() => setConfirmation('definitif')}>Supprimer définitivement</ElementMenu>
            ) : (
              <ElementMenu icone={Trash2} onClick={() => setConfirmation('corbeille')}>Mettre à la corbeille</ElementMenu>
            )}
          </MenuDeroulant>
        </>
      }
    >
      {supprimee && <Encart ton="attention">Cette publication est à la corbeille. Restaurez-la pour la retrouver dans le calendrier et les tâches.</Encart>}

      <div className="fiche-pub espace-bas">
        <Visuel titre="Idée Pinterest" url={p.lienPinterest} icone={Pin} vide="Aucun lien Pinterest" />
        <Visuel titre="Contenu créé" url={p.lienContenu} icone={ExternalLink} vide="Pas encore de contenu lié" />
      </div>

      {p.description && (
        <Carte titre="Description" className="espace-bas">
          <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>
        </Carte>
      )}

      <SectionBoosts publication={p} reseaux={reseaux ?? []} recharger={recharger} />

      <FormulairePublication
        ouvert={modification}
        publication={p}
        reseaux={reseaux ?? []}
        achats={achats ?? []}
        onFermer={() => setModification(false)}
        onEnregistre={(maj) => {
          setDonnees(maj);
          setModification(false);
          notifier('Publication enregistrée');
        }}
      />
      <Confirmation
        ouverte={confirmation === 'corbeille'}
        titre="Mettre à la corbeille ?"
        message="La publication sort du calendrier et des tâches. Vous pourrez la restaurer depuis la liste (filtre « Corbeille »)."
        libelleConfirmer="Mettre à la corbeille"
        ton="danger"
        chargement={enCours}
        onConfirmer={() => agir(() => Publications.supprimer(p.id), 'Publication mise à la corbeille')}
        onAnnuler={() => setConfirmation(null)}
      />
      <Confirmation
        ouverte={confirmation === 'definitif'}
        titre="Supprimer définitivement ?"
        message="La publication et ses boosts seront supprimés. Cette action est irréversible."
        libelleConfirmer="Supprimer définitivement"
        ton="danger"
        chargement={enCours}
        onConfirmer={() => agir(() => Publications.supprimer(p.id, true), 'Publication supprimée', () => naviguer('/publications'))}
        onAnnuler={() => setConfirmation(null)}
      />
    </Page>
  );
}
