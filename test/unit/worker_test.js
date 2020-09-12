const { expect } = require('chai');
const path = require('path');
const semver = require('semver');
const { Workers, event, recorder } = require('../../lib/index');

describe('Workers', () => {
  before(() => {
    global.codecept_dir = path.join(__dirname, '/../data/sandbox');
  });

  it.only('should run simple worker', (done) => {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    const workerConfig = {
      by: 'test',
      testConfig: './test/data/sandbox/',
    };
    let passedCount = 0;
    let failedCount = 0;
    const workers = new Workers(2, workerConfig);

    workers.run();

    workers.on(event.test.failed, () => {
      failedCount += 1;
    });
    workers.on(event.test.passed, () => {
      passedCount += 1;
    });

    workers.on(event.all.result, (status) => {
      expect(status).equal(false);
      expect(passedCount).equal(5);
      expect(failedCount).equal(3);
      done();
    });
  });

  it('should create worker by function', (done) => {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');

    const createTestGroups = () => {
      const files = [
        [path.join(codecept_dir, '/custom-worker/base_test.worker.js')],
        [path.join(codecept_dir, '/custom-worker/custom_test.worker.js')],
      ];

      return files;
    };

    const workerConfig = {
      by: createTestGroups,
      testConfig: './test/data/sandbox/codecept.customworker.js',
    };

    const workers = new Workers(-1, workerConfig);

    for (const worker of workers.getWorkers()) {
      worker.addConfig({
        helpers: {
          FileSystem: {},
          Workers: {
            require: './custom_worker_helper',
          },
        },
      });
    }

    workers.run();

    workers.on(event.all.result, (status) => {
      expect(workers.getWorkers().length).equal(2);
      expect(status).equal(true);
      done();
    });
  });

  it('should run worker with custom config', (done) => {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');

    const workerConfig = {
      by: 'test',
      testConfig: './test/data/sandbox/codecept.customworker.js',
    };
    let passedCount = 0;
    let failedCount = 0;

    const workers = new Workers(2, workerConfig);

    for (const worker of workers.getWorkers()) {
      worker.addConfig({
        helpers: {
          FileSystem: {},
          Workers: {
            require: './custom_worker_helper',
          },
        },
      });
    }

    workers.run();

    workers.on(event.test.failed, () => {
      failedCount += 1;
    });
    workers.on(event.test.passed, () => {
      passedCount += 1;
    });

    workers.on(event.all.result, (status) => {
      expect(status).equal(false);
      expect(passedCount).equal(4);
      expect(failedCount).equal(1);
      done();
    });
  });

  it('should able to add tests to each worker', (done) => {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');

    const workerConfig = {
      by: 'test',
      testConfig: './test/data/sandbox/codecept.customworker.js',
    };

    const workers = new Workers(-1, workerConfig);

    const workerOne = workers.spawn();
    workerOne.addTestFiles([
      path.join(codecept_dir, '/custom-worker/base_test.worker.js'),
    ]);

    const workerTwo = workers.spawn();
    workerTwo.addTestFiles([
      path.join(codecept_dir, '/custom-worker/custom_test.worker.js'),
    ]);

    for (const worker of workers.getWorkers()) {
      worker.addConfig({
        helpers: {
          FileSystem: {},
          Workers: {
            require: './custom_worker_helper',
          },
        },
      });
    }

    workers.run();

    workers.on(event.all.result, (status) => {
      expect(workers.getWorkers().length).equal(2);
      expect(status).equal(true);
      done();
    });
  });

  it('should able to add tests to using createGroupsOfTests', (done) => {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');

    const workerConfig = {
      by: 'test',
      testConfig: './test/data/sandbox/codecept.customworker.js',
    };

    const workers = new Workers(-1, workerConfig);
    const testGroups = workers.createGroupsOfSuites(2);

    const workerOne = workers.spawn();
    workerOne.addTests(testGroups[0]);

    const workerTwo = workers.spawn();
    workerTwo.addTests(testGroups[1]);

    for (const worker of workers.getWorkers()) {
      worker.addConfig({
        helpers: {
          FileSystem: {},
          Workers: {
            require: './custom_worker_helper',
          },
        },
      });
    }

    workers.run();

    workers.on(event.all.result, (status) => {
      expect(workers.getWorkers().length).equal(2);
      expect(status).equal(true);
      done();
    });
  });

  it('Should able to pass data from workers to main thread and vice versa', (done) => {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');

    const workerConfig = {
      by: 'test',
      testConfig: './test/data/sandbox/codecept.customworker.js',
    };

    const workers = new Workers(2, workerConfig);

    for (const worker of workers.getWorkers()) {
      worker.addConfig({
        helpers: {
          FileSystem: {},
          Workers: {
            require: './custom_worker_helper',
          },
        },
      });
    }

    workers.run();
    recorder.add(() => share({ fromMain: true }));

    workers.on(event.all.result, (status) => {
      expect(status).equal(true);
      done();
    });
  });
});
