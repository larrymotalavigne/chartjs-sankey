import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

const banner = `/*!
 * chartjs-plugin-sankey
 * Version: ${require('./package.json').version}
 * Copyright (c) 2025
 * Licensed under MIT
 */`;

export default [
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/chartjs-plugin-sankey.js',
        format: 'umd',
        name: 'ChartSankey',
        banner,
        globals: {
          'chart.js': 'Chart'
        }
      },
      {
        file: 'dist/chartjs-plugin-sankey.min.js',
        format: 'umd',
        name: 'ChartSankey',
        banner,
        plugins: [terser()],
        globals: {
          'chart.js': 'Chart'
        }
      },
      {
        file: 'dist/chartjs-plugin-sankey.esm.js',
        format: 'es',
        banner
      }
    ],
    external: ['chart.js'],
    plugins: [
      resolve(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**'
      })
    ]
  }
];
