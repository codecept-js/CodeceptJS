const glob = require('glob');
const path = require('path');
const { MetaStep } = require('./step');
const { fileExists, isFunction, isAsyncFunction } = require('./utils');
const Translation = require('./translation');
const MochaFactory = require('./mochaFactory');
const recorder = require('./recorder');
const event = require('./event');
const WorkerStorage = require('./workerStorage');

let container = {
  helpers: {},
  support: {},
  plugins: {},
  /**
   * @type {Mocha | {}}
   * @ignore
   */
  mocha: {},
  translation: {},
};

/**
 * Dependency Injection Container
 */
class Container {
  /**
   * Create container with all required helpers and support objects
   *
   * @api
   * @param {*} config
   * @param {*} opts
   */
  static create(config, opts) {
    const mochaConfig = config.mocha || {};
    if (config.grep && !opts.grep) {
      mochaConfig.grep = config.grep;
    }
    this.createMocha = () => {
      container.mocha = MochaFactory.create(mochaConfig, opts || {});
    };
    this.createMocha();
    container.helpers = createHelpers(config.helpers || {});
    container.translation = loadTranslation(config.translation || null);
    container.support = createSupportObjects(config.include || {});
    container.plugins = createPlugins(config.plugins || {}, opts);
    if (config.gherkin) loadGherkinSteps(config.gherkin.steps || []);
  }

  /**
   * Get all plugins
   *
   * @api
   * @param {string} [name]
   * @returns { * }
   */
  static plugins(name) {
    if (!name) {
      return container.plugins;
    }
    return container.plugins[name];
  }

  /**
   * Get all support objects or get support object by name
   *
   * @api
   * @param {string} [name]
   * @returns { * }
   */
  static support(name) {
    if (!name) {
      return container.support;
    }
    return container.support[name];
  }

  /**
   * Get all helpers or get a helper by name
   *
   * @api
   * @param {string} [name]
   * @returns { * }
   */
  static helpers(name) {
    if (!name) {
      return container.helpers;
    }
    return container.helpers[name];
  }

  /**
   * Get translation
   *
   * @api
   */
  static translation() {
    return container.translation;
  }

  /**
   * Get Mocha instance
   *
   * @api
   * @returns { * }
   */
  static mocha() {
    return container.mocha;
  }

  /**
   * Append new services to container
   *
   * @api
   * @param {Object<string, *>} newContainer
   */
  static append(newContainer) {
    const deepMerge = require('./utils').deepMerge;
    container = deepMerge(container, newContainer);
  }

  /**
   * Clear container
   *
   * @param {Object<string, *>} newHelpers
   * @param {Object<string, *>} newSupport
   * @param {Object<string, *>} newPlugins
   */
  static clear(newHelpers, newSupport, newPlugins) {
    container.helpers = newHelpers || {};
    container.support = newSupport || {};
    container.plugins = newPlugins || {};
    container.translation = loadTranslation();
  }

  /**
   * Share data across worker threads
   *
   * @param {Object} data
   * @param {Object} options - set {local: true} to not share among workers
   */
  static share(data, options = {}) {
    Container.append({ support: data });
    if (!options.local) {
      WorkerStorage.share(data);
    }
  }
}

module.exports = Container;

function createHelpers(config) {
  const helpers = {};
  let moduleName;
  for (const helperName in config) {
    try {
      if (config[helperName].require) {
        if (config[helperName].require.startsWith('.')) {
          moduleName = path.resolve(global.codecept_dir, config[helperName].require); // custom helper
        } else {
          moduleName = config[helperName].require; // plugin helper
        }
      } else {
        moduleName = `./helper/${helperName}`; // built-in helper
      }
      const HelperClass = require(moduleName);
      if (HelperClass._checkRequirements) {
        const requirements = HelperClass._checkRequirements();
        if (requirements) {
          let install;
          if (require('./utils').installedLocally()) {
            install = `npm install --save-dev ${requirements.join(' ')}`;
          } else {
            console.log('WARNING: CodeceptJS is not installed locally. It is recommended to switch to local installation');
            install = `[sudo] npm install -g ${requirements.join(' ')}`;
          }
          throw new Error(`Required modules are not installed.\n\nRUN: ${install}`);
        }
      }
      helpers[helperName] = new HelperClass(config[helperName]);
    } catch (err) {
      throw new Error(`Could not load helper ${helperName} from module '${moduleName}':\n${err.message}\n${err.stack}`);
    }
  }

  for (const name in helpers) {
    if (helpers[name]._init) helpers[name]._init();
  }
  return helpers;
}

function createSupportObjects(config) {
  const objects = {};

  for (const name in config) {
    objects[name] = {}; // placeholders
  }

  if (!config.I) {
    objects.I = require('./actor')();

    if (container.translation.I !== 'I') {
      objects[container.translation.I] = objects.I;
    }
  }

  container.support = objects;

  function lazyLoad(name) {
    let newObj = getSupportObject(config, name);
    try {
      if (typeof newObj === 'function') {
        newObj = newObj();
      } else if (newObj._init) {
        newObj._init();
      }
    } catch (err) {
      throw new Error(`Initialization failed for ${name}: ${newObj}\n${err.message}\n${err.stack}`);
    }
    return newObj;
  }

  const asyncWrapper = function (f) {
    return function () {
      return f.apply(this, arguments).catch((e) => {
        recorder.saveFirstAsyncError(e);
        throw e;
      });
    };
  };

  Object.keys(objects).forEach((object) => {
    const currentObject = objects[object];
    Object.keys(currentObject).forEach((method) => {
      const currentMethod = currentObject[method];
      if (currentMethod[Symbol.toStringTag] === 'AsyncFunction') {
        objects[object][method] = asyncWrapper(currentMethod);
      }
    });
  });

  return new Proxy({}, {
    has(target, key) {
      return key in config;
    },
    ownKeys() {
      return Reflect.ownKeys(config);
    },
    get(target, key) {
      // configured but not in support object, yet: load the module
      if (key in objects && !(key in target)) {
        // load default I
        if (key in objects && !(key in config)) {
          return target[key] = objects[key];
        }

        // load new object
        const object = lazyLoad(key);
        // check that object is a real object and not an array
        if (Object.prototype.toString.call(object) === '[object Object]') {
          return target[key] = Object.assign(objects[key], object);
        }
        target[key] = object;
      }
      return target[key];
    },
  });
}

function createPlugins(config, options = {}) {
  const plugins = {};

  const enabledPluginsByOptions = (options.plugins || '').split(',');
  for (const pluginName in config) {
    if (!config[pluginName]) config[pluginName] = {};
    if (!config[pluginName].enabled && (enabledPluginsByOptions.indexOf(pluginName) < 0)) {
      continue; // plugin is disabled
    }
    let module;
    try {
      if (config[pluginName].require) {
        module = config[pluginName].require;
        if (module.startsWith('.')) { // local
          module = path.resolve(global.codecept_dir, module); // custom plugin
        }
      } else {
        module = `./plugin/${pluginName}`;
      }
      plugins[pluginName] = require(module)(config[pluginName]);
    } catch (err) {
      throw new Error(`Could not load plugin ${pluginName} from module '${module}':\n${err.message}\n${err.stack}`);
    }
  }
  return plugins;
}

function getSupportObject(config, name) {
  const module = config[name];
  if (typeof module === 'string') {
    return loadSupportObject(module, name);
  }
  return module;
}

function loadGherkinSteps(paths) {
  global.Before = fn => event.dispatcher.on(event.test.started, fn);
  global.After = fn => event.dispatcher.on(event.test.finished, fn);
  global.Fail = fn => event.dispatcher.on(event.test.failed, fn);

  // If gherkin.steps is string, then this will iterate through that folder and send all step def js files to loadSupportObject
  // If gherkin.steps is Array, it will go the old way
  // This is done so that we need not enter all Step Definition files under config.gherkin.steps
  if (Array.isArray(paths)) {
    for (const path of paths) {
      loadSupportObject(path, `Step Definition from ${path}`);
    }
  } else {
    const folderPath = paths.startsWith('.') ? path.join(global.codecept_dir, paths) : '';
    if (folderPath !== '') {
      glob.sync(folderPath).forEach((file) => {
        loadSupportObject(file, `Step Definition from ${file}`);
      });
    }
  }

  delete global.Before;
  delete global.After;
  delete global.Fail;
}

function loadSupportObject(modulePath, supportObjectName) {
  if (modulePath.charAt(0) === '.') {
    modulePath = path.join(global.codecept_dir, modulePath);
  }
  try {
    const obj = require(modulePath);

    if (typeof obj === 'function') {
      const fobj = obj();

      if (fobj.constructor.name === 'Actor') {
        const methods = getObjectMethods(fobj);
        Object.keys(methods)
          .forEach(key => {
            fobj[key] = methods[key];
          });

        return methods;
      }
    }
    if (typeof obj !== 'function'
        && Object.getPrototypeOf(obj) !== Object.prototype
        && !Array.isArray(obj)
    ) {
      const methods = getObjectMethods(obj);
      Object.keys(methods)
        .filter(key => !key.startsWith('_'))
        .forEach(key => {
          const currentMethod = methods[key];
          if (isFunction(currentMethod) || isAsyncFunction(currentMethod)) {
            const ms = new MetaStep(supportObjectName, key);
            ms.setContext(methods);
            methods[key] = ms.run.bind(ms, currentMethod);
          }
        });
      return methods;
    }
    if (!Array.isArray(obj)) {
      Object.keys(obj)
        .filter(key => !key.startsWith('_'))
        .forEach(key => {
          const currentMethod = obj[key];
          if (isFunction(currentMethod) || isAsyncFunction(currentMethod)) {
            const ms = new MetaStep(supportObjectName, key);
            ms.setContext(obj);
            obj[key] = ms.run.bind(ms, currentMethod);
          }
        });
    }

    return obj;
  } catch (err) {
    throw new Error(`Could not include object ${supportObjectName} from module '${modulePath}'\n${err.message}\n${err.stack}`);
  }
}

/**
 * Method collect own property and prototype
 */
function getObjectMethods(obj) {
  const methodsSet = new Set();
  let protoObj = Reflect.getPrototypeOf(obj);
  do {
    if (protoObj.constructor.prototype !== Object.prototype) {
      const keys = Reflect.ownKeys(protoObj);
      keys.forEach(k => methodsSet.add(k));
    }
  } while (protoObj = Reflect.getPrototypeOf(protoObj));
  Reflect.ownKeys(obj).forEach(k => methodsSet.add(k));
  const methods = {};
  for (const key of methodsSet.keys()) {
    if (key !== 'constructor') methods[key] = obj[key];
  }
  return methods;
}

function loadTranslation(translation) {
  if (!translation) {
    return new Translation({
      I: 'I',
      actions: {},
    }, false);
  }

  let vocabulary;
  // check if it is a known translation
  if (require('../translations')[translation]) {
    vocabulary = require('../translations')[translation];
    return new Translation(vocabulary);
  } if (fileExists(path.join(global.codecept_dir, translation))) {
    // get from a provided file instead
    vocabulary = require(path.join(global.codecept_dir, translation));
  } else {
    throw new Error(`Translation option is set in config, but ${translation} is not a translated locale or filename`);
  }

  return new Translation(vocabulary);
}
