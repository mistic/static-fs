import { sep } from 'path';
import { runTestCaseInIsolatedEnv } from './helpers';

const mockProject = require(global.__mock_project_path);

describe('Static Fs Runtime Patch', () => {
  test('not possible to require before module_loader patch', async () => {
    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_module_loader_failure');
    } catch (error) {
      expect(error.stderr).toEqual(expect.stringContaining(`Error: Cannot find module '.${sep}static_fs_mock${sep}patched${sep}path${sep}file'`));
    }
  });

  test('possible to require after module_loader patch', async () => {
    const { stdout } = await runTestCaseInIsolatedEnv(mockProject, 'patch_module_loader_success');
    expect(stdout).toEqual('1');
  });

  test('not possible to require after undo() module_loader patch', async () => {
    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_module_loader_failure_after_undo');
    } catch (error) {
      const stderr = error.stderr;
      const expectedError = `Error: Cannot find module '.${sep}static_fs_mock${sep}patched${sep}path${sep}file'`;
      const specificErrorCount = stderr.split(expectedError).length - 1;
      expect(specificErrorCount).toEqual(1);
    }
  });

  test('not possible to fs.statSync before filesystem patch', async () => {
    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_filesystem_failure');
    } catch (error) {
      expect(error.stderr)
        .toEqual(expect.stringContaining(`Error: ENOENT: no such file or directory, stat '.${sep}static_fs_mock${sep}patched${sep}path${sep}file.js'`));
    }
  });

  test('possible to fs.statSync after filesystem patch', async () => {
    const { stdout } = await runTestCaseInIsolatedEnv(mockProject, 'patch_filesystem_success');
    expect(stdout).toEqual('module.exports = 1');
  });

  test('not possible to fs.statSync after undo() filesystem patch', async () => {
    try {
      await runTestCaseInIsolatedEnv(mockProject, 'patch_filesystem_failure_after_undo');
    } catch (error) {
      const stderr = error.stderr;
      const expectedError = `Error: ENOENT: no such file or directory, open '.${sep}static_fs_mock${sep}patched${sep}path${sep}file.js'`;
      const specificErrorCount = stderr.split(expectedError).length - 1;
      expect(specificErrorCount).toEqual(1);
    }
  });
});
