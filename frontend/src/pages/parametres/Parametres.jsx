import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Tags, Share2, Users, KeyRound, UserX, UserCheck, ExternalLink, Contact, Phone, Smartphone, Copy, RefreshCw } from 'lucide-react';
import { Categories, Reseaux, Utilisateurs, Clients, Rappels, urlApi, messageErreur } from '../../services/api.js';
import { useApi, useFormulaire, useMediaQuery, REQUETE_MOBILE } from '../../lib/hooks.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { dateCourte, nombre } from '../../lib/format.js';
import { Page } from '../../components/layout/Page.jsx';
import { Carte } from '../../components/ui/Carte.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modale, Confirmation } from '../../components/ui/Modale.jsx';
import { Champ, Saisie } from '../../components/ui/Champs.jsx';
import { RechercheListe } from '../../components/ui/RechercheListe.jsx';
import { Chargement, Encart, EtatVide, BoutonsCsv } from '../../components/ui/Divers.jsx';
import { idsParNoms } from '../../lib/csv.js';
import { FormulaireClient } from './FormulaireClient.jsx';

const SECTIONS = [
  { cle: 'clients', libelle: 'Clients', icone: Contact },
  { cle: 'categories', libelle: 'Catégories', icone: Tags },
  { cle: 'reseaux', libelle: 'Réseaux sociaux', icone: Share2 },
  { cle: 'utilisateurs', libelle: 'Comptes utilisateurs', icone: Users },
  { cle: 'rappels', libelle: 'Rappels iPhone', icone: Smartphone },
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

function SectionReference({ api, champs, libelleSingulier, libellePluriel, compte, icone: Icone, lienChamp, nomFichier }) {
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
      <Carte
        titre={libellePluriel}
        actions={
          <span className="flex" style={{ gap: 4 }}>
            <BoutonsCsv
              nomFichier={nomFichier}
              colonnes={champs.map((c) => ({ cle: c.nom, titre: c.libelle }))}
              lignes={donnees}
              importer={(r) => api.creer(r)}
              onImporte={recharger}
            />
            <Bouton variante="principal" taille="petit" icone={Plus} compact onClick={() => setFormulaire({})}>Ajouter</Bouton>
          </span>
        }
        nu
      >
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

const COLONNES_CSV_CLIENTS = [
  { cle: 'nom', titre: 'Nom' },
  { cle: 'telephone', titre: 'Téléphone' },
  { cle: 'adresse', titre: 'Adresse' },
  { cle: 'reseaux', titre: 'Réseaux', valeur: (c) => (c.reseaux ?? []).map((r) => r.nom).join(', ') },
  { cle: 'note', titre: 'Note' },
];

const COLONNES_CSV_UTILISATEURS = [
  { cle: 'nom', titre: 'Nom' },
  { cle: 'email', titre: 'Email' },
  { cle: 'actif', titre: 'Actif', valeur: (u) => (u.actif ? 'oui' : 'non') },
  { cle: 'dateCreation', titre: 'Créé le', valeur: (u) => String(u.dateCreation ?? '').slice(0, 10) },
];

function SectionClients({ rechercheInitiale = '' }) {
  const { notifier } = useToast();
  const mobile = useMediaQuery(REQUETE_MOBILE);
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
      <Carte
        titre={`Clients${donnees ? ` (${donnees.length})` : ''}`}
        actions={
          <>
            {mobile && <RechercheListe repliable valeur={recherche} onChange={setRecherche} placeholder="Nom ou téléphone" libelle="Rechercher un client" />}
            <BoutonsCsv
              nomFichier="clients"
              colonnes={COLONNES_CSV_CLIENTS}
              lignes={filtres}
              importer={(r) => Clients.creer({ nom: r.nom, telephone: r.telephone, adresse: r.adresse, note: r.note, idReseaux: idsParNoms(r.reseaux, reseaux, 'Réseau') })}
              onImporte={recharger}
            />
            <Bouton variante="principal" taille="petit" icone={Plus} compact onClick={() => setFormulaire({})}>Nouveau client</Bouton>
          </>
        }
        nu
      >
        {!mobile && (
          <div style={{ padding: '12px 20px 0' }}>
            <RechercheListe valeur={recherche} onChange={setRecherche} placeholder="Nom ou téléphone" libelle="Rechercher un client" />
          </div>
        )}
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
  const { utilisateur: moi, setUtilisateur } = useAuth();
  const charger = useCallback(() => Utilisateurs.lister(), []);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  const [creation, setCreation] = useState(false);
  const [motDePassePour, setMotDePassePour] = useState(null);
  const [aModifier, setAModifier] = useState(null);
  const [aBasculer, setABasculer] = useState(null);
  const [bascule, setBascule] = useState(false);
  const fCreation = useFormulaire({ nom: '', email: '', motDePasse: '' });
  const fMotDePasse = useFormulaire({ motDePasse: '' });
  const fCompte = useFormulaire({ nom: '', email: '' });

  const ouvrirModification = (u) => {
    fCompte.reinitialiser({ nom: u.nom ?? '', email: u.email });
    setAModifier(u);
  };

  const modifierCompte = async (e) => {
    e.preventDefault();
    const r = await fCompte.soumettre(() => Utilisateurs.modifier(aModifier.id, fCompte.valeurs));
    if (r) {
      if (r.id === moi?.id) setUtilisateur(r);
      setAModifier(null);
      notifier('Compte modifié');
      recharger();
    }
  };

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
      <Carte
        titre="Comptes utilisateurs"
        actions={
          <span className="flex" style={{ gap: 4 }}>
            <BoutonsCsv nomFichier="comptes" colonnes={COLONNES_CSV_UTILISATEURS} lignes={donnees} />
            <Bouton variante="principal" taille="petit" icone={Plus} compact onClick={() => setCreation(true)}>Créer un compte</Bouton>
          </span>
        }
        nu
      >
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
                  <Bouton variante="discret" taille="petit" icone={Pencil} onClick={() => ouvrirModification(u)} aria-label={`Modifier ${u.email}`} title="Modifier le nom ou l'email" />
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
        ouverte={aModifier !== null}
        titre="Modifier le compte"
        onFermer={() => setAModifier(null)}
        pied={
          <>
            <Bouton onClick={() => setAModifier(null)} disabled={fCompte.envoi}>Annuler</Bouton>
            <Bouton variante="principal" type="submit" form="formulaire-compte" chargement={fCompte.envoi}>Enregistrer</Bouton>
          </>
        }
      >
        <form id="formulaire-compte" className="formulaire" onSubmit={modifierCompte} noValidate>
          <Champ libelle="Nom">{(id) => <Saisie id={id} name="nom" autoFocus value={fCompte.valeurs.nom} onChange={fCompte.surChangement} />}</Champ>
          <Champ libelle="Email" requis>{(id) => <Saisie id={id} name="email" type="email" required autoComplete="off" value={fCompte.valeurs.email} onChange={fCompte.surChangement} />}</Champ>
          {fCompte.erreur && <Encart ton="erreur">{fCompte.erreur}</Encart>}
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

/** Lien lu chaque matin par un raccourci iOS qui crée les tâches du jour dans Rappels. */
function SectionRappels() {
  const { notifier } = useToast();
  const charger = useCallback(() => Rappels.etat(), []);
  const { donnees, chargement, erreur, recharger } = useApi(charger);
  const [lien, setLien] = useState(null);
  const [action, setAction] = useState(null); // 'generer' | 'desactiver' en attente de confirmation
  const [envoi, setEnvoi] = useState(false);

  const executer = async () => {
    setEnvoi(true);
    try {
      if (action === 'generer') {
        const { jeton } = await Rappels.generer();
        setLien(urlApi(`/rappels/aujourdhui?jeton=${jeton}`));
        notifier('Lien généré');
      } else {
        await Rappels.desactiver();
        setLien(null);
        notifier('Lien désactivé');
      }
      recharger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnvoi(false);
      setAction(null);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      notifier('Lien copié');
    } catch {
      notifier('Copie impossible : sélectionnez le lien et copiez-le', 'erreur');
    }
  };

  const actif = donnees?.actif;

  return (
    <>
      <Carte
        titre="Rappels iPhone"
        actions={
          actif && (
            <span className="flex" style={{ gap: 4 }}>
              <Bouton taille="petit" icone={RefreshCw} compact onClick={() => setAction('generer')}>Nouveau lien</Bouton>
              <Bouton variante="danger" taille="petit" icone={Trash2} compact onClick={() => setAction('desactiver')}>Désactiver</Bouton>
            </span>
          )
        }
      >
        {erreur && <Encart ton="erreur">{erreur}</Encart>}
        {chargement && !donnees ? (
          <Chargement />
        ) : (
          <div className="formulaire">
            <p>
              Un raccourci iOS lit chaque matin vos tâches du jour et en retard (contenus à publier, réceptions, livraisons,
              objectifs) et les ajoute à l’app Rappels.
            </p>
            {lien ? (
              <>
                <Champ libelle="Lien du raccourci" aide="Ne sera plus affiché : copiez-le maintenant. Toute personne qui a ce lien voit vos tâches.">
                  {(id) => <Saisie id={id} readOnly value={lien} onFocus={(e) => e.target.select()} />}
                </Champ>
                <div>
                  <Bouton variante="principal" icone={Copy} onClick={copier}>Copier le lien</Bouton>
                </div>
              </>
            ) : actif ? (
              <Encart ton="succes">Un lien est actif. Pour le retrouver, générez-en un nouveau (l’ancien cessera de fonctionner).</Encart>
            ) : (
              <div>
                <Bouton variante="principal" icone={Smartphone} onClick={() => setAction('generer')}>Générer mon lien</Bouton>
              </div>
            )}
            <div>
              <strong>Dans l’app Raccourcis de l’iPhone</strong>
              <ol style={{ margin: '6px 0 0', paddingLeft: 20, lineHeight: 1.6 }}>
                <li>Automatisation → Nouvelle → <em>Heure de la journée</em> (ex. 7:00, tous les jours) → <em>Exécuter immédiatement</em>.</li>
                <li><em>Obtenir le contenu de l’URL</em> : collez le lien.</li>
                <li><em>Obtenir la valeur du dictionnaire</em> : clé <code>taches</code>.</li>
                <li><em>Répéter avec chaque élément</em>, et dans la boucle :
                  <ul style={{ paddingLeft: 18 }}>
                    <li><em>Rechercher des rappels</em> où Titre est <code>titre</code> et Non terminé ;</li>
                    <li><em>Si</em> le résultat <em>n’a aucune valeur</em> : <em>Ajouter un nouveau rappel</em> avec <code>titre</code>, échéance <code>echeance</code>, notes <code>notes</code>, URL <code>url</code>.</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        )}
      </Carte>
      <Confirmation
        ouverte={action !== null}
        titre={action === 'desactiver' ? 'Désactiver le lien ?' : actif ? 'Générer un nouveau lien ?' : 'Générer le lien ?'}
        message={action === 'desactiver' ? 'Le raccourci ne recevra plus vos tâches.' : actif ? 'L’ancien lien cessera de fonctionner : pensez à mettre à jour le raccourci.' : 'Le lien ne sera affiché qu’une fois.'}
        libelleConfirmer={action === 'desactiver' ? 'Désactiver' : 'Générer'}
        ton={action === 'desactiver' ? 'danger' : 'principal'}
        chargement={envoi}
        onConfirmer={executer}
        onAnnuler={() => setAction(null)}
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
              nomFichier="categories"
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
              nomFichier="reseaux"
              icone={Share2}
              libelleSingulier="Réseau"
              libellePluriel="Réseaux sociaux"
              champs={[
                { nom: 'nom', libelle: 'Nom', requis: true, placeholder: 'Ex. Instagram' },
                { nom: 'lienCompte', libelle: 'Lien du compte', type: 'url', placeholder: 'https://…' },
              ]}
              lienChamp="lienCompte"
              compte={(r) => <span>{nombre(r._count?.Vente ?? 0)} vente{(r._count?.Vente ?? 0) > 1 ? 's' : ''} · {nombre(r._count?.PublicationReseau ?? 0)} contenu{(r._count?.PublicationReseau ?? 0) > 1 ? 's' : ''} · {nombre(r._count?.Client ?? 0)} client{(r._count?.Client ?? 0) > 1 ? 's' : ''}</span>}
            />
          )}
          {section === 'utilisateurs' && <SectionUtilisateurs />}
          {section === 'rappels' && <SectionRappels />}
        </div>
      </div>
    </Page>
  );
}
