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

### Note manuelle (bypass exceptionnel de la grille)

Dans le formulaire, la case **Note manuelle — bypasse la grille** permet de
saisir directement une note sur 5 au lieu de passer par les 7 critères.
Prévu pour les films déjà notés avec un référentiel différent (ex. retravaillés
avant la migration vers cette grille) — inutile, voire trompeur, de leur
recalculer une note "7 critères" a posteriori.

Un film noté ainsi est visuellement distingué dans la liste : badge `manuel`
à côté du titre, sous-titre différent, encadré de la note en teal au lieu
d'amber. Nécessite d'avoir exécuté `supabase/migrations/002_add_manual_note.sql`
sur le projet (ajoute la colonne `manual_note`).

## Affiche, résumé & année (TMDB)

Dans le formulaire, le champ **Rechercher sur TMDB** interroge l'API de
[The Movie Database](https://www.themoviedb.org) (pas Letterboxd, qui n'a pas
d'API publique) et propose une liste de résultats avec vignette — cliquer sur
l'un préremplit affiche, résumé et année. Ces infos s'affichent ensuite dans
la liste (vignette + année) et sont conservées si tu resauvegardes le film
sans relancer de recherche.

Nécessite un token gratuit : compte sur themoviedb.org → menu profil →
Paramètres → API → Créer une clé → coller le **Token d'accès en lecture
(v4 auth, un long JWT)** dans `js/tmdbConfig.js` (utilisé en en-tête
`Authorization: Bearer`, pas en paramètre d'URL — voir `js/tmdb.js`). Comme
la clé anon Supabase, il est fait pour tourner côté client (lecture seule).
Sans token configuré, la recherche échoue proprement (message d'erreur
affiché, reste de l'app inchangé). Nécessite d'avoir exécuté
`supabase/migrations/004_add_tmdb_fields.sql`.

## Commentaire libre

Un champ **Commentaire** dans le formulaire permet de noter tes impressions
en texte libre, en plus de la note. Un film commenté affiche un petit 💬 à
côté de son titre dans la liste. Nécessite
`supabase/migrations/003_add_review.sql`.

## Profil (pseudo + avatar)

Le bouton **Profil** (en haut à droite, une fois connecté) permet de définir
un pseudo et une image d'avatar (URL d'une image, pas d'upload pour l'instant)
affichés à la place de l'email brut. Chaque utilisateur a son propre profil,
isolé par RLS comme le reste — l'app supporte plusieurs comptes indépendants
(chacun avec son catalogue privé) dès lors qu'ils se connectent avec leur
propre email. Nécessite `supabase/migrations/005_add_profiles.sql`.

## Statistiques

Le bouton **📊 Statistiques** ouvre un aperçu calculé à la volée depuis les
films chargés (pas de requête dédiée) : nombre de films, note moyenne,
favoris, répartition grille/note manuelle, distribution des notes, activité
par mois, film le mieux et le moins bien noté.

## Succès

Le bouton **🏆 Succès** ouvre une page calculée elle aussi à la volée depuis
les films chargés (pas de table dédiée, pas de migration nécessaire) :

- **Paliers** : 4 séries cumulatives (Cinéphile, Grand favori, Critique en
  chef, Archiviste) avec un badge bronze/argent/or selon les seuils atteints
  et une barre de progression vers le palier suivant.
- **Secrets** : 10 succès cachés, plus insolites (ex. avoir donné 0.5/5 à un
  film, avoir ajouté un film entre minuit et 5h du matin…) — invisibles
  (`???`) tant qu'ils ne sont pas débloqués, pour garder la surprise.

Comme les statistiques, tout se recalcule à chaque ouverture à partir de
l'état actuel du catalogue : pas d'historique à maintenir, un succès peut se
"reverrouiller" si les films concernés sont supprimés ou modifiés.

## Prochaines étapes possibles

- Filtrer/trier par critère individuel, pas seulement par note globale
- Watchlist séparée des films déjà notés
- Journal chronologique / nombre de fois revu
- Happenings façon Letterboxd (défis/événements autour d'une sélection de films)
- Upload d'avatar réel (Supabase Storage) plutôt qu'une URL
- Cache local (offline-first) pour continuer à consulter/noter sans réseau
