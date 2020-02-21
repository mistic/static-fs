import { runTestCaseInIsolatedEnv } from './helpers';

const mockProject = require(global.__mock_project_path);

describe('Static Fs Runtime Patch', () => {
  test('not possible to require before module_loader patch', async () => {
    let stderr = '';

    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_module_loader_failure');
    } catch (error) {
      stderr = error.stderr;
    }

    expect(stderr).toEqual(expect.stringContaining(`Error: Cannot find module './static_fs_mock/patched/path/file'`));
  });

  test('possible to require after module_loader patch', async () => {
    const { stdout } = await runTestCaseInIsolatedEnv(mockProject, 'patch_module_loader_success');
    expect(stdout).toEqual('1');
  });

  test('not possible to require after undo() module_loader patch', async () => {
    let specificErrorCount = 0;

    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_module_loader_failure_after_undo');
    } catch (error) {
      const stderr = error.stderr;
      const expectedError = `Error: Cannot find module './static_fs_mock/patched/path/file'`;
      specificErrorCount = stderr.split(expectedError).length - 1;
    }

    expect(specificErrorCount).toEqual(1);
  });

  test('not possible to fs.statSync before filesystem patch', async () => {
    let stderr = '';

    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_filesystem_failure');
    } catch (error) {
      stderr = error.stderr;
    }

    expect(stderr)
      .toEqual(expect.stringContaining(`Error: ENOENT: no such file or directory, stat './static_fs_mock/patched/path/file.js'`));
  });

  test('possible to fs.readFileSync after filesystem patch', async () => {
    const { stdout } = await runTestCaseInIsolatedEnv(mockProject, 'patch_filesystem_success');
    expect(stdout).toEqual('module.exports = 1');
  });

  test('not possible to fs.readFileSync after undo() filesystem patch', async () => {
    let specificErrorCount = 0;

    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_filesystem_failure_after_undo');
    } catch (error) {
      const stderr = error.stderr;
      const expectedError = `Error: ENOENT: no such file or directory, open './static_fs_mock/patched/path/file.js'`;
      specificErrorCount = stderr.split(expectedError).length - 1;
    }

    expect(specificErrorCount).toEqual(1);
  });
});
