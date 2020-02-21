const execa = require('execa');

(async () => {
  try {
    console.log('Start building process');

    console.log('Cleaning old dist folder');
    await execa.command('rm -rf dist');

    const transpileResult = await execa.command('node scripts/transpile_node_api_code');
    console.log(transpileResult.stdout);

    const bundleResult = await execa.command('node scripts/bundle_runtime');
    console.log(bundleResult.stdout);

    console.log('End building process');
  } catch (error) {
    console.error(error);
  }
})();
