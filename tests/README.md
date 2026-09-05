# Tests

Suite de tests de régression pour Kinet — nés d'une session de correction de
bugs (import Letterboxd, matching TMDB, pagination), formalisés ici pour
que ces bugs précis ne reviennent pas silencieusement plus tard.

**Aucune dépendance npm** : cohérent avec le reste du projet (100%
vanilla, sans build). Node seul suffit (18+ pour `fetch` global, utilisé
par le test live).

## Lancer les tests

```
node tests/run-all.js
```

Sort en code 1 si un test échoue (utilisable par un futur hook CI ou
pre-push). Chaque fichier `*.test.js` peut aussi se lancer seul :

```
node tests/letterboxd-import.test.js
```

## Fichiers `*.live.js`

`tests/tmdb-matching.live.js` interroge la VRAIE API TMDB (nécessite
`js/tmdbConfig.js`, déjà présent dans ce repo, + un accès réseau). **Pas**
exécuté par `run-all.js` — trop lent/flaky pour un lancement systématique,
et une réponse TMDB peut légitimement changer avec le temps (popularité
d'un film qui évolue). À lancer à la main :

```
node tests/tmdb-matching.live.js
```

ponctuellement, ou si un nouveau mismatch d'import est signalé — c'est
exactement comme ça que le bug "The Handmaiden importé sous le mauvais
film" a été diagnostiqué (voir le commentaire en tête de ce fichier).

## Comment ça marche

- `tests/helpers/vm-harness.js` — charge un ou plusieurs fichiers `js/*.js`
  dans un `vm.createContext()` avec des stubs DOM minimalistes (pas de
  jsdom : juste assez pour que le wiring `document.getElementById('x')
  .addEventListener(...)` exécuté en bas de chaque fichier au chargement ne
  plante pas). Un test qui a besoin d'un comportement DOM précis enrichit
  son propre contexte plutôt que d'alourdir ce module partagé.
- `tests/helpers/tiny-test.js` — micro-framework (`test(name, fn)` +
  `run(label)`), fn peut être `async`. Pas de assertion library dédiée :
  `assert` du cœur de Node suffit.
- `tests/fixtures/` — données figées (ex. une vraie réponse TMDB capturée
  en session) pour des tests hors-ligne, déterministes, reproductibles.

### Piège vm à connaître

Du code exécuté dans un `vm.createContext()` produit des objets/tableaux
dont le prototype vient d'un **autre realm** que celui du fichier de test
lui-même — `assert.deepStrictEqual` les considère différents même avec un
contenu identique. Repasser par
`JSON.parse(JSON.stringify(actual))` avant de comparer (voir
`deepEqualAcrossRealms` dans `letterboxd-import.test.js`) contourne le
problème en comparant la structure, peu importe quel realm l'a produite.

## Ajouter un test

Un nouveau bug corrigé mérite un test qui l'aurait attrapé — pas
obligatoire pour tout, mais systématique pour un bug qui a atteint la
production (comme ceux couverts ici). Un nouveau fichier `xxx.test.js`
dans ce dossier est automatiquement ramassé par `run-all.js` — pas besoin
de l'y référencer à la main.
