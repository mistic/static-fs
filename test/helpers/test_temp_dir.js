const cpy = require('cpy');
const { mkdtemp, realpathSync } = require('fs');
const os = require('os');
const { join, resolve } = require('path');
const del = require('del');
const { promisify } = require('util');

const mkdtempAsync = promisify(mkdtemp);

async function createTestTempDir() {
  try {
    const createdTempTestDir = await mkdtempAsync(join(realpathSync(os.tmpdir()), 'static-fs-test-'));
    // copy mock_project into it
    await cpy('./**/*', createdTempTestDir, {
      cwd: resolve('test/helpers/mock_project'),
      parents: true
    });

    return createdTempTestDir;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function removeTestTempDirs() {
  await del(join(os.tmpdir(), 'static-fs-test-*'), { force: true });
}

module.exports = {
  createTestTempDir,
  removeTestTempDirs
};
