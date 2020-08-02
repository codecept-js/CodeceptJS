const expect = require('expect');
const path = require('path');
const exec = require('child_process').exec;

const runner = path.join(__dirname, '/../../bin/codecept.js');
const codecept_dir = path.join(__dirname, '/../data/sandbox/configs/steps');
const codecept_run = `${runner} run`;
const config_run_config = (config, grep) => `${codecept_run} --config ${codecept_dir}/${config} ${grep ? `--grep "${grep}"` : ''}`;

describe('CodeceptJS Steps', () => {
  it('should stop test, when step exceeded', (done) => {
    exec(config_run_config('codecept-500.conf.js', 'Default command timeout'), (err, stdout) => {
      expect(stdout).toContain('Step execution timeout of 500 ms exceeded');
      expect(stdout).toContain('FAIL  | 0 passed, 1 failed');
      expect(stdout).toContain('- I.exceededByTimeout(1000)');
      expect(err).toBeTruthy();
      done();
    });
  });

  it('should not stop test, when step not exceeded', (done) => {
    exec(config_run_config('codecept-2000.conf.js', 'Default command timeout'), (err, stdout) => {
      expect(stdout).not.toContain('Step execution timeout of 2000 ms exceeded');
      expect(stdout).toContain('OK  | 1 passed');
      expect(err).toBeFalsy();
      done();
    });
  });

  it('should ignore timeout for steps with `wait*` prefix', (done) => {
    exec(config_run_config('codecept-500.conf.js', 'Wait command timeout'), (err, stdout) => {
      expect(stdout).not.toContain('Step execution timeout of 500 ms exceeded');
      expect(stdout).toContain('OK  | 1 passed');
      expect(err).toBeFalsy();
      done();
    });
  });
});
