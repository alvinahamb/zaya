import { Truck, PackageCheck, AlertTriangle, Circle, PenLine, CheckCircle2, Lock, FileEdit, Trash2, PhoneCall, Ban } from 'lucide-react';
import { LIBELLES_STATUT_ACHAT, LIBELLES_STATUT_PUBLICATION, LIBELLES_STATUT_LIVRAISON, nombre } from '../../lib/format.js';

/** ton : neutre | succes | attention | danger | info | principal */
export function Badge({ ton = 'neutre', icone: Icone, children, className = '' }) {
  return (
    <span className={`badge ${ton !== 'neutre' ? `badge--${ton}` : ''} ${className}`}>
      {Icone && <Icone aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUTS_ACHAT = {
  en_route: { ton: 'info', icone: Truck },
  recue: { ton: 'succes', icone: PackageCheck },
  en_retard: { ton: 'danger', icone: AlertTriangle },
};

export function BadgeStatutAchat({ statut }) {
  const s = STATUTS_ACHAT[statut] ?? {};
  return (
    <Badge ton={s.ton} icone={s.icone}>
      {LIBELLES_STATUT_ACHAT[statut] ?? statut}
    </Badge>
  );
}

const STATUTS_PUBLICATION = {
  a_faire: { ton: 'attention', icone: Circle },
  creee: { ton: 'info', icone: PenLine },
  publiee: { ton: 'succes', icone: CheckCircle2 },
  supprimee: { ton: 'neutre', icone: Trash2 },
};

export function BadgeStatutPublication({ statut }) {
  const s = STATUTS_PUBLICATION[statut] ?? {};
  return (
    <Badge ton={s.ton} icone={s.icone}>
      {LIBELLES_STATUT_PUBLICATION[statut] ?? statut}
    </Badge>
  );
}

/** Quantité en stock, sans alerte (ni rupture ni stock bas). */
export function BadgeStock({ restant }) {
  if (restant === null || restant === undefined) return <Badge>—</Badge>;
  return <Badge>{nombre(restant)} en stock</Badge>;
}

export function BadgeFigement({ fige }) {
  return fige ? (
    <Badge ton="succes" icone={Lock}>Figée</Badge>
  ) : (
    <Badge ton="attention" icone={FileEdit}>Brouillon</Badge>
  );
}

const STATUTS_LIVRAISON = {
  a_programmer: { ton: 'attention', icone: Circle },
  programmee: { ton: 'info', icone: PhoneCall },
  en_cours: { ton: 'principal', icone: Truck },
  livree: { ton: 'succes', icone: PackageCheck },
  annulee: { ton: 'neutre', icone: Ban },
};

export function BadgeStatutLivraison({ statut }) {
  const s = STATUTS_LIVRAISON[statut] ?? {};
  return (
    <Badge ton={s.ton} icone={s.icone}>
      {LIBELLES_STATUT_LIVRAISON[statut] ?? statut}
    </Badge>
  );
}
