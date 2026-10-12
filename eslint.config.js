import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', 'test/types/']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'examples/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser
    }
  },
  {
    files: ['test/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser }
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node
    }
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node
    }
  }
];
