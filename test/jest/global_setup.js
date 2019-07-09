const del = require('del');
const execa = require('execa');
const os = require('os');
const { resolve } = require('path');

// global setup.js
module.exports = async () => {
  try {
    // That would speedup node-gyp rebuild
    process.env.JOBS = Math.max(1, os.cpus().length -1 );

    await del(resolve('test/helpers/mock_project/node_modules'), { force: true });
    execa.shellSync('yarn install', { cwd: 'test/helpers/mock_project' });
    execa.shellSync('yarn build', { cwd: 'test/helpers/mock_project/node_modules/static-fs' });
  } catch (error) {
    console.error(error);
  }
};
