import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Megaphone, ExternalLink, Pin, MoreHorizontal, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Publications as ApiPublications, Reseaux, Achats, messageErreur } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { dateHeure, versInputDateHeure, aujourdhuiISO, LIBELLES_STATUT_PUBLICATION } from '../../lib/format.js';
import { cleJour, debutSemaine } from '../../lib/calendrier.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { BadgeStatutPublication } from '../../components/ui/Badge.jsx';
import { Selection } from '../../components/ui/Champs.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { Chargement, Encart, EtatVide, Segment, Onglets, BoutonsCsv, MenuDeroulant, ElementMenu } from '../../components/ui/Divers.jsx';
import { dateCsv, codeCsv, idParNom, idsParNoms } from '../../lib/csv.js';
import { ApercuLien } from '../../components/ui/ApercuLien.jsx';
import { FormulairePublication } from './FormulairePublication.jsx';
import { ReseauxPublication } from '../../components/ui/ChoixReseaux.jsx';
import { CalendrierMois, CalendrierSemaine } from './Calendrier.jsx';

const CLE_VUE = 'zaya.publications.vue';

const COLONNES_CSV = [
  { cle: 'nom', titre: 'Nom' },
  { cle: 'dateHeurePublication', titre: 'Date', valeur: (p) => versInputDateHeure(p.dateHeurePublication).replace('T', ' ') },
  { cle: 'statut', titre: 'Statut', valeur: (p) => LIBELLES_STATUT_PUBLICATION[p.statut] },
  { cle: 'reseaux', titre: 'Réseaux', valeur: (p) => p.reseaux.map((r) => r.nom).join(', ') },
  { cle: 'achat', titre: 'Commande', valeur: (p) => p.achat?.nom },
  { cle: 'description', titre: 'Description' },
  { cle: 'lienPinterest', titre: 'Lien Pinterest' },
  { cle: 'lienContenu', titre: 'Lien contenu' },
];

const FILTRES_STATUT = [
  { valeur: 'a_faire', libelle: 'À faire' },
  { valeur: 'creee', libelle: 'Créées' },
  { valeur: 'publiee', libelle: 'Publiées' },
  { valeur: 'supprimee', libelle: 'Corbeille' },
];

function LienIcone({ href, icone: Icone, children }) {
  if (!href) return null;
  return (
    <a className="lien-icone" href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      <Icone size={14} aria-hidden="true" />
      {children}
    </a>
  );
}

/** Carte d'une publication : clic → fiche ; menu ⋯ → modifier, corbeille, restaurer. */
function CartePublication({ publication: p, onOuvrir, onModifier, onCorbeille, onRestaurer, onSupprimerDefinitivement }) {
  const supprimee = p.statut === 'supprimee';
  return (
    <div
      className={`carte carte--cliquable carte-pub ${supprimee ? 'carte-pub--supprimee' : ''}`}
      role="link"
      tabIndex={0}
      onClick={() => onOuvrir(p)}
      onKeyDown={(e) => e.key === 'Enter' && onOuvrir(p)}
    >
      <div className="carte-pub__visuel">
        <ApercuLien url={p.lienPinterest} alt="" />
        <span className="carte-pub__statut">
          <BadgeStatutPublication statut={p.statut} />
        </span>
        <div className="carte-pub__menu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <MenuDeroulant
            bouton={({ basculer, ouvert }) => (
              <Bouton variante="discret" taille="petit" icone={MoreHorizontal} onClick={basculer} aria-label={`Actions pour ${p.nom}`} aria-expanded={ouvert} />
            )}
          >
            {supprimee ? (
              <>
                <ElementMenu icone={RotateCcw} onClick={() => onRestaurer(p)}>Restaurer</ElementMenu>
                <ElementMenu icone={Trash2} onClick={() => onSupprimerDefinitivement(p)}>Supprimer définitivement</ElementMenu>
              </>
            ) : (
              <>
                <ElementMenu icone={Pencil} onClick={() => onModifier(p)}>Modifier</ElementMenu>
                <ElementMenu icone={Trash2} onClick={() => onCorbeille(p)}>Mettre à la corbeille</ElementMenu>
              </>
            )}
          </MenuDeroulant>
        </div>
      </div>
      <div className="carte-produit__corps">
        <div className="carte-produit__nom">{p.nom}</div>
        <div className="tres-petit secondaire">{dateHeure(p.dateHeurePublication)}</div>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          <ReseauxPublication publication={p} />
          {p.achat && <Link to={`/achats/${p.achat.id}`} className="tres-petit" onClick={(e) => e.stopPropagation()}>{p.achat.nom}</Link>}
        </div>
        <div className="liens-pub">
          <LienIcone href={p.lienPinterest} icone={Pin}>Pinterest</LienIcone>
          <LienIcone href={p.lienContenu} icone={ExternalLink}>Contenu</LienIcone>
        </div>
      </div>
    </div>
  );
}

export function Publications() {
  const { notifier } = useToast();
  const naviguer = useNavigate();
  const [params, setParams] = useSearchParams();
  const [onglet, setOnglet] = useState(() => (params.get('vue') === 'liste' ? 'liste' : 'calendrier'));
  const [vueCalendrier, setVueCalendrier] = useState(() => {
    try {
      return localStorage.getItem(CLE_VUE) || 'mois';
    } catch {
      return 'mois';
    }
  });
  const [curseur, setCurseur] = useState(() => new Date());
  const [statut, setStatut] = useState('');
  const [reseau, setReseau] = useState('');
  const [formulaire, setFormulaire] = useState(null); // { publication?, date?, idAchat? }
  const [confirmation, setConfirmation] = useState(null); // { type: 'corbeille' | 'definitif', publication }
  const [enCours, setEnCours] = useState(false);

  // « ?nouveau=1 » (bouton Nouveau, ou depuis une commande avec ?achat=) ouvre le formulaire
  const nouveauDemande = params.get('nouveau') === '1';
  const formulaireOuvert = formulaire ?? (nouveauDemande ? { date: aujourdhuiISO(), idAchat: params.get('achat') || undefined } : null);
  const fermerFormulaire = () => {
    setFormulaire(null);
    if (nouveauDemande) {
      params.delete('nouveau');
      params.delete('achat');
      setParams(params, { replace: true });
    }
  };

  const changerVueCalendrier = (v) => {
    setVueCalendrier(v);
    try {
      localStorage.setItem(CLE_VUE, v);
    } catch {
      /* ignoré */
    }
  };

  // Période chargée : le mois ou la semaine affichée ; tout en vue liste
  const periode = useMemo(() => {
    if (onglet === 'liste') return {};
    if (vueCalendrier === 'semaine') {
      const d = debutSemaine(curseur);
      const fin = new Date(d);
      fin.setDate(d.getDate() + 6);
      return { du: `${cleJour(d)}T00:00:00`, au: `${cleJour(fin)}T23:59:59` };
    }
    const debut = debutSemaine(new Date(curseur.getFullYear(), curseur.getMonth(), 1));
    const fin = new Date(debut);
    fin.setDate(debut.getDate() + 41);
    return { du: `${cleJour(debut)}T00:00:00`, au: `${cleJour(fin)}T23:59:59` };
  }, [onglet, vueCalendrier, curseur]);

  const charger = useCallback(
    () => ApiPublications.lister({ ...periode, statut: onglet === 'liste' && statut ? statut : undefined, reseau: reseau || undefined }),
    [periode, onglet, statut, reseau],
  );
  const chargerReseaux = useCallback(() => Reseaux.lister(), []);
  const chargerAchats = useCallback(() => Achats.lister(), []);
  const { donnees: publications, chargement, erreur, recharger } = useApi(charger);
  const { donnees: reseaux } = useApi(chargerReseaux);
  const { donnees: achats } = useApi(chargerAchats);

  const deplacer = (sens) => {
    const d = new Date(curseur);
    if (vueCalendrier === 'semaine') d.setDate(d.getDate() + 7 * sens);
    else d.setMonth(d.getMonth() + sens, 1);
    setCurseur(d);
  };

  const titrePeriode =
    vueCalendrier === 'semaine'
      ? `Semaine du ${debutSemaine(curseur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
      : curseur.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const listeTriee = useMemo(() => [...(publications ?? [])].sort((a, b) => (a.dateHeurePublication < b.dateHeurePublication ? 1 : -1)), [publications]);
  const ouvrirNouveau = (date = aujourdhuiISO()) => setFormulaire({ date });
  const ouvrirFiche = (p) => naviguer(`/publications/${p.id}`);

  const agir = async (action, message) => {
    setEnCours(true);
    try {
      await action();
      notifier(message);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnCours(false);
      setConfirmation(null);
    }
  };

  return (
    <Page titre="Publications" actions={<Bouton variante="principal" icone={Plus} compact onClick={() => ouvrirNouveau()}>Nouvelle publication</Bouton>}>
      <div className="espace-bas">
        <Onglets
          onglets={[{ cle: 'calendrier', libelle: 'Calendrier' }, { cle: 'liste', libelle: 'Liste', compteur: onglet === 'liste' ? listeTriee.length : undefined }]}
          actif={onglet}
          onChange={setOnglet}
        />
      </div>

      <div className="outils">
        {onglet === 'calendrier' ? (
          <>
            <Segment libelle="Vue" valeur={vueCalendrier} onChange={changerVueCalendrier} options={[{ valeur: 'mois', libelle: 'Mois', icone: CalendarDays }, { valeur: 'semaine', libelle: 'Semaine', icone: LayoutGrid }]} />
            <div className="calendrier__nav" style={{ marginBottom: 0 }}>
              <Bouton icone={ChevronLeft} onClick={() => deplacer(-1)} aria-label="Période précédente" />
              <Bouton icone={ChevronRight} onClick={() => deplacer(1)} aria-label="Période suivante" />
              <span className="calendrier__mois">{titrePeriode}</span>
              <Bouton variante="discret" taille="petit" onClick={() => setCurseur(new Date())}>Aujourd'hui</Bouton>
            </div>
          </>
        ) : (
          <>
            <Selection value={statut} onChange={(e) => setStatut(e.target.value)} placeholder="Tous les statuts" options={FILTRES_STATUT} aria-label="Filtrer par statut" />
            <Selection value={reseau} onChange={(e) => setReseau(e.target.value)} placeholder="Tous les réseaux" options={(reseaux ?? []).map((r) => ({ valeur: String(r.id), libelle: r.nom }))} aria-label="Filtrer par réseau" />
            <div className="pousser">
              <BoutonsCsv
                nomFichier="publications"
                colonnes={COLONNES_CSV}
                lignes={listeTriee}
                importer={(r) => ApiPublications.creer({
                  nom: r.nom,
                  description: r.description,
                  lienPinterest: r.lienPinterest,
                  lienContenu: r.lienContenu,
                  dateHeurePublication: dateCsv(r.dateHeurePublication),
                  statut: codeCsv(r.statut, LIBELLES_STATUT_PUBLICATION),
                  idReseaux: idsParNoms(r.reseaux, reseaux, 'Réseau'),
                  idAchat: idParNom(r.achat, achats, 'Commande'),
                })}
                onImporte={recharger}
              />
            </div>
          </>
        )}
      </div>

      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      {chargement && !publications ? (
        <Chargement />
      ) : onglet === 'calendrier' ? (
        vueCalendrier === 'mois' ? (
          <CalendrierMois annee={curseur.getFullYear()} mois={curseur.getMonth()} publications={publications ?? []} onJour={ouvrirNouveau} onOuvrir={ouvrirFiche} />
        ) : (
          <CalendrierSemaine depart={debutSemaine(curseur)} publications={publications ?? []} onJour={ouvrirNouveau} onOuvrir={ouvrirFiche} />
        )
      ) : listeTriee.length === 0 ? (
        <Carte nu>
          <EtatVide
            icone={Megaphone}
            titre={statut === 'supprimee' ? 'La corbeille est vide' : 'Aucune publication'}
            description={statut === 'supprimee' ? undefined : 'Planifiez vos contenus à créer et à publier.'}
            action={statut !== 'supprimee' && <Bouton variante="principal" icone={Plus} onClick={() => ouvrirNouveau()}>Nouvelle publication</Bouton>}
          />
        </Carte>
      ) : (
        <div className="grille-produits">
          {listeTriee.map((p) => (
            <CartePublication
              key={p.id}
              publication={p}
              onOuvrir={ouvrirFiche}
              onModifier={(pub) => setFormulaire({ publication: pub })}
              onCorbeille={(pub) => setConfirmation({ type: 'corbeille', publication: pub })}
              onRestaurer={(pub) => agir(() => ApiPublications.restaurer(pub.id), 'Publication restaurée')}
              onSupprimerDefinitivement={(pub) => setConfirmation({ type: 'definitif', publication: pub })}
            />
          ))}
        </div>
      )}

      <FormulairePublication
        ouvert={formulaireOuvert !== null}
        publication={formulaireOuvert?.publication}
        dateParDefaut={formulaireOuvert?.date}
        achatParDefaut={formulaireOuvert?.idAchat}
        reseaux={reseaux ?? []}
        achats={achats ?? []}
        onFermer={fermerFormulaire}
        onEnregistre={(p) => {
          const creation = !formulaireOuvert?.publication;
          fermerFormulaire();
          notifier('Publication enregistrée');
          if (creation) naviguer(`/publications/${p.id}`);
          else recharger();
        }}
      />
      <Confirmation
        ouverte={confirmation?.type === 'corbeille'}
        titre="Mettre à la corbeille ?"
        message={`« ${confirmation?.publication?.nom} » sort du calendrier et des tâches. Vous pourrez la restaurer depuis le filtre « Corbeille ».`}
        libelleConfirmer="Mettre à la corbeille"
        ton="danger"
        chargement={enCours}
        onConfirmer={() => agir(() => ApiPublications.supprimer(confirmation.publication.id), 'Publication mise à la corbeille')}
        onAnnuler={() => setConfirmation(null)}
      />
      <Confirmation
        ouverte={confirmation?.type === 'definitif'}
        titre="Supprimer définitivement ?"
        message={`« ${confirmation?.publication?.nom} » et ses boosts seront supprimés. Cette action est irréversible.`}
        libelleConfirmer="Supprimer définitivement"
        ton="danger"
        chargement={enCours}
        onConfirmer={() => agir(() => ApiPublications.supprimer(confirmation.publication.id, true), 'Publication supprimée')}
        onAnnuler={() => setConfirmation(null)}
      />
    </Page>
  );
}
