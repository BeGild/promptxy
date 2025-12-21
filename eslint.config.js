import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  // Backend configuration
  {
    files: ['backend/src/**/*.ts', 'backend/src/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './backend/tsconfig.json',
      },
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  // Frontend configuration
  {
    files: [
      'frontend/src/**/*.tsx',
      'frontend/src/**/*.ts',
      'frontend/src/**/*.jsx',
      'frontend/src/**/*.js',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './frontend/tsconfig.json',
      },
      globals: {
        browser: true,
        es2021: true,
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': 'off',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    ignores: [
      'dist/',
      'backend/dist/',
      'frontend/dist/',
      'node_modules/',
      'backend/node_modules/',
      'frontend/node_modules/',
      'backend/tests/',
      'frontend/tests/',
      '*.config.js',
      '*.config.ts',
      'vitest.*.ts',
      'postcss.config.js',
      'tailwind.config.js',
      'vite.config.ts',
      'tsconfig.json',
      'tsconfig.node.json',
      'tsconfig.test.json',
      'docs/',
      'README.md',
      '*.md',
      'scripts/',
      'backend/public/',
      'index.html',
      'openspec/',
      'refence/',
      'eslint.config.js',
      'backend/eslint.config.js',
      'frontend/eslint.config.js',
      'backend/package.json',
      'frontend/package.json',
      'package.json',
      'package-lock.json',
    ],
  },
];
