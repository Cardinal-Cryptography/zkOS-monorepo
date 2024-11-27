const commonImportsRestrictionPatterns = [{
  /*
    Modules are often divided into sub-modules for readability and maintainability, where those
    sub-modules are internal to the "root" modules. This rule prevents importing those sub-modules,
    which happens often by laziness or an overlook, in order to keep the modules SOLID.
  */
  group: ['@/*/*/**'],
  message: 'Direct importing of sub-modules is not allowed. Turn the sub-module into a root module' +
    ' or reexport it from the "owning" module if you really need to use it directly.',
}, {
  /*
    This rule promotes abstracting module's internal details away from the consumers. For instance,
    a consumer should not care if a module is a simple, single-file module "src/module.ts" or
    a complex directory with "src/module/index.ts" file: in both cases, the import should say:
    "import from 'src/module'".
   */
  group: ['**/index.*', '**/index', '!**/*.css'],
  message: 'Take advantage of the fact that "index" files are implicit - import the directory instead.',
}];

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:@tanstack/eslint-plugin-query/recommended"
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs", 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'validate-envs.ts'],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh', '@tanstack/query', 'import'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    quotes: ['error', 'single'],
    'comma-dangle': ['error', {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'only-multiline',
    }],
    'eol-last': ['error', 'always'],
    'import/order': ['error', {
      pathGroups: [
        {
          pattern: 'src/**',
          group: 'internal',
        },
        {
          pattern: '.storybook/**',
          group: 'internal',
        },
      ],
      distinctGroup: true,
      pathGroupsExcludedImportTypes: ['builtin'],
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
      },
    }],
    '@typescript-eslint/object-curly-spacing': ['error', 'always', {
      arraysInObjects: true,
      objectsInObjects: false,
    }],
    'operator-linebreak': ['error', 'after'],
    'react/jsx-indent': ['error', 2, { checkAttributes: true, indentLogicalExpressions: true }],
    'react/display-name': 'off',
    'react/react-in-jsx-scope': 'off',
    'quote-props': ['error', 'as-needed'],
    indent: ['error', 2],
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
    'no-multi-spaces': ['error'],
    'react/jsx-props-no-multi-spaces': 'error',
    semi: ['error', 'always'],
    'react/jsx-max-props-per-line': ['error', { maximum: 1, when: 'multiline' }],
    'max-len': ['error', { code: 120, ignoreComments: true, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true }],
    'object-shorthand': [2, 'always'],
    'no-restricted-imports': ['error', {
      patterns: commonImportsRestrictionPatterns,
    }],
    'no-trailing-spaces': 'error',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ],
    'import/extensions': ['error', 'never', { 'json': 'always' }]
  },
  overrides: [
    {
      files: ['./**/*.{ts,tsx}'],
      extends: [
        'plugin:@typescript-eslint/strict-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
      ],
      parser: '@typescript-eslint/parser',
      rules: {
        '@typescript-eslint/member-delimiter-style': ['error', {
          multiline: { delimiter: 'comma', requireLast: true },
          singleline: { delimiter: 'comma', requireLast: false },
        }],
        '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreVoidOperator: true }],
        '@typescript-eslint/no-meaningless-void-operator': 'off',
        '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        '@typescript-eslint/semi': ['error', 'always'],
        '@typescript-eslint/unbound-method': 'off',
        indent: ['off'],
        '@typescript-eslint/indent': ['error', 2, {
          ignoredNodes: [
            'TaggedTemplateExpression > TemplateLiteral *',
          ],
        }],
        '@typescript-eslint/restrict-template-expressions': [
          'error',
          {
            'allowNumber': true
          }
        ],
      },
    },
    {
      files: ['.eslintrc.cjs'],
      env: {
        node: true,
      },
    },
  ],
};
