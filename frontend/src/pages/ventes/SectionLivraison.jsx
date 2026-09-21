import { useCallback, useState } from 'react';
import { Truck, Pencil, Trash2, Ban, CheckCircle2, Phone, MapPin, User } from 'lucide-react';
import { Livraisons, Clients, messageErreur } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, dateHeure, SUIVANT_LIVRAISON } from '../../lib/format.js';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { BadgeStatutLivraison } from '../../components/ui/Badge.jsx';
import { Confirmation } from '../../components/ui/Modale.jsx';
import { EtatVide } from '../../components/ui/Divers.jsx';
import { FormulaireLivraison } from './FormulaireLivraison.jsx';

/** Livraison d'une vente : étapes, coordonnées, avancement du statut. */
export function SectionLivraison({ vente, recharger }) {
  const { notifier } = useToast();
  const chargerClients = useCallback(() => Clients.lister(), []);
  const { donnees: clients } = useApi(chargerClients);
  const [formulaire, setFormulaire] = useState(false);
  const [confirmation, setConfirmation] = useState(null); // 'annuler' | 'supprimer'
  const [enCours, setEnCours] = useState(false);

  const l = vente.livraison;
  const suivant = l ? SUIVANT_LIVRAISON[l.statut] : null;

  const agir = async (action, message) => {
    setEnCours(true);
    try {
      await action();
      notifier(message);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnCours(false);
      setConfirmation(null);
    }
  };

  return (
    <>
      <Carte
        titre="Livraison"
        actions={
          l && (
            <div className="flex" style={{ flexWrap: 'wrap' }}>
              <BadgeStatutLivraison statut={l.statut} />
              {suivant && (
                <Bouton variante="principal" taille="petit" icone={CheckCircle2} chargement={enCours} onClick={() => agir(() => Livraisons.changerStatut(l.id, suivant.statut), 'Livraison mise à jour')}>
                  {suivant.libelle}
                </Bouton>
              )}
              <Bouton taille="petit" icone={Pencil} onClick={() => setFormulaire(true)} aria-label="Modifier la livraison" />
              {l.statut !== 'annulee' && l.statut !== 'livree' && (
                <Bouton taille="petit" icone={Ban} onClick={() => setConfirmation('annuler')} aria-label="Annuler la livraison" title="Annuler la livraison" />
              )}
              <Bouton variante="danger" taille="petit" icone={Trash2} onClick={() => setConfirmation('supprimer')} aria-label="Supprimer la livraison" />
            </div>
          )
        }
      >
        {!l ? (
          <EtatVide
            icone={Truck}
            titre="Pas de livraison"
            description={vente.client ? `Programmez la livraison pour ${vente.client.nom}.` : 'Programmez une livraison, avec ou sans client enregistré.'}
            action={<Bouton variante="principal" icone={Truck} onClick={() => setFormulaire(true)}>Programmer une livraison</Bouton>}
          />
        ) : (
          <div className="colonne" style={{ gap: 16 }}>
            <div className="etapes">
              <div className={`etape ${l.statut !== 'a_programmer' && l.statut !== 'annulee' ? 'etape--faite' : ''}`}>
                <div className="etape__libelle">Appel des livreurs</div>
                <div className="etape__valeur">{dateHeure(l.dateHeureAppelLivreur)}</div>
              </div>
              <div className={`etape ${['en_cours', 'livree'].includes(l.statut) ? 'etape--faite' : ''}`}>
                <div className="etape__libelle">Livraison prévue</div>
                <div className="etape__valeur">{dateHeure(l.dateHeureLivraison)}</div>
              </div>
              <div className={`etape ${l.statut === 'livree' ? 'etape--faite' : ''}`}>
                <div className="etape__libelle">Livrée le</div>
                <div className="etape__valeur">{dateHeure(l.dateHeureLivree)}</div>
              </div>
            </div>
            <dl className="definitions">
              <dt><User size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Client</dt>
              <dd>{vente.client?.nom || clients?.find((c) => c.id === l.idClient)?.nom || 'Anonyme'}</dd>
              <dt><MapPin size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Adresse</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{l.adresse || '—'}</dd>
              <dt><Phone size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Téléphone</dt>
              <dd>{l.telephone ? <a href={`tel:${l.telephone}`}>{l.telephone}</a> : '—'}</dd>
              <dt>Livreur</dt>
              <dd>{l.livreur || '—'}</dd>
              <dt>Frais de livraison</dt>
              <dd>{ariary(l.fraisAr)}</dd>
              {l.note && (
                <>
                  <dt>Note</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{l.note}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </Carte>

      <FormulaireLivraison
        ouvert={formulaire}
        livraison={l}
        vente={vente}
        clients={clients ?? []}
        onFermer={() => setFormulaire(false)}
        onEnregistre={() => {
          setFormulaire(false);
          notifier('Livraison enregistrée');
          recharger();
        }}
      />
      <Confirmation
        ouverte={confirmation === 'annuler'}
        titre="Annuler la livraison ?"
        message="La livraison passe au statut « Annulée ». Vous pourrez la reprogrammer en la modifiant."
        libelleConfirmer="Annuler la livraison"
        ton="danger"
        chargement={enCours}
        onConfirmer={() => agir(() => Livraisons.changerStatut(l.id, 'annulee'), 'Livraison annulée')}
        onAnnuler={() => setConfirmation(null)}
      />
      <Confirmation
        ouverte={confirmation === 'supprimer'}
        titre="Supprimer la livraison ?"
        message="La vente est conservée, seule la livraison est supprimée."
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={enCours}
        onConfirmer={() => agir(() => Livraisons.supprimer(l.id), 'Livraison supprimée')}
        onAnnuler={() => setConfirmation(null)}
      />
    </>
  );
}
