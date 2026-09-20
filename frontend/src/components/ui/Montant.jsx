import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { euro, ariary, pourcentage } from '../../lib/format.js';

/** Montant avec son unité : devise « € » (2 décimales) ou « Ar » (unité). */
export function Montant({ valeur, devise = 'Ar', className = '' }) {
  return <span className={`montant ${className}`}>{devise === '€' ? euro(valeur) : ariary(valeur)}</span>;
}

/** Marge en % : signe, couleur ET icône, jamais la couleur seule. */
export function Marge({ pct }) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) {
    return <span className="marge secondaire">—</span>;
  }
  const n = Number(pct);
  if (n === 0) {
    return (
      <span className="marge secondaire">
        <Minus aria-hidden="true" />
        {pourcentage(0)}
      </span>
    );
  }
  const positive = n > 0;
  return (
    <span className={`marge ${positive ? 'marge--positive' : 'marge--negative'}`}>
      {positive ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownRight aria-hidden="true" />}
      <span className="sr-only">{positive ? 'Marge positive' : 'Marge négative'} </span>
      {pourcentage(n)}
    </span>
  );
}
