const event = require('../../../lib/event');

exports.config = {
  tests: './*_test.js',
  timeout: 10000,
  output: './output',
  helpers: {
    FileSystem: {},
  },
  include: {},
  bootstrap: false,
  mocha: {},
  name: 'require test',
  multiple: {
    default: {
      browsers: ['chrome', { browser: 'firefox' }],
    },
  },
  bootstrapAll: async () => {
    await Promise.resolve('inside Promise').then(res => console.log(`Results: ${res}`));
    event.dispatcher.on(event.multiple.before, () => {
      console.log('"event.multiple.before" is called');
    });
  },
  teardownAll: async () => {
    console.log('"teardownAll" is called.');
  },
};
