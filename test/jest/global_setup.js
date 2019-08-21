const execa = require('execa');
const os = require('os');
const { resolve } = require('path');
const rimraf = require('rimraf');
const { promisify } = require('util');

const { createTestTempDir } = require('../helpers');

const rimRafAsync = promisify(rimraf);

// global setup.js
module.exports = async () => {
  try {
    // That would speedup node-gyp rebuild
    process.env.JOBS = Math.max(1, os.cpus().length -1 );

    await rimRafAsync(resolve('test/helpers/mock_project/node_modules'), { glob: false });
    execa.shellSync('yarn install --no-lockfile', { cwd: 'test/helpers/mock_project' });
    execa.shellSync('yarn build', { cwd: 'test/helpers/mock_project/node_modules/static-fs' });

    process.env.GLOBAL_MOCK_PROJECT_PATH = await createTestTempDir();
  } catch (error) {
    console.error(error);
  }
};
