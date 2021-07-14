module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
    ],
    "rules": {
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/explicit-module-boundary-types": 0
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      ''
    ],
  };