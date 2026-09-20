import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Search, Save, Package } from 'lucide-react';
import { Ventes, Reseaux, Achats } from '../../services/api.js';
import { useApi, useFermerDehors, useFormulaire } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, euro, nombre, aujourdhuiISO, versInputDate, dateCourte } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, SaisieMontant, Selection } from '../../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide, ImageProduit } from '../../components/ui/Divers.jsx';

/** Choix d'un article parmi les lignes de commande figées avec du stock. */
function SelecteurLigne({ disponibles, valeur, onChoisir }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');
  const ref = useRef(null);
  useFermerDehors(ref, ouvert, () => setOuvert(false));

  const filtres = useMemo(() => {
    const q = texte.trim().toLowerCase();
    return disponibles.filter((d) => !q || d.produit.nom.toLowerCase().includes(q) || d.achat.nom.toLowerCase().includes(q)).slice(0, 30);
  }, [disponibles, texte]);

  const choisie = disponibles.find((d) => d.id === valeur);

  return (
    <div className="selecteur" ref={ref}>
      <div className="outils__recherche" style={{ flex: 'none' }}>
        <Search size={16} aria-hidden="true" />
        <Saisie
          value={ouvert ? texte : choisie ? `${choisie.produit.nom} — ${choisie.achat.nom}` : ''}
          onFocus={() => {
            setOuvert(true);
            setTexte('');
          }}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Produit ou commande"
          aria-label="Article"
        />
      </div>
      {ouvert && (
        <div className="selecteur__liste">
          {filtres.length === 0 && <p className="petit secondaire" style={{ padding: 8 }}>Aucun article disponible.</p>}
          {filtres.map((d) => (
            <button
              key={d.id}
              type="button"
              className="selecteur__option"
              data-actif={d.id === valeur}
              onClick={() => {
                onChoisir(d);
                setOuvert(false);
              }}
            >
              <ImageProduit src={d.produit.image} alt="" />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="tronque" style={{ display: 'block' }}>{d.produit.nom}</span>
                <small className="tronque" style={{ display: 'block' }}>
                  {d.achat.nom} · {dateCourte(d.achat.dateCommande)} · reste {nombre(d.stockRestant)}
                </small>
              </span>
              <span className="tabulaire petit">{ariary(d.prixVenteAr)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ligneVide = () => ({ cle: Math.random().toString(36).slice(2), idDetailAchat: null, quantite: '1', prixVenteAr: '' });

const depuisVente = (vente) => ({
  nom: vente.nom ?? '',
  idReseau: String(vente.idReseau),
  dateVente: versInputDate(vente.dateVente),
  reductionAr: Number(vente.reductionAr) ? vente.reductionAr : '',
});

export function FormulaireVente() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { notifier } = useToast();
  const modification = Boolean(id);

  const chargerReseaux = useCallback(() => Reseaux.lister(), []);
  const chargerDisponibles = useCallback(() => Achats.lignesDisponibles(), []);
  const chargerVente = useCallback(() => (id ? Ventes.lire(id) : Promise.resolve(null)), [id]);
  const { donnees: reseaux } = useApi(chargerReseaux);
  const { donnees: disponibles, chargement: chargementDisponibles } = useApi(chargerDisponibles);
  const { donnees: vente, chargement: chargementVente, erreur: erreurVente } = useApi(chargerVente);

  const f = useFormulaire({ nom: '', idReseau: '', dateVente: aujourdhuiISO(), reductionAr: '' });
  const [lignes, setLignes] = useState([ligneVide()]);
  const [initialise, setInitialise] = useState(false);

  // Pré-remplissage une fois les référentiels (et la vente, en modification) chargés
  if (!initialise && reseaux && (!modification || vente)) {
    setInitialise(true);
    if (vente) {
      f.reinitialiser(depuisVente(vente));
      setLignes(vente.lignes.map((l) => ({ cle: String(l.id), idDetailAchat: l.idDetailAchat, quantite: String(l.quantite), prixVenteAr: String(l.prixVenteAr) })));
    } else {
      f.changer('idReseau', reseaux[0] ? String(reseaux[0].id) : '');
    }
  }

  // En modification, les quantités déjà vendues dans cette vente redeviennent disponibles
  const disponiblesAjustes = useMemo(() => {
    if (!disponibles) return [];
    if (!vente) return disponibles;
    const parLigne = new Map();
    for (const l of vente.lignes) parLigne.set(l.idDetailAchat, (parLigne.get(l.idDetailAchat) ?? 0) + l.quantite);
    const ajustes = disponibles.map((d) => ({ ...d, stockRestant: d.stockRestant + (parLigne.get(d.id) ?? 0) }));
    // Lignes de la vente totalement épuisées ailleurs : absentes de la liste serveur, on les reconstruit
    for (const l of vente.lignes) {
      if (!ajustes.some((d) => d.id === l.idDetailAchat)) {
        ajustes.push({ id: l.idDetailAchat, idProduit: l.produit.id, produit: l.produit, achat: l.achat, prixVenteAr: l.prixVenteAr, stockRestant: parLigne.get(l.idDetailAchat) ?? 0 });
      }
    }
    return ajustes;
  }, [disponibles, vente]);

  const detail = (idDetailAchat) => disponiblesAjustes.find((d) => d.id === idDetailAchat);

  const changerLigne = (cle, maj) => setLignes((liste) => liste.map((l) => (l.cle === cle ? { ...l, ...maj } : l)));

  const brut = lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prixVenteAr || 0), 0);
  const reduction = Number(f.valeurs.reductionAr || 0);
  const total = Math.max(0, brut - reduction);

  const erreursLignes = lignes.map((l) => {
    const d = detail(l.idDetailAchat);
    if (!d) return null;
    const demandee = lignes.filter((x) => x.idDetailAchat === l.idDetailAchat).reduce((s, x) => s + Number(x.quantite || 0), 0);
    if (demandee > d.stockRestant) return `Quantité supérieure au stock restant (reste ${nombre(d.stockRestant)})`;
    return null;
  });

  const soumettre = async (e) => {
    e.preventDefault();
    const valides = lignes.filter((l) => l.idDetailAchat);
    if (valides.length === 0) {
      f.setErreur('Ajoutez au moins un article');
      return;
    }
    if (erreursLignes.some(Boolean)) {
      f.setErreur('Corrigez les quantités qui dépassent le stock restant');
      return;
    }
    const corps = {
      ...f.valeurs,
      reductionAr: reduction,
      lignes: valides.map((l) => ({ idDetailAchat: l.idDetailAchat, quantite: Number(l.quantite), prixVenteAr: Number(l.prixVenteAr) })),
    };
    const resultat = await f.soumettre(() => (modification ? Ventes.modifier(id, corps) : Ventes.creer(corps)));
    if (resultat) {
      notifier('Vente enregistrée');
      naviguer(`/ventes/${resultat.id}`);
    }
  };

  const retour = modification ? { to: `/ventes/${id}`, libelle: 'Vente' } : { to: '/ventes', libelle: 'Ventes' };
  const titre = modification ? 'Modifier la vente' : 'Nouvelle vente';
  if (erreurVente) return <Page retour={retour} titre={titre}><Encart ton="erreur">{erreurVente}</Encart></Page>;
  if ((modification && chargementVente && !vente) || !reseaux || chargementDisponibles || !initialise) {
    return <Page retour={retour} titre={titre}><Chargement /></Page>;
  }

  return (
    <Page retour={retour} titre={titre}>
      {reseaux.length === 0 && <Encart ton="attention">Créez d'abord un réseau social dans les paramètres.</Encart>}
      <form className="colonne" style={{ gap: 20 }} onSubmit={soumettre} noValidate>
        <Carte titre="Informations">
          <div className="formulaire__ligne">
            <Champ libelle="Réseau social" requis>
              {(idc) => <Selection id={idc} name="idReseau" required value={f.valeurs.idReseau} onChange={f.surChangement} placeholder="Choisir" options={reseaux.map((r) => ({ valeur: String(r.id), libelle: r.nom }))} />}
            </Champ>
            <Champ libelle="Date" requis>
              {(idc) => <Saisie id={idc} name="dateVente" type="date" required value={f.valeurs.dateVente} onChange={f.surChangement} />}
            </Champ>
            <Champ libelle="Libellé" aide="Facultatif">
              {(idc) => <Saisie id={idc} name="nom" value={f.valeurs.nom} onChange={f.surChangement} placeholder="Ex. Commande Instagram du 20/09" />}
            </Champ>
          </div>
        </Carte>

        <Carte
          titre="Articles"
          actions={<Bouton taille="petit" icone={Plus} onClick={() => setLignes((l) => [...l, ligneVide()])}>Ajouter un article</Bouton>}
          nu
        >
          {disponiblesAjustes.length === 0 ? (
            <EtatVide icone={Package} titre="Aucun article disponible" description="Figez la tarification d'une commande avec du stock pour pouvoir vendre." />
          ) : (
            lignes.map((l, i) => {
              const d = detail(l.idDetailAchat);
              const totalLigne = Number(l.quantite || 0) * Number(l.prixVenteAr || 0);
              return (
                <div key={l.cle} className="ligne-vente">
                  <Champ libelle={`Article ${i + 1}`}>
                    <SelecteurLigne
                      disponibles={disponiblesAjustes}
                      valeur={l.idDetailAchat}
                      onChoisir={(choix) => changerLigne(l.cle, { idDetailAchat: choix.id, prixVenteAr: choix.prixVenteAr === null ? '' : String(choix.prixVenteAr), quantite: l.quantite || '1' })}
                    />
                    {d && <span className="champ__aide">Prix d'achat {euro(d.produit.prix)} · stock restant {nombre(d.stockRestant)}</span>}
                  </Champ>
                  <Champ libelle="Quantité" erreur={erreursLignes[i]}>
                    {(idc) => <Saisie id={idc} type="number" inputMode="numeric" min="1" max={d?.stockRestant} step="1" value={l.quantite} onChange={(e) => changerLigne(l.cle, { quantite: e.target.value })} erreur={Boolean(erreursLignes[i])} disabled={!d} />}
                  </Champ>
                  <Champ libelle="Prix unitaire (Ar)">
                    {(idc) => <SaisieMontant id={idc} suffixe="Ar" value={l.prixVenteAr} onChange={(e) => changerLigne(l.cle, { prixVenteAr: e.target.value })} disabled={!d} />}
                  </Champ>
                  <Champ libelle="Total">
                    <div className="saisie tabulaire droite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: 'var(--fond-doux)' }}>{ariary(totalLigne)}</div>
                  </Champ>
                  <Bouton variante="discret" icone={Trash2} onClick={() => setLignes((liste) => (liste.length > 1 ? liste.filter((x) => x.cle !== l.cle) : [ligneVide()]))} aria-label="Retirer l'article" />
                </div>
              );
            })
          )}
          <div className="total-vente">
            <div className="total-vente__ligne">
              <span>Sous-total</span>
              <span className="tabulaire">{ariary(brut)}</span>
            </div>
            <div className="total-vente__ligne" style={{ alignItems: 'center' }}>
              <label htmlFor="reduction">Réduction globale</label>
              <div style={{ width: 180 }}>
                <SaisieMontant id="reduction" name="reductionAr" suffixe="Ar" value={f.valeurs.reductionAr} onChange={f.surChangement} />
              </div>
            </div>
            <div className="total-vente__ligne total-vente__ligne--total">
              <span>Total</span>
              <span className="tabulaire">{ariary(total)}</span>
            </div>
            {reduction > brut && <span className="champ__erreur">La réduction dépasse le sous-total</span>}
          </div>
        </Carte>

        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
        <div className="formulaire__actions">
          <Bouton onClick={() => naviguer(retour.to)} disabled={f.envoi}>Annuler</Bouton>
          <Bouton type="submit" variante="principal" icone={Save} chargement={f.envoi} disabled={reseaux.length === 0 || reduction > brut}>
            {modification ? 'Enregistrer' : 'Enregistrer la vente'}
          </Bouton>
        </div>
      </form>
    </Page>
  );
}
