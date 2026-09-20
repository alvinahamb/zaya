import { Circle, PenLine, CheckCircle2 } from 'lucide-react';
import { Carte } from '../../components/ui/Carte.jsx';
import { heure, aujourdhuiISO } from '../../lib/format.js';
import { JOURS_COURTS, cleJour, joursDuMois, regrouperParJour } from '../../lib/calendrier.js';

const ICONES_STATUT = { a_faire: Circle, creee: PenLine, publiee: CheckCircle2 };

function PubMini({ publication, onOuvrir }) {
  const Icone = ICONES_STATUT[publication.statut] ?? Circle;
  return (
    <button
      type="button"
      className={`pub-mini pub-mini--${publication.statut}`}
      onClick={(e) => {
        e.stopPropagation();
        onOuvrir(publication);
      }}
      title={publication.nom}
    >
      <Icone aria-hidden="true" />
      {heure(publication.dateHeurePublication)} {publication.nom}
    </button>
  );
}

export function CalendrierMois({ annee, mois, publications, onJour, onOuvrir }) {
  const parJour = regrouperParJour(publications);
  const ceJour = aujourdhuiISO();
  const MAX = 3;
  return (
    <div className="calendrier__grille" role="grid">
      {JOURS_COURTS.map((j) => (
        <div key={j} className="calendrier__jour-nom" role="columnheader">{j}</div>
      ))}
      {joursDuMois(annee, mois).map((d) => {
        const cle = cleJour(d);
        const liste = parJour.get(cle) ?? [];
        const autre = d.getMonth() !== mois;
        return (
          <div
            key={cle}
            role="gridcell"
            className={`calendrier__jour ${autre ? 'calendrier__jour--autre' : ''} ${cle === ceJour ? 'calendrier__jour--aujourdhui' : ''}`}
            onClick={() => onJour(cle)}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onJour(cle)}
            aria-label={`${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })}, ${liste.length} publication${liste.length > 1 ? 's' : ''}`}
          >
            <span className="calendrier__numero">{d.getDate()}</span>
            <div className="calendrier__publications">
              {liste.slice(0, MAX).map((p) => <PubMini key={p.id} publication={p} onOuvrir={onOuvrir} />)}
              {liste.length > MAX && <span className="calendrier__plus">+{liste.length - MAX}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CalendrierSemaine({ depart, publications, onJour, onOuvrir }) {
  const parJour = regrouperParJour(publications);
  const ceJour = aujourdhuiISO();
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(depart);
    d.setDate(depart.getDate() + i);
    return d;
  });
  return (
    <div className="semaine">
      {jours.map((d) => {
        const cle = cleJour(d);
        const liste = parJour.get(cle) ?? [];
        return (
          <Carte key={cle} nu className="semaine__jour">
            <div className={`semaine__entete ${cle === ceJour ? 'semaine__entete--aujourdhui' : ''}`}>
              <span>{JOURS_COURTS[(d.getDay() + 6) % 7]} {d.getDate()}</span>
              <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => onJour(cle)} aria-label={`Ajouter une publication le ${cle}`}>+</button>
            </div>
            <div className="semaine__corps">
              {liste.length === 0 && <span className="tres-petit discret">—</span>}
              {liste.map((p) => {
                const Icone = ICONES_STATUT[p.statut] ?? Circle;
                return (
                  <button key={p.id} type="button" className="pub-carte" onClick={() => onOuvrir(p)}>
                    <span className={`pub-mini pub-mini--${p.statut}`} style={{ width: 'auto', alignSelf: 'flex-start' }}>
                      <Icone aria-hidden="true" />
                      {heure(p.dateHeurePublication)}
                    </span>
                    <span className="pub-carte__nom">{p.nom}</span>
                    {p.Reseau && <span className="pub-carte__heure">{p.Reseau.nom}</span>}
                  </button>
                );
              })}
            </div>
          </Carte>
        );
      })}
    </div>
  );
}
