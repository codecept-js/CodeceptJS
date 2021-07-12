const axios = require('axios');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');

const Helper = require('../helper');
const Locator = require('../locator');
const recorder = require('../recorder');
const stringIncludes = require('../assert/include').includes;
const { urlEquals } = require('../assert/equal');
const { equals } = require('../assert/equal');
const { empty } = require('../assert/empty');
const { truth } = require('../assert/truth');
const isElementClickable = require('./scripts/isElementClickable');
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
const findReact = require('./extras/React');

let puppeteer;
let perfTiming;
const popupStore = new Popup();
const consoleLogStore = new Console();

/**
 * Uses [Google Chrome's Puppeteer](https://github.com/GoogleChrome/puppeteer) library to run tests inside headless Chrome.
 * Browser control is executed via DevTools Protocol (instead of Selenium).
 * This helper works with a browser out of the box with no additional tools required to install.
 *
 * Requires `puppeteer` package to be installed.
 *
 * > Experimental Firefox support [can be activated](https://codecept.io/helpers/Puppeteer-firefox).
 *
 * ## Configuration
 *
 * This helper should be configured in codecept.json or codecept.conf.js
 *
 * * `url`: base url of website to be tested
 * * `basicAuth`: (optional) the basic authentication to pass to base url. Example: {username: 'username', password: 'password'}
 * * `show`: (optional, default: false) - show Google Chrome window for debug.
 * * `restart`: (optional, default: true) - restart browser between tests.
 * * `disableScreenshots`: (optional, default: false)  - don't save screenshot on failure.
 * * `fullPageScreenshots` (optional, default: false) - make full page screenshots on failure.
 * * `uniqueScreenshotNames`: (optional, default: false)  - option to prevent screenshot override if you have scenarios with the same name in different suites.
 * * `keepBrowserState`: (optional, default: false) - keep browser state between tests when `restart` is set to false.
 * * `keepCookies`: (optional, default: false) - keep cookies between tests when `restart` is set to false.
 * * `waitForAction`: (optional) how long to wait after click, doubleClick or PressKey actions in ms. Default: 100.
 * * `waitForNavigation`: (optional, default: 'load'). When to consider navigation succeeded. Possible options: `load`, `domcontentloaded`, `networkidle0`, `networkidle2`. See [Puppeteer API](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagewaitfornavigationoptions). Array values are accepted as well.
 * * `pressKeyDelay`: (optional, default: '10'). Delay between key presses in ms. Used when calling Puppeteers page.type(...) in fillField/appendField
 * * `getPageTimeout` (optional, default: '30000') config option to set maximum navigation time in milliseconds. If the timeout is set to 0, then timeout will be disabled.
 * * `waitForTimeout`: (optional) default wait* timeout in ms. Default: 1000.
 * * `windowSize`: (optional) default window size. Set a dimension like `640x480`.
 * * `userAgent`: (optional) user-agent string.
 * * `manualStart`: (optional, default: false) - do not start browser before a test, start it manually inside a helper with `this.helpers["Puppeteer"]._startBrowser()`.
 * * `browser`: (optional, default: chrome) - can be changed to `firefox` when using [puppeteer-firefox](https://codecept.io/helpers/Puppeteer-firefox).
 * * `chrome`: (optional) pass additional [Puppeteer run options](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions).
 *
 *
 * #### Example #1: Wait for 0 network connections.
 *
 * ```js
 * {
 *    helpers: {
 *      Puppeteer : {
 *        url: "http://localhost",
 *        restart: false,
 *        waitForNavigation: "networkidle0",
 *        waitForAction: 500
 *      }
 *    }
 * }
 * ```
 *
 * #### Example #2: Wait for DOMContentLoaded event and 0 network connections
 *
 * ```js
 * {
 *    helpers: {
 *      Puppeteer : {
 *        url: "http://localhost",
 *        restart: false,
 *        waitForNavigation: [ "domcontentloaded", "networkidle0" ],
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
 *      Puppeteer : {
 *        url: "http://localhost",
 *        show: true
 *      }
 *    }
 * }
 * ```
 *
 * #### Example #4: Connect to remote browser by specifying [websocket endpoint](https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target)
 *
 * ```js
 * {
 *    helpers: {
 *      Puppeteer: {
 *        url: "http://localhost",
 *        chrome: {
 *          browserWSEndpoint: "ws://localhost:9222/devtools/browser/c5aa6160-b5bc-4d53-bb49-6ecb36cd2e0a"
 *        }
 *      }
 *    }
 * }
 * ```
 *
* #### Example #5: Target URL with provided basic authentication
 *
 * ```js
 * {
 *    helpers: {
 *      Puppeteer : {
 *        url: 'http://localhost',
 *        basicAuth: {username: 'username', password: 'password'},
 *        show: true
 *      }
 *    }
 * }
 * ```
 *
 *
 *
 * Note: When connecting to remote browser `show` and specific `chrome` options (e.g. `headless` or `devtools`) are ignored.
 *
 * ## Access From Helpers
 *
 * Receive Puppeteer client from a custom helper by accessing `browser` for the Browser object or `page` for the current Page object:
 *
 * ```js
 * const { browser } = this.helpers.Puppeteer;
 * await browser.pages(); // List of pages in the browser
 *
 * const { page } = this.helpers.Puppeteer;
 * await page.url(); // Get the url of the current page
 * ```
 *
 * ## Methods
 */
class Puppeteer extends Helper {
  constructor(config) {
    super(config);

    puppeteer = require('puppeteer');

    // set defaults
    this.isRemoteBrowser = false;
    this.isRunning = false;
    this.isAuthenticated = false;
    this.sessionPages = {};
    this.activeSessionName = '';

    // override defaults with config
    this._setConfig(config);
  }

  _validateConfig(config) {
    const defaults = {
      browser: 'chrome',
      waitForAction: 100,
      waitForTimeout: 1000,
      pressKeyDelay: 10,
      fullPageScreenshots: false,
      disableScreenshots: false,
      uniqueScreenshotNames: false,
      manualStart: false,
      getPageTimeout: 30000,
      waitForNavigation: 'load',
      restart: true,
      keepCookies: false,
      keepBrowserState: false,
      show: false,
      defaultPopupAction: 'accept',
    };

    return Object.assign(defaults, config);
  }

  _getOptions(config) {
    return config.browser === 'firefox' ? Object.assign(this.options.firefox, { product: 'firefox' }) : this.options.chrome;
  }

  _setConfig(config) {
    this.options = this._validateConfig(config);
    this.puppeteerOptions = {
      headless: !this.options.show,
      ...this._getOptions(config),
    };
    this.isRemoteBrowser = !!this.puppeteerOptions.browserWSEndpoint;
    popupStore.defaultAction = this.options.defaultPopupAction;
  }

  static _config() {
    return [
      { name: 'url', message: 'Base url of site to be tested', default: 'http://localhost' },
      {
        name: 'show', message: 'Show browser window', default: true, type: 'confirm',
      },
      {
        name: 'windowSize', message: 'Browser viewport size', default: '1200x900',
      },
    ];
  }

  static _checkRequirements() {
    try {
      require('puppeteer');
    } catch (e) {
      return ['puppeteer'];
    }
  }

  _init() {
  }

  _beforeSuite() {
    if (!this.options.restart && !this.options.manualStart && !this.isRunning) {
      this.debugSection('Session', 'Starting singleton browser session');
      return this._startBrowser();
    }
  }

  async _before() {
    this.sessionPages = {};
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

    // close other sessions
    const contexts = this.browser.browserContexts();
    const defaultCtx = contexts.shift();

    await Promise.all(contexts.map(c => c.close()));

    if (this.options.restart) {
      this.isRunning = false;
      return this._stopBrowser();
    }

    // ensure this.page is from default context
    if (this.page) {
      const existingPages = defaultCtx.targets().filter(t => t.type() === 'page');
      await this._setPage(await existingPages[0].page());
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
    await this.closeOtherTabs();
    return this.browser;
  }

  _afterSuite() {
  }

  _finishTest() {
    if (!this.options.restart && this.isRunning) return this._stopBrowser();
  }

  _session() {
    return {
      start: async (name = '') => {
        this.debugSection('Incognito Tab', 'opened');
        this.activeSessionName = name;

        const bc = await this.browser.createIncognitoBrowserContext();
        await bc.newPage();

        // Create a new page inside context.
        return bc;
      },
      stop: async () => {
        // is closed by _after
      },
      loadVars: async (context) => {
        const existingPages = context.targets().filter(t => t.type() === 'page');
        this.sessionPages[this.activeSessionName] = await existingPages[0].page();
        return this._setPage(this.sessionPages[this.activeSessionName]);
      },
      restoreVars: async (session) => {
        this.withinLocator = null;

        if (!session) {
          this.activeSessionName = '';
        } else {
          this.activeSessionName = session;
        }
        const defaultCtx = this.browser.defaultBrowserContext();
        const existingPages = defaultCtx.targets().filter(t => t.type() === 'page');
        await this._setPage(await existingPages[0].page());

        return this._waitForAction();
      },
    };
  }

  /**
  * Use Puppeteer API inside a test.
  *
  * First argument is a description of an action.
  * Second argument is async function that gets this helper as parameter.
  *
  * { [`page`](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#class-page), [`browser`](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#class-browser) } from Puppeteer API are available.
  *
  * ```js
  * I.usePuppeteerTo('emulate offline mode', async ({ page }) {
  *   await page.setOfflineMode(true);
  * });
  * ```
  *
  * @param {string} description used to show in logs.
  * @param {function} fn async function that is executed with Puppeteer as argument
  */
  usePuppeteerTo(description, fn) {
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
    this._addErrorListener(page);
    this.page = page;
    if (!page) return;
    page.setDefaultNavigationTimeout(this.options.getPageTimeout);
    this.context = await this.page.$('body');
    if (this.config.browser === 'chrome') {
      await page.bringToFront();
    }
  }

  async _addErrorListener(page) {
    if (!page) {
      return;
    }
    page.on('error', async (error) => {
      console.error('Puppeteer page error', error);
    });
  }

  /**
   * Add the 'dialog' event listener to a page
   * @page {Puppeteer.Page}
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
    if (this.isRemoteBrowser) {
      try {
        this.browser = await puppeteer.connect(this.puppeteerOptions);
      } catch (err) {
        if (err.toString().indexOf('ECONNREFUSED')) {
          throw new RemoteBrowserConnectionRefused(err);
        }
        throw err;
      }
    } else {
      this.browser = await puppeteer.launch(this.puppeteerOptions);
    }

    this.browser.on('targetcreated', target => target.page().then(page => targetCreatedHandler.call(this, page)).catch((e) => {
      console.error('Puppeteer page error', e);
    }));
    this.browser.on('targetchanged', (target) => {
      this.debugSection('Url', target.url());
    });

    const existingPages = await this.browser.pages();
    const mainPage = existingPages[0] || await this.browser.newPage();

    if (existingPages.length) {
      // Run the handler as it will not be triggered if the page already exists
      targetCreatedHandler.call(this, mainPage);
    }
    await this._setPage(mainPage);
    await this.closeOtherTabs();

    this.isRunning = true;
  }

  async _stopBrowser() {
    this.withinLocator = null;
    this._setPage(null);
    this.context = null;
    popupStore.clear();
    this.isAuthenticated = false;
    if (this.isRemoteBrowser) {
      await this.browser.disconnect();
    } else {
      await this.browser.close();
    }
  }

  async _evaluateHandeInContext(...args) {
    let context = await this._getContext();

    if (context.constructor.name === 'Frame') {
      // Currently there is no evalateHandle for the Frame object
      // https://github.com/GoogleChrome/puppeteer/issues/1051
      context = await context.executionContext();
    }

    return context.evaluateHandle(...args);
  }

  async _withinBegin(locator) {
    if (this.withinLocator) {
      throw new Error('Can\'t start within block inside another within block');
    }

    const frame = isFrameLocator(locator);

    if (frame) {
      if (Array.isArray(frame)) {
        return this.switchTo(null)
          .then(() => frame.reduce((p, frameLocator) => p.then(() => this.switchTo(frameLocator)), Promise.resolve()));
      }
      await this.switchTo(locator);
      this.withinLocator = new Locator(locator);
      return;
    }

    const els = await this._locate(locator);
    assertElementExists(els, locator);
    this.context = els[0];

    this.withinLocator = new Locator(locator);
  }

  async _withinEnd() {
    this.withinLocator = null;
    this.context = await this.page.mainFrame().$('body');
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
    if (!(/^\w+\:\/\//.test(url))) {
      url = this.options.url + url;
    }

    if (this.config.basicAuth && (this.isAuthenticated !== true)) {
      if (url.includes(this.options.url)) {
        await this.page.authenticate(this.config.basicAuth);
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
   * Unlike other drivers Puppeteer changes the size of a viewport, not the window!
   * Puppeteer does not control the window of a browser so it can't adjust its real size.
   * It also can't maximize a window.
   */
  async resizeWindow(width, height) {
    if (width === 'maximize') {
      throw new Error('Puppeteer can\'t control windows, so it can\'t maximize it');
    }

    await this.page.setViewport({ width, height });
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
   * {{ react }}
   */
  async moveCursorTo(locator, offsetX = 0, offsetY = 0) {
    const els = await this._locate(locator);
    assertElementExists(els);

    // Use manual mouse.move instead of .hover() so the offset can be added to the coordinates
    const { x, y } = await els[0].clickablePoint();
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
      await els[0]._scrollIntoViewIfNeeded();
      const elementCoordinates = await els[0].clickablePoint();
      await this.executeScript((x, y) => window.scrollBy(x, y), elementCoordinates.x + offsetX, elementCoordinates.y + offsetY);
    } else {
      await this.executeScript((x, y) => window.scrollTo(x, y), offsetX, offsetY);
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
   * Checks that title is equal to provided one.
   *
   * ```js
   * I.seeTitleEquals('Test title.');
   * ```
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
   * const elements = await this.helpers['Puppeteer']._locate({name: 'password'});
   * ```
   *
   * {{ react }}
   */
  async _locate(locator) {
    return findElements(await this.context, locator);
  }

  /**
   * Find a checkbox by providing human readable text:
   * NOTE: Assumes the checkable element exists
   *
   * ```js
   * this.helpers['Puppeteer']._locateCheckable('I agree with terms and conditions').then // ...
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
   * this.helpers['Puppeteer']._locateClickable('Next page').then // ...
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
   * this.helpers['Puppeteer']._locateFields('Your email').then // ...
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
    const pages = await this.browser.pages();
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
    const pages = await this.browser.pages();
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
    const pages = await this.browser.pages();
    const otherPages = pages.filter(page => page !== this.page);

    let p = Promise.resolve();
    otherPages.forEach((page) => {
      p = p.then(() => page.close());
    });
    await p;
    return this._waitForAction();
  }

  /**
   * Open new tab and switch to it
   *
   * ```js
   * I.openNewTab();
   * ```
   */
  async openNewTab() {
    await this._setPage(await this.browser.newPage());
    return this._waitForAction();
  }

  /**
   * {{> grabNumberOfOpenTabs }}
   */
  async grabNumberOfOpenTabs() {
    const pages = await this.browser.pages();
    return pages.length;
  }

  /**
   * {{> seeElement }}
   * {{ react }}
   */
  async seeElement(locator) {
    let els = await this._locate(locator);
    els = await Promise.all(els.map(el => el.boundingBox()));
    return empty('visible elements').negate(els.filter(v => v).fill('ELEMENT'));
  }

  /**
   * {{> dontSeeElement }}
   * {{ react }}
   */
  async dontSeeElement(locator) {
    let els = await this._locate(locator);
    els = await Promise.all(els.map(el => el.boundingBox()));
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
   * {{> click }}
   *
   * {{ react }}
   */
  async click(locator, context = null) {
    return proceedClick.call(this, locator, context);
  }

  /**
   * {{> forceClick }}
   *
   * {{ react }}
   */
  async forceClick(locator, context = null) {
    let matcher = await this.context;
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
    const elem = els[0];
    return this.executeScript((el) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const event = document.createEvent('MouseEvent');
      event.initEvent('click', true, true);
      return el.dispatchEvent(event);
    }, elem);
  }

  /**
   * {{> clickLink }}
   *
   * {{ react }}
   */
  async clickLink(locator, context = null) {
    return proceedClick.call(this, locator, context, { waitForNavigation: true });
  }

  /**
   * Sets a directory to where save files. Allows to test file downloads.
   * Should be used with [FileSystem helper](https://codecept.io/helpers/FileSystem) to check that file were downloaded correctly.
   *
   * By default files are saved to `output/downloads`.
   * This directory is cleaned on every `handleDownloads` call, to ensure no old files are kept.
   *
   * ```js
   * I.handleDownloads();
   * I.click('Download Avatar');
   * I.amInPath('output/downloads');
   * I.seeFile('avatar.jpg');
   *
   * ```
   *
   * @param {string} [downloadPath='downloads'] change this parameter to set another directory for saving
   */
  async handleDownloads(downloadPath = 'downloads') {
    downloadPath = path.join(global.output_dir, downloadPath);
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, '0777');
    }
    fsExtra.emptyDirSync(downloadPath);
    return this.page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath });
  }

  /**
   * This method is **deprecated**.
   *
   * Please use `handleDownloads()` instead.
   */
  async downloadFile(locator, customName) {
    let fileName;
    await this.page.setRequestInterception(true);

    const xRequest = await new Promise((resolve) => {
      this.page.on('request', (request) => {
        console.log('rq', request, customName);
        const grabbedFileName = request.url().split('/')[request.url().split('/').length - 1];
        const fileExtension = request.url().split('/')[request.url().split('/').length - 1].split('.')[1];
        console.log('nm', customName, fileExtension);
        if (customName && path.extname(customName) !== fileExtension) {
          console.log('bypassing a request');
          request.continue();
          return;
        }
        customName ? fileName = `${customName}.${fileExtension}` : fileName = grabbedFileName;
        request.abort();
        resolve(request);
      });
    });

    await this.click(locator);

    const options = {
      encoding: null,
      method: xRequest._method,
      uri: xRequest._url,
      body: xRequest._postData,
      headers: xRequest._headers,
    };

    const cookies = await this.page.cookies();
    options.headers.Cookie = cookies.map(ck => `${ck.name}=${ck.value}`).join(';');

    const response = await axios({
      method: options.method,
      url: options.uri,
      headers: options.headers,
      responseType: 'arraybuffer',
      onDownloadProgress(e) {
        console.log('+', e);
      },
    });

    const outputFile = path.join(`${global.output_dir}/${fileName}`);

    try {
      await new Promise((resolve, reject) => {
        const wstream = fs.createWriteStream(outputFile);
        console.log(response);
        wstream.write(response.data);
        wstream.end();
        this.debug(`File is downloaded in ${outputFile}`);
        wstream.on('finish', () => { resolve(fileName); });
        wstream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`There is something wrong with downloaded file. ${error}`);
    }
  }

  /**
   * {{> doubleClick }}
   *
   * {{ react }}
   */
  async doubleClick(locator, context = null) {
    return proceedClick.call(this, locator, context, { clickCount: 2 });
  }

  /**
   * {{> rightClick }}
   *
   * {{ react }}
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
   * _Note:_ Shortcuts like `'Meta'` + `'A'` do not work on macOS ([GoogleChrome/puppeteer#1313](https://github.com/GoogleChrome/puppeteer/issues/1313)).
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
   * {{ react }}
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
   * {{ react }}
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
   * > ⚠ There is an [issue with file upload in Puppeteer 2.1.0 & 2.1.1](https://github.com/puppeteer/puppeteer/issues/5420), downgrade to 2.0.0 if you face it.
   */
  async attachFile(locator, pathToFile) {
    const file = path.join(global.codecept_dir, pathToFile);

    if (!fileExists(file)) {
      throw new Error(`File at ${file} can not be found on local system`);
    }
    const els = await findFields.call(this, locator);
    assertElementExists(els, 'Field');
    await els[0].uploadFile(file);
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
   * {{ react }}
   */
  async grabNumberOfVisibleElements(locator) {
    let els = await this._locate(locator);
    els = await Promise.all(els.map(el => el.boundingBox()));
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
   * {{ react }}
   */
  async seeNumberOfElements(locator, num) {
    const elements = await this._locate(locator);
    return equals(`expected number of elements (${locator}) is ${num}, but found ${elements.length}`).assert(elements.length, num);
  }

  /**
   * {{> seeNumberOfVisibleElements }}
   *
   * {{ react }}
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
      return this.page.setCookie(...cookie);
    }
    return this.page.setCookie(cookie);
  }

  /**
   * {{> seeCookie }}
   *
   */
  async seeCookie(name) {
    const cookies = await this.page.cookies();
    empty(`cookie ${name} to be set`).negate(cookies.filter(c => c.name === name));
  }

  /**
   * {{> dontSeeCookie }}
   */
  async dontSeeCookie(name) {
    const cookies = await this.page.cookies();
    empty(`cookie ${name} to be set`).assert(cookies.filter(c => c.name === name));
  }

  /**
   * {{> grabCookie }}
   *
   * Returns cookie in JSON format. If name not passed returns all cookies for this domain.
   */
  async grabCookie(name) {
    const cookies = await this.page.cookies();
    if (!name) return cookies;
    const cookie = cookies.filter(c => c.name === name);
    if (cookie[0]) return cookie[0];
  }

  /**
   * {{> clearCookie }}
   */
  async clearCookie(name) {
    const cookies = await this.page.cookies();
    if (!name) {
      return this.page.deleteCookie.apply(this.page, cookies);
    }
    const cookie = cookies.filter(c => c.name === name);
    if (!cookie[0]) return;
    return this.page.deleteCookie(cookie[0]);
  }

  /**
   * {{> executeScript }}
   *
   * If a function returns a Promise It will wait for it resolution.
   */
  async executeScript(...args) {
    let context = this.page;
    if (this.context && this.context.constructor.name === 'Frame') {
      context = this.context; // switching to iframe context
    }
    return context.evaluate.apply(context, args);
  }

  /**
   * {{> executeAsyncScript }}
   *
   * Asynchronous scripts can also be executed with `executeScript` if a function returns a Promise.
   */
  async executeAsyncScript(...args) {
    const asyncFn = function () {
      const args = Array.from(arguments);
      const fn = eval(`(${args.shift()})`); // eslint-disable-line no-eval
      return new Promise((done) => {
        args.push(done);
        fn.apply(null, args);
      });
    };
    args[0] = args[0].toString();
    args.unshift(asyncFn);
    return this.page.evaluate.apply(this.page, args);
  }

  /**
   * {{> grabTextFromAll }}
   * {{ react }}
   */
  async grabTextFromAll(locator) {
    const els = await this._locate(locator);
    const texts = [];
    for (const el of els) {
      texts.push(await (await el.getProperty('innerText')).jsonValue());
    }
    return texts;
  }

  /**
   * {{> grabTextFrom }}
   * {{ react }}
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
   * {{> grabValueFromAll }}
   */
  async grabValueFromAll(locator) {
    const els = await findFields.call(this, locator);
    const values = [];
    for (const el of els) {
      values.push(await (await el.getProperty('value')).jsonValue());
    }
    return values;
  }

  /**
   * {{> grabValueFrom }}
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
   * {{> grabHTMLFromAll }}
   */
  async grabHTMLFromAll(locator) {
    const els = await this._locate(locator);
    const values = await Promise.all(els.map(el => el.executionContext().evaluate(element => element.innerHTML, el)));
    return values;
  }

  /**
   * {{> grabHTMLFrom }}
   */
  async grabHTMLFrom(locator) {
    const html = await this.grabHTMLFromAll(locator);
    assertElementExists(html, locator);
    if (html.length > 1) {
      this.debugSection('GrabHTML', `Using first element out of ${html.length}`);
    }

    return html[0];
  }

  /**
   * {{> grabCssPropertyFromAll }}
   * {{ react }}
   */
  async grabCssPropertyFromAll(locator, cssProperty) {
    const els = await this._locate(locator);
    const res = await Promise.all(els.map(el => el.executionContext().evaluate(el => JSON.parse(JSON.stringify(getComputedStyle(el))), el)));
    const cssValues = res.map(props => props[toCamelCase(cssProperty)]);

    return cssValues;
  }

  /**
   * {{> grabCssPropertyFrom }}
   * {{ react }}
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
   * {{> seeCssPropertiesOnElements }}
   * {{ react }}
   */
  async seeCssPropertiesOnElements(locator, cssProperties) {
    const res = await this._locate(locator);
    assertElementExists(res, locator);

    const cssPropertiesCamelCase = convertCssPropertiesToCamelCase(cssProperties);
    const elemAmount = res.length;
    const commands = [];
    res.forEach((el) => {
      Object.keys(cssPropertiesCamelCase).forEach((prop) => {
        commands.push(el.executionContext()
          .evaluate((el) => {
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
   * {{ react }}
   */
  async seeAttributesOnElements(locator, attributes) {
    const res = await this._locate(locator);
    assertElementExists(res, locator);

    const elemAmount = res.length;
    const commands = [];
    res.forEach((el) => {
      Object.keys(attributes).forEach((prop) => {
        commands.push(el
          .executionContext()
          .evaluateHandle((el, attr) => el[attr] || el.getAttribute(attr), el, prop)
          .then(el => el.jsonValue()));
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
   * {{ react }}
   */
  async dragSlider(locator, offsetX = 0) {
    const src = await this._locate(locator);
    assertElementExists(src, locator, 'Slider Element');

    // Note: Using public api .clickablePoint because the .BoundingBox does not take into account iframe offsets!
    const sliderSource = await src[0].clickablePoint();

    // Drag start point
    await this.page.mouse.move(sliderSource.x, sliderSource.y, { steps: 5 });
    await this.page.mouse.down();

    // Drag destination
    await this.page.mouse.move(sliderSource.x + offsetX, sliderSource.y, { steps: 5 });
    await this.page.mouse.up();

    await this._waitForAction();
  }

  /**
   * {{> grabAttributeFromAll }}
   * {{ react }}
   */
  async grabAttributeFromAll(locator, attr) {
    const els = await this._locate(locator);
    const array = [];
    for (let index = 0; index < els.length; index++) {
      const a = await this._evaluateHandeInContext((el, attr) => el[attr] || el.getAttribute(attr), els[index], attr);
      array.push(await a.jsonValue());
    }
    return array;
  }

  /**
   * {{> grabAttributeFrom }}
   * {{ react }}
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
   * {{> saveElementScreenshot }}
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
    await this.context;
    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      const enabledFn = function (locator) {
        const els = document.querySelectorAll(locator);
        if (!els || els.length === 0) {
          return false;
        }
        return Array.prototype.filter.call(els, el => !el.disabled).length > 0;
      };
      waiter = context.waitForFunction(enabledFn, { timeout: waitTimeout }, locator.value);
    } else {
      const enabledFn = function (locator, $XPath) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).filter(el => !el.disabled).length > 0;
      };
      waiter = context.waitForFunction(enabledFn, { timeout: waitTimeout }, locator.value, $XPath.toString());
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
    await this.context;
    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      const valueFn = function (locator, value) {
        const els = document.querySelectorAll(locator);
        if (!els || els.length === 0) {
          return false;
        }
        return Array.prototype.filter.call(els, el => (el.value.toString() || '').indexOf(value) !== -1).length > 0;
      };
      waiter = context.waitForFunction(valueFn, { timeout: waitTimeout }, locator.value, value);
    } else {
      const valueFn = function (locator, $XPath, value) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).filter(el => (el.value || '').indexOf(value) !== -1).length > 0;
      };
      waiter = context.waitForFunction(valueFn, { timeout: waitTimeout }, locator.value, $XPath.toString(), value);
    }
    return waiter.catch((err) => {
      const loc = locator.toString();
      throw new Error(`element (${loc}) is not in DOM or there is no element(${loc}) with value "${value}" after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitNumberOfVisibleElements }}
   * {{ react }}
   */
  async waitNumberOfVisibleElements(locator, num, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');
    await this.context;
    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      const visibleFn = function (locator, num) {
        const els = document.querySelectorAll(locator);
        if (!els || els.length === 0) {
          return false;
        }
        return Array.prototype.filter.call(els, el => el.offsetParent !== null).length === num;
      };
      waiter = context.waitForFunction(visibleFn, { timeout: waitTimeout }, locator.value, num);
    } else {
      const visibleFn = function (locator, $XPath, num) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).filter(el => el.offsetParent !== null).length === num;
      };
      waiter = context.waitForFunction(visibleFn, { timeout: waitTimeout }, locator.value, $XPath.toString(), num);
    }
    return waiter.catch((err) => {
      throw new Error(`The number of elements (${locator.toString()}) is not ${num} after ${waitTimeout / 1000} sec\n${err.message}`);
    });
  }

  /**
   * {{> waitForClickable }}
   */
  async waitForClickable(locator, waitTimeout) {
    const els = await this._locate(locator);
    assertElementExists(els, locator);

    return this.waitForFunction(isElementClickable, [els[0]], waitTimeout).catch(async (e) => {
      if (/failed: timeout/i.test(e.message)) {
        throw new Error(`element ${new Locator(locator).toString()} still not clickable after ${waitTimeout || this.options.waitForTimeout / 1000} sec`);
      } else {
        throw e;
      }
    });
  }

  /**
   * {{> waitForElement }}
   * {{ react }}
   */
  async waitForElement(locator, sec) {
    const waitTimeout = sec ? sec * 1000 : this.options.waitForTimeout;
    locator = new Locator(locator, 'css');

    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      waiter = context.waitForSelector(locator.simplify(), { timeout: waitTimeout });
    } else {
      waiter = context.waitForXPath(locator.value, { timeout: waitTimeout });
    }
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
    await this.context;
    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      waiter = context.waitForSelector(locator.simplify(), { timeout: waitTimeout, visible: true });
    } else {
      waiter = context.waitForXPath(locator.value, { timeout: waitTimeout, visible: true });
    }
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
    await this.context;
    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      waiter = context.waitForSelector(locator.simplify(), { timeout: waitTimeout, hidden: true });
    } else {
      waiter = context.waitForXPath(locator.value, { timeout: waitTimeout, hidden: true });
    }
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
    let waiter;
    const context = await this._getContext();
    if (locator.isCSS()) {
      waiter = context.waitForSelector(locator.simplify(), { timeout: waitTimeout, hidden: true });
    } else {
      waiter = context.waitForXPath(locator.value, { timeout: waitTimeout, hidden: true });
    }
    return waiter.catch((err) => {
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
    }, { timeout: waitTimeout }, urlPart).catch(async (e) => {
      const currUrl = await this._getPageUrl(); // Required because the waitForFunction can't return data.
      if (/failed: timeout/i.test(e.message)) {
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
    }, { timeout: waitTimeout }, urlPart).catch(async (e) => {
      const currUrl = await this._getPageUrl(); // Required because the waitForFunction can't return data.
      if (/failed: timeout/i.test(e.message)) {
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
      if (locator.isCSS()) {
        waiter = contextObject.waitForFunction((locator, text) => {
          const el = document.querySelector(locator);
          if (!el) return false;
          return el.innerText.indexOf(text) > -1;
        }, { timeout: waitTimeout }, locator.value, text);
      }

      if (locator.isXPath()) {
        waiter = contextObject.waitForFunction((locator, text, $XPath) => {
          eval($XPath); // eslint-disable-line no-eval
          const el = $XPath(null, locator);
          if (!el.length) return false;
          return el[0].innerText.indexOf(text) > -1;
        }, { timeout: waitTimeout }, locator.value, text, $XPath.toString());
      }
    } else {
      waiter = contextObject.waitForFunction(text => document.body && document.body.innerText.indexOf(text) > -1, { timeout: waitTimeout }, text);
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
   * Waits for a network response.
   *
   * ```js
   * I.waitForResponse('http://example.com/resource');
   * I.waitForResponse(response => response.url() === 'http://example.com' && response.request().method() === 'GET');
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
      } else {
        throw new Error('Element #invalidIframeSelector was not found by text|CSS|XPath');
      }
      return;
    }
    if (!locator) {
      this.context = await this.page.mainFrame().$('body');
      return;
    }

    // iframe by selector
    const els = await this._locate(locator);
    assertElementExists(els, locator);
    const contentFrame = await els[0].contentFrame();

    if (contentFrame) {
      this.context = contentFrame;
    } else {
      this.context = els[0];
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
    return context.waitForFunction(fn, { timeout: waitTimeout }, ...args);
  }

  /**
   * Waits for navigation to finish. By default takes configured `waitForNavigation` option.
   *
   * See [Pupeteer's reference](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagewaitfornavigationoptions)
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
    if (locator.isCSS()) {
      const visibleFn = function (locator) {
        return document.querySelector(locator) === null;
      };
      waiter = context.waitForFunction(visibleFn, { timeout: waitTimeout }, locator.value);
    } else {
      const visibleFn = function (locator, $XPath) {
        eval($XPath); // eslint-disable-line no-eval
        return $XPath(null, locator).length === 0;
      };
      waiter = context.waitForFunction(visibleFn, { timeout: waitTimeout }, locator.value, $XPath.toString());
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

module.exports = Puppeteer;

async function findElements(matcher, locator) {
  if (locator.react) return findReact(matcher, locator);
  locator = new Locator(locator, 'css');
  if (!locator.isXPath()) return matcher.$$(locator.simplify());
  return matcher.$x(locator.value);
}

async function proceedClick(locator, context = null, options = {}) {
  let matcher = await this.context;
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
  await els[0].click(options);
  const promises = [];
  if (options.waitForNavigation) {
    promises.push(this.waitForNavigation());
  }
  promises.push(this._waitForAction());
  return Promise.all(promises);
}

async function findClickable(matcher, locator) {
  if (locator.react) return findReact(matcher, locator);
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

  // Note: Using public api .clickablePoint becaues the .BoundingBox does not take into account iframe offsets!
  const dragSource = await src[0].clickablePoint();
  const dragDestination = await dst[0].clickablePoint();

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
      .then(context => this.context = context);
  });
  page.on('console', (msg) => {
    this.debugSection(`Browser:${ucfirst(msg.type())}`, (msg._text || '') + msg.args().join(' '));
    consoleLogStore.add(msg);
  });

  if (this.options.userAgent) {
    await page.setUserAgent(this.options.userAgent);
  }
  if (this.options.windowSize && this.options.windowSize.indexOf('x') > 0) {
    const dimensions = this.options.windowSize.split('x');
    const width = parseInt(dimensions[0], 10);
    const height = parseInt(dimensions[1], 10);
    await page.setViewport({ width, height });
  }
}

// List of key values to key definitions
// https://github.com/GoogleChrome/puppeteer/blob/v1.20.0/lib/USKeyboardLayout.js
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
