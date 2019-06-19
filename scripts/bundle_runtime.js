const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const path = require('path');

(async () => {
  console.log('Bundling runtime file');

  const webpackPromise = new Promise((resolve, reject) => {
    // generate single runtime file
    webpack({
      target: 'node',
      externals: [nodeExternals()],
      entry: {
        app: [
          './src/runtime/index.js'
        ]
      },
      output: {
        path: path.resolve(__dirname, '../dist'),
        filename: 'runtime/index.js'
      },
      optimization: {
        minimize: false,
        namedModules: true
      }
    }, (err, stats) => { // Stats Object
      const webpackErrors = err || (stats.hasErrors() && stats.toString({
        all: false,
        colors: true,
        errors: true,
        errorDetails: true,
        moduleTrace: true
      }));

      if (webpackErrors) {
       reject(webpackErrors);
      }

      resolve(stats);
    });
  });

  try {
    await webpackPromise;
  } catch (error) {
    console.log(error);
  }

  console.log('Bundling end');
})();
