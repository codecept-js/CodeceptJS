const fs = require('fs');
const { print } = require('./output');

const writeFailedTest = (failedTests) => {
  if (failedTests.length !== 0) {
    fs.writeFileSync('failedCases.json', JSON.stringify(failedTests));
  } else if (fs.existsSync('failedCases.json')) {
    fs.unlinkSync('failedCases.json');
  }
};

exports.writeFailedTest = writeFailedTest;

const getFailedTest = () => {
  if (!fs.existsSync('failedCases.json')) {
    print('There Are No Failed/Custom Scripts From Previous Execution');
  } else {
    const failedTests = JSON.parse(fs.readFileSync('failedCases.json', 'utf8'));
    if (failedTests.length === 0 || failedTests.toString() === '') {
      print('There Are No Failed/Custom Scripts From Previous Execution');
      writeFailedTest([]);
    } else {
      return failedTests;
    }
  }
  return [];
};

exports.getFailedTest = getFailedTest;
