const expect = require('expect');
const exec = require('child_process').exec;
const { codecept_run, codecept_dir } = require('./consts');

const config_run_config = config => `${codecept_run} --config ${codecept_dir}/${config}`;

describe('CodeceptJS Interface', () => {
  before(() => {
    process.chdir(codecept_dir);
  });

  it('should rerun flaky tests', (done) => {
    exec(config_run_config('codecept.flaky.json'), (err, stdout) => {
      expect(stdout).toContain('Flaky'); // feature
      expect(stdout).toContain('Not so flaky test'); // test name
      expect(stdout).toContain('Old style flaky'); // test name
      expect(stdout).toContain('[T1] Retries: 2'); // test name
      expect(stdout).toContain('[T2] Retries: 4'); // test name
      expect(stdout).toContain('[T3] Retries: 1'); // test name
      expect(err).toBeFalsy();
      done();
    });
  });

  it('should rerun retried steps', (done) => {
    exec(`${config_run_config('codecept.retry.json')} --grep @test1`, (err, stdout) => {
      expect(stdout).toContain('Retry'); // feature
      expect(stdout).toContain('Retries: 4'); // test name
      expect(err).toBeFalsy();
      done();
    });
  });

  it('should not propagate retries to non retried steps', (done) => {
    exec(`${config_run_config('codecept.retry.json')} --grep @test2 --verbose`, (err, stdout) => {
      expect(stdout).toContain('Retry'); // feature
      expect(stdout).toContain('Retries: 1'); // test name
      expect(err).toBeTruthy();
      done();
    });
  });

  it('should use retryFailedStep plugin for failed steps', (done) => {
    exec(`${config_run_config('codecept.retryFailed.json')} --grep @test1`, (err, stdout) => {
      expect(stdout).toContain('Retry'); // feature
      expect(stdout).toContain('Retries: 5'); // test name
      expect(err).toBeFalsy();
      done();
    });
  });

  it('should not retry wait* steps in retryFailedStep plugin', (done) => {
    exec(`${config_run_config('codecept.retryFailed.json')} --grep @test2`, (err, stdout) => {
      expect(stdout).toContain('Retry'); // feature
      expect(stdout).not.toContain('Retries: 5');
      expect(stdout).toContain('Retries: 1');
      expect(err).toBeTruthy();
      done();
    });
  });

  it('should not retry steps if retryFailedStep plugin disabled', (done) => {
    exec(`${config_run_config('codecept.retryFailed.json')} --grep @test3`, (err, stdout) => {
      expect(stdout).toContain('Retry'); // feature
      expect(stdout).not.toContain('Retries: 5');
      expect(stdout).toContain('Retries: 1');
      expect(err).toBeTruthy();
      done();
    });
  });

  it('should include grep option tests', (done) => {
    exec(config_run_config('codecept.grep.json'), (err, stdout) => {
      expect(stdout).toContain('Got login davert and password'); // feature
      expect(stdout).not.toContain('Got changed login'); // test name
      expect(err).toBeFalsy();
      done();
    });
  });

  it('should run tests with different data', (done) => {
    exec(config_run_config('codecept.ddt.json'), (err, stdout) => {
      const output = stdout.replace(/in [0-9]ms/g, '').replace(/\r/g, '');
      expect(output).toContain(`Got login davert and password 123456
  ✔ Should log accounts1 | {"login":"davert","password":"123456"}`);

      expect(output).toContain(`Got login admin and password 666666
  ✔ Should log accounts1 | {"login":"admin","password":"666666"}`);

      expect(output).toContain(`Got changed login andrey and password 555555
  ✔ Should log accounts2 | {"login":"andrey","password":"555555"}`);

      expect(output).toContain(`Got changed login collaborator and password 222222
  ✔ Should log accounts2 | {"login":"collaborator","password":"222222"}`);

      expect(output).toContain(`Got changed login nick
  ✔ Should log accounts3 | ["nick","pick"]`);

      expect(output).toContain(`Got changed login jack
  ✔ Should log accounts3 | ["jack","sacj"]`);

      expect(output).toContain(`Got generator login nick
  ✔ Should log accounts4 | {"user":"nick"}`);

      expect(output).toContain(`Got generator login pick
  ✔ Should log accounts4 | {"user":"pick"}`);

      expect(output).toContain(`Got array item 1
  ✔ Should log array of strings | {"1"}`);

      expect(output).toContain(`Got array item 2
  ✔ Should log array of strings | {"2"}`);

      expect(output).toContain(`Got array item 3
  ✔ Should log array of strings | {"3"}`);

      expect(err).toBeFalsy();
      done();
    });
  });

  it('should run all tests with data of array by only', (done) => {
    exec(config_run_config('codecept.addt.json'), (err, stdout) => {
      const output = stdout.replace(/in [0-9]ms/g, '').replace(/\r/g, '');
      expect(output).toContain('Got array item 1');
      expect(output).toContain('Should log array of strings | {"1"}');
      expect(output).toContain('Got array item 2');
      expect(output).toContain('Should log array of strings | {"2"}');
      expect(output).toContain('Got array item 3');
      expect(output).toContain('Should log array of strings | {"3"}');
      expect(err).toBeFalsy();
      done();
    });
  });

  it('should run all tests with data of generator by only', (done) => {
    exec(config_run_config('codecept.gddt.json'), (err, stdout) => {
      const output = stdout.replace(/in [0-9]ms/g, '').replace(/\r/g, '');
      expect(output).toContain(`Got generator login nick
  ✔ Should log generator of strings | {"user":"nick"}`);

      expect(output).toContain(`Got generator login pick
  ✔ Should log generator of strings | {"user":"pick"}`);
      expect(err).toBeFalsy();
      done();
    });
  });

  it('should execute expected promise chain', (done) => {
    exec(`${codecept_run} --verbose`, (err, stdout) => {
      const lines = stdout.match(/\S.+/g);

      // before hooks
      const beforeStep = [
        'I am in path "."',
      ];

      lines.filter(l => beforeStep.indexOf(l) > -1)
        .should.eql(beforeStep, 'check step hooks execution order');

      // steps order
      const step = [
        'I am in path "."',
        'hello world',
        'I see file "codecept.json"',
      ];

      lines.filter(l => step.indexOf(l) > -1)
        .should.eql(step, 'check steps execution order');

      expect(err).toBeFalsy();
      done();
    });
  });

  it('should display steps and artifacts & error log', (done) => {
    exec(`${config_run_config('./configs/testArtifacts')} --debug`, (err, stdout) => {
      stdout.should.include('Scenario Steps:');
      stdout.should.include('Artifacts');
      stdout.should.include('- screenshot: [ SCREEENSHOT FILE ]');
      done();
    });
  });
});
