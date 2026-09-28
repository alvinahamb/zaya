import { Link } from 'react-router-dom';

function classes({ variante, taille, bloc, icone, enfants, compact, className }) {
  return [
    'bouton',
    `bouton--${variante}`,
    taille === 'petit' && 'bouton--petit',
    bloc && 'bouton--bloc',
    icone && !enfants && 'bouton--icone',
    compact && 'bouton--compact',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * variante : principal | secondaire | discret | danger
 * icone    : composant Lucide, affiché seul si aucun enfant (bouton carré)
 * compact  : sur mobile, seule l'icône reste visible (le libellé reste lu par les lecteurs d'écran)
 */
export function Bouton({
  variante = 'secondaire',
  taille,
  bloc,
  icone: Icone,
  compact,
  chargement = false,
  type = 'button',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={classes({ variante, taille, bloc, icone: Icone, enfants: children, compact, className })}
      title={compact && typeof children === 'string' ? children : undefined}
      disabled={chargement || props.disabled}
      aria-busy={chargement || undefined}
      {...props}
    >
      {chargement ? <span className="chargement__rond" style={{ width: 16, height: 16, borderWidth: 2 }} /> : Icone && <Icone size={18} aria-hidden="true" />}
      {compact ? <span className="bouton__libelle">{children}</span> : children}
    </button>
  );
}

export function BoutonLien({ variante = 'secondaire', taille, bloc, icone: Icone, compact, className, children, ...props }) {
  return (
    <Link
      className={classes({ variante, taille, bloc, icone: Icone, enfants: children, compact, className })}
      title={compact && typeof children === 'string' ? children : undefined}
      {...props}
    >
      {Icone && <Icone size={18} aria-hidden="true" />}
      {compact ? <span className="bouton__libelle">{children}</span> : children}
    </Link>
  );
}
