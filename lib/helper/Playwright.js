const path = require('path');
const fs = require('fs');

const Helper = require('../helper');
const Locator = require('../locator');
const recorder = require('../recorder');
const stringIncludes = require('../assert/include').includes;
const { urlEquals } = require('../assert/equal');
const { equals } = require('../assert/equal');
const { empty } = require('../assert/empty');
const { truth } = require('../assert/truth');
const {
  xpathLocator,
  ucfirst,
  fileExists,
  chunkArray,
  toCamelCase,
  convertCssPropertiesToCamelCase,
  screenshotOutputFolder,
  getNormalizedKeyAttributeValue,
  isModifierKey,
} = require('../utils');
const {
  isColorProperty,
  convertColorToRGBA,
} = require('../colorUtils');
const ElementNotFound = require('./errors/ElementNotFound');
const RemoteBrowserConnectionRefused = require('./errors/RemoteBrowserConnectionRefused');
const Popup = require('./extras/Popup');
const Console = require('./extras/Console');

let playwright;
let perfTiming;
let defaultSelectorEnginesInitialized = false;

const popupStore = new Popup();
const consoleLogStore = new Console();
const availableBrowsers = ['chromium', 'webkit', 'firefox', 'electron'];

const { createValueEngine, createDisabledEngine } = require('./extras/PlaywrightPropEngine');

/**
 * Uses [Playwright](https://github.com/microsoft/playwright) library to run tests inside:
 *
 * * Chromium
 * * Firefox
 * * Webkit (Safari)
 *
 * This helper works with a browser out of the box with no additional tools required to install.
 *
 * Requires `playwright` package version ^1 to be installed:
 *
 * ```
 * npm i playwright@^1 --save
 * ```
 *
 * ## Configuration
 *
 * This helper should be configured in codecept.json or codecept.conf.js
 *
 * * `url`: base url of website to be tested
 * * `browser`: a browser to test on, either: `chromium`, `firefox`, `webkit`, `electron`. Default: chromium.
 * * `show`: (optional, default: false) - show browser window.
 * * `restart`: (optional, default: true) - restart browser between tests.
 * * `disableScreenshots`: (optional, default: false)  - don't save screenshot on failure.
 * * `emulate`: (optional, default: {}) launch browser in device emulation mode.
 * * `fullPageScreenshots` (optional, default: false) - make full page screenshots on failure.
 * * `uniqueScreenshotNames`: (optional, default: false)  - option to prevent screenshot override if you have scenarios with the same name in different suites.
 * * `keepBrowserState`: (optional, default: false) - keep browser state between tests when `restart` is set to false.
 * * `keepCookies`: (optional, default: false) - keep cookies between tests when `restart` is set to false.
 * * `waitForAction`: (optional) how long to wait after click, doubleClick or PressKey actions in ms. Default: 100.
 * * `waitForNavigation`: (optional, default: 'load'). When to consider navigation succeeded. Possible options: `load`, `domcontentloaded`, `networkidle`. Choose one of those options is possible. See [Playwright API](https://github.com/microsoft/playwright/blob/master/docs/api.md#pagewaitfornavigationoptions).
 * * `pressKeyDelay`: (optional, default: '10'). Delay between key presses in ms. Used when calling Playwrights page.type(...) in fillField/appendField
 * * `getPageTimeout` (optional, default: '0') config option to set maximum navigation time in milliseconds.
 * * `waitForTimeout`: (optional) default wait* timeout in ms. Default: 1000.
 * * `basicAuth`: (optional) the basic authentication to pass to base url. Example: {username: 'username', password: 'password'}
 * * `windowSize`: (optional) default window size. Set a dimension like `640x480`.
 * * `userAgent`: (optional) user-agent string.
 * * `manualStart`: (optional, default: false) - do not start browser before a test, start it manually inside a helper with `this.helpers["Playwright"]._startBrowser()`.
 * * `chromium`: (optional) pass additional chromium options
 * * `electron`: (optional) pass additional electron options
 *
 * #### Example #1: Wait for 0 network connections.
 *
 * ```js
 * {
 *    helpers: {
 *      Playwright : {
 *        url: "http://localhost",
 *        restart: false,
 *        waitForNavigation: "networkidle0",
 *        waitForAction: 500
 *      }
 *    }
 * }
 * ```
 *
 * #### Example #2: Wait for DOMContentLoaded event
 *
 * ```js
 * {
 *    helpers: {
 *      Playwright : {
 *        url: "http://localhost",
 *        restart: false,
 *        waitForNavigation: "domcontentloaded",
 *        waitForAction: 500
 *      }
 *    }
 * }
 * ```
 *
 * #### Example #3: Debug in window mode
 *
 * ```js
 * {
 *    helpers: {
 *      Playwright : {
 *        url: "http://localhost",
 *        show: true
 *      }
 *    }
 * }
 * ```
 *
 * #### Example #4: Connect to remote browser by specifying [websocket endpoint](https://playwright.dev/docs/api/class-browsertype#browsertypeconnectparams)
 *
 * ```js
 * {
 *    helpers: {
 *      Playwright: {
 *        url: "http://localhost",
 *        chromium: {
 *          browserWSEndpoint: { wsEndpoint: 'ws://localhost:9222/devtools/browser/c5aa6160-b5bc-4d53-bb49-6ecb36cd2e0a' }
 *        }
 *      }
 *    }
 * }
 * ```
 *
 * #### Example #5: Testing with Chromium extensions
 *
 * [official docs](https://github.com/microsoft/playwright/blob/v0.11.0/docs/api.md#working-with-chrome-extensions)
 *
 * ```js
 * {
 *  helpers: {
 *    Playwright: {
 *      url: "http://localhost",
 *      show: true // headless mode not supported for extensions
 *      chromium: {
 *        userDataDir: '/tmp/playwright-tmp', // necessary to launch the browser in normal mode instead of incognito,
 *        args: [
 *           `--disable-extensions-except=${pathToExtension}`,
 *           `--load-extension=${pathToExtension}`
 *        ]
 *      }
 *    }
 *  }
 * }
 * ```
 *
 * #### Example #6: Launch tests emulating iPhone 6
 *
 *
 *
 * ```js
 * const { devices } = require('playwright');
 *
 * {
 *  helpers: {
 *    Playwright: {
 *      url: "http://localhost",
 *      emulate: devices['iPhone 6'],
 *    }
 *  }
 * }
 * ```
 *
 * Note: When connecting to remote browser `show` and specific `chrome` options (e.g. `headless` or `devtools`) are ignored.
 *
 * ## Access From Helpers
 *
 * Receive Playwright client from a custom helper by accessing `browser` for the Browser object or `page` for the current Page object:
 *
 * ```js
 * const { browser } = this.helpers.Playwright;
 * await browser.pages(); // List of pages in the browser
 *
 * // get current page
 * const { page } = this.helpers.Playwright;
 * await page.url(); // Get the url of the current page
 *
 * const { browserContext } = this.helpers.Playwright;
 * await browserContext.cookies(); // get current browser context
 * ```
 *
 * ## Methods
 */
class Playwright extends Helper {
  constructor(config) {
    super(config);

    playwright = require('playwright');

    // set defaults
    this.isRemoteBrowser = false;
    this.isRunning = false;
    this.isAuthenticated = false;
    this.sessionPages = {};
    this.activeSessionName = '';
    this.isElectron = false;
    this.electronSessions = [];

    // override defaults with config
    this._setConfig(config);
  }

  _validateConfig(config) {
    const defaults = {
      // options to emulate context
      emulate: {},

      browser: 'chromium',
      waitForAction: 100,
      waitForTimeout: 1000,
      pressKeyDelay: 10,
      fullPageScreenshots: false,
      disableScreenshots: false,
      uniqueScreenshotNames: false,
      manualStart: false,
      getPageTimeout: 0,
      waitForNavigation: 'load',
      restart: false,
      keepCookies: false,
      keepBrowserState: false,
      show: false,
      defaultPopupAction: 'accept',
      ignoreHTTPSErrors: false, // Adding it here o that context can be set up to ignore the SSL errors
    };

    config = Object.assign(defaults, config);

    if (availableBrowsers.indexOf(config.browser) < 0) {
      throw new Error(`Invalid config. Can't use browser "${config.browser}". Accepted values: ${availableBrowsers.join(', ')}`);
    }

    return config;
  }

  _getOptionsForBrowser(config) {
    return config[config.browser] ? {
      ...config[config.browser],
      wsEndpoint: config[config.browser].browserWSEndpoint,
    } : {};
  }

  _setConfig(config) {
    this.options = this._validateConfig(config);
    this.playwrightOptions = {
      headless: !this.options.show,
      ...this._getOptionsForBrowser(config),
    };
    this.isRemoteBrowser = !!this.playwrightOptions.browserWSEndpoint;
    this.isElectron = this.options.browser === 'electron';
    this.userDataDir = this.playwrightOptions.userDataDir;
    popupStore.defaultAction = this.options.defaultPopupAction;
  }

  static _config() {
    return [
      { name: 'url', message: 'Base url of site to be tested', default: 'http://localhost' },
      {
        name: 'show', message: 'Show browser window', default: true, type: 'confirm',
      },
      {
        name: 'browser',
        message: 'Browser in which testing will be performed. Possible options: chromium, firefox, webkit or electron',
        default: 'chromium',
      },
    ];
  }

  static _checkRequirements() {
    try {
      require('playwright');
    } catch (e) {
      return ['playwright@^1'];
    }
  }

  async _init() {
    // register an internal selector engine for reading value property of elements in a selector
    if (defaultSelectorEnginesInitialized) return;
    defaultSelectorEnginesInitialized = true;
    try {
      await playwright.selectors.register('__value', createValueEngine);
      await playwright.selectors.register('__disabled', createDisabledEngine);
    } catch (e) {
      console.warn(e);
    }
  }

  _beforeSuite() {
    if (!this.options.restart && !this.options.manualStart && !this.isRunning) {
      this.debugSection('Session', 'Starting singleton browser session');
      return this._startBrowser();
    }
  }

  async _before() {
    recorder.retry({
      retries: 5,
      when: err => {
        if (!err || typeof (err.message) !== 'string') {
          return false;
        }
        // ignore context errors
        return err.message.includes('context');
      },
    });
    if (this.options.restart && !this.options.manualStart) return this._startBrowser();
    if (!this.isRunning && !this.options.manualStart) return this._startBrowser();
    return this.browser;
  }

  async _after() {
    if (!this.isRunning) return;

    if (this.isElectron) {
      this.browser.close();
      this.electronSessions.forEach(session => session.close());
      return;
    }

    // close other sessions
    try {
      const contexts = await this.browser.contexts();
      contexts.shift();

      await Promise.all(contexts.map(c => c.close()));
    } catch (e) {
      console.log(e);
    }

    if (this.options.restart) {
      this.isRunning = false;
      return this._stopBrowser();
    }

    // ensure current page is in default context
    if (this.page) {
      const existingPages = await this.browserContext.pages();
      await this._setPage(existingPages[0]);
    }

    if (this.options.keepBrowserState) return;

    if (!this.options.keepCookies) {
      this.debugSection('Session', 'cleaning cookies and localStorage');
      await this.clearCookie();
    }
    const currentUrl = await this.grabCurrentUrl();

    if (currentUrl.startsWith('http')) {
      await this.executeScript('localStorage.clear();').catch((err) => {
        if (!(err.message.indexOf("Storage is disabled inside 'data:' URLs.") > -1)) throw err;
      });
      await this.executeScript('sessionStorage.clear();').catch((err) => {
        if (!(err.message.indexOf("Storage is disabled inside 'data:' URLs.") > -1)) throw err;
      });
    }
    // await this.closeOtherTabs();
    return this.browser;
  }

  _afterSuite() {
  }

  _finishTest() {
    if (!this.options.restart && this.isRunning) return this._stopBrowser();
  }

  _session() {
    const defaultContext = this.browserContext;
    return {
      start: async (sessionName = '', config) => {
        this.debugSection('New Context', config ? JSON.stringify(config) : 'opened');
        this.activeSessionName = sessionName;

        let browserContext;
        let page;
        if (this.isElectron) {
          const browser = await playwright._electron.launch(this.playwrightOptions);
          this.electronSessions.push(browser);
          browserContext = browser.context();
          page = await browser.firstWindow();
        } else {
          browserContext = await this.browser.newContext(config);
          page = await browserContext.newPage();
        }

        targetCreatedHandler.call(this, page);
        this._setPage(page);
        // Create a new page inside context.
        return browserContext;
      },
      stop: async () => {
        // is closed by _after
      },
      loadVars: async (context) => {
        this.browserContext = context;
        const existingPages = await context.pages();
        this.sessionPages[this.activeSessionName] = existingPages[0];
        return this._setPage(this.sessionPages[this.activeSessionName]);
      },
      restoreVars: async (session) => {
        this.withinLocator = null;
        this.browserContext = defaultContext;

        if (!session) {
          this.activeSessionName = '';
        } else {
          this.activeSessionName = session;
        }
        const existingPages = await this.browserContext.pages();
        await this._setPage(existingPages[0]);

        return this._waitForAction();
      },
    };
  }

  /**
  * Use Playwright API inside a test.
  *
  * First argument is a description of an action.
  * Second argument is async function that gets this helper as parameter.
  *
  * { [`page`](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-page), [`context`](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-context) [`browser`](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-browser) } objects from Playwright API are available.
  *
  * ```js
  * I.usePlaywrightTo('emulate offline mode', async ({ context }) {
  *   await context.setOffline(true);
  * });
  * ```
  *
  * @param {string} description used to show in logs.
  * @param {function} fn async functuion that executed with Playwright helper as argument
  */
  usePlaywrightTo(description, fn) {
    return this._useTo(...arguments);
  }

  /**
   * Set the automatic popup response to Accept.
   * This must be set before a popup is triggered.
   *
   * ```js
   * I.amAcceptingPopups();
   * I.click('#triggerPopup');
   * I.acceptPopup();
   * ```
   */
  amAcceptingPopups() {
    popupStore.actionType = 'accept';
  }

  /**
   * Accepts the active JavaScript native popup window, as created by window.alert|window.confirm|window.prompt.
   * Don't confuse popups with modal windows, as created by [various
   * libraries](http://jster.net/category/windows-modals-popups).
   */
  acceptPopup() {
    popupStore.assertPopupActionType('accept');
  }

  /**
   * Set the automatic popup response to Cancel/Dismiss.
   * This must be set before a popup is triggered.
   *
   * ```js
   * I.amCancellingPopups();
   * I.click('#triggerPopup');
   * I.cancelPopup();
   * ```
   */
  amCancellingPopups() {
    popupStore.actionType = 'cancel';
  }

  /**
   * Dismisses the active JavaScript popup, as created by window.alert|window.confirm|window.prompt.
   */
  cancelPopup() {
    popupStore.assertPopupActionType('cancel');
  }

  /**
   * {{> seeInPopup }}
   */
  async seeInPopup(text) {
    popupStore.assertPopupVisible();
    const popupText = await popupStore.popup.message();
    stringIncludes('text in popup').assert(text, popupText);
  }

  /**
   * Set current page
   * @param {object} page page to set
   */
  async _setPage(page) {
    page = await page;
    this._addPopupListener(page);
    this.page = page;
    if (!page) return;
    page.setDefaultNavigationTimeout(this.options.getPageTimeout);
    this.context = await this.page;
    this.contextLocator = null;
    if (this.config.browser === 'chrome') {
      await page.bringToFront();
    }
  }

  /**
   * Add the 'dialog' event listener to a page
   * @page {playwright.Page}
   *
   * The popup listener handles the dialog with the predefined action when it appears on the page.
   * It also saves a reference to the object which is used in seeInPopup.
   */
  _addPopupListener(page) {
    if (!page) {
      return;
    }
    page.on('dialog', async (dialog) => {
      popupStore.popup = dialog;
      const action = popupStore.actionType || this.options.defaultPopupAction;
      await this._waitForAction();

      switch (action) {
        case 'accept':
          return dialog.accept();

        case 'cancel':
          return dialog.dismiss();

        default: {
          throw new Error('Unknown popup action type. Only "accept" or "cancel" are accepted');
        }
      }
    });
  }

  /**
   * Gets page URL including hash.
   */
  async _getPageUrl() {
    return this.executeScript(() => window.location.href);
  }

  /**
   * Grab the text within the popup. If no popup is visible then it will return null
   *
   * ```js
   * await I.grabPopupText();
   * ```
   * @return {Promise<string | null>}
   */
  async grabPopupText() {
    if (popupStore.popup) {
      return popupStore.popup.message();
    }
    return null;
  }

  async _startBrowser() {
    if (this.isElectron) {
      this.browser = await playwright._electron.launch(this.playwrightOptions);
    } else if (this.isRemoteBrowser) {
      try {
        this.browser = await playwright[this.options.browser].connect(this.playwrightOptions.browserWSEndpoint);
      } catch (err) {
        if (err.toString().indexOf('ECONNREFUSED')) {
          throw new RemoteBrowserConnectionRefused(err);
        }
        throw err;
      }
    } else if (this.userDataDir) {
      this.browser = await playwright[this.options.browser].launchPersistentContext(this.userDataDir, this.playwrightOptions);
    } else {
      this.browser = await playwright[this.options.browser].launch(this.playwrightOptions);
    }

    // works only for Chromium
    this.browser.on('targetchanged', (target) => {
      this.debugSection('Url', target.url());
    });

    if (this.isElectron) {
      this.browserContext = this.browser.context();
    } else if (this.userDataDir) {
      this.browserContext = this.browser;
    } else {
      this.browserContext = await this.browser.newContext({ ignoreHTTPSErrors: this.options.ignoreHTTPSErrors, acceptDownloads: true, ...this.options.emulate });// Adding the HTTPSError ignore in the context so that we can ignore those errors
    }

    let mainPage;
    if (this.isElectron) {
      mainPage = await this.browser.firstWindow();
    } else {
      const existingPages = await this.browserContext.pages();
      mainPage = existingPages[0] || await this.browserContext.newPage();
    }
    targetCreatedHandler.call(this, mainPage);

    await this._setPage(mainPage);
    await this.closeOtherTabs();

    this.isRunning = true;
  }

  _getType() {
    return this.browser._type;
  }

  async _stopBrowser() {
    this.withinLocator = null;
    this._setPage(null);
    this.context = null;
    popupStore.clear();

    await this.browser.close();
  }

  async _evaluateHandeInContext(...args) {
    const context = await this._getContext();
    return context.evaluateHandle(...args);
  }

  async _withinBegin(locator) {
    if (this.withinLocator) {
      throw new Error('Can\'t start within block inside another within block');
    }

    const frame = isFrameLocator(locator);

    if (frame) {
      if (Array.isArray(frame)) {
        await this.switchTo(null);
        return frame.reduce((p, frameLocator) => p.then(() => this.switchTo(frameLocator)), Promise.resolve());
      }
      await this.switchTo(locator);
      this.withinLocator = new Locator(locator);
      return;
    }

    const els = await this._locate(locator);
    assertElementExists(els, locator);
    this.context = els[0];
    this.contextLocator = locator;

    this.withinLocator = new Locator(locator);
  }

  async _withinEnd() {
    this.withinLocator = null;
    this.context = await this.page;
    this.contextLocator = null;
  }

  _extractDataFromPerformanceTiming(timing, ...dataNames) {
    const navigationStart = timing.navigationStart;

    const extractedData = {};
    dataNames.forEach((name) => {
      extractedData[name] = timing[name] - navigationStart;
    });

    return extractedData;
  }

  /**
   * {{> amOnPage }}
   */
  async amOnPage(url) {
    if (this.isElectron) {
      throw new Error('Cannot open pages inside an Electron container');
    }
    if (!(/^\w+\:\/\//.test(url))) {
      url = this.options.url + url;
    }

    if (this.config.basicAuth && (this.isAuthenticated !== true)) {
      if (url.includes(this.options.url)) {
        await this.browserContext.setHTTPCredentials(this.config.basicAuth);
        this.isAuthenticated = true;
      }
    }

    await this.page.goto(url, { waitUntil: this.options.waitForNavigation });

    const performanceTiming = JSON.parse(await this.page.evaluate(() => JSON.stringify(window.performance.timing)));

    perfTiming = this._extractDataFromPerformanceTiming(
      performanceTiming,
      'responseEnd',
      'domInteractive',
      'domContentLoadedEventEnd',
      'loadEventEnd',
    );

    return this._waitForAction();
  }

  /**
   * {{> resizeWindow }}
   *
   * Unlike other drivers Playwright changes the size of a viewport, not the window!
   * Playwright does not control the window of a browser so it can't adjust its real size.
   * It also can't maximize a window.
   *
   * Update configuration to change real window size on start:
   *
   * ```js
   * // inside codecept.conf.js
   * // @codeceptjs/configure package must be installed
   * { setWindowSize } = require('@codeceptjs/configure');
   * ````
   */
  async resizeWindow(width, height) {
    if (width === 'maximize') {
      throw new Error('Playwright can\'t control windows, so it can\'t maximize it');
    }

    await this.page.setViewportSize({ width, height });
    return this._waitForAction();
  }

  /**
   * Set headers for all next requests
   *
   * ```js
   * I.haveRequestHeaders({
   *    'X-Sent-By': 'CodeceptJS',
   * });
   * ```
   *
   * @param {object} customHeaders headers to set
   */
  async haveRequestHeaders(customHeaders) {
    if (!customHeaders) {
      throw new Error('Cannot send empty headers.');
    }
    return this.page.setExtraHTTPHeaders(customHeaders);
  }

  /**
   * {{> moveCursorTo }}
   *
   */
  async moveCursorTo(locator, offsetX = 0, offsetY = 0) {
    const els = await this._locate(locator);
    assertElementExists(els);

    // Use manual mouse.move instead of .hover() so the offset can be added to the coordinates
    const { x, y } = await clickablePoint(els[0]);
    await this.page.mouse.move(x + offsetX, y + offsetY);
    return this._waitForAction();
  }

  /**
   * {{> dragAndDrop }}
   */
  async dragAndDrop(srcElement, destElement) {
    return proceedDragAndDrop.call(this, srcElement, destElement);
  }

  /**
   * {{> refreshPage }}
   */
  async refreshPage() {
    return this.page.reload({ timeout: this.options.getPageTimeout, waitUntil: this.options.waitForNavigation });
  }

  /**
   * {{> scrollPageToTop }}
   */
  scrollPageToTop() {
    return this.executeScript(() => {
      window.scrollTo(0, 0);
    });
  }

  /**
   * {{> scrollPageToBottom }}
   */
  scrollPageToBottom() {
    return this.executeScript(() => {
      const body = document.body;
      const html = document.documentElement;
      window.scrollTo(0, Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight,
      ));
    });
  }

  /**
   * {{> scrollTo }}
   */
  async scrollTo(locator, offsetX = 0, offsetY = 0) {
    if (typeof locator === 'number' && typeof offsetX === 'number') {
      offsetY = offsetX;
      offsetX = locator;
      locator = null;
    }

    if (locator) {
      const els = await this._locate(locator);
      assertElementExists(els, locator, 'Element');
      await els[0].scrollIntoViewIfNeeded();
      const elementCoordinates = await clickablePoint(els[0]);
      await this.executeScript((offsetX, offsetY) => window.scrollBy(offsetX, offsetY), { offsetX: elementCoordinates.x + offsetX, offsetY: elementCoordinates.y + offsetY });
    } else {
      await this.executeScript(({ offsetX, offsetY }) => window.scrollTo(offsetX, offsetY), { offsetX, offsetY });
    }
    return this._waitForAction();
  }

  /**
   * {{> seeInTitle }}
   */
  async seeInTitle(text) {
    const title = await this.page.title();
    stringIncludes('web page title').assert(text, title);
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
   * {{> seeTitleEquals }}
   */
  async seeTitleEquals(text) {
    const title = await this.page.title();
    return equals('web page title').assert(title, text);
  }

  /**
   * {{> dontSeeInTitle }}
   */
  async dontSeeInTitle(text) {
    const title = await this.page.title();
    stringIncludes('web page title').negate(text, title);
  }

  /**
   * {{> grabTitle }}
   */
  async grabTitle() {
    return this.page.title();
  }

  /**
   * Get elements by different locator types, including strict locator
   * Should be used in custom helpers:
   *
   * ```js
   * const elements = await this.helpers['Playwright']._locate({name: 'password'});
   * ```
   *
   *
   */
  async _locate(locator) {
    const context = await this.context || await this._getContext();
    return findElements(context, locator);
  }

  /**
   * Find a checkbox by providing human readable text:
   * NOTE: Assumes the checkable element exists
   *
   * ```js
   * this.helpers['Playwright']._locateCheckable('I agree with terms and conditions').then // ...
   * ```
   */
  async _locateCheckable(locator, providedContext = null) {
    const context = providedContext || await this._getContext();
    const els = await findCheckable.call(this, locator, context);
    assertElementExists(els[0], locator, 'Checkbox or radio');
    return els[0];
  }

  /**
   * Find a clickable element by providing human readable text:
   *
   * ```js
   * this.helpers['Playwright']._locateClickable('Next page').then // ...
   * ```
   */
  async _locateClickable(locator) {
    const context = await this._getContext();
    return findClickable.call(this, context, locator);
  }

  /**
   * Find field elements by providing human readable text:
   *
   * ```js
   * this.helpers['Playwright']._locateFields('Your email').then // ...
   * ```
   */
  async _locateFields(locator) {
    return findFields.call(this, locator);
  }

  /**
   * Switch focus to a particular tab by its number. It waits tabs loading and then switch tab
   *
   * ```js
   * I.switchToNextTab();
   * I.switchToNextTab(2);
   * ```
   *
   * @param {number} [num=1]
   */
  async switchToNextTab(num = 1) {
    if (this.isElectron) {
      throw new Error('Cannot switch tabs inside an Electron container');
    }
    const pages = await this.browserContext.pages();

    const index = pages.indexOf(this.page);
    this.withinLocator = null;
    const page = pages[index + num];

    if (!page) {
      throw new Error(`There is no ability to switch to next tab with offset ${num}`);
    }
    await this._setPage(page);
    return this._waitForAction();
  }

  /**
   * Switch focus to a particular tab by its number. It waits tabs loading and then switch tab
   *
   * ```js
   * I.switchToPreviousTab();
   * I.switchToPreviousTab(2);
   * ```
   * @param {number} [num=1]
   */
  async switchToPreviousTab(num = 1) {
    if (this.isElectron) {
      throw new Error('Cannot switch tabs inside an Electron container');
    }
    const pages = await this.browserContext.pages();
    const index = pages.indexOf(this.page);
    this.withinLocator = null;
    const page = pages[index - num];

    if (!page) {
      throw new Error(`There is no ability to switch to previous tab with offset ${num}`);
    }

    await this._setPage(page);
    return this._waitForAction();
  }

  /**
   * Close current tab and switches to previous.
   *
   * ```js
   * I.closeCurrentTab();
   * ```
   */
  async closeCurrentTab() {
    if (this.isElectron) {
      throw new Error('Cannot close current tab inside an Electron container');
    }
    const oldPage = this.page;
    await this.switchToPreviousTab();
    await oldPage.close();
    return this._waitForAction();
  }

  /**
   * Close all tabs except for the current one.
   *
   * ```js
   * I.closeOtherTabs();
   * ```
   */
  async closeOtherTabs() {
    const pages = await this.browserContext.pages();
    const otherPages = pages.filter(page => page !== this.page);
    if (otherPages.length) {
      this.debug(`Closing ${otherPages.length} tabs`);
      return Promise.all(otherPages.map(p => p.close()));
    }
    return Promise.resolve();
  }

  /**
   * Open new tab and automatically switched to new tab
   *
   * ```js
   * I.openNewTab();
   * ```
   *
   * You can pass in [page options](https://github.com/microsoft/playwright/blob/master/docs/api.md#browsernewpageoptions) to emulate device on this page
   *
   * ```js
   * // enable mobile
   * I.openNewTab({ isMobile: true });
   * ```
   */
  async openNewTab(options) {
    if (this.isElectron) {
      throw new Error('Cannot open new tabs inside an Electron container');
    }
    await this._setPage(await this.browserContext.newPage(options));
    return this._waitForAction();
  }

  /**
   * {{> grabNumberOfOpenTabs }}
   */
  async grabNumberOfOpenTabs() {
    const pages = await this.browserContext.pages();
    return pages.length;
  }

  /**
   * {{> seeElement }}
   *
   */
  async seeElement(locator) {
    let els = await this._locate(locator);
    els = await Promise.all(els.map(el => el.isVisible()));
    return empty('visible elements').negate(els.filter(v => v).fill('ELEMENT'));
  }

  /**
   * {{> dontSeeElement }}
   *
   */
  async dontSeeElement(locator) {
    let els = await this._locate(locator);
    els = await Promise.all(els.map(el => el.isVisible()));
    return empty('visible elements').assert(els.filter(v => v).fill('ELEMENT'));
  }

  /**
   * {{> seeElementInDOM }}
   */
  async seeElementInDOM(locator) {
    const els = await this._locate(locator);
    return empty('elements on page').negate(els.filter(v => v).fill('ELEMENT'));
  }

  /**
   * {{> dontSeeElementInDOM }}
   */
  async dontSeeElementInDOM(locator) {
    const els = await this._locate(locator);
    return empty('elements on a page').assert(els.filter(v => v).fill('ELEMENT'));
  }

  /**
   * Handles a file download.Aa file name is required to save the file on disk.
   * Files are saved to "output" directory.
   *
   * Should be used with [FileSystem helper](https://codecept.io/helpers/FileSystem) to check that file were downloaded correctly.
   *
   * ```js
   * I.handleDownloads('downloads/avatar.jpg');
   * I.click('Download Avatar');
   * I.amInPath('output/downloads');
   * I.waitForFile('downloads/avatar.jpg', 5);
   *
   * ```
   *
   * @param {string} [fileName] set filename for downloaded file
   */
  async handleDownloads(fileName = 'downloads') {
    this.page.waitForEvent('download').then(async (download) => {
      const filePath = await download.path();
      const downloadPath = path.join(global.output_dir, fileName || path.basename(filePath));
      if (!fs.existsSync(path.dirname(downloadPath))) {
        fs.mkdirSync(path.dirname(downloadPath), '0777');
      }
      fs.copyFileSync(filePath, downloadPath);
      this.debug('Download completed');
      this.debugSection('Downloaded From', await download.url());
      this.debugSection('Downloaded To', downloadPath);
    });
  }

  /**
   * {{> click }}
   *
   *
   */
  async click(locator, context = null) {
    return proceedClick.call(this, locator, context);
  }

  /**
   * Clicks link and waits for navigation (deprecated)
   */
  async clickLink(locator, context = null) {
    console.log('clickLink deprecated: Playwright automatically waits for navigation to happen.');
    console.log('Replace I.clickLink with I.click');
    return this.click(locator, context);
  }

  /**
   * {{> forceClick }}
   */
  async forceClick(locator, context = null) {
    return proceedClick.call(this, locator, context, { force: true });
  }

  /**
   * {{> doubleClick }}
   *
   *
   */
  async doubleClick(locator, context = null) {
    return proceedClick.call(this, locator, context, { clickCount: 2 });
  }

  /**
   * {{> rightClick }}
   *
   *
   */
  async rightClick(locator, context = null) {
    return proceedClick.call(this, locator, context, { button: 'right' });
  }

  /**
   * {{> checkOption }}
   */
  async checkOption(field, context = null) {
    const elm = await this._locateCheckable(field, context);
    const curentlyChecked = await elm.getProperty('checked')
      .then(checkedProperty => checkedProperty.jsonValue());
    // Only check if NOT currently checked
    if (!curentlyChecked) {
      await elm.click();
      return this._waitForAction();
    }
  }

  /**
   * {{> uncheckOption }}
   */
  async uncheckOption(field, context = null) {
    const elm = await this._locateCheckable(field, context);
    const curentlyChecked = await elm.getProperty('checked')
      .then(checkedProperty => checkedProperty.jsonValue());
    // Only uncheck if currently checked
    if (curentlyChecked) {
      await elm.click();
      return this._waitForAction();
    }
  }

  /**
   * {{> seeCheckboxIsChecked }}
   */
  async seeCheckboxIsChecked(field) {
    return proceedIsChecked.call(this, 'assert', field);
  }

  /**
   * {{> dontSeeCheckboxIsChecked }}
   */
  async dontSeeCheckboxIsChecked(field) {
    return proceedIsChecked.call(this, 'negate', field);
  }

  /**
   * {{> pressKeyDown }}
   */
  async pressKeyDown(key) {
    key = getNormalizedKey.call(this, key);
    await this.page.keyboard.down(key);
    return this._waitForAction();
  }

  /**
   * {{> pressKeyUp }}
   */
  async pressKeyUp(key) {
    key = getNormalizedKey.call(this, key);
    await this.page.keyboard.up(key);
    return this._waitForAction();
  }

  /**
   * {{> pressKeyWithKeyNormalization }}
   *
   * _Note:_ Shortcuts like `'Meta'` + `'A'` do not work on macOS ([GoogleChrome/Puppeteer#1313](https://github.com/GoogleChrome/puppeteer/issues/1313)).
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
      await this.page.keyboard.down(modifier);
    }
    await this.page.keyboard.press(key);
    for (const modifier of modifiers) {
      await this.page.keyboard.up(modifier);
    }
    return this._waitForAction();
  }

  /**
   * {{> type }}
   */
  async type(keys, delay = null) {
    if (!Array.isArray(keys)) {
      keys = keys.split('');
    }

    for (const key of keys) {
      await this.page.keyboard.press(key);
      if (delay) await this.wait(delay / 1000);
    }
  }

  /**
   * {{> fillField }}
   *
   */
  async fillField(field, value) {
    const els = await findFields.call(this, field);
    assertElementExists(els, field, 'Field');
    const el = els[0];
    const tag = await el.getProperty('tagName').then(el => el.jsonValue());
    const editable = await el.getProperty('contenteditable').then(el => el.jsonValue());
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      await this._evaluateHandeInContext(el => el.value = '', el);
    } else if (editable) {
      await this._evaluateHandeInContext(el => el.innerHTML = '', el);
    }
    await el.type(value.toString(), { delay: this.options.pressKeyDelay });
    return this._waitForAction();
  }

  /**
   * {{> clearField }}
   */
  async clearField(field) {
    return this.fillField(field, '');
  }

  /**
   * {{> appendField }}
   *
   *
   */
  async appendField(field, value) {
    const els = await findFields.call(this, field);
    assertElementExists(els, field, 'Field');
    await els[0].press('End');
    await els[0].type(value, { delay: this.options.pressKeyDelay });
    return this._waitForAction();
  }

  /**
   * {{> seeInField }}
   */
  async seeInField(field, value) {
    return proceedSeeInField.call(this, 'assert', field, value);
  }

  /**
   * {{> dontSeeInField }}
   */
  async dontSeeInField(field, value) {
    return proceedSeeInField.call(this, 'negate', field, value);
  }

  /**
   * {{> attachFile }}
   *
   */
  async attachFile(locator, pathToFile) {
    const file = path.join(global.codecept_dir, pathToFile);

    if (!fileExists(file)) {
      throw new Error(`File at ${file} can not be found on local system`);
    }
    const els = await findFields.call(this, locator);
    assertElementExists(els, 'Field');
    await els[0].setInputFiles(file);
    return this._waitForAction();
  }

  /**
   * {{> selectOption }}
   */
  async selectOption(select, option) {
    const els = await findFields.call(this, select);
    assertElementExists(els, select, 'Selectable field');
    const el = els[0];
    if (await el.getProperty('tagName').then(t => t.jsonValue()) !== 'SELECT') {
      throw new Error('Element is not <select>');
    }
    if (!Array.isArray(option)) option = [option];

    for (const key in option) {
      const opt = xpathLocator.literal(option[key]);
      let optEl = await findElements.call(this, el, { xpath: Locator.select.byVisibleText(opt) });
      if (optEl.length) {
        this._evaluateHandeInContext(el => el.selected = true, optEl[0]);
        continue;
      }
      optEl = await findElements.call(this, el, { xpath: Locator.select.byValue(opt) });
      if (optEl.length) {
        this._evaluateHandeInContext(el => el.selected = true, optEl[0]);
      }
    }
    await this._evaluateHandeInContext((element) => {
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, el);

    return this._waitForAction();
  }

  /**
   * {{> grabNumberOfVisibleElements }}
   *
   */
  async grabNumberOfVisibleElements(locator) {
    let els = await this._locate(locator);
    els = await Promise.all(els.map(el => el.isVisible()));
    return els.filter(v => v).length;
  }

  /**
   * {{> seeInCurrentUrl }}
   */
  async seeInCurrentUrl(url) {
    stringIncludes('url').assert(url, await this._getPageUrl());
  }

  /**
   * {{> dontSeeInCurrentUrl }}
   */
  async dontSeeInCurrentUrl(url) {
    stringIncludes('url').negate(url, await this._getPageUrl());
  }

  /**
   * {{> seeCurrentUrlEquals }}
   */
  async seeCurrentUrlEquals(url) {
    urlEquals(this.options.url).assert(url, await this._getPageUrl());
  }

  /**
   * {{> dontSeeCurrentUrlEquals }}
   */
  async dontSeeCurrentUrlEquals(url) {
    urlEquals(this.options.url).negate(url, await this._getPageUrl());
  }

  /**
   * {{> see }}
   *
   *
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
   *
   */
  async dontSee(text, context = null) {
    return proceedSee.call(this, 'negate', text, context);
  }

  /**
   * {{> grabSource }}
   */
  async grabSource() {
    return this.page.content();
  }

  /**
   * Get JS log from browser.
   *
   * ```js
   * let logs = await I.grabBrowserLogs();
   * console.log(JSON.stringify(logs))
   * ```
   * @return {Promise<any[]>}
   */
  async grabBrowserLogs() {
    const logs = consoleLogStore.entries;
    consoleLogStore.clear();
    return logs;
  }

  /**
   * {{> grabCurrentUrl }}
   */
  async grabCurrentUrl() {
    return this._getPageUrl();
  }

  /**
   * {{> seeInSource }}
   */
  async seeInSource(text) {
    const source = await this.page.content();
    stringIncludes('HTML source of a page').assert(text, source);
  }

  /**
   * {{> dontSeeInSource }}
   */
  async dontSeeInSource(text) {
    const source = await this.page.content();
    stringIncludes('HTML source of a page').negate(text, source);
  }

  /**
   * {{> seeNumberOfElements }}
   *
   *
   */
  async seeNumberOfElements(locator, num) {
    const elements = await this._locate(locator);
    return equals(`expected number of elements (${locator}) is ${num}, but found ${elements.length}`).assert(elements.length, num);
  }

  /**
   * {{> seeNumberOfVisibleElements }}
   *
   *
   */
  async seeNumberOfVisibleElements(locator, num) {
    const res = await this.grabNumberOfVisibleElements(locator);
    return equals(`expected number of visible elements (${locator}) is ${num}, but found ${res}`).assert(res, num);
  }

  /**
   * {{> setCookie }}
   */
  async setCookie(cookie) {
    if (Array.isArray(cookie)) {
      return this.browserContext.addCookies(cookie);
    }
    return this.browserContext.addCookies([cookie]);
  }

  /**
   * {{> seeCookie }}
   *
   */
  async seeCookie(name) {
    const cookies = await this.browserContext.cookies();
    empty(`cookie ${name} to be set`).negate(cookies.filter(c => c.name === name));
  }

  /**
   * {{> dontSeeCookie }}
   */
  async dontSeeCookie(name) {
    const cookies = await this.browserContext.cookies();
    empty(`cookie ${name} to be set`).assert(cookies.filter(c => c.name === name));
  }

  /**
   * {{> grabCookie }}
   *
   * Returns cookie in JSON format. If name not passed returns all cookies for this domain.
   */
  async grabCookie(name) {
    const cookies = await this.browserContext.cookies();
    if (!name) return cookies;
    const cookie = cookies.filter(c => c.name === name);
    if (cookie[0]) return cookie[0];
  }

  /**
   * {{> clearCookie }}
   */
  async clearCookie() {
    // Playwright currently doesn't support to delete a certain cookie
    // https://github.com/microsoft/playwright/blob/master/docs/api.md#class-browsercontext
    return this.browserContext.clearCookies();
  }

  /**
   * Executes a script on the page:
   *
   * ```js
   * I.executeScript(() => window.alert('Hello world'));
   * ```
   *
   * Additional parameters of the function can be passed as an object argument:
   *
   * ```js
   * I.executeScript(({x, y}) => x + y, {x, y});
   * ```
   * You can pass only one parameter into a function
   * but you can pass in array or object.
   *
   * ```js
   * I.executeScript(([x, y]) => x + y, [x, y]);
   * ```
   * If a function returns a Promise it will wait for its resolution.
   *
   * @param {string|function} fn function to be executed in browser context.
   * @param {any} [arg] optional argument to pass to the function
   * @return {Promise<any>}
   */
  async executeScript(fn, arg) {
    let context = this.page;
    if (this.context && this.context.constructor.name === 'Frame') {
      context = this.context; // switching to iframe context
    }
    return context.evaluate.apply(context, [fn, arg]);
  }

  /**
   * Grab Locator if called within Context
   *
   * @param {*} locator
   */
  _contextLocator(locator) {
    locator = buildLocatorString(new Locator(locator, 'css'));

    if (this.contextLocator) {
      const contextLocator = buildLocatorString(new Locator(this.contextLocator, 'css'));
      locator = `${contextLocator} >> ${locator}`;
    }

    return locator;
  }

  /**
   * {{> grabTextFrom }}
   *
   */
  async grabTextFrom(locator) {
    locator = this._contextLocator(locator);
    const text = await this.page.textContent(locator);
    assertElementExists(text, locator);
    this.debugSection('Text', text);
    return text;
  }

  /**
   * {{> grabTextFromAll }}
   *
   */
  async grabTextFromAll(locator) {
    const els = await this._locate(locator);
    const texts = [];
    for (const el of els) {
      texts.push(await (await el.getProperty('innerText')).jsonValue());
    }
    this.debug(`Matched ${els.length} elements`);
    return texts;
  }

  /**
   * {{> grabValueFrom }}
   */
  async grabValueFrom(locator) {
    const values = await this.grabValueFromAll(locator);
    assertElementExists(values, locator);
    this.debugSection('Value', values[0]);
    return values[0];
  }

  /**
   * {{> grabValueFromAll }}
   */
  async grabValueFromAll(locator) {
    const els = await findFields.call(this, locator);
    this.debug(`Matched ${els.length} elements`);
    return Promise.all(els.map(el => el.getProperty('value').then(t => t.jsonValue())));
  }

  /**
   * {{> grabHTMLFrom }}
   */
  async grabHTMLFrom(locator) {
    const html = await this.grabHTMLFromAll(locator);
    assertElementExists(html, locator);
    this.debugSection('HTML', html[0]);
    return html[0];
  }

  /**
   * {{> grabHTMLFromAll }}
   */
  async grabHTMLFromAll(locator) {
    const els = await this._locate(locator);
    this.debug(`Matched ${els.length} elements`);
    return Promise.all(els.map(el => el.$eval('xpath=.', element => element.innerHTML, el)));
  }

  /**
   * {{> grabCssPropertyFrom }}
   *
   */
  async grabCssPropertyFrom(locator, cssProperty) {
    const cssValues = await this.grabCssPropertyFromAll(locator, cssProperty);
    assertElementExists(cssValues, locator);
    this.debugSection('CSS', cssValues[0]);
    return cssValues[0];
  }

  /**
   * {{> grabCssPropertyFromAll }}
   *
   */
  async grabCssPropertyFromAll(locator, cssProperty) {
    const els = await this._locate(locator);
    this.debug(`Matched ${els.length} elements`);
    const cssValues = await Promise.all(els.map(el => el.$eval('xpath=.', (el, cssProperty) => getComputedStyle(el).getPropertyValue(cssProperty), cssProperty)));

    return cssValues;
  }

  /**
   * {{> seeCssPropertiesOnElements }}
   *
   */
  async seeCssPropertiesOnElements(locator, cssProperties) {
    const res = await this._locate(locator);
    assertElementExists(res, locator);

    const cssPropertiesCamelCase = convertCssPropertiesToCamelCase(cssProperties);
    const elemAmount = res.length;
    const commands = [];
    res.forEach((el) => {
      Object.keys(cssPropertiesCamelCase).forEach((prop) => {
        commands.push(el.$eval('xpath=.', (el) => {
          const style = window.getComputedStyle ? getComputedStyle(el) : el.currentStyle;
          return JSON.parse(JSON.stringify(style));
        }, el)
          .then((props) => {
            if (isColorProperty(prop)) {
              return convertColorToRGBA(props[prop]);
            }
            return props[prop];
          }));
      });
    });
    let props = await Promise.all(commands);
    const values = Object.keys(cssPropertiesCamelCase).map(key => cssPropertiesCamelCase[key]);
    if (!Array.isArray(props)) props = [props];
    let chunked = chunkArray(props, values.length);
    chunked = chunked.filter((val) => {
      for (let i = 0; i < val.length; ++i) {
        if (val[i] !== values[i]) return false;
      }
      return true;
    });
    return equals(`all elements (${locator}) to have CSS property ${JSON.stringify(cssProperties)}`).assert(chunked.length, elemAmount);
  }

  /**
   * {{> seeAttributesOnElements }}
   *
   */
  async seeAttributesOnElements(locator, attributes) {
    const res = await this._locate(locator);
    assertElementExists(res, locator);

    const elemAmount = res.length;
    const commands = [];
    res.forEach((el) => {
      Object.keys(attributes).forEach((prop) => {
        commands.push(el
          .$eval('xpath=.', (el, attr) => el[attr] || el.getAttribute(attr), prop));
      });
    });
    let attrs = await Promise.all(commands);
    const values = Object.keys(attributes).map(key => attributes[key]);
    if (!Array.isArray(attrs)) attrs = [attrs];
    let chunked = chunkArray(attrs, values.length);
    chunked = chunked.filter((val) => {
      for (let i = 0; i < val.length; ++i) {
        if (val[i] !== values[i]) return false;
      }
      return true;
    });
    return equals(`all elements (${locator}) to have attributes ${JSON.stringify(attributes)}`).assert(chunked.length, elemAmount);
  }

  /**
   * {{> dragSlider }}
   *
   */
  async dragSlider(locator, offsetX = 0) {
    const src = await this._locate(locator);
    assertElementExists(src, locator, 'Slider Element');

    // Note: Using clickablePoint private api because the .BoundingBox does not take into account iframe offsets!
    const sliderSource = await clickablePoint(src[0]);

    // Drag start point
    await this.page.mouse.move(sliderSource.x, sliderSource.y, { steps: 5 });
    await this.page.mouse.down();

    // Drag destination
    await this.page.mouse.move(sliderSource.x + offsetX, sliderSource.y, { steps: 5 });
    await this.page.mouse.up();

    return this._waitForAction();
  }

  /**
   * {{> grabAttributeFrom }}
   *
   */
  async grabAttributeFrom(locator, attr) {
    const attrs = await this.grabAttributeFromAll(locator, attr);
    assertElementExists(attrs, locator);
    this.debugSection('Attribute', attrs[0]);
    return attrs[0];
  }

  /**
   * {{> grabAttributeFromAll }}
   *
   */
  async grabAttributeFromAll(locator, attr) {
    const els = await this._locate(locator);
    this.debug(`Matched ${els.length} elements`);
    const array = [];

    for (let index = 0; index < els.length; index++) {
      const a = await this._evaluateHandeInContext(([el, attr]) => el[attr] || el.getAttribute(attr), [els[index], attr]);
      array.push(await a.jsonValue());
    }

    return array;
  }

  /**
   * {{> saveElementScreenshot }}
   *
   */
  async saveElementScreenshot(locator, fileName) {
    const outputFile = screenshotOutputFolder(fileName);

    const res = await this._locate(locator);
    assertElementExists(res, locator);
    if (res.length > 1) this.debug(`[Elements] Using first element out of ${res.length}`);
    const elem = res[0];
    this.debug(`Screenshot of ${locator} element has been saved to ${outputFile}`);
    return elem.screenshot({ path: outputFile, type: 'png' });
  }

  /**
   * {{> saveScreenshot }}
   */
  async saveScreenshot(fileName, fullPage) {
    const fullPageOption = fullPage || this.options.fullPageScreenshots;
    const outputFile = screenshotOutputFolder(fileName);

    this.debug(`Screenshot is saving to ${outputFile}`);

    if (this.activeSessionName) {
      const activeSessionPage = this.sessionPages[this.activeSessionName];

      if (activeSessionPage) {
        return activeSessionPage.screenshot({
          path: outputFile,
          fullPage: fullPageOption,
          type: 'png',
        });
      }
    }

    return this.page.screenshot({ path: outputFile, fullPage: fullPageOption, type: 'png' });
  }

  async _failed() {
    await this._withinEnd();
  }

  /**
   * {{> wait }}
   */
  async wait(sec) {
    return new Promise(((done) => {
      setTimeout(done, sec * 1000);
    }));
  }

  /**
   * {{> waitForEnabled }}
   */
  async waitForEnabled(locator, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');
    const matcher = await this.context;
    let waiter;
    const context = await this._getContext();
    if (!locator.isXPath()) {
      const valueFn = function ([locator]) {
        return Array.from(document.querySelectorAll(locator)).filter(el => !el.disabled).length > 0;
      };
      waiter = context.waitForFunction(valueFn, [locator.value], { timeout: waitTimeout });
    } else {
      const enabledFn = function ([locator, $XPath]) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).filter(el => !el.disabled).length > 0;
      };
      waiter = context.waitForFunction(enabledFn, [locator.value, $XPath.toString()], { timeout: waitTimeout });
    }
    return waiter.catch((err) => {
      throw new Error(`element (${locator.toString()}) still not enabled after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitForValue }}
   */
  async waitForValue(field, value, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    const locator = new Locator(field, 'css');
    const matcher = await this.context;
    let waiter;
    const context = await this._getContext();
    if (!locator.isXPath()) {
      const valueFn = function ([locator, value]) {
        return Array.from(document.querySelectorAll(locator)).filter(el => (el.value || '').indexOf(value) !== -1).length > 0;
      };
      waiter = context.waitForFunction(valueFn, [locator.value, value], { timeout: waitTimeout });
    } else {
      const valueFn = function ([locator, $XPath, value]) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).filter(el => (el.value || '').indexOf(value) !== -1).length > 0;
      };
      waiter = context.waitForFunction(valueFn, [locator.value, $XPath.toString(), value], { timeout: waitTimeout });
    }
    return waiter.catch((err) => {
      const loc = locator.toString();
      throw new Error(`element (${loc}) is not in DOM or there is no element(${loc}) with value "${value}" after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitNumberOfVisibleElements }}
   *
   */
  async waitNumberOfVisibleElements(locator, num, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');
    await this.context;
    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      const visibleFn = function ([locator, num]) {
        const els = document.querySelectorAll(locator);
        if (!els || els.length === 0) {
          return false;
        }
        return Array.prototype.filter.call(els, el => el.offsetParent !== null).length === num;
      };
      waiter = context.waitForFunction(visibleFn, [locator.value, num], { timeout: waitTimeout });
    } else {
      const visibleFn = function ([locator, $XPath, num]) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).filter(el => el.offsetParent !== null).length === num;
      };
      waiter = context.waitForFunction(visibleFn, [locator.value, $XPath.toString(), num], { timeout: waitTimeout });
    }
    return waiter.catch((err) => {
      throw new Error(`The number of elements (${locator.toString()}) is not ${num} after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitForClickable }}
   */
  async waitForClickable(locator, waitTimeout) {
    console.log('I.waitForClickable is DEPRECATED: This is no longer needed, Playwright automatically waits for element to be clickable');
    console.log('Remove usage of this function');
  }

  /**
   * {{> waitForElement }}
   *
   */
  async waitForElement(locator, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');

    const context = await this._getContext();
    const waiter = context.waitForSelector(buildLocatorString(locator), { timeout: waitTimeout, state: 'attached' });
    return waiter.catch((err) => {
      throw new Error(`element (${locator.toString()}) still not present on page after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitForVisible }}
   *
   * This method accepts [React selectors](https://codecept.io/react).
   */
  async waitForVisible(locator, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');
    const context = await this._getContext();
    const waiter = context.waitForSelector(buildLocatorString(locator), { timeout: waitTimeout, state: 'visible' });
    return waiter.catch((err) => {
      throw new Error(`element (${locator.toString()}) still not visible after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitForInvisible }}
   */
  async waitForInvisible(locator, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');
    const context = await this._getContext();
    const waiter = context.waitForSelector(buildLocatorString(locator), { timeout: waitTimeout, state: 'hidden' });
    return waiter.catch((err) => {
      throw new Error(`element (${locator.toString()}) still visible after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitToHide }}
   */
  async waitToHide(locator, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');
    const context = await this._getContext();
    return context.waitForSelector(buildLocatorString(locator), { timeout: waitTimeout, state: 'hidden' }).catch((err) => {
      throw new Error(`element (${locator.toString()}) still not hidden after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  async _getContext() {
    if (this.context && this.context.constructor.name === 'Frame') {
      return this.context;
    }
    return this.page;
  }

  /**
   * {{> waitInUrl }}
   */
  async waitInUrl(urlPart, sec = null) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;

    return this.page.waitForFunction((urlPart) => {
      const currUrl = decodeURIComponent(decodeURIComponent(decodeURIComponent(window.location.href)));
      return currUrl.indexOf(urlPart) > -1;
    }, urlPart, { timeout: waitTimeout }).catch(async (e) => {
      const currUrl = await this._getPageUrl(); // Required because the waitForFunction can't return data.
      if (/Timeout/i.test(e.message)) {
        throw new Error(`expected url to include ${urlPart}, but found ${currUrl}`);
      } else {
        throw e;
      }
    });
  }

  /**
   * {{> waitUrlEquals }}
   */
  async waitUrlEquals(urlPart, sec = null) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;

    const baseUrl = this.options.url;
    if (urlPart.indexOf('http') < 0) {
      urlPart = baseUrl + urlPart;
    }

    return this.page.waitForFunction((urlPart) => {
      const currUrl = decodeURIComponent(decodeURIComponent(decodeURIComponent(window.location.href)));
      return currUrl.indexOf(urlPart) > -1;
    }, urlPart, { timeout: waitTimeout }).catch(async (e) => {
      const currUrl = await this._getPageUrl(); // Required because the waitForFunction can't return data.
      if (/Timeout/i.test(e.message)) {
        throw new Error(`expected url to be ${urlPart}, but found ${currUrl}`);
      } else {
        throw e;
      }
    });
  }

  /**
   * {{> waitForText }}
   */
  async waitForText(text, sec = null, context = null) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    let waiter;

    const contextObject = await this._getContext();

    if (context) {
      const locator = new Locator(context, 'css');
      if (!locator.isXPath()) {
        waiter = contextObject.waitForSelector(`${locator.isCustom() ? `${locator.type}=${locator.value}` : locator.simplify()} >> text=${text}`, { timeout: waitTimeout, state: 'visible' });
      }

      if (locator.isXPath()) {
        waiter = contextObject.waitForFunction(([locator, text, $XPath]) => {
          eval($XPath); // eslint-disable-line no-eval
          const el = $XPath(null, locator);
          if (!el.length) return false;
          return el[0].innerText.indexOf(text) > -1;
        }, [locator.value, text, $XPath.toString()], { timeout: waitTimeout });
      }
    } else {
      waiter = contextObject.waitForFunction(text => document.body && document.body.innerText.indexOf(text) > -1, text, { timeout: waitTimeout });
    }
    return waiter.catch((err) => {
      throw new Error(`Text "${text}" was not found on page after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * Waits for a network request.
   *
   * ```js
   * I.waitForRequest('http://example.com/resource');
   * I.waitForRequest(request => request.url() === 'http://example.com' && request.method() === 'GET');
   * ```
   *
   * @param {string|function} urlOrPredicate
   * @param {?number} [sec=null] seconds to wait
   */
  async waitForRequest(urlOrPredicate, sec = null) {
    const timeout = sec ? sec * 1000 : this.options.waitForTimeout;
    return this.page.waitForRequest(urlOrPredicate, { timeout });
  }

  /**
   * Waits for a network request.
   *
   * ```js
   * I.waitForResponse('http://example.com/resource');
   * I.waitForResponse(request => request.url() === 'http://example.com' && request.method() === 'GET');
   * ```
   *
   * @param {string|function} urlOrPredicate
   * @param {?number} [sec=null] number of seconds to wait
   */
  async waitForResponse(urlOrPredicate, sec = null) {
    const timeout = sec ? sec * 1000 : this.options.waitForTimeout;
    return this.page.waitForResponse(urlOrPredicate, { timeout });
  }

  /**
   * {{> switchTo }}
   */
  async switchTo(locator) {
    if (Number.isInteger(locator)) {
      // Select by frame index of current context

      let childFrames = null;
      if (this.context && typeof this.context.childFrames === 'function') {
        childFrames = this.context.childFrames();
      } else {
        childFrames = this.page.mainFrame().childFrames();
      }

      if (locator >= 0 && locator < childFrames.length) {
        this.context = childFrames[locator];
        this.contextLocator = locator;
      } else {
        throw new Error('Element #invalidIframeSelector was not found by text|CSS|XPath');
      }
      return;
    }
    if (!locator) {
      this.context = this.page;
      this.contextLocator = null;
      return;
    }

    // iframe by selector
    const els = await this._locate(locator);
    assertElementExists(els, locator);
    const contentFrame = await els[0].contentFrame();

    if (contentFrame) {
      this.context = contentFrame;
      this.contextLocator = null;
    } else {
      this.context = els[0];
      this.contextLocator = locator;
    }
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
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    const context = await this._getContext();
    return context.waitForFunction(fn, args, { timeout: waitTimeout });
  }

  /**
   * Waits for navigation to finish. By default takes configured `waitForNavigation` option.
   *
   * See [Playwright's reference](https://playwright.dev/docs/api/class-page?_highlight=waitfornavi#pagewaitfornavigationoptions)
   *
   * @param {*} opts
   */
  async waitForNavigation(opts = {}) {
    opts = {
      timeout: this.options.getPageTimeout,
      waitUntil: this.options.waitForNavigation,
      ...opts,
    };
    return this.page.waitForNavigation(opts);
  }

  /**
   * {{> waitUntil }}
   */
  async waitUntil(fn, sec = null) {
    console.log('This method will remove in CodeceptJS 1.4; use `waitForFunction` instead!');
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    const context = await this._getContext();
    return context.waitForFunction(fn, { timeout: waitTimeout });
  }

  async waitUntilExists(locator, sec) {
    console.log(`waitUntilExists deprecated:
    * use 'waitForElement' to wait for element to be attached
    * use 'waitForDetached to wait for element to be removed'`);
    return this.waitForDetached(locator, sec);
  }

  /**
   * {{> waitForDetached }}
   */
  async waitForDetached(locator, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');

    let waiter;
    const context = await this._getContext();
    if (!locator.isXPath()) {
      waiter = context.waitForSelector(`${locator.isCustom() ? `${locator.type}=${locator.value}` : locator.simplify()}`, { timeout: waitTimeout, state: 'detached' });
    } else {
      const visibleFn = function ([locator, $XPath]) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).length === 0;
      };
      waiter = context.waitForFunction(visibleFn, [locator.value, $XPath.toString()], { timeout: waitTimeout });
    }
    return waiter.catch((err) => {
      throw new Error(`element (${locator.toString()}) still on page after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  async _waitForAction() {
    return this.wait(this.options.waitForAction / 1000);
  }

  /**
   * {{> grabDataFromPerformanceTiming }}
   */
  async grabDataFromPerformanceTiming() {
    return perfTiming;
  }

  /**
   * {{> grabElementBoundingRect }}
   */
  async grabElementBoundingRect(locator, prop) {
    const els = await this._locate(locator);
    assertElementExists(els, locator);
    const rect = await els[0].boundingBox();
    if (prop) return rect[prop];
    return rect;
  }
}

module.exports = Playwright;

function buildLocatorString(locator) {
  if (locator.isCustom()) {
    return `${locator.type}=${locator.value}`;
  } if (locator.isXPath()) {
    // dont rely on heuristics of playwright for figuring out xpath
    return `xpath=${locator.value}`;
  }
  return locator.simplify();
}

async function findElements(matcher, locator) {
  locator = new Locator(locator, 'css');
  return matcher.$$(buildLocatorString(locator));
}

async function getVisibleElements(elements) {
  const visibleElements = [];
  for (const element of elements) {
    if (await element.isVisible()) {
      visibleElements.push(element);
    }
  }
  if (visibleElements.length === 0) {
    return elements;
  }
  return visibleElements;
}

async function proceedClick(locator, context = null, options = {}) {
  let matcher = await this._getContext();
  if (context) {
    const els = await this._locate(context);
    assertElementExists(els, context);
    matcher = els[0];
  }
  const els = await findClickable.call(this, matcher, locator);
  if (context) {
    assertElementExists(els, locator, 'Clickable element', `was not found inside element ${new Locator(context).toString()}`);
  } else {
    assertElementExists(els, locator, 'Clickable element');
  }
  /*
    using the force true options itself but instead dispatching a click
  */
  if (options.force) {
    await els[0].dispatchEvent('click');
  } else {
    const element = els.length > 1 ? (await getVisibleElements(els))[0] : els[0];
    await element.click(options);
  }
  const promises = [];
  if (options.waitForNavigation) {
    promises.push(this.waitForNavigation());
  }
  promises.push(this._waitForAction());
  return Promise.all(promises);
}

async function findClickable(matcher, locator) {
  locator = new Locator(locator);
  if (!locator.isFuzzy()) return findElements.call(this, matcher, locator);

  let els;
  const literal = xpathLocator.literal(locator.value);

  els = await findElements.call(this, matcher, Locator.clickable.narrow(literal));
  if (els.length) return els;

  els = await findElements.call(this, matcher, Locator.clickable.wide(literal));
  if (els.length) return els;

  try {
    els = await findElements.call(this, matcher, Locator.clickable.self(literal));
    if (els.length) return els;
  } catch (err) {
    // Do nothing
  }

  return findElements.call(this, matcher, locator.value); // by css or xpath
}

async function proceedSee(assertType, text, context, strict = false) {
  let description;
  let allText;
  if (!context) {
    let el = await this.context;

    if (el && !el.getProperty) {
      // Fallback to body
      el = await this.context.$('body');
    }

    allText = [await el.getProperty('innerText').then(p => p.jsonValue())];
    description = 'web application';
  } else {
    const locator = new Locator(context, 'css');
    description = `element ${locator.toString()}`;
    const els = await this._locate(locator);
    assertElementExists(els, locator.toString());
    allText = await Promise.all(els.map(el => el.getProperty('innerText').then(p => p.jsonValue())));
  }

  if (strict) {
    return allText.map(elText => equals(description)[assertType](text, elText));
  }
  return stringIncludes(description)[assertType](text, allText.join(' | '));
}

async function findCheckable(locator, context) {
  let contextEl = await this.context;
  if (typeof context === 'string') {
    contextEl = await findElements.call(this, contextEl, (new Locator(context, 'css')).simplify());
    contextEl = contextEl[0];
  }

  const matchedLocator = new Locator(locator);
  if (!matchedLocator.isFuzzy()) {
    return findElements.call(this, contextEl, matchedLocator.simplify());
  }

  const literal = xpathLocator.literal(locator);
  let els = await findElements.call(this, contextEl, Locator.checkable.byText(literal));
  if (els.length) {
    return els;
  }
  els = await findElements.call(this, contextEl, Locator.checkable.byName(literal));
  if (els.length) {
    return els;
  }
  return findElements.call(this, contextEl, locator);
}

async function proceedIsChecked(assertType, option) {
  let els = await findCheckable.call(this, option);
  assertElementExists(els, option, 'Checkable');
  els = await Promise.all(els.map(el => el.getProperty('checked')));
  els = await Promise.all(els.map(el => el.jsonValue()));
  const selected = els.reduce((prev, cur) => prev || cur);
  return truth(`checkable ${option}`, 'to be checked')[assertType](selected);
}

async function findFields(locator) {
  const matchedLocator = new Locator(locator);
  if (!matchedLocator.isFuzzy()) {
    return this._locate(matchedLocator);
  }
  const literal = xpathLocator.literal(locator);

  let els = await this._locate({ xpath: Locator.field.labelEquals(literal) });
  if (els.length) {
    return els;
  }

  els = await this._locate({ xpath: Locator.field.labelContains(literal) });
  if (els.length) {
    return els;
  }
  els = await this._locate({ xpath: Locator.field.byName(literal) });
  if (els.length) {
    return els;
  }
  return this._locate({ css: locator });
}

async function proceedDragAndDrop(sourceLocator, destinationLocator) {
  const src = await this._locate(sourceLocator);
  assertElementExists(src, sourceLocator, 'Source Element');

  const dst = await this._locate(destinationLocator);
  assertElementExists(dst, destinationLocator, 'Destination Element');

  // Note: Using clickablePoint private api becaues the .BoundingBox does not take into account iframe offsets!
  const dragSource = await clickablePoint(src[0]);
  const dragDestination = await clickablePoint(dst[0]);

  // Drag start point
  await this.page.mouse.move(dragSource.x, dragSource.y, { steps: 5 });
  await this.page.mouse.down();

  // Drag destination
  await this.page.mouse.move(dragDestination.x, dragDestination.y, { steps: 5 });
  await this.page.mouse.up();
  await this._waitForAction();
}

async function proceedSeeInField(assertType, field, value) {
  const els = await findFields.call(this, field);
  assertElementExists(els, field, 'Field');
  const el = els[0];
  const tag = await el.getProperty('tagName').then(el => el.jsonValue());
  const fieldType = await el.getProperty('type').then(el => el.jsonValue());

  const proceedMultiple = async (elements) => {
    const fields = Array.isArray(elements) ? elements : [elements];

    const elementValues = [];
    for (const element of fields) {
      elementValues.push(await element.getProperty('value').then(el => el.jsonValue()));
    }

    if (typeof value === 'boolean') {
      equals(`no. of items matching > 0: ${field}`)[assertType](value, !!elementValues.length);
    } else {
      if (assertType === 'assert') {
        equals(`select option by ${field}`)[assertType](true, elementValues.length > 0);
      }
      elementValues.forEach(val => stringIncludes(`fields by ${field}`)[assertType](value, val));
    }
  };

  if (tag === 'SELECT') {
    const selectedOptions = await el.$$('option:checked');
    // locate option by values and check them
    if (value === '') {
      return proceedMultiple(selectedOptions);
    }

    const options = await filterFieldsByValue(selectedOptions, value, true);
    return proceedMultiple(options);
  }

  if (tag === 'INPUT') {
    if (fieldType === 'checkbox' || fieldType === 'radio') {
      if (typeof value === 'boolean') {
        // Filter by values
        const options = await filterFieldsBySelectionState(els, true);
        return proceedMultiple(options);
      }

      const options = await filterFieldsByValue(els, value, true);
      return proceedMultiple(options);
    }
    return proceedMultiple(els[0]);
  }
  const fieldVal = await el.getProperty('value').then(el => el.jsonValue());
  return stringIncludes(`fields by ${field}`)[assertType](value, fieldVal);
}

async function filterFieldsByValue(elements, value, onlySelected) {
  const matches = [];
  for (const element of elements) {
    const val = await element.getProperty('value').then(el => el.jsonValue());
    let isSelected = true;
    if (onlySelected) {
      isSelected = await elementSelected(element);
    }
    if ((value == null || val.indexOf(value) > -1) && isSelected) {
      matches.push(element);
    }
  }
  return matches;
}

async function filterFieldsBySelectionState(elements, state) {
  const matches = [];
  for (const element of elements) {
    const isSelected = await elementSelected(element);
    if (isSelected === state) {
      matches.push(element);
    }
  }
  return matches;
}

async function elementSelected(element) {
  const type = await element.getProperty('type').then(el => el.jsonValue());

  if (type === 'checkbox' || type === 'radio') {
    return element.getProperty('checked').then(el => el.jsonValue());
  }
  return element.getProperty('selected').then(el => el.jsonValue());
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

function $XPath(element, selector) {
  const found = document.evaluate(selector, element || document.body, null, 5, null);
  const res = [];
  let current = null;
  while (current = found.iterateNext()) {
    res.push(current);
  }
  return res;
}

async function targetCreatedHandler(page) {
  if (!page) return;
  this.withinLocator = null;
  page.on('load', () => {
    page.$('body')
      .catch(() => null)
      .then(async context => {
        if (this.context && this.context._type === 'Frame') {
          // we are inside iframe?
          const frameEl = await this.context.frameElement();
          this.context = await frameEl.contentFrame();
          this.contextLocator = null;
          return;
        }
        // if context element was in iframe - keep it
        // if (await this.context.ownerFrame()) return;
        this.context = page;
        this.contextLocator = null;
      });
  });
  page.on('console', (msg) => {
    this.debugSection(`Browser:${ucfirst(msg.type())}`, (msg._text || '') + msg.args().join(' '));
    consoleLogStore.add(msg);
  });

  if (this.options.userAgent) {
    await page.setUserAgent(this.options.userAgent);
  }
  if (this.options.windowSize && this.options.windowSize.indexOf('x') > 0 && this._getType() === 'Browser') {
    const dimensions = this.options.windowSize.split('x');
    const width = parseInt(dimensions[0], 10);
    const height = parseInt(dimensions[1], 10);
    await page.setViewportSize({ width, height });
  }
}

// List of key values to key definitions
// https://github.com/puppeteer/puppeteer/blob/v1.20.0/lib/USKeyboardLayout.js
const keyDefinitionMap = {
  /* eslint-disable quote-props */
  '0': 'Digit0',
  '1': 'Digit1',
  '2': 'Digit2',
  '3': 'Digit3',
  '4': 'Digit4',
  '5': 'Digit5',
  '6': 'Digit6',
  '7': 'Digit7',
  '8': 'Digit8',
  '9': 'Digit9',
  'a': 'KeyA',
  'b': 'KeyB',
  'c': 'KeyC',
  'd': 'KeyD',
  'e': 'KeyE',
  'f': 'KeyF',
  'g': 'KeyG',
  'h': 'KeyH',
  'i': 'KeyI',
  'j': 'KeyJ',
  'k': 'KeyK',
  'l': 'KeyL',
  'm': 'KeyM',
  'n': 'KeyN',
  'o': 'KeyO',
  'p': 'KeyP',
  'q': 'KeyQ',
  'r': 'KeyR',
  's': 'KeyS',
  't': 'KeyT',
  'u': 'KeyU',
  'v': 'KeyV',
  'w': 'KeyW',
  'x': 'KeyX',
  'y': 'KeyY',
  'z': 'KeyZ',
  ';': 'Semicolon',
  '=': 'Equal',
  ',': 'Comma',
  '-': 'Minus',
  '.': 'Period',
  '/': 'Slash',
  '`': 'Backquote',
  '[': 'BracketLeft',
  '\\': 'Backslash',
  ']': 'BracketRight',
  '\'': 'Quote',
  /* eslint-enable quote-props */
};

function getNormalizedKey(key) {
  const normalizedKey = getNormalizedKeyAttributeValue(key);
  if (key !== normalizedKey) {
    this.debugSection('Input', `Mapping key '${key}' to '${normalizedKey}'`);
  }
  // Use key definition to ensure correct key is displayed when Shift modifier is active
  if (Object.prototype.hasOwnProperty.call(keyDefinitionMap, normalizedKey)) {
    return keyDefinitionMap[normalizedKey];
  }
  return normalizedKey;
}

async function clickablePoint(el) {
  const rect = await el.boundingBox();
  if (!rect) throw new ElementNotFound(el);
  const {
    x, y, width, height,
  } = rect;
  return { x: x + width / 2, y: y + height / 2 };
}
