import { useCallback, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Stats } from '../services/api.js';
import { useApi } from '../lib/hooks.js';
import { ariary, pourcentage, nombre, dateCourte, aujourdhuiISO } from '../lib/format.js';
import { Page } from '../components/layout/Page.jsx';
import { Carte, Indicateur } from '../components/ui/Carte.jsx';
import { Tableau } from '../components/ui/Tableau.jsx';
import { Montant, Marge } from '../components/ui/Montant.jsx';
import { Saisie } from '../components/ui/Champs.jsx';
import { Chargement, Encart, EtatVide, Segment, Onglets, BoutonsExport } from '../components/ui/Divers.jsx';

/* Mêmes valeurs que les tokens CSS --graphique-* (Recharts a besoin de couleurs résolues). */
const COULEURS = ['#951010', '#d4a017', '#e9c77a', '#4f7c82', '#3b6ea5', '#c0392b'];
const GRILLE = '#efe6cf';
const AXE = '#6b5e59';
const SURVOL = '#fff8e1';

const PRESETS = [
  { valeur: 'mois', libelle: 'Ce mois' },
  { valeur: '3mois', libelle: '3 mois' },
  { valeur: '12mois', libelle: '12 mois' },
  { valeur: 'annee', libelle: 'Année' },
  { valeur: 'perso', libelle: 'Dates' },
];

function bornes(preset) {
  const au = aujourdhuiISO();
  const d = new Date();
  if (preset === 'mois') return { du: `${au.slice(0, 7)}-01`, au };
  if (preset === 'annee') return { du: `${au.slice(0, 4)}-01-01`, au };
  d.setMonth(d.getMonth() - (preset === '3mois' ? 3 : 12));
  d.setDate(d.getDate() + 1);
  const deux = (n) => String(n).padStart(2, '0');
  return { du: `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`, au };
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function libellePeriode(id) {
  if (/^\d{4}-\d{2}$/.test(id)) return `${MOIS[Number(id.slice(5, 7)) - 1]} ${id.slice(0, 4)}`;
  return dateCourte(id).slice(0, 5);
}

function Infobulle({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="infobulle">
      <strong>{label}</strong>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex-entre" style={{ gap: 16 }}>
          <span className="flex" style={{ gap: 6 }}>
            <span className="legende__couleur" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabulaire">{ariary(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const DIMENSIONS = [
  { cle: 'parProduit', libelle: 'Produits', titre: 'Par produit', horizontal: true },
  { cle: 'parCategorie', libelle: 'Catégories', titre: 'Par catégorie' },
  { cle: 'parReseau', libelle: 'Réseaux', titre: 'Par réseau social' },
];

const COLONNES_EXPORT = [
  { cle: 'libelle', titre: 'Libellé' },
  { cle: 'quantite', titre: 'Articles', align: 'droite' },
  { cle: 'caAr', titre: 'Ventes (Ar)', texte: (x) => ariary(x.caAr), align: 'droite' },
  { cle: 'coutAr', titre: "Coût d'achat (Ar)", texte: (x) => ariary(x.coutAr), align: 'droite' },
  { cle: 'margeAr', titre: 'Marge (Ar)', texte: (x) => ariary(x.margeAr), align: 'droite' },
  { cle: 'margePct', titre: 'Marge (%)', texte: (x) => pourcentage(x.margePct), align: 'droite' },
];

const COLONNES = [
  { cle: 'libelle', titre: 'Libellé', principal: true, rendu: (x) => <span className="gras">{x.libelle}</span> },
  { cle: 'quantite', titre: 'Articles', align: 'droite', rendu: (x) => nombre(x.quantite) },
  { cle: 'caAr', titre: 'Ventes (Ar)', align: 'droite', rendu: (x) => <Montant valeur={x.caAr} /> },
  { cle: 'margeAr', titre: 'Marge (Ar)', align: 'droite', rendu: (x) => <Montant valeur={x.margeAr} /> },
  { cle: 'margePct', titre: 'Marge', align: 'droite', rendu: (x) => <Marge pct={x.margePct} /> },
];

/** Une seule carte pour les trois répartitions : on change de dimension par onglet. */
function Repartition({ donnees, sousTitre }) {
  const [dimension, setDimension] = useState('parProduit');
  const d = DIMENSIONS.find((x) => x.cle === dimension);
  const liste = donnees[dimension] ?? [];
  const top = liste.slice(0, 8);
  return (
    <Carte nu>
      <div className="carte__entete" style={{ paddingBottom: 0, borderBottom: 0 }}>
        <Onglets onglets={DIMENSIONS} actif={dimension} onChange={setDimension} />
        <BoutonsExport nomFichier={`stats-${d.libelle.toLowerCase()}`} titre={d.titre} sousTitre={sousTitre} colonnes={COLONNES_EXPORT} lignes={liste} />
      </div>
      {liste.length === 0 ? (
        <EtatVide icone={BarChart3} titre="Aucune vente sur la période" />
      ) : (
        <>
          <div className="graphique" style={{ padding: '12px 12px 0', height: d.horizontal ? 60 + top.length * 36 : 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout={d.horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRILLE} vertical={Boolean(d.horizontal)} horizontal={!d.horizontal} />
                {d.horizontal ? (
                  <>
                    <XAxis type="number" tickFormatter={(v) => nombre(v)} stroke={AXE} fontSize={12} />
                    <YAxis type="category" dataKey="libelle" width={110} stroke={AXE} fontSize={12} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="libelle" stroke={AXE} fontSize={12} />
                    <YAxis tickFormatter={(v) => nombre(v)} stroke={AXE} fontSize={12} width={64} />
                  </>
                )}
                <Tooltip content={<Infobulle />} cursor={{ fill: SURVOL }} />
                <Bar dataKey="caAr" name="Ventes" radius={4} isAnimationActive={false} barSize={d.horizontal ? 22 : 48}>
                  {top.map((_, i) => <Cell key={i} fill={COULEURS[i % COULEURS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Tableau colonnes={COLONNES} lignes={liste} />
        </>
      )}
    </Carte>
  );
}

export function Statistiques() {
  const [preset, setPreset] = useState('12mois');
  const [perso, setPerso] = useState(() => bornes('mois'));
  const periode = preset === 'perso' ? perso : bornes(preset);
  const charger = useCallback(() => Stats.lire(periode), [periode.du, periode.au]); // eslint-disable-line react-hooks/exhaustive-deps
  const { donnees, chargement, erreur } = useApi(charger);

  const evolution = useMemo(() => (donnees?.parPeriode ?? []).map((p) => ({ ...p, libelle: libellePeriode(p.id) })), [donnees]);
  const sousTitre = `Du ${dateCourte(periode.du)} au ${dateCourte(periode.au)}`;

  return (
    <Page titre="Statistiques">
      <div className="outils">
        <Segment libelle="Période" valeur={preset} onChange={setPreset} options={PRESETS} />
        {preset === 'perso' && (
          <>
            <Saisie type="date" value={perso.du} onChange={(e) => setPerso((p) => ({ ...p, du: e.target.value }))} aria-label="Du" />
            <span className="secondaire petit">au</span>
            <Saisie type="date" value={perso.au} onChange={(e) => setPerso((p) => ({ ...p, au: e.target.value }))} aria-label="Au" />
          </>
        )}
      </div>

      {erreur && <Encart ton="erreur">{erreur}</Encart>}
      {chargement && !donnees ? (
        <Chargement />
      ) : (
        donnees && (
          <div className="colonne" style={{ gap: 20 }}>
            <div className="indicateurs">
              <Indicateur libelle="Ventes" valeur={ariary(donnees.kpis.caAr)} sous={`${nombre(donnees.kpis.nbVentes)} vente${donnees.kpis.nbVentes > 1 ? 's' : ''}`} />
              <Indicateur libelle="Marge" valeur={ariary(donnees.kpis.margeAr)} sous={pourcentage(donnees.kpis.margePct)} couleur={donnees.kpis.margeAr < 0 ? 'var(--danger)' : donnees.kpis.margeAr > 0 ? 'var(--succes)' : undefined} />
              <Indicateur libelle="Articles vendus" valeur={nombre(donnees.kpis.nbArticles)} />
              <Indicateur libelle="Panier moyen" valeur={ariary(donnees.kpis.panierMoyenAr)} />
            </div>

            <Carte titre={`Ventes et marge par ${donnees.periode.granularite}`} actions={<span className="petit secondaire">{sousTitre}</span>}>
              {evolution.length === 0 ? (
                <EtatVide icone={BarChart3} titre="Aucune vente sur la période" />
              ) : (
                <>
                  <div className="graphique" style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={evolution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={GRILLE} vertical={false} />
                        <XAxis dataKey="libelle" stroke={AXE} fontSize={12} />
                        <YAxis tickFormatter={(v) => nombre(v)} stroke={AXE} fontSize={12} width={64} />
                        <Tooltip content={<Infobulle />} cursor={{ fill: SURVOL }} />
                        <Bar dataKey="caAr" name="Ventes" fill={COULEURS[0]} radius={4} isAnimationActive={false} maxBarSize={48} />
                        <Bar dataKey="margeAr" name="Marge" fill={COULEURS[1]} radius={4} isAnimationActive={false} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="legende">
                    <span className="legende__item"><span className="legende__couleur" style={{ background: COULEURS[0] }} />Ventes (Ar)</span>
                    <span className="legende__item"><span className="legende__couleur" style={{ background: COULEURS[1] }} />Marge (Ar)</span>
                  </div>
                </>
              )}
            </Carte>

            <Repartition donnees={donnees} sousTitre={sousTitre} />
          </div>
        )
      )}
    </Page>
  );
}
