const colors = require('chalk');
const figures = require('figures');

const styles = {
  error: colors.bgRed.white.bold,
  success: colors.bgGreen.white.bold,
  scenario: colors.magenta.bold,
  basic: colors.white,
  debug: colors.cyan,
  log: colors.grey,
  bold: colors.bold,
};

let outputLevel = 0;
let outputProcess = '';
let newline = true;

/**
 * @alias output
 * @namespace
 */
module.exports = {
  colors,
  styles,
  print,
  /** @type {number} */
  stepShift: 0,

  /**
   * Set or return current verbosity level
   * @param {number} [level]
   * @returns {number}
   */
  level(level) {
    if (level !== undefined) outputLevel = level;
    return outputLevel;
  },

  /**
   * Print information for a process
   * Used in multiple-run
   * @param {string | null} process
   * @returns {string}
   */
  process(process) {
    if (process === null) return outputProcess = '';
    if (process) outputProcess = String(process).length === 1 ? `[0${process}]` : `[${process}]`;
    return outputProcess;
  },

  /**
   * Print information in --debug mode
   * @param {string} msg
   */
  debug(msg) {
    if (outputLevel >= 2) {
      print(' '.repeat(this.stepShift), styles.debug(`${figures.pointerSmall} ${msg}`));
    }
  },

  /**
   * Print information in --verbose mode
   * @param {string} msg
   */
  log(msg) {
    if (outputLevel >= 3) {
      print(' '.repeat(this.stepShift), styles.log(truncate(`   ${msg}`, this.spaceShift)));
    }
  },

  /**
   * Print error
   * @param {string} msg
   */
  error(msg) {
    print(styles.error(msg));
  },

  /**
   * Print a successful message
   * @param {string} msg
   */
  success(msg) {
    print(styles.success(msg));
  },

  /**
   * Prints plugin message
   * @param {string} pluginName
   * @param {string} msg
   */
  plugin(pluginName, msg = '') {
    this.debug(`<${pluginName}> ${msg}`);
  },

  /**
   * Print a step
   * @param {CodeceptJS.Step} step
   */
  step(step) {
    if (outputLevel === 0) return;
    if (!step) return;
    // Avoid to print non-gherkin steps, when gherkin is running for --steps mode
    if (outputLevel === 1) {
      if (step.hasBDDAncestor()) {
        return;
      }
    }

    let stepLine = step.toString();
    if (step.metaStep && outputLevel >= 1) {
      // this.stepShift += 2;
      stepLine = colors.green(truncate(stepLine, this.spaceShift));
    }
    if (step.comment) {
      stepLine += colors.grey(step.comment.split('\n').join('\n' + ' '.repeat(4))); // eslint-disable-line
    }

    print(' '.repeat(this.stepShift), truncate(stepLine, this.spaceShift));
  },

  /** @namespace */
  suite: {
    /**
     * @param {Mocha.Suite} suite
     */
    started: (suite) => {
      if (!suite.title) return;
      print(`${colors.bold(suite.title)} --`);
      if (suite.comment) print(suite.comment);
    },
  },

  /** @namespace */
  test: {
    /**
     * @param {Mocha.Test} test
     */
    started(test) {
      print(`  ${colors.magenta.bold(test.title)}`);
    },
    /**
     * @param {Mocha.Test} test
     */
    passed(test) {
      print(`  ${colors.green.bold(figures.tick)} ${test.title} ${colors.grey(`in ${test.duration}ms`)}`);
    },
    /**
     * @param {Mocha.Test} test
     */
    failed(test) {
      print(`  ${colors.red.bold(figures.cross)} ${test.title} ${colors.grey(`in ${test.duration}ms`)}`);
    },
    /**
     * @param {Mocha.Test} test
     */
    skipped(test) {
      print(`  ${colors.yellow.bold('S')} ${test.title}`);
    },
  },

  /** @namespace */
  scenario: {
    /**
     * @param {Mocha.Test} test
    */
    /* eslint-disable */
    started(test) {},
    /* eslint-enable */
    /**
     * @param {Mocha.Test} test
     */
    passed(test) {
      print(`  ${colors.green.bold(`${figures.tick} OK`)} ${colors.grey(`in ${test.duration}ms`)}`);
      print();
    },
    /**
     * @param {Mocha.Test} test
     */
    failed(test) {
      print(`  ${colors.red.bold(`${figures.cross} FAILED`)} ${colors.grey(`in ${test.duration}ms`)}`);
      print();
    },
  },

  /**
   *
   * Print a text in console log
   * @param {string} message
   * @param {string} [color]
   */
  say(message, color = 'cyan') {
    if (colors[color] === undefined) {
      color = 'cyan';
    }
    if (outputLevel >= 1) print(`   ${colors[color].bold(message)}`);
  },

  /**
   * @param {number} passed
   * @param {number} failed
   * @param {number} skipped
   * @param {number|string} duration
   */
  result(passed, failed, skipped, duration) {
    let style = colors.bgGreen;
    let msg = ` ${passed || 0} passed`;
    let status = style.bold('  OK ');
    if (failed) {
      style = style.bgRed;
      status = style.bold('  FAIL ');
      msg += `, ${failed} failed`;
    }
    status += style.grey(' |');

    if (skipped) {
      if (!failed) style = style.bgYellow;
      msg += `, ${skipped} skipped`;
    }
    msg += '  ';
    print(status + style(msg) + colors.grey(` // ${duration}`));
  },
};

function print(...msg) {
  if (outputProcess) {
    msg.unshift(outputProcess);
  }
  if (!newline) {
    console.log();
    newline = true;
  }

  console.log.apply(this, msg);
}

function truncate(msg, gap = 0) {
  if (msg.indexOf('\n') > 0 || outputLevel >= 3) {
    return msg; // don't cut multi line steps or on verbose log level
  }
  const width = (process.stdout.columns || 200) - gap - 4;
  if (msg.length > width) {
    msg = msg.substr(0, width - 1) + figures.ellipsis;
  }
  return msg;
}
