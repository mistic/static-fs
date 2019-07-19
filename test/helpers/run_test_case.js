import execa from 'execa';
import { dirname } from 'path';

export async function runTestCaseInIsolatedEnv(mockProject, testCaseName) {
  if (!mockProject[testCaseName]) {
    const error = `The test case ${testCaseName} is not defined under the given mock project`;
    console.error(error);
    throw error;
  }

  return await execa('node', [mockProject[testCaseName]], { cwd: dirname(mockProject[testCaseName]) });
}
