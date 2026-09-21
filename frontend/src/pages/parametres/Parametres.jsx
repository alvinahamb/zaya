import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Tags, Share2, Users, KeyRound, UserX, UserCheck, ExternalLink, Contact, Search, Phone } from 'lucide-react';
import { Categories, Reseaux, Utilisateurs, Clients, messageErreur } from '../../services/api.js';
import { useApi, useFormulaire } from '../../lib/hooks.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { dateCourte, nombre } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modale, Confirmation } from '../../components/ui/Modale.jsx';
import { Champ, Saisie } from '../../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide } from '../../components/ui/Divers.jsx';
import { FormulaireClient } from './FormulaireClient.jsx';

const SECTIONS = [
  { cle: 'clients', libelle: 'Clients', icone: Contact },
  { cle: 'categories', libelle: 'Catégories', icone: Tags },
  { cle: 'reseaux', libelle: 'Réseaux sociaux', icone: Share2 },
  { cle: 'utilisateurs', libelle: 'Comptes utilisateurs', icone: Users },
];

/** Modale générique nom (+ champs optionnels) pour les tables de référence. */
function FormulaireReference({ ouvert, element, titre, champs, api, onFermer, onEnregistre }) {
  const initial = () => Object.fromEntries(champs.map((c) => [c.nom, element?.[c.nom] ?? '']));
  const f = useFormulaire(initial());
  useEffect(() => {
    if (ouvert) f.reinitialiser(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, element?.id]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() => (element ? api.modifier(element.id, f.valeurs) : api.creer(f.valeurs)));
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={titre}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-reference" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-reference" className="formulaire" onSubmit={soumettre} noValidate>
        {champs.map((c, i) => (
          <Champ key={c.nom} libelle={c.libelle} requis={c.requis} aide={c.aide}>
            {(id) => <Saisie id={id} name={c.nom} type={c.type ?? 'text'} required={c.requis} autoFocus={i === 0} value={f.valeurs[c.nom]} onChange={f.surChangement} placeholder={c.placeholder} />}
          </Champ>
        ))}
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}

function SectionReference({ api, champs, libelleSingulier, libellePluriel, compte, icone: Icone, lienChamp }) {
  const { notifier } = useToast();
  const charger = useCallback(() => api.lister(), [api]);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const supprimer = async () => {
    setSuppression(true);
    try {
      await api.supprimer(aSupprimer.id);
      notifier(`${libelleSingulier} supprimé${libelleSingulier.endsWith('e') ? 'e' : ''}`);
      setASupprimer(null);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
      setASupprimer(null);
    } finally {
      setSuppression(false);
    }
  };

  return (
    <>
      <Carte titre={libellePluriel} actions={<Bouton variante="principal" taille="petit" icone={Plus} onClick={() => setFormulaire({})}>Ajouter</Bouton>} nu>
        {erreur && <Encart ton="erreur">{erreur}</Encart>}
        {chargement && !donnees ? (
          <Chargement />
        ) : donnees?.length === 0 ? (
          <EtatVide icone={Icone} titre={`Aucun${libelleSingulier.endsWith('e') ? 'e' : ''} ${libelleSingulier.toLowerCase()}`} action={<Bouton variante="principal" icone={Plus} onClick={() => setFormulaire({})}>Ajouter</Bouton>} />
        ) : (
          <div className="liste-elements">
            {donnees?.map((x) => (
              <div key={x.id} className="element">
                <div className="element__corps">
                  <div className="element__titre">{x.nom}</div>
                  <div className="element__meta flex" style={{ gap: 10, flexWrap: 'wrap' }}>
                    {compte(x)}
                    {lienChamp && x[lienChamp] && (
                      <a href={x[lienChamp]} target="_blank" rel="noreferrer" className="lien-icone">
                        <ExternalLink size={13} aria-hidden="true" />
                        Compte
                      </a>
                    )}
                  </div>
                </div>
                <div className="element__actions">
                  <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaire({ element: x })} aria-label={`Modifier ${x.nom}`} />
                  <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer(x)} aria-label={`Supprimer ${x.nom}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>
      <FormulaireReference
        ouvert={formulaire !== null}
        element={formulaire?.element}
        titre={formulaire?.element ? `Modifier ${formulaire.element.nom}` : `Nouveau ${libelleSingulier.toLowerCase()}`}
        champs={champs}
        api={api}
        onFermer={() => setFormulaire(null)}
        onEnregistre={() => {
          setFormulaire(null);
          notifier('Enregistré');
          recharger();
        }}
      />
      <Confirmation
        ouverte={aSupprimer !== null}
        titre={`Supprimer « ${aSupprimer?.nom} » ?`}
        message="Impossible si des éléments y sont rattachés."
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppression}
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}

function SectionClients({ rechercheInitiale = '' }) {
  const { notifier } = useToast();
  const charger = useCallback(() => Clients.lister(), []);
  const chargerReseaux = useCallback(() => Reseaux.lister(), []);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  const { donnees: reseaux } = useApi(chargerReseaux);
  const [recherche, setRecherche] = useState(rechercheInitiale);
  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (donnees ?? []).filter((c) => !q || c.nom.toLowerCase().includes(q) || (c.telephone ?? '').includes(q));
  }, [donnees, recherche]);

  const supprimer = async () => {
    setSuppression(true);
    try {
      await Clients.supprimer(aSupprimer.id);
      notifier('Client supprimé');
      setASupprimer(null);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
      setASupprimer(null);
    } finally {
      setSuppression(false);
    }
  };

  return (
    <>
      <div className="outils">
        <div className="outils__recherche">
          <Search size={18} aria-hidden="true" />
          <Saisie type="search" placeholder="Nom ou téléphone" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher un client" />
        </div>
        <Bouton variante="principal" icone={Plus} onClick={() => setFormulaire({})}>Nouveau client</Bouton>
      </div>
      <Carte titre={`Clients${donnees ? ` (${donnees.length})` : ''}`} nu>
        {erreur && <Encart ton="erreur">{erreur}</Encart>}
        {chargement && !donnees ? (
          <Chargement />
        ) : filtres.length === 0 ? (
          <EtatVide icone={Contact} titre={donnees?.length ? 'Aucun client ne correspond' : 'Aucun client'} description={donnees?.length ? undefined : 'Enregistrez vos clients pour leur rattacher ventes et livraisons.'} action={!donnees?.length && <Bouton variante="principal" icone={Plus} onClick={() => setFormulaire({})}>Nouveau client</Bouton>} />
        ) : (
          <div className="liste-elements">
            {filtres.map((c) => (
              <div key={c.id} className="element">
                <span className="avatar">{c.nom.slice(0, 2).toUpperCase()}</span>
                <div className="element__corps">
                  <div className="flex" style={{ flexWrap: 'wrap' }}>
                    <span className="element__titre">{c.nom}</span>
                    {(c.reseaux ?? []).map((r) => <Badge key={r.id} ton="info">{r.nom}</Badge>)}
                  </div>
                  <div className="element__meta">
                    {c.telephone && (
                      <a href={`tel:${c.telephone}`} className="lien-icone"><Phone size={13} aria-hidden="true" />{c.telephone}</a>
                    )}
                    {c.telephone && c.adresse && ' · '}
                    {c.adresse}
                    {(c.telephone || c.adresse) && ' · '}
                    {nombre(c._count?.Vente ?? 0)} vente{(c._count?.Vente ?? 0) > 1 ? 's' : ''} · client depuis le {dateCourte(c.dateCreation)}
                  </div>
                </div>
                <div className="element__actions">
                  <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => setFormulaire({ client: c })} aria-label={`Modifier ${c.nom}`} />
                  <Bouton variante="discret" taille="petit" icone={Trash2} onClick={() => setASupprimer(c)} aria-label={`Supprimer ${c.nom}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>
      <FormulaireClient
        ouvert={formulaire !== null}
        client={formulaire?.client}
        reseaux={reseaux ?? []}
        onFermer={() => setFormulaire(null)}
        onEnregistre={() => {
          setFormulaire(null);
          notifier('Client enregistré');
          recharger();
        }}
      />
      <Confirmation
        ouverte={aSupprimer !== null}
        titre={`Supprimer « ${aSupprimer?.nom} » ?`}
        message="Impossible si des ventes lui sont rattachées."
        libelleConfirmer="Supprimer"
        ton="danger"
        chargement={suppression}
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}

function SectionUtilisateurs() {
  const { notifier } = useToast();
  const { utilisateur: moi } = useAuth();
  const charger = useCallback(() => Utilisateurs.lister(), []);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  const [creation, setCreation] = useState(false);
  const [motDePassePour, setMotDePassePour] = useState(null);
  const [aBasculer, setABasculer] = useState(null);
  const [bascule, setBascule] = useState(false);
  const fCreation = useFormulaire({ nom: '', email: '', motDePasse: '' });
  const fMotDePasse = useFormulaire({ motDePasse: '' });

  const creer = async (e) => {
    e.preventDefault();
    const r = await fCreation.soumettre(() => Utilisateurs.creer(fCreation.valeurs));
    if (r) {
      setCreation(false);
      fCreation.reinitialiser({ nom: '', email: '', motDePasse: '' });
      notifier('Compte créé');
      recharger();
    }
  };

  const changerMotDePasse = async (e) => {
    e.preventDefault();
    const r = await fMotDePasse.soumettre(() => Utilisateurs.modifier(motDePassePour.id, { motDePasse: fMotDePasse.valeurs.motDePasse }));
    if (r) {
      setMotDePassePour(null);
      fMotDePasse.reinitialiser({ motDePasse: '' });
      notifier('Mot de passe modifié');
    }
  };

  const basculer = async () => {
    setBascule(true);
    try {
      await Utilisateurs.modifier(aBasculer.id, { actif: !aBasculer.actif });
      notifier(aBasculer.actif ? 'Compte désactivé' : 'Compte réactivé');
      setABasculer(null);
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
      setABasculer(null);
    } finally {
      setBascule(false);
    }
  };

  return (
    <>
      <Carte titre="Comptes utilisateurs" actions={<Bouton variante="principal" taille="petit" icone={Plus} onClick={() => setCreation(true)}>Créer un compte</Bouton>} nu>
        {erreur && <Encart ton="erreur">{erreur}</Encart>}
        {chargement && !donnees ? (
          <Chargement />
        ) : (
          <div className="liste-elements">
            {donnees?.map((u) => (
              <div key={u.id} className="element">
                <span className="avatar">{(u.nom || u.email).slice(0, 2).toUpperCase()}</span>
                <div className="element__corps">
                  <div className="flex" style={{ flexWrap: 'wrap' }}>
                    <span className="element__titre">{u.nom || u.email}</span>
                    {u.id === moi?.id && <Badge ton="principal">Vous</Badge>}
                    {u.actif ? <Badge ton="succes">Actif</Badge> : <Badge ton="danger">Désactivé</Badge>}
                  </div>
                  <div className="element__meta">{u.email} · créé le {dateCourte(u.dateCreation)}</div>
                </div>
                <div className="element__actions">
                  <Bouton variante="discret" taille="petit" icone={KeyRound} onClick={() => setMotDePassePour(u)} aria-label={`Changer le mot de passe de ${u.email}`} title="Changer le mot de passe" />
                  {u.id !== moi?.id && (
                    <Bouton variante="discret" taille="petit" icone={u.actif ? UserX : UserCheck} onClick={() => setABasculer(u)} aria-label={u.actif ? `Désactiver ${u.email}` : `Réactiver ${u.email}`} title={u.actif ? 'Désactiver' : 'Réactiver'} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      <Modale
        ouverte={creation}
        titre="Créer un compte"
        onFermer={() => setCreation(false)}
        pied={
          <>
            <Bouton onClick={() => setCreation(false)} disabled={fCreation.envoi}>Annuler</Bouton>
            <Bouton variante="principal" type="submit" form="formulaire-utilisateur" chargement={fCreation.envoi}>Créer</Bouton>
          </>
        }
      >
        <form id="formulaire-utilisateur" className="formulaire" onSubmit={creer} noValidate>
          <Champ libelle="Nom">{(id) => <Saisie id={id} name="nom" autoFocus value={fCreation.valeurs.nom} onChange={fCreation.surChangement} />}</Champ>
          <Champ libelle="Email" requis>{(id) => <Saisie id={id} name="email" type="email" required autoComplete="off" value={fCreation.valeurs.email} onChange={fCreation.surChangement} />}</Champ>
          <Champ libelle="Mot de passe" requis aide="8 caractères minimum">{(id) => <Saisie id={id} name="motDePasse" type="password" required autoComplete="new-password" value={fCreation.valeurs.motDePasse} onChange={fCreation.surChangement} />}</Champ>
          {fCreation.erreur && <Encart ton="erreur">{fCreation.erreur}</Encart>}
        </form>
      </Modale>

      <Modale
        ouverte={motDePassePour !== null}
        titre={`Nouveau mot de passe pour ${motDePassePour?.email ?? ''}`}
        onFermer={() => setMotDePassePour(null)}
        pied={
          <>
            <Bouton onClick={() => setMotDePassePour(null)} disabled={fMotDePasse.envoi}>Annuler</Bouton>
            <Bouton variante="principal" type="submit" form="formulaire-mot-de-passe" chargement={fMotDePasse.envoi}>Enregistrer</Bouton>
          </>
        }
      >
        <form id="formulaire-mot-de-passe" className="formulaire" onSubmit={changerMotDePasse} noValidate>
          <Champ libelle="Mot de passe" requis aide="8 caractères minimum">{(id) => <Saisie id={id} name="motDePasse" type="password" required autoFocus autoComplete="new-password" value={fMotDePasse.valeurs.motDePasse} onChange={fMotDePasse.surChangement} />}</Champ>
          {fMotDePasse.erreur && <Encart ton="erreur">{fMotDePasse.erreur}</Encart>}
        </form>
      </Modale>

      <Confirmation
        ouverte={aBasculer !== null}
        titre={aBasculer?.actif ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'}
        message={aBasculer?.actif ? `${aBasculer.email} ne pourra plus se connecter.` : `${aBasculer?.email} pourra de nouveau se connecter.`}
        libelleConfirmer={aBasculer?.actif ? 'Désactiver' : 'Réactiver'}
        ton={aBasculer?.actif ? 'danger' : 'principal'}
        chargement={bascule}
        onConfirmer={basculer}
        onAnnuler={() => setABasculer(null)}
      />
    </>
  );
}

export function Parametres() {
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((s) => s.cle === params.get('section')) ? params.get('section') : 'clients';

  return (
    <Page titre="Paramètres">
      <div className="parametres">
        <nav className="menu-lateral" aria-label="Sections">
          {SECTIONS.map((s) => (
            <button key={s.cle} type="button" className="menu-lateral__lien" aria-current={section === s.cle} onClick={() => setParams({ section: s.cle }, { replace: true })}>
              <s.icone size={18} aria-hidden="true" />
              {s.libelle}
            </button>
          ))}
        </nav>
        <div>
          {section === 'clients' && <SectionClients rechercheInitiale={params.get('q') ?? ''} />}
          {section === 'categories' && (
            <SectionReference
              api={Categories}
              icone={Tags}
              libelleSingulier="Catégorie"
              libellePluriel="Catégories de produits"
              champs={[{ nom: 'nom', libelle: 'Nom', requis: true, placeholder: 'Ex. Bijoux' }]}
              compte={(c) => <span>{nombre(c._count?.Produit ?? 0)} produit{(c._count?.Produit ?? 0) > 1 ? 's' : ''}</span>}
            />
          )}
          {section === 'reseaux' && (
            <SectionReference
              api={Reseaux}
              icone={Share2}
              libelleSingulier="Réseau"
              libellePluriel="Réseaux sociaux"
              champs={[
                { nom: 'nom', libelle: 'Nom', requis: true, placeholder: 'Ex. Instagram' },
                { nom: 'lienCompte', libelle: 'Lien du compte', type: 'url', placeholder: 'https://…' },
              ]}
              lienChamp="lienCompte"
              compte={(r) => <span>{nombre(r._count?.Vente ?? 0)} vente{(r._count?.Vente ?? 0) > 1 ? 's' : ''} · {nombre(r._count?.PublicationReseau ?? 0)} publication{(r._count?.PublicationReseau ?? 0) > 1 ? 's' : ''} · {nombre(r._count?.Client ?? 0)} client{(r._count?.Client ?? 0) > 1 ? 's' : ''}</span>}
            />
          )}
          {section === 'utilisateurs' && <SectionUtilisateurs />}
        </div>
      </div>
    </Page>
  );
}
