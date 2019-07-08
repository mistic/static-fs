const { resolve } = require('path');
const rimraf = require('rimraf');
const { removeTestTempDirs } = require('../helpers/test_temp_dir');

// global teardown.js
module.exports = async () => {
  try {
    rimraf.sync(resolve('test/helpers/mock_project/node_modules'));
    removeTestTempDirs();
  } catch (error) {
    console.error(error);
  }
};
