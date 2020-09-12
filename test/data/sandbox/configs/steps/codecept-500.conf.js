exports.config = {
  tests: './*_test.js',
  output: './output',
  stepTimeout: 500,
  helpers: {
    CustomHelper: {
      require: './customHelper.js',
    },
  },
  plugins: {
  },
  name: 'steps',
};
