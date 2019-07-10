module.exports = {
  globalSetup: './jest/global_setup.js',
  globalTeardown: './jest/global_teardown.js',
  rootDir: '../',
  runner: './jest/test_runner.js',
  setupFilesAfterEnv: [
    './jest/global_jest_env_setup.js'
  ],
  testSequencer: './jest/test_sequencer.js'
};
