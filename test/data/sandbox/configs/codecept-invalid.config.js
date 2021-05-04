badFn();

exports.config = {
  tests: '../../**/*.js',
  timeout: 10000,
  output: './output',
  helpers: {
    FileSystem: {},
  },
  include: {},
  mocha: {},
  name: 'sandbox',
};
