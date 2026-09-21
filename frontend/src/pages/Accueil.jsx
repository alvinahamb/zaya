import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { Accueil as ApiAccueil, Achats, Publications, Livraisons, messageErreur } from '../services/api.js';
import { useApi } from '../lib/hooks.js';
import { ariary, nombre, dateLongue, dateCourte, versInputDate, aujourdhuiISO, SUIVANT_LIVRAISON } from '../lib/format.js';
import { Page } from '../components/layout/Page.jsx';
import { Carte, Indicateur } from '../components/ui/Carte.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Chargement, Encart, EtatVide } from '../components/ui/Divers.jsx';

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

function Tache({ tache, faite, onCocher }) {
  const cochable = tache.type !== 'stock';
  return (
    <div className={`tache ${faite ? 'tache--faite' : ''}`}>
      <input
        type="checkbox"
        className="tache__case"
        checked={faite}
        disabled={!cochable || faite}
        onChange={() => onCocher(tache)}
        aria-label={cochable ? `Marquer comme faite : ${tache.libelle}` : tache.libelle}
        title={cochable ? undefined : 'À traiter depuis la fiche produit'}
      />
      <div className="tache__corps">
        <div className="tache__libelle">
          <Link to={tache.lien}>{tache.libelle}</Link>
        </div>
        <div className="tache__meta">
          <Badge>{tache.module}</Badge>
          {tache.detail && <span>{tache.detail}</span>}
          {tache.echeance && (
            <span className={tache.enRetard ? 'gras' : ''} style={tache.enRetard ? { color: 'var(--danger)' } : undefined}>
              {tache.enRetard ? 'En retard · ' : 'Échéance : '}
              {dateCourte(tache.echeance)}
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
  const idsTaches = new Set(taches.map((t) => t.id));
  const aSurveiller = (donnees?.notifications ?? []).filter((n) => !idsTaches.has(n.id));

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
              <Indicateur libelle="Tâches du jour" valeur={nombre(taches.length)} sous={taches.filter((t) => t.enRetard).length ? `${taches.filter((t) => t.enRetard).length} en retard` : 'À jour'} />
            </div>

            <div className="grille grille-2" style={{ alignItems: 'start' }}>
              <Carte titre="Tâches du jour" nu>
                {taches.length === 0 ? (
                  <EtatVide icone={CheckCircle2} titre="Rien à faire aujourd'hui" description="Les publications, réceptions et ruptures apparaîtront ici." />
                ) : (
                  taches.map((t) => <Tache key={t.id} tache={t} faite={faites.has(t.id)} onCocher={cocher} />)
                )}
              </Carte>

              <Carte titre="À surveiller" nu>
                {aSurveiller.length === 0 ? (
                  <EtatVide icone={Bell} titre="Rien à signaler" />
                ) : (
                  <div className="liste-elements">
                    {aSurveiller.map((n) => (
                      <Link key={n.id} to={n.lien} className="element" style={{ color: 'inherit' }}>
                        <span className={`notification__point notification__point--${n.niveau}`} style={{ marginTop: 0 }} aria-hidden="true" />
                        <span className="element__corps">
                          <span className="element__titre">{n.libelle}</span>
                          <span className="element__meta" style={{ display: 'block' }}>
                            {[n.module, n.detail].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Carte>
            </div>
          </>
        )
      )}
    </Page>
  );
}
