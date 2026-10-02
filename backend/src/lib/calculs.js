/**
 * Règles de gestion et formules (cahier des charges §3.6).
 * Fonctions pures, en Number : la précision est conservée dans les calculs,
 * seul l'affichage arrondit.
 */

export function arrondir(n, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

const somme = (liste, champ) => liste.reduce((s, x) => s + Number(x[champ] ?? 0), 0);

/** Taux d'un euro = sommeAr / somme. null tant que l'un des deux est nul. */
export function tauxEuro(sommeEuro, sommeAr) {
  const s = Number(sommeEuro);
  const sAr = Number(sommeAr);
  if (!s || !sAr) return null;
  return sAr / s;
}

/** Prix d'achat en Ariary = prix (€) × taux. */
export function prixAchatAr(prix, taux) {
  if (taux === null || taux === undefined || prix === null || prix === undefined) return null;
  return Number(prix) * taux;
}

/** prixVenteAr = prix d'achat Ar × (1 + margePct / 100). */
export function prixVenteDepuisMarge(prixAchatArValeur, margePct) {
  if (prixAchatArValeur === null || prixAchatArValeur === undefined) return null;
  if (margePct === null || margePct === undefined) return null;
  return prixAchatArValeur * (1 + Number(margePct) / 100);
}

/** margePct = (prixVenteAr / prix d'achat Ar − 1) × 100. */
export function margeDepuisPrixVente(prixAchatArValeur, prixVenteAr) {
  if (!prixAchatArValeur) return null;
  if (prixVenteAr === null || prixVenteAr === undefined) return null;
  return (Number(prixVenteAr) / prixAchatArValeur - 1) * 100;
}

/** Achat.somme = Σ quantite × prix des lignes (en euro). */
export function sommeLignes(lignes) {
  return lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prix), 0);
}

/** Stock restant d'une ligne = quantite − Σ DetailVente.quantite. */
export function stockRestant(ligne) {
  const vendu = (ligne.DetailVente ?? []).reduce((s, d) => s + Number(d.quantite), 0);
  return Number(ligne.quantite) - vendu;
}

/**
 * Montant net d'une ligne de vente : son brut moins sa part de la réduction
 * globale, répartie au prorata des lignes de la vente.
 * `vente` doit porter reductionAr et toutes ses DetailVente.
 */
export function venteNette(ligneVente, vente) {
  const brut = Number(ligneVente.quantite) * Number(ligneVente.prixVenteAr);
  const reduction = Number(vente?.reductionAr ?? 0);
  if (!reduction) return brut;
  const totalBrut = (vente.DetailVente ?? []).reduce(
    (s, d) => s + Number(d.quantite) * Number(d.prixVenteAr),
    0,
  );
  if (!totalBrut) return brut;
  return brut - reduction * (brut / totalBrut);
}

/** Coût d'achat en Ariary d'une ligne de vente (prix € × taux de sa commande × quantité). */
export function coutLigneVente(ligneVente, detailAchat, achat) {
  const taux = tauxEuro(achat.somme, achat.sommeAr);
  if (taux === null) return null;
  return Number(detailAchat.prix) * taux * Number(ligneVente.quantite);
}

/** Une vente ne compte comme vendue (CA, quantités vendues) qu'une fois payée. */
export const estPayee = (vente) => vente?.statut === 'payee';

/**
 * Récapitulatif d'une commande : vente actuelle et quantité vendue ne
 * retiennent que les ventes payées.
 * `achat` doit inclure DetailAchat (avec DetailVente → Vente → DetailVente),
 * Frais et Boost (avec Frais).
 */
export function recapAchat(achat) {
  const lignes = achat.DetailAchat ?? [];
  const sommeAr = Number(achat.sommeAr);
  const fraisAchat = somme(achat.Frais ?? [], 'montantAr');
  const achatAvecFrais = sommeAr + fraisAchat;

  const estimationVente = lignes.reduce(
    (s, l) => s + Number(l.quantite) * Number(l.prixVenteAr ?? 0),
    0,
  );

  const boosts = achat.Boost ?? [];
  const sommeBoosts =
    somme(boosts, 'montantAr') + boosts.reduce((s, b) => s + somme(b.Frais ?? [], 'montantAr'), 0);

  const venteActuelle = lignes.reduce(
    (s, l) => s + (l.DetailVente ?? []).filter((dv) => estPayee(dv.Vente)).reduce((t, dv) => t + venteNette(dv, dv.Vente), 0),
    0,
  );

  const quantiteAchetee = somme(lignes, 'quantite');
  const quantiteVendue = lignes.reduce(
    (s, l) => s + (l.DetailVente ?? []).filter((dv) => estPayee(dv.Vente)).reduce((t, dv) => t + Number(dv.quantite), 0),
    0,
  );
  // Les articles des ventes pas encore payées sont réservés : ils sortent du stock
  const quantiteSortie = lignes.reduce((s, l) => s + Number(l.quantite) - stockRestant(l), 0);

  const margeEstimeePct = achatAvecFrais
    ? ((estimationVente - achatAvecFrais) / achatAvecFrais) * 100
    : null;
  const margeReellePct = achatAvecFrais
    ? ((venteActuelle - sommeBoosts - achatAvecFrais) / achatAvecFrais) * 100
    : null;

  return {
    sommeEuro: Number(achat.somme),
    sommeAr,
    fraisAchat,
    achatAvecFrais,
    estimationVente,
    sommeBoosts,
    venteActuelle,
    margeEstimeePct,
    margeReellePct,
    quantiteAchetee,
    quantiteVendue,
    quantiteReservee: quantiteSortie - quantiteVendue,
    stockRestant: quantiteAchetee - quantiteSortie,
    tauxEuro: tauxEuro(achat.somme, achat.sommeAr),
  };
}

/** Statut d'une commande d'après ses dates : recue, en_retard ou en_route. */
export function statutAchat(achat, aujourdhuiISO) {
  if (achat.dateArrivee) return 'recue';
  if (achat.dateArriveeEstimee) {
    const estimee = new Date(achat.dateArriveeEstimee).toISOString().slice(0, 10);
    if (estimee < aujourdhuiISO) return 'en_retard';
  }
  return 'en_route';
}
