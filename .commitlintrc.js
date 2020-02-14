module.exports = {
  extends: [
    '@commitlint/config-conventional'
  ],
  rules: {
    // This was changed to always show the entire message on github
    // Default was 100
    'header-max-length': [2, 'always', 64],
  }
};
