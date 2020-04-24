'use strict';
const execa = require('execa');
const rimraf = require('rimraf');
const { promisify } = require('util');

const rimrafAsync = promisify(rimraf);

const checkIfBuildStepSucceed = (result) => {
  if (result.exitCode !== 0) {
    console.error(result.stderr);
    console.error('Build failed');
    process.exit(1);
  }
};

(async () => {
  console.log('Start building process');

  console.log('Cleaning old dist folder');
  await rimrafAsync('dist');

  const transpileResult = await execa.command('node scripts/transpile_node_api_code');
  checkIfBuildStepSucceed(transpileResult);
  console.log(transpileResult.stdout);

  const bundleResult = await execa.command('node scripts/bundle_runtime');
  checkIfBuildStepSucceed(bundleResult);
  console.log(bundleResult.stdout);

  console.log('End building process');
  process.exit(0);
})();
