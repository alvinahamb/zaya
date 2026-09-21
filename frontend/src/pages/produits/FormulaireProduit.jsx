import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Produits, messageErreur } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, SaisieMontant, Selection, ZoneTexte } from '../../components/ui/Champs.jsx';
import { Encart, ImageProduit } from '../../components/ui/Divers.jsx';

const vide = (categories) => ({
  nom: '',
  idCategorie: categories[0] ? String(categories[0].id) : '',
  materiel: '',
  codeShein: '',
  description: '',
  prix: '',
  image: '',
});

const depuisProduit = (p) => ({
  nom: p.nom ?? '',
  idCategorie: String(p.idCategorie),
  materiel: p.materiel ?? '',
  codeShein: p.codeShein ?? '',
  description: p.description ?? '',
  prix: p.prix ?? '',
  image: p.image ?? '',
});

export function FormulaireProduit({ ouvert, produit, categories, onFermer, onEnregistre }) {
  const f = useFormulaire(vide(categories));
  const fichierRef = useRef(null);
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
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
