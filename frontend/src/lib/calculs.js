/**
 * Miroir des formules du backend pour les recalculs en direct dans l'écran de
 * tarification. La sauvegarde recalcule et fait foi côté serveur.
 */

export function arrondir(n, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

export function tauxEuro(sommeEuro, sommeAr) {
  const s = Number(sommeEuro);
  const sAr = Number(sommeAr);
  if (!s || !sAr) return null;
  return sAr / s;
}

export function prixAchatAr(prix, taux) {
  if (taux === null || taux === undefined || prix === '' || prix === null || prix === undefined) return null;
  return Number(prix) * taux;
}

export function prixVenteDepuisMarge(achatAr, margePct) {
  if (achatAr === null || achatAr === undefined) return null;
  if (margePct === '' || margePct === null || margePct === undefined) return null;
  return achatAr * (1 + Number(margePct) / 100);
}

export function margeDepuisPrixVente(achatAr, prixVenteAr) {
  if (!achatAr) return null;
  if (prixVenteAr === '' || prixVenteAr === null || prixVenteAr === undefined) return null;
  return (Number(prixVenteAr) / achatAr - 1) * 100;
}

export function sommeLignes(lignes) {
  return lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix || 0), 0);
}
