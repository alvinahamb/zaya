import { Check } from 'lucide-react';
import { ImageProduit } from '../../components/ui/Divers.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';

/**
 * Choix des bijoux d'une publication parmi les articles de la commande liée :
 * une tuile (photo + nom) par bijou, cochée d'un toucher.
 * `articles` : [{ idProduit, produit, image }], `valeurs` : ids cochés.
 */
export function ChoixBijoux({ articles, valeurs, onChange }) {
  const basculer = (id) => onChange(valeurs.includes(id) ? valeurs.filter((x) => x !== id) : [...valeurs, id]);

  if (!articles.length) return <p className="petit secondaire">Cette commande ne contient encore aucun bijou.</p>;

  const tous = valeurs.length === articles.length;
  return (
    <div className="choix-bijoux">
      <div className="choix-bijoux__entete">
        <span className="petit secondaire">
          {valeurs.length} / {articles.length} sélectionné{valeurs.length > 1 ? 's' : ''}
        </span>
        <Bouton variante="discret" taille="petit" onClick={() => onChange(tous ? [] : articles.map((a) => a.idProduit))}>
          {tous ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Bouton>
      </div>
      <div className="choix-bijoux__grille" role="group" aria-label="Bijoux de la commande">
        {articles.map((a) => {
          const coche = valeurs.includes(a.idProduit);
          return (
            <button key={a.idProduit} type="button" className="choix-bijou" aria-pressed={coche} onClick={() => basculer(a.idProduit)} title={a.produit}>
              <ImageProduit src={a.image} alt="" taille="moyenne" />
              <span className="choix-bijou__nom">{a.produit}</span>
              {coche && (
                <span className="choix-bijou__coche" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
