import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Megaphone, ExternalLink, Pin } from 'lucide-react';
import { Publications as ApiPublications, Reseaux, Achats } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { dateHeure, aujourdhuiISO, LIBELLES_STATUT_PUBLICATION } from '../../lib/format.js';
import { cleJour, debutSemaine } from '../../lib/calendrier.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Badge, BadgeStatutPublication } from '../../components/ui/Badge.jsx';
import { Selection } from '../../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide, Segment, Onglets, BoutonsExport } from '../../components/ui/Divers.jsx';
import { ApercuLien } from '../../components/ui/ApercuLien.jsx';
import { FormulairePublication } from './FormulairePublication.jsx';
import { CalendrierMois, CalendrierSemaine } from './Calendrier.jsx';

const CLE_VUE = 'zaya.publications.vue';

const COLONNES_EXPORT = [
  { cle: 'dateHeurePublication', titre: 'Date', valeur: (p) => dateHeure(p.dateHeurePublication) },
  { cle: 'nom', titre: 'Nom' },
  { cle: 'statut', titre: 'Statut', valeur: (p) => LIBELLES_STATUT_PUBLICATION[p.statut] },
  { cle: 'reseau', titre: 'Réseau', valeur: (p) => p.Reseau?.nom },
  { cle: 'achat', titre: 'Commande', valeur: (p) => p.Achat?.nom },
  { cle: 'lienPinterest', titre: 'Lien Pinterest' },
  { cle: 'lienContenu', titre: 'Lien contenu' },
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

/** Carte d'une publication, avec l'aperçu de l'idée Pinterest en visuel. */
function CartePublication({ publication: p, onOuvrir }) {
  return (
    <div className="carte carte--cliquable carte-pub" role="button" tabIndex={0} onClick={() => onOuvrir(p)} onKeyDown={(e) => e.key === 'Enter' && onOuvrir(p)}>
      <div className="carte-pub__visuel">
        <ApercuLien url={p.lienPinterest} alt="" />
        <span className="carte-pub__statut">
          <BadgeStatutPublication statut={p.statut} />
        </span>
      </div>
      <div className="carte-produit__corps">
        <div className="carte-produit__nom">{p.nom}</div>
        <div className="tres-petit secondaire">{dateHeure(p.dateHeurePublication)}</div>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          {p.Reseau && <Badge ton="info">{p.Reseau.nom}</Badge>}
          {p.Achat && <Link to={`/achats/${p.Achat.id}`} className="tres-petit" onClick={(e) => e.stopPropagation()}>{p.Achat.nom}</Link>}
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
  const [formulaire, setFormulaire] = useState(null); // { publication?, date? }

  // « ?nouveau=1 » (bouton Nouveau de la barre) ouvre directement le formulaire
  const nouveauDemande = params.get('nouveau') === '1';
  const formulaireOuvert = formulaire ?? (nouveauDemande ? { date: aujourdhuiISO() } : null);
  const fermerFormulaire = () => {
    setFormulaire(null);
    if (nouveauDemande) {
      params.delete('nouveau');
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
    () => ApiPublications.lister({ ...periode, statut: statut || undefined, reseau: reseau || undefined }),
    [periode, statut, reseau],
  );
  const chargerReseaux = useCallback(() => Reseaux.lister(), []);
  const chargerAchats = useCallback(() => Achats.lister(), []);
  const { donnees: publications, chargement, erreur, recharger } = useApi(charger);
  const { donnees: reseaux } = useApi(chargerReseaux);
  const { donnees: achats } = useApi(chargerAchats);

  // « ?ouvrir=<id> » depuis une notification ou la recherche : on charge puis on ouvre
  const idAOuvrir = params.get('ouvrir');
  useEffect(() => {
    if (!idAOuvrir) return;
    ApiPublications.lire(idAOuvrir)
      .then((p) => {
        setFormulaire({ publication: p });
        if (p.dateHeurePublication) setCurseur(new Date(p.dateHeurePublication));
      })
      .catch(() => notifier('Publication introuvable', 'erreur'));
    setParams((precedents) => {
      precedents.delete('ouvrir');
      return precedents;
    }, { replace: true });
  }, [idAOuvrir, setParams, notifier]);

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
  const ouvrir = (p) => setFormulaire({ publication: p });

  return (
    <Page titre="Publications" actions={<Bouton variante="principal" icone={Plus} onClick={() => ouvrirNouveau()}>Nouvelle publication</Bouton>}>
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
            <Selection value={statut} onChange={(e) => setStatut(e.target.value)} placeholder="Tous les statuts" options={Object.entries(LIBELLES_STATUT_PUBLICATION).map(([valeur, libelle]) => ({ valeur, libelle }))} aria-label="Filtrer par statut" />
            <Selection value={reseau} onChange={(e) => setReseau(e.target.value)} placeholder="Tous les réseaux" options={(reseaux ?? []).map((r) => ({ valeur: String(r.id), libelle: r.nom }))} aria-label="Filtrer par réseau" />
            <div className="pousser">
              <BoutonsExport nomFichier="publications" titre="Publications" colonnes={COLONNES_EXPORT} lignes={listeTriee} />
            </div>
          </>
        )}
      </div>

      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      {chargement && !publications ? (
        <Chargement />
      ) : onglet === 'calendrier' ? (
        vueCalendrier === 'mois' ? (
          <CalendrierMois annee={curseur.getFullYear()} mois={curseur.getMonth()} publications={publications ?? []} onJour={ouvrirNouveau} onOuvrir={ouvrir} />
        ) : (
          <CalendrierSemaine depart={debutSemaine(curseur)} publications={publications ?? []} onJour={ouvrirNouveau} onOuvrir={ouvrir} />
        )
      ) : listeTriee.length === 0 ? (
        <Carte nu>
          <EtatVide icone={Megaphone} titre="Aucune publication" description="Planifiez vos contenus à créer et à publier." action={<Bouton variante="principal" icone={Plus} onClick={() => ouvrirNouveau()}>Nouvelle publication</Bouton>} />
        </Carte>
      ) : (
        <div className="grille-produits">
          {listeTriee.map((p) => <CartePublication key={p.id} publication={p} onOuvrir={ouvrir} />)}
        </div>
      )}

      <FormulairePublication
        ouvert={formulaireOuvert !== null}
        publication={formulaireOuvert?.publication}
        dateParDefaut={formulaireOuvert?.date}
        reseaux={reseaux ?? []}
        achats={achats ?? []}
        onFermer={fermerFormulaire}
        onEnregistre={() => {
          fermerFormulaire();
          notifier('Publication enregistrée');
          recharger();
        }}
        onSupprime={() => {
          fermerFormulaire();
          notifier('Publication supprimée');
          recharger();
        }}
      />
    </Page>
  );
}
