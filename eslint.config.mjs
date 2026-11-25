import metarhia from 'eslint-config-metarhia';

export default [
  { ignores: ['dist/**', 'build/**', 'release/**', 'node_modules/**'] },
  ...metarhia,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { sourceType: 'module' },
    rules: {
      camelcase: ['error', { properties: 'never' }],
      'max-len': [
        'error',
        {
          code: 80,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreUrls: true,
        },
      ],
    },
  },
];
