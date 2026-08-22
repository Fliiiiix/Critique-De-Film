# Critique de films

Outil personnel pour noter les films selon une grille de critères fixe, pour éviter
d'être influencé après coup par les avis lus ailleurs. Remplace l'ancien fichier Excel.

## Structure

```
critique-films/
├── index.html               → structure de la page (écran de connexion + app)
├── css/style.css             → tout le style (thème pellicule/salle de projection)
├── js/data.js                  → les 7 critères (définitions, repères, questions) + SEED (films de l'Excel, migration uniquement)
├── js/supabaseConfig.js        → clés du projet Supabase (URL + clé publique anon)
├── js/tmdbConfig.js             → clé API TMDB
├── js/auth.js                    → connexion par lien magique, bascule écran connexion/app
├── js/profile.js                  → profil par utilisateur (pseudo + avatar)
├── js/app.js                       → logique (rendu, CRUD via Supabase, formulaire de notation)
├── js/tmdb.js                       → recherche TMDB (affiche, résumé, année)
├── js/stats.js                       → page statistiques
├── js/achievements.js                → page succès (paliers + secrets)
├── js/watchlist.js                    → liste "à voir", séparée du catalogue noté (page routée, voir router.js)
├── js/journal.js                       → journal des visionnages, revisionnages
├── js/friends.js                        → amis (demande/acceptation) + profil en lecture seule (page routée, voir router.js)
├── js/router.js                          → routeur par hash (#/groupes/..., #/watchlist, #/amis, #/top, #/u/:id), toutes les pages
├── js/top.js                              → top films (tout le monde / mes amis), page routée
├── js/publicProfile.js                     → profil public (#/u/:userId), seule page accessible sans connexion
├── js/groups.js                          → groupes (famille/amis) : création, membres
├── js/proposals.js                        → propositions de films dans un groupe : votes + discussion
└── supabase/
    ├── schema.sql                  → schéma complet (nouveau projet)
    └── migrations/                 → changements incrémentaux (projet déjà provisionné)
```

## Lancer le projet

Aucune installation nécessaire, c'est du HTML/CSS/JS pur, sans build — mais il
faut un projet Supabase configuré (voir section suivante) pour que la
connexion et la sauvegarde fonctionnent.

Ouvrir `index.html` directement dans un navigateur, ou pour éviter les soucis de
CORS avec certains navigateurs, servir le dossier en local :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

En ligne : https://fliiiiix.github.io/Critique-De-Film/ (GitHub Pages, déployé
depuis la branche `main`).

### Mode maintenance

Pour bloquer temporairement le site (ex. pendant une modif risquée en prod,
comme un changement de policy RLS) : Supabase → **Table Editor** →
`site_status` → passer `maintenance` à `true` (et éditer `message` si besoin,
sinon un texte par défaut s'affiche). Effet immédiat pour quiconque
charge/recharge la page, connecté ou non — pas de redéploiement nécessaire.
Repasser `maintenance` à `false` pour rouvrir. Nécessite
`supabase/migrations/010_add_site_status.sql`.

## Stockage des données & authentification

Les films sont stockés dans une base **Supabase** (Postgres), pas en local :
donc accessibles depuis n'importe quel appareil, à condition de se connecter
avec le même compte.

Connexion par **lien magique** (email uniquement, pas de mot de passe) via
Supabase Auth. Chaque utilisateur ne voit et ne modifie que ses propres films,
grâce aux règles RLS définies dans `supabase/schema.sql`.

### Mettre en place son propre projet Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Dans **SQL Editor**, exécuter le contenu de `supabase/schema.sql`
3. Dans **Authentication → URL Configuration**, mettre l'URL du site déployé
   (ex. `https://fliiiiix.github.io/Critique-De-Film/`) en *Site URL* et en
   *Redirect URL* — sinon le lien magique renvoie vers la mauvaise adresse
4. Dans **Project Settings → API**, copier *Project URL* et clé *anon public*
   dans `js/supabaseConfig.js`

La clé `anon` est faite pour être publique côté client (elle est visible dans
le code source) — la sécurité vient des règles RLS, pas du secret de cette clé.
Ne jamais mettre la `service_role key` dans ce fichier, celle-là est un vrai secret.

### Migrer les anciennes données (localStorage → Supabase)

L'app chargeait auparavant depuis `localStorage` (voir historique Git avant
la v1.3). Pour récupérer ces films après bascule vers Supabase : exporter
depuis l'ancienne version (bouton **Exporter (JSON)**) avant la mise à jour,
puis une fois connecté sur la nouvelle version, **Importer (JSON)** ce même
fichier.

### Export / Import JSON

Le bouton **Exporter (JSON)** télécharge un fichier `critique-films-AAAA-MM-JJ.json`
contenant tous les films notés — pratique pour sauvegarder tes données ou les
transférer vers un autre navigateur/appareil.

Le bouton **Importer (JSON)** relit un fichier exporté de cette façon. Deux
modes possibles, choisis via une boîte de confirmation au moment de l'import :

- **OK** → remplace entièrement le catalogue actuel par le contenu du fichier
- **Annuler** → ajoute les films du fichier à ceux déjà présents

Un fichier mal formé (pas de tableau `films`, film sans titre ou sans
critères) est rejeté sans toucher aux données existantes.

## La grille de notation (v1.3)

7 critères, chacun noté de 0 à 1 par curseur, moyenne convertie en note sur 5
(arrondie au demi-point) :

1. **Scénario** — intrigue, dialogues, personnages, thèmes
2. **Mise en scène** — rythme, ambiance, choix du réalisateur
3. **Jeu d'acteur** — performance des acteurs
4. **Esthétique visuelle** — cadrage, lumière, couleurs, effets
5. **Son** — mixage, bruitages, ambiance sonore (hors musique)
6. **Musique** — la partition/bande originale
7. **Ressenti global** — impact émotionnel, indépendant des 6 critères techniques

Chaque critère a une définition fixe, une échelle de repères (0 / 0.5 / 1) et
4 questions pour trancher rapidement — voir `js/data.js`.

### Trier/filtrer par critère individuel

Deux niveaux plutôt qu'un seul sélecteur surchargé : le tri général
(`#sortBy` — Note globale, Titre, Favoris, Récent) propose une dernière
option **"Par critère…"** qui révèle un second sélecteur avancé
(`#sortAdvancedRow`) — lequel des 7 critères (généré depuis `CRITERIA`, voir
`buildSortOptions()` dans `js/app.js`), un bouton-bascule ↓/↑ pour le sens,
et un curseur de seuil pour ne garder que les films notés au-dessus d'une
valeur donnée sur ce critère précis. Les trois (critère, sens, seuil)
portent sur le même critère plutôt que des contrôles déconnectés à
synchroniser à la main. Un film en note manuelle (pas de grille remplie)
n'a pas de valeur pour un critère donné : il sort du classement dès qu'un
seuil > 0 est actif, plutôt que d'être simplement mal classé. Revenir à un
tri général masque et réinitialise le sélecteur avancé.

### Note manuelle (exception à la grille)

Dans le formulaire, la case **Note manuelle — sans passer par la grille**
permet de saisir directement une note sur 5 au lieu de passer par les 7 critères.
Prévu pour les films déjà notés avec un référentiel différent (ex. retravaillés
avant la migration vers cette grille) — inutile, voire trompeur, de leur
recalculer une note "7 critères" a posteriori. Positionnée sous la grille
(pas au-dessus) : la notation par critères est le cœur de l'app, la note
manuelle une échappatoire exceptionnelle qui ne doit pas lui faire concurrence
en haut du formulaire.

Un film noté ainsi est visuellement distingué dans la liste : badge `manuel`
à côté du titre, sous-titre différent, encadré de la note en teal au lieu
d'amber. Nécessite d'avoir exécuté `supabase/migrations/002_add_manual_note.sql`
sur le projet (ajoute la colonne `manual_note`).

Pour convertir en masse des films déjà notés via la grille vers la note
manuelle (en gardant leur note calculée actuelle) : script
`supabase/scripts/migrate-to-manual-note.js`.

## Affiche, résumé & année (TMDB)

Le champ **Titre du film** fait aussi office de recherche : dès 2 caractères,
l'app interroge en direct l'API de [The Movie Database](https://www.themoviedb.org)
(pas Letterboxd, qui n'a pas d'API publique) et propose une liste de résultats
avec vignette sous le champ — cliquer sur l'un renseigne le titre et préremplit
affiche, résumé et année. Ces infos s'affichent ensuite dans la liste (vignette
+ année) et sont conservées si tu resauvegardes le film sans changer la
sélection. Pas de fiche trouvée ou pas envie d'en choisir une ? Le titre tapé
suffit, le film est enregistré normalement (juste sans affiche).

Nécessite un token gratuit : compte sur themoviedb.org → menu profil →
Paramètres → API → Créer une clé → coller le **Token d'accès en lecture
(v4 auth, un long JWT)** dans `js/tmdbConfig.js` (utilisé en en-tête
`Authorization: Bearer`, pas en paramètre d'URL — voir `js/tmdb.js`). Comme
la clé anon Supabase, il est fait pour tourner côté client (lecture seule).
Sans token configuré, la recherche échoue proprement (message d'erreur
affiché, reste de l'app inchangé). Nécessite d'avoir exécuté
`supabase/migrations/004_add_tmdb_fields.sql`.

### Recherche multilingue (titre FR / VO)

La barre de recherche du catalogue matche aussi bien le titre français que le
titre en langue d'origine (ex. taper "créatures féroces" ou "fierce
creatures" trouve le même film) — sans traduction automatique, juste les deux
titres que TMDB associe déjà au film (`title` en `fr-FR`, `original_title`
renvoyé dans la même réponse). Les accents et la casse sont aussi ignorés
("amelie" trouve "Amélie"). Nécessite `supabase/migrations/008_add_original_title.sql`.
Le titre VO n'est renseigné qu'à partir du prochain ajout/modification d'un
film lié à une fiche TMDB — pour les films déjà en base, script de rattrapage
dans `supabase/scripts/backfill-original-title.js`.

## Commentaire libre

Un champ **Commentaire** dans le formulaire permet de noter tes impressions
en texte libre, en plus de la note. Un film commenté affiche un petit 💬 à
côté de son titre dans la liste. Nécessite
`supabase/migrations/003_add_review.sql`.

## Profil (pseudo + avatar)

Pas de bouton "Profil" séparé dans l'entête : la **photo de profil**
elle-même (agrandie, en haut à droite) fait office de bouton — cliquer
dessus ouvre la modale profil. Sans avatar renseigné, une icône 👤 la
remplace pour rester visible et cliquable. La modale permet de définir un
pseudo et une image d'avatar (URL d'une image, pas d'upload pour l'instant)
affichés à la place de l'email brut, regroupe les vues sur **mon activité**
(section "Mon activité" : 📊 Statistiques, 🏆 Succès, 📅 Journal — voir plus
bas), le lien du **profil public** (voir plus bas) et la **déconnexion**
(sur la ligne d'Annuler/Enregistrer, à gauche — plus dans l'entête). Chaque
utilisateur a son propre profil, isolé par RLS comme le reste — l'app
supporte plusieurs comptes indépendants (chacun avec son catalogue privé)
dès lors qu'ils se connectent avec leur propre email. Nécessite
`supabase/migrations/005_add_profiles.sql`.

Le **titre "Critique de films"** (entête) est lui aussi cliquable — retour à
l'accueil en un clic depuis n'importe quelle page.

## Statistiques

Dans la modale profil, **📊 Statistiques** (section "Mon activité") ouvre un
aperçu calculé à la volée depuis les films chargés (pas de requête dédiée) :
nombre de films, note moyenne, favoris, répartition grille/note manuelle,
distribution des notes, activité par mois, film le mieux et le moins bien
noté.

## Succès

Dans la modale profil, **🏆 Succès** (section "Mon activité") ouvre une page
calculée elle aussi à la volée depuis les films chargés (pas de table
dédiée, pas de migration nécessaire) :

- **Paliers** : 4 séries cumulatives (Cinéphile, Grand favori, Critique en
  chef, Archiviste) avec un badge bronze/argent/or selon les seuils atteints
  et une barre de progression vers le palier suivant.
- **Secrets** : 10 succès cachés, plus insolites (ex. avoir donné 0.5/5 à un
  film, avoir ajouté un film entre minuit et 5h du matin…) — invisibles
  (`???`) tant qu'ils ne sont pas débloqués, pour garder la surprise.

Comme les statistiques, tout se recalcule à chaque ouverture à partir de
l'état actuel du catalogue : pas d'historique à maintenir, un succès peut se
"reverrouiller" si les films concernés sont supprimés ou modifiés.

## Watchlist ("à voir")

L'icône **🎞️** dans l'entête mène à `#/watchlist`, une page à part entière
(comme Groupes/Amis — voir `js/router.js`) plutôt qu'une modal, avec son
propre bouton **← Retour**. Liste séparée du catalogue noté (table
`watchlist`, pas `films`) : ajout rapide d'un titre, avec fiche TMDB
optionnelle (affiche/année) et une note libre (pourquoi le voir, qui l'a
conseillé…). Deux actions par item :

- **✔ Noter** — ouvre le formulaire principal (grille ou note manuelle),
  préempli avec le titre et la fiche TMDB déjà connus. L'item n'est retiré
  de la watchlist qu'une fois le film effectivement enregistré.
- **Retirer** — supprime l'item sans le noter.

Nécessite `supabase/migrations/006_add_watchlist.sql`.

## Interface responsive

Chaque chose a sa place plutôt que d'aligner tous les boutons en vrac au même
niveau (v1.5) :

- **Entête** : le titre (retour accueil en un clic) à gauche ; à droite, les
  pages assez fréquentes pour mériter un accès direct — 🎞️ À voir, 👥 Amis
  (qui contient Groupes) et 🏅 Top films — puis la photo de profil + pseudo
  (ouvre la modale profil).
- **Modale profil** : identité (pseudo/avatar), section "Mon activité" (vues
  sur le catalogue passé — Statistiques/Succès/Journal, pas des actions du
  quotidien), déconnexion (sur la même ligne qu'Annuler/Enregistrer, pas
  isolée sur sa propre ligne).
- **Toolbar du catalogue** : ne garde que ce qui agit sur la liste affichée —
  recherche/tri, un menu **⋯** pour Export/Import, **+ Ajouter un film**.

Sur grand écran, une double colonne de pastilles façon perforations de
pellicule longe les deux bords de l'écran (voir `.sprockets-side` dans
`css/style.css`, généré par `fillSprockets()` dans `js/app.js`) — comble le
vide plutôt que d'élargir `.container` (qui resterait confortable à lire).
Masquée sous 1200px de large, où il n'y a plus la place.

En dessous de 600px de large, la toolbar passe en colonne et **+ Ajouter un
film** est remplacé par un bouton flottant (FAB) en bas à droite — l'entête
et les grilles (statistiques, succès) se réorganisent elles aussi
automatiquement. Le footer de la modale d'ajout/édition (note calculée +
boutons) passe lui aussi sur deux lignes en dessous de 600px plutôt que de
laisser le texte de la note se faire écraser. Un peu d'animation (ouverture
des fenêtres, survol des lignes de la liste, retour tactile sur les boutons)
pour que ça reste agréable à l'usage.

## Journal & revisionnages

Chaque film noté a un ou plusieurs **visionnages** (table `viewings`, séparée
de `films`) : la date où il a été noté compte comme premier visionnage,
créé automatiquement. Dans le formulaire d'un film déjà enregistré, la
section **Visionnages** permet d'ajouter une nouvelle date (+ note libre) —
utile pour noter qu'on a revu un film, sans toucher à sa note. Un film revu
affiche un badge `↻ ×N` dans la liste.

Dans la modale profil, **📅 Journal** (section "Mon activité") ouvre un
historique chronologique de tous les visionnages (tous films confondus),
groupés par mois, avec un badge pour distinguer un revisionnage du premier
visionnage.

Nécessite `supabase/migrations/007_add_viewings.sql`, qui rétro-remplit
aussi un premier visionnage pour chaque film déjà présent (daté de son
ajout) — rien à ressaisir à la main après la migration.

## Amis

L'icône **👥** dans l'entête mène à `#/amis`, une page à part entière (comme
Watchlist/Groupes — voir `js/router.js`), avec son propre bouton
**← Retour**. Elle permet d'ajouter un ami par pseudo (recherche partielle)
ou par email (correspondance exacte uniquement), d'accepter/refuser les
demandes reçues, et de voir le **catalogue et les statistiques** d'un ami une
fois la demande acceptée — en lecture seule, aucune interaction n'est possible
sur ses films (modale ouverte par-dessus la page, qui se retrouve dessous
telle quelle une fois cette modale refermée). Une demande croisée (vous
demandez à quelqu'un qui vous avait déjà demandé) est acceptée
automatiquement plutôt que de créer un doublon.

Techniquement : table `friendships` (une ligne par relation, statut
pending/accepted/declined) + une policy RLS qui ouvre la lecture de `films`
aux amis acceptés (en plus de la sienne propre, jamais en écriture) + une
fonction `find_user_by_email` en `SECURITY DEFINER` pour chercher un email
exact sans exposer toute la table `auth.users` côté client. Nécessite
`supabase/migrations/009_add_friendships.sql`.

En bas de la page, une section **Groupes** mène vers `#/groupes` (voir plus
bas) — un groupe se fait avec des amis, donc c'est ici que ça vit plutôt que
d'avoir sa propre icône dans l'entête.

## Groupes

Accessible depuis le bas de la page Amis (section "Groupes"), permet de créer
un groupe (nom + description optionnelle) — le créateur en devient
automatiquement membre. Depuis le détail d'un groupe, le créateur peut
ajouter n'importe lequel de ses amis acceptés (pas de flux invitation
séparé : l'amitié fait déjà office de consentement) et retirer un membre ;
les autres membres peuvent quitter le groupe. Seul le créateur peut supprimer
le groupe (retire tous les membres).

Contrairement aux amis, un groupe **ne partage pas les catalogues notés** de
ses membres — c'est une base pour la brique suivante (proposer des films,
discuter, voter au sein du groupe), pas une fusion de bibliothèques.

Groupes/détail groupe/détail proposition sont trois **vraies pages routées
par URL** (`#/groupes`, `#/groupes/:id`, `#/groupes/:id/propositions/:id` —
voir `js/router.js`), pas des modals empilées : un groupe contient membres +
ajout d'amis + propositions + votes + discussion, trop pour tenir en popup
sur plusieurs niveaux. Watchlist et Amis ont suivi le même traitement
(`#/watchlist`, `#/amis`) ; Statistiques/Succès/Journal restent des modals
classiques ouvertes depuis le profil (2 niveaux max, ça reste raisonnable).

Techniquement : tables `groups` + `group_members`, RLS scopée à
l'appartenance via une fonction `is_group_member()` en `SECURITY DEFINER`
(une policy qui s'auto-interroge directement provoque une récursion
infinie côté Postgres, 42P17 — voir `migrations/013`), et le propriétaire
voit toujours son propre groupe directement par `owner_id` sans dépendre du
timing du trigger qui l'ajoute comme membre (`migrations/014`). Trigger qui
ajoute automatiquement le créateur comme membre à la création. Nécessite
`supabase/migrations/011_add_groups.sql` puis `013_fix_group_members_recursion.sql`
et `014_fix_groups_owner_select_race.sql`.

## Propositions de films (dans un groupe)

Depuis le détail d'un groupe, n'importe quel membre peut **proposer un
film** (recherche TMDB comme dans le formulaire principal — titre, affiche,
année). Les autres membres votent ▲/▼ (un vote par personne, façon Reddit —
recliquer sur son propre vote le retire) et peuvent ouvrir une proposition
pour **discuter en commentaires**. L'auteur d'une proposition ou d'un
commentaire peut le supprimer ; le créateur du groupe peut aussi supprimer
n'importe quelle proposition ou commentaire (modération).

Techniquement : tables `group_proposals`, `group_proposal_votes` (une ligne
par personne et par proposition, contrainte unique) et
`group_proposal_comments`, toutes scopées en RLS à l'appartenance au groupe
via `group_proposals.group_id` → `group_members`. Nécessite
`supabase/migrations/012_add_group_proposals.sql`.

## Top films

L'icône **🏅** dans l'entête mène à `#/top`, une page à part entière (comme
Amis/Watchlist/Groupes), avec deux classements au choix (onglets) :

- **Tout le monde** — les films les mieux notés, tous comptes de l'app
  confondus.
- **Mes amis** — pareil, mais restreint à moi + mes amis acceptés
  **directs** (pas les amis de mes amis) : personnel à chaque utilisateur —
  si j'ai 4 amis, mon top porte sur nous 5 ; si l'un d'eux a 7 amis, le sien
  porte sur eux 8, indépendamment du mien.

Chaque ligne : rang, affiche, titre, nombre de notes, note moyenne (les 3
premiers rangs sont mis en avant en amber — un vrai ordre, donc numéroté,
contrairement aux 01/02… de la grille qui ne sont que des repères de
lecture). Seuls les films avec une fiche TMDB comptent (`tmdb_id` sert de
clé pour recouper un même film entre utilisateurs — un ajout manuel sans
recherche ne peut pas être rapproché de l'entrée de quelqu'un d'autre).

Techniquement : deux fonctions `SECURITY DEFINER` (`get_global_top_films` /
`get_friends_top_films`, même principe que `is_group_member` —
`migrations/013`) qui lisent `films` de tout le monde en interne (RLS
contournée volontairement) mais **ne renvoient que des agrégats** — jamais
`user_id` ni `review`, donc pas de fuite de "qui a mis quelle note", même
sur un film noté par une seule personne. La note de chaque utilisateur est
recalculée en SQL avec la même formule que `computeNote()` côté client
(`js/app.js`) : moyenne des 7 critères arrondie au demi-point sur 5, ou
`manual_note` directement si renseignée — puis moyennée entre utilisateurs.
Pas de seuil minimum de votes pour l'instant (une seule note à 5/5 suffit à
arriver en tête) : le nombre de notes est affiché à côté pour que ça reste
lisible, plutôt qu'une formule pondérée façon IMDB, overkill vu l'échelle
(usage personnel entre amis). Nécessite
`supabase/migrations/015_add_top_films.sql`.

## Profil public

Dans la modale profil, la case **"Profil public (lien à partager, lecture
seule)"** génère un lien (`#/u/:userId`) menant à une page **accessible
sans connexion** — seule page de toute l'app dans ce cas. La coche
n'enregistre qu'au clic sur "Enregistrer", comme le pseudo/l'avatar. La
page publique montre pseudo, avatar, quelques tuiles (films notés / note
moyenne / favoris) et le catalogue trié par note — jamais l'email ni les
commentaires (`review`), désactivé par défaut (opt-in).

Techniquement : colonne `profiles.public_profile` (`false` par défaut) +
une fonction `SECURITY DEFINER` `get_public_profile(p_user_id)`, seule
fonction de tout le projet accordée au rôle `anon` (toutes les autres
exigent `authenticated`). Elle lit `films`/`profiles` de l'utilisateur visé
en interne, mais ne renvoie que pseudo/avatar/catalogue agrégé — jamais de
ligne brute — et 0 ligne (sans distinguer "profil inexistant" de "resté
privé") tant que `public_profile` n'est pas passé à `true`. Testé en
conditions réelles contre la prod : bascule public → appel direct avec un
client Supabase 100% anonyme (aucune session) → contenu correct reçu →
bascule retour à privé → le même client anonyme ne reçoit plus rien.
Nécessite `supabase/migrations/016_add_public_profile.sql`.

## Prochaines étapes possibles

- Happenings façon Letterboxd (défis/événements autour d'une sélection de films)
- Upload d'avatar réel (Supabase Storage) plutôt qu'une URL
- Cache local (offline-first) pour continuer à consulter/noter sans réseau
