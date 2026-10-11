/*
 * Smoke test for the built package (run after `npm run build`).
 *
 * Loads every published entry point the way consumers do and checks that
 * the public API is exported and the 'sankey' controller gets registered:
 *   - CommonJS: require('@larrym/chartjs-plugin-sankey')
 *   - ESM:      import('@larrym/chartjs-plugin-sankey')
 *   - Browser:  <script> UMD builds next to Chart.js's own UMD build
 *
 * The package name resolves through Node's self-referencing support, so the
 * "exports" map in package.json is exercised too.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PKG = '@larrym/chartjs-plugin-sankey';
const EXPORTS = [
  'SankeyController',
  'FlowElement',
  'Flow',
  'isValidFlow',
  'buildNodes',
  'assignNodeLevels',
  'groupByLevel',
  'reorderNodes',
  'default'
];

function checkApi(label, mod, registry) {
  for (const name of EXPORTS) {
    assert.ok(mod[name] !== undefined, `${label}: missing export "${name}"`);
  }
  assert.equal(mod.default, mod.SankeyController, `${label}: default export is not SankeyController`);
  assert.equal(mod.Flow, mod.FlowElement, `${label}: Flow is not an alias of FlowElement`);
  assert.ok(registry.controllers.get('sankey'), `${label}: 'sankey' controller not registered`);
  assert.ok(registry.elements.get('flow'), `${label}: 'flow' element not registered`);
  console.log(`ok - ${label}`);
}

function checkUmd(file) {
  const root = path.resolve(__dirname, '..');
  const context = { console };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'node_modules/chart.js/dist/chart.umd.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), context);
  checkApi(`umd (${file})`, context.ChartSankey, context.Chart.registry);
}

async function main() {
  const cjs = require(PKG);
  checkApi('require()', cjs, require('chart.js').registry);

  const esm = await import(PKG);
  const chartEsm = await import('chart.js');
  checkApi('import()', esm, chartEsm.registry);

  checkUmd('chartjs-plugin-sankey.js');
  checkUmd('chartjs-plugin-sankey.min.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
