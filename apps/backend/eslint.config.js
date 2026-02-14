import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**']
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module'
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      'comma-dangle': ['error', 'always-multiline'],
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-nested-ternary': 'warn',
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'warn',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' }
      ]
    }
  }
]
