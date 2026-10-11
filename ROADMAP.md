# Roadmap vers la version stable « 1.0 »

> Analyse réalisée le 2026-10-11 sur `main` (`b0f05d6`, package `3.0.0`).
> Objectif : définir ce qu'il manque pour publier une première version **stable,
> documentée, testée et à API figée** du plugin.

---

## 0. Décision préalable : le numéro de version

Le paquet `@larrym/chartjs-plugin-sankey` est **déjà publié sur npm en `2.0.0`,
`2.0.1` et `3.0.0`**. Publier ensuite une `1.0.0` poserait problème :

- semver la classe *avant* `3.0.0` : `npm install` ne la proposerait jamais
  comme mise à jour, et les utilisateurs en `^3` ne la recevraient pas ;
- `npm publish` déplacerait quand même le tag `latest` vers `1.0.0`, ce qui
  ferait installer une version « plus ancienne » aux nouveaux utilisateurs.

**Recommandation :** considérer « 1.0 » comme un **jalon de stabilité** (API
figée, garanties semver strictes) et le publier sous le numéro **`4.0.0`**
(préversions `4.0.0-beta.x` / `4.0.0-rc.x`). Le reste de ce document parle de
« v1 stable » pour désigner ce jalon.

Alternative, uniquement si un vrai `1.0.0` est indispensable : publier sous un
**nouveau nom de paquet** (ex. `chartjs-plugin-sankey-flow`) et marquer
l'actuel comme `npm deprecate`. Coût : migration pour les utilisateurs
existants, perte de l'historique npm.

---

## 1. État des lieux

### Points forts
- Fonctionnalités riches pour un plugin jeune : orientation horizontale /
  verticale, 3 modes de couleur (`from` / `to` / `gradient`), effilement des
  flux, épinglage de colonnes, heuristique barycentrique anti-croisements,
  labels de nœuds et de flux, survol (dim/highlight), callbacks de clic,
  animations Chart.js.
- Logique de layout extraite en fonctions pures exportées et testées
  (44 tests Vitest, tous verts).
- Build Rollup UMD / UMD min / ESM, CI multi-versions Node, publication npm
  avec `--provenance`.

### Problèmes constatés (par gravité)

| # | Gravité | Problème | Où |
|---|---------|----------|----|
| P1 | 🔴 Bloquant | **`require()` renvoie un module vide.** `"type": "module"` + `main` pointant vers un UMD `.js` : Node le charge comme ESM, le wrapper UMD ne trouve ni `exports` ni `Chart` → `Object.keys(require(...))` = `[]`. Les consommateurs CommonJS (Jest, anciens bundlers, SSR) sont cassés. | `package.json`, `rollup.config.js` |
| P2 | 🔴 Bloquant | Pas de champ `exports`, pas de `sideEffects`, types servis depuis `src/` : résolution ESM/CJS/TS incohérente selon l'outil. | `package.json` |
| P3 | 🔴 Bloquant | **Les options globales sont ignorées.** Le contrôleur lit `dataset.x ?? SankeyController.defaults.x` au lieu du résolveur Chart.js : `Chart.defaults.datasets.sankey.*` et `options.datasets.sankey.*` n'ont aucun effet, aucune option scriptable. C'est un choix d'API qu'il faut trancher **avant** de figer l'API. | `src/index.js` (`updateElements`, `_positionNodes`, `_drawNodes`, `_drawFlowLabels`) |
| P4 | 🟠 Majeur | Gestion des événements hors Chart.js : `addEventListener('click'/'mousemove')` sur le canvas, coordonnées `clientX - rect.left` (ignore padding/bordure CSS, pas de support tactile, ignore `options.events`). Les flags `chart._sankeyClickBound` / `_sankeyMouseBound` cassent les clics si le premier dataset Sankey est retiré. | `_bindClickHandler`, `_bindMouseTracker`, `destroy` |
| P5 | 🟠 Majeur | **Labels coupés** : en mode `auto`, les labels de la colonne 0 sont dessinés à gauche de `chartArea.left` (et ceux de la dernière colonne à droite) sans réserver d'espace → hors canvas sans `layout.padding` manuel. | `_drawNodes`, `_positionNodes` |
| P6 | 🟠 Majeur | **Cycles et boucles** (`from === to`) acceptés par `isValidFlow` mais rendus comme des flux « à l'envers » (x2 < x) : dessin incorrect et `inRange` toujours faux. | `isValidFlow`, `_computeFlows`, `FlowElement` |
| P7 | 🟠 Majeur | Aucun test du contrôleur (layout réel, dessin, événements, cycle de vie) — signalé en TODO dans `CLAUDE.md`. | `test/` |
| P8 | 🟠 Majeur | README très en retard sur la 3.0 : seules `data` et `color` sont documentées (pas `orientation`, `colorMode`, `nodeColors`, `labels`, `flowLabels`, `nodes`, `onFlowClick`…). Pas de CHANGELOG. | `README.md` |
| P9 | 🟡 Moyen | Typage incomplet : entrée `ChartTypeRegistry` sans `parsedDataType` / `metaExtensions`, `SankeyController` ne dérive pas de `DatasetController`, aucun test de types. | `src/index.d.ts` |
| P10 | 🟡 Moyen | Incohérences de couleurs : `colorMode: 'from'/'to'` n'utilise la couleur de nœud que si `nodeColors` est défini (un `nodeColor` callback est ignoré pour les flux) ; pas de palette automatique pour les nœuds ; paramètre `nodeIndex` inutilisé. | `resolveNodeColor`, `_computeFlows` |
| P11 | 🟡 Moyen | Flux empilés dans l'ordre des données, pas selon la position du nœud cible → croisements évitables aux ports des nœuds. | `_computeFlows` |
| P12 | 🟡 Moyen | Performances : `assignNodeLevels` en O(V·E) ; `_drawNodes` recalcule la connexité en O(V·E) **à chaque frame** pendant le survol. | `assignNodeLevels`, `_drawNodes` |
| P13 | 🟢 Mineur | `maintainAspectRatio` / `aspectRatio` placés dans les *defaults du dataset* (sans effet) ; échelles linéaires `x`/`y` créées inutilement. | `static defaults` |
| P14 | 🟢 Mineur | Enregistrement automatique (`Chart.register` à l'import) : effet de bord non déclaré, conflit d'ids `sankey`/`flow` avec `chartjs-chart-sankey`. | fin de `src/index.js` |
| P15 | 🟢 Mineur | Outillage : pas de lint/format, pas de couverture, CI sur Node 18/20 (EOL), `author` vide, copyright sans titulaire. | `package.json`, `ci.yml`, `LICENSE` |

---

## 2. Roadmap

Chaque jalon est livrable indépendamment (une ou plusieurs PR) et publiable en
préversion. Estimations pour un développeur, à temps partiel.

### Jalon A — Packaging & fondations (≈ 1 semaine) → `3.1.0`
Corrige l'installabilité sans casser l'API.

- [x] **P1/P2** Sorties Rollup : `dist/chartjs-plugin-sankey.esm.js` (ESM),
      `dist/chartjs-plugin-sankey.cjs` (CJS), `dist/chartjs-plugin-sankey.umd.min.js`
      (CDN). Ajouter `exports` (`import` / `require` / `types`), `unpkg`/`jsdelivr`,
      `sideEffects`.
      *Fait : sorties `.esm.js` / `.cjs` / UMD (noms UMD conservés pour ne pas
      casser les URL CDN existantes), `exports`, `unpkg`/`jsdelivr`.
      `sideEffects` reporté au jalon C : l'import ESM enregistre le contrôleur,
      déclarer `false` laisserait les bundlers supprimer cet import.*
- [x] Générer/copier les types dans `dist/` (`index.d.ts` + `index.d.cts`).
- [x] Vérifier le paquet en CI avec `publint` et `@arethetypeswrong/cli`, plus
      un smoke test `require()` / `import` / `<script>` sur l'archive `npm pack`.
- [x] **P15** ESLint + Prettier, `npm run lint` en CI ; matrice Node 22/24/26 ;
      renseigner `author`, `LICENSE`, `engines`.
- [x] Ajouter `CHANGELOG.md` (format Keep a Changelog) en reprenant 2.0.0 → 3.0.0.

### Jalon B — Filet de sécurité : tests (≈ 1–2 semaines) → interne
À faire **avant** les refontes du jalon C pour détecter les régressions.

- [x] **P7** Tests d'intégration du contrôleur avec une vraie instance
      Chart.js : Vitest + `jsdom` + `canvas` (node-canvas) **ou** Vitest
      browser mode avec Playwright (Chromium déjà dispo en CI). Couvrir :
      positions des nœuds (2 orientations), épaisseurs/offsets des flux,
      données vides/invalides, `update()` après changement de données,
      `destroy()`, multi-datasets.
      *Fait (jsdom + contexte canvas simulé, 35 tests). Deux bugs trouvés et
      corrigés au passage : échelle `linear` non enregistrée (plantage avec un
      Chart.js « tree-shaké ») et écouteurs jamais retirés au `destroy()`.
      Le cas multi-datasets reste à couvrir avec la refonte des événements (P4).*
- [ ] Tests de régression visuelle (snapshots PNG) sur 5–6 diagrammes de
      référence (énergie, budget, parcours client, vertical, gradient, cycle).
- [x] **P9** Tests de types (`tsd` ou `tsc --noEmit` sur des fixtures).
- [x] Seuil de couverture en CI (90 % lignes, 75 % branches : V8 compte les branches différemment selon la version de Node).

### Jalon C — Stabilisation de l'API → `4.0.0-beta.1` ✅
Les changements cassants sont regroupés ici, une seule fois (détails dans
`MIGRATION.md`).

- [x] **P3** Résolution des options par couches : defaults du plugin →
      `Chart.defaults.datasets.sankey` → `options.datasets.sankey` → dataset
      (`labels`/`flowLabels` fusionnés en profondeur).
      *Choix : lecture des valeurs brutes plutôt que via `this.options`, dont
      le proxy appellerait `formatter`, `nodeColor`, `onFlowClick`… comme des
      options scriptables. Pas d'options scriptables « contexte Chart.js » :
      les callbacks gardent leurs signatures explicites.*
- [x] **P4** Événements via Chart.js (`SankeyPlugin`, hook `afterEvent`) :
      tactile, `options.events`, coordonnées correctes, plus de flags sur
      `chart`, plus de perte des clics au retrait d'un dataset.
      *Reporté après la 4.0 : tooltip au survol d'un nœud (non cassant).*
- [x] **P13/P14** Defaults nettoyés (`maintainAspectRatio`/`aspectRatio`
      retirés, échelles cachées déclarées dans les overrides).
      *Décision : l'enregistrement automatique est conservé pour tous les
      formats (contrôleur, élément, plugin, `LinearScale`). Le plugin n'agit
      que sur les graphiques sankey ; un enregistrement manuel reste possible.*
- [x] **P10** Modèle de couleurs unifié : palette par défaut des nœuds,
      `colorMode` appliqué quelle que soit la source de la couleur du nœud,
      couleurs dérivées à 50 % d'opacité (parsing via `chart.js/helpers`).
- [x] Revue des options : `labels.position` complété avec `'bottom'`,
      callbacks `nodeColor`/`nodeBorderColor` reçoivent `(id, node)`. `nodes`
      conservé tel quel (renommer n'apportait que de la migration).
      **API gelée** : ce qui est exporté et typé est public, le reste préfixé
      `_` est privé.

### Jalon D — Robustesse du rendu (≈ 1–2 semaines) → `4.0.0-beta.2`
- [x] **P5** Mesure des labels (`ctx.measureText`) et réservation automatique
      de la marge nécessaire (ou option `labels.overflow: 'auto' | 'clip'`).
      *Fait sur l'axe des niveaux (premier/dernier niveau). Reste : débordement
      sur l'axe des nœuds (labels au-dessus d'un nœud collé au bord).*
- [ ] **P6** Gestion explicite des cycles : rejeter les boucles `from === to`
      avec un avertissement, dessiner les flux retour en arc (ou les exclure
      via une option `cycles: 'ignore' | 'arc'`) ; `inRange` cohérent.
      *En partie : les boucles `from === to` sont ignorées. Reste : les flux
      retour des cycles plus longs.*
- [x] **P11** Tri des flux sortants/entrants par position du nœud
      opposé (comme d3-sankey) pour supprimer les croisements aux ports.
- [x] **P12** Index d'adjacence construit une fois par `update` ; connexité de
      survol pré-calculée ; benchmark sur 500 nœuds / 2 000 flux.
      *Fait : `assignNodeLevels` ~10x plus rapide (17 ms → 1,6 ms sur
      500 nœuds / 1 800 flux), connexité calculée une fois par frame.*
- [ ] Accessibilité minimale : texte alternatif généré (`aria-label` /
      contenu de repli listant les flux), contraste des couleurs par défaut.
- [ ] Support du `devicePixelRatio` et du redimensionnement vérifié par les
      tests visuels.

### Jalon E — Documentation & expérience développeur (≈ 1 semaine) → `4.0.0-rc.1`
- [x] **P8** README réécrit : tableau complet des options (avec défauts),
      format des données, événements, TypeScript, CDN avec version épinglée.
- [x] Guide de migration 3.x → 4.0 (changements cassants du jalon C).
- [ ] Site de démo (GitHub Pages) généré depuis `examples/` : un exemple par
      fonctionnalité, éditable en direct.
- [ ] `CONTRIBUTING.md`, modèles d'issues/PR, politique de sécurité.
- [ ] Mettre `CLAUDE.md` à jour (commandes lint, nouvelle structure dist).

### Jalon F — Release v1 stable (≈ quelques jours) → `4.0.0`
- [ ] Automatisation des versions (Changesets ou release-please) :
      CHANGELOG et tags générés à partir des PR.
- [ ] Publication npm via **trusted publishing** (OIDC) en remplacement du
      secret `NPM_TOKEN`, tag `next` pour les préversions.
- [ ] Période de RC d'au moins 2 semaines sans bug bloquant ouvert.
- [ ] Annonce + politique de support écrite (semver strict, versions de
      Chart.js et navigateurs supportées).

---

## 3. Critères de sortie de la v1 stable

La v1 est publiable quand **toutes** ces conditions sont réunies :

1. `import`, `require()` et `<script>` fonctionnent, vérifiés en CI sur
   l'archive publiée (`publint` + `attw` verts).
2. Toutes les options sont résolues par Chart.js et documentées ; l'API
   publique est figée et typée, tests de types verts.
3. Tests d'intégration du contrôleur + régression visuelle en CI, couverture
   ≥ 85 %.
4. Aucun problème 🔴 ou 🟠 du tableau ci-dessus encore ouvert.
5. README complet, CHANGELOG, guide de migration et démo en ligne.
6. Publication automatisée et reproductible, avec provenance.

## 4. Après la v1 (hors périmètre)

Idées à prioriser ensuite selon les retours utilisateurs, toutes ajoutables
sans changement cassant : alignement des nœuds (`justify`, `left`, `right`,
`center`), tri personnalisé des nœuds, labels multilignes, mode sombre
automatique, export de la mise en page (pour SSR), interactions clavier,
légende par catégorie de nœud, sélection/filtrage de chemins.
