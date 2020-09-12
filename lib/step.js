// TODO: place MetaStep in other file, disable rule
/* eslint-disable max-classes-per-file */
const store = require('./store');
const Secret = require('./secret');
const event = require('./event');
const config = require('./config');

const STACK_LINE = 4;

/**
 * Each command in test executed through `I.` object is wrapped in Step.
 * Step allows logging executed commands and triggers hook before and after step execution.
 * @param {CodeceptJS.Helper} helper
 * @param {string} name
 */
class Step {
  constructor(helper, name) {
    /** @member {string} */
    this.actor = 'I'; // I = actor
    /** @member {CodeceptJS.Helper} */
    this.helper = helper; // corresponding helper
    /** @member {string} */
    this.name = name; // name of a step console
    /** @member {string} */
    this.helperMethod = name; // helper method
    /** @member {string} */
    this.status = 'pending';
    /**
     * @member {string} suffix
     * @memberof CodeceptJS.Step#
     */
    /** @member {string} */
    this.prefix = this.suffix = '';
    /** @member {string} */
    this.comment = '';
    /** @member {Array<*>} */
    this.args = [];
    /** @member {MetaStep} */
    this.metaStep = undefined;
    /** @member {string} */
    this.stack = '';
    this.setTrace();
  }

  /** @function */
  setTrace() {
    Error.captureStackTrace(this);
  }

  /** @param {Array<*>} args */
  setArguments(args) {
    this.args = args;
  }

  /**
   * @param {...any} args
   * @return {*}
   */
  run() {
    this.args = Array.prototype.slice.call(arguments);
    if (store.dryRun) {
      this.setStatus('success');
      return Promise.resolve(new Proxy({}, dryRunResolver()));
    }
    let result;

    let timeout;
    try {
      result = Promise.race([
        this.helper[this.helperMethod].apply(this.helper, this.args),
        new Promise((resolve, reject) => { // Promise with timeout
          if (!this.name.startsWith('wait')) {
            const stepTimeout = config.get('stepTimeout');
            timeout = setTimeout(() => reject(
              new Error(`Step execution timeout of ${stepTimeout} ms exceeded`),
            ), stepTimeout);
          }
        }),
      ]);
      this.setStatus('success');
    } catch (err) {
      this.setStatus('failed');
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    return result;
  }

  /** @param {string} status */
  setStatus(status) {
    this.status = status;
    if (this.metaStep) {
      this.metaStep.setStatus(status);
    }
  }

  /** @return {string} */
  humanize() {
    return this.name
    // insert a space before all caps
      .replace(/([A-Z])/g, ' $1')
    // _ chars to spaces
      .replace('_', ' ')
    // uppercase the first character
      .replace(/^(.)|\s(.)/g, $1 => $1.toLowerCase());
  }

  /** @return {string} */
  humanizeArgs() {
    return this.args.map((arg) => {
      if (!arg) {
        return '';
      }
      if (typeof arg === 'string') {
        return `"${arg}"`;
      }
      if (Array.isArray(arg)) {
        try {
          const res = JSON.stringify(arg);
          return res;
        } catch (err) {
          return `[${arg.toString()}]`;
        }
      } else if (typeof arg === 'function') {
        return arg.toString();
      } else if (typeof arg === 'undefined') {
        return `${arg}`;
      } else if (arg instanceof Secret) {
        return '*****';
      } else if (arg.toString && arg.toString() !== '[object Object]') {
        return arg.toString();
      } else if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return arg;
    }).join(', ');
  }

  /** @return {string} */
  line() {
    const lines = this.stack.split('\n');
    if (lines[STACK_LINE]) {
      return lines[STACK_LINE].trim().replace(global.codecept_dir || '', '.').trim();
    }
    return '';
  }

  /** @return {string} */
  toString() {
    return `${this.prefix}${this.actor} ${this.humanize()} ${this.humanizeArgs()}${this.suffix}`;
  }

  /** @return {string} */
  toCode() {
    return `${this.prefix}${this.actor}.${this.name}(${this.humanizeArgs()})${this.suffix}`;
  }

  isMetaStep() {
    return this.constructor.name === 'MetaStep';
  }

  /** @return {boolean} */
  hasBDDAncestor() {
    let hasBDD = false;
    let processingStep;
    processingStep = this;

    while (processingStep.metaStep) {
      if (processingStep.metaStep.actor.match(/^(Given|When|Then|And)/)) {
        hasBDD = true;
        break;
      } else {
        processingStep = processingStep.metaStep;
      }
    }
    return hasBDD;
  }
}

/** @extends Step */
class MetaStep extends Step {
  constructor(obj, method) {
    super(null, method);
    this.actor = obj;
  }

  /** @return {boolean} */
  isBDD() {
    if (this.actor && this.actor.match && this.actor.match(/^(Given|When|Then|And)/)) {
      return true;
    }
    return false;
  }

  isWithin() {
    if (this.actor && this.actor.match && this.actor.match(/^(Within)/)) {
      return true;
    }
    return false;
  }

  toString() {
    const actorText = !this.isBDD() && !this.isWithin() ? `${this.actor}:` : this.actor;
    return `${this.prefix}${actorText} ${this.humanize()} ${this.humanizeArgs()}${this.suffix}`;
  }

  humanize() {
    return this.name;
  }

  setTrace() {
  }

  setContext(context) {
    this.context = context;
  }

  /** @return {*} */
  run(fn) {
    this.status = 'queued';
    this.setArguments(Array.from(arguments).slice(1));
    let result;

    const registerStep = (step) => {
      step.metaStep = this;
    };
    event.dispatcher.on(event.step.before, registerStep);
    try {
      this.startTime = Date.now();
      result = fn.apply(this.context, this.args);
    } catch (error) {
      this.status = 'failed';
    } finally {
      this.endTime = Date.now();

      event.dispatcher.removeListener(event.step.before, registerStep);
    }
    return result;
  }
}

/** @type {Class<MetaStep>} */
Step.MetaStep = MetaStep;

module.exports = Step;

function dryRunResolver() {
  return {
    get(target, prop) {
      if (prop === 'toString') return () => '<VALUE>';
      return new Proxy({}, dryRunResolver());
    },
  };
}
