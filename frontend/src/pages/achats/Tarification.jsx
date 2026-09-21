import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Lock, Save, Package, PackagePlus, Percent } from 'lucide-react';
import { Achats, Produits, Categories, messageErreur } from '../../services/api.js';
import { useApi, useMediaQuery, REQUETE_MOBILE } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { arrondir, tauxEuro, prixAchatAr, prixVenteDepuisMarge, margeDepuisPrixVente, sommeLignes } from '../../lib/calculs.js';
import { euro, ariary, taux as formatTaux, dateHeure } from '../../lib/format.js';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Tableau } from '../../components/ui/Tableau.jsx';
import { Champ, Saisie, SaisieMontant, Selection } from '../../components/ui/Champs.jsx';
import { BadgeFigement, BadgeStock } from '../../components/ui/Badge.jsx';
import { Montant, Marge } from '../../components/ui/Montant.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { EtatVide, Encart, ImageProduit } from '../../components/ui/Divers.jsx';
import { FormulaireProduit } from '../produits/FormulaireProduit.jsx';

const texte = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * Modèle d'une ligne en brouillon : le prix de vente fait foi, la marge en
 * découle. La marge et le prix de vente ne sont pas recalculés à chaque
 * frappe : on tape un nombre entier puis Entrée (ou on quitte le champ) pour
 * valider. `margeSaisie` garde la marge validée telle que tapée, pour ne pas la
 * reformater ; `prixVenteSaisi` porte le prix de vente en cours de frappe, non
 * encore validé.
 */
const depuisServeur = (l) => ({
  id: l.id,
  produit: l.produit,
  quantite: texte(l.quantite),
  prix: texte(l.prix),
  prixVenteAr: texte(l.prixVenteAr),
  margeSaisie: null,
  prixVenteSaisi: null,
  stockRestant: l.stockRestant,
  sale: false,
});

/** Fusionne l'état serveur avec les saisies locales non enregistrées. */
function fusionner(locales, serveur) {
  return serveur.map((l) => {
    const locale = locales.find((x) => x.id === l.id);
    return locale?.sale ? { ...locale, produit: l.produit, stockRestant: l.stockRestant } : depuisServeur(l);
  });
}

const margeAffichee = (ligne, taux) => {
  if (ligne.margeSaisie !== null) return ligne.margeSaisie;
  const m = margeDepuisPrixVente(prixAchatAr(ligne.prix, taux), ligne.prixVenteAr);
  return m === null ? '' : texte(arrondir(m, 0));
};

const prixVenteAffiche = (ligne) => (ligne.prixVenteSaisi !== null ? ligne.prixVenteSaisi : ligne.prixVenteAr);

/** Applique une marge à une ligne : le prix de vente en découle, arrondi à l'Ariary. */
const appliquerMarge = (ligne, marge, taux) => {
  const pv = prixVenteDepuisMarge(prixAchatAr(ligne.prix, taux), marge);
  return { ...ligne, sale: true, margeSaisie: marge, prixVenteSaisi: null, prixVenteAr: pv === null ? '' : texte(arrondir(pv, 0)) };
};

/** Entrée valide la saisie sans soumettre de formulaire. */
const surEntree = (valider) => (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  valider();
};

/** Écran de tarification : marge et prix de vente liés, brouillon puis figement. */
export function Tarification({ achat, setAchat }) {
  const { notifier } = useToast();
  const mobile = useMediaQuery(REQUETE_MOBILE);
  const [lignes, setLignes] = useState(() => achat.lignes.map(depuisServeur));
  const [sommeAr, setSommeAr] = useState(texte(achat.sommeAr));
  const [sommeTotale, setSommeTotale] = useState(texte(achat.sommeTotale));
  const [sommeArSale, setSommeArSale] = useState(false);
  const [margeGlobale, setMargeGlobale] = useState('');
  const [achatVu, setAchatVu] = useState(achat);
  const [modifiee, setModifiee] = useState(null); // { id, champ, t } : dernière cellule modifiée, surlignée
  const [confirmation, setConfirmation] = useState(false);
  const [enregistrement, setEnregistrement] = useState(null); // 'brouillon' | 'figer' | 'ligne'
  const [erreur, setErreur] = useState(null);

  // Nouvelle version de la commande (ligne ajoutée ou retirée) : on resynchronise sans perdre les saisies
  if (achat !== achatVu) {
    setAchatVu(achat);
    setLignes(fusionner(lignes, achat.lignes));
    if (!sommeArSale) {
      setSommeAr(texte(achat.sommeAr));
      setSommeTotale(texte(achat.sommeTotale));
    }
  }

  const sale = sommeArSale || lignes.some((l) => l.sale);
  useEffect(() => {
    if (!sale) return undefined;
    const avertir = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avertir);
    return () => window.removeEventListener('beforeunload', avertir);
  }, [sale]);

  const sommeEuro = useMemo(() => sommeLignes(lignes), [lignes]);
  // Le total saisi (frais inclus) fait foi pour le taux ; sinon la somme des lignes
  const sommeRetenue = sommeTotale === '' ? sommeEuro : Number(sommeTotale);
  const taux = useMemo(() => tauxEuro(sommeRetenue, sommeAr), [sommeRetenue, sommeAr]);

  const marquer = (id, champ) => setModifiee({ id, champ, t: Date.now() });

  // Quantité et prix d'achat : recalcul en direct, la marge redevient une valeur dérivée
  const changerLigne = (id, champ, valeur) => {
    setLignes((liste) => liste.map((l) => (l.id === id ? { ...l, [champ]: valeur, margeSaisie: null, sale: true } : l)));
    marquer(id, champ);
  };

  // Marge et prix de vente : la frappe est seulement mémorisée, le calcul attend Entrée ou la perte de focus
  const saisirLigne = (id, champ, valeur) => {
    const cle = champ === 'margePct' ? 'margeSaisie' : 'prixVenteSaisi';
    setLignes((liste) => liste.map((l) => (l.id === id ? { ...l, [cle]: valeur } : l)));
  };

  const validerLigne = (id, champ) => {
    const ligne = lignes.find((l) => l.id === id);
    if (!ligne) return;
    if (champ === 'margePct') {
      if (ligne.margeSaisie === null) return;
      setLignes((liste) => liste.map((l) => (l.id === id ? appliquerMarge(l, l.margeSaisie, taux) : l)));
      marquer(id, 'prixVenteAr');
      return;
    }
    if (ligne.prixVenteSaisi === null) return;
    // Le prix de vente fait foi : la marge redevient une valeur dérivée
    setLignes((liste) =>
      liste.map((l) => (l.id === id ? { ...l, sale: true, prixVenteAr: l.prixVenteSaisi, prixVenteSaisi: null, margeSaisie: null } : l)),
    );
    marquer(id, 'margePct');
  };

  // Marge globale : une même marge appliquée à toutes les lignes
  const appliquerMargeGlobale = () => {
    if (!taux || margeGlobale === '' || lignes.length === 0) return;
    setLignes((liste) => liste.map((l) => appliquerMarge(l, margeGlobale, taux)));
    marquer('*', 'prixVenteAr');
  };

  const changerSommeAr = (valeur) => {
    setSommeAr(valeur);
    setSommeArSale(true);
    setLignes((liste) => liste.map((l) => (l.margeSaisie === null ? l : { ...l, margeSaisie: null })));
  };
  const changerSommeTotale = (valeur) => {
    setSommeTotale(valeur);
    setSommeArSale(true);
    setLignes((liste) => liste.map((l) => (l.margeSaisie === null ? l : { ...l, margeSaisie: null })));
  };

  const corps = (figer) => ({
    figer,
    sommeAr: sommeAr === '' ? 0 : Number(sommeAr),
    sommeTotale: sommeTotale === '' ? null : Number(sommeTotale),
    lignes: lignes.map((l) => ({
      id: l.id,
      quantite: Number(l.quantite),
      prix: l.prix === '' ? 0 : Number(l.prix),
      prixVenteAr: l.prixVenteAr === '' ? null : Number(l.prixVenteAr),
    })),
  });

  const enregistrer = async (figer) => {
    setErreur(null);
    if (figer) {
      const manquantes = lignes.filter((l) => l.prixVenteAr === '');
      if (manquantes.length) {
        setErreur(`Prix de vente manquant : ${manquantes.map((l) => l.produit.nom).join(', ')}`);
        setConfirmation(false);
        return;
      }
      if (!taux) {
        setErreur('Renseignez la somme payée en Ariary et au moins un prix d’achat pour calculer le taux.');
        setConfirmation(false);
        return;
      }
    }
    setEnregistrement(figer ? 'figer' : 'brouillon');
    try {
      const maj = await Achats.tarifer(achat.id, corps(figer));
      setLignes(maj.lignes.map(depuisServeur));
      setSommeArSale(false);
      setAchat(maj);
      notifier(figer ? 'Tarification enregistrée et figée' : 'Brouillon enregistré');
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnregistrement(null);
      setConfirmation(false);
    }
  };

  const supprimerLigne = async (ligne) => {
    setEnregistrement('ligne');
    try {
      const maj = await Achats.supprimerLigne(achat.id, ligne.id);
      setAchat(maj);
      notifier(`« ${ligne.produit.nom} » retiré de la commande`);
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnregistrement(null);
    }
  };

  const estModifiee = (id, champ) => (modifiee?.id === id || modifiee?.id === '*') && modifiee?.champ === champ;
  const classeCellule = (id, champ) => `tarif__cellule ${estModifiee(id, champ) ? 'tarif__cellule--modifiee' : ''}`;
  const cleCellule = (id, champ) => (estModifiee(id, champ) ? `${champ}-${modifiee.t}` : champ);

  const colonneProduit = {
    cle: 'produit',
    titre: 'Produit',
    principal: true,
    rendu: (l) => (
      <div className="tarif__produit">
        <ImageProduit src={l.produit.image} alt="" />
        <div style={{ minWidth: 0 }}>
          <Link className="tarif__produit-nom" to={`/produits/${l.produit.id}`} style={{ color: 'inherit' }}>{l.produit.nom}</Link>
          <div className="tres-petit secondaire">{l.produit.Categorie?.nom}</div>
        </div>
      </div>
    ),
  };

  if (achat.fige) {
    const colonnes = [
      colonneProduit,
      { cle: 'quantite', titre: 'Quantité', align: 'droite' },
      { cle: 'prix', titre: "Prix d'achat (€)", align: 'droite', classe: 'colonne-euro', rendu: (l) => <Montant valeur={l.prix} devise="€" /> },
      { cle: 'prixAchatAr', titre: "Prix d'achat (Ar)", align: 'droite', classe: 'colonne-ar', rendu: (l) => <Montant valeur={prixAchatAr(l.prix, achat.taux)} /> },
      { cle: 'margePct', titre: 'Marge', align: 'droite', rendu: (l) => <Marge pct={l.margePct} /> },
      { cle: 'prixVenteAr', titre: 'Prix de vente (Ar)', align: 'droite', rendu: (l) => <Montant valeur={l.prixVenteAr} className="gras" /> },
      { cle: 'stock', titre: 'Stock restant', align: 'droite', rendu: (l) => <BadgeStock restant={l.stockRestant} /> },
    ];
    return (
      <Carte nu className="tarif">
        <div className="tarif__barre">
          <BadgeFigement fige />
          <span className="petit secondaire">
            Figée le {dateHeure(achat.dateFigement)} · {formatTaux(achat.taux)} · Total {euro(achat.sommeEffective)}
            {achat.sommeTotale !== null && ` (lignes ${euro(achat.somme)})`} · Payé {ariary(achat.sommeAr)}
          </span>
        </div>
        {mobile ? (
          <div className="liste-cartes">
            {achat.lignes.map((l) => (
              <div key={l.id} className="ligne-article">
                <ImageProduit src={l.produit.image} alt="" taille="moyenne" />
                <div className="ligne-article__corps">
                  <div className="flex-entre" style={{ gap: 8 }}>
                    <Link to={`/produits/${l.produit.id}`} className="gras" style={{ color: 'inherit' }}>{l.produit.nom}</Link>
                    <BadgeStock restant={l.stockRestant} />
                  </div>
                  <div className="tres-petit secondaire">
                    {l.quantite} × {euro(l.prix)} · soit {ariary(prixAchatAr(l.prix, achat.taux))} l'unité
                  </div>
                  <div className="ligne-article__rang" style={{ marginTop: 4 }}>
                    <span className="secondaire">Prix de vente</span>
                    <span className="gras tabulaire">{ariary(l.prixVenteAr)}</span>
                  </div>
                  <div className="ligne-article__rang">
                    <span className="secondaire">Marge</span>
                    <Marge pct={l.margePct} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Tableau colonnes={colonnes} lignes={achat.lignes} cartes={false} />
        )}
      </Carte>
    );
  }

  const colonnes = [
    colonneProduit,
    {
      cle: 'quantite',
      titre: 'Quantité',
      align: 'droite',
      rendu: (l) => (
        <div key={cleCellule(l.id, 'quantite')} className={classeCellule(l.id, 'quantite')}>
          <Saisie type="number" inputMode="numeric" min="1" step="1" value={l.quantite} onChange={(e) => changerLigne(l.id, 'quantite', e.target.value)} aria-label={`Quantité de ${l.produit.nom}`} style={{ width: 90, textAlign: 'right' }} />
        </div>
      ),
    },
    {
      cle: 'prix',
      titre: "Prix d'achat (€)",
      align: 'droite',
      classe: 'colonne-euro',
      rendu: (l) => (
        <div key={cleCellule(l.id, 'prix')} className={classeCellule(l.id, 'prix')}>
          <SaisieMontant suffixe="€" value={l.prix} onChange={(e) => changerLigne(l.id, 'prix', e.target.value)} aria-label={`Prix d'achat de ${l.produit.nom}`} style={{ width: 120 }} />
        </div>
      ),
    },
    {
      cle: 'prixAchatAr',
      titre: "Prix d'achat (Ar)",
      align: 'droite',
      classe: 'colonne-ar',
      rendu: (l) => <span className="tabulaire">{ariary(prixAchatAr(l.prix, taux))}</span>,
    },
    {
      cle: 'margePct',
      titre: 'Marge (%)',
      align: 'droite',
      rendu: (l) => (
        <div key={cleCellule(l.id, 'margePct')} className={classeCellule(l.id, 'margePct')}>
          <SaisieMontant
            suffixe="%"
            min={undefined}
            step="1"
            inputMode="numeric"
            value={margeAffichee(l, taux)}
            onChange={(e) => saisirLigne(l.id, 'margePct', e.target.value)}
            onKeyDown={surEntree(() => validerLigne(l.id, 'margePct'))}
            onBlur={() => validerLigne(l.id, 'margePct')}
            aria-label={`Marge de ${l.produit.nom} (Entrée pour calculer le prix de vente)`}
            disabled={!taux}
            style={{ width: 110 }}
          />
        </div>
      ),
    },
    {
      cle: 'prixVenteAr',
      titre: 'Prix de vente (Ar)',
      align: 'droite',
      rendu: (l) => (
        <div key={cleCellule(l.id, 'prixVenteAr')} className={classeCellule(l.id, 'prixVenteAr')}>
          <SaisieMontant
            suffixe="Ar"
            step="1"
            inputMode="numeric"
            value={prixVenteAffiche(l)}
            onChange={(e) => saisirLigne(l.id, 'prixVenteAr', e.target.value)}
            onKeyDown={surEntree(() => validerLigne(l.id, 'prixVenteAr'))}
            onBlur={() => validerLigne(l.id, 'prixVenteAr')}
            aria-label={`Prix de vente de ${l.produit.nom} (Entrée pour calculer la marge)`}
            style={{ width: 150 }}
          />
        </div>
      ),
    },
    {
      cle: 'actions',
      titre: '',
      align: 'droite',
      rendu: (l) => (
        <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => supprimerLigne(l)} disabled={enregistrement === 'ligne'} aria-label={`Retirer ${l.produit.nom}`} />
      ),
    },
  ];

  return (
    <>
      <Carte nu className="tarif">
        <div className="tarif__barre">
          <BadgeFigement fige={false} />
          <Champ libelle="Total de la commande (€)" aide={sommeTotale === '' ? `Somme des lignes : ${euro(sommeEuro)}` : `Lignes : ${euro(sommeEuro)}`}>
            {(id) => <SaisieMontant id={id} suffixe="€" value={sommeTotale} onChange={(e) => changerSommeTotale(e.target.value)} placeholder={String(arrondir(sommeEuro))} />}
          </Champ>
          <Champ libelle="Somme payée (Ar)">
            {(id) => <SaisieMontant id={id} suffixe="Ar" value={sommeAr} onChange={(e) => changerSommeAr(e.target.value)} />}
          </Champ>
          <div className="petit secondaire">
            <div>Taux : <strong className="tabulaire">{formatTaux(taux)}</strong></div>
          </div>
          <Champ libelle="Marge pour toutes les lignes (%)" aide={taux ? 'Entrée pour appliquer à toutes les lignes' : 'Renseignez d’abord la somme payée'}>
            {(id) => (
              <div className="flex" style={{ gap: 6 }}>
                <SaisieMontant
                  id={id}
                  suffixe="%"
                  min={undefined}
                  step="1"
                  inputMode="numeric"
                  value={margeGlobale}
                  onChange={(e) => setMargeGlobale(e.target.value)}
                  onKeyDown={surEntree(appliquerMargeGlobale)}
                  disabled={!taux}
                  style={{ width: 110 }}
                />
                <Bouton icone={Percent} onClick={appliquerMargeGlobale} disabled={!taux || margeGlobale === '' || lignes.length === 0} aria-label="Appliquer la marge à toutes les lignes" title="Appliquer à toutes les lignes" />
              </div>
            )}
          </Champ>
          {sale && <span className="badge badge--attention pousser">Modifications non enregistrées</span>}
        </div>

        <Tableau
          colonnes={colonnes}
          lignes={lignes}
          vide={<EtatVide icone={Package} titre="Aucun produit" description="Ajoutez les produits de la commande ci-dessous." />}
        />

        <AjoutLigne achat={achat} setAchat={setAchat} lignes={lignes} />
      </Carte>

      {erreur && <div className="espace-haut"><Encart ton="erreur">{erreur}</Encart></div>}

      <div className="formulaire__actions espace-haut">
        <Bouton icone={Save} onClick={() => enregistrer(false)} chargement={enregistrement === 'brouillon'} disabled={enregistrement !== null || lignes.length === 0}>
          Enregistrer le brouillon
        </Bouton>
        <Bouton variante="principal" icone={Lock} onClick={() => setConfirmation(true)} disabled={enregistrement !== null || lignes.length === 0}>
          Enregistrer et figer
        </Bouton>
      </div>

      <Confirmation
        ouverte={confirmation}
        titre="Figer la tarification ?"
        message="Les prix d'achat, les marges et les prix de vente seront enregistrés définitivement et ne seront plus recalculés, même si le catalogue change. Les produits deviendront disponibles à la vente."
        libelleConfirmer="Enregistrer et figer"
        chargement={enregistrement === 'figer'}
        onConfirmer={() => enregistrer(true)}
        onAnnuler={() => setConfirmation(false)}
      />
    </>
  );
}

function AjoutLigne({ achat, setAchat, lignes }) {
  const { notifier } = useToast();
  const charger = useCallback(() => Produits.lister(), []);
  const chargerCategories = useCallback(() => Categories.lister(), []);
  const { donnees: produits, recharger: rechargerProduits } = useApi(charger);
  const { donnees: categories } = useApi(chargerCategories);
  const [nouveauProduit, setNouveauProduit] = useState(false);
  const [idProduit, setIdProduit] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [prix, setPrix] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const dejaPresents = new Set(lignes.map((l) => l.produit.id));
  const disponibles = (produits ?? []).filter((p) => !dejaPresents.has(p.id));

  const choisir = (valeur) => {
    setIdProduit(valeur);
    const p = disponibles.find((x) => String(x.id) === valeur);
    setPrix(p?.prix !== null && p?.prix !== undefined ? String(p.prix) : '');
  };

  const ajouter = async (e) => {
    e.preventDefault();
    if (!idProduit) return;
    setEnvoi(true);
    try {
      const maj = await Achats.ajouterLigne(achat.id, { idProduit: Number(idProduit), quantite: Number(quantite), prix: prix === '' ? undefined : Number(prix) });
      setAchat(maj);
      setIdProduit('');
      setQuantite('1');
      setPrix('');
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form className="ajout-ligne" onSubmit={ajouter}>
      <Champ libelle="Ajouter un produit">
        {(id) => (
          <div className="flex" style={{ gap: 6 }}>
            <Selection id={id} value={idProduit} onChange={(e) => choisir(e.target.value)} placeholder={disponibles.length ? 'Choisir un produit' : 'Tous les produits sont déjà sur la commande'} disabled={!disponibles.length}>
              {disponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}{p.prix !== null && p.prix !== undefined ? ` · ${euro(p.prix)}` : ''}
                </option>
              ))}
            </Selection>
            <Bouton icone={PackagePlus} onClick={() => setNouveauProduit(true)} aria-label="Nouveau produit" title="Créer un produit" />
          </div>
        )}
      </Champ>
      <FormulaireProduit
        ouvert={nouveauProduit}
        categories={categories ?? []}
        onFermer={() => setNouveauProduit(false)}
        onEnregistre={async (p) => {
          setNouveauProduit(false);
          notifier('Produit créé');
          await rechargerProduits();
          setIdProduit(String(p.id));
          setPrix(p.prix !== null && p.prix !== undefined ? String(p.prix) : '');
        }}
      />
      <Champ libelle="Quantité">
        {(id) => <Saisie id={id} type="number" inputMode="numeric" min="1" step="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />}
      </Champ>
      <Champ libelle="Prix d'achat (€)">
        {(id) => <SaisieMontant id={id} suffixe="€" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Prix catalogue" />}
      </Champ>
      <Bouton type="submit" icone={Plus} chargement={envoi} disabled={!idProduit}>
        Ajouter
      </Bouton>
    </form>
  );
}
