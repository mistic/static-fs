const execa = require('execa');
const os = require('os');
const { resolve } = require('path');
const rimraf = require('rimraf');

// global setup.js
module.exports = async () => {
  try {
    // That would speedup node-gyp rebuild
    process.env.JOBS = Math.max(1, os.cpus().length -1 );

    rimraf.sync(resolve('test/helpers/mock_project/node_modules'));
    execa.shellSync('yarn install', { cwd: 'test/helpers/mock_project' });
    execa.shellSync('yarn build', { cwd: 'test/helpers/mock_project/node_modules/static-fs' });
  } catch (error) {
    console.error(error);
  }
};
