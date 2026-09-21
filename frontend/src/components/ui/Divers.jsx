import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Package, AlertCircle, Info, AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { useFermerDehors } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Bouton } from './Bouton.jsx';

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

export function Segment({ options, valeur, onChange, libelle }) {
  return (
    <div className="segment" role="group" aria-label={libelle}>
      {options.map((o) => (
        <button key={o.valeur} type="button" aria-pressed={valeur === o.valeur} onClick={() => onChange(o.valeur)}>
          {o.icone && <o.icone size={16} aria-hidden="true" />}
          {o.libelle}
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
      {src ? <img src={src} alt={alt} loading="lazy" /> : <Package size={dimensions[taille]} strokeWidth={1.5} aria-hidden="true" />}
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

/** Exports Excel et PDF d'une liste, regroupés dans un seul menu. */
export function BoutonsExport({ nomFichier, titre, sousTitre, colonnes, lignes }) {
  const { notifier } = useToast();
  const [enCours, setEnCours] = useState(false);
  const vide = !lignes || lignes.length === 0;

  const lancer = async (format) => {
    setEnCours(true);
    try {
      // exceljs et jspdf pèsent lourd : chargés seulement au premier export
      const { exporterExcel, exporterPdf } = await import('../../lib/export.js');
      if (format === 'excel') await exporterExcel({ nomFichier, titre, colonnes, lignes });
      else exporterPdf({ nomFichier, titre, sousTitre, colonnes, lignes });
    } catch {
      notifier("L'export a échoué", 'erreur');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <MenuDeroulant
      bouton={({ basculer, ouvert }) => (
        <Bouton taille="petit" icone={Download} onClick={basculer} disabled={vide} chargement={enCours} aria-expanded={ouvert}>
          Exporter
        </Bouton>
      )}
    >
      <ElementMenu icone={FileSpreadsheet} onClick={() => lancer('excel')}>Excel (.xlsx)</ElementMenu>
      <ElementMenu icone={FileText} onClick={() => lancer('pdf')}>PDF</ElementMenu>
    </MenuDeroulant>
  );
}
