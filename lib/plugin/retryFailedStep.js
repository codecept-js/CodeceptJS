const event = require('../event');
const recorder = require('../recorder');

const defaultConfig = {
  retries: 5,
  defaultIgnoredSteps: [
    'amOnPage',
    'wait*',
    'send*',
    'execute*',
    'run*',
    'have*',
  ],
  ignoredSteps: [],
  removeDefaultIgnoreSteps: [],
};

/**
 * Retries each failed step in a test.
 *
 * Add this plugin to config file:
 *
 * ```js
 * plugins: {
 *     retryFailedStep: {
 *        enabled: true
 *     }
 * }
 * ```
 *
 *
 * Run tests with plugin enabled:
 *
 * ```
 * npx codeceptjs run --plugins retryFailedStep
 * ```
 *
 * #### Configuration:
 *
 * * `retries` - number of retries (by default 5),
 * * `when` - function, when to perform a retry (accepts error as parameter)
 * * `factor` - The exponential factor to use. Default is 2.
 * * `minTimeout` - The number of milliseconds before starting the first retry. Default is 1000.
 * * `maxTimeout` - The maximum number of milliseconds between two retries. Default is Infinity.
 * * `randomize` - Randomizes the timeouts by multiplying with a factor between 1 to 2. Default is false.
 * * `defaultIgnoredSteps` - an array of steps to be ignored for retry. Includes:
 *     * `amOnPage`
 *     * `wait*`
 *     * `send*`
 *     * `execute*`
 *     * `run*`
 *     * `have*`
 * * `ignoredSteps` - an array for custom steps to ignore on retry. Use it to append custom steps to ignored list.
 * You can use step names or step prefixes ending with `*`. As such, `wait*` will match all steps starting with `wait`.
 * To append your own steps to ignore list - copy and paste a default steps list. Regexp values are accepted as well.
 * * `removeDefaultIgnoreSteps` - an array to remove the step in the defaultIgnoredSteps list.
 * You can use step names or step prefixes ending with `*`. As such, `wait*` will match all steps starting with `wait`.
 *
 * #### Example
 *
 * ```js
 * plugins: {
 *     retryFailedStep: {
 *         enabled: true,
 *         ignoreSteps: [
 *           'scroll*', // ignore all scroll steps
 *           /Cookie/, // ignore all steps with a Cookie in it (by regexp)
 *         ],
 *         removeDefaultIgnoreSteps: [
 *         'send*', // remove the send* steps in the defaultIgnoredSteps list
 *         ]
 *     }
 * }
 * ```
 *
 * #### Disable Per Test
 *
 * This plugin can be disabled per test. In this case you will need to stet `I.retry()` to all flaky steps:
 *
 * Use scenario configuration to disable plugin for a test
 *
 * ```js
 * Scenario('scenario tite', () => {
 *    // test goes here
 * }).config(test => test.disableRetryFailedStep = true)
 * ```
 *
 */
module.exports = (config) => {
  config = Object.assign(defaultConfig, config);

  if (config.removeDefaultIgnoreSteps.length > 0) {
    config.removeDefaultIgnoreSteps.forEach(item => {
      config.defaultIgnoredSteps = config.defaultIgnoredSteps.filter((step) => {
        return item !== step;
      });
    });
  }

  config.ignoredSteps = config.ignoredSteps.concat(config.defaultIgnoredSteps);
  const customWhen = config.when;

  let enableRetry = false;

  const when = (err) => {
    if (!enableRetry) return;
    const store = require('../store');
    if (store.debugMode) return false;
    if (customWhen) return customWhen(err);
    return true;
  };
  config.when = when;

  event.dispatcher.on(event.step.started, (step) => {
    // if a step is ignored - return
    for (const ignored of config.ignoredSteps) {
      if (step.name === ignored) return;
      if (ignored instanceof RegExp) {
        if (step.name.match(ignored)) return;
      } else if (ignored.indexOf('*') && step.name.startsWith(ignored.slice(0, -1))) return;
    }
    enableRetry = true; // enable retry for a step
  });

  event.dispatcher.on(event.step.finished, () => {
    enableRetry = false;
  });

  event.dispatcher.on(event.test.before, (test) => {
    if (test && test.disableRetryFailedStep) return; // disable retry when a test is not active
    recorder.retry(config);
  });
};
