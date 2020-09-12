const fs = require('fs');
const path = require('path');
const {
  fileExists,
  isFile,
  deepMerge,
  deepClone,
} = require('./utils');

const defaultConfig = {
  output: './_output',
  helpers: {},
  include: {},
  mocha: {},
  stepTimeout: 30000,
  bootstrap: null,
  teardown: null,
  hooks: [],
  gherkin: {},
  plugins: {
    screenshotOnFail: {
      enabled: true, // will be disabled by default in 2.0
    },
  },
};

let hooks = [];
let config = {};

/**
 * Current configuration
 */
class Config {
  /**
   * Create a config with default options
   *
   * @param {*} newConfig
   * @return {Object<string, *>}
   */
  static create(newConfig) {
    config = deepMerge(deepClone(defaultConfig), newConfig);
    hooks.forEach(f => f(config));
    return config;
  }

  /**
   * Load config from a file.
   * If js file provided: require it and get .config key
   * If json file provided: load and parse JSON
   * If directory provided:
   * * try to load `codecept.conf.js` from it
   * * try to load `codecept.json` from it
   * If none of above: fail.
   *
   * @param {string} configFile
   * @return {*}
   */
  static load(configFile) {
    configFile = path.resolve(configFile || '.');

    if (!fileExists(configFile)) {
      throw new Error(`Config file ${configFile} does not exist. Execute 'codeceptjs init' to create config`);
    }

    // is config file
    if (isFile(configFile)) {
      return loadConfigFile(configFile);
    }

    // is path to directory
    const jsConfig = path.join(configFile, 'codecept.conf.js');
    if (isFile(jsConfig)) {
      return loadConfigFile(jsConfig);
    }

    const jsonConfig = path.join(configFile, 'codecept.json');
    if (isFile(jsonConfig)) {
      return loadConfigFile(jsonConfig);
    }

    throw new Error(`Can not load config from ${jsConfig} or ${jsonConfig}\nCodeceptJS is not initialized in this dir. Execute 'codeceptjs init' to start`);
  }

  /**
   * Get current config.
   * @param {string} key
   * @param {*=} val
   * @return {*}
   */
  static get(key, val) {
    if (key) {
      return config[key] || val;
    }
    return config;
  }

  static addHook(fn) {
    hooks.push(fn);
  }

  /**
   * Appends values to current config
   *
   * @param {Object<string, *>} additionalConfig
   * @return {Object<string, *>}
   */
  static append(additionalConfig) {
    return config = deepMerge(config, additionalConfig);
  }

  /**
   * Resets config to default
   * @return {Object<string, *>}
   */
  static reset() {
    hooks = [];
    return config = { ...defaultConfig };
  }
}

module.exports = Config;

function loadConfigFile(configFile) {
  // .conf.js config file
  if (path.extname(configFile) === '.js') {
    return Config.create(require(configFile).config);
  }

  // json config provided
  if (path.extname(configFile) === '.json') {
    return Config.create(JSON.parse(fs.readFileSync(configFile, 'utf8')));
  }
  throw new Error(`Config file ${configFile} can't be loaded`);
}
