// Shared ESLint flat config for every workspace.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Base rules for TypeScript code (API, shared, scripts). */
export const base = tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/generated/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  prettier,
);

/** Base rules plus React hooks and browser globals. */
export const react = tseslint.config(...base, {
  plugins: { 'react-hooks': reactHooks },
  languageOptions: { globals: { ...globals.browser } },
  rules: { ...reactHooks.configs.recommended.rules },
});

export default base;
