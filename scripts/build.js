const execa = require('execa');
const rimraf = require('rimraf');
const { promisify } = require('util');

const rimrafAsync = promisify(rimraf);

(async () => {
  try {
    console.log('Start building process');

    console.log('Cleaning old dist folder');
    await rimrafAsync('dist');

    const transpileResult = await execa.command('node scripts/transpile_node_api_code');
    console.log(transpileResult.stdout);

    const bundleResult = await execa.command('node scripts/bundle_runtime');
    console.log(bundleResult.stdout);

    console.log('End building process');
  } catch (error) {
    console.error(error);
  }
})();
