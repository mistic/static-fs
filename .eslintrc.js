module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:jest/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:prettier/recommended'
  ],
  plugins: [
    'import',
    'jest',
    'prettier'
  ],

  env: {
    es6: true,
    node: true,
    jest: true
  },

  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 10
  },
  rules: {
    'no-constant-condition': [
      'error',
      {
        'checkLoops': false
      }
     ],
    'prettier/prettier': 'error'
  },

  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.json'],
      },
    },
  },
};
