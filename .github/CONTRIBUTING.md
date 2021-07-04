# Contributing

Thanks for getting here. If you have a good will to improve CodeceptJS we are always glad to help. Ask questions, raise issues, ping in Twitter.

To start you need:

1.  Fork and clone the repo.
2.  Run `npm install` to install all required libraries
3.  Do the changes.
4.  Add/Update Test (if possible)
5.  Update documentation
6.  Commit and Push to your fork
7.  Make Pull Request

To run codeceptjs from this repo use:

```
node bin/codecept.js
```

To run examples:

```
node bin/codecept.js run -c examples
```


Depending on a type of a change you should do the following.

## Helpers

Please keep in mind that CodeceptJS have **unified API** for Playwright, WebDriverIO, Appium, Protractor, Nightmare, Puppeteer, TestCafe. Tests written using those helpers should be compatible at syntax level. However, some of helpers may contain unique methods. That happens. If, for instance, WebDriverIO has method XXX and Nightmare doesn't, you can implement XXX inside Nightmare using the same method signature.

### Updating a WebDriver | Nightmare

*Whenever a new method or new behavior is added it should be documented in a docblock. Valid JS-example is required! Do **not edit** `docs/helpers/`, those files are generated from docblocks in corresponding helpers! *

Working test is highly appreciated. To run the test suite you need:

* selenium server + chromedriver
* PHP installed

To launch PHP demo application run:

```sh
php -S 127.0.0.1:8000 -t test/data/app
```

Execute test suite:

```sh
mocha test/helper/WebDriver_test.js
mocha test/helper/Puppeteer_test.js
mocha test/helper/Nightmare_test.js
```

Use `--grep` to execute tests only for changed parts.

If you need to add new HTML page for a test, please create new `.php` file in to `tests/data/app/view/form`:

Adding `myexample` page:

```sh
tests/data/app/view/form/myexample.php
```

Then is should be accessible at:

```sh
http://localhost:8000/form/myexample
```

### Updating Protractor

*Whenever a new method or new behavior is added it should be documented in a docblock. Valid JS-example is required! Do **not edit** `docs/helpers/`, those files are generated from docblocks in corresponding helpers! *

Protractor helper is based on [Protractor library](http://www.protractortest.org)

In case you do Protractor-specific change, please add a test:To run the test suite you need:

* selenium server + chromedriver

Demo application is located at: [http://davertmik.github.io/angular-demo-app](http://davertmik.github.io/angular-demo-app)

### Updating REST | ApiDataFactory

*Whenever a new method or new behavior is added it should be documented in a docblock. Valid JS-example is required!*

Adding a test is highly appreciated.

Start JSON server to run tests:

```sh
npm run json-server
```

Edit a test at `test/rest/REST_test.js` or `test/rest/ApiDataFactory_test.js`

## Appium

*Whenever a new method or new behavior is added it should be documented in a docblock. Valid JS-example is required! Do **not edit** `docs/helpers/`, those files are generated from docblocks in corresponding helpers! *

It is recommended to run mobile tests on CI.
So do the changes, make pull request, see the CI status.
Appium tests are executed at **Semaphore CI**.

## Core Changes

Before applying any Core changes please raise an issue to discuss that change with core team.
Please try to add corresponding testcase to runner or unit.

## Documentation

Documentation is stored in `/docs` directory in markdown format.

**Documentation for helpers is a part of a source code**.

> **Whenever you need to update docs for a helper do it inside a .js file.**

After you updated docblock in JS file, generate markdown files with next command:

```
npm run docs
```

Documentation parts can be shared accross helpers. Those parts are located in `docs/webapi/*.mustache`. Inside a docblock those files can be included like this:

```js
  /**
   * {{> click }}
   */
  click() {
    // ...
  }
```

## Typings

Typings is generated in `typings/` directory via `jsdoc`

After you updated docblock in JS file, generate typing files with next command:

```
npm run def
```

## Testing

Whenever you implemented a feature/bugfix

Run unit tests:

```sh
mocha test/unit
```

Run general tests:

```sh
mocha test/runner
```

### Running tests in Dockerized environment

Instead of manually running php, json_server and selenium for before tests you
can use `docker-compose` to run those automatically.
You can find `docker-compose.yml` file in `test` directory and run all commands
from this directory. Currently we provide following commands to run tests with
respective dependencies:

#### Run unit tests

```sh
docker-compose run --rm test-unit
```

#### Run helper tests

```sh
docker-compose run --rm test-helpers

# or pass path to helper test to run specific helper,
# for example to run only WebDriver tests:
docker-compose run --rm test-helpers test/helper/WebDriver_test.js

# Or to run only rest and ApiDataFactory tests
docker-compose run --rm test-helpers test/rest
```

#### Run acceptance tests

To that we provide three separate services respectively for WebDriver, Nightmare, Puppeteer and
Protractor tests:

```sh
docker-compose run --rm test-acceptance.webdriverio
docker-compose run --rm test-acceptance.nightmare
docker-compose run --rm test-acceptance.puppeteer
docker-compose run --rm test-acceptance.protractor
```

#### Running against specific Node version

By default dockerized tests are run against node 12.10.0, you can run it against
specific version as long as there is Docker container available for such
version. To do that you need to build codecept's Docker image prior to running
tests and pass `NODE_VERSION` as build argument.

For example to prepare `test-helpers` containers based on node 9.4.0:

```sh
docker-compose build --build-arg NODE_VERSION=9.4.0 test-helpers
```

And now every command based on `test-helpers` service will use node 9.4.0. The
same argument can be passed when building unit and acceptance tests services.

### CI flow
We're currently using bunch of CI services to build and test codecept in
different environments. Here's short summary of what are differences between
separate services

#### TravisCI
Travis CI uses runs tests against Node 8 and Node 9. In total it uses 8 jobs to
build each helper against both Node versions. For every job it runs unit tests
first, then  `ApiDataFactory` and `REST` tests present in `test/rest` directory.
Finally if those pass we run specific helper tests found in `test/helper`
directory. It doesn't run acceptance tests.
Config is present in `.travis.yml` file.

#### CircleCI
Here we use CodeceptJS docker image to build and execute tests inside it. We
start with building Docker container based on Dockerfile present in main project
directory. Then we run (in this order) unit tests, all helpers present in
`test/helpers`, then we go with `test/rest` directory and finally if everything
passed so far it executes acceptance tests. For easier maintenance and local
debugging CircleCI uses `docker-compose.yml` file from `test` directory.
You can find Circle config in `.circleci` directory.

#### Semaphore
Currently Semaphore runs only Appium helper tests.
