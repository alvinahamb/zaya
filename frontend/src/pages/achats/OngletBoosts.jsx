import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Rocket } from 'lucide-react';
import { Boosts, Frais, Reseaux, messageErreur } from '../../services/api.js';
import { useApi, useFormulaire } from '../../lib/hooks.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { ariary, dateCourte, versInputDate, aujourdhuiISO } from '../../lib/format.js';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modale, Confirmation } from '../../components/ui/Modale.jsx';
import { Champ, Saisie, SaisieMontant, Selection, ZoneTexte } from '../../components/ui/Champs.jsx';
import { EtatVide, Encart } from '../../components/ui/Divers.jsx';
import { Montant } from '../../components/ui/Montant.jsx';
import { FormulaireFrais } from './OngletFrais.jsx';

function FormulaireBoost({ ouvert, boost, idAchat, reseaux, onFermer, onEnregistre }) {
  const f = useFormulaire({ nom: '', idReseau: '', dateBoost: aujourdhuiISO(), montantAr: '', raison: '' });

  useEffect(() => {
    if (ouvert) {
      f.reinitialiser(
        boost
          ? { nom: boost.nom ?? '', idReseau: String(boost.idReseau), dateBoost: versInputDate(boost.dateBoost), montantAr: boost.montantAr ?? '', raison: boost.raison ?? '' }
          : { nom: '', idReseau: reseaux[0] ? String(reseaux[0].id) : '', dateBoost: aujourdhuiISO(), montantAr: '', raison: '' },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, boost?.id]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() =>
      boost ? Boosts.modifier(boost.id, f.valeurs) : Boosts.creer({ ...f.valeurs, idAchat }),
    );
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={boost ? 'Modifier le boost' : 'Nouveau boost'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-boost" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-boost" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Nom">
          {(id) => <Saisie id={id} name="nom" autoFocus value={f.valeurs.nom} onChange={f.surChangement} placeholder="Ex. Boost lancement" />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Réseau social" requis>
            {(id) => (
              <Selection id={id} name="idReseau" required value={f.valeurs.idReseau} onChange={f.surChangement} placeholder="Choisir" options={reseaux.map((r) => ({ valeur: String(r.id), libelle: r.nom }))} />
            )}
          </Champ>
          <Champ libelle="Date">
            {(id) => <Saisie id={id} name="dateBoost" type="date" value={f.valeurs.dateBoost} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Montant (Ar)" requis>
            {(id) => <SaisieMontant id={id} name="montantAr" suffixe="Ar" required value={f.valeurs.montantAr} onChange={f.surChangement} />}
          </Champ>
        </div>
        <Champ libelle="Raison" aide="Objectif du boost">
          {(id) => <ZoneTexte id={id} name="raison" rows={2} value={f.valeurs.raison} onChange={f.surChangement} />}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}

export function OngletBoosts({ achat, recharger }) {
  const { notifier } = useToast();
  const chargerReseaux = useCallback(() => Reseaux.lister(), []);
  const { donnees: reseaux } = useApi(chargerReseaux);
  const [formulaire, setFormulaire] = useState(null);
  const [formulaireFrais, setFormulaireFrais] = useState(null); // { idBoost, frais? }
  const [aSupprimer, setASupprimer] = useState(null); // { type: 'boost' | 'frais', element }
  const [suppression, setSuppression] = useState(false);

  const total = achat.recap.sommeBoosts;

  const supprimer = async () => {
    setSuppression(true);
    try {
      if (aSupprimer.type === 'boost') await Boosts.supprimer(aSupprimer.element.id);
      else await Frais.supprimer(aSupprimer.element.id);
      notifier(aSupprimer.type === 'boost' ? 'Boost supprimé' : 'Frais supprimé');
      setASupprimer(null);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setSuppression(false);
    }
  };

  return (
    <>
      <Carte
        titre="Boosts"
        actions={
          <>
            <span className="petit secondaire">Total boosts + frais : <strong className="tabulaire">{ariary(total)}</strong></span>
            <Bouton variante="principal" taille="petit" icone={Plus} onClick={() => setFormulaire({})} disabled={!reseaux?.length} title={!reseaux?.length ? 'Créez d’abord un réseau social dans les paramètres' : undefined}>
              Ajouter
            </Bouton>
          </>
        }
        nu
      >
        {achat.boosts.length === 0 ? (
          <EtatVide icone={Rocket} titre="Aucun boost" description="Les promotions payantes de cette commande apparaîtront ici avec leurs frais." />
        ) : (
          achat.boosts.map((b) => {
            const totalFrais = b.Frais.reduce((s, x) => s + Number(x.montantAr), 0);
            return (
              <div key={b.id} className="boost">
                <div className="element">
                  <div className="element__corps">
                    <div className="flex" style={{ flexWrap: 'wrap' }}>
                      <span className="element__titre">{b.nom || 'Boost'}</span>
                      <Badge ton="info">{b.Reseau?.nom}</Badge>
                    </div>
                    <div className="element__meta">
                      {dateCourte(b.dateBoost)}
                      {b.raison && ` · ${b.raison}`}
                    </div>
                  </div>
                  <Montant valeur={b.montantAr} className="gras" />
                  <div className="element__actions">
                    <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaire({ boost: b })} aria-label="Modifier le boost" />
                    <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer({ type: 'boost', element: b })} aria-label="Supprimer le boost" />
                  </div>
                </div>
                <div className="boost__frais">
                  <div className="flex-entre">
                    <span className="petit gras">Frais du boost{b.Frais.length ? ` · ${ariary(totalFrais)}` : ''}</span>
                    <Bouton variante="discret" taille="petit" icone={Plus} onClick={() => setFormulaireFrais({ idBoost: b.id })}>Frais</Bouton>
                  </div>
                  {b.Frais.map((x) => (
                    <div key={x.id} className="element petit">
                      <div className="element__corps">
                        {x.libelle || 'Frais'} <span className="secondaire">· {dateCourte(x.dateFrais)}</span>
                      </div>
                      <Montant valeur={x.montantAr} />
                      <div className="element__actions">
                        <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaireFrais({ idBoost: b.id, frais: x })} aria-label="Modifier le frais" />
                        <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer({ type: 'frais', element: x })} aria-label="Supprimer le frais" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </Carte>

      <FormulaireBoost
        ouvert={formulaire !== null}
        boost={formulaire?.boost}
        idAchat={achat.id}
        reseaux={reseaux ?? []}
        onFermer={() => setFormulaire(null)}
        onEnregistre={() => {
          setFormulaire(null);
          notifier('Boost enregistré');
          recharger();
        }}
      />
      <FormulaireFrais
        ouvert={formulaireFrais !== null}
        frais={formulaireFrais?.frais}
        cible={{ idBoost: formulaireFrais?.idBoost }}
        onFermer={() => setFormulaireFrais(null)}
        onEnregistre={() => {
          setFormulaireFrais(null);
          notifier('Frais enregistré');
          recharger();
        }}
      />
      <Confirmation
        ouverte={aSupprimer !== null}
        titre={aSupprimer?.type === 'boost' ? 'Supprimer ce boost ?' : 'Supprimer ce frais ?'}
        message={aSupprimer?.type === 'boost' ? 'Le boost et ses frais seront supprimés.' : 'Ce frais sera retiré du boost.'}
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppression}
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}
