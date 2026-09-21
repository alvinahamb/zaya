import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tauxEuro, prixAchatAr, prixVenteDepuisMarge, margeDepuisPrixVente,
  sommeLignes, stockRestant, venteNette, recapAchat, statutAchat, arrondir,
} from './calculs.js';

test("taux d'un euro = sommeAr / somme", () => {
  assert.equal(tauxEuro(100, 500000), 5000);
  assert.equal(tauxEuro(0, 500000), null);
  assert.equal(tauxEuro(100, 0), null);
});

test("prix d'achat en Ar = prix × taux", () => {
  assert.equal(prixAchatAr(12.5, 5000), 62500);
  assert.equal(prixAchatAr(12.5, null), null);
});

test("marge et prix de vente sont inverses l'un de l'autre", () => {
  const achatAr = 62500;
  const prixVente = prixVenteDepuisMarge(achatAr, 40);
  assert.equal(prixVente, 87500);
  assert.equal(arrondir(margeDepuisPrixVente(achatAr, prixVente)), 40);
  assert.equal(margeDepuisPrixVente(0, 1000), null);
});

test("somme d'une commande = Σ quantité × prix", () => {
  assert.equal(sommeLignes([{ quantite: 2, prix: '12.50' }, { quantite: 1, prix: 5 }]), 30);
});

test('stock restant = quantité − vendu', () => {
  assert.equal(stockRestant({ quantite: 10, DetailVente: [{ quantite: 3 }, { quantite: 4 }] }), 3);
  assert.equal(stockRestant({ quantite: 10 }), 10);
});

test('réduction répartie au prorata des lignes', () => {
  const vente = {
    reductionAr: 1000,
    DetailVente: [
      { quantite: 1, prixVenteAr: 3000 },
      { quantite: 1, prixVenteAr: 1000 },
    ],
  };
  assert.equal(venteNette(vente.DetailVente[0], vente), 3000 - 750);
  assert.equal(venteNette(vente.DetailVente[1], vente), 1000 - 250);
  assert.equal(venteNette({ quantite: 2, prixVenteAr: 500 }, { reductionAr: 0 }), 1000);
});

test("récapitulatif d'une commande", () => {
  const vente = { reductionAr: 0, DetailVente: [{ quantite: 2, prixVenteAr: 90000 }] };
  vente.DetailVente[0].Vente = vente;
  const achat = {
    somme: 100,
    sommeAr: 500000,
    Frais: [{ montantAr: 50000 }],
    Boost: [{ montantAr: 20000, Frais: [{ montantAr: 5000 }] }],
    DetailAchat: [
      { quantite: 4, prix: 25, prixVenteAr: 90000, DetailVente: [vente.DetailVente[0]] },
    ],
  };
  const r = recapAchat(achat);
  assert.equal(r.tauxEuro, 5000);
  assert.equal(r.achatAvecFrais, 550000);
  assert.equal(r.estimationVente, 360000);
  assert.equal(r.sommeBoosts, 25000);
  assert.equal(r.venteActuelle, 180000);
  assert.equal(arrondir(r.margeEstimeePct), arrondir(((360000 - 550000) / 550000) * 100));
  assert.equal(arrondir(r.margeReellePct), arrondir(((180000 - 25000 - 550000) / 550000) * 100));
  assert.equal(r.stockRestant, 2);
});

test("statut d'une commande", () => {
  assert.equal(statutAchat({ dateArrivee: '2026-09-01' }, '2026-09-20'), 'recue');
  assert.equal(statutAchat({ dateArriveeEstimee: '2026-09-10' }, '2026-09-20'), 'en_retard');
  assert.equal(statutAchat({ dateArriveeEstimee: '2026-09-25' }, '2026-09-20'), 'en_route');
  assert.equal(statutAchat({}, '2026-09-20'), 'en_route');
});
