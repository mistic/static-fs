const execa = require('execa');

(async () => {
  try {
    // Build the code including filesystem, generator and common utilities
    // that can be imported/used from the node api.
    //
    // Exclude the runtime code as we'll want to generate a single runtime file.
    console.log('Transpiling node api code');
    const { stdout } = await execa.shell('babel src --out-dir dist --ignore src/runtime');
    console.log(stdout);
    console.log('Transpilation of node api code end');
  } catch (error) {
    console.error(error);
  }
})();
