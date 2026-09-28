import { useEffect, useRef, useState } from 'react';
import { Upload, Plus, X, Star } from 'lucide-react';
import { Produits, messageErreur } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, SaisieMontant, Selection, ZoneTexte } from '../../components/ui/Champs.jsx';
import { Encart, ImageProduit } from '../../components/ui/Divers.jsx';
import { urlFichier } from '../../services/api.js';

const MAX_IMAGES = 8;

const vide = (categories) => ({
  nom: '',
  idCategorie: categories[0] ? String(categories[0].id) : '',
  materiel: '',
  codeShein: '',
  description: '',
  prix: '',
  image: '',
  images: [],
});

const depuisProduit = (p) => ({
  nom: p.nom ?? '',
  idCategorie: String(p.idCategorie),
  materiel: p.materiel ?? '',
  codeShein: p.codeShein ?? '',
  description: p.description ?? '',
  prix: p.prix ?? '',
  image: p.image ?? '',
  images: p.images ?? [],
});

export function FormulaireProduit({ ouvert, produit, categories, onFermer, onEnregistre }) {
  const f = useFormulaire(vide(categories));
  const fichierRef = useRef(null);
  const autresRef = useRef(null);
  const [televersement, setTeleversement] = useState(false);
  const [erreurImage, setErreurImage] = useState(null);

  useEffect(() => {
    if (ouvert) f.reinitialiser(produit ? depuisProduit(produit) : vide(categories));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, produit?.id]);

  const fermer = () => {
    setErreurImage(null);
    onFermer();
  };

  // Si les catégories arrivent après l'ouverture, on propose la première par défaut
  if (ouvert && !produit && !f.valeurs.idCategorie && categories.length) f.changer('idCategorie', String(categories[0].id));

  const televerser = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setTeleversement(true);
    setErreurImage(null);
    try {
      const { url } = await Produits.televerserImage(fichier);
      f.changer('image', url);
    } catch (err) {
      setErreurImage(messageErreur(err));
    } finally {
      setTeleversement(false);
      e.target.value = '';
    }
  };

  // Photos supplémentaires : plusieurs fichiers d'un coup, envoyés un par un
  const televerserAutres = async (e) => {
    const fichiers = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!fichiers.length) return;
    const place = MAX_IMAGES - f.valeurs.images.length;
    if (fichiers.length > place) setErreurImage(`${MAX_IMAGES} photos supplémentaires maximum`);
    setTeleversement(true);
    try {
      const urls = [];
      for (const fichier of fichiers.slice(0, place)) urls.push((await Produits.televerserImage(fichier)).url);
      // Sans photo principale, la première téléversée le devient
      if (!f.valeurs.image && urls.length) f.changer('image', urls.shift());
      f.changer('images', [...f.valeurs.images, ...urls]);
    } catch (err) {
      setErreurImage(messageErreur(err));
    } finally {
      setTeleversement(false);
    }
  };

  const retirerAutre = (url) => f.changer('images', f.valeurs.images.filter((u) => u !== url));

  // Échange une photo supplémentaire avec la principale
  const definirPrincipale = (url) => {
    const autres = f.valeurs.images.filter((u) => u !== url);
    f.changer('images', f.valeurs.image ? [f.valeurs.image, ...autres] : autres);
    f.changer('image', url);
  };

  const soumettre = async (e) => {
    e.preventDefault();
    const corps = { ...f.valeurs, prixVenteAr: produit?.prixVenteAr ?? null };
    const resultat = await f.soumettre(() => (produit ? Produits.modifier(produit.id, corps) : Produits.creer(corps)));
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={produit ? 'Modifier le produit' : 'Nouveau produit'}
      onFermer={fermer}
      pied={
        <>
          <Bouton onClick={fermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-produit" chargement={f.envoi}>
            {produit ? 'Enregistrer' : 'Créer le produit'}
          </Bouton>
        </>
      }
    >
      <form id="formulaire-produit" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Nom" requis>
          {(id) => <Saisie id={id} name="nom" required autoFocus value={f.valeurs.nom} onChange={f.surChangement} />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Catégorie" requis aide={!categories.length ? 'Créez une catégorie dans les paramètres' : undefined}>
            {(id) => (
              <Selection id={id} name="idCategorie" required value={f.valeurs.idCategorie} onChange={f.surChangement} placeholder="Choisir" options={categories.map((c) => ({ valeur: String(c.id), libelle: c.nom }))} />
            )}
          </Champ>
          <Champ libelle="Prix d'achat (€)">
            {(id) => <SaisieMontant id={id} name="prix" suffixe="€" value={f.valeurs.prix} onChange={f.surChangement} />}
          </Champ>
        </div>
        <div className="formulaire__ligne">
          <Champ libelle="Matériel">
            {(id) => <Saisie id={id} name="materiel" value={f.valeurs.materiel} onChange={f.surChangement} placeholder="Ex. Acier inoxydable" />}
          </Champ>
          <Champ libelle="Code Shein">
            {(id) => <Saisie id={id} name="codeShein" value={f.valeurs.codeShein} onChange={f.surChangement} />}
          </Champ>
        </div>
        <Champ libelle="Description">
          {(id) => <ZoneTexte id={id} name="description" rows={3} value={f.valeurs.description} onChange={f.surChangement} />}
        </Champ>
        <Champ libelle="Image" aide="Collez une URL ou téléversez un fichier (5 Mo max)" erreur={erreurImage}>
          {(id) => (
            <div className="apercu-image">
              <ImageProduit src={f.valeurs.image} taille="moyenne" />
              <div className="colonne" style={{ flex: 1, gap: 8 }}>
                <Saisie id={id} name="image" type="url" value={f.valeurs.image} onChange={f.surChangement} placeholder="https://…" />
                <div>
                  <input ref={fichierRef} type="file" accept="image/*" onChange={televerser} className="sr-only" aria-label="Téléverser une image" />
                  <Bouton taille="petit" icone={Upload} chargement={televersement} onClick={() => fichierRef.current?.click()}>
                    Téléverser
                  </Bouton>
                </div>
              </div>
            </div>
          )}
        </Champ>
        <Champ libelle="Autres photos" aide={`Affichées à côté de la photo principale (${MAX_IMAGES} max)`}>
          {(id) => (
            <div className="photos-produit">
              {f.valeurs.images.map((url) => (
                <div key={url} className="photos-produit__vignette">
                  <img src={urlFichier(url)} alt="" loading="lazy" />
                  <div className="photos-produit__actions">
                    <button type="button" onClick={() => definirPrincipale(url)} aria-label="Définir comme photo principale" title="Définir comme principale">
                      <Star size={14} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => retirerAutre(url)} aria-label="Retirer cette photo" title="Retirer">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {f.valeurs.images.length < MAX_IMAGES && (
                <button id={id} type="button" className="photos-produit__ajout" onClick={() => autresRef.current?.click()} disabled={televersement} aria-label="Ajouter des photos">
                  {televersement ? <span className="chargement__rond" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Plus size={20} aria-hidden="true" />}
                </button>
              )}
              <input ref={autresRef} type="file" accept="image/*" multiple onChange={televerserAutres} className="sr-only" aria-label="Téléverser des photos supplémentaires" />
            </div>
          )}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
