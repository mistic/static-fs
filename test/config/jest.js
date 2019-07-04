const execa = require('execa');

try {
  execa.shellSync('yarn install', { cwd: 'test/helpers/mock_project' });
} catch (error) {
  console.log(error);
}

module.exports = {
  rootDir: '../'
};
