const Allure = require('allure-js-commons');

const event = require('../event');
const logger = require('../output');
const { ansiRegExp } = require('../utils');

const defaultConfig = {
  outputDir: global.output_dir,
};

/**
 * Allure reporter
 *
 * ![](https://user-images.githubusercontent.com/220264/45676511-8e052800-bb3a-11e8-8cbb-db5f73de2add.png)
 *
 * Enables Allure reporter.
 *
 * #### Usage
 *
 * To start please install `allure-commandline` package (which requires Java 8)
 *
 * ```
 * npm install -g allure-commandline --save-dev
 * ```
 *
 * Add this plugin to config file:
 *
 * ```js
 * "plugins": {
 *     "allure": {}
 * }
 * ```
 *
 * Run tests with allure plugin enabled:
 *
 * ```
 * npx codeceptjs run --plugins allure
 * ```
 *
 * By default, allure reports are saved to `output` directory.
 * Launch Allure server and see the report like on a screenshot above:
 *
 * ```
 * allure serve output
 * ```
 *
 * #### Configuration
 *
 * * `outputDir` - a directory where allure reports should be stored. Standard output directory is set by default.
 * * `enableScreenshotDiffPlugin` - a boolean flag for add screenshot diff to report.
 *    To attach, tou need to attach three files to the report - "diff.png", "actual.png", "expected.png".
 *    See [Allure Screenshot Plugin](https://github.com/allure-framework/allure2/blob/master/plugins/screen-diff-plugin/README.md)
 *
 * #### Public API
 *
 * There are few public API methods which can be accessed from other plugins.
 *
 * ```js
 * const allure = codeceptjs.container.plugins('allure');
 * ```
 *
 * `allure` object has following methods:
 *
 * * `addAttachment(name, buffer, type)` - add an attachment to current test / suite
 * * `addLabel(name, value)` - adds a label to current test
 * * `addParameter(kind, name, value)` - adds a parameter to current test
 * * `severity(value)` - adds severity label
 * * `epic(value)` - adds epic label
 * * `feature(value)` - adds feature label
 * * `story(value)` - adds story label
 * * `issue(value)` - adds issue label
 * * `setDescription(description, type)` - sets a description
 *
 */
module.exports = (config) => {
  defaultConfig.outputDir = global.output_dir;
  config = Object.assign(defaultConfig, config);

  const plugin = {};

  const reporter = new Allure();
  reporter.setOptions({ targetDir: config.outputDir });

  let currentMetaStep = [];
  let currentStep;

  reporter.pendingCase = function (testName, timestamp, opts = {}) {
    reporter.startCase(testName, timestamp);

    if (opts.description) plugin.setDescription(opts.description);
    if (opts.severity) plugin.severity(opts.severity);
    if (opts.severity) plugin.addLabel('tag', opts.severity);

    reporter.endCase('pending', { message: opts.message || 'Test ignored' }, timestamp);
  };

  plugin.addAttachment = (name, buffer, type) => {
    reporter.addAttachment(name, buffer, type);
  };

  plugin.setDescription = (description, type) => {
    const currentTest = reporter.getCurrentTest();
    if (currentTest) {
      currentTest.setDescription(description, type);
    } else {
      logger.error(`The test is not run. Please use "setDescription" for events:
      "test.start", "test.before", "test.after", "test.passed", "test.failed", "test.finish"`);
    }
  };

  plugin.createStep = (name, stepFunc = () => { }) => {
    let result;
    let status = 'passed';
    reporter.startStep(name);
    try {
      result = stepFunc(this.arguments);
    } catch (error) {
      status = 'broken';
      throw error;
    } finally {
      if (!!result
        && (typeof result === 'object' || typeof result === 'function')
        && typeof result.then === 'function'
      ) {
        result.then(() => reporter.endStep('passed'), () => reporter.endStep('broken'));
      } else {
        reporter.endStep(status);
      }
    }
    return result;
  };

  plugin.createAttachment = (name, content, type) => {
    if (typeof content === 'function') {
      const attachmentName = name;
      const buffer = content.apply(this, arguments);
      return createAttachment(attachmentName, buffer, type);
    } reporter.addAttachment(name, content, type);
  };

  plugin.severity = (severity) => {
    plugin.addLabel('severity', severity);
  };

  plugin.epic = (epic) => {
    plugin.addLabel('epic', epic);
  };

  plugin.feature = (feature) => {
    plugin.addLabel('feature', feature);
  };

  plugin.story = (story) => {
    plugin.addLabel('story', story);
  };

  plugin.issue = (issue) => {
    plugin.addLabel('issue', issue);
  };

  plugin.addLabel = (name, value) => {
    const currentTest = reporter.getCurrentTest();
    if (currentTest) {
      currentTest.addLabel(name, value);
    } else {
      logger.error(`The test is not run. Please use "addLabel" for events:
      "test.start", "test.before", "test.after", "test.passed", "test.failed", "test.finish"`);
    }
  };

  plugin.addParameter = (kind, name, value) => {
    const currentTest = reporter.getCurrentTest();
    if (currentTest) {
      currentTest.addParameter(kind, name, value);
    } else {
      logger.error(`The test is not run. Please use "addParameter" for events:
      "test.start", "test.before", "test.after", "test.passed", "test.failed", "test.finish"`);
    }
  };

  event.dispatcher.on(event.suite.before, (suite) => {
    reporter.startSuite(suite.fullTitle());
  });

  event.dispatcher.on(event.suite.before, (suite) => {
    for (const test of suite.tests) {
      if (test.pending) {
        reporter.pendingCase(test.title, null, test.opts.skipInfo);
      }
    }
  });

  event.dispatcher.on(event.suite.after, () => {
    reporter.endSuite();
  });

  event.dispatcher.on(event.test.before, (test) => {
    reporter.startCase(test.title);
    if (config.enableScreenshotDiffPlugin) {
      const currentTest = reporter.getCurrentTest();
      currentTest.addLabel('testType', 'screenshotDiff');
    }
    currentStep = null;
  });

  event.dispatcher.on(event.test.started, (test) => {
    const currentTest = reporter.getCurrentTest();
    for (const tag of test.tags) {
      currentTest.addLabel('tag', tag);
    }
  });

  event.dispatcher.on(event.test.failed, (test, err) => {
    if (currentStep) reporter.endStep('failed');
    if (currentMetaStep.length) {
      currentMetaStep.forEach(() => reporter.endStep('failed'));
      currentMetaStep = [];
    }

    err.message = err.message.replace(ansiRegExp(), '');
    if (reporter.getCurrentTest()) {
      reporter.endCase('failed', err);
    } else {
      // this means before suite failed, we should report this.
      reporter.startCase(`BeforeSuite of suite ${reporter.getCurrentSuite().name} failed.`);
      reporter.endCase('failed', err);
    }
  });

  event.dispatcher.on(event.test.passed, () => {
    if (currentStep) reporter.endStep('passed');
    if (currentMetaStep.length) {
      currentMetaStep.forEach(() => reporter.endStep('passed'));
      currentMetaStep = [];
    }
    reporter.endCase('passed');
  });

  event.dispatcher.on(event.test.skipped, (test) => {
    let loaded = true;
    if (test.opts.skipInfo.isFastSkipped) {
      loaded = false;
      reporter.startSuite(test.parent.fullTitle());
    }
    reporter.pendingCase(test.title, null, test.opts.skipInfo);
    if (!loaded) {
      reporter.endSuite();
    }
  });

  event.dispatcher.on(event.step.started, (step) => {
    startMetaStep(step.metaStep);
    if (currentStep !== step) {
      // In multi-session scenarios, actors' names will be highlighted with ANSI
      // escape sequences which are invalid XML values
      step.actor = step.actor.replace(ansiRegExp(), '');
      reporter.startStep(step.toString());
      currentStep = step;
    }
  });

  event.dispatcher.on(event.step.comment, (step) => {
    reporter.startStep(step.toString());
    currentStep = step;
    reporter.endStep('passed');
    currentStep = null;
  });

  event.dispatcher.on(event.step.passed, (step) => {
    if (currentStep === step) {
      reporter.endStep('passed');
      currentStep = null;
    }
  });

  event.dispatcher.on(event.step.failed, (step) => {
    if (currentStep === step) {
      reporter.endStep('failed');
      currentStep = null;
    }
  });

  let maxLevel;
  function finishMetastep(level) {
    const metaStepsToFinish = currentMetaStep.splice(maxLevel - level);
    metaStepsToFinish.forEach(() => reporter.endStep('passed'));
  }

  function startMetaStep(metaStep, level = 0) {
    maxLevel = level;
    if (!metaStep) {
      finishMetastep(0);
      maxLevel--;
      return;
    }

    startMetaStep(metaStep.metaStep, level + 1);

    if (metaStep.toString() !== currentMetaStep[maxLevel - level]) {
      finishMetastep(level);
      currentMetaStep.push(metaStep.toString());
      reporter.startStep(metaStep.toString());
    }
  }

  return plugin;
};
