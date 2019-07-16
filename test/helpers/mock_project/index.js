'use strict';

module.exports = {
  'full_app_usage': require.resolve('./test_cases/full_app_usage'),
  'patch_filesystem_failure': require.resolve('./test_cases/patch/filesystem_failure'),
  'patch_filesystem_failure_after_undo': require.resolve('./test_cases/patch/filesystem_failure_after_undo'),
  'patch_filesystem_success': require.resolve('./test_cases/patch/filesystem_success'),
  'patch_module_loader_failure': require.resolve('./test_cases/patch/module_loader_failure'),
  'patch_module_loader_failure_after_undo': require.resolve('./test_cases/patch/module_loader_failure_after_undo'),
  'patch_module_loader_success': require.resolve('./test_cases/patch/module_loader_success')
};
