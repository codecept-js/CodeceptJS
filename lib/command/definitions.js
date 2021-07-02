const fs = require('fs');
const path = require('path');

const { getConfig, getTestRoot } = require('./utils');
const Codecept = require('../codecept');
const container = require('../container');
const output = require('../output');
const actingHelpers = [...require('../plugin/standardActingHelpers'), 'REST'];

/**
 * Prepare data and generate content of definitions file
 * @private
 *
 * @param {Object} params
 * @param {boolean} params.hasCustomStepsFile
 * @param {boolean} params.hasCustomHelper
 * @param {Map} params.supportObject
 * @param {Array<string>} params.helperNames
 * @param {Array<string>} params.importPaths
 * @param {Array<string>} params.customHelpers
 * @param params.translations
 *
 * @returns {string}
 */
const getDefinitionsFileContent = ({
  hasCustomHelper,
  hasCustomStepsFile,
  helperNames,
  supportObject,
  importPaths,
  translations,
  customHelpers,
}) => {
  const getHelperListFragment = ({
    hasCustomHelper,
    hasCustomStepsFile,
    customHelpers,
  }) => {
    if (hasCustomHelper && hasCustomStepsFile) {
      return `${['ReturnType<steps_file>', ...customHelpers].join(', ')}`;
    }

    if (hasCustomStepsFile) {
      return 'ReturnType<steps_file>';
    }

    return 'WithTranslation<Methods>';
  };

  const helpersListFragment = getHelperListFragment({
    hasCustomHelper,
    hasCustomStepsFile,
    customHelpers,
  });

  const importPathsFragment = importPaths.join('\n');
  const supportObjectsTypeFragment = convertMapToType(supportObject);
  const methodsTypeFragment = helperNames.length > 0
    ? `interface Methods extends ${helperNames.join(', ')} {}`
    : '';
  const translatedActionsFragment = JSON.stringify(translations.vocabulary.actions, null, 2);

  return generateDefinitionsContent({
    helpersListFragment,
    importPathsFragment,
    supportObjectsTypeFragment,
    methodsTypeFragment,
    translatedActionsFragment,
  });
};

/**
 * Generate content for definitions file from fragments
 * @private
 *
 * @param {Object} fragments - parts for template
 * @param {string} fragments.importPathsFragment
 * @param {string} fragments.supportObjectsTypeFragment
 * @param {string} fragments.methodsTypeFragment
 * @param {string} fragments.helpersListFragment
 * @param {string} fragments.translatedActionsFragment
 *
 * @returns {string}
 */
const generateDefinitionsContent = ({
  importPathsFragment,
  supportObjectsTypeFragment,
  methodsTypeFragment,
  helpersListFragment,
  translatedActionsFragment,
}) => {
  return `/// <reference types='codeceptjs' />
${importPathsFragment}

declare namespace CodeceptJS {
  interface SupportObject ${supportObjectsTypeFragment}
  ${methodsTypeFragment}
  interface I extends ${helpersListFragment} {}
  namespace Translation {
    interface Actions ${translatedActionsFragment}
  }
}
`;
};

/** @type {Array<string>} */
const helperNames = [];
/** @type {Array<string>} */
const customHelpers = [];

module.exports = function (genPath, options) {
  const configFile = options.config || genPath;
  /** @type {string} */
  const testsPath = getTestRoot(configFile);
  const config = getConfig(configFile);
  if (!config) return;

  /** @type {Object<string, string>} */
  const helperPaths = {};
  /** @type {Object<string, string>} */
  const supportPaths = {};
  /** @type {boolean} */
  let hasCustomStepsFile = false;
  /** @type {boolean} */
  let hasCustomHelper = false;

  /** @type {string} */
  const targetFolderPath = options.output && getTestRoot(options.output) || testsPath;

  const codecept = new Codecept(config, {});
  codecept.init(testsPath);

  const helpers = container.helpers();
  const translations = container.translation();
  for (const name in helpers) {
    const require = codecept.config.helpers[name].require;
    if (require) {
      helperPaths[name] = require;
      helperNames.push(name);
    } else {
      helperNames.push(name);
    }

    if (!actingHelpers.includes(name)) {
      customHelpers.push(`WithTranslation<${name}>`);
    }
  }

  const supportObject = new Map();
  supportObject.set('I', 'I');
  supportObject.set('current', 'any');

  if (customHelpers.length > 0) {
    hasCustomHelper = true;
  }

  for (const name in codecept.config.include) {
    const includePath = codecept.config.include[name];
    if (name === 'I' || name === translations.I) {
      hasCustomStepsFile = true;
      supportPaths.steps_file = includePath;
      continue;
    }
    supportPaths[name] = includePath;
    supportObject.set(name, name);
  }

  const definitionsFileContent = getDefinitionsFileContent({
    helperNames,
    supportObject,
    importPaths: getImportString(testsPath, targetFolderPath, supportPaths, helperPaths),
    translations,
    hasCustomStepsFile,
    hasCustomHelper,
    customHelpers,
  });

  fs.writeFileSync(path.join(targetFolderPath, 'steps.d.ts'), definitionsFileContent);
  output.print('TypeScript Definitions provide autocompletion in Visual Studio Code and other IDEs');
  output.print('Definitions were generated in steps.d.ts');
};

/**
 * Returns the relative path from the  to the targeted folder.
 * @param {string} originalPath
 * @param {string} targetFolderPath
 * @param {string} testsPath
 */
function getPath(originalPath, targetFolderPath, testsPath) {
  const parsedPath = path.parse(originalPath);

  // Remove typescript extension if exists.
  if (parsedPath.base.endsWith('.d.ts')) parsedPath.base = parsedPath.base.substring(0, parsedPath.base.length - 5);
  else if (parsedPath.ext === '.ts') parsedPath.base = parsedPath.name;

  if (!parsedPath.dir.startsWith('.')) return path.posix.join(parsedPath.dir, parsedPath.base);
  const relativePath = path.posix.relative(
    targetFolderPath.split(path.sep).join(path.posix.sep),
    path.posix.join(
      testsPath.split(path.sep).join(path.posix.sep),
      parsedPath.dir.split(path.sep).join(path.posix.sep),
      parsedPath.base.split(path.sep).join(path.posix.sep),
    ),
  );

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

/**
 *
 *
 * @param {string} testsPath
 * @param {string} targetFolderPath
 * @param {Object<string, string>} pathsToType
 * @param {Object<string, string>} pathsToValue
 *
 * @returns {Array<string>}
 */
function getImportString(testsPath, targetFolderPath, pathsToType, pathsToValue) {
  const importStrings = [];

  for (const name in pathsToType) {
    const relativePath = getPath(pathsToType[name], targetFolderPath, testsPath);
    importStrings.push(`type ${name} = typeof import('${relativePath}');`);
  }

  for (const name in pathsToValue) {
    const relativePath = getPath(pathsToValue[name], targetFolderPath, testsPath);
    importStrings.push(`type ${name} = import('${relativePath}');`);
  }

  return importStrings;
}

/**
 * @param {Map} map
 *
 * @returns {string}
 */
function convertMapToType(map) {
  return `{ ${Array.from(map).map(([key, value]) => `${key}: ${value}`).join(', ')} }`;
}
