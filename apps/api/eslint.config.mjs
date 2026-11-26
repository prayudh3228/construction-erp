import base from '@erp/config/eslint';

export default [
  ...base,
  {
    // Nest dependency injection needs runtime imports of classes used only as types.
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
];
