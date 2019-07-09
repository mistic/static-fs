module.exports = {
  globalSetup: './jest/global_setup.js',
  globalTeardown: './jest/global_teardown.js',
  rootDir: '../',
  setupFilesAfterEnv: [
    './jest/global_jest_env_setup.js'
  ]
};
