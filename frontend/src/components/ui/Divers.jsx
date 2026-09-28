import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Package, AlertCircle, Info, AlertTriangle, CheckCircle2, FileDown, FileUp } from 'lucide-react';
import { useFermerDehors } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { urlFichier } from '../../services/api.js';
import { Bouton } from './Bouton.jsx';
import { versCsv, lireCsv, enregistrements } from '../../lib/csv.js';

export function Onglets({ onglets, actif, onChange }) {
  return (
    <div className="onglets" role="tablist">
      {onglets.map((o) => (
        <button
          key={o.cle}
          type="button"
          role="tab"
          className="onglet"
          aria-selected={actif === o.cle}
          onClick={() => onChange(o.cle)}
        >
          {o.libelle}
          {o.compteur !== undefined && o.compteur !== null && <span className="onglet__compteur">{o.compteur}</span>}
        </button>
      ))}
    </div>
  );
}

/** compact : sur mobile, seules les icônes des options restent visibles. */
export function Segment({ options, valeur, onChange, libelle, compact = false }) {
  return (
    <div className={`segment ${compact ? 'segment--compact' : ''}`} role="group" aria-label={libelle}>
      {options.map((o) => (
        <button key={o.valeur} type="button" aria-pressed={valeur === o.valeur} onClick={() => onChange(o.valeur)} title={compact ? o.libelle : undefined}>
          {o.icone && <o.icone size={16} aria-hidden="true" />}
          <span className="segment__libelle">{o.libelle}</span>
        </button>
      ))}
    </div>
  );
}

export function EtatVide({ icone: Icone = Inbox, titre, description, action }) {
  return (
    <div className="etat-vide">
      <Icone size={40} strokeWidth={1.5} aria-hidden="true" />
      {titre && <h3>{titre}</h3>}
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Chargement({ texte = 'Chargement…' }) {
  return (
    <div className="chargement" role="status">
      <span className="chargement__rond" />
      <span>{texte}</span>
    </div>
  );
}

const ICONES_ENCART = { erreur: AlertCircle, info: Info, attention: AlertTriangle, succes: CheckCircle2 };

export function Encart({ ton = 'info', children }) {
  const Icone = ICONES_ENCART[ton];
  return (
    <div className={`encart encart--${ton}`} role={ton === 'erreur' ? 'alert' : undefined}>
      <Icone size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function ImageProduit({ src, alt = '', taille = 'mini' }) {
  const dimensions = { mini: 20, moyenne: 28, grande: 48 };
  return (
    <div className={`img-produit img-produit--${taille}`}>
      {src ? <img src={urlFichier(src)} alt={alt} loading="lazy" /> : <Package size={dimensions[taille]} strokeWidth={1.5} aria-hidden="true" />}
    </div>
  );
}

/** Menu déroulant ancré à un bouton. `bouton` reçoit ({ ouvert, basculer }). */
export function MenuDeroulant({ bouton, children, className = '' }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  const fermer = useCallback(() => setOuvert(false), []);
  useFermerDehors(ref, ouvert, fermer);
  return (
    <div className={`menu-deroulant ${className}`} ref={ref}>
      {bouton({ ouvert, basculer: () => setOuvert((o) => !o) })}
      {ouvert && (
        <div className="menu-deroulant__panneau" onClick={fermer}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ElementMenu({ icone: Icone, to, onClick, children, style }) {
  const contenu = (
    <>
      {Icone && <Icone size={18} aria-hidden="true" />}
      <span>{children}</span>
    </>
  );
  if (to) {
    return (
      <Link className="menu-deroulant__element" to={to} style={style}>
        {contenu}
      </Link>
    );
  }
  return (
    <button type="button" className="menu-deroulant__element" onClick={onClick} style={style}>
      {contenu}
    </button>
  );
}

/**
 * Export / import CSV d'une liste : deux icônes discrètes.
 * `importer(enregistrement)` crée un élément à partir d'une ligne ({ cle: texte }) ;
 * sans `importer`, seule l'icône d'export s'affiche.
 * `regrouper(enregistrements)` : réunit plusieurs lignes du fichier en un seul
 * élément (ex. une commande et ses articles) ; `importer` reçoit alors le groupe.
 */
export function BoutonsCsv({ nomFichier, colonnes, lignes, importer, regrouper, onImporte }) {
  const { notifier } = useToast();
  const champ = useRef(null);
  const [enCours, setEnCours] = useState(false);

  const exporter = () => {
    const url = URL.createObjectURL(new Blob([versCsv(colonnes, lignes ?? [])], { type: 'text/csv;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `${nomFichier}.csv`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const lancerImport = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    setEnCours(true);
    try {
      // Numéro de ligne dans le fichier (en-tête = ligne 1), pour les messages d'erreur
      const lus = enregistrements(colonnes, lireCsv(await fichier.text())).map((r, i) => ({ ...r, __ligne: i + 2 }));
      const liste = regrouper ? regrouper(lus) : lus;
      if (liste.length === 0) {
        notifier('Aucune ligne à importer', 'erreur');
        return;
      }
      let reussis = 0;
      const erreurs = [];
      // Séquentiel : garde l'ordre du fichier et évite de saturer l'API
      for (const element of liste) {
        try {
          await importer(element);
          reussis++;
        } catch (err) {
          const ligne = (Array.isArray(element) ? element[0] : element).__ligne;
          erreurs.push(`ligne ${ligne} : ${err?.response?.data?.message ?? err?.message ?? 'erreur'}`);
        }
      }
      if (reussis) onImporte?.();
      const quoi = regrouper ? 'élément' : 'ligne';
      if (erreurs.length === 0) notifier(`${reussis} ${quoi}${reussis > 1 ? 's' : ''} importé${quoi === 'ligne' ? 'e' : ''}${reussis > 1 ? 's' : ''}`);
      else notifier(`${reussis} importée${reussis > 1 ? 's' : ''}, ${erreurs.length} en erreur (${erreurs[0]}${erreurs.length > 1 ? '…' : ''})`, 'erreur');
    } catch {
      notifier('Fichier CSV illisible', 'erreur');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <span className="boutons-csv">
      <Bouton variante="discret" taille="petit" icone={FileDown} onClick={exporter} disabled={!lignes?.length} title="Exporter en CSV" aria-label="Exporter en CSV" />
      {importer && (
        <>
          <Bouton variante="discret" taille="petit" icone={FileUp} onClick={() => champ.current?.click()} chargement={enCours} title="Importer un CSV" aria-label="Importer un CSV" />
          <input ref={champ} type="file" accept=".csv,text/csv" hidden onChange={lancerImport} />
        </>
      )}
    </span>
  );
}
