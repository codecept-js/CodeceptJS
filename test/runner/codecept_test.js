const expect = require('chai').expect;
const assert = require('assert');
const path = require('path');
const exec = require('child_process').exec;
const event = require('../../lib').event;

const runner = path.join(__dirname, '/../../bin/codecept.js');
const codecept_dir = path.join(__dirname, '/../data/sandbox');
const codecept_run = `${runner} run`;
const codecept_run_config = config => `${codecept_run} --config ${codecept_dir}/${config}`;

describe('CodeceptJS Runner', () => {
  before(() => {
    global.codecept_dir = path.join(__dirname, '/../data/sandbox');
  });

  it('should be executed in current dir', (done) => {
    process.chdir(codecept_dir);
    exec(codecept_run, (err, stdout) => {
      stdout.should.include('Filesystem'); // feature
      stdout.should.include('check current dir'); // test name
      assert(!err);
      done();
    });
  });

  it('should be executed with glob', (done) => {
    process.chdir(codecept_dir);
    exec(codecept_run_config('codecept.glob.json'), (err, stdout) => {
      stdout.should.include('Filesystem'); // feature
      stdout.should.include('glob current dir'); // test name
      assert(!err);
      done();
    });
  });

  it('should be executed with config path', (done) => {
    process.chdir(__dirname);
    exec(`${codecept_run} -c ${codecept_dir}`, (err, stdout) => {
      stdout.should.include('Filesystem'); // feature
      stdout.should.include('check current dir'); // test name
      assert(!err);
      done();
    });
  });

  it('should show failures and exit with 1 on fail', (done) => {
    exec(codecept_run_config('codecept.failed.json'), (err, stdout) => {
      stdout.should.include('Not-A-Filesystem');
      stdout.should.include('file is not in dir');
      stdout.should.include('FAILURES');
      err.code.should.eql(1);
      done();
    });
  });

  describe('grep', () => {
    it('filter by scenario tags', (done) => {
      process.chdir(codecept_dir);
      exec(`${codecept_run} --grep @slow`, (err, stdout) => {
        stdout.should.include('Filesystem'); // feature
        stdout.should.include('check current dir'); // test name
        assert(!err);
        done();
      });
    });

    it('filter by scenario tags #2', (done) => {
      process.chdir(codecept_dir);
      exec(`${codecept_run} --grep @important`, (err, stdout) => {
        stdout.should.include('Filesystem'); // feature
        stdout.should.include('check current dir'); // test name
        assert(!err);
        done();
      });
    });

    it('filter by feature tags', (done) => {
      process.chdir(codecept_dir);
      exec(`${codecept_run} --grep @main`, (err, stdout) => {
        stdout.should.include('Filesystem'); // feature
        stdout.should.include('check current dir'); // test name
        assert(!err);
        done();
      });
    });

    describe('without "invert" option', () => {
      it('should filter by scenario tags', (done) => {
        process.chdir(codecept_dir);
        exec(`${codecept_run_config('codecept.grep.2.json')} --grep @1_grep`, (err, stdout) => {
          stdout.should.include('@feature_grep'); // feature
          stdout.should.include('grep message 1');
          stdout.should.not.include('grep message 2');
          assert(!err);
          done();
        });
      });

      it('should filter by scenario tags #2', (done) => {
        process.chdir(codecept_dir);
        exec(`${codecept_run_config('codecept.grep.2.json')} --grep @2_grep`, (err, stdout) => {
          stdout.should.include('@feature_grep'); // feature
          stdout.should.include('grep message 2');
          stdout.should.not.include('grep message 1');
          assert(!err);
          done();
        });
      });

      it('should filter by feature tags', (done) => {
        process.chdir(codecept_dir);
        exec(`${codecept_run_config('codecept.grep.2.json')} --grep @feature_grep`, (err, stdout) => {
          stdout.should.include('@feature_grep'); // feature
          stdout.should.include('grep message 1');
          stdout.should.include('grep message 2');
          assert(!err);
          done();
        });
      });
    });

    describe('with "invert" option', () => {
      it('should filter by scenario tags', (done) => {
        process.chdir(codecept_dir);
        exec(`${codecept_run_config('codecept.grep.2.json')} --grep @1_grep --invert`, (err, stdout) => {
          stdout.should.include('@feature_grep'); // feature
          stdout.should.not.include('grep message 1');
          stdout.should.include('grep message 2');
          assert(!err);
          done();
        });
      });

      it('should filter by scenario tags #2', (done) => {
        process.chdir(codecept_dir);
        exec(`${codecept_run_config('codecept.grep.2.json')} --grep @2_grep --invert`, (err, stdout) => {
          stdout.should.include('@feature_grep'); // feature
          stdout.should.not.include('grep message 2');
          stdout.should.include('grep message 1');
          assert(!err);
          done();
        });
      });

      it('should filter by feature tags', (done) => {
        process.chdir(codecept_dir);
        exec(`${codecept_run_config('codecept.grep.2.json')} --grep @main --invert`, (err, stdout) => {
          stdout.should.include('@feature_grep'); // feature
          stdout.should.include('grep message 1');
          stdout.should.include('grep message 2');
          assert(!err);
          done();
        });
      });

      it('should filter by feature tags', (done) => {
        process.chdir(codecept_dir);
        exec(`${codecept_run_config('codecept.grep.2.json')} --grep @feature_grep --invert`, (err, stdout) => {
          stdout.should.not.include('@feature_grep'); // feature
          stdout.should.not.include('grep message 1');
          stdout.should.not.include('grep message 2');
          assert(!err);
          done();
        });
      });
    });
  });

  it('should run hooks from suites', (done) => {
    exec(codecept_run_config('codecept.testhooks.json'), (err, stdout) => {
      const lines = stdout.match(/\S.+/g);

      const uniqueLines = lines.filter((v, i, a) => a.indexOf(v) === i);

      expect(uniqueLines.length).to.eql(lines.length, `No duplicates in output +${lines} \n\n -${uniqueLines}`);

      expect(lines).to.include.members([
        'Helper: I\'m initialized',
        'Helper: I\'m simple BeforeSuite hook',
        'Test: I\'m simple BeforeSuite hook',
        'Test: I\'m generator BeforeSuite hook',
        'Test: I\'m async/await BeforeSuite hook',
        'Helper: I\'m simple Before hook',
        'Test: I\'m simple Before hook',
        'Test: I\'m generator Before hook',
        'Test: I\'m async/await Before hook',
        'Test: I\'m generator After hook',
        'Test: I\'m simple After hook',
        'Test: I\'m async/await After hook',
        'Helper: I\'m simple After hook',
        'Test: I\'m generator AfterSuite hook',
        'Test: I\'m simple AfterSuite hook',
        'Test: I\'m async/await AfterSuite hook',
        'Helper: I\'m simple AfterSuite hook',
      ]);

      stdout.should.include('OK  | 1 passed');
      assert(!err);
      done();
    });
  });

  it('should run hooks from suites (in different order)', (done) => {
    exec(codecept_run_config('codecept.testhooks.different.order.json'), (err, stdout) => {
      const lines = stdout.match(/\S.+/g);

      expect(lines).to.include.members([
        'Helper: I\'m simple BeforeSuite hook',
        'Test: I\'m async/await BeforeSuite hook',
        'Helper: I\'m simple Before hook',
        'Test: I\'m async/await Before hook',
        'Test: I\'m async/await After hook',
        'Helper: I\'m simple After hook',
        'Test: I\'m async/await AfterSuite hook',
        'Helper: I\'m simple AfterSuite hook',
      ]);
      stdout.should.include('OK  | 1 passed');
      assert(!err);
      done();
    });
  });

  it('should run different types of scenario', (done) => {
    exec(codecept_run_config('codecept.testscenario.json'), (err, stdout) => {
      const lines = stdout.match(/\S.+/g);
      expect(lines).to.include.members([
        'Test scenario types --',
        'It\'s usual test',
        'Test: I\'m async/await test',
        'Test: I\'m asyncbrackets test',
      ]);
      stdout.should.include('OK  | 3 passed');
      assert(!err);
      done();
    });
  });

  it('should run dynamic config', (done) => {
    exec(codecept_run_config('config.js'), (err, stdout) => {
      stdout.should.include('Filesystem'); // feature
      assert(!err);
      done();
    });
  });

  it('should run dynamic config with profile', (done) => {
    exec(`${codecept_run_config('config.js')} --profile failed`, (err, stdout) => {
      stdout.should.include('FAILURES');
      stdout.should.not.include('I am bootstrap');
      assert(err.code);
      done();
    });
  });

  it('should exit code 1 when error in config', (done) => {
    exec(`${codecept_run_config('configs/codecept-invalid.config.js')} --profile failed`, (err, stdout, stderr) => {
      stdout.should.not.include('UnhandledPromiseRejectionWarning');
      stderr.should.not.include('UnhandledPromiseRejectionWarning');
      stdout.should.include('badFn is not defined');
      assert(err.code);
      done();
    });
  });

  describe('with require parameter', () => {
    const moduleOutput = 'Module was required 1';
    const moduleOutput2 = 'Module was required 2';

    it('should be executed with module when described', (done) => {
      process.chdir(codecept_dir);
      exec(codecept_run_config('codecept.require.single.json'), (err, stdout) => {
        stdout.should.include(moduleOutput);
        stdout.should.not.include(moduleOutput2);
        assert(!err);
        done();
      });
    });

    it('should be executed with several modules when described', (done) => {
      process.chdir(codecept_dir);
      exec(codecept_run_config('codecept.require.several.json'), (err, stdout) => {
        stdout.should.include(moduleOutput);
        stdout.should.include(moduleOutput2);
        assert(!err);
        done();
      });
    });

    it('should not be executed without module when not described', (done) => {
      process.chdir(codecept_dir);
      exec(codecept_run_config('codecept.require.without.json'), (err, stdout) => {
        stdout.should.not.include(moduleOutput);
        stdout.should.not.include(moduleOutput2);
        assert(!err);
        done();
      });
    });
  });
});

describe('Codeceptjs Events', () => {
  it('should fire events with only passing tests', (done) => {
    exec(`${codecept_run_config('codecept.testevents.js')} --grep @willpass`, (err, stdout) => {
      assert(!err);
      const eventMessages = stdout.split('\n')
        .filter(text => text.startsWith('Event:'))
        .map(text => text.replace(/^Event:/i, ''));

      expect(eventMessages).to.deep.equal([
        event.all.before,
        event.suite.before,
        event.test.before,
        event.test.started,
        event.test.passed,
        `${event.test.passed} (helper)`,
        event.test.after,
        event.suite.after,
        event.all.result,
        event.all.after,
      ]);
      done();
    });
  });

  it('should fire events with passing and failing tests', (done) => {
    exec(codecept_run_config('codecept.testevents.js'), (err, stdout) => {
      assert(err);
      const eventMessages = stdout.split('\n')
        .filter(text => text.startsWith('Event:'))
        .map(text => text.replace(/^Event:/i, ''));

      expect(eventMessages).to.deep.equal([
        event.all.before,
        event.suite.before,

        // Test 1 (should pass)
        event.test.before,
        event.test.started,
        event.test.passed,
        `${event.test.passed} (helper)`,
        event.test.after,

        // Test 2 (should fail)
        event.test.before,
        event.test.started,
        event.test.failed,
        `${event.test.failed} (helper)`,
        event.test.after,

        event.suite.after,
        event.all.result,
        event.all.after,
      ]);
      done();
    });
  });
});
