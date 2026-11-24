import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'

export default [
  js.configs.recommended,
  ...tseslint.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/explicit-module-boundary-types': 0,
    },
  },
]
