import { useId } from 'react';

/** Enveloppe libellé + contrôle + aide/erreur. Passe l'id généré à l'enfant via une fonction. */
export function Champ({ libelle, aide, erreur, requis, className = '', children }) {
  const id = useId();
  return (
    <div className={`champ ${className}`}>
      {libelle && (
        <label className="champ__libelle" htmlFor={id}>
          {libelle}
          {requis && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {erreur ? <span className="champ__erreur">{erreur}</span> : aide && <span className="champ__aide">{aide}</span>}
    </div>
  );
}

export function Saisie({ erreur, className = '', ...props }) {
  return <input className={`saisie ${erreur ? 'saisie--erreur' : ''} ${className}`} {...props} />;
}

/** Saisie numérique avec unité affichée à droite (€, Ar, %). */
export function SaisieMontant({ suffixe, className = '', ...props }) {
  return (
    <div className={`saisie--suffixe ${className}`}>
      <Saisie type="number" inputMode="decimal" step="any" min="0" {...props} />
      <span aria-hidden="true">{suffixe}</span>
    </div>
  );
}

export function Selection({ options = [], placeholder, className = '', children, ...props }) {
  return (
    <select className={`selection ${className}`} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
      {children}
    </select>
  );
}

export function ZoneTexte({ className = '', ...props }) {
  return <textarea className={`zone-texte ${className}`} {...props} />;
}

export function Case({ libelle, ...props }) {
  return (
    <label className="case">
      <input type="checkbox" {...props} />
      <span>{libelle}</span>
    </label>
  );
}
