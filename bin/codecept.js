#!/usr/bin/env node
const program = require('commander');
const Codecept = require('../lib/codecept');
const { print, error } = require('../lib/output');
const { printError } = require('../lib/command/utils');

const errorHandler = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (e) {
    printError(e);
    process.exitCode = 1;
  }
};

if (process.versions.node && process.versions.node.split('.') && process.versions.node.split('.')[0] < 8) {
  error('NodeJS >= 8 is required to run.');
  print();
  print('Please upgrade your NodeJS engine');
  print(`Current NodeJS version: ${process.version}`);
  process.exit(1);
}

program.usage('<command> [options]');
program.version(Codecept.version());

program.command('init [path]')
  .description('Creates dummy config in current dir or [path]')
  .action(errorHandler(require('../lib/command/init')));

program.command('migrate [path]')
  .description('Migrate json config to js config in current dir or [path]')
  .action(errorHandler(require('../lib/command/configMigrate')));

program.command('shell [path]')
  .alias('sh')
  .description('Interactive shell')
  .option('--verbose', 'output internal logging information')
  .option('--profile [value]', 'configuration profile to be used')
  .action(errorHandler(require('../lib/command/interactive')));

program.command('list [path]')
  .alias('l')
  .description('List all actions for I.')
  .action(errorHandler(require('../lib/command/list')));

program.command('def [path]')
  .description('Generates TypeScript definitions for all I actions.')
  .option('-c, --config [file]', 'configuration file to be used')
  .option('-o, --output [folder]', 'target folder to paste definitions')
  .action(errorHandler(require('../lib/command/definitions')));

program.command('gherkin:init [path]')
  .alias('bdd:init')
  .description('Prepare CodeceptJS to run feature files.')
  .option('-c, --config [file]', 'configuration file to be used')
  .action(errorHandler(require('../lib/command/gherkin/init')));

program.command('gherkin:steps [path]')
  .alias('bdd:steps')
  .description('Prints all defined gherkin steps.')
  .option('-c, --config [file]', 'configuration file to be used')
  .action(errorHandler(require('../lib/command/gherkin/steps')));

program.command('gherkin:snippets [path]')
  .alias('bdd:snippets')
  .description('Generate step definitions from steps.')
  .option('--dry-run', "don't save snippets to file")
  .option('-c, --config [file]', 'configuration file to be used')
  .option('--feature [file]', 'feature files(s) to scan')
  .option('--path [file]', 'file in which to place the new snippets')
  .action(errorHandler(require('../lib/command/gherkin/snippets')));

program.command('generate:test [path]')
  .alias('gt')
  .description('Generates an empty test')
  .action(errorHandler(require('../lib/command/generate').test));

program.command('generate:pageobject [path]')
  .alias('gpo')
  .description('Generates an empty page object')
  .action(errorHandler(require('../lib/command/generate').pageObject));

program.command('generate:object [path]')
  .alias('go')
  .option('--type, -t [kind]', 'type of object to be created')
  .description('Generates an empty support object (page/step/fragment)')
  .action(errorHandler(require('../lib/command/generate').pageObject));

program.command('generate:helper [path]')
  .alias('gh')
  .description('Generates a new helper')
  .action(errorHandler(require('../lib/command/generate').helper));

program.command('run [test]')
  .description('Executes tests')

  // codecept-only options
  .option('--steps', 'show step-by-step execution')
  .option('--debug', 'output additional information')
  .option('--verbose', 'output internal logging information')
  .option('-o, --override [value]', 'override current config options')
  .option('--profile [value]', 'configuration profile to be used')
  .option('-c, --config [file]', 'configuration file to be used')
  .option('--features', 'run only *.feature files and skip tests')
  .option('--tests', 'run only JS test files and skip features')
  .option('-p, --plugins <k=v,k2=v2,...>', 'enable plugins, comma-separated')

  // mocha options
  .option('--colors', 'force enabling of colors')
  .option('--no-colors', 'force disabling of colors')
  .option('-G, --growl', 'enable growl notification support')
  .option('-O, --reporter-options <k=v,k2=v2,...>', 'reporter-specific options')
  .option('-R, --reporter <name>', 'specify the reporter to use')
  .option('-S, --sort', 'sort test files')
  .option('-b, --bail', 'bail after first test failure')
  .option('-d, --debug', "enable node's debugger, synonym for node --debug")
  .option('-g, --grep <pattern>', 'only run tests matching <pattern>')
  .option('-f, --fgrep <string>', 'only run tests containing <string>')
  .option('-i, --invert', 'inverts --grep and --fgrep matches')
  .option('--full-trace', 'display the full stack trace')
  .option('--compilers <ext>:<module>,...', 'use the given module(s) to compile files')
  .option('--debug-brk', "enable node's debugger breaking on the first line")
  .option('--inline-diffs', 'display actual/expected differences inline within each string')
  .option('--no-exit', 'require a clean shutdown of the event loop: mocha will not call process.exit')
  .option('--recursive', 'include sub directories')
  .option('--trace', 'trace function calls')
  .option('--child <string>', 'option for child processes')
  .action(errorHandler(require('../lib/command/run')));

program.command('run-workers <workers>')
  .description('Executes tests in workers')
  .option('-c, --config [file]', 'configuration file to be used')
  .option('-g, --grep <pattern>', 'only run tests matching <pattern>')
  .option('-i, --invert', 'inverts --grep matches')
  .option('-o, --override [value]', 'override current config options')
  .option('--suites', 'parallel execution of suites not single tests')
  .option('--debug', 'output additional information')
  .option('--verbose', 'output internal logging information')
  .option('--features', 'run only *.feature files and skip tests')
  .option('--tests', 'run only JS test files and skip features')
  .option('--profile [value]', 'configuration profile to be used')
  .option('-p, --plugins <k=v,k2=v2,...>', 'enable plugins, comma-separated')
  .option('-O, --reporter-options <k=v,k2=v2,...>', 'reporter-specific options')
  .option('-R, --reporter <name>', 'specify the reporter to use')
  .action(errorHandler(require('../lib/command/run-workers')));

program.command('run-multiple [suites...]')
  .description('Executes tests multiple')
  .option('-c, --config [file]', 'configuration file to be used')
  .option('--profile [value]', 'configuration profile to be used')
  .option('--all', 'run all suites')
  .option('--features', 'run only *.feature files and skip tests')
  .option('--tests', 'run only JS test files and skip features')
  .option('-g, --grep <pattern>', 'only run tests matching <pattern>')
  .option('-f, --fgrep <string>', 'only run tests containing <string>')
  .option('-i, --invert', 'inverts --grep and --fgrep matches')
  .option('--steps', 'show step-by-step execution')
  .option('--verbose', 'output internal logging information')
  .option('--debug', 'output additional information')
  .option('-p, --plugins <k=v,k2=v2,...>', 'enable plugins, comma-separated')
  .option('-o, --override [value]', 'override current config options')
  .option('-O, --reporter-options <k=v,k2=v2,...>', 'reporter-specific options')
  .option('-R, --reporter <name>', 'specify the reporter to use')
  .option('--recursive', 'include sub directories')

  // mocha options
  .option('--colors', 'force enabling of colors')

  .action(errorHandler(require('../lib/command/run-multiple')));

program.command('info [path]')
  .description('Print debugging information concerning the local environment')
  .option('-c, --config', 'your config file path')
  .action(errorHandler(require('../lib/command/info')));

program.command('dry-run [test]')
  .description('Prints step-by-step scenario for a test without actually running it')
  .option('-p, --plugins <k=v,k2=v2,...>', 'enable plugins, comma-separated')
  .option('--bootstrap', 'enable bootstrap script for dry-run')
  .option('-c, --config [file]', 'configuration file to be used')
  .option('--all', 'run all suites')
  .option('--features', 'run only *.feature files and skip tests')
  .option('--tests', 'run only JS test files and skip features')
  .option('-g, --grep <pattern>', 'only run tests matching <pattern>')
  .option('-f, --fgrep <string>', 'only run tests containing <string>')
  .option('-i, --invert', 'inverts --grep and --fgrep matches')
  .option('--steps', 'show step-by-step execution')
  .option('--verbose', 'output internal logging information')
  .option('--debug', 'output additional information')
  .action(errorHandler(require('../lib/command/dryRun')));

program.on('command:*', (cmd) => {
  console.log(`\nUnknown command ${cmd}\n`);
  program.outputHelp();
});

if (process.argv.length <= 2) {
  program.outputHelp();
}
program.parse(process.argv);
