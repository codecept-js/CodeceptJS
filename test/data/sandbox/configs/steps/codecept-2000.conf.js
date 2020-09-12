exports.config = {
  tests: './*_test.js',
  output: './output',
  stepTimeout: 2000,
  helpers: {
    CustomHelper: {
      require: './customHelper.js',
    },
  },
  plugins: {
  },
  name: 'steps',
};
