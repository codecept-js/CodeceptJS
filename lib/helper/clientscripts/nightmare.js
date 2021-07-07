if (!window.codeceptjs) {
  /**
   * @alias CodeceptJS.browserCodecept
   * @namespace
   */
  const codeceptjs = {};

  /**
   * all found elements are stored here for reuse
   * @inner
   * @type {Node[]}
   */
  codeceptjs.elements = [];

  /**
   * global context changer
   * @inner
   * @type {?Node}
   */
  codeceptjs.within = null;

  // save
  const storeElement = function (el) {
    if (!el) return;
    return codeceptjs.elements.push(el) - 1; // return index
  };

  const storeElements = function (els) {
    return els.map(el => storeElement(el));
  };

  const blurActiveElement = function () {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  /**
   * finders
   * @param {number} id
   * @return {Node}
   */
  codeceptjs.fetchElement = function (id) {
    if (!this.elements[id]) throw new Error(`Element (${id}) is not accessible`);
    return this.elements[id];
  };

  /**
   * @param   {string}  by
   * @param   {CodeceptJS.ILocator}  locator
   * @param   {*}  [contextEl]
   * @return  {number[]}
   */
  codeceptjs.findAndStoreElements = function (by, locator, contextEl) {
    return storeElements(this.findElements(by, locator, contextEl));
  };

  /**
   * @param   {string}  by
   * @param   {CodeceptJS.ILocator}  locator
   * @param   {*}  [contextEl]
   * @return  {number | undefined}
   */
  codeceptjs.findAndStoreElement = function (by, locator, contextEl) {
    return storeElement(this.findElement(by, locator, contextEl));
  };

  /**
   * @param {string} by
   * @param {CodeceptJS.ILocator} locator
   */
  codeceptjs.setWithin = function (by, locator) {
    this.within = this.findElement(by, locator);
  };

  /**
   * @param   {string}  by
   * @param   {CodeceptJS.ILocator}  locator
   * @param   {*}  [contextEl]
   * @return  {Node[]}
   */
  codeceptjs.findElements = function (by, locator, contextEl) {
    let context;
    if (typeof contextEl !== 'number') {
      context = this.within || document;
    } else {
      context = this.fetchElement(contextEl);
    }

    if (by === 'name') {
      by = 'css';
      locator = `*[name="${locator}"]`;
    }
    if (by === 'id') {
      by = 'css';
      locator = `#${locator}`;
    }

    if (by === 'css') {
      const found = context.querySelectorAll(locator);
      const res = [];
      for (let i = 0; i < found.length; i++) {
        res.push(found[i]);
      }
      return res;
    }

    if (by === 'xpath') {
      const found = document.evaluate(locator, context, null, 5, null);
      const res = [];
      let current = null;
      while (current = found.iterateNext()) {
        res.push(current);
      }
      return res;
    }

    if (by === 'frame') {
      if (!Array.isArray(locator)) locator = [locator];
      return [locator.reduce((parent, child) => parent.querySelector(child).contentDocument, window.document).querySelector('body')];
    }
    return [];
  };

  /**
   * @param   {string}  by
   * @param   {CodeceptJS.ILocator}  locator
   * @param   {*}  [context]
   * @return  {?Node}
   */
  codeceptjs.findElement = function (by, locator, context) {
    return this.findElements(by, locator, context)[0] || null;
  };

  // actions
  /**
   * @param {number} el
   * @return {boolean}
   */
  codeceptjs.clickEl = function (el) {
    blurActiveElement();
    const event = document.createEvent('MouseEvent');
    event.initEvent('click', true, true);
    return this.fetchElement(el).dispatchEvent(event);
  };

  /** @param {number} el */
  codeceptjs.doubleClickEl = function (el) {
    blurActiveElement();
    const event = document.createEvent('MouseEvent');
    event.initEvent('dblclick', true, true);
    this.fetchElement(el).dispatchEvent(event);
  };

  /**
   * @param {number} el
   * @param {number | undefined} x
   * @param {number | undefined} y
   */
  codeceptjs.hoverEl = function (el, x, y) {
    blurActiveElement();

    const event = new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      screenX: x,
      screenY: y,
      clientX: x,
      clientY: y,
    });

    this.fetchElement(el).dispatchEvent(event);
  };

  /** @param {number} el */
  codeceptjs.rightClickEl = function (el) {
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      view: window,
      buttons: 2,
    });

    this.fetchElement(el).dispatchEvent(event);
  };

  /**
   * @param {number} el
   * @return {boolean  |  undefined}
   */
  codeceptjs.checkEl = function (el) {
    const element = this.fetchElement(el);
    const event = document.createEvent('HTMLEvents');
    if (element.checked) return;
    element.checked = true;
    event.initEvent('change', true, true);
    return element.dispatchEvent(event);
  };

  /**
   * @param {number} el
   * @return {boolean}
   */
  codeceptjs.unCheckEl = function (el) {
    const element = this.fetchElement(el);
    const event = document.createEvent('HTMLEvents');
    element.checked = false;
    event.initEvent('change', true, true);
    return element.dispatchEvent(event);
  };

  window.codeceptjs = codeceptjs;
}
