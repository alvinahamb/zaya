import { Link } from 'react-router-dom';

function classes({ variante, taille, bloc, icone, enfants, className }) {
  return [
    'bouton',
    `bouton--${variante}`,
    taille === 'petit' && 'bouton--petit',
    bloc && 'bouton--bloc',
    icone && !enfants && 'bouton--icone',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * variante : principal | secondaire | discret | danger
 * icone    : composant Lucide, affiché seul si aucun enfant (bouton carré)
 */
export function Bouton({
  variante = 'secondaire',
  taille,
  bloc,
  icone: Icone,
  chargement = false,
  type = 'button',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={classes({ variante, taille, bloc, icone: Icone, enfants: children, className })}
      disabled={chargement || props.disabled}
      aria-busy={chargement || undefined}
      {...props}
    >
      {chargement ? <span className="chargement__rond" style={{ width: 16, height: 16, borderWidth: 2 }} /> : Icone && <Icone size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function BoutonLien({ variante = 'secondaire', taille, bloc, icone: Icone, className, children, ...props }) {
  return (
    <Link className={classes({ variante, taille, bloc, icone: Icone, enfants: children, className })} {...props}>
      {Icone && <Icone size={18} aria-hidden="true" />}
      {children}
    </Link>
  );
}
