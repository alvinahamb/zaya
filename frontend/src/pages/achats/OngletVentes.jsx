import { Link } from 'react-router-dom';
import { Receipt, ArrowRight } from 'lucide-react';
import { ariary, dateCourte, nombre } from '../../lib/format.js';
import { Carte } from '../../components/ui/Carte.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EtatVide } from '../../components/ui/Divers.jsx';
import { BoutonLien } from '../../components/ui/Bouton.jsx';

/** Ventes rattachées à la commande, via les lignes d'origine des articles vendus. */
export function OngletVentes({ achat }) {
  return (
    <Carte
      titre="Ventes de cette commande"
      actions={<span className="petit secondaire">Vente actuelle : <strong className="tabulaire">{ariary(achat.recap.venteActuelle)}</strong></span>}
      nu
    >
      {achat.ventes.length === 0 ? (
        <EtatVide
          icone={Receipt}
          titre="Aucune vente"
          description="Les ventes contenant des articles de cette commande apparaîtront ici."
          action={<BoutonLien variante="principal" to="/ventes/nouvelle">Nouvelle vente</BoutonLien>}
        />
      ) : (
        <div className="liste-elements">
          {achat.ventes.map((v) => (
            <div key={v.id}>
              <div className="element">
                <div className="element__corps">
                  <div className="flex" style={{ flexWrap: 'wrap' }}>
                    <Link to={`/ventes/${v.id}`} className="element__titre" style={{ color: 'inherit' }}>
                      {v.nom || `Vente n° ${v.id}`}
                    </Link>
                    {(v.reseaux ?? []).map((nom) => <Badge key={nom} ton="info">{nom}</Badge>)}
                  </div>
                  <div className="element__meta">{dateCourte(v.dateVente)}</div>
                </div>
                <span className="gras tabulaire">{ariary(v.totalAr)}</span>
                <BoutonLien variante="discret" taille="petit" icone={ArrowRight} to={`/ventes/${v.id}`} aria-label="Ouvrir la vente" />
              </div>
              <ul className="petit secondaire" style={{ marginTop: 6, paddingLeft: 4 }}>
                {v.lignes.map((l, i) => (
                  <li key={i} className="flex-entre" style={{ padding: '2px 0' }}>
                    <span>{nombre(l.quantite)} × {l.produit}</span>
                    <span className="tabulaire">{ariary(l.netAr)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Carte>
  );
}
