const Sequencer = require('@jest/test-sequencer').default;
const priorityTestSuites = require('./priority_test_suites').default;

class CustomSequencer extends Sequencer {

  _isPriorityTest(test, priorityArray) {
    return priorityArray.findIndex(priorityTest => test.path.includes(priorityTest));
  }

  sort(tests) {
    // Test structure information
    // https://github.com/facebook/jest/blob/6b8b1404a1d9254e7d5d90a8934087a9c9899dab/packages/jest-runner/src/types.ts#L17-L21
    const copyTests = Array.from(tests);
    return copyTests.sort((testA, testB) => {
      const isTestAPriority = this._isPriorityTest(testA, priorityTestSuites);
      const isTestBPriority = this._isPriorityTest(testB, priorityTestSuites);

      // non priority test, apply the normal sequence order
      if (isTestAPriority === -1 && isTestBPriority === -1) {
        return testA.path > testB.path ? 1 : -1;
      }

      // only A is priority
      if (isTestAPriority !== -1 && isTestBPriority === -1) {
        return -1;
      }

      // only B is priority
      if (isTestAPriority === -1 && isTestBPriority !== -1) {
        return 1;
      }

      // both are priority, follow the original priority array
      return isTestAPriority - isTestBPriority;
    });
  }
}

module.exports = CustomSequencer;
