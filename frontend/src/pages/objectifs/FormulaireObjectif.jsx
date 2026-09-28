import { useEffect } from 'react';
import { Objectifs } from '../../services/api.js';
import { useFormulaire } from '../../lib/hooks.js';
import { versInputDate, CATEGORIES_OBJECTIF, LIBELLES_STATUT_OBJECTIF } from '../../lib/format.js';
import { Modale } from '../../components/ui/Modale.jsx';
import { Bouton } from '../../components/ui/Bouton.jsx';
import { Champ, Saisie, ZoneTexte, Selection } from '../../components/ui/Champs.jsx';
import { Encart } from '../../components/ui/Divers.jsx';

/** Premier et dernier jour d'un mois AAAA-MM. */
function bornesMois(mois) {
  const [a, m] = mois.split('-').map(Number);
  const dernier = new Date(a, m, 0).getDate();
  return { debut: `${mois}-01`, fin: `${mois}-${String(dernier).padStart(2, '0')}` };
}

const vide = (mois) => {
  const { debut, fin } = bornesMois(mois);
  return { title: '', description: '', category: '', targetValue: '', currentValue: '0', unit: '', startDate: debut, endDate: fin, status: 'en_cours' };
};

const depuisObjectif = (o) => ({
  title: o.title ?? '',
  description: o.description ?? '',
  category: o.category ?? '',
  targetValue: o.targetValue ?? '',
  currentValue: o.currentValue ?? '0',
  unit: o.unit ?? '',
  startDate: versInputDate(o.startDate),
  endDate: versInputDate(o.endDate),
  status: o.status ?? 'en_cours',
});

const OPTIONS_CATEGORIE = Object.entries(CATEGORIES_OBJECTIF).map(([valeur, libelle]) => ({ valeur, libelle }));
const OPTIONS_STATUT = Object.entries(LIBELLES_STATUT_OBJECTIF).map(([valeur, libelle]) => ({ valeur, libelle }));

/** Création / modification d'un objectif du mois. */
export function FormulaireObjectif({ ouvert, objectif, mois, onFermer, onEnregistre }) {
  const f = useFormulaire(vide(mois));

  useEffect(() => {
    if (ouvert) f.reinitialiser(objectif ? depuisObjectif(objectif) : vide(mois));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, objectif?.id, mois]);

  const soumettre = async (e) => {
    e.preventDefault();
    const resultat = await f.soumettre(() => (objectif ? Objectifs.modifier(objectif.id, f.valeurs) : Objectifs.creer(f.valeurs)));
    if (resultat) onEnregistre(resultat);
  };

  return (
    <Modale
      ouverte={ouvert}
      titre={objectif ? "Modifier l'objectif" : 'Nouvel objectif'}
      onFermer={onFermer}
      pied={
        <>
          <Bouton onClick={onFermer} disabled={f.envoi}>Annuler</Bouton>
          <Bouton variante="principal" type="submit" form="formulaire-objectif" chargement={f.envoi}>Enregistrer</Bouton>
        </>
      }
    >
      <form id="formulaire-objectif" className="formulaire" onSubmit={soumettre} noValidate>
        <Champ libelle="Titre" requis>
          {(id) => <Saisie id={id} name="title" required autoFocus maxLength={150} value={f.valeurs.title} onChange={f.surChangement} placeholder="Ex. : 30 ventes en septembre" />}
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Catégorie">
            {(id) => <Selection id={id} name="category" value={f.valeurs.category} onChange={f.surChangement} options={OPTIONS_CATEGORIE} placeholder="Sans catégorie" />}
          </Champ>
          <Champ libelle="Unité" aide="Ex. : ventes, Ar, publications">
            {(id) => <Saisie id={id} name="unit" maxLength={30} value={f.valeurs.unit} onChange={f.surChangement} placeholder="ventes" />}
          </Champ>
        </div>
        <div className="formulaire__ligne">
          <Champ libelle="Valeur cible" requis>
            {(id) => <Saisie id={id} name="targetValue" type="number" inputMode="decimal" min="0" step="any" required value={f.valeurs.targetValue} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Valeur actuelle">
            {(id) => <Saisie id={id} name="currentValue" type="number" inputMode="decimal" min="0" step="any" value={f.valeurs.currentValue} onChange={f.surChangement} />}
          </Champ>
        </div>
        <div className="formulaire__ligne">
          <Champ libelle="Début" requis>
            {(id) => <Saisie id={id} name="startDate" type="date" required value={f.valeurs.startDate} onChange={f.surChangement} />}
          </Champ>
          <Champ libelle="Fin" requis aide="Rappel la veille et le jour même">
            {(id) => <Saisie id={id} name="endDate" type="date" required value={f.valeurs.endDate} onChange={f.surChangement} />}
          </Champ>
        </div>
        {objectif && (
          <Champ libelle="Statut" aide="« Atteint » se pose automatiquement quand la valeur cible est atteinte">
            {(id) => <Selection id={id} name="status" value={f.valeurs.status} onChange={f.surChangement} options={OPTIONS_STATUT} />}
          </Champ>
        )}
        <Champ libelle="Description">
          {(id) => <ZoneTexte id={id} name="description" rows={3} value={f.valeurs.description} onChange={f.surChangement} placeholder="Pourquoi cet objectif, comment le mesurer…" />}
        </Champ>
        {f.erreur && <Encart ton="erreur">{f.erreur}</Encart>}
      </form>
    </Modale>
  );
}
