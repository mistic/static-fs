module.exports = {
  extends: [
    '@commitlint/config-conventional'
  ],
  rules: {
    // This was changed to have a bigger message on github
    // Default was 72
    'header-max-length': [2, 'always', 100],
  }
};
