import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import { copyFileSync, mkdirSync, readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const banner = `/*!
 * @larrym/chartjs-plugin-sankey
 * Version: ${pkg.version}
 * Copyright (c) 2025-2026 Larry Mota--Lavigne
 * Licensed under MIT
 */`;

/**
 * Ship the hand-written declarations next to the bundles: `.d.ts` for the
 * ESM entry and `.d.cts` for the CommonJS entry (required by TypeScript's
 * node16/nodenext resolution).
 */
function copyTypes() {
  return {
    name: 'copy-types',
    writeBundle() {
      mkdirSync('dist', { recursive: true });
      copyFileSync('src/index.d.ts', 'dist/chartjs-plugin-sankey.d.ts');
      copyFileSync('src/index.d.ts', 'dist/chartjs-plugin-sankey.d.cts');
    }
  };
}

const umdGlobals = { 'chart.js': 'Chart', 'chart.js/helpers': 'Chart.helpers' };

export default [
  {
    input: 'src/index.js',
    output: [
      // Browser <script> builds (CDN). Loaded as classic scripts, so the
      // package's "type": "module" does not apply to them.
      {
        file: 'dist/chartjs-plugin-sankey.js',
        format: 'umd',
        name: 'ChartSankey',
        exports: 'named',
        banner,
        globals: umdGlobals
      },
      {
        file: 'dist/chartjs-plugin-sankey.min.js',
        format: 'umd',
        name: 'ChartSankey',
        exports: 'named',
        banner,
        plugins: [terser()],
        globals: umdGlobals
      },
      // Node / bundler builds, resolved through package.json "exports".
      {
        file: 'dist/chartjs-plugin-sankey.cjs',
        format: 'cjs',
        exports: 'named',
        banner
      },
      {
        file: 'dist/chartjs-plugin-sankey.esm.js',
        format: 'es',
        banner
      }
    ],
    external: ['chart.js', 'chart.js/helpers'],
    plugins: [
      resolve(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**'
      }),
      copyTypes()
    ]
  }
];
