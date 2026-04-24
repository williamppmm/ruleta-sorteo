import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'release', 'node_modules']),

  // ── Archivos del browser (React / Vite renderer) ───────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/**/*.test.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // '^[A-Z_]' cubre falsos positivos de JSX (componentes importados en mayúscula
      // que ESLint no rastrea sin eslint-plugin-react/jsx-uses-vars).
      // caughtErrors:'none' elimina errores de catch(e) no usado.
      'no-unused-vars': ['error', {
        vars:              'all',
        args:              'after-used',
        caughtErrors:      'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
      }],
      // Solo warning para HMR — no debe bloquear el build ni el lint
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ── Archivos Node (tests, configs, electron) ───────────────────────────
  {
    files: [
      'src/**/*.test.js',
      '*.config.js',
      '*.config.cjs',
      'electron/**/*.cjs',
      'postcss.config.js',
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        vars:              'all',
        args:              'after-used',
        caughtErrors:      'none',
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
      }],
    },
  },
])
