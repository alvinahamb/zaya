import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, CheckCircle2, ArrowRight } from 'lucide-react';
import { Livraisons, Clients, messageErreur } from '../../services/api.js';
import { useApi } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, dateHeure, dateCourte, versInputDateHeure, LIBELLES_STATUT_LIVRAISON, SUIVANT_LIVRAISON } from '../../lib/format.js';
import { nombreCsv, dateCsv, codeCsv, idParNom } from '../../lib/csv.js';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton, BoutonLien } from '../../components/ui/Bouton.jsx';
import { BadgeStatutLivraison } from '../../components/ui/Badge.jsx';
import { Selection } from '../../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide, BoutonsCsv } from '../../components/ui/Divers.jsx';

const FILTRES = [{ valeur: 'actives', libelle: 'En cours (à programmer, programmées, en livraison)' }].concat(
  Object.entries(LIBELLES_STATUT_LIVRAISON).map(([valeur, libelle]) => ({ valeur, libelle })),
);

const dateHeureCsv = (iso) => versInputDateHeure(iso).replace('T', ' ');

const COLONNES_CSV = [
  { cle: 'idVente', titre: 'N° vente', valeur: (l) => l.Vente?.id },
  { cle: 'client', titre: 'Client', valeur: (l) => l.Client?.nom },
  { cle: 'statut', titre: 'Statut', valeur: (l) => LIBELLES_STATUT_LIVRAISON[l.statut] },
  { cle: 'libelle', titre: 'Libellé' },
  { cle: 'adresse', titre: 'Adresse' },
  { cle: 'telephone', titre: 'Téléphone' },
  { cle: 'livreur', titre: 'Livreur' },
  { cle: 'fraisAr', titre: 'Frais (Ar)' },
  { cle: 'dateHeureAppelLivreur', titre: 'Appel livreur', valeur: (l) => dateHeureCsv(l.dateHeureAppelLivreur) },
  { cle: 'dateHeureLivraison', titre: 'Livraison prévue', valeur: (l) => dateHeureCsv(l.dateHeureLivraison) },
  { cle: 'note', titre: 'Note' },
];

/** Toutes les livraisons, avec avancement du statut en un clic. */
export function OngletLivraisons() {
  const { notifier } = useToast();
  const [filtre, setFiltre] = useState('actives');
  const charger = useCallback(() => Livraisons.lister(filtre === 'actives' ? {} : { statut: filtre }), [filtre]);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  const [enCours, setEnCours] = useState(null);
  const chargerClients = useCallback(() => Clients.lister(), []);
  const { donnees: clients } = useApi(chargerClients);

  const importer = (r) =>
    Livraisons.creer({
      libelle: r.libelle,
      adresse: r.adresse,
      telephone: r.telephone,
      livreur: r.livreur,
      note: r.note,
      idVente: nombreCsv(r.idVente),
      idClient: idParNom(r.client, clients, 'Client'),
      statut: codeCsv(r.statut, LIBELLES_STATUT_LIVRAISON),
      fraisAr: nombreCsv(r.fraisAr),
      dateHeureAppelLivreur: dateCsv(r.dateHeureAppelLivreur),
      dateHeureLivraison: dateCsv(r.dateHeureLivraison),
    });

  const liste = (donnees ?? []).filter((l) => filtre !== 'actives' || ['a_programmer', 'programmee', 'en_cours'].includes(l.statut));

  const avancer = async (l) => {
    const suivant = SUIVANT_LIVRAISON[l.statut];
    if (!suivant) return;
    setEnCours(l.id);
    try {
      await Livraisons.changerStatut(l.id, suivant.statut);
      notifier('Livraison mise à jour');
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnCours(null);
    }
  };

  return (
    <>
      <div className="outils">
        <Selection value={filtre} onChange={(e) => setFiltre(e.target.value)} options={FILTRES} aria-label="Filtrer par statut" />
        <div className="pousser">
          <BoutonsCsv nomFichier="livraisons" colonnes={COLONNES_CSV} lignes={liste} importer={importer} onImporte={recharger} />
        </div>
      </div>
      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      <Carte nu>
        {chargement && !donnees ? (
          <Chargement />
        ) : liste.length === 0 ? (
          <EtatVide icone={Truck} titre="Aucune livraison" description="Les livraisons se programment depuis la fiche d'une vente." />
        ) : (
          <div className="liste-cartes">
            {liste.map((l) => {
              const suivant = SUIVANT_LIVRAISON[l.statut];
              const qui = l.Client?.nom || l.Vente.nom || `Vente n° ${l.Vente.id}`;
              return (
                <div key={l.id} className="carte-ligne" style={{ cursor: 'default' }}>
                  <div className="carte-ligne__entete">
                    <div style={{ minWidth: 0 }}>
                      <div className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <span className="carte-ligne__titre">{qui}</span>
                        <BadgeStatutLivraison statut={l.statut} />
                      </div>
                      <div className="carte-ligne__sous">
                        {l.adresse && <span>{l.adresse} · </span>}
                        {l.statut === 'a_programmer' && l.dateHeureAppelLivreur && `appeler le ${dateHeure(l.dateHeureAppelLivreur)}`}
                        {l.statut !== 'a_programmer' && l.dateHeureLivraison && `livraison ${l.statut === 'livree' ? 'le' : 'prévue le'} ${dateHeure(l.statut === 'livree' ? l.dateHeureLivree : l.dateHeureLivraison)}`}
                        {l.livreur && ` · ${l.livreur}`}
                      </div>
                      <div className="carte-ligne__sous">
                        <Link to={`/ventes/${l.Vente.id}`}>Vente du {dateCourte(l.Vente.dateVente)}</Link> · {ariary(l.Vente.sommeAr)}
                        {Number(l.fraisAr) > 0 && ` · frais ${ariary(l.fraisAr)}`}
                      </div>
                    </div>
                    <div className="carte-ligne__droite">
                      {suivant && (
                        <Bouton variante="principal" taille="petit" icone={CheckCircle2} chargement={enCours === l.id} onClick={() => avancer(l)}>
                          {suivant.libelle}
                        </Bouton>
                      )}
                      <BoutonLien variante="discret" taille="petit" icone={ArrowRight} to={`/ventes/${l.Vente.id}`} aria-label="Ouvrir la vente" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Carte>
    </>
  );
}
