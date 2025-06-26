const packageJson = require('./package.json');

module.exports = {
  extends: [require.resolve('js2me-eslint-config')],
  rules: {
    'import/no-unresolved': [
      'error',
      { ignore: Object.keys(packageJson.peerDependencies) },
    ],
    'unicorn/prevent-abbreviations': 'off',
    'sonarjs/no-redundant-optional': 'off',
    'sonarjs/deprecation': 'off',
    'sonarjs/redundant-type-aliases': 'off',
    'unicorn/no-useless-undefined': 'off'
  },
};
