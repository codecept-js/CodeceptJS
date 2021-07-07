const event = require('../event');
const container = require('../container');
const recorder = require('../recorder');
const store = require('../store');
const { error } = require('../output');
/**
 * Enable Helpers to listen to test events
 */
module.exports = function () {
  const helpers = container.helpers();

  const runHelpersHook = (hook, param) => {
    if (store.dryRun) return;
    Object.values(helpers).forEach((helper) => {
      if (helper[hook]) {
        helper[hook](param);
      }
    });
  };

  const runAsyncHelpersHook = (hook, param, force) => {
    if (store.dryRun) return;
    Object.keys(helpers).forEach((key) => {
      if (!helpers[key][hook]) return;
      recorder.add(`hook ${key}.${hook}()`, () => helpers[key][hook](param), force, false);
    });
  };

  event.dispatcher.on(event.suite.before, (suite) => {
    // if (suite.parent) return; // only for root suite
    runAsyncHelpersHook('_beforeSuite', suite, true);
  });

  event.dispatcher.on(event.suite.after, (suite) => {
    // if (suite.parent) return; // only for root suite
    runAsyncHelpersHook('_afterSuite', suite, true);
  });

  event.dispatcher.on(event.test.started, (test) => {
    runHelpersHook('_test', test);
    recorder.catch(e => error(e));
  });

  event.dispatcher.on(event.test.before, (test) => {
    // schedule config to revert changes
    runAsyncHelpersHook('_before', test, true);
    recorder.catchWithoutStop(e => error(e));
  });

  event.dispatcher.on(event.test.passed, (test) => {
    runAsyncHelpersHook('_passed', test, true);
    // should not fail test execution, so errors should be caught
    recorder.catchWithoutStop(e => error(e));
  });

  event.dispatcher.on(event.test.failed, (test) => {
    runAsyncHelpersHook('_failed', test, true);
    // should not fail test execution, so errors should be caught
    recorder.catchWithoutStop(e => error(e));
  });

  event.dispatcher.on(event.test.after, () => {
    runAsyncHelpersHook('_after', {}, true);
    recorder.catchWithoutStop(e => error(e));
  });

  event.dispatcher.on(event.step.before, (step) => {
    runAsyncHelpersHook('_beforeStep', step);
  });

  event.dispatcher.on(event.step.after, (step) => {
    runAsyncHelpersHook('_afterStep', step);
  });

  event.dispatcher.on(event.all.result, () => {
    runAsyncHelpersHook('_finishTest', {}, true);
  });
};
