import metarhia from 'eslint-config-metarhia';

export default [
  { ignores: ['dist/**', 'build/**', 'release/**', 'node_modules/**'] },
  ...metarhia,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { sourceType: 'module' },
  },
];
