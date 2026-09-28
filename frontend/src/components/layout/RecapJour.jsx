import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { Modale } from '../ui/Modale.jsx';
import { Bouton } from '../ui/Bouton.jsx';
import { aujourdhuiISO, dateCourte, pluriel, LIBELLES_QUAND } from '../../lib/format.js';

const CLE_VU = 'zaya.recap.vu';

function dejaVu() {
  try {
    return localStorage.getItem(CLE_VU) === aujourdhuiISO();
  } catch {
    return false;
  }
}

function marquerVu() {
  try {
    localStorage.setItem(CLE_VU, aujourdhuiISO());
  } catch {
    /* stockage indisponible : le récap réapparaîtra au prochain chargement */
  }
}

/**
 * Récapitulatif des tâches du jour (et en retard), affiché une fois par jour
 * à la première ouverture de l'app où il y a quelque chose à faire.
 */
export function RecapJour({ notifications, permission, onActiverRappels }) {
  const taches = notifications.filter((n) => n.quand === 'retard' || n.quand === 'jour');
  const [vu, setVu] = useState(dejaVu);
  const ouvert = taches.length > 0 && !vu;

  const fermer = () => {
    marquerVu();
    setVu(true);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={`Aujourd'hui · ${pluriel(taches.length, 'tâche')}`}
      onFermer={fermer}
      pied={
        <>
          {permission === 'default' && (
            <Bouton icone={BellRing} onClick={onActiverRappels}>Activer les notifications</Bouton>
          )}
          <Bouton variante="principal" onClick={fermer}>C'est noté</Bouton>
        </>
      }
    >
      <div className="notifications" style={{ margin: '-8px -4px' }}>
        {taches.map((n) => (
          <Link key={n.id} className="notification" to={n.lien} onClick={fermer}>
            <span className={`notification__point notification__point--${n.niveau}`} aria-hidden="true" />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block' }}>{n.libelle}</span>
              <span className="tres-petit secondaire" style={{ display: 'block' }}>
                {[LIBELLES_QUAND[n.quand], n.module, n.detail, n.echeance && !n.detail ? dateCourte(n.echeance) : null].filter(Boolean).join(' · ')}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Modale>
  );
}
