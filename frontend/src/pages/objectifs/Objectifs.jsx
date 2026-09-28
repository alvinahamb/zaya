import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Target, CheckCircle2, RotateCcw, Ban, CalendarDays } from 'lucide-react';
import { Objectifs as ApiObjectifs, messageErreur } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { dateCourte, aujourdhuiISO, versInputDate, pourcentage, pluriel, CATEGORIES_OBJECTIF, LIBELLES_STATUT_OBJECTIF } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte, Indicateur } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { Saisie } from '../../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide } from '../../components/ui/Divers.jsx';
import { FormulaireObjectif } from './FormulaireObjectif.jsx';

const formatValeur = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const formatMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

const TON_STATUT = { en_cours: 'info', atteint: 'succes', abandonne: 'neutre' };
const ICONE_STATUT = { en_cours: Target, atteint: CheckCircle2, abandonne: Ban };

const libelleMois = (mois) => {
  const [a, m] = mois.split('-').map(Number);
  const texte = formatMois.format(new Date(a, m - 1, 1));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

/** Écart en jours entre aujourd'hui et une date ISO (négatif si passée). */
const joursAvant = (iso) => Math.round((new Date(versInputDate(iso)) - new Date(aujourdhuiISO())) / 86_400_000);

const progression = (o) => {
  const cible = Number(o.targetValue) || 0;
  const actuel = Number(o.currentValue) || 0;
  return cible > 0 ? Math.min(100, (actuel / cible) * 100) : 0;
};

function Echeance({ objectif }) {
  if (objectif.status === 'atteint') {
    return <span style={{ color: 'var(--succes)' }}>Atteint le {dateCourte(objectif.completedAt)}</span>;
  }
  if (objectif.status === 'abandonne') return <span>Abandonné</span>;
  const jours = joursAvant(objectif.endDate);
  if (jours < 0) return <span className="gras" style={{ color: 'var(--danger)' }}>Échéance dépassée depuis {pluriel(-jours, 'jour')}</span>;
  if (jours === 0) return <span className="gras" style={{ color: 'var(--attention)' }}>Se termine aujourd'hui</span>;
  if (jours === 1) return <span className="gras" style={{ color: 'var(--attention)' }}>Se termine demain</span>;
  return <span>Encore {pluriel(jours, 'jour')}</span>;
}

/** Barre de progression et saisie rapide de la valeur actuelle (Entrée pour enregistrer). */
function Progression({ objectif, onProgresser }) {
  const [saisie, setSaisie] = useState(null); // texte tapé, null = valeur du serveur
  const [envoi, setEnvoi] = useState(false);
  const pct = progression(objectif);
  const valeur = saisie ?? String(Number(objectif.currentValue) || 0);
  const modifiable = objectif.status !== 'abandonne';

  const valider = async () => {
    if (saisie === null || saisie === '' || Number(saisie) === Number(objectif.currentValue)) {
      setSaisie(null);
      return;
    }
    setEnvoi(true);
    try {
      await onProgresser(objectif, { currentValue: Number(saisie) });
      setSaisie(null);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="objectif__progression">
      <div
        className={`objectif__barre ${objectif.status === 'atteint' ? 'objectif__barre--atteint' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`Progression de ${objectif.title}`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="objectif__valeurs">
        <div className="flex" style={{ gap: 6, alignItems: 'center' }}>
          <Saisie
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={valeur}
            disabled={!modifiable || envoi}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              valider();
            }}
            onBlur={valider}
            aria-label={`Valeur actuelle de ${objectif.title} (Entrée pour enregistrer)`}
            style={{ width: 110, textAlign: 'right' }}
          />
          <span className="secondaire">/ {formatValeur.format(Number(objectif.targetValue) || 0)}{objectif.unit ? ` ${objectif.unit}` : ''}</span>
        </div>
        <span className={`gras tabulaire ${pct >= 100 ? '' : 'secondaire'}`} style={pct >= 100 ? { color: 'var(--succes)' } : undefined}>
          {pourcentage(pct, { signe: false })}
        </span>
      </div>
      {modifiable && (
        <div className="flex" style={{ gap: 6 }}>
          <Bouton taille="petit" onClick={() => onProgresser(objectif, { delta: 1 })} disabled={envoi} aria-label="Ajouter 1">+1</Bouton>
          <Bouton taille="petit" onClick={() => onProgresser(objectif, { delta: -1 })} disabled={envoi || Number(objectif.currentValue) <= 0} aria-label="Retirer 1">−1</Bouton>
        </div>
      )}
    </div>
  );
}

function CarteObjectif({ objectif, onModifier, onSupprimer, onStatut, onProgresser }) {
  const Icone = ICONE_STATUT[objectif.status] ?? Target;
  return (
    <Carte className={`objectif objectif--${objectif.status}`}>
      <div className="objectif__entete">
        <div style={{ minWidth: 0 }}>
          <h3 className="objectif__titre">{objectif.title}</h3>
          <div className="objectif__meta">
            <Badge ton={TON_STATUT[objectif.status]} icone={Icone}>{LIBELLES_STATUT_OBJECTIF[objectif.status] ?? objectif.status}</Badge>
            {objectif.category && <Badge>{CATEGORIES_OBJECTIF[objectif.category] ?? objectif.category}</Badge>}
          </div>
        </div>
        <div className="flex" style={{ gap: 4, flexShrink: 0 }}>
          <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => onModifier(objectif)} aria-label={`Modifier ${objectif.title}`} title="Modifier" />
          <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => onSupprimer(objectif)} aria-label={`Supprimer ${objectif.title}`} title="Supprimer" />
        </div>
      </div>

      {objectif.description && <p className="petit secondaire objectif__description">{objectif.description}</p>}

      <Progression objectif={objectif} onProgresser={onProgresser} />

      <div className="objectif__pied">
        <span className="tres-petit secondaire">
          <CalendarDays size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Du {dateCourte(objectif.startDate)} au {dateCourte(objectif.endDate)}
        </span>
        <span className="tres-petit"><Echeance objectif={objectif} /></span>
      </div>

      <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
        {objectif.status !== 'atteint' && (
          <Bouton taille="petit" icone={CheckCircle2} onClick={() => onStatut(objectif, 'atteint')}>Marquer atteint</Bouton>
        )}
        {objectif.status !== 'en_cours' && (
          <Bouton taille="petit" icone={RotateCcw} onClick={() => onStatut(objectif, 'en_cours')}>Reprendre</Bouton>
        )}
        {objectif.status === 'en_cours' && (
          <Bouton taille="petit" variante="discret" icone={Ban} onClick={() => onStatut(objectif, 'abandonne')}>Abandonner</Bouton>
        )}
      </div>
    </Carte>
  );
}

/** Objectifs du mois de l'utilisateur connecté : progression, échéances et rappels. */
export function Objectifs() {
  const { notifier } = useToast();
  const [params, setParams] = useSearchParams();
  const moisCourant = aujourdhuiISO().slice(0, 7);
  const mois = /^\d{4}-\d{2}$/.test(params.get('mois') ?? '') ? params.get('mois') : moisCourant;

  const charger = useCallback(() => ApiObjectifs.lister({ mois }), [mois]);
  const { donnees, chargement, erreur, recharger, setDonnees } = useApi(charger);
  const [formulaire, setFormulaire] = useState(null); // null | { objectif? }
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const nouveauDemande = params.get('nouveau') === '1';
  const ouvert = nouveauDemande || formulaire !== null;
  const fermerFormulaire = () => {
    setFormulaire(null);
    if (nouveauDemande) {
      params.delete('nouveau');
      setParams(params, { replace: true });
    }
  };
  const changerMois = (valeur) => {
    if (!valeur) return;
    params.set('mois', valeur);
    setParams(params, { replace: true });
  };

  const objectifs = useMemo(() => donnees ?? [], [donnees]);
  const resume = useMemo(() => {
    const enCours = objectifs.filter((o) => o.status === 'en_cours');
    const atteints = objectifs.filter((o) => o.status === 'atteint');
    const moyenne = enCours.length ? enCours.reduce((s, o) => s + progression(o), 0) / enCours.length : null;
    const proches = enCours.filter((o) => {
      const j = joursAvant(o.endDate);
      return j >= 0 && j <= 7;
    }).length;
    return { enCours: enCours.length, atteints: atteints.length, moyenne, proches };
  }, [objectifs]);

  const remplacer = (maj) => setDonnees((liste) => (liste ?? []).map((o) => (o.id === maj.id ? maj : o)));

  const progresser = async (objectif, corps) => {
    try {
      const maj = await ApiObjectifs.progresser(objectif.id, corps);
      remplacer(maj);
      if (maj.status === 'atteint' && objectif.status !== 'atteint') notifier(`Objectif « ${maj.title} » atteint !`);
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    }
  };

  const changerStatut = async (objectif, status) => {
    try {
      remplacer(await ApiObjectifs.changerStatut(objectif.id, status));
      notifier(status === 'atteint' ? 'Objectif marqué atteint' : status === 'abandonne' ? 'Objectif abandonné' : 'Objectif repris');
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    }
  };

  const supprimer = async () => {
    setSuppression(true);
    try {
      await ApiObjectifs.supprimer(aSupprimer.id);
      notifier('Objectif supprimé');
      setASupprimer(null);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setSuppression(false);
    }
  };

  const selecteurMois = (
    <Saisie type="month" value={mois} onChange={(e) => changerMois(e.target.value)} aria-label="Mois affiché" style={{ width: 170 }} />
  );

  return (
    <Page
      titre="Objectifs du mois"
      sousTitre={`${libelleMois(mois)} · ${pluriel(objectifs.length, 'objectif')}`}
      actions={
        <>
          {selecteurMois}
          <Bouton variante="principal" icone={Plus} onClick={() => setFormulaire({})}>Nouvel objectif</Bouton>
        </>
      }
    >
      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      {chargement && !donnees ? (
        <Chargement />
      ) : (
        <>
          <div className="indicateurs espace-bas">
            <Indicateur libelle="En cours" valeur={resume.enCours} sous={resume.proches ? `${pluriel(resume.proches, 'échéance')} sous 7 jours` : 'Aucune échéance proche'} />
            <Indicateur libelle="Atteints" valeur={resume.atteints} couleur={resume.atteints ? 'var(--succes)' : undefined} sous={`Sur ${pluriel(objectifs.length, 'objectif')}`} />
            <Indicateur libelle="Progression moyenne" valeur={resume.moyenne === null ? '—' : pourcentage(resume.moyenne, { signe: false })} sous="Des objectifs en cours" />
          </div>

          {objectifs.length === 0 ? (
            <Carte>
              <EtatVide
                icone={Target}
                titre={`Aucun objectif pour ${libelleMois(mois).toLowerCase()}`}
                description="Fixez un objectif chiffré (ventes, chiffre d'affaires, publications…) et suivez sa progression. Un rappel apparaît la veille de l'échéance."
                action={<Bouton variante="principal" icone={Plus} onClick={() => setFormulaire({})}>Nouvel objectif</Bouton>}
              />
            </Carte>
          ) : (
            <div className="grille grille-2" style={{ alignItems: 'start' }}>
              {objectifs.map((o) => (
                <CarteObjectif
                  key={o.id}
                  objectif={o}
                  onModifier={(objectif) => setFormulaire({ objectif })}
                  onSupprimer={setASupprimer}
                  onStatut={changerStatut}
                  onProgresser={progresser}
                />
              ))}
            </div>
          )}
        </>
      )}

      <FormulaireObjectif
        ouvert={ouvert}
        objectif={formulaire?.objectif ?? null}
        mois={mois}
        onFermer={fermerFormulaire}
        onEnregistre={(o) => {
          const modification = Boolean(formulaire?.objectif);
          fermerFormulaire();
          notifier(modification ? 'Objectif modifié' : 'Objectif créé');
          if (modification) remplacer(o);
          else recharger();
        }}
      />

      <Confirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer cet objectif ?"
        message={aSupprimer ? `« ${aSupprimer.title} » sera supprimé définitivement.` : ''}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppression}
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </Page>
  );
}
