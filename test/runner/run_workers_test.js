const expect = require('expect');
const path = require('path');
const exec = require('child_process').exec;
const semver = require('semver');

const runner = path.join(__dirname, '/../../bin/codecept.js');
const codecept_dir = path.join(__dirname, '/../data/sandbox');
const codecept_run = `${runner} run-workers --config ${codecept_dir}/codecept.workers.conf.js `;
const codecept_run_glob = config => `${runner} run-workers --config ${codecept_dir}/${config} `;

describe('CodeceptJS Workers Runner', function () {
  this.timeout(40000);

  before(() => {
    global.codecept_dir = path.join(__dirname, '/../data/sandbox');
  });

  it('should run tests in 3 workers', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run} 3 --debug`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('glob current dir');
      expect(stdout).toContain('From worker @1_grep print message 1');
      expect(stdout).toContain('From worker @2_grep print message 2');
      expect(stdout).toContain('Running tests in 3 workers');
      expect(stdout).not.toContain('this is running inside worker');
      expect(stdout).toContain('failed');
      expect(stdout).toContain('File notafile not found');
      expect(stdout).toContain('Scenario Steps:');
      expect(err.code).toEqual(1);
      done();
    });
  });

  it('should print correct FAILURES in 3 workers without --debug', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run} 3`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('glob current dir');
      expect(stdout).toContain('From worker @1_grep print message 1');
      expect(stdout).toContain('From worker @2_grep print message 2');
      expect(stdout).toContain('Running tests in 3 workers');
      expect(stdout).not.toContain('this is running inside worker');
      expect(stdout).toContain('failed');
      expect(stdout).toContain('File notafile not found');
      expect(stdout).toContain('Scenario Steps:');
      expect(stdout).toContain('FAIL  | 5 passed, 2 failed');
      // We are not testing order in logs, because it depends on race condition between workers
      expect(stdout).toContain(') Workers Failing\n'); // first fail log
      expect(stdout).toContain(') Workers\n'); // second fail log
      // We just should be sure numbers are correct
      expect(stdout).toContain('1) '); // first fail log
      expect(stdout).toContain('2) '); // second fail log
      expect(err.code).toEqual(1);
      done();
    });
  });

  it('should print positive or zero failures with same name tests', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run_glob('configs/workers/codecept.workers-negative.conf.js')} 2`, (err, stdout) => {
      expect(stdout).toContain('Running tests in 2 workers...');
      // check negative number without checking specified negative number
      expect(stdout).not.toContain('FAIL  | 2 passed, -');
      // check we have positive failures
      // TODO: "10 failed" - probably bug, but not in logs.
      //  CodeceptJS starts 12 tests in this case, but now we can see this executions in logs.
      expect(stdout).toContain('FAIL  | 2 passed, 10 failed');
      expect(err).not.toBe(null);
      done();
    });
  });

  it('should use grep', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run} 2 --grep "grep"`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).not.toContain('glob current dir');
      expect(stdout).toContain('From worker @1_grep print message 1');
      expect(stdout).toContain('From worker @2_grep print message 2');
      expect(stdout).toContain('Running tests in 2 workers');
      expect(stdout).not.toContain('this is running inside worker');
      expect(stdout).not.toContain('failed');
      expect(stdout).not.toContain('File notafile not found');
      expect(err).toEqual(null);
      done();
    });
  });

  it('should use suites', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run} 2 --suites`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('Running tests in 2 workers'); // feature
      expect(stdout).toContain('glob current dir');
      expect(stdout).toContain('From worker @1_grep print message 1');
      expect(stdout).toContain('From worker @2_grep print message 2');
      expect(stdout).not.toContain('this is running inside worker');
      expect(err.code).toEqual(1);
      done();
    });
  });

  it('should show failures when suite is failing', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run} 2 --grep "Workers Failing"`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('Running tests in 2 workers');
      // Test Scenario wasn't executed, but we can see it in logs because Before() hook was executed
      expect(stdout).not.toContain(' should not be executed ');
      expect(stdout).toContain('"before each" hook: Before for "should not be executed"');
      expect(stdout).not.toContain('this is running inside worker');
      expect(stdout).toContain('failed');
      expect(stdout).toContain('FAILURES');
      expect(stdout).toContain('Workers Failing');
      // Only 1 test is executed - Before hook in Workers Failing
      expect(stdout).toContain('✖ Workers Failing');
      expect(stdout).toContain('FAIL  | 0 passed, 1 failed');
      expect(err.code).toEqual(1);
      done();
    });
  });

  it('should print stdout in debug mode and load bootstrap', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run} 1 --grep "grep" --debug`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('Running tests in 1 workers');
      expect(stdout).toContain('bootstrap b1+b2');
      expect(stdout).toContain('message 1');
      expect(stdout).toContain('message 2');
      expect(stdout).toContain('see this is worker');
      expect(err).toEqual(null);
      done();
    });
  });

  it('should run tests with glob pattern', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run_glob('codecept.workers-glob.conf.js')} 1 --grep "grep" --debug`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('Running tests in 1 workers');
      expect(stdout).toContain('bootstrap b1+b2');
      expect(stdout).toContain('message 1');
      expect(stdout).toContain('message 2');
      expect(stdout).toContain('see this is worker');
      expect(err).toEqual(null);
      done();
    });
  });

  it('should print empty results with incorrect glob pattern', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run_glob('codecept.workers-incorrect-glob.conf.js')} 1 --grep "grep" --debug`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('Running tests in 1 workers');
      expect(stdout).toContain('OK  | 0 passed');
      expect(err).toEqual(null);
      done();
    });
  });

  it('should retry test', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run} 2 --grep "retry"`, (err, stdout) => {
      expect(stdout).toContain('CodeceptJS'); // feature
      expect(stdout).toContain('OK  | 1 passed');
      done();
    });
  });

  it('should create output folder with custom name', function (done) {
    const fs = require('fs');
    const customName = 'thisIsCustomOutputFolderName';
    const outputDir = `${codecept_dir}/${customName}`;
    let createdOutput = false;

    if (fs.existsSync(outputDir)) {
      fs.rmdirSync(outputDir, { recursive: true });
    }

    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    const configFileName = 'codecept.workers-custom-output-folder-name.conf.js';
    exec(`${codecept_run_glob(configFileName)} 2 --grep "grep" --debug`, (err, stdout) => {
      expect(stdout).toContain(customName);
      if (fs.existsSync(outputDir)) {
        createdOutput = true;
      }
      expect(createdOutput).toEqual(true);
      expect(err).toEqual(null);
      done();
    });
  });

  it('should exit code 1 when error in config', function (done) {
    if (!semver.satisfies(process.version, '>=11.7.0')) this.skip('not for node version');
    exec(`${codecept_run_glob('configs/codecept-invalid.config.js')} 2`, (err, stdout, stderr) => {
      expect(stdout).not.toContain('UnhandledPromiseRejectionWarning');
      expect(stderr).not.toContain('UnhandledPromiseRejectionWarning');
      expect(stdout).toContain('badFn is not defined');
      expect(err).not.toBe(null);

      done();
    });
  });
});
