# Roadmap — chartjs-sankey

Mis à jour le 25/10/2026.

## Objectif
Perso / hors ATOM (famille Loisir), T3 : plugin Chart.js de diagrammes de Sankey, publié sur npm sous `@larrym/chartjs-plugin-sankey`, sans revenu. Verdict PORTFOLIO « MAINTENIR » : paquet sain, répondre aux issues. Dépôt GitHub (`larrymotalavigne/chartjs-sankey`).

## Fait (récent)
- 12/10 — `4.0.0` sur `main` : première version à API figée et documentée (README, `CHANGELOG.md`, `MIGRATION.md`) ; publication automatique quand `main` porte une version absente de npm ; suite de régression visuelle (Playwright + pixelmatch, 8 diagrammes).
- 12/10 — rendu : flux retour (cycles) tracés autour du diagramme, tous les labels gardés dans le canvas.
- 11/10 — API stabilisée (options résolues par couches, événements via un plugin Chart.js, modèle de couleurs unifié) ; bandes décroisées aux nœuds, layout ~10x plus rapide.
- 11/10 — build CommonJS fonctionnel et déclarations de types complètes (publint, attw, smoke test `npm pack`) ; tests d'intégration du contrôleur (2 bugs corrigés) ; seuil de couverture 90 % lignes / 75 % branches.
- 11/10 — plan vers la version stable (ancien `ROADMAP.md`, jalons A à F ; numéro retenu : `4.0.0`).

## En cours
- Rien.

## Reste à faire
1. Publier réellement la `4.0.0` : le workflow « Publish to npm » du 12/10 a échoué à l'étape de publication ; npm sert toujours `3.0.0` en `latest` (constat du 25/10). Diagnostiquer (environnement `npm-publish`, jeton ou trusted publishing) puis relancer.
2. Répondre aux issues GitHub (0 ouverte au 25/10).
3. Restes du plan 1.0, sans échéance : accessibilité minimale (texte alternatif listant les flux), site de démo depuis `examples/`, `CONTRIBUTING.md` et modèles d'issues/PR, politique de support écrite ; tooltip au survol d'un nœud (non cassant).
4. CI : passer `actions/checkout` et `actions/setup-node` en version Node 24 (avertissement de dépréciation Node 20).

## Bloqué
- Rien côté agents ; la publication npm peut demander un geste de Larry sur le compte npm.

## Hors périmètre / décidé
- 11/10 — le jalon « 1.0 stable » sort sous le numéro `4.0.0` (le paquet était déjà en 3.0.0 sur npm).
- Enregistrement automatique conservé pour tous les formats ; pas d'options scriptables « contexte Chart.js ».
- Après la v1, idées non planifiées (alignement des nœuds, labels multilignes, mode sombre…), toutes non cassantes.
