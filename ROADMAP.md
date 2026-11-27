# ROADMAP — chartjs-sankey

> Famille : Loisir · Statut : actif · Mis à jour : 27/11/2026 · Lead : —

## Résumé
Plugin Chart.js de diagrammes de Sankey, publié sur npm sous `@larrym/chartjs-plugin-sankey` (perso / hors ATOM, sans revenu ; verdict PORTFOLIO « MAINTENIR » : paquet sain, répondre aux issues). La `4.0.0` (premier jalon « 1.0 stable », numéro retenu le 11/10 car le paquet était déjà en `3.0.0`) est sur `main` depuis le 12/10 : API figée, README, `CHANGELOG.md`, `MIGRATION.md`, régression visuelle. **npm sert toujours `3.0.0` en `latest` (constaté le 25/10 et le 26/11)** : le workflow « Publish to npm » du 12/10 a échoué à l'étape de publication. Dépôt GitHub `larrymotalavigne/chartjs-sankey`, 0 issue ouverte au 25/10.
Plan détaillé d'origine (analyse 11/10, problèmes P1 à P15, critères de sortie, idées après la v1) : `docs/ROADMAP-historique.md`.

## En cours — Publier la 4.0.0 sur npm
- [ ] SK1 — Publier la `4.0.0` : cause = `NPM_TOKEN` (posé le 26/02) refusé par npm (`E404` sur le PUT du run 38281126037, tests/build/lint verts) ; workflow passé en trusted publishing (OIDC, F2) — reste le geste de Larry : déclarer le trusted publisher sur npmjs.com puis relancer « Publish to npm » (carte déposée) — done when: `npm view @larrym/chartjs-plugin-sankey dist-tags` renvoie `latest: 4.0.0` — blocked: geste de Larry sur le compte npm

## Suivant
- [ ] SK2 — Répondre aux issues GitHub (0 ouverte au 25/10) — done when: aucune issue sans réponse
- [ ] D6 — Accessibilité minimale : texte alternatif généré (`aria-label` / contenu de repli listant les flux), contraste des couleurs par défaut — done when: texte alternatif présent et testé
- [ ] E3 — Site de démo (GitHub Pages) généré depuis `examples/`, un exemple par fonctionnalité — done when: démo en ligne
- [ ] E4 — `CONTRIBUTING.md`, modèles d'issues/PR, politique de sécurité — done when: fichiers présents
- [ ] F1 — Automatisation des versions (Changesets ou release-please) : CHANGELOG et tags depuis les PR — done when: release générée sans édition manuelle
- [ ] F2 — Publication npm par trusted publishing (OIDC) à la place de `NPM_TOKEN` : workflow préparé le 27/11 (même MR que SK1), tag `next` déjà en place pour les préversions — done when: publication sans secret réussie
- [ ] F3 — Période de RC d'au moins 2 semaines sans bug bloquant ouvert — done when: critère observé
- [ ] F4 — Annonce + politique de support écrite (semver strict, versions de Chart.js et navigateurs supportées) — done when: document publié
- [ ] SK3 — Tooltip au survol d'un nœud (non cassant, reporté après la 4.0) — done when: tooltip fonctionnel
- [ ] SK4 — CI : passer `actions/checkout` et `actions/setup-node` en version Node 24 (avertissement de dépréciation Node 20) — done when: avertissement disparu
- [ ] SK5 — Idées après la v1, non planifiées et non cassantes : alignement des nœuds (`justify`/`left`/`right`/`center`), tri personnalisé, labels multilignes, mode sombre automatique, export de la mise en page (SSR), interactions clavier, légende par catégorie, sélection/filtrage de chemins — done when: à prioriser selon les retours

## Lots pré-approuvés

## Gestes de Larry
- [ ] Compte npm : fournir/valider le jeton ou le trusted publishing pour la `4.0.0` si SK1 le demande — pas de carte ouverte — ~2 min

## Fait
- [x] A1 — P1/P2 Sorties Rollup ESM / CJS / UMD(+min), `exports`, `unpkg`/`jsdelivr` (`sideEffects` reporté : l'import ESM enregistre le contrôleur) — jalon A, `3.1.0`
- [x] A2 — Types copiés dans `dist/` (`index.d.ts` + `index.d.cts`)
- [x] A3 — CI `publint` + `@arethetypeswrong/cli` + smoke test `require()`/`import`/`<script>` sur `npm pack`
- [x] A4 — P15 ESLint + Prettier, lint en CI, matrice Node 22/24/26, `author`, `LICENSE`, `engines`
- [x] A5 — `CHANGELOG.md` (Keep a Changelog, 2.0.0 → 3.0.0)
- [x] B1 — P7 Tests d'intégration du contrôleur (jsdom + canvas simulé, 35 tests ; 2 bugs corrigés : échelle `linear` non enregistrée, écouteurs jamais retirés au `destroy()`)
- [x] B2 — Régression visuelle Playwright + pixelmatch, 8 diagrammes (HiDPI, labels), job CI dédié
- [x] B3 — P9 Tests de types (fixtures `tsc`)
- [x] B4 — Seuil de couverture CI 90 % lignes / 75 % branches
- [x] C1 — P3 Options résolues par couches (defaults → `Chart.defaults.datasets.sankey` → `options.datasets.sankey` → dataset), pas d'options scriptables « contexte Chart.js »
- [x] C2 — P4 Événements via Chart.js (`SankeyPlugin`, `afterEvent`) : tactile, `options.events`, plus de flags sur `chart`
- [x] C3 — P13/P14 Defaults nettoyés ; enregistrement automatique conservé pour tous les formats
- [x] C4 — P10 Modèle de couleurs unifié (palette par défaut, `colorMode` quelle que soit la source, couleurs dérivées à 50 %)
- [x] C5 — Revue des options (`labels.position: 'bottom'`, callbacks `(id, node)`) ; **API gelée**, `4.0.0-beta.1`
- [x] D1 — P5 Mesure des labels et marge réservée sur les deux axes
- [x] D2 — P6 Cycles : boucles `from === to` ignorées, flux retour tracés en arc dans un couloir dédié, hit test et tooltip
- [x] D3 — P11 Tri des flux par position du nœud opposé
- [x] D4 — P12 Index d'adjacence unique par `update`, connexité par frame ; `assignNodeLevels` ~10x plus rapide (17 ms → 1,6 ms sur 500 nœuds / 1 800 flux)
- [x] D5 — Support du `devicePixelRatio` et du redimensionnement vérifié par les tests visuels — `4.0.0-beta.2`
- [x] E1 — P8 README réécrit (options, données, événements, TypeScript, CDN épinglé)
- [x] E2 — Guide de migration 3.x → 4.0 (`MIGRATION.md`)
- [x] E5 — `CLAUDE.md` à jour — `4.0.0-rc.1`
- [x] SK0 — `4.0.0` sur `main` (chore(release) 8e5c0e2), publication automatique quand `main` porte une version absente de npm (12/10/2026)
