const rimraf = require('rimraf');
const { resolve } = require('path');
const { promisify } = require('util');

const rimrafAsync = promisify(rimraf);
const { removeTestTempDirs } = require('../helpers/test_temp_dir');

// global teardown.js
module.exports = async () => {
  try {
    await rimrafAsync(resolve('test/helpers/mock_project/node_modules'), { glob: false });
    await removeTestTempDirs();
  } catch (error) {
    console.error(error);
  }
};
