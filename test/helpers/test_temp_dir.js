const cpy = require('cpy');
const { mkdtemp } = require('fs');
const os = require('os');
const { join, resolve } = require('path');
const rimraf = require('rimraf');
const { promisify } = require('util');

const mkdtempAsync = promisify(mkdtemp);

const created_test_temp_dirs = {};

async function createTestTempDir() {
  try {
    const createdTempTestDir = await mkdtempAsync(join(os.tmpdir(), 'static-fs-test-'));

    // copy mock_project into it
    await cpy('./mock_project', createdTempTestDir, {
      parents: true,
      cwd: resolve('test/helpers')
    });

    created_test_temp_dirs[createdTempTestDir] = true;
    return createdTempTestDir;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function removeTestTempDirs() {
  Object.keys(created_test_temp_dirs).forEach(dir => {
    rimraf.sync(dir);
    delete created_test_temp_dirs[dir];
  });
}

module.exports = {
  createTestTempDir,
  removeTestTempDirs
};
