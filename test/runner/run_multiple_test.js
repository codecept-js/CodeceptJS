const assert = require('assert');
const expect = require('expect');
const path = require('path');
const exec = require('child_process').exec;

const runner = path.join(__dirname, '/../../bin/codecept.js');
const codecept_dir = path.join(__dirname, '/../data/sandbox');
const codecept_run = `${runner} run-multiple --config ${codecept_dir}/codecept.multiple.json `;

describe('CodeceptJS Multiple Runner', function () {
  this.timeout(40000);

  before(() => {
    global.codecept_dir = path.join(__dirname, '/../data/sandbox');
  });

  it('should execute one suite with browser', (done) => {
    exec(`${codecept_run}default:firefox`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('.default:firefox] print browser ');
      stdout.should.not.include('.default:chrome] print browser ');
      assert(!err);
      done();
    });
  });

  it('should execute all suites', (done) => {
    exec(`${codecept_run}--all`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[1.default:chrome] print browser ');
      stdout.should.include('[2.default:firefox] print browser ');
      stdout.should.include('[3.mobile:android] print browser ');
      stdout.should.include('[4.mobile:safari] print browser ');
      stdout.should.include('[5.mobile:chrome] print browser ');
      stdout.should.include('[6.mobile:safari] print browser ');
      stdout.should.include('[7.grep:chrome] @grep print browser size ');
      stdout.should.include('[8.grep:firefox] @grep print browser size ');
      stdout.should.not.include('[7.grep:chrome] print browser ');
      stdout.should.include('[1.default:chrome] @grep print browser size ');
      stdout.should.include('[3.mobile:android] @grep print browser size ');
      assert(!err);
      done();
    });
  });

  it('should replace parameters', (done) => {
    exec(`${codecept_run}grep --debug`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[1.grep:chrome]     › maximize');
      stdout.should.include('[2.grep:firefox]     › 1200x840');
      assert(!err);
      done();
    });
  });

  it('should execute multiple suites', (done) => {
    exec(`${codecept_run}mobile default `, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[1.mobile:android] print browser ');
      stdout.should.include('[2.mobile:safari] print browser ');
      stdout.should.include('[3.mobile:chrome] print browser ');
      stdout.should.include('[4.mobile:safari] print browser ');
      stdout.should.include('[5.default:chrome] print browser ');
      stdout.should.include('[6.default:firefox] print browser ');
      assert(!err);
      done();
    });
  });

  it('should execute multiple suites with selected browsers', (done) => {
    exec(`${codecept_run}mobile:safari default:chrome `, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[1.mobile:safari] print browser ');
      stdout.should.include('[2.mobile:safari] print browser ');
      stdout.should.include('[3.default:chrome] print browser ');
      assert(!err);
      done();
    });
  });

  it('should print steps', (done) => {
    exec(`${codecept_run}default --steps`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[2.default:firefox]   print browser ');
      stdout.should.include('[2.default:firefox]     I print browser ');
      stdout.should.include('[1.default:chrome]   print browser ');
      stdout.should.include('[1.default:chrome]     I print browser ');
      assert(!err);
      done();
    });
  });

  it('should pass grep to configuration', (done) => {
    exec(`${codecept_run}default --grep @grep`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[1.default:chrome] @grep print browser size');
      stdout.should.include('[2.default:firefox] @grep print browser size');
      stdout.should.not.include('[1.default:chrome] print browser ');
      stdout.should.not.include('[2.default:firefox] print browser ');
      assert(!err);
      done();
    });
  });

  it('should pass grep invert to configuration', (done) => {
    exec(`${codecept_run}default --grep @grep --invert`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.not.include('[1.default:chrome] @grep print browser size');
      stdout.should.not.include('[2.default:firefox] @grep print browser size');
      stdout.should.include('[1.default:chrome] print browser ');
      stdout.should.include('[2.default:firefox] print browser ');
      assert(!err);
      done();
    });
  });

  it('should pass tests to configuration', (done) => {
    exec(`${codecept_run}test`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[1.test:chrome] print browser size');
      stdout.should.include('[2.test:firefox] print browser size');
      stdout.should.include('[1.test:chrome] print browser ');
      stdout.should.include('[2.test:firefox] print browser ');
      assert(!err);
      done();
    });
  });

  it('should run chunks', (done) => {
    exec(`${codecept_run}chunks`, (err, stdout) => {
      stdout.should.include('CodeceptJS'); // feature
      stdout.should.include('[1.chunks:chunk1:dummy] print browser');
      stdout.should.include('[2.chunks:chunk2:dummy] @grep print browser size');
      assert(!err);
      done();
    });
  });

  it('should run features in parallel', (done) => {
    process.chdir(codecept_dir);
    exec(`${runner} run-multiple --config codecept.multiple.features.js chunks --features`, (err, stdout) => {
      stdout.should.include('[1.chunks:chunk1:default] Checkout examples process');
      stdout.should.not.include('[2.chunks:chunk2:default] Checkout examples process');
      stdout.should.include('[2.chunks:chunk2:default] Checkout string');
      stdout.should.not.include('[1.chunks:chunk1:default] Checkout string');
      stdout.should.include('[1.chunks:chunk1:default]   OK  |');
      stdout.should.include('[2.chunks:chunk2:default]   OK  |');
      stdout.should.not.include('@feature_grep');
      assert(!err);
      done();
    });
  });

  it('should run features & tests in parallel', (done) => {
    process.chdir(codecept_dir);
    exec(`${runner} run-multiple --config codecept.multiple.features.js chunks`, (err, stdout) => {
      stdout.should.include('@feature_grep');
      stdout.should.include('Checkout examples process');
      stdout.should.include('Checkout string');
      assert(!err);
      done();
    });
  });

  it('should run only tests in parallel', (done) => {
    process.chdir(codecept_dir);
    exec(`${runner} run-multiple --config codecept.multiple.features.js chunks --tests`, (err, stdout) => {
      stdout.should.include('@feature_grep');
      stdout.should.not.include('Checkout examples process');
      stdout.should.not.include('Checkout string');
      assert(!err);
      done();
    });
  });

  it('should exit with non-zero code for failures during init process', (done) => {
    process.chdir(codecept_dir);
    exec(`${runner} run-multiple --config codecept.multiple.initFailure.json default --all`, (err, stdout) => {
      expect(err).not.toBeFalsy();
      expect(err.code).toBe(1);
      expect(stdout).toContain('Failed on FailureHelper');
      done();
    });
  });

  it('should exit code 1 when error in config', (done) => {
    process.chdir(codecept_dir);
    exec(`${runner} run-multiple --config configs/codecept-invalid.config.js default --all`, (err, stdout, stderr) => {
      expect(stdout).not.toContain('UnhandledPromiseRejectionWarning');
      expect(stderr).not.toContain('UnhandledPromiseRejectionWarning');
      expect(stdout).toContain('badFn is not defined');
      expect(err).not.toBe(null);
      done();
    });
  });

  describe('bootstrapAll and teardownAll', () => {
    const _codecept_run = `run-multiple --config ${codecept_dir}`;
    it('should be executed from async function in config', (done) => {
      exec(`${runner} ${_codecept_run}/codecept.async.bootstrapall.multiple.code.js default`, (err, stdout) => {
        stdout.should.include('CodeceptJS'); // feature
        stdout.should.include('Results: inside Promise\n"event.multiple.before" is called');
        stdout.should.include('"teardownAll" is called.');
        assert(!err);
        done();
      });
    });

    it('should be executed from function in config', (done) => {
      exec(`${runner} ${_codecept_run}/codecept.bootstrapall.multiple.code.js default`, (err, stdout) => {
        stdout.should.include('CodeceptJS'); // feature
        stdout.should.include('"bootstrapAll" is called.');
        stdout.should.include('"teardownAll" is called.');
        assert(!err);
        done();
      });
    });
  });

  describe('with require parameter', () => {
    const _codecept_run = `run-multiple --config ${codecept_dir}`;
    const moduleOutput = 'Module was required 1';
    const moduleOutput2 = 'Module was required 2';

    it('should be executed with module when described', (done) => {
      process.chdir(codecept_dir);
      exec(`${runner} ${_codecept_run}/codecept.require.multiple.single.json default`, (err, stdout) => {
        stdout.should.include(moduleOutput);
        stdout.should.not.include(moduleOutput2);
        (stdout.match(new RegExp(moduleOutput, 'g')) || []).should.have.lengthOf(2);
        assert(!err);
        done();
      });
    });

    it('should be executed with several module when described', (done) => {
      process.chdir(codecept_dir);
      exec(`${runner} ${_codecept_run}/codecept.require.multiple.several.json default`, (err, stdout) => {
        stdout.should.include(moduleOutput);
        stdout.should.include(moduleOutput2);
        (stdout.match(new RegExp(moduleOutput, 'g')) || []).should.have.lengthOf(2);
        (stdout.match(new RegExp(moduleOutput2, 'g')) || []).should.have.lengthOf(2);
        assert(!err);
        done();
      });
    });

    it('should not be executed without module when not described', (done) => {
      process.chdir(codecept_dir);
      exec(`${runner} ${_codecept_run}/codecept.require.multiple.without.json default`, (err, stdout) => {
        stdout.should.not.include(moduleOutput);
        stdout.should.not.include(moduleOutput2);
        assert(!err);
        done();
      });
    });
  });
});
