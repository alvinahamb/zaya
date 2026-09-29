import { Link } from 'react-router-dom';
import { Plus, Megaphone, ArrowRight } from 'lucide-react';
import { ariary, dateHeure } from '../../lib/format.js';
import { Carte } from '../../components/ui/Carte.jsx';
import { BadgeStatutPublication } from '../../components/ui/Badge.jsx';
import { ReseauxPublication } from '../../components/ui/ChoixReseaux.jsx';
import { BoutonLien } from '../../components/ui/Bouton.jsx';
import { EtatVide } from '../../components/ui/Divers.jsx';

/** Publications rattachées à la commande (la corbeille est exclue côté API). */
export function OngletPublications({ achat }) {
  const lienNouvelle = `/contenus?nouveau=1&achat=${achat.id}`;
  return (
    <Carte
      titre="Contenus de cette commande"
      actions={<BoutonLien variante="principal" taille="petit" icone={Plus} to={lienNouvelle}>Nouveau contenu</BoutonLien>}
      nu
    >
      {achat.publications.length === 0 ? (
        <EtatVide
          icone={Megaphone}
          titre="Aucun contenu"
          description="Planifiez les contenus qui mettront en avant les produits de cette commande."
          action={<BoutonLien variante="principal" icone={Plus} to={lienNouvelle}>Nouveau contenu</BoutonLien>}
        />
      ) : (
        <div className="liste-elements">
          {achat.publications.map((p) => (
            <Link key={p.id} to={`/contenus/${p.id}`} className="element" style={{ color: 'inherit' }}>
              <div className="element__corps">
                <div className="flex" style={{ flexWrap: 'wrap' }}>
                  <span className="element__titre">{p.nom}</span>
                  <BadgeStatutPublication statut={p.statut} />
                  <ReseauxPublication publication={p} />
                </div>
                <div className="element__meta">
                  {dateHeure(p.dateHeurePublication)}
                  {p.boosts.length > 0 && ` · ${p.boosts.length} boost${p.boosts.length > 1 ? 's' : ''} · ${ariary(p.totalBoostsAr)}`}
                </div>
              </div>
              <ArrowRight size={18} className="secondaire" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </Carte>
  );
}
