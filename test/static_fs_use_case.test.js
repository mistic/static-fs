import { runTestCaseInIsolatedEnv } from './helpers';

const mockProject = require(global.__mock_project_path);
let mockProjectStdout = null,
  mockProjectStderr = null;

describe('Static Fs Use Case', () => {
  beforeAll(async () => {
    const mockProjectProcess = await runTestCaseInIsolatedEnv(mockProject, 'full_app_usage');
    mockProjectStdout = mockProjectProcess.stdout;
    mockProjectStderr = mockProjectProcess.stderr;
  });

  test('use case of run a mock project loading modules from the static fs', () => {
    const countStringOccurrences = (str, occurrence) => str.split(occurrence).length - 1;

    expect(countStringOccurrences(mockProjectStdout, 'mock_child_process_module has run')).toBe(1);
    expect(countStringOccurrences(mockProjectStdout, 'mock_simple_module has run')).toBe(2);
    expect(countStringOccurrences(mockProjectStdout, 'mock_native_module has run')).toBe(1);
    expect(countStringOccurrences(mockProjectStdout, 'mock_project has run')).toBe(1);
    expect(countStringOccurrences(mockProjectStdout, 'mock_simple_module_non_bundled has run')).toBe(1);
  });

  test('use case of run a mock project for errors', () => {
    expect(mockProjectStderr.length).toBe(0);
  })
});
