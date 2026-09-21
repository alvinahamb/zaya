# Backoffice Zaya : brief de design pour Claude Code

> Ce document décrit **le design et l'expérience d'utilisation**. Le fonctionnel, les formules et le modèle de données sont dans le cahier des charges `Zaya_Backoffice_V1_Modelisation.docx` : le lire en premier et le respecter (noms de tables, devises, règles de calcul).

## Contexte
Backoffice **interne** pour Zaya, une petite activité de revente de produits achetés en euro (codes Shein) et vendus en Ariary via les réseaux sociaux. **Un seul utilisateur** (admin), clients anonymes, jamais d'accès client. Utilisé sur **téléphone et ordinateur** : responsive dès le départ. Interface **entièrement en français**. Front-end React.

## Ambiance
Chaleureux, humain, simple : un outil de travail agréable, pas un tableau de bord froid. Ton visuel inspiré de Pinterest (cartes propres et douces, produits mis en avant par leur image), adapté à la gestion.

## Design tokens (variables CSS, faciles à remplacer)
Le logo et les couleurs de marque existent mais ne sont pas forcément à réutiliser : la palette ci-dessous est le défaut, à isoler dans des variables.

**Couleurs (thème clair uniquement, pas de mode sombre)**
- Fond de page `#FFF8F5` · surface des cartes `#FFFFFF` · bordures `#F0E1DA`
- Principale (boutons, liens, actif) `#C8432F` (texte blanc dessus, contraste AA)
- Corail vif (accents, graphiques) `#F26B55` · pêche `#F8B49F` · pêche très clair (survols, onglet actif) `#FFF0EA`
- Texte `#2B2320` · texte secondaire `#6B5E59`
- Succès `#2E7D5B` · attention `#B7791F` · danger `#A61B1B` · info `#3B6EA5`
- Série de contraste pour les graphiques `#4F7C82`

**Typographie** : Inter (ou équivalent moderne et neutre), corps 15–16 px, interligne 1,5, titres en semi-bold. Chiffres tabulaires (`font-variant-numeric: tabular-nums`) dans les tableaux et les montants.

**Formes** : coins légèrement arrondis (8 px cartes et boutons, 6 px champs), ombres très légères. **Icônes** en trait fin et cohérent (ex. Lucide), **aucune illustration décorative**.

## Devises et formats (important pour ce projet)
- Deux devises cohabitent : **€** pour les prix d'achat, **Ar** pour tout le reste. Toujours afficher l'unité à côté du montant, jamais un nombre nu.
- Format français : `12,50 €` (2 décimales) et `45 000 Ar` (arrondi à l'unité, séparateur de milliers en espace insécable). Le calcul garde la précision, seul l'affichage est arrondi.
- Ne pas différencier les devises par la couleur seule : l'unité écrite suffit. Dans les tableaux où les deux apparaissent, séparer visuellement les colonnes en euro et en Ariary (en-tête clair « Prix d'achat (€) » / « Prix d'achat (Ar) »).
- Marges en `%` avec signe : vert et flèche haut si positive, danger et flèche bas si négative (toujours icône + chiffre).

## Navigation et structure
- **Menu en haut** (barre fixe) : logo à gauche ; rubriques **Accueil · Achats · Produits · Ventes · Publications · Statistiques** ; à droite : recherche globale, bouton « + Nouveau », cloche de notifications, menu profil.
- Le menu profil ouvre **Paramètres** : catégories (CRUD), réseaux sociaux (CRUD), comptes utilisateurs (création / désactivation), déconnexion. Ces écrans sont secondaires et n'encombrent pas le menu principal.
- Il n'y a **pas de rubrique Stock séparée** : le stock restant se calcule (quantité achetée − quantité vendue). Il s'affiche dans la fiche Achat (par ligne) et dans la liste Produits (colonne « Stock restant »).
- Mobile : la barre du haut se réduit (logo + burger + « + »), les tableaux larges passent en cartes empilées ou défilent horizontalement dans leur conteneur.
- Densité équilibrée, contenu centré avec largeur maximale confortable.
- Connexion : écran simple, centré, logo, email + mot de passe, message d'erreur clair.

## Écrans

### Accueil
Les **tâches du jour** en élément principal (cases à cocher, échéance, module concerné). Il n'existe pas de table « Tâche » dans le cahier des charges : les tâches sont **dérivées des données** (publications à faire ou à publier aujourd'hui, commandes dont l'arrivée est estimée aujourd'hui ou en retard, produits en rupture). Les alertes passent par la cloche.

### Achats (commandes)
- **Liste** : nom, date de commande, arrivée estimée / réelle (badge « En route », « Reçue », « En retard »), somme en €, somme payée en Ar, marge estimée.
- **Fiche d'un achat** avec onglets : **Produits et tarification · Frais · Boosts · Ventes · Récapitulatif**.
- **Récapitulatif** : bandeau de 6 indicateurs bien lisibles (somme d'achat avec frais, estimation de vente, somme des boosts, vente actuelle, marge % estimée, marge % réelle), visible aussi en résumé collant en haut de la fiche sur mobile.
- Le **taux d'un euro** de la commande (calculé) est affiché dans l'en-tête de la fiche, discret mais visible.

### Tarification d'une commande (écran le plus important)
- Tableau éditable : produit (image miniature + nom), quantité, prix d'achat (€), prix d'achat (Ar), **marge (%)**, **prix de vente (Ar)**.
- Les champs **marge et prix de vente sont liés** : modifier l'un recalcule l'autre en direct, sans rechargement. Mettre en évidence la cellule qui vient d'être modifiée.
- État « brouillon » clairement visible tant que rien n'est sauvegardé ; bouton principal **« Enregistrer et figer »** avec une confirmation qui explique que prix, marges et prix de vente ne seront plus recalculés.
- Après sauvegarde : les champs passent en lecture seule (avec indication « Figé le … »).
- Sur mobile : une ligne = une carte avec les champs empilés, pour que la saisie reste confortable au pouce.

### Produits
Vue **grille de cartes** (image en avant, nom, catégorie, prix, stock restant) avec bascule en **vue tableau**. Filtres par catégorie, recherche. Fiche produit : image, catégorie, matériel, code Shein, prix d'achat €, dernier prix de vente Ar (indicatif).

### Ventes
- Liste : date, réseau, nombre d'articles, total en Ar.
- Formulaire : réseau, date, ajout de lignes en choisissant un produit **et la commande d'origine**, quantité (limitée au stock restant, avec message clair si dépassement), prix pré-rempli et modifiable, réduction globale, total calculé en direct. Client anonyme : aucun champ client.

### Boosts
Dans la fiche d'un achat : liste (date, réseau, montant, raison) et frais associés. Formulaire court.

### Publications (social media manager)
- Vue **calendrier** (semaine / mois) et vue **liste**, au choix.
- Statuts : **à faire · créée · publiée** (étiquette + icône).
- Chaque publication : nom, description, date et heure prévues, réseau, commande liée (facultatif), **lien Pinterest** (idée d'origine) et **lien du contenu créé**, présentés comme des liens cliquables avec icône.

### Statistiques / tableau de bord
Graphiques détaillés **par produit, par catégorie et par réseau social**, avec filtre de période, infobulles au survol, légendes claires, couleurs de la palette. KPIs en haut, **exports PDF et Excel** disponibles sur les listes et les statistiques.

## Fonctions transversales
- **Recherche globale** (produits, achats, ventes, publications), raccourci Ctrl/Cmd+K.
- **Bouton « + Nouveau »** : nouvel achat, nouvelle vente, nouveau produit, nouvelle publication.
- **Notifications / alertes** (cloche) : stock bas, commande en retard, publications à faire, etc.

## Ton des textes
Simple et neutre : phrases courtes, sans jargon ni humour. Confirmations factuelles (« Vente enregistrée », « Quantité supérieure au stock restant »). États vides sobres, avec une icône et l'action à faire.

## Animations
Douces et discrètes : transitions de 150–200 ms (survol, menus, validation, recalcul des champs liés). Respecter `prefers-reduced-motion`.

## Accessibilité
Contrastes standards (WCAG AA), texte lisible, zones cliquables d'au moins 40 px sur mobile, focus visible, statuts et marges jamais indiqués par la couleur seule.

## À éviter
Mode sombre, illustrations décoratives, interface surchargée, tons froids ou corporate, jargon, montants sans unité.