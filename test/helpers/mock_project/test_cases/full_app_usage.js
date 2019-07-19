'use strict';

const mock_child_process_module = require('mock_child_process_module');
const mock_native_module = require('mock_native_module');
const mock_simple_module = require('mock_simple_module');

(async () => {
  await mock_child_process_module.run();
  await mock_native_module.run();
  await mock_simple_module.run();

  console.log('mock_project has run');
})();
