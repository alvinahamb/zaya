import { Link } from 'react-router-dom';
import { Plus, Target, ArrowRight } from 'lucide-react';
import { versInputDate, aujourdhuiISO, pluriel } from '../lib/format.js';
import { Carte } from '../components/ui/Carte.jsx';
import { BoutonLien } from '../components/ui/Bouton.jsx';
import { EtatVide } from '../components/ui/Divers.jsx';

const formatJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const formatValeur = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

const jourCourt = (iso) => formatJour.format(new Date(`${versInputDate(iso)}T00:00:00`));
const joursAvant = (iso) => Math.round((new Date(versInputDate(iso)) - new Date(aujourdhuiISO())) / 86_400_000);

function echeance(o) {
  const debut = joursAvant(o.startDate);
  if (debut > 0) return { texte: `Commence dans ${pluriel(debut, 'jour')}`, ton: 'neutre' };
  const fin = joursAvant(o.endDate);
  if (fin === 0) return { texte: "Se termine aujourd'hui", ton: 'urgent' };
  if (fin === 1) return { texte: 'Se termine demain', ton: 'urgent' };
  return { texte: `Encore ${pluriel(fin, 'jour')}`, ton: fin <= 7 ? 'proche' : 'neutre' };
}

/** Anneau de progression : l'arc rouge couvre la part atteinte de la cible. */
function Anneau({ pct }) {
  const rayon = 26;
  const perimetre = 2 * Math.PI * rayon;
  return (
    <span className="recap-objectif__anneau">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={rayon} className="recap-objectif__piste" />
        <circle
          cx="32"
          cy="32"
          r={rayon}
          className="recap-objectif__arc"
          strokeDasharray={perimetre}
          strokeDashoffset={perimetre * (1 - pct / 100)}
        />
      </svg>
      <span className="recap-objectif__pct">{Math.round(pct)}%</span>
    </span>
  );
}

/** Les 3 objectifs en cours dont l'échéance est la plus proche, en tuiles. */
export function RecapObjectifs({ objectifs }) {
  return (
    <Carte
      titre="Objectifs à venir"
      className="accueil__objectifs"
      actions={<BoutonLien variante="discret" taille="petit" to="/objectifs">Tout voir</BoutonLien>}
    >
      {objectifs.length === 0 ? (
        <EtatVide
          icone={Target}
          titre="Aucun objectif en cours"
          action={<BoutonLien variante="principal" taille="petit" icone={Plus} to="/objectifs?nouveau=1">Nouvel objectif</BoutonLien>}
        />
      ) : (
        <div className="recap-objectifs">
          {objectifs.map((o) => {
            const cible = Number(o.targetValue) || 0;
            const actuel = Number(o.currentValue) || 0;
            const pct = cible > 0 ? Math.min(100, (actuel / cible) * 100) : 0;
            const e = echeance(o);
            return (
              <Link key={o.id} to={`/objectifs?mois=${versInputDate(o.endDate).slice(0, 7)}`} className="recap-objectif">
                <Anneau pct={pct} />
                <span className="recap-objectif__corps">
                  <span className="recap-objectif__titre">{o.title}</span>
                  <span className="recap-objectif__valeur">
                    {formatValeur.format(actuel)} / {formatValeur.format(cible)}
                    {o.unit ? ` ${o.unit}` : ''}
                  </span>
                  <span className="recap-objectif__dates">
                    {jourCourt(o.startDate)}
                    <ArrowRight size={12} aria-hidden="true" />
                    {jourCourt(o.endDate)}
                  </span>
                  <span className={`recap-objectif__echeance recap-objectif__echeance--${e.ton}`}>{e.texte}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Carte>
  );
}
