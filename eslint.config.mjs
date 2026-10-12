import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';


export default tseslint.config(
  { ignores: ['**/dist/', 'client/public/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'linebreak-style': ['error', 'unix'],
      'max-len': ['error', 100],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always']
    }
  },
  {
    files: ['client/webpack.config.js'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  }
);
