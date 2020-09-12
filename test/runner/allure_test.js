const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const expect = require('expect');
const { parseString, Parser } = require('xml2js');
const { deleteDir } = require('../../lib/utils');

const parser = new Parser();
const runner = path.join(__dirname, '/../../bin/codecept.js');
const codecept_dir = path.join(__dirname, '/../data/sandbox/configs/allure');
const codecept_run = `${runner} run`;
const codecept_workers = `${runner} run-workers 2`;
const codecept_run_config = (config, grep) => `${codecept_run} --config ${codecept_dir}/${config} ${grep ? `--grep ${grep}` : ''}`;
const codecept_workers_config = (config, grep) => `${codecept_workers} --config ${codecept_dir}/${config} ${grep ? `--grep ${grep}` : ''}`;

describe('CodeceptJS Allure Plugin', function () {
  this.retries(2);

  beforeEach(() => {
    deleteDir(path.join(codecept_dir, 'output/ansi'));
    deleteDir(path.join(codecept_dir, 'output/success'));
    deleteDir(path.join(codecept_dir, 'output/failed'));
    deleteDir(path.join(codecept_dir, 'output/skipped'));
  });

  afterEach(() => {
    deleteDir(path.join(codecept_dir, 'output/ansi'));
    deleteDir(path.join(codecept_dir, 'output/success'));
    deleteDir(path.join(codecept_dir, 'output/failed'));
    deleteDir(path.join(codecept_dir, 'output/pageobject'));
  });

  it.only('should correct save info about page object for xml file', (done) => {
    exec(codecept_run_config('codecept.po.json'), (err, stdout) => {
      const files = fs.readdirSync(path.join(codecept_dir, 'output/pageobject'));
      console.log(stdout);
      fs.readFile(path.join(codecept_dir, 'output/pageobject', files[0]), (err, data) => {
        parser.parseString(data, (err, result) => {
          const testCase = result['ns2:test-suite']['test-cases'][0]['test-case'][0];
          const firstMetaStep = testCase.steps[0].step[0];
          expect(firstMetaStep.name[0]).toEqual('I: openDir "aaa"');

          const nestedMetaStep = firstMetaStep.steps[0].step[0];
          expect(nestedMetaStep.name[0]).toEqual('I am in path "."');
          expect(testCase.steps[0].step[0].steps.length).toEqual(1);

          const secondMetaStep = testCase.steps[0].step[1];
          expect(secondMetaStep.name[0]).toEqual('I see file "allure.conf.js"');
        });
      });
      expect(err).toBeFalsy();
      expect(files.length).toEqual(1);
      expect(files[0].match(/\.xml$/)).toBeTruthy();
      done();
    });
  });

  it('should enable allure reports', (done) => {
    exec(codecept_run_config('allure.conf.js'), (err) => {
      const files = fs.readdirSync(path.join(codecept_dir, 'output/success'));
      expect(err).toBeFalsy();
      expect(files.length).toEqual(1);
      expect(files[0].match(/\.xml$/)).toBeTruthy();
      done();
    });
  });

  it('should create xml file when assert message has ansi symbols', (done) => {
    exec(codecept_run_config('failed_ansi.conf.js'), (err) => {
      expect(err).toBeTruthy();
      const files = fs.readdirSync(path.join(codecept_dir, 'output/ansi'));
      expect(files[0].match(/\.xml$/)).toBeTruthy();
      expect(files.length).toEqual(1);
      done();
    });
  });

  it('should report skipped features', (done) => {
    exec(codecept_run_config('skipped_feature.conf.js'), (err, stdout) => {
      expect(stdout).toContain('OK  | 0 passed, 2 skipped');
      const files = fs.readdirSync(path.join(codecept_dir, 'output/skipped'));
      const reports = files.map((testResultPath) => {
        expect(testResultPath.match(/\.xml$/)).toBeTruthy();
        return fs.readFileSync(path.join(codecept_dir, 'output/skipped', testResultPath), 'utf8');
      }).join(' ');
      expect(reports).toContain('Skipped due to "skip" on Feature.');
      done();
    });
  });

  it('should report BeforeSuite errors when executing via run command', (done) => {
    exec(codecept_run_config('before_suite_test_failed.conf.js'), (err, stdout) => {
      expect(stdout).toContain('FAIL  | 0 passed, 1 failed');

      const files = fs.readdirSync(path.join(codecept_dir, 'output/failed'));
      // join all reports together
      const reports = files.map((testResultPath) => {
        expect(files[0].match(/\.xml$/)).toBeTruthy();
        return fs.readFileSync(path.join(codecept_dir, 'output/failed', testResultPath), 'utf8');
      }).join(' ');
      expect(reports).toContain('BeforeSuite of suite failing setup test suite: failed.');
      expect(reports).toContain('the before suite setup failed');
      expect(reports).toContain('Skipped due to failure in \'before\' hook');
      done();
    });
  });

  it('should report BeforeSuite errors when executing via run-workers command', function (done) {
    if (parseInt(process.version.match(/\d+/), 10) < 12) {
      this.skip();
    }

    exec(codecept_workers_config('before_suite_test_failed.conf.js'), (err, stdout) => {
      stdout.should.include('FAIL  | 0 passed');

      const files = fs.readdirSync(path.join(codecept_dir, 'output/failed'));
      const reports = files.map((testResultPath) => {
        expect(testResultPath.match(/\.xml$/)).toBeTruthy();
        return fs.readFileSync(path.join(codecept_dir, 'output/failed', testResultPath), 'utf8');
      }).join(' ');
      expect(reports).toContain('BeforeSuite of suite failing setup test suite: failed.');
      expect(reports).toContain('the before suite setup failed');
      // the line below does not work in workers needs investigating https://github.com/Codeception/CodeceptJS/issues/2391
      // expect(reports).toContain('Skipped due to failure in \'before\' hook');
      done();
    });
  });
});
