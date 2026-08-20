# Critique de films

Outil personnel pour noter les films selon une grille de critères fixe, pour éviter
d'être influencé après coup par les avis lus ailleurs. Remplace l'ancien fichier Excel.

## Structure

```
critique-films/
├── index.html      → structure de la page
├── css/style.css    → tout le style (thème pellicule/salle de projection)
├── js/data.js        → les 7 critères (définitions, repères, questions) + les films importés de l'Excel
└── js/app.js          → logique (rendu, sauvegarde, formulaire de notation)
```

## Lancer le projet

Aucune installation nécessaire, c'est du HTML/CSS/JS pur, sans build.

Ouvrir `index.html` directement dans un navigateur, ou pour éviter les soucis de
CORS avec certains navigateurs, servir le dossier en local :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Stockage des données

Les films sont sauvegardés dans le `localStorage` du navigateur — donc propre à
chaque navigateur/appareil, rien n'est envoyé sur un serveur. Au premier
lancement, l'app se préremplit avec les films de l'Excel d'origine.

Limite à avoir en tête : si tu vides le cache du navigateur ou changes
d'appareil, les données ne suivent pas. Une piste d'évolution possible :
ajouter un export/import JSON, ou brancher une vraie base (voir section
Prochaines étapes).

## La grille de notation (v1.2)

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

## Prochaines étapes possibles

- Export/import JSON des données
- Filtrer/trier par critère individuel, pas seulement par note globale
- Champs additionnels (année, réalisateur, date de visionnage, nombre de fois vu)
- Déploiement (GitHub Pages, Netlify) pour y accéder depuis n'importe où
