let webdriverio;

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const Helper = require('../helper');
const stringIncludes = require('../assert/include').includes;
const { urlEquals, equals } = require('../assert/equal');
const { debug } = require('../output');
const empty = require('../assert/empty').empty;
const truth = require('../assert/truth').truth;
const {
  xpathLocator,
  blurActiveElement,
  fileExists,
  decodeUrl,
  chunkArray,
  convertCssPropertiesToCamelCase,
  screenshotOutputFolder,
  getNormalizedKeyAttributeValue,
  modifierKeys,
} = require('../utils');
const {
  isColorProperty,
  convertColorToRGBA,
} = require('../colorUtils');
const ElementNotFound = require('./errors/ElementNotFound');
const ConnectionRefused = require('./errors/ConnectionRefused');
const Locator = require('../locator');

const SHADOW = 'shadow';
const webRoot = 'body';

let version;
/**
 * WebDriver helper which wraps [webdriverio](http://webdriver.io/) library to
 * manipulate browser using Selenium WebDriver or PhantomJS.
 *
 * WebDriver requires Selenium Server and ChromeDriver/GeckoDriver to be installed. Those tools can be easily installed via NPM. Please check [Testing with WebDriver](https://codecept.io/webdriver/#testing-with-webdriver) for more details.
 *
 * ### Configuration
 *
 * This helper should be configured in codecept.json or codecept.conf.js
 *
 * * `url`: base url of website to be tested.
 * * `basicAuth`: (optional) the basic authentication to pass to base url. Example: {username: 'username', password: 'password'}
 * * `browser`: browser in which to perform testing.
 * * `host`: (optional, default: localhost) - WebDriver host to connect.
 * * `port`: (optional, default: 4444) - WebDriver port to connect.
 * * `protocol`: (optional, default: http) - protocol for WebDriver server.
 * * `path`: (optional, default: /wd/hub) - path to WebDriver server,
 * * `restart`: (optional, default: true) - restart browser between tests.
 * * `smartWait`: (optional) **enables [SmartWait](http://codecept.io/acceptance/#smartwait)**; wait for additional milliseconds for element to appear. Enable for 5 secs: "smartWait": 5000.
 * * `disableScreenshots`: (optional, default: false) - don't save screenshots on failure.
 * * `fullPageScreenshots` (optional, default: false) - make full page screenshots on failure.
 * * `uniqueScreenshotNames`: (optional, default: false) - option to prevent screenshot override if you have scenarios with the same name in different suites.
 * * `keepBrowserState`: (optional, default: false) - keep browser state between tests when `restart` is set to false.
 * * `keepCookies`: (optional, default: false) - keep cookies between tests when `restart` set to false.
 * * `windowSize`: (optional) default window size. Set to `maximize` or a dimension in the format `640x480`.
 * * `waitForTimeout`: (optional, default: 1000) sets default wait time in *ms* for all `wait*` functions.
 * * `desiredCapabilities`: Selenium's [desired
 * capabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities).
 * * `manualStart`: (optional, default: false) - do not start browser before a test, start it manually inside a helper
 * with `this.helpers["WebDriver"]._startBrowser()`.
 * * `timeouts`: [WebDriver timeouts](http://webdriver.io/docs/timeouts.html) defined as hash.
 *
 * Example:
 *
 * ```js
 * {
 *    helpers: {
 *      WebDriver : {
 *        smartWait: 5000,
 *        browser: "chrome",
 *        restart: false,
 *        windowSize: "maximize",
 *        timeouts: {
 *          "script": 60000,
 *          "page load": 10000
 *        }
 *      }
 *    }
 * }
 * ```
 *
 * Example with basic authentication
 * ```js
 * {
 *    helpers: {
 *      WebDriver : {
 *        smartWait: 5000,
 *        browser: "chrome",
 *        basicAuth: {username: 'username', password: 'password'},
 *        restart: false,
 *        windowSize: "maximize",
 *        timeouts: {
 *          "script": 60000,
 *          "page load": 10000
 *        }
 *      }
 *    }
 * }
 * ```
 *
 * Additional configuration params can be used from [webdriverio
 * website](http://webdriver.io/guide/getstarted/configuration.html).
 *
 * ### Headless Chrome
 *
 * ```js
 * {
 *    helpers: {
 *      WebDriver : {
 *        url: "http://localhost",
 *        browser: "chrome",
 *        desiredCapabilities: {
 *          chromeOptions: {
 *            args: [ "--headless", "--disable-gpu", "--no-sandbox" ]
 *          }
 *        }
 *      }
 *    }
 * }
 * ```
 *
 * ### Internet Explorer
 *
 * Additional configuration params can be used from [IE options](https://seleniumhq.github.io/selenium/docs/api/rb/Selenium/WebDriver/IE/Options.html)
 *
 * ```js
 * {
 *    helpers: {
 *      WebDriver : {
 *        url: "http://localhost",
 *        browser: "internet explorer",
 *        desiredCapabilities: {
 *          ieOptions: {
 *            "ie.browserCommandLineSwitches": "-private",
 *            "ie.usePerProcessProxy": true,
 *            "ie.ensureCleanSession": true,
 *          }
 *        }
 *      }
 *    }
 * }
 * ```
 *
 * ### Selenoid Options
 *
 * [Selenoid](https://aerokube.com/selenoid/latest/) is a modern way to run Selenium inside Docker containers.
 * Selenoid is easy to set up and provides more features than original Selenium Server. Use `selenoidOptions` to set Selenoid capabilities
 *
 * ```js
 * {
 *    helpers: {
 *      WebDriver : {
 *        url: "http://localhost",
 *        browser: "chrome",
 *        desiredCapabilities: {
 *          selenoidOptions: {
 *            enableVNC: true,
 *          }
 *        }
 *      }
 *    }
 * }
 * ```
 *
 * ### Connect Through proxy
 *
 * CodeceptJS also provides flexible options when you want to execute tests to Selenium servers through proxy. You will
 * need to update the `helpers.WebDriver.capabilities.proxy` key.
 *
 * ```js
 * {
 *     helpers: {
 *         WebDriver: {
 *             capabilities: {
 *                 proxy: {
 *                     "proxyType": "manual|pac",
 *                     "proxyAutoconfigUrl": "URL TO PAC FILE",
 *                     "httpProxy": "PROXY SERVER",
 *                     "sslProxy": "PROXY SERVER",
 *                     "ftpProxy": "PROXY SERVER",
 *                     "socksProxy": "PROXY SERVER",
 *                     "socksUsername": "USERNAME",
 *                     "socksPassword": "PASSWORD",
 *                     "noProxy": "BYPASS ADDRESSES"
 *                 }
 *             }
 *         }
 *     }
 * }
 * ```
 * For example,
 *
 * ```js
 * {
 *     helpers: {
 *         WebDriver: {
 *             capabilities: {
 *                 proxy: {
 *                     "proxyType": "manual",
 *                     "httpProxy": "http://corporate.proxy:8080",
 *                     "socksUsername": "codeceptjs",
 *                     "socksPassword": "secret",
 *                     "noProxy": "127.0.0.1,localhost"
 *                 }
 *             }
 *         }
 *     }
 * }
 * ```
 *
 * Please refer to [Selenium - Proxy Object](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities) for more
 * information.
 *
 * ### Cloud Providers
 *
 * WebDriver makes it possible to execute tests against services like `Sauce Labs` `BrowserStack` `TestingBot`
 * Check out their documentation on [available parameters](http://webdriver.io/guide/usage/cloudservices.html)
 *
 * Connecting to `BrowserStack` and `Sauce Labs` is simple. All you need to do
 * is set the `user` and `key` parameters. WebDriver automatically know which
 * service provider to connect to.
 *
 * ```js
 * {
 *     helpers:{
 *         WebDriver: {
 *             url: "YOUR_DESIRED_HOST",
 *             user: "YOUR_BROWSERSTACK_USER",
 *             key: "YOUR_BROWSERSTACK_KEY",
 *             capabilities: {
 *                 "browserName": "chrome",
 *
 *                 // only set this if you're using BrowserStackLocal to test a local domain
 *                 // "browserstack.local": true,
 *
 *                 // set this option to tell browserstack to provide addition debugging info
 *                 // "browserstack.debug": true,
 *             }
 *         }
 *     }
 * }
 * ```
 *
 * #### SauceLabs
 *
 * SauceLabs can be configured via wdio service, which should be installed additionally:
 *
 * ```
 * npm i @wdio/sauce-service --save
 * ```
 *
 * It is important to make sure it is compatible with current webdriverio version.
 *
 * Enable `wdio` plugin in plugins list and add `sauce` service:
 *
 * ```js
 * plugins: {
 *    wdio: {
  *       enabled: true,
 *        services: ['sauce'],
 *        user: ... ,// saucelabs username
 *        key: ... // saucelabs api key
 *        // additional config, from sauce service
 *    }
 * }
 * ```
 *
 * See [complete reference on webdriver.io](https://webdriver.io/docs/sauce-service.html).
 *
 * > Alternatively, use [codeceptjs-saucehelper](https://github.com/puneet0191/codeceptjs-saucehelper/) for better reporting.
 *
 * #### BrowserStack
 *
 * BrowserStack can be configured via wdio service, which should be installed additionally:
 *
 * ```
 * npm i @wdio/browserstack-service --save
 * ```
 *
 * It is important to make sure it is compatible with current webdriverio version.
 *
 * Enable `wdio` plugin in plugins list and add `browserstack` service:
 *
 * ```js
 * plugins: {
 *    wdio: {
  *       enabled: true,
 *        services: ['browserstack'],
 *        user: ... ,// browserstack username
 *        key: ... // browserstack api key
 *        // additional config, from browserstack service
 *    }
 * }
 * ```
 *
 * See [complete reference on webdriver.io](https://webdriver.io/docs/browserstack-service.html).
 *
 * > Alternatively, use [codeceptjs-bshelper](https://github.com/PeterNgTr/codeceptjs-bshelper) for better reporting.
 *
 * #### TestingBot
 *
 * > **Recommended**: use official [TestingBot Helper](https://github.com/testingbot/codeceptjs-tbhelper).
 *
 * Alternatively, TestingBot can be configured via wdio service, which should be installed additionally:
 *
 * ```
 * npm i @wdio/testingbot-service --save
 * ```
 *
 * It is important to make sure it is compatible with current webdriverio version.
 *
 * Enable `wdio` plugin in plugins list and add `testingbot` service:
 *
 * ```js
 * plugins: {
 *   wdio: {
 *       enabled: true,
 *       services: ['testingbot'],
 *       user: ... ,// testingbot key
 *       key: ... // testingbot secret
 *       // additional config, from testingbot service
 *   }
 * }
 * ```
 *
 * See [complete reference on webdriver.io](https://webdriver.io/docs/testingbot-service.html).
 *
 * #### Applitools
 *
 * Visual testing via Applitools service
 *
 * > Use [CodeceptJS Applitools Helper](https://github.com/PeterNgTr/codeceptjs-applitoolshelper) with Applitools wdio service.
 *
 *
 * ### Multiremote Capabilities
 *
 * This is a work in progress but you can control two browsers at a time right out of the box.
 * Individual control is something that is planned for a later version.
 *
 * Here is the [webdriverio docs](http://webdriver.io/guide/usage/multiremote.html) on the subject
 *
 * ```js
 * {
 *     helpers: {
 *         WebDriver: {
 *             "multiremote": {
 *                 "MyChrome": {
 *                     "desiredCapabilities": {
 *                         "browserName": "chrome"
 *                      }
 *                 },
 *                 "MyFirefox": {
 *                    "desiredCapabilities": {
 *                        "browserName": "firefox"
 *                    }
 *                 }
 *             }
 *         }
 *     }
 * }
 * ```
 *
 * ## Access From Helpers
 *
 * Receive a WebDriver client from a custom helper by accessing `browser` property:
 *
 * ```js
 * const { WebDriver } = this.helpers;
 * const browser = WebDriver.browser
 * ```
 *
 * ## Methods
 */
class WebDriver extends Helper {
  constructor(config) {
    super(config);
    webdriverio = require('webdriverio');

    try {
      version = JSON.parse(fs.readFileSync(path.join(require.resolve('webdriverio'), '/../../', 'package.json')).toString()).version;
    } catch (err) {
      this.debug('Can\'t detect webdriverio version, assuming webdriverio v6 is used');
    }

    if (isWebDriver5()) {
      console.log('DEPRECATION NOTICE:');
      console.log('You are using webdriverio v5. It is recommended to update to webdriverio@6.\nSupport of webdriverio v5 is deprecated and will be removed in CodeceptJS 3.0\n');
    }
    // set defaults
    this.root = webRoot;
    this.isWeb = true;
    this.isRunning = false;
    this.sessionWindows = {};
    this.activeSessionName = '';
    this.customLocatorStrategies = config.customLocatorStrategies;

    this._setConfig(config);

    Locator.addFilter((locator, result) => {
      if (typeof locator === 'string' && locator.indexOf('~') === 0) {
        // accessibility locator
        if (this.isWeb) {
          result.value = `[aria-label="${locator.slice(1)}"]`;
          result.type = 'css';
          result.output = `aria-label=${locator.slice(1)}`;
        }
      }
    });
  }

  _validateConfig(config) {
    const defaults = {
      logLevel: 'silent',
      path: '/wd/hub',
      // codeceptjs
      remoteFileUpload: true,
      smartWait: 0,
      waitForTimeout: 1000, // ms
      capabilities: {},
      restart: true,
      uniqueScreenshotNames: false,
      disableScreenshots: false,
      fullPageScreenshots: false,
      manualStart: false,
      keepCookies: false,
      keepBrowserState: false,
      deprecationWarnings: false,
    };

    // override defaults with config
    config = Object.assign(defaults, config);

    if (typeof config.host !== 'undefined') config.hostname = config.host; // webdriverio spec
    config.baseUrl = config.url || config.baseUrl;
    if (config.desiredCapabilities && Object.keys(config.desiredCapabilities).length) {
      config.capabilities = config.desiredCapabilities;
    }
    config.capabilities.browserName = config.browser || config.capabilities.browserName;
    if (config.capabilities.chromeOptions) {
      config.capabilities['goog:chromeOptions'] = config.capabilities.chromeOptions;
      delete config.capabilities.chromeOptions;
    }
    if (config.capabilities.firefoxOptions) {
      config.capabilities['moz:firefoxOptions'] = config.capabilities.firefoxOptions;
      delete config.capabilities.firefoxOptions;
    }
    if (config.capabilities.ieOptions) {
      config.capabilities['se:ieOptions'] = config.capabilities.ieOptions;
      delete config.capabilities.ieOptions;
    }
    if (config.capabilities.selenoidOptions) {
      config.capabilities['selenoid:options'] = config.capabilities.selenoidOptions;
      delete config.capabilities.selenoidOptions;
    }

    config.waitForTimeout /= 1000; // convert to seconds

    if (!config.capabilities.platformName && (!config.url || !config.browser)) {
      throw new Error(`
        WebDriver requires at url and browser to be set.
        Check your codeceptjs config file to ensure these are set properly
          {
            "helpers": {
              "WebDriver": {
                "url": "YOUR_HOST"
                "browser": "YOUR_PREFERRED_TESTING_BROWSER"
              }
            }
          }
      `);
    }

    return config;
  }

  static _checkRequirements() {
    try {
      require('webdriverio');
    } catch (e) {
      return ['webdriverio@^5.2.2'];
    }
  }

  static _config() {
    return [{
      name: 'url',
      message: 'Base url of site to be tested',
      default: 'http://localhost',
    }, {
      name: 'browser',
      message: 'Browser in which testing will be performed',
      default: 'chrome',
    }];
  }

  _beforeSuite() {
    if (!this.options.restart && !this.options.manualStart && !this.isRunning) {
      this.debugSection('Session', 'Starting singleton browser session');
      return this._startBrowser();
    }
  }

  _lookupCustomLocator(customStrategy) {
    if (typeof (this.customLocatorStrategies) !== 'object') {
      return null;
    }
    const strategy = this.customLocatorStrategies[customStrategy];
    return typeof (strategy) === 'function' ? strategy : null;
  }

  _isCustomLocator(locator) {
    const locatorObj = new Locator(locator);
    if (locatorObj.isCustom()) {
      const customLocator = this._lookupCustomLocator(locatorObj.type);
      if (customLocator) {
        return true;
      }
      throw new Error('Please define "customLocatorStrategies" as an Object and the Locator Strategy as a "function".');
    }
    return false;
  }

  async _res(locator) {
    const res = (this._isShadowLocator(locator) || this._isCustomLocator(locator))
      ? await this._locate(locator)
      : await this.$$(withStrictLocator(locator));
    return res;
  }

  async _startBrowser() {
    try {
      if (this.options.multiremote) {
        this.browser = await webdriverio.multiremote(this.options.multiremote);
      } else {
        // remove non w3c capabilities
        delete this.options.capabilities.protocol;
        delete this.options.capabilities.hostname;
        delete this.options.capabilities.port;
        delete this.options.capabilities.path;
        this.browser = await webdriverio.remote(this.options);
      }
    } catch (err) {
      if (err.toString().indexOf('ECONNREFUSED')) {
        throw new ConnectionRefused(err);
      }
      throw err;
    }

    this.isRunning = true;
    if (this.options.timeouts && this.isWeb) {
      await this.defineTimeout(this.options.timeouts);
    }

    await this._resizeWindowIfNeeded(this.browser, this.options.windowSize);

    this.$$ = this.browser.$$.bind(this.browser);

    if (this._isCustomLocatorStrategyDefined()) {
      Object.keys(this.customLocatorStrategies).forEach(async (customLocator) => {
        this.debugSection('Weddriver', `adding custom locator strategy: ${customLocator}`);
        const locatorFunction = this._lookupCustomLocator(customLocator);
        this.browser.addLocatorStrategy(customLocator, locatorFunction);
      });
    }

    return this.browser;
  }

  _isCustomLocatorStrategyDefined() {
    return this.customLocatorStrategies && Object.keys(this.customLocatorStrategies).length;
  }

  async _stopBrowser() {
    if (this.browser && this.isRunning) await this.browser.deleteSession();
  }

  async _before() {
    this.context = this.root;
    if (this.options.restart && !this.options.manualStart) return this._startBrowser();
    if (!this.isRunning && !this.options.manualStart) return this._startBrowser();
    this.$$ = this.browser.$$.bind(this.browser);
    return this.browser;
  }

  async _after() {
    if (!this.isRunning) return;
    if (this.options.restart) {
      this.isRunning = false;
      return this.browser.deleteSession();
    }
    if (this.browser.isInsideFrame) await this.browser.switchToFrame(null);

    if (this.options.keepBrowserState) return;

    if (!this.options.keepCookies && this.options.capabilities.browserName) {
      this.debugSection('Session', 'cleaning cookies and localStorage');
      await this.browser.deleteCookies();
    }
    await this.browser.execute('localStorage.clear();').catch((err) => {
      if (!(err.message.indexOf("Storage is disabled inside 'data:' URLs.") > -1)) throw err;
    });
    await this.closeOtherTabs();
    return this.browser;
  }

  _afterSuite() {
  }

  _finishTest() {
    if (!this.options.restart && this.isRunning) return this._stopBrowser();
  }

  _session() {
    const defaultSession = this.browser;
    return {
      start: async (sessionName, opts) => {
        // opts.disableScreenshots = true; // screenshots cant be saved as session will be already closed
        opts = this._validateConfig(Object.assign(this.options, opts));
        this.debugSection('New Browser', JSON.stringify(opts));
        const browser = await webdriverio.remote(opts);
        this.activeSessionName = sessionName;
        if (opts.timeouts && this.isWeb) {
          await this._defineBrowserTimeout(browser, opts.timeouts);
        }

        await this._resizeWindowIfNeeded(browser, opts.windowSize);

        return browser;
      },
      stop: async (browser) => {
        if (!browser) return;
        return browser.deleteSession();
      },
      loadVars: async (browser) => {
        if (this.context !== this.root) throw new Error('Can\'t start session inside within block');
        this.browser = browser;
        this.$$ = this.browser.$$.bind(this.browser);
        this.sessionWindows[this.activeSessionName] = browser;
      },
      restoreVars: async (session) => {
        if (!session) {
          this.activeSessionName = '';
        }
        this.browser = defaultSession;
        this.$$ = this.browser.$$.bind(this.browser);
      },
    };
  }

  /**
  * Use [webdriverio](https://webdriver.io/docs/api.html) API inside a test.
  *
  * First argument is a description of an action.
  * Second argument is async function that gets this helper as parameter.
  *
  * { [`browser`](https://webdriver.io/docs/api.html)) } object from WebDriver API is available.
  *
  * ```js
  * I.useWebDriverTo('open multiple windows', async ({ browser }) {
  *    // create new window
  *    await browser.newWindow('https://webdriver.io');
  * });
  * ```
  *
  * @param {string} description used to show in logs.
  * @param {function} fn async functuion that executed with WebDriver helper as argument
  */
  useWebDriverTo(description, fn) {
    return this._useTo(...arguments);
  }

  async _failed() {
    if (this.context !== this.root) await this._withinEnd();
  }

  async _withinBegin(locator) {
    const frame = isFrameLocator(locator);
    if (frame) {
      this.browser.isInsideFrame = true;
      if (Array.isArray(frame)) {
        // this.switchTo(null);
        await forEachAsync(frame, async f => this.switchTo(f));
        return;
      }
      await this.switchTo(frame);
      return;
    }
    this.context = locator;

    let res = await this.browser.$$(withStrictLocator(locator));
    assertElementExists(res, locator);
    res = usingFirstElement(res);
    this.context = res.selector;
    this.$$ = res.$$.bind(res);
  }

  async _withinEnd() {
    if (this.browser.isInsideFrame) {
      this.browser.isInsideFrame = false;
      return this.switchTo(null);
    }
    this.context = this.root;
    this.$$ = this.browser.$$.bind(this.browser);
  }

  /**
   * Check if locator is type of "Shadow"
   *
   * @param {object} locator
   */
  _isShadowLocator(locator) {
    return locator.type === SHADOW || locator[SHADOW];
  }

  /**
   * Locate Element within the Shadow Dom
   *
   * @param {object} locator
   */
  async _locateShadow(locator) {
    const shadow = locator.value ? locator.value : locator[SHADOW];
    const shadowSequence = [];
    let elements;

    if (!Array.isArray(shadow)) {
      throw new Error(`Shadow '${shadow}' should be defined as an Array of elements.`);
    }

    // traverse through the Shadow locators in sequence
    for (let index = 0; index < shadow.length; index++) {
      const shadowElement = shadow[index];
      shadowSequence.push(shadowElement);

      if (!elements) {
        elements = await (this.browser.$$(shadowElement));
      } else if (Array.isArray(elements)) {
        elements = await elements[0].shadow$$(shadowElement);
      } else if (elements) {
        elements = await elements.shadow$$(shadowElement);
      }

      if (!elements || !elements[0]) {
        throw new Error(`Shadow Element '${shadowElement}' is not found. It is possible the element is incorrect or elements sequence is incorrect. Please verify the sequence '${shadowSequence.join('>')}' is correctly chained.`);
      }
    }

    this.debugSection('Elements', `Found ${elements.length} '${SHADOW}' elements`);

    return elements;
  }

  /**
   * Smart Wait to locate an element
   *
   * @param {object} locator
   */
  async _smartWait(locator) {
    this.debugSection(`SmartWait (${this.options.smartWait}ms)`, `Locating ${JSON.stringify(locator)} in ${this.options.smartWait}`);
    await this.defineTimeout({ implicit: this.options.smartWait });
  }

  /**
   * Get elements by different locator types, including strict locator.
   * Should be used in custom helpers:
   *
   * ```js
   * this.helpers['WebDriver']._locate({name: 'password'}).then //...
   * ```
   *
   *
   * @param {CodeceptJS.LocatorOrString} locator element located by CSS|XPath|strict locator.
   */
  async _locate(locator, smartWait = false) {
    if (require('../store').debugMode) smartWait = false;

    // special locator type for Shadow DOM
    if (this._isShadowLocator(locator)) {
      if (!this.options.smartWait || !smartWait) {
        const els = await this._locateShadow(locator);
        return els;
      }

      const els = await this._locateShadow(locator);
      return els;
    }

    // special locator type for React
    if (locator.react) {
      const els = await this.browser.react$$(locator.react, locator.props || undefined, locator.state || undefined);
      this.debugSection('Elements', `Found ${els.length} react components`);
      return els;
    }

    if (!this.options.smartWait || !smartWait) {
      if (this._isCustomLocator(locator)) {
        const locatorObj = new Locator(locator);
        return this.browser.custom$$(locatorObj.type, locatorObj.value);
      }

      const els = await this.$$(withStrictLocator(locator));
      return els;
    }

    await this._smartWait(locator);

    if (this._isCustomLocator(locator)) {
      const locatorObj = new Locator(locator);
      return this.browser.custom$$(locatorObj.type, locatorObj.value);
    }

    const els = await this.$$(withStrictLocator(locator));
    await this.defineTimeout({ implicit: 0 });
    return els;
  }

  _grabCustomLocator(locator) {
    if (typeof locator === 'string') {
      locator = new Locator(locator);
    }
    return locator.value ? locator.value : locator.custom;
  }

  /**
   * Find a checkbox by providing human readable text:
   *
   * ```js
   * this.helpers['WebDriver']._locateCheckable('I agree with terms and conditions').then // ...
   * ```
   *
   * @param {CodeceptJS.LocatorOrString} locator element located by CSS|XPath|strict locator.
   */
  async _locateCheckable(locator) {
    return findCheckable.call(this, locator, this.$$.bind(this)).then(res => res);
  }

  /**
   * Find a clickable element by providing human readable text:
   *
   * ```js
   * const els = await this.helpers.WebDriver._locateClickable('Next page');
   * const els = await this.helpers.WebDriver._locateClickable('Next page', '.pages');
   * ```
   *
   * @param {CodeceptJS.LocatorOrString} locator element located by CSS|XPath|strict locator.
   */
  async _locateClickable(locator, context) {
    const locateFn = prepareLocateFn.call(this, context);
    return findClickable.call(this, locator, locateFn);
  }

  /**
   * Find field elements by providing human readable text:
   *
   * ```js
   * this.helpers['WebDriver']._locateFields('Your email').then // ...
   * ```
   *
   * @param {CodeceptJS.LocatorOrString} locator element located by CSS|XPath|strict locator.
   */
  async _locateFields(locator) {
    return findFields.call(this, locator).then(res => res);
  }

  /**
   * Set [WebDriver timeouts](https://webdriver.io/docs/timeouts.html) in realtime.
   *
   * Timeouts are expected to be passed as object:
   *
   * ```js
   * I.defineTimeout({ script: 5000 });
   * I.defineTimeout({ implicit: 10000, pageLoad: 10000, script: 5000 });
   * ```
   *
   * @param {WebdriverIO.Timeouts} timeouts WebDriver timeouts object.
   */
  defineTimeout(timeouts) {
    return this._defineBrowserTimeout(this.browser, timeouts);
  }

  _defineBrowserTimeout(browser, timeouts) {
    return browser.setTimeout(timeouts);
  }

  /**
   * {{> amOnPage }}
   *
   */
  amOnPage(url) {
    let split_url;
    if (this.config.basicAuth) {
      if (url.startsWith('/')) {
        url = this.config.url + url;
      }
      split_url = url.split('//');
      url = `${split_url[0]}//${this.config.basicAuth.username}:${this.config.basicAuth.password}@${split_url[1]}`;
    }
    return this.browser.url(url);
  }

  /**
   * {{> click }}
   *
   * {{ react }}
   */
  async click(locator, context = null) {
    const clickMethod = this.browser.isMobile ? 'touchClick' : 'elementClick';
    const locateFn = prepareLocateFn.call(this, context);

    const res = await findClickable.call(this, locator, locateFn);
    if (context) {
      assertElementExists(res, locator, 'Clickable element', `was not found inside element ${new Locator(context)}`);
    } else {
      assertElementExists(res, locator, 'Clickable element');
    }
    const elem = usingFirstElement(res);
    return this.browser[clickMethod](getElementId(elem));
  }

  /**
   * {{> forceClick }}
   *
   * {{ react }}
   */
  async forceClick(locator, context = null) {
    const locateFn = prepareLocateFn.call(this, context);

    const res = await findClickable.call(this, locator, locateFn);
    if (context) {
      assertElementExists(res, locator, 'Clickable element', `was not found inside element ${new Locator(context)}`);
    } else {
      assertElementExists(res, locator, 'Clickable element');
    }
    const elem = usingFirstElement(res);

    return this.executeScript((el) => {
      blurActiveElement();
      const event = document.createEvent('MouseEvent');
      event.initEvent('click', true, true);
      return el.dispatchEvent(event);
    }, elem);
  }

  /**
   * {{> doubleClick }}
   *
   * {{ react }}
   */
  async doubleClick(locator, context = null) {
    const locateFn = prepareLocateFn.call(this, context);

    const res = await findClickable.call(this, locator, locateFn);
    if (context) {
      assertElementExists(res, locator, 'Clickable element', `was not found inside element ${new Locator(context)}`);
    } else {
      assertElementExists(res, locator, 'Clickable element');
    }

    const elem = usingFirstElement(res);
    return elem.doubleClick();
  }

  /**
   * {{> rightClick }}
   *
   * {{ react }}
   */
  async rightClick(locator, context) {
    const locateFn = prepareLocateFn.call(this, context);

    const res = await findClickable.call(this, locator, locateFn);
    if (context) {
      assertElementExists(res, locator, 'Clickable element', `was not found inside element ${new Locator(context)}`);
    } else {
      assertElementExists(res, locator, 'Clickable element');
    }

    const el = usingFirstElement(res);

    await el.moveTo();

    if (this.browser.isW3C) {
      return el.click({ button: 'right' });
    }
    // JSON Wire version
    await this.browser.buttonDown(2);
  }

  /**
   * {{> forceRightClick }}
   *
   * {{ react }}
   */
  async forceRightClick(locator, context = null) {
    const locateFn = prepareLocateFn.call(this, context);

    const res = await findClickable.call(this, locator, locateFn);
    if (context) {
      assertElementExists(res, locator, 'Clickable element', `was not found inside element ${new Locator(context)}`);
    } else {
      assertElementExists(res, locator, 'Clickable element');
    }
    const elem = usingFirstElement(res);

    return this.executeScript((el) => {
      blurActiveElement();
      const event = document.createEvent('MouseEvent');
      event.initEvent('contextmenu', true, true);
      return el.dispatchEvent(event);
    }, elem);
  }

  /**
   * {{> fillField }}
   * {{ react }}
   * {{ custom }}
   *
   */
  async fillField(field, value) {
    const res = await findFields.call(this, field);
    assertElementExists(res, field, 'Field');
    const elem = usingFirstElement(res);
    return elem.setValue(value.toString());
  }

  /**
   * {{> appendField }}
   * {{ react }}
   */
  async appendField(field, value) {
    const res = await findFields.call(this, field);
    assertElementExists(res, field, 'Field');
    const elem = usingFirstElement(res);
    return elem.addValue(value);
  }

  /**
   * {{> clearField }}
   *
   */
  async clearField(field) {
    const res = await findFields.call(this, field);
    assertElementExists(res, field, 'Field');
    const elem = usingFirstElement(res);
    return elem.clearValue(getElementId(elem));
  }

  /**
   * {{> selectOption }}
   */
  async selectOption(select, option) {
    const res = await findFields.call(this, select);
    assertElementExists(res, select, 'Selectable field');
    const elem = usingFirstElement(res);

    if (!Array.isArray(option)) {
      option = [option];
    }

    // select options by visible text
    let els = await forEachAsync(option, async opt => this.browser.findElementsFromElement(getElementId(elem), 'xpath', Locator.select.byVisibleText(xpathLocator.literal(opt))));

    const clickOptionFn = async (el) => {
      if (el[0]) el = el[0];
      const elementId = getElementId(el);
      if (elementId) return this.browser.elementClick(elementId);
    };

    if (Array.isArray(els) && els.length) {
      return forEachAsync(els, clickOptionFn);
    }
    // select options by value
    els = await forEachAsync(option, async opt => this.browser.findElementsFromElement(getElementId(elem), 'xpath', Locator.select.byValue(xpathLocator.literal(opt))));
    if (els.length === 0) {
      throw new ElementNotFound(select, `Option "${option}" in`, 'was not found neither by a visible text nor by a value');
    }
    return forEachAsync(els, clickOptionFn);
  }

  /**
   * {{> attachFile }}
   * Appium: not tested
   */
  async attachFile(locator, pathToFile) {
    let file = path.join(global.codecept_dir, pathToFile);
    if (!fileExists(file)) {
      throw new Error(`File at ${file} can not be found on local system`);
    }

    const res = await findFields.call(this, locator);
    this.debug(`Uploading ${file}`);
    assertElementExists(res, locator, 'File field');
    const el = usingFirstElement(res);

    // Remote Upload (when running Selenium Server)
    if (this.options.remoteFileUpload) {
      try {
        this.debugSection('File', 'Uploading file to remote server');
        file = await this.browser.uploadFile(file);
      } catch (err) {
        throw new Error(`File can't be transferred to remote server. Set \`remoteFileUpload: false\` in config to upload file locally.\n${err.message}`);
      }
    }

    return el.addValue(file);
  }

  /**
   * {{> checkOption }}
   * Appium: not tested
   */
  async checkOption(field, context = null) {
    const clickMethod = this.browser.isMobile ? 'touchClick' : 'elementClick';
    const locateFn = prepareLocateFn.call(this, context);

    const res = await findCheckable.call(this, field, locateFn);

    assertElementExists(res, field, 'Checkable');
    const elem = usingFirstElement(res);
    const elementId = getElementId(elem);

    const isSelected = await this.browser.isElementSelected(elementId);
    if (isSelected) return Promise.resolve(true);
    return this.browser[clickMethod](elementId);
  }

  /**
   * {{> uncheckOption }}
   * Appium: not tested
   */
  async uncheckOption(field, context = null) {
    const clickMethod = this.browser.isMobile ? 'touchClick' : 'elementClick';
    const locateFn = prepareLocateFn.call(this, context);

    const res = await findCheckable.call(this, field, locateFn);

    assertElementExists(res, field, 'Checkable');
    const elem = usingFirstElement(res);
    const elementId = getElementId(elem);

    const isSelected = await this.browser.isElementSelected(elementId);
    if (!isSelected) return Promise.resolve(true);
    return this.browser[clickMethod](elementId);
  }

  /**
   * {{> grabTextFromAll }}
   *
   */
  async grabTextFromAll(locator) {
    const res = await this._locate(locator, true);
    const val = await forEachAsync(res, el => this.browser.getElementText(getElementId(el)));
    this.debugSection('GrabText', String(val));
    return val;
  }

  /**
   * {{> grabTextFrom }}
   *
   */
  async grabTextFrom(locator) {
    const texts = await this.grabTextFromAll(locator);
    assertElementExists(texts, locator);
    if (texts.length > 1) {
      this.debugSection('GrabText', `Using first element out of ${texts.length}`);
    }

    return texts[0];
  }

  /**
   * {{> grabHTMLFromAll }}
   *
   */
  async grabHTMLFromAll(locator) {
    const elems = await this._locate(locator, true);
    const html = await forEachAsync(elems, elem => elem.getHTML(false));
    this.debugSection('GrabHTML', String(html));
    return html;
  }

  /**
   * {{> grabHTMLFrom }}
   *
   */
  async grabHTMLFrom(locator) {
    const html = await this.grabHTMLFromAll(locator);
    assertElementExists(html);
    if (html.length > 1) {
      this.debugSection('GrabHTML', `Using first element out of ${html.length}`);
    }

    return html[0];
  }

  /**
   * {{> grabValueFromAll }}
   *
   */
  async grabValueFromAll(locator) {
    const res = await this._locate(locator, true);
    const val = await forEachAsync(res, el => el.getValue());
    this.debugSection('GrabValue', String(val));

    return val;
  }

  /**
   * {{> grabValueFrom }}
   *
   */
  async grabValueFrom(locator) {
    const values = await this.grabValueFromAll(locator);
    assertElementExists(values, locator);
    if (values.length > 1) {
      this.debugSection('GrabValue', `Using first element out of ${values.length}`);
    }

    return values[0];
  }

  /**
   * {{> grabCssPropertyFromAll }}
   */
  async grabCssPropertyFromAll(locator, cssProperty) {
    const res = await this._locate(locator, true);
    const val = await forEachAsync(res, async el => this.browser.getElementCSSValue(getElementId(el), cssProperty));
    this.debugSection('Grab', String(val));
    return val;
  }

  /**
   * {{> grabCssPropertyFrom }}
   */
  async grabCssPropertyFrom(locator, cssProperty) {
    const cssValues = await this.grabCssPropertyFromAll(locator, cssProperty);
    assertElementExists(cssValues, locator);

    if (cssValues.length > 1) {
      this.debugSection('GrabCSS', `Using first element out of ${cssValues.length}`);
    }

    return cssValues[0];
  }

  /**
   * {{> grabAttributeFromAll }}
   * Appium: can be used for apps only with several values ("contentDescription", "text", "className", "resourceId")
   */
  async grabAttributeFromAll(locator, attr) {
    const res = await this._locate(locator, true);
    const val = await forEachAsync(res, async el => el.getAttribute(attr));
    this.debugSection('GrabAttribute', String(val));
    return val;
  }

  /**
   * {{> grabAttributeFrom }}
   * Appium: can be used for apps only with several values ("contentDescription", "text", "className", "resourceId")
   */
  async grabAttributeFrom(locator, attr) {
    const attrs = await this.grabAttributeFromAll(locator, attr);
    assertElementExists(attrs, locator);
    if (attrs.length > 1) {
      this.debugSection('GrabAttribute', `Using first element out of ${attrs.length}`);
    }
    return attrs[0];
  }

  /**
   * {{> seeInTitle }}
   */
  async seeInTitle(text) {
    const title = await this.browser.getTitle();
    return stringIncludes('web page title').assert(text, title);
  }

  /**
   * {{> seeTitleEquals }}
   */
  async seeTitleEquals(text) {
    const title = await this.browser.getTitle();
    return assert.equal(title, text, `expected web page title to be ${text}, but found ${title}`);
  }

  /**
   * {{> dontSeeInTitle }}
   */
  async dontSeeInTitle(text) {
    const title = await this.browser.getTitle();
    return stringIncludes('web page title').negate(text, title);
  }

  /**
   * {{> grabTitle }}
   */
  async grabTitle() {
    const title = await this.browser.getTitle();
    this.debugSection('Title', title);
    return title;
  }

  /**
   * {{> see }}
   *
   * {{ react }}
   */
  async see(text, context = null) {
    return proceedSee.call(this, 'assert', text, context);
  }

  /**
   * {{> seeTextEquals }}
   */
  async seeTextEquals(text, context = null) {
    return proceedSee.call(this, 'assert', text, context, true);
  }

  /**
   * {{> dontSee }}
   *
   * {{ react }}
   */
  async dontSee(text, context = null) {
    return proceedSee.call(this, 'negate', text, context);
  }

  /**
   * {{> seeInField }}
   *
   */
  async seeInField(field, value) {
    return proceedSeeField.call(this, 'assert', field, value);
  }

  /**
   * {{> dontSeeInField }}
   *
   */
  async dontSeeInField(field, value) {
    return proceedSeeField.call(this, 'negate', field, value);
  }

  /**
   * {{> seeCheckboxIsChecked }}
   * Appium: not tested
   */
  async seeCheckboxIsChecked(field) {
    return proceedSeeCheckbox.call(this, 'assert', field);
  }

  /**
   * {{> dontSeeCheckboxIsChecked }}
   * Appium: not tested
   */
  async dontSeeCheckboxIsChecked(field) {
    return proceedSeeCheckbox.call(this, 'negate', field);
  }

  /**
   * {{> seeElement }}
   * {{ react }}
   *
   */
  async seeElement(locator) {
    const res = await this._locate(locator, true);
    assertElementExists(res, locator);
    const selected = await forEachAsync(res, async el => el.isDisplayed());
    return truth(`elements of ${locator}`, 'to be seen').assert(selected);
  }

  /**
   * {{> dontSeeElement }}
   * {{ react }}
   */
  async dontSeeElement(locator) {
    const res = await this._locate(locator, false);
    if (!res || res.length === 0) {
      return truth(`elements of ${locator}`, 'to be seen').negate(false);
    }
    const selected = await forEachAsync(res, async el => el.isDisplayed());
    return truth(`elements of ${locator}`, 'to be seen').negate(selected);
  }

  /**
   * {{> seeElementInDOM }}
   *
   */
  async seeElementInDOM(locator) {
    const res = await this._res(locator);
    return empty('elements').negate(res);
  }

  /**
   * {{> dontSeeElementInDOM }}
   *
   */
  async dontSeeElementInDOM(locator) {
    const res = await this._res(locator);
    return empty('elements').assert(res);
  }

  /**
   * {{> seeInSource }}
   *
   */
  async seeInSource(text) {
    const source = await this.browser.getPageSource();
    return stringIncludes('HTML source of a page').assert(text, source);
  }

  /**
   * {{> grabSource }}
   *
   */
  async grabSource() {
    return this.browser.getPageSource();
  }

  /**
   * {{> grabBrowserLogs }}
   */
  async grabBrowserLogs() {
    if (this.browser.isW3C) {
      this.debug('Logs not available in W3C specification');
      return;
    }
    return this.browser.getLogs('browser');
  }

  /**
   * {{> grabCurrentUrl }}
   */
  async grabCurrentUrl() {
    const res = await this.browser.getUrl();
    this.debugSection('Url', res);
    return res;
  }

  /**
   * {{> dontSeeInSource }}
   */
  async dontSeeInSource(text) {
    const source = await this.browser.getPageSource();
    return stringIncludes('HTML source of a page').negate(text, source);
  }

  /**
   * {{> seeNumberOfElements }}
   * {{ react }}
   */
  async seeNumberOfElements(locator, num) {
    const res = await this._locate(locator);
    return assert.equal(res.length, num, `expected number of elements (${locator}) is ${num}, but found ${res.length}`);
  }

  /**
   * {{> seeNumberOfVisibleElements }}
   * {{ react }}
   */
  async seeNumberOfVisibleElements(locator, num) {
    const res = await this.grabNumberOfVisibleElements(locator);
    return assert.equal(res, num, `expected number of visible elements (${locator}) is ${num}, but found ${res}`);
  }

  /**
   * {{> seeCssPropertiesOnElements }}
   */
  async seeCssPropertiesOnElements(locator, cssProperties) {
    const res = await this._locate(locator);
    assertElementExists(res, locator);
    const elemAmount = res.length;

    let props = await forEachAsync(res, async (el) => {
      return forEachAsync(Object.keys(cssProperties), async (prop) => {
        const propValue = await this.browser.getElementCSSValue(getElementId(el), prop);
        if (isColorProperty(prop) && propValue && propValue.value) {
          return convertColorToRGBA(propValue.value);
        }
        return propValue;
      });
    });

    const cssPropertiesCamelCase = convertCssPropertiesToCamelCase(cssProperties);

    const values = Object.keys(cssPropertiesCamelCase).map(key => cssPropertiesCamelCase[key]);
    if (!Array.isArray(props)) props = [props];
    let chunked = chunkArray(props, values.length);
    chunked = chunked.filter((val) => {
      for (let i = 0; i < val.length; ++i) {
        if (val[i] !== values[i]) return false;
      }
      return true;
    });
    return assert.ok(
      chunked.length === elemAmount,
      `expected all elements (${locator}) to have CSS property ${JSON.stringify(cssProperties)}`,
    );
  }

  /**
   * {{> seeAttributesOnElements }}
   */
  async seeAttributesOnElements(locator, attributes) {
    const res = await this._locate(locator);
    assertElementExists(res, locator);
    const elemAmount = res.length;

    let attrs = await forEachAsync(res, async (el) => {
      return forEachAsync(Object.keys(attributes), async attr => el.getAttribute(attr));
    });

    const values = Object.keys(attributes).map(key => attributes[key]);
    if (!Array.isArray(attrs)) attrs = [attrs];
    let chunked = chunkArray(attrs, values.length);
    chunked = chunked.filter((val) => {
      for (let i = 0; i < val.length; ++i) {
        if (val[i] !== values[i]) return false;
      }
      return true;
    });
    return assert.ok(
      chunked.length === elemAmount,
      `expected all elements (${locator}) to have attributes ${JSON.stringify(attributes)}`,
    );
  }

  /**
   * {{> grabNumberOfVisibleElements }}
   */
  async grabNumberOfVisibleElements(locator) {
    const res = await this._locate(locator);

    let selected = await forEachAsync(res, async el => el.isDisplayed());
    if (!Array.isArray(selected)) selected = [selected];
    selected = selected.filter(val => val === true);
    return selected.length;
  }

  /**
   * {{> seeInCurrentUrl }}
   *
   */
  async seeInCurrentUrl(url) {
    const res = await this.browser.getUrl();
    return stringIncludes('url').assert(url, decodeUrl(res));
  }

  /**
   * {{> dontSeeInCurrentUrl }}
   *
   */
  async dontSeeInCurrentUrl(url) {
    const res = await this.browser.getUrl();
    return stringIncludes('url').negate(url, decodeUrl(res));
  }

  /**
   * {{> seeCurrentUrlEquals }}
   *
   */
  async seeCurrentUrlEquals(url) {
    const res = await this.browser.getUrl();
    return urlEquals(this.options.url).assert(url, decodeUrl(res));
  }

  /**
   * {{> dontSeeCurrentUrlEquals }}
   *
   */
  async dontSeeCurrentUrlEquals(url) {
    const res = await this.browser.getUrl();
    return urlEquals(this.options.url).negate(url, decodeUrl(res));
  }

  /**
   * {{> executeScript }}
   *
   *
   * Wraps [execute](http://webdriver.io/api/protocol/execute.html) command.
   */
  executeScript(...args) {
    return this.browser.execute.apply(this.browser, args);
  }

  /**
   * {{> executeAsyncScript }}
   *
   */
  executeAsyncScript(...args) {
    return this.browser.executeAsync.apply(this.browser, args);
  }

  /**
   * {{> scrollIntoView }}
   *
   */
  async scrollIntoView(locator, scrollIntoViewOptions) {
    const res = await this._locate(withStrictLocator(locator), true);
    assertElementExists(res);
    const elem = usingFirstElement(res);
    return elem.scrollIntoView(scrollIntoViewOptions);
  }

  /**
   * {{> scrollTo }}
   *
   */
  async scrollTo(locator, offsetX = 0, offsetY = 0) {
    if (typeof locator === 'number' && typeof offsetX === 'number') {
      offsetY = offsetX;
      offsetX = locator;
      locator = null;
    }

    if (locator) {
      const res = await this._locate(withStrictLocator(locator), true);
      assertElementExists(res);
      const elem = usingFirstElement(res);
      const elementId = getElementId(elem);
      if (this.browser.isMobile) return this.browser.touchScroll(offsetX, offsetY, elementId);
      const location = await elem.getLocation();
      assertElementExists(location, 'Failed to receive', 'location');
      /* eslint-disable prefer-arrow-callback */
      return this.browser.execute(function (x, y) { return window.scrollTo(x, y); }, location.x + offsetX, location.y + offsetY);
      /* eslint-enable */
    }

    if (this.browser.isMobile) return this.browser.touchScroll(locator, offsetX, offsetY);

    /* eslint-disable prefer-arrow-callback, comma-dangle */
    return this.browser.execute(function (x, y) { return window.scrollTo(x, y); }, offsetX, offsetY);
    /* eslint-enable */
  }

  /**
   * {{> moveCursorTo }}
   */
  async moveCursorTo(locator, xOffset, yOffset) {
    const res = await this._locate(withStrictLocator(locator), true);
    assertElementExists(res, locator);
    const elem = usingFirstElement(res);
    if (isWebDriver5()) return elem.moveTo(xOffset, yOffset);
    return elem.moveTo({ xOffset, yOffset });
  }

  /**
   * {{> saveElementScreenshot }}
   *
   */
  async saveElementScreenshot(locator, fileName) {
    const outputFile = screenshotOutputFolder(fileName);

    const res = await this._locate(withStrictLocator(locator), true);
    assertElementExists(res, locator);
    const elem = usingFirstElement(res);

    this.debug(`Screenshot of ${locator} element has been saved to ${outputFile}`);
    return elem.saveScreenshot(outputFile);
  }

  /**
   * {{> saveScreenshot }}
   */
  async saveScreenshot(fileName, fullPage = false) {
    const outputFile = screenshotOutputFolder(fileName);

    if (this.activeSessionName) {
      const browser = this.sessionWindows[this.activeSessionName];

      if (browser) {
        this.debug(`Screenshot of ${this.activeSessionName} session has been saved to ${outputFile}`);
        return browser.saveScreenshot(outputFile);
      }
    }

    if (!fullPage) {
      this.debug(`Screenshot has been saved to ${outputFile}`);
      return this.browser.saveScreenshot(outputFile);
    }

    /* eslint-disable prefer-arrow-callback, comma-dangle, prefer-const */
    const originalWindowSize = await this.browser.getWindowSize();

    let { width, height } = await this.browser.execute(function () {
      return {
        height: document.body.scrollHeight,
        width: document.body.scrollWidth
      };
    }).then(res => res);

    if (height < 100) height = 500; // errors for very small height
    /* eslint-enable */

    await this.browser.setWindowSize(width, height);
    this.debug(`Screenshot has been saved to ${outputFile}, size: ${width}x${height}`);
    const buffer = await this.browser.saveScreenshot(outputFile);
    await this.browser.setWindowSize(originalWindowSize.width, originalWindowSize.height);
    return buffer;
  }

  /**
   * {{> setCookie }}
   *
   *
   * Uses Selenium's JSON [cookie
   * format](https://code.google.com/p/selenium/wiki/JsonWireProtocol#Cookie_JSON_Object).
   */
  async setCookie(cookie) {
    return this.browser.setCookies(cookie);
  }

  /**
   * {{> clearCookie }}
   */
  async clearCookie(cookie) {
    return this.browser.deleteCookies(cookie);
  }

  /**
   * {{> seeCookie }}
   */
  async seeCookie(name) {
    const cookie = await this.browser.getCookies([name]);
    return truth(`cookie ${name}`, 'to be set').assert(cookie);
  }

  /**
   * {{> dontSeeCookie }}
   */
  async dontSeeCookie(name) {
    const cookie = await this.browser.getCookies([name]);
    return truth(`cookie ${name}`, 'to be set').negate(cookie);
  }

  /**
   * {{> grabCookie }}
   */
  async grabCookie(name) {
    if (!name) return this.browser.getCookies();
    const cookie = await this.browser.getCookies([name]);
    this.debugSection('Cookie', JSON.stringify(cookie));
    return cookie[0];
  }

  /**
   * Accepts the active JavaScript native popup window, as created by window.alert|window.confirm|window.prompt.
   * Don't confuse popups with modal windows, as created by [various
   * libraries](http://jster.net/category/windows-modals-popups).
   */
  async acceptPopup() {
    return this.browser.getAlertText().then((res) => {
      if (res !== null) {
        return this.browser.acceptAlert();
      }
    });
  }

  /**
   * Dismisses the active JavaScript popup, as created by window.alert|window.confirm|window.prompt.
   *
   */
  async cancelPopup() {
    return this.browser.getAlertText().then((res) => {
      if (res !== null) {
        return this.browser.dismissAlert();
      }
    });
  }

  /**
   * Checks that the active JavaScript popup, as created by `window.alert|window.confirm|window.prompt`, contains the
   * given string.
   *
   * @param {string} text value to check.
   */
  async seeInPopup(text) {
    return this.browser.getAlertText().then((res) => {
      if (res === null) {
        throw new Error('Popup is not opened');
      }
      stringIncludes('text in popup').assert(text, res);
    });
  }

  /**
   * {{> grabPopupText }}
   */
  async grabPopupText() {
    try {
      return await this.browser.getAlertText();
    } catch (err) {
      this.debugSection('Popup', 'Error getting text from popup');
    }
  }

  /**
   * {{> pressKeyDown }}
   */
  async pressKeyDown(key) {
    key = getNormalizedKey.call(this, key);
    if (!this.browser.isW3C) {
      return this.browser.sendKeys([key]);
    }
    return this.browser.performActions([{
      type: 'key',
      id: 'keyboard',
      actions: [{
        type: 'keyDown',
        value: key,
      }],
    }]);
  }

  /**
   * {{> pressKeyUp }}
   */
  async pressKeyUp(key) {
    key = getNormalizedKey.call(this, key);
    if (!this.browser.isW3C) {
      return this.browser.sendKeys([key]);
    }
    return this.browser.performActions([{
      type: 'key',
      id: 'keyboard',
      actions: [{
        type: 'keyUp',
        value: key,
      }],
    }]);
  }

  /**
   * {{> pressKeyWithKeyNormalization }}
   *
   * _Note:_ In case a text field or textarea is focused be aware that some browsers do not respect active modifier when combining modifier keys with other keys.
   */
  async pressKey(key) {
    const modifiers = [];
    if (Array.isArray(key)) {
      for (let k of key) {
        k = getNormalizedKey.call(this, k);
        if (isModifierKey(k)) {
          modifiers.push(k);
        } else {
          key = k;
          break;
        }
      }
    } else {
      key = getNormalizedKey.call(this, key);
    }
    for (const modifier of modifiers) {
      await this.pressKeyDown(modifier);
    }
    if (!this.browser.isW3C) {
      await this.browser.sendKeys([key]);
    } else {
      await this.browser.performActions([{
        type: 'key',
        id: 'keyboard',
        actions: [{
          type: 'keyDown',
          value: key,
        }, {
          type: 'keyUp',
          value: key,
        }],
      }]);
    }
    for (const modifier of modifiers) {
      await this.pressKeyUp(modifier);
    }
  }

  /**
   * {{> type }}
   */
  async type(keys, delay = null) {
    if (!Array.isArray(keys)) {
      keys = keys.split('');
    }
    if (delay) {
      for (const key of keys) {
        await this.browser.keys(key);
        await this.wait(delay / 1000);
      }
      return;
    }
    await this.browser.keys(keys);
  }

  /**
   * {{> resizeWindow }}
   * Appium: not tested in web, in apps doesn't work
   */
  async resizeWindow(width, height) {
    return this._resizeBrowserWindow(this.browser, width, height);
  }

  async _resizeBrowserWindow(browser, width, height) {
    if (width === 'maximize') {
      const size = await browser.maximizeWindow();
      this.debugSection('Window Size', size);
      return;
    }
    if (browser.isW3C) {
      return browser.setWindowRect(null, null, parseInt(width, 10), parseInt(height, 10));
    }
    return browser.setWindowSize(parseInt(width, 10), parseInt(height, 10));
  }

  async _resizeWindowIfNeeded(browser, windowSize) {
    if (this.isWeb && windowSize === 'maximize') {
      await this._resizeBrowserWindow(browser, 'maximize');
    } else if (this.isWeb && windowSize && windowSize.indexOf('x') > 0) {
      const dimensions = windowSize.split('x');
      await this._resizeBrowserWindow(browser, dimensions[0], dimensions[1]);
    }
  }

  /**
   * {{> dragAndDrop }}
   * Appium: not tested
   */
  async dragAndDrop(srcElement, destElement) {
    let sourceEl = await this._locate(srcElement);
    assertElementExists(sourceEl);
    sourceEl = usingFirstElement(sourceEl);

    let destEl = await this._locate(destElement);
    assertElementExists(destEl);
    destEl = usingFirstElement(destEl);

    return sourceEl.dragAndDrop(destEl);
  }

  /**
   * {{> dragSlider }}
   */
  async dragSlider(locator, offsetX = 0) {
    const browser = this.browser;
    await this.moveCursorTo(locator);

    // for chrome
    if (browser.isW3C) {
      const xOffset = await this.grabElementBoundingRect(locator, 'x');
      const yOffset = await this.grabElementBoundingRect(locator, 'y');

      return browser.performActions([{
        type: 'pointer',
        id: 'pointer1',
        parameters: { pointerType: 'mouse' },
        actions: [
          {
            type: 'pointerMove', origin: 'pointer', duration: 1000, x: xOffset, y: yOffset,
          },
          { type: 'pointerDown', button: 0 },
          {
            type: 'pointerMove', origin: 'pointer', duration: 1000, x: offsetX, y: 0,
          },
          { type: 'pointerUp', button: 0 },
        ],
      },
      ]);
    }

    await browser.buttonDown(0);
    await browser.moveToElement(null, offsetX, 0);
    await browser.buttonUp(0);
  }

  /**
   * {{> grabAllWindowHandles }}
   */
  async grabAllWindowHandles() {
    return this.browser.getWindowHandles();
  }

  /**
   * {{> grabCurrentWindowHandle }}
   */
  async grabCurrentWindowHandle() {
    return this.browser.getWindowHandle();
  }

  /**
   * Switch to the window with a specified handle.
   *
   * ```js
   * const windows = await I.grabAllWindowHandles();
   * // ... do something
   * await I.switchToWindow( windows[0] );
   *
   * const window = await I.grabCurrentWindowHandle();
   * // ... do something
   * await I.switchToWindow( window );
   * ```
   * @param {string} window name of window handle.
   */
  async switchToWindow(window) {
    await this.browser.switchToWindow(window);
  }

  /**
   * {{> closeOtherTabs }}
   */
  async closeOtherTabs() {
    const handles = await this.browser.getWindowHandles();
    const currentHandle = await this.browser.getWindowHandle();
    const otherHandles = handles.filter(handle => handle !== currentHandle);

    await forEachAsync(otherHandles, async (handle) => {
      await this.browser.switchToWindow(handle);
      await this.browser.closeWindow();
    });
    await this.browser.switchToWindow(currentHandle);
  }

  /**
   * {{> wait }}
   */
  async wait(sec) {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
  }

  /**
   * {{> waitForEnabled }}
   */
  async waitForEnabled(locator, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return this.browser.waitUntil(async () => {
        const res = await this.$$(withStrictLocator(locator));
        if (!res || res.length === 0) {
          return false;
        }
        const selected = await forEachAsync(res, async el => this.browser.isElementEnabled(getElementId(el)));
        if (Array.isArray(selected)) {
          return selected.filter(val => val === true).length > 0;
        }
        return selected;
      }, aSec * 1000, `element (${new Locator(locator)}) still not enabled after ${aSec} sec`);
    }
    return this.browser.waitUntil(async () => {
      const res = await this._res(locator);
      if (!res || res.length === 0) {
        return false;
      }
      const selected = await forEachAsync(res, async el => this.browser.isElementEnabled(getElementId(el)));
      if (Array.isArray(selected)) {
        return selected.filter(val => val === true).length > 0;
      }
      return selected;
    }, {
      timeout: aSec * 1000,
      timeoutMsg: `element (${new Locator(locator)}) still not enabled after ${aSec} sec`,
    });
  }

  /**
   * {{> waitForElement }}
   */
  async waitForElement(locator, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return this.browser.waitUntil(async () => {
        const res = await this.$$(withStrictLocator(locator));
        return res && res.length;
      }, aSec * 1000, `element (${locator}) still not present on page after ${aSec} sec`);
    }
    return this.browser.waitUntil(async () => {
      const res = await this._res(locator);
      return res && res.length;
    }, { timeout: aSec * 1000, timeoutMsg: `element (${locator}) still not present on page after ${aSec} sec` });
  }

  /**
   * {{> waitForClickable }}
   */
  async waitForClickable(locator, waitTimeout) {
    waitTimeout = waitTimeout || this.options.waitForTimeout;
    let res = await this._locate(locator);
    res = usingFirstElement(res);
    assertElementExists(res, locator);

    return res.waitForClickable({
      timeout: waitTimeout * 1000,
      timeoutMsg: `element ${res.selector} still not clickable after ${waitTimeout} sec`,
    });
  }

  /**
   * {{> waitInUrl }}
   */
  async waitInUrl(urlPart, sec = null) {
    const client = this.browser;
    const aSec = sec || this.options.waitForTimeout;
    let currUrl = '';
    if (isWebDriver5()) {
      return client
        .waitUntil(function () {
          return this.getUrl().then((res) => {
            currUrl = decodeUrl(res);
            return currUrl.indexOf(urlPart) > -1;
          });
        }, aSec * 1000).catch((e) => {
          if (e.message.indexOf('timeout')) {
            throw new Error(`expected url to include ${urlPart}, but found ${currUrl}`);
          }
          throw e;
        });
    }
    return client
      .waitUntil(function () {
        return this.getUrl().then((res) => {
          currUrl = decodeUrl(res);
          return currUrl.indexOf(urlPart) > -1;
        });
      }, { timeout: aSec * 1000 }).catch((e) => {
        if (e.message.indexOf('timeout')) {
          throw new Error(`expected url to include ${urlPart}, but found ${currUrl}`);
        }
        throw e;
      });
  }

  /**
   * {{> waitUrlEquals }}
   */
  async waitUrlEquals(urlPart, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    const baseUrl = this.options.url;
    if (urlPart.indexOf('http') < 0) {
      urlPart = baseUrl + urlPart;
    }
    let currUrl = '';
    return this.browser.waitUntil(function () {
      return this.getUrl().then((res) => {
        currUrl = decodeUrl(res);
        return currUrl === urlPart;
      });
    }, aSec * 1000).catch((e) => {
      if (e.message.indexOf('timeout')) {
        throw new Error(`expected url to be ${urlPart}, but found ${currUrl}`);
      }
      throw e;
    });
  }

  /**
   * {{> waitForText }}
   *
   */
  async waitForText(text, sec = null, context = null) {
    const aSec = sec || this.options.waitForTimeout;
    const _context = context || this.root;
    if (isWebDriver5()) {
      return this.browser.waitUntil(
        async () => {
          const res = await this.$$(withStrictLocator.call(this, _context));
          if (!res || res.length === 0) return false;
          const selected = await forEachAsync(res, async el => this.browser.getElementText(getElementId(el)));
          if (Array.isArray(selected)) {
            return selected.filter(part => part.indexOf(text) >= 0).length > 0;
          }
          return selected.indexOf(text) >= 0;
        }, aSec * 1000,
        `element (${_context}) is not in DOM or there is no element(${_context}) with text "${text}" after ${aSec} sec`,
      );
    }

    return this.browser.waitUntil(
      async () => {
        const res = await this.$$(withStrictLocator.call(this, _context));
        if (!res || res.length === 0) return false;
        const selected = await forEachAsync(res, async el => this.browser.getElementText(getElementId(el)));
        if (Array.isArray(selected)) {
          return selected.filter(part => part.indexOf(text) >= 0).length > 0;
        }
        return selected.indexOf(text) >= 0;
      }, {
        timeout: aSec * 1000,
        timeoutMsg: `element (${_context}) is not in DOM or there is no element(${_context}) with text "${text}" after ${aSec} sec`,
      },
    );
  }

  /**
   * {{> waitForValue }}
   */
  async waitForValue(field, value, sec = null) {
    const client = this.browser;
    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return client.waitUntil(
        async () => {
          const res = await findFields.call(this, field);
          if (!res || res.length === 0) return false;
          const selected = await forEachAsync(res, async el => el.getValue());
          if (Array.isArray(selected)) {
            return selected.filter(part => part.indexOf(value) >= 0).length > 0;
          }
          return selected.indexOf(value) >= 0;
        }, aSec * 1000,
        `element (${field}) is not in DOM or there is no element(${field}) with value "${value}" after ${aSec} sec`,
      );
    }
    return client.waitUntil(
      async () => {
        const res = await findFields.call(this, field);
        if (!res || res.length === 0) return false;
        const selected = await forEachAsync(res, async el => el.getValue());
        if (Array.isArray(selected)) {
          return selected.filter(part => part.indexOf(value) >= 0).length > 0;
        }
        return selected.indexOf(value) >= 0;
      }, {
        timeout: aSec * 1000,
        timeoutMsg: `element (${field}) is not in DOM or there is no element(${field}) with value "${value}" after ${aSec} sec`,
      },
    );
  }

  /**
   * {{> waitForVisible }}
   *
   */
  async waitForVisible(locator, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return this.browser.waitUntil(async () => {
        const res = await this.$$(withStrictLocator(locator));
        if (!res || res.length === 0) return false;
        const selected = await forEachAsync(res, async el => el.isDisplayed());
        if (Array.isArray(selected)) {
          return selected.filter(val => val === true).length > 0;
        }
        return selected;
      }, aSec * 1000, `element (${new Locator(locator)}) still not visible after ${aSec} sec`);
    }
    return this.browser.waitUntil(async () => {
      const res = await this._res(locator);
      if (!res || res.length === 0) return false;
      const selected = await forEachAsync(res, async el => el.isDisplayed());
      if (Array.isArray(selected)) {
        return selected.filter(val => val === true).length > 0;
      }
      return selected;
    }, { timeout: aSec * 1000, timeoutMsg: `element (${new Locator(locator)}) still not visible after ${aSec} sec` });
  }

  /**
   * {{> waitNumberOfVisibleElements }}
   */
  async waitNumberOfVisibleElements(locator, num, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return this.browser.waitUntil(async () => {
        const res = await this.$$(withStrictLocator(locator));
        if (!res || res.length === 0) return false;
        let selected = await forEachAsync(res, async el => el.isDisplayed());

        if (!Array.isArray(selected)) selected = [selected];
        selected = selected.filter(val => val === true);
        return selected.length === num;
      }, aSec * 1000, `The number of elements (${new Locator(locator)}) is not ${num} after ${aSec} sec`);
    }
    return this.browser.waitUntil(async () => {
      const res = await this._res(locator);
      if (!res || res.length === 0) return false;
      let selected = await forEachAsync(res, async el => el.isDisplayed());

      if (!Array.isArray(selected)) selected = [selected];
      selected = selected.filter(val => val === true);
      return selected.length === num;
    }, { timeout: aSec * 1000, timeoutMsg: `The number of elements (${new Locator(locator)}) is not ${num} after ${aSec} sec` });
  }

  /**
   * {{> waitForInvisible }}
   */
  async waitForInvisible(locator, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return this.browser.waitUntil(async () => {
        const res = await this.$$(withStrictLocator(locator));
        if (!res || res.length === 0) return true;
        const selected = await forEachAsync(res, async el => el.isDisplayed());
        return !selected.length;
      }, aSec * 1000, `element (${new Locator(locator)}) still visible after ${aSec} sec`);
    }
    return this.browser.waitUntil(async () => {
      const res = await this._res(locator);
      if (!res || res.length === 0) return true;
      const selected = await forEachAsync(res, async el => el.isDisplayed());
      return !selected.length;
    }, { timeout: aSec * 1000, timeoutMsg: `element (${new Locator(locator)}) still visible after ${aSec} sec` });
  }

  /**
   * {{> waitToHide }}
   */
  async waitToHide(locator, sec = null) {
    return this.waitForInvisible(locator, sec);
  }

  /**
   * {{> waitForDetached }}
   */
  async waitForDetached(locator, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return this.browser.waitUntil(async () => {
        const res = await this._res(locator);
        if (!res || res.length === 0) {
          return true;
        }
        return false;
      }, aSec * 1000, `element (${new Locator(locator)}) still on page after ${aSec} sec`);
    }
    return this.browser.waitUntil(async () => {
      const res = await this._res(locator);
      if (!res || res.length === 0) {
        return true;
      }
      return false;
    }, { timeout: aSec * 1000, timeoutMsg: `element (${new Locator(locator)}) still on page after ${aSec} sec` });
  }

  /**
   * {{> waitForFunction }}
   */
  async waitForFunction(fn, argsOrSec = null, sec = null) {
    let args = [];
    if (argsOrSec) {
      if (Array.isArray(argsOrSec)) {
        args = argsOrSec;
      } else if (typeof argsOrSec === 'number') {
        sec = argsOrSec;
      }
    }

    const aSec = sec || this.options.waitForTimeout;
    if (isWebDriver5()) {
      return this.browser.waitUntil(async () => this.browser.execute(fn, ...args), aSec * 1000, '');
    }
    return this.browser.waitUntil(async () => this.browser.execute(fn, ...args), { timeout: aSec * 1000, timeoutMsg: '' });
  }

  /**
   * {{> waitUntil }}
   */
  async waitUntil(fn, sec = null, timeoutMsg = null, interval = null) {
    const aSec = sec || this.options.waitForTimeout;
    const _interval = typeof interval === 'number' ? interval * 1000 : null;
    if (isWebDriver5()) {
      return this.browser.waitUntil(fn, aSec * 1000, timeoutMsg, _interval);
    }
    return this.browser.waitUntil(fn, { timeout: aSec * 1000, timeoutMsg, interval: _interval });
  }

  /**
   * {{> switchTo }}
   */
  async switchTo(locator) {
    this.browser.isInsideFrame = true;
    if (Number.isInteger(locator)) {
      return this.browser.switchToFrame(locator);
    }
    if (!locator) {
      return this.browser.switchToFrame(null);
    }

    let res = await this._locate(locator, true);
    assertElementExists(res, locator);
    res = usingFirstElement(res);
    return this.browser.switchToFrame(res);
  }

  /**
   * {{> switchToNextTab }}
   */
  async switchToNextTab(num = 1, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    let target;
    const current = await this.browser.getWindowHandle();

    if (isWebDriver5()) {
      await this.browser.waitUntil(async () => {
        await this.browser.getWindowHandles().then((handles) => {
          if (handles.indexOf(current) + num + 1 <= handles.length) {
            target = handles[handles.indexOf(current) + num];
          }
        });
        return target;
      }, aSec * 1000, `There is no ability to switch to next tab with offset ${num}`);
      return this.browser.switchToWindow(target);
    }

    await this.browser.waitUntil(async () => {
      await this.browser.getWindowHandles().then((handles) => {
        if (handles.indexOf(current) + num + 1 <= handles.length) {
          target = handles[handles.indexOf(current) + num];
        }
      });
      return target;
    }, { timeout: aSec * 1000, timeoutMsg: `There is no ability to switch to next tab with offset ${num}` });
    return this.browser.switchToWindow(target);
  }

  /**
   * {{> switchToPreviousTab }}
   */
  async switchToPreviousTab(num = 1, sec = null) {
    const aSec = sec || this.options.waitForTimeout;
    const current = await this.browser.getWindowHandle();
    let target;

    if (isWebDriver5()) {
      await this.browser.waitUntil(async () => {
        await this.browser.getWindowHandles().then((handles) => {
          if (handles.indexOf(current) - num > -1) {
            target = handles[handles.indexOf(current) - num];
          }
        });
        return target;
      }, aSec * 1000, `There is no ability to switch to previous tab with offset ${num}`);
      return this.browser.switchToWindow(target);
    }

    await this.browser.waitUntil(async () => {
      await this.browser.getWindowHandles().then((handles) => {
        if (handles.indexOf(current) - num > -1) {
          target = handles[handles.indexOf(current) - num];
        }
      });
      return target;
    }, { timeout: aSec * 1000, timeoutMsg: `There is no ability to switch to previous tab with offset ${num}` });
    return this.browser.switchToWindow(target);
  }

  /**
   * {{> closeCurrentTab }}
   */
  async closeCurrentTab() {
    await this.browser.closeWindow();
    const handles = await this.browser.getWindowHandles();
    if (handles[0]) await this.browser.switchToWindow(handles[0]);
  }

  /**
   * {{> openNewTab }}
   */
  async openNewTab(url = 'about:blank', windowName = null) {
    const client = this.browser;
    const crypto = require('crypto');
    if (windowName == null) {
      windowName = crypto.randomBytes(32).toString('hex');
    }
    return client.newWindow(url, windowName);
  }

  /**
   * {{> grabNumberOfOpenTabs }}
   */
  async grabNumberOfOpenTabs() {
    const pages = await this.browser.getWindowHandles();
    this.debugSection('Tabs', `Total ${pages.length}`);
    return pages.length;
  }

  /**
   * {{> refreshPage }}
   */
  async refreshPage() {
    const client = this.browser;
    return client.refresh();
  }

  /**
   * {{> scrollPageToTop }}
   */
  scrollPageToTop() {
    const client = this.browser;
    /* eslint-disable prefer-arrow-callback */
    return client.execute(function () {
      window.scrollTo(0, 0);
    });
    /* eslint-enable */
  }

  /**
   * {{> scrollPageToBottom }}
   */
  scrollPageToBottom() {
    const client = this.browser;
    /* eslint-disable prefer-arrow-callback, comma-dangle */
    return client.execute(function () {
      const body = document.body;
      const html = document.documentElement;
      window.scrollTo(0, Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight
      ));
    });
    /* eslint-enable */
  }

  /**
   * {{> grabPageScrollPosition }}
   */
  async grabPageScrollPosition() {
    /* eslint-disable comma-dangle */
    function getScrollPosition() {
      return {
        x: window.pageXOffset,
        y: window.pageYOffset
      };
    }
    /* eslint-enable comma-dangle */
    return this.executeScript(getScrollPosition);
  }

  /**
   * {{> setGeoLocation }}
   */
  async setGeoLocation(latitude, longitude, altitude = null) {
    if (altitude) {
      return this.browser.setGeoLocation({ latitude, longitude });
    }
    return this.browser.setGeoLocation({ latitude, longitude, altitude });
  }

  /**
   * {{> grabGeoLocation }}
   *
   */
  async grabGeoLocation() {
    return this.browser.getGeoLocation();
  }

  /**
   * {{> grabElementBoundingRect }}
   */
  async grabElementBoundingRect(locator, prop) {
    const res = await this._locate(locator, true);
    assertElementExists(res, locator);
    const el = usingFirstElement(res);

    const rect = {
      ...await el.getLocation(),
      ...await el.getSize(),
    };
    if (prop) return rect[prop];
    return rect;
  }

  /**
   * Placeholder for ~ locator only test case write once run on both Appium and WebDriver.
   */
  /* eslint-disable */
  runOnIOS(caps, fn) {
  }

  /**
   * Placeholder for ~ locator only test case write once run on both Appium and WebDriver.
   */
  runOnAndroid(caps, fn) {
  }
  /* eslint-enable */

  /**
   * Placeholder for ~ locator only test case write once run on both Appium and WebDriver.
   */
  runInWeb(fn) {
    return fn();
  }
}

async function proceedSee(assertType, text, context, strict = false) {
  let description;
  if (!context) {
    if (this.context === webRoot) {
      context = this.context;
      description = 'web page';
    } else {
      description = `current context ${this.context}`;
      context = './/*';
    }
  } else {
    description = `element ${context}`;
  }

  const smartWaitEnabled = assertType === 'assert';
  const res = await this._locate(withStrictLocator(context), smartWaitEnabled);
  assertElementExists(res, context);
  const selected = await forEachAsync(res, async el => this.browser.getElementText(getElementId(el)));
  if (strict) {
    if (Array.isArray(selected) && selected.length !== 0) {
      return selected.map(elText => equals(description)[assertType](text, elText));
    }
    return equals(description)[assertType](text, selected);
  }
  return stringIncludes(description)[assertType](text, selected);
}

/**
 * Mimic Array.forEach() API, but with an async callback function.
 * Execute each callback on each array item serially. Useful when using WebDriver API.
 *
 * Added due because of problem with chrome driver when too many requests
 * are made simultaneously. https://bugs.chromium.org/p/chromedriver/issues/detail?id=2152#c9
 * @private
 * @param {Array} array Input array items to iterate over.
 * @param {Function} callback - Async function to excute on each array item.
 * @param {object} [options] - Configurable options.
 * @param {boolean} [options.expandArrayResults=true] - Flag to flat one dimension array results.
 * @return {Promise<Array>} - Array of values.
 */
async function forEachAsync(array, callback, options = { expandArrayResults: true }) {
  const {
    expandArrayResults = true,
  } = options;
  const inputArray = Array.isArray(array) ? array : [array];
  const values = [];
  for (let index = 0; index < inputArray.length; index++) {
    const res = await callback(inputArray[index], index, inputArray);

    if (Array.isArray(res) && expandArrayResults) {
      res.forEach(val => values.push(val));
    } else if (res) {
      values.push(res);
    }
  }
  return values;
}

/**
 * Mimic Array.filter() API, but with an async callback function.
 * Execute each callback on each array item serially. Useful when using WebDriver API.
 *
 * Added due because of problem with chrome driver when too many requests
 * are made simultaneously. https://bugs.chromium.org/p/chromedriver/issues/detail?id=2152#c9
 * @private
 * @param {Array} array - Input array items to iterate over.
 * @param {Function} callback - Async functin to excute on each array item.
 * @return {Promise<Array>} - Array of values.
 */
async function filterAsync(array, callback) {
  const inputArray = Array.isArray(array) ? array : [array];
  const values = [];
  for (let index = 0; index < inputArray.length; index++) {
    const res = await callback(inputArray[index], index, inputArray);
    const value = Array.isArray(res) ? res[0] : res;

    if (value) {
      values.push(inputArray[index]);
    }
  }
  return values;
}

async function findClickable(locator, locateFn) {
  locator = new Locator(locator);

  if (this._isCustomLocator(locator)) {
    return locateFn(locator.value);
  }

  if (locator.isAccessibilityId() && !this.isWeb) return locateFn(locator, true);
  if (!locator.isFuzzy()) return locateFn(locator, true);

  let els;
  const literal = xpathLocator.literal(locator.value);

  els = await locateFn(Locator.clickable.narrow(literal));
  if (els.length) return els;

  els = await locateFn(Locator.clickable.wide(literal));
  if (els.length) return els;

  els = await locateFn(Locator.clickable.self(literal));
  if (els.length) return els;

  return locateFn(locator.value); // by css or xpath
}

async function findFields(locator) {
  locator = new Locator(locator);

  if (this._isCustomLocator(locator)) {
    return this._locate(locator);
  }

  if (locator.isAccessibilityId() && !this.isWeb) return this._locate(locator, true);
  if (!locator.isFuzzy()) return this._locate(locator, true);

  const literal = xpathLocator.literal(locator.value);
  let els = await this._locate(Locator.field.labelEquals(literal));
  if (els.length) return els;

  els = await this._locate(Locator.field.labelContains(literal));
  if (els.length) return els;

  els = await this._locate(Locator.field.byName(literal));
  if (els.length) return els;
  return this._locate(locator.value); // by css or xpath
}

async function proceedSeeField(assertType, field, value) {
  const res = await findFields.call(this, field);
  assertElementExists(res, field, 'Field');
  const elem = usingFirstElement(res);
  const elemId = getElementId(elem);

  const proceedMultiple = async (fields) => {
    const fieldResults = toArray(await forEachAsync(fields, async (el) => {
      const elementId = getElementId(el);
      return this.browser.isW3C ? el.getValue() : this.browser.getElementAttribute(elementId, 'value');
    }));

    if (typeof value === 'boolean') {
      equals(`no. of items matching > 0: ${field}`)[assertType](value, !!fieldResults.length);
    } else {
      // Assert that results were found so the forEach assert does not silently pass
      equals(`no. of items matching > 0:  ${field}`)[assertType](true, !!fieldResults.length);
      fieldResults.forEach(val => stringIncludes(`fields by ${field}`)[assertType](value, val));
    }
  };

  const proceedSingle = el => this.browser.getElementAttribute(getElementId(el), 'value').then((res) => {
    if (res === null) {
      throw new Error(`Element ${el.selector} has no value attribute`);
    }
    stringIncludes(`fields by ${field}`)[assertType](value, res);
  });

  const filterBySelected = async elements => filterAsync(elements, async el => this.browser.isElementSelected(getElementId(el)));

  const filterSelectedByValue = async (elements, value) => {
    return filterAsync(elements, async (el) => {
      const elementId = getElementId(el);
      const currentValue = this.browser.isW3C ? await el.getValue() : await this.browser.getElementAttribute(elementId, 'value');
      const isSelected = await this.browser.isElementSelected(elementId);
      return currentValue === value && isSelected;
    });
  };

  const tag = await elem.getTagName();
  if (tag === 'select') {
    const subOptions = await this.browser.findElementsFromElement(elemId, 'css', 'option');

    if (value === '') {
      // Don't filter by value
      const selectedOptions = await filterBySelected(subOptions);
      return proceedMultiple(selectedOptions);
    }

    const options = await filterSelectedByValue(subOptions, value);
    return proceedMultiple(options);
  }

  if (tag === 'input') {
    const fieldType = await elem.getAttribute('type');

    if (fieldType === 'checkbox' || fieldType === 'radio') {
      if (typeof value === 'boolean') {
        // Support boolean values
        const options = await filterBySelected(res);
        return proceedMultiple(options);
      }

      const options = await filterSelectedByValue(res, value);
      return proceedMultiple(options);
    }
    return proceedSingle(elem);
  }
  return proceedSingle(elem);
}

function toArray(item) {
  if (!Array.isArray(item)) {
    return [item];
  }
  return item;
}

async function proceedSeeCheckbox(assertType, field) {
  const res = await findFields.call(this, field);
  assertElementExists(res, field, 'Field');

  const selected = await forEachAsync(res, async el => this.browser.isElementSelected(getElementId(el)));
  return truth(`checkable field "${field}"`, 'to be checked')[assertType](selected);
}

async function findCheckable(locator, locateFn) {
  let els;
  locator = new Locator(locator);

  if (this._isCustomLocator(locator)) {
    return locateFn(locator.value);
  }

  if (locator.isAccessibilityId() && !this.isWeb) return locateFn(locator, true);
  if (!locator.isFuzzy()) return locateFn(locator, true);

  const literal = xpathLocator.literal(locator.value);
  els = await locateFn(Locator.checkable.byText(literal));
  if (els.length) return els;
  els = await locateFn(Locator.checkable.byName(literal));
  if (els.length) return els;

  return locateFn(locator.value); // by css or xpath
}

function withStrictLocator(locator) {
  locator = new Locator(locator);
  return locator.simplify();
}

function isFrameLocator(locator) {
  locator = new Locator(locator);
  if (locator.isFrame()) return locator.value;
  return false;
}

function assertElementExists(res, locator, prefix, suffix) {
  if (!res || res.length === 0) {
    throw new ElementNotFound(locator, prefix, suffix);
  }
}

function usingFirstElement(els) {
  if (els.length > 1) debug(`[Elements] Using first element out of ${els.length}`);
  return els[0];
}

function getElementId(el) {
  // W3C WebDriver web element identifier
  // https://w3c.github.io/webdriver/#dfn-web-element-identifier
  if (el['element-6066-11e4-a52e-4f735466cecf']) {
    return el['element-6066-11e4-a52e-4f735466cecf'];
  }
  // (deprecated) JsonWireProtocol identifier
  // https://github.com/SeleniumHQ/selenium/wiki/JsonWireProtocol#webelement-json-object
  if (el.ELEMENT) {
    return el.ELEMENT;
  }

  return null;
}

// List of known key values to unicode code points
// https://www.w3.org/TR/webdriver/#keyboard-actions
const keyUnicodeMap = {
  /* eslint-disable quote-props */
  'Unidentified': '\uE000',
  'Cancel': '\uE001',
  'Clear': '\uE005',
  'Help': '\uE002',
  'Pause': '\uE00B',
  'Backspace': '\uE003',
  'Return': '\uE006',
  'Enter': '\uE007',
  'Escape': '\uE00C',
  'Alt': '\uE00A',
  'AltLeft': '\uE00A',
  'AltRight': '\uE052',
  'Control': '\uE009',
  'ControlLeft': '\uE009',
  'ControlRight': '\uE051',
  'Meta': '\uE03D',
  'MetaLeft': '\uE03D',
  'MetaRight': '\uE053',
  'Shift': '\uE008',
  'ShiftLeft': '\uE008',
  'ShiftRight': '\uE050',
  'Space': '\uE00D',
  ' ': '\uE00D',
  'Tab': '\uE004',
  'Insert': '\uE016',
  'Delete': '\uE017',
  'End': '\uE010',
  'Home': '\uE011',
  'PageUp': '\uE00E',
  'PageDown': '\uE00F',
  'ArrowDown': '\uE015',
  'ArrowLeft': '\uE012',
  'ArrowRight': '\uE014',
  'ArrowUp': '\uE013',
  'F1': '\uE031',
  'F2': '\uE032',
  'F3': '\uE033',
  'F4': '\uE034',
  'F5': '\uE035',
  'F6': '\uE036',
  'F7': '\uE037',
  'F8': '\uE038',
  'F9': '\uE039',
  'F10': '\uE03A',
  'F11': '\uE03B',
  'F12': '\uE03C',
  'Numpad0': '\uE01A',
  'Numpad1': '\uE01B',
  'Numpad2': '\uE01C',
  'Numpad3': '\uE01D',
  'Numpad4': '\uE01E',
  'Numpad5': '\uE01F',
  'Numpad6': '\uE020',
  'Numpad7': '\uE021',
  'Numpad8': '\uE022',
  'Numpad9': '\uE023',
  'NumpadMultiply': '\uE024',
  'NumpadAdd': '\uE025',
  'NumpadSubtract': '\uE027',
  'NumpadDecimal': '\uE028',
  'NumpadDivide': '\uE029',
  'NumpadEnter': '\uE007',
  'NumpadInsert': '\uE05C', // 'Numpad0' alternate (when NumLock off)
  'NumpadDelete': '\uE05D', // 'NumpadDecimal' alternate (when NumLock off)
  'NumpadEnd': '\uE056', // 'Numpad1' alternate (when NumLock off)
  'NumpadHome': '\uE057', // 'Numpad7' alternate (when NumLock off)
  'NumpadPageDown': '\uE055', // 'Numpad3' alternate (when NumLock off)
  'NumpadPageUp': '\uE054', // 'Numpad9' alternate (when NumLock off)
  'NumpadArrowDown': '\uE05B', // 'Numpad2' alternate (when NumLock off)
  'NumpadArrowLeft': '\uE058', // 'Numpad4' alternate (when NumLock off)
  'NumpadArrowRight': '\uE05A', // 'Numpad6' alternate (when NumLock off)
  'NumpadArrowUp': '\uE059', // 'Numpad8' alternate (when NumLock off)
  'Comma': '\uE026', // ',' alias
  'Digit0': '0', // '0' alias
  'Digit1': '1', // '1' alias
  'Digit2': '2', // '2' alias
  'Digit3': '3', // '3' alias
  'Digit4': '4', // '4' alias
  'Digit5': '5', // '5' alias
  'Digit6': '6', // '6' alias
  'Digit7': '7', // '7' alias
  'Digit8': '8', // '8' alias
  'Digit9': '9', // '9' alias
  'Equal': '\uE019', // '=' alias
  'KeyA': 'a', // 'a' alias
  'KeyB': 'b', // 'b' alias
  'KeyC': 'c', // 'c' alias
  'KeyD': 'd', // 'd' alias
  'KeyE': 'e', // 'e' alias
  'KeyF': 'f', // 'f' alias
  'KeyG': 'g', // 'g' alias
  'KeyH': 'h', // 'h' alias
  'KeyI': 'i', // 'i' alias
  'KeyJ': 'j', // 'j' alias
  'KeyK': 'k', // 'k' alias
  'KeyL': 'l', // 'l' alias
  'KeyM': 'm', // 'm' alias
  'KeyN': 'n', // 'n' alias
  'KeyO': 'o', // 'o' alias
  'KeyP': 'p', // 'p' alias
  'KeyQ': 'q', // 'q' alias
  'KeyR': 'r', // 'r' alias
  'KeyS': 's', // 's' alias
  'KeyT': 't', // 't' alias
  'KeyU': 'u', // 'u' alias
  'KeyV': 'v', // 'v' alias
  'KeyW': 'w', // 'w' alias
  'KeyX': 'x', // 'x' alias
  'KeyY': 'y', // 'y' alias
  'KeyZ': 'z', // 'z' alias
  'Period': '.', // '.' alias
  'Semicolon': '\uE018', // ';' alias
  'Slash': '/', // '/' alias
  'ZenkakuHankaku': '\uE040',
  /* eslint-enable quote-props */
};

function convertKeyToRawKey(key) {
  if (Object.prototype.hasOwnProperty.call(keyUnicodeMap, key)) {
    return keyUnicodeMap[key];
  }
  // Key is raw key when no representative unicode code point for value
  return key;
}

function getNormalizedKey(key) {
  let normalizedKey = getNormalizedKeyAttributeValue(key);
  // Always use "left" modifier keys for non-W3C sessions,
  // as JsonWireProtocol does not support "right" modifier keys
  if (!this.browser.isW3C) {
    normalizedKey = normalizedKey.replace(/^(Alt|Control|Meta|Shift)Right$/, '$1');
  }
  if (key !== normalizedKey) {
    this.debugSection('Input', `Mapping key '${key}' to '${normalizedKey}'`);
  }
  return convertKeyToRawKey(normalizedKey);
}

const unicodeModifierKeys = modifierKeys.map(k => convertKeyToRawKey(k));
function isModifierKey(key) {
  return unicodeModifierKeys.includes(key);
}

function prepareLocateFn(context) {
  if (!context) return this._locate.bind(this);
  return (l) => {
    l = new Locator(l, 'css');
    return this._locate(context, true).then(async (res) => {
      assertElementExists(res, context, 'Context element');
      if (l.react) {
        return res[0].react$$(l.react, l.props || undefined);
      }
      return res[0].$$(l.simplify());
    });
  };
}

function isWebDriver5() {
  return version && version.indexOf('5') === 0;
}

module.exports = WebDriver;
