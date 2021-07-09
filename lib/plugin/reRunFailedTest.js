const event = require('../event');
const { writeFailedTest, getFailedTest } = require('../reRunFailedTest');
const container = require('../container');
const output = require('../output');

const failedScripts = new Set();
const failedScriptsId = new Set();
const testScriptsName = new Set();
let mochaStatsBackup = {};

const sequentialRun = async (codecept, options) => {
  codecept.loadTests();
  if (options.options.failed) {
    const testFiles = getFailedTest();
    for (let i = 0; i < testFiles.length; i++) {
      if (!codecept.testFiles.includes(testFiles[i])) {
        output.print(`Invalid Script Path${testFiles[i]}`);
        testFiles.splice(i, 1);
        i--;
      }
    }
    if (testFiles.length > 0) {
      output.print(`Failed Scripts from previous execution are ${testFiles}`);
      await run(testFiles, false);
    } else {
      output.print('No valid failed scripts from previous execution');
      await writeFailedTest([]);
    }
  } else {
    await run(codecept.testFiles, false);
  }
  if (options.config.plugins.reRunFailedTest.autoRetry === true) {
    output.print('Auto Retrying Failed Scripts');
    const testFiles = getFailedTest();
    if (testFiles.length > 0) {
      output.print('Failed Scripts from previous execution are ', testFiles);
      await run(testFiles, true);
    }
  }
};

const run = (testFiles, retryFlag) => {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    container.createMocha();
    const mocha = container.mocha();
    testFiles.forEach((file) => {
      delete require.cache[file];
    });
    mocha.files = testFiles;
    const done = () => {
      if (retryFlag === true) {
        output.result(mocha._previousRunner.stats.passes, mocha._previousRunner.stats.failures, mocha._previousRunner.stats.pending, `${mocha._previousRunner.stats.duration || 0 / 1000}s`);
      }
      event.dispatcher.on(event.all.after, (test) => {
        writeFailedTest(Array.from(failedScripts));
      });
      event.emit(event.all.result, this);
      event.emit(event.all.after, this);
      resolve();
    };
    try {
      event.emit(event.all.before, this);
      event.dispatcher.on(event.test.failed, (test) => {
        failedScripts.add(test.file);
      });
      mocha.run(() => {
        if (retryFlag === false) {
          mochaStatsBackup = mocha._previousRunner.stats;
        }
        if (retryFlag === true) {
          mocha._previousRunner.stats.passes += mochaStatsBackup.passes;
        }
        done();
      });
    } catch (e) {
      output.error(e.stack);
      reject(e);
    }
  });
};

const parallelRun = async (workers, options) => {
  workers.on(event.test.failed, (failedTest) => {
    const failTest = workers.testDetails.filter(t => t.id === failedTest.id);
    failedScripts.add(failTest[0].file);
    output.test.failed(failedTest);
  });
  workers.on(event.test.passed, (successTest) => {
    output.test.passed(successTest);
  });
  workers.on(event.all.result, () => {
    writeFailedTest(Array.from(failedScripts));
    printResults(workers);
  });
  if (options.options.failed) {
    workers = loadFailedScriptsForWorkers(workers);
  }
  try {
    workers.numberOfWorkers = workers.workers.length;
    await workers.bootstrapAll();
    await workers.run();
    if (options.config.plugins.reRunFailedTest.autoRetry === true) {
      output.print('Auto Retrying Failed Scripts');
      workers = await loadFailedScriptsForWorkers(workers);
      if (workers.workers.length > 0) {
        workers.numberOfWorkers += workers.workers.length;
        workers.finishedTests = {};
        workers.stats.failures = 0;
        await workers.run();
      }
    }
  } finally {
    await workers.teardownAll();
  }
};

const loadFailedScriptsForWorkers = (workers) => {
  const testFiles = getFailedTest();
  if (testFiles.length > 0) {
    for (let i = 0; i < workers.testDetails.length; i++) {
      if (testFiles.includes(workers.testDetails[i].file)) {
        failedScriptsId.add(workers.testDetails[i].id);
      }
      testScriptsName.add(workers.testDetails[i].file);
    }
    for (let i = 0; i < testFiles.length; i++) {
      if (!testScriptsName.has(testFiles[i])) {
        output.print(`Invalid Script Path ${testFiles[i]}`);
        testFiles.splice(i, 1);
        i--;
      }
    }
  }
  if (testFiles.length > 0) {
    output.print('Failed Scripts from previous execution are ', testFiles);
    for (let i = 0; i < workers.workers.length; i++) {
      for (let j = 0; j < workers.workers[i].tests.length; j++) {
        if (!failedScriptsId.has(workers.workers[i].tests[j])) {
          workers.workers[i].tests.splice(j, 1);
          j--;
        }
      }
      if (workers.workers[i].tests.length === 0) {
        workers.workers.splice(i, 1);
        i--;
      }
    }
  } else {
    writeFailedTest([]);
    workers.workers = [];
  }
  return workers;
};

const reRunFailedTest = async (config, options, sequentialFlag) => {
  if (sequentialFlag === true) {
    await sequentialRun(config, options);
  } else if (sequentialFlag === false) {
    await parallelRun(config, options);
  }
};

module.exports = reRunFailedTest;

const printResults = (workers) => {
  workers.stats.end = new Date();
  workers.stats.duration = workers.stats.end - workers.stats.start;
  output.print();
  output.result(workers.stats.passes, workers.stats.failures, workers.stats.pending, `${workers.stats.duration || 0 / 1000}s`);
};
