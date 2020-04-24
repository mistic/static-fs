'use strict';
const execa = require('execa');

(async () => {
  // Build the code including filesystem, generator and common utilities
  // that can be imported/used from the node api.
  //
  // Exclude the runtime code as we'll want to generate a single runtime file.
  console.log('Transpiling node api code');
  const { exitCode, stderr, stdout } = await execa.command('babel src --out-dir dist --ignore src/runtime');

  if(exitCode !== 0) {
    console.error(stderr);
    console.error('Transpilation of node api code failed');
    process.exit(1);
  }

  console.log(stdout);
  console.log('Transpilation of node api code end');
  process.exit(0);
})();
