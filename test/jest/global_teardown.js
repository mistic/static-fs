const del = require('del');
const { resolve } = require('path');

const { removeTestTempDirs } = require('../helpers/test_temp_dir');

// global teardown.js
module.exports = async () => {
  try {
    // await del(resolve('test/helpers/mock_project/node_modules'), { force: true });
    // await removeTestTempDirs();
  } catch (error) {
    console.error(error);
  }
};
