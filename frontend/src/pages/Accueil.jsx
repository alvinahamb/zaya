import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { Accueil as ApiAccueil, Achats, Publications, Livraisons, messageErreur } from '../services/api.js';
import { useApi } from '../lib/hooks.js';
import { ariary, nombre, dateLongue, dateCourte, dateMoyenne, versInputDate, aujourdhuiISO, pluriel, SUIVANT_LIVRAISON } from '../lib/format.js';
import { Page } from '../components/layout/Page.jsx';
import { Carte, Indicateur } from '../components/ui/Carte.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Chargement, Encart, EtatVide } from '../components/ui/Divers.jsx';
import { RecapObjectifs } from './RecapObjectifs.jsx';

const STATUT_SUIVANT = { a_faire: 'creee', creee: 'publiee' };

/** Coche une tâche dérivée : la publication avance d'un statut, la commande est marquée reçue. */
async function accomplir(tache) {
  if (tache.type === 'publication') {
    const suivant = STATUT_SUIVANT[tache.cible.statut] ?? 'publiee';
    await Publications.changerStatut(tache.cible.idPublication, suivant);
  } else if (tache.type === 'livraison') {
    const suivant = SUIVANT_LIVRAISON[tache.cible.statut];
    if (suivant) await Livraisons.changerStatut(tache.cible.idLivraison, suivant.statut);
  } else if (tache.type === 'achat') {
    const achat = await Achats.lire(tache.cible.idAchat);
    await Achats.modifier(achat.id, {
      nom: achat.nom,
      description: achat.description,
      dateCommande: versInputDate(achat.dateCommande),
      dateArriveeEstimee: versInputDate(achat.dateArriveeEstimee),
      dateArrivee: aujourdhuiISO(),
      sommeAr: achat.sommeAr,
    });
  }
}

const NON_COCHABLE = {
  objectif: 'À mettre à jour depuis la page Objectifs',
};

/** Libellé de l'échéance d'une tâche selon sa position dans le temps. */
function libelleEcheance(tache) {
  if (!tache.echeance) return null;
  const date = dateCourte(tache.echeance);
  if (tache.quand === 'retard') return `En retard · ${date}`;
  if (tache.quand === 'jour') return `Aujourd'hui · ${date}`;
  if (tache.quand === 'demain') return `Demain · ${date}`;
  if (tache.jours !== null && tache.jours !== undefined) return `Dans ${pluriel(tache.jours, 'jour')} · ${date}`;
  return `Échéance : ${date}`;
}

/** Titre du groupe de tâches : en retard, aujourd'hui, demain, puis une ligne par jour. */
function libelleGroupe(tache) {
  if (tache.quand === 'retard') return 'En retard';
  if (tache.quand === 'jour') return "Aujourd'hui";
  if (tache.quand === 'demain') return 'Demain';
  if (tache.echeance) return dateMoyenne(tache.echeance);
  return 'Sans échéance';
}

function grouper(taches) {
  const groupes = [];
  for (const t of taches) {
    const libelle = libelleGroupe(t);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.libelle === libelle) dernier.taches.push(t);
    else groupes.push({ libelle, taches: [t] });
  }
  return groupes;
}

function Tache({ tache, faite, onCocher }) {
  const cochable = !(tache.type in NON_COCHABLE);
  return (
    <div className={`tache ${faite ? 'tache--faite' : ''}`}>
      <input
        type="checkbox"
        className="tache__case"
        checked={faite}
        disabled={!cochable || faite}
        onChange={() => onCocher(tache)}
        aria-label={cochable ? `Marquer comme faite : ${tache.libelle}` : tache.libelle}
        title={cochable ? undefined : NON_COCHABLE[tache.type]}
      />
      <div className="tache__corps">
        <div className="tache__libelle">
          <Link to={tache.lien}>{tache.libelle}</Link>
        </div>
        <div className="tache__meta">
          <Badge>{tache.module}</Badge>
          {tache.detail && <span>{tache.detail}</span>}
          {tache.echeance && (
            <span
              className={tache.enRetard || tache.quand === 'jour' ? 'gras' : ''}
              style={tache.enRetard ? { color: 'var(--danger)' } : tache.quand === 'jour' || tache.quand === 'demain' ? { color: 'var(--attention)' } : undefined}
            >
              {libelleEcheance(tache)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Accueil() {
  const { utilisateur } = useAuth();
  const { notifier } = useToast();
  const charger = useCallback(() => ApiAccueil.lire(), []);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  const [faites, setFaites] = useState(new Set());

  const cocher = async (tache) => {
    setFaites((s) => new Set(s).add(tache.id));
    try {
      await accomplir(tache);
      notifier('Tâche terminée');
      setTimeout(recharger, 600);
    } catch (err) {
      setFaites((s) => {
        const n = new Set(s);
        n.delete(tache.id);
        return n;
      });
      notifier(messageErreur(err), 'erreur');
    }
  };

  const prenom = (utilisateur?.nom || 'Admin').split(' ')[0];
  // Pas de liste ici : juste savoir s'il y a quelque chose à faire aujourd'hui côté livraisons
  const livraisonsJour = donnees?.livraisonsDuJour ?? [];
  const compter = (statut) => livraisonsJour.filter((l) => l.statut === statut).length;
  const resumeLivraisons = livraisonsJour.length
    ? [
        compter('a_programmer') && `${compter('a_programmer')} à appeler`,
        compter('programmee') && `${compter('programmee')} prévue${compter('programmee') > 1 ? 's' : ''}`,
        compter('en_cours') && `${compter('en_cours')} en cours`,
      ].filter(Boolean).join(' · ')
    : 'Rien de prévu';
  const taches = donnees?.taches ?? [];
  // Du jour : en retard ou aujourd'hui ; le reste est à venir sur l'horizon
  const tachesDuJour = taches.filter((t) => t.quand === 'retard' || t.quand === 'jour');
  const enRetard = taches.filter((t) => t.enRetard).length;
  const aVenir = taches.length - tachesDuJour.length;
  const horizon = donnees?.horizonJours ?? 14;
  const groupes = grouper(taches);

  return (
    <Page titre={`Bonjour ${prenom}`} sousTitre={dateLongue(donnees?.date || new Date().toISOString())}>
      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      {chargement && !donnees ? (
        <Chargement />
      ) : (
        donnees && (
          <>
            <div className="indicateurs espace-bas">
              <Indicateur libelle="Ventes du mois" valeur={ariary(donnees.kpis.caMoisAr)} sous={`${nombre(donnees.kpis.nbVentesMois)} vente${donnees.kpis.nbVentesMois > 1 ? 's' : ''}`} />
              <Indicateur libelle="Commandes en cours" valeur={nombre(donnees.kpis.achatsEnCours)} sous="Non reçues" />
              <Indicateur
                libelle="Livraisons aujourd'hui"
                valeur={nombre(livraisonsJour.length)}
                couleur={livraisonsJour.some((l) => l.enRetard) ? 'var(--danger)' : livraisonsJour.length ? 'var(--principale)' : undefined}
                sous={resumeLivraisons}
              />
              <Indicateur
                libelle="Tâches du jour"
                valeur={nombre(tachesDuJour.length)}
                couleur={enRetard ? 'var(--danger)' : undefined}
                sous={enRetard ? `${enRetard} en retard` : aVenir ? `${aVenir} à venir sur ${horizon} jours` : 'À jour'}
              />
            </div>

            <div className="accueil__grille">
              <Carte titre={`Tâches du jour et des ${horizon} prochains jours`} nu className="accueil__taches">
                {taches.length === 0 ? (
                  <EtatVide icone={CheckCircle2} titre={`Rien à faire sur ${horizon} jours`} description="Les contenus, réceptions, livraisons et objectifs apparaîtront ici, du plus proche au plus lointain." />
                ) : (
                  groupes.map((g) => (
                    <div key={g.libelle}>
                      <div className="tache-groupe">{g.libelle}</div>
                      {g.taches.map((t) => <Tache key={t.id} tache={t} faite={faites.has(t.id)} onCocher={cocher} />)}
                    </div>
                  ))
                )}
              </Carte>

              <RecapObjectifs objectifs={donnees.objectifsProches ?? []} />
            </div>
          </>
        )
      )}
    </Page>
  );
}
