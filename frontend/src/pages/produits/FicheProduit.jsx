import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2, ShoppingBag } from 'lucide-react';
import { Produits, Categories, messageErreur } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { euro, ariary, dateCourte, dateHeure } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Tableau } from '../../components/ui/Tableau.jsx';
import { BadgeStock, BadgeFigement } from '../../components/ui/Badge.jsx';
import { Montant, Marge } from '../../components/ui/Montant.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { Chargement, Encart, EtatVide, ImageProduit } from '../../components/ui/Divers.jsx';
import { FormulaireProduit } from './FormulaireProduit.jsx';

export function FicheProduit() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { notifier } = useToast();
  const charger = useCallback(() => Produits.lire(id), [id]);
  const chargerCategories = useCallback(() => Categories.lister(), []);
  const { donnees: produit, chargement, erreur, setDonnees } = useApi(charger);
  const { donnees: categories } = useApi(chargerCategories);
  const [modification, setModification] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const supprimer = async () => {
    setSuppressionEnCours(true);
    try {
      await Produits.supprimer(produit.id);
      notifier('Produit supprimé');
      naviguer('/produits');
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
      setSuppression(false);
    } finally {
      setSuppressionEnCours(false);
    }
  };

  if (chargement && !produit) return <Page retour={{ to: '/produits', libelle: 'Produits' }}><Chargement /></Page>;
  if (erreur && !produit) return <Page retour={{ to: '/produits', libelle: 'Produits' }}><Encart ton="erreur">{erreur}</Encart></Page>;
  if (!produit) return null;

  const colonnes = [
    { cle: 'achat', titre: 'Commande', principal: true, rendu: (l) => (
      <div className="flex" style={{ flexWrap: 'wrap' }}>
        <Link to={`/achats/${l.achat.id}`}>{l.achat.nom}</Link>
        <BadgeFigement fige={Boolean(l.achat.dateFigement)} />
      </div>
    ) },
    { cle: 'date', titre: 'Commandée le', rendu: (l) => dateCourte(l.achat.dateCommande) },
    { cle: 'quantite', titre: 'Quantité', align: 'droite' },
    { cle: 'prix', titre: "Prix d'achat (€)", align: 'droite', classe: 'colonne-euro', rendu: (l) => <Montant valeur={l.prix} devise="€" /> },
    { cle: 'margePct', titre: 'Marge', align: 'droite', rendu: (l) => <Marge pct={l.margePct} /> },
    { cle: 'prixVenteAr', titre: 'Prix de vente (Ar)', align: 'droite', classe: 'colonne-ar', rendu: (l) => <Montant valeur={l.prixVenteAr} /> },
    { cle: 'stock', titre: 'Stock restant', align: 'droite', rendu: (l) => <BadgeStock restant={l.stockRestant} /> },
  ];

  return (
    <Page
      retour={{ to: '/produits', libelle: 'Produits' }}
      titre={produit.nom}
      badge={<BadgeStock restant={produit.stockRestant} />}
      sousTitre={produit.categorie?.nom}
      actions={
        <>
          <Bouton icone={Pencil} onClick={() => setModification(true)}>Modifier</Bouton>
          <Bouton variante="danger" icone={Trash2} onClick={() => setSuppression(true)} aria-label="Supprimer le produit" />
        </>
      }
    >
      <div className="fiche-produit espace-bas">
        <ImageProduit src={produit.image} alt={produit.nom} taille="grande" />
        <Carte titre="Informations">
          <dl className="definitions">
            <dt>Catégorie</dt>
            <dd>{produit.categorie?.nom}</dd>
            <dt>Matériel</dt>
            <dd>{produit.materiel || '—'}</dd>
            <dt>Code Shein</dt>
            <dd>{produit.codeShein || '—'}</dd>
            <dt>Prix d'achat</dt>
            <dd>{euro(produit.prix)}</dd>
            <dt>Dernier prix de vente</dt>
            <dd>{ariary(produit.prixVenteAr)} <span className="tres-petit secondaire">(indicatif)</span></dd>
            <dt>Stock restant</dt>
            <dd>{produit.stockRestant} sur {produit.quantiteAchetee} acheté{produit.quantiteAchetee > 1 ? 's' : ''}</dd>
            <dt>Créé le</dt>
            <dd>{dateHeure(produit.dateCreation)}</dd>
          </dl>
          {produit.description && <p className="secondaire espace-haut">{produit.description}</p>}
        </Carte>
      </div>

      <Carte titre="Historique des commandes" nu>
        <Tableau
          colonnes={colonnes}
          lignes={produit.lignes}
          vide={<EtatVide icone={ShoppingBag} titre="Jamais commandé" description="Ce produit n'apparaît sur aucune commande pour le moment." />}
        />
      </Carte>

      <FormulaireProduit
        ouvert={modification}
        produit={produit}
        categories={categories ?? []}
        onFermer={() => setModification(false)}
        onEnregistre={(maj) => {
          setDonnees(maj);
          setModification(false);
          notifier('Produit enregistré');
        }}
      />
      <Confirmation
        ouverte={suppression}
        titre="Supprimer le produit ?"
        message={`« ${produit.nom} » sera supprimé du catalogue. Impossible s'il figure sur une commande.`}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppressionEnCours}
        onConfirmer={supprimer}
        onAnnuler={() => setSuppression(false)}
      />
    </Page>
  );
}
