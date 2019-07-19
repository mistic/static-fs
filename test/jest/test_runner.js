const TestRunner = require('jest-runner');
const priorityTestSuites = require('./priority_test_suites').default;

class CustomTestRunner extends TestRunner {
  constructor(...attr) {
    super(...attr);
    // Note: we can set this.isSerial = true
    // to always run the tests in series
  }

  async runTests(tests, watcher, onStart, onResult, onFailure, options) {
    return await new Promise(async (resolve, reject) => {
      if (options.serial) {
        try {
          await super._createInBandTestRun(tests, watcher, onStart, onResult, onFailure);
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }

      const testsToRunInParallel = [];
      const testsToRunInSeries = [];

      tests.forEach(test => {
        const isPriorityTest = priorityTestSuites.find(priorityTest => test.path.includes(priorityTest));
        // That test suit should always run before every other
        // loader test suit related
        if (isPriorityTest) {
          testsToRunInSeries.push(test);
          return;
        }

        testsToRunInParallel.push(test);
      });

      try {
        await super._createInBandTestRun(testsToRunInSeries, watcher, onStart, onResult, onFailure);
        await super._createParallelTestRun(
          testsToRunInParallel,
          watcher,
          onStart,
          onResult,
          onFailure,
        );
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }
}

module.exports = CustomTestRunner;
