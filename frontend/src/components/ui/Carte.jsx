export function Carte({ titre, actions, nu = false, className = '', children, ...props }) {
  return (
    <div className={`carte ${className}`} {...props}>
      {(titre || actions) && (
        <div className="carte__entete">
          {titre && <h3>{titre}</h3>}
          {actions && <div className="flex">{actions}</div>}
        </div>
      )}
      <div className={`carte__corps ${nu ? 'carte__corps--nu' : ''}`}>{children}</div>
    </div>
  );
}

/** Tuile d'indicateur : libellé, valeur mise en avant, précision optionnelle. */
export function Indicateur({ libelle, valeur, sous, couleur }) {
  return (
    <div className="carte indicateur">
      <span className="indicateur__libelle">{libelle}</span>
      <span className="indicateur__valeur" style={couleur ? { color: couleur } : undefined}>
        {valeur}
      </span>
      {sous && <span className="indicateur__sous">{sous}</span>}
    </div>
  );
}
