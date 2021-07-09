const { expect } = require('chai');
const assert = require('assert');
const sinon = require('sinon');
const { getFailedTest, writeFailedTest } = require('../../lib/reRunFailedTest');

const options = {
  failed: true,
};

describe('Get Failed/Custom Test', () => {
  it('should exit the process as failedCases.json is either empty or does not exist', async () => {
    await writeFailedTest([]);
    sinon.stub(process, 'exit');
    await getFailedTest(options);
    assert(process.exit.isSinonProxy);
  });

  it('should return the test scripts failed from previous execution', async () => {
    const failedScripts = ['test/login.js', 'test/logout.js'];
    await writeFailedTest(failedScripts);
    const failedTests = getFailedTest(options);
    expect(failedScripts).to.eql(failedTests);
  });
});
