const packageJson = require("./package.json")

module.exports = {
  globals: {
    process: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    es6: true,
    browser: true,
    amd: true,
    node: true,
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx', '.js', '.jsx'],
    },
    'import/resolver': {
      alias: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  overrides: [
    {
      files: ['playwright/*.ts', 'tests/*.spec.ts', 'tests/*.spec.tsx'],
      settings: {
        'import/resolver': {
          alias: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          },
          typescript: {
            alwaysTryTypes: true,
            project: './tests/tsconfig.node.json',
          },
        },
      },
    },
    {
      files: ['api-codegen/*.js', 'api-codegen/*.cjs'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: ['prettier', '@typescript-eslint'],
  rules: {
    "import/no-unresolved": ["error", { ignore: Object.keys(packageJson.peerDependencies) }],
    'no-duplicate-imports': 'error',
    'no-trailing-spaces': 'error',
    'max-len': [
      'warn',
      {
        ignorePattern: '^import\\s.+\\sfrom\\s.+;$',
        code: 80,
        comments: 600,
        ignoreTemplateLiterals: true,
        ignoreUrls: true,
        ignoreStrings: true,
      },
    ],
    'no-console': [
      'error',
      {
        allow: ['error', 'warn', 'info'],
      },
    ],
    'no-multiple-empty-lines': [
      'error',
      {
        max: 1,
        maxEOF: 0,
      },
    ],
    'object-shorthand': 'error',
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
        printWidth: 80,
        tabWidth: 2,
        trailingComma: 'all',
        semi: true,
        singleQuote: true,
      },
    ],
    'no-empty-interface': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'error',
      { classes: false, functions: false },
    ],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'import/order': [
      'error',
      {
        groups: [
          ['external'],
          ['builtin'],
          ['internal'],
          ['parent'],
          ['sibling'],
          ['object'],
          ['index'],
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
  },
};
