import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { BarreHaut } from './components/layout/BarreHaut.jsx';
import { Chargement } from './components/ui/Divers.jsx';

import { Connexion } from './pages/Connexion.jsx';
import { ChoixEspace } from './pages/ChoixEspace.jsx';
import { Accueil } from './pages/Accueil.jsx';
import { ListeAchats } from './pages/achats/ListeAchats.jsx';
import { FicheAchat } from './pages/achats/FicheAchat.jsx';
import { ListeProduits } from './pages/produits/ListeProduits.jsx';
import { FicheProduit } from './pages/produits/FicheProduit.jsx';
import { ListeVentes } from './pages/ventes/ListeVentes.jsx';
import { FormulaireVente } from './pages/ventes/FormulaireVente.jsx';
import { FicheVente } from './pages/ventes/FicheVente.jsx';
import { Publications } from './pages/publications/Publications.jsx';
import { FichePublication } from './pages/publications/FichePublication.jsx';
import { Statistiques } from './pages/Statistiques.jsx';
import { Objectifs } from './pages/objectifs/Objectifs.jsx';
import { Parametres } from './pages/parametres/Parametres.jsx';

/** Anciennes adresses « /publications/… » : renvoyées vers « /contenus/… » (favoris, notifications). */
function AncienneFicheContenu() {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/contenus/${id}${search}`} replace />;
}
function AncienneListeContenus() {
  const { search } = useLocation();
  return <Navigate to={`/contenus${search}`} replace />;
}

function Coquille() {
  const { utilisateur, pret } = useAuth();
  const location = useLocation();

  if (!pret) return <Chargement texte="Ouverture de la session…" />;
  if (!utilisateur) return <Navigate to="/espaces" replace state={{ depuis: location.pathname }} />;

  return (
    <>
      <BarreHaut />
      <main>
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/espaces" element={<ChoixEspace />} />
      <Route path="/connexion" element={<Connexion />} />
      <Route element={<Coquille />}>
        <Route index element={<Accueil />} />
        <Route path="achats" element={<ListeAchats />} />
        <Route path="achats/:id" element={<FicheAchat />} />
        <Route path="produits" element={<ListeProduits />} />
        <Route path="produits/:id" element={<FicheProduit />} />
        <Route path="ventes" element={<ListeVentes />} />
        <Route path="ventes/nouvelle" element={<FormulaireVente />} />
        <Route path="ventes/:id" element={<FicheVente />} />
        <Route path="ventes/:id/modifier" element={<FormulaireVente />} />
        <Route path="contenus" element={<Publications />} />
        <Route path="contenus/:id" element={<FichePublication />} />
        <Route path="publications" element={<AncienneListeContenus />} />
        <Route path="publications/:id" element={<AncienneFicheContenu />} />
        <Route path="statistiques" element={<Statistiques />} />
        <Route path="objectifs" element={<Objectifs />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
