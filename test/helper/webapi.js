const assert = require('assert');
const path = require('path');

const dataFile = path.join(__dirname, '/../data/app/db');
const formContents = require('../../lib/utils').test.submittedData(dataFile);
const fileExists = require('../../lib/utils').fileExists;
const secret = require('../../lib/secret').secret;

const Locator = require('../../lib/locator');
const customLocators = require('../../lib/plugin/customLocator');

let originalLocators;
let I;
let data;
let siteUrl;

module.exports.init = function (testData) {
  data = testData;
};

module.exports.tests = function () {
  const isHelper = helperName => I.constructor.name === helperName;

  beforeEach(() => {
    I = data.I;
    siteUrl = data.siteUrl;
    if (fileExists(dataFile)) require('fs').unlinkSync(dataFile);
  });

  describe('#saveElementScreenshot', () => {
    beforeEach(() => {
      global.output_dir = path.join(global.codecept_dir, 'output');
    });

    it('should create a screenshot file in output dir of element', async () => {
      await I.amOnPage('/form/field');
      await I.seeElement('input[name=\'name\']');
      const sec = (new Date()).getUTCMilliseconds();
      await I.saveElementScreenshot('input[name=\'name\']', `element_screenshot_${sec}.png`);
      assert.ok(fileExists(path.join(global.output_dir, `element_screenshot_${sec}.png`)), null, 'file does not exists');
    });
  });

  describe('current url : #seeInCurrentUrl, #seeCurrentUrlEquals, #grabCurrentUrl, ...', () => {
    it('should check for url fragment', async () => {
      await I.amOnPage('/form/checkbox');
      await I.seeInCurrentUrl('/form');
      await I.dontSeeInCurrentUrl('/user');
    });

    it('should check for equality', async () => {
      await I.amOnPage('/info');
      await I.seeCurrentUrlEquals('/info');
      await I.dontSeeCurrentUrlEquals('form');
    });

    it('should check for equality in absolute urls', async () => {
      await I.amOnPage('/info');
      await I.seeCurrentUrlEquals(`${siteUrl}/info`);
      await I.dontSeeCurrentUrlEquals(`${siteUrl}/form`);
    });

    it('should grab browser url', async () => {
      await I.amOnPage('/info');
      const url = await I.grabCurrentUrl();
      assert.equal(url, `${siteUrl}/info`);
    });
  });

  describe('#waitInUrl, #waitUrlEquals', () => {
    it('should wait part of the URL to match the expected', async () => {
      if (isHelper('Nightmare')) return;

      try {
        await I.amOnPage('/info');
        await I.waitInUrl('/info');
        await I.waitInUrl('/info2', 0.1);
      } catch (e) {
        assert.equal(e.message, `expected url to include /info2, but found ${siteUrl}/info`);
      }
    });

    it('should wait for the entire URL to match the expected', async () => {
      if (isHelper('Nightmare')) return;

      try {
        await I.amOnPage('/info');
        await I.waitUrlEquals('/info');
        await I.waitUrlEquals(`${siteUrl}/info`);
        await I.waitUrlEquals('/info2', 0.1);
      } catch (e) {
        assert.equal(e.message, `expected url to be ${siteUrl}/info2, but found ${siteUrl}/info`);
      }
    });
  });

  describe('see text : #see', () => {
    it('should check text on site', async () => {
      await I.amOnPage('/');
      await I.see('Welcome to test app!');
      await I.see('A wise man said: "debug!"');
      await I.dontSee('Info');
    });

    it('should check text inside element', async () => {
      await I.amOnPage('/');
      await I.see('Welcome to test app!', 'h1');
      await I.amOnPage('/info');
      await I.see('valuable', { css: 'p' });
      await I.see('valuable', '//body/p');
      await I.dontSee('valuable', 'h1');
    });

    it('should verify non-latin chars', async () => {
      await I.amOnPage('/info');
      await I.see('на');
      await I.see("Don't do that at home!", 'h3');
      await I.see('Текст', 'p');
    });
  });

  describe('see element : #seeElement, #seeElementInDOM, #dontSeeElement', () => {
    it('should check visible elements on page', async () => {
      await I.amOnPage('/form/field');
      await I.seeElement('input[name=name]');
      await I.seeElement({ name: 'name' });
      await I.seeElement('//input[@id="name"]');
      await I.dontSeeElement('#something-beyond');
      await I.dontSeeElement('//input[@id="something-beyond"]');
    });

    it('should check elements are in the DOM', async () => {
      await I.amOnPage('/form/field');
      await I.seeElementInDOM('input[name=name]');
      await I.seeElementInDOM('//input[@id="name"]');
      await I.dontSeeElementInDOM('#something-beyond');
      await I.dontSeeElementInDOM('//input[@id="something-beyond"]');
    });

    it('should check elements are visible on the page', async () => {
      await I.amOnPage('/form/field');
      await I.seeElementInDOM('input[name=email]');
      await I.dontSeeElement('input[name=email]');
      await I.dontSeeElement('#something-beyond');
    });
  });

  describe('#seeNumberOfVisibleElements', () => {
    it('should check number of visible elements for given locator', async () => {
      await I.amOnPage('/info');
      await I.seeNumberOfVisibleElements('//div[@id = "grab-multiple"]//a', 3);
    });
  });

  describe('#grabNumberOfVisibleElements', () => {
    it('should grab number of visible elements for given locator', async () => {
      await I.amOnPage('/info');
      const num = await I.grabNumberOfVisibleElements('//div[@id = "grab-multiple"]//a');
      assert.equal(num, 3);
    });

    it('should support locators like {xpath:"//div"}', async () => {
      await I.amOnPage('/info');
      const num = await I.grabNumberOfVisibleElements({
        xpath: '//div[@id = "grab-multiple"]//a',
      });
      assert.equal(num, 3);
    });

    it('should grab number of visible elements for given css locator', async () => {
      await I.amOnPage('/info');
      const num = await I.grabNumberOfVisibleElements('[id=grab-multiple] a');
      assert.equal(num, 3);
    });

    it('should return 0 for non-existing elements', async () => {
      await I.amOnPage('/info');
      const num = await I.grabNumberOfVisibleElements('button[type=submit]');
      assert.equal(num, 0);
    });
  });

  describe('#seeInSource, #dontSeeInSource', () => {
    it('should check meta of a page', async () => {
      await I.amOnPage('/info');
      await I.seeInSource('<body>');
      await I.dontSeeInSource('<meta>');
      await I.seeInSource('Invisible text');
      await I.seeInSource('content="text/html; charset=utf-8"');
    });
  });

  describe('#click', () => {
    it('should click by inner text', async () => {
      await I.amOnPage('/');
      await I.click('More info');
      await I.seeInCurrentUrl('/info');
    });

    it('should click by css', async () => {
      await I.amOnPage('/');
      await I.click('#link');
      await I.seeInCurrentUrl('/info');
    });

    it('should click by xpath', async () => {
      await I.amOnPage('/');
      await I.click('//a[@id="link"]');
      await I.seeInCurrentUrl('/info');
    });

    it('should click by name', async () => {
      await I.amOnPage('/form/button');
      await I.click('btn0');
      assert.equal(formContents('text'), 'val');
    });

    it('should click on context', async () => {
      await I.amOnPage('/');
      await I.click('More info', 'body>p');
      await I.seeInCurrentUrl('/info');
    });

    it('should not click wrong context', async () => {
      let err = false;
      await I.amOnPage('/');
      try {
        await I.click('More info', '#area1');
      } catch (e) {
        err = true;
      }

      assert.ok(err);
    });

    it('should should click by aria-label', async () => {
      await I.amOnPage('/form/aria');
      await I.click('get info');
      await I.seeInCurrentUrl('/info');
    });

    it('should click link with inner span', async () => {
      await I.amOnPage('/form/example7');
      await I.click('Buy Chocolate Bar');
      await I.seeCurrentUrlEquals('/');
    });

    it('should click link with xpath locator', async () => {
      await I.amOnPage('/form/example7');
      await I.click({
        xpath: '(//*[@title = "Chocolate Bar"])[1]',
      });
      await I.seeCurrentUrlEquals('/');
    });
  });

  describe('#forceClick', () => {
    beforeEach(function () {
      if (isHelper('Protractor')) this.skip();
      if (isHelper('TestCafe')) this.skip();
    });

    it('should forceClick by inner text', async () => {
      if (isHelper('Nightmare')) return;
      await I.amOnPage('/');
      await I.forceClick('More info');
      if (isHelper('Puppeteer')) await I.waitForNavigation();
      await I.seeInCurrentUrl('/info');
    });

    it('should forceClick by css', async () => {
      if (isHelper('Nightmare')) return;
      await I.amOnPage('/');
      await I.forceClick('#link');
      if (isHelper('Puppeteer')) await I.waitForNavigation();
      await I.seeInCurrentUrl('/info');
    });

    it('should forceClick by xpath', async () => {
      if (isHelper('Nightmare')) return;
      await I.amOnPage('/');
      await I.forceClick('//a[@id="link"]');
      if (isHelper('Puppeteer')) await I.waitForNavigation();
      await I.seeInCurrentUrl('/info');
    });

    it('should forceClick on context', async () => {
      if (isHelper('Nightmare')) return;
      await I.amOnPage('/');
      await I.forceClick('More info', 'body>p');
      if (isHelper('Puppeteer')) await I.waitForNavigation();
      await I.seeInCurrentUrl('/info');
    });
  });

  // Could not get double click to work
  describe('#doubleClick', () => {
    it('it should doubleClick', async () => {
      await I.amOnPage('/form/doubleclick');
      await I.dontSee('Done');
      await I.doubleClick('#block');
      await I.see('Done');
    });
  });

  // rightClick does not seem to work either
  describe('#rightClick', () => {
    it('it should rightClick', async () => {
      await I.amOnPage('/form/rightclick');
      await I.dontSee('right clicked');
      await I.rightClick('Lorem Ipsum');
      await I.see('right clicked');
    });

    it('it should rightClick by locator', async () => {
      await I.amOnPage('/form/rightclick');
      await I.dontSee('right clicked');
      await I.rightClick('.context a');
      await I.see('right clicked');
    });

    it('it should rightClick by locator and context', async () => {
      await I.amOnPage('/form/rightclick');
      await I.dontSee('right clicked');
      await I.rightClick('Lorem Ipsum', '.context');
      await I.see('right clicked');
    });
  });

  describe('#checkOption', () => {
    it('should check option by css', async () => {
      await I.amOnPage('/form/checkbox');
      await I.checkOption('#checkin');
      await I.click('Submit');
      await I.wait(1);
      assert.equal(formContents('terms'), 'agree');
    });

    it('should check option by strict locator', async () => {
      await I.amOnPage('/form/checkbox');
      await I.checkOption({
        id: 'checkin',
      });
      await I.click('Submit');
      assert.equal(formContents('terms'), 'agree');
    });

    it('should check option by name', async () => {
      await I.amOnPage('/form/checkbox');
      await I.checkOption('terms');
      await I.click('Submit');
      assert.equal(formContents('terms'), 'agree');
    });

    it('should check option by label', async () => {
      await I.amOnPage('/form/checkbox');
      await I.checkOption('I Agree');
      await I.click('Submit');
      assert.equal(formContents('terms'), 'agree');
    });

    // TODO Having problems with functional style selectors in testcafe
    // cannot do Selector(css).find(elementByXPath(xpath))
    // testcafe always says "xpath is not defined"
    // const el = Selector(context).find(elementByXPath(Locator.checkable.byText(xpathLocator.literal(field))).with({ boundTestRun: this.t })).with({ boundTestRun: this.t });
    it.skip('should check option by context', async () => {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/example1');
      await I.checkOption('Remember me next time', '.rememberMe');
      await I.click('Login');
      assert.equal(formContents('LoginForm').rememberMe, 1);
    });
  });

  describe('#uncheckOption', () => {
    it('should uncheck option that is currently checked', async () => {
      await I.amOnPage('/info');
      await I.uncheckOption('interesting');
      await I.dontSeeCheckboxIsChecked('interesting');
    });
  });

  describe('#selectOption', () => {
    it('should select option by css', async () => {
      await I.amOnPage('/form/select');
      await I.selectOption('form select[name=age]', 'adult');
      await I.click('Submit');
      assert.equal(formContents('age'), 'adult');
    });

    it('should select option by name', async () => {
      await I.amOnPage('/form/select');
      await I.selectOption('age', 'adult');
      await I.click('Submit');
      assert.equal(formContents('age'), 'adult');
    });

    it('should select option by label', async () => {
      await I.amOnPage('/form/select');
      await I.selectOption('Select your age', 'dead');
      await I.click('Submit');
      assert.equal(formContents('age'), 'dead');
    });

    it('should select option by label and option text', async () => {
      await I.amOnPage('/form/select');
      await I.selectOption('Select your age', '21-60');
      await I.click('Submit');
      assert.equal(formContents('age'), 'adult');
    });

    it('should select option by label and option text - with an onchange callback', async () => {
      await I.amOnPage('/form/select_onchange');
      await I.selectOption('Select a value', 'Option 2');
      await I.click('Submit');
      assert.equal(formContents('select'), 'option2');
    });

    // Could not get multiselect to work with testcafe
    it('should select multiple options', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/select_multiple');
      await I.selectOption('What do you like the most?', ['Play Video Games', 'Have Sex']);
      await I.click('Submit');
      assert.deepEqual(formContents('like'), ['play', 'adult']);
    });
  });

  describe('#executeScript', () => {
    it('should execute synchronous script', async () => {
      await I.amOnPage('/');
      await I.executeScript(() => {
        document.getElementById('link').innerHTML = 'Appended';
      });
      await I.see('Appended', 'a');
    });

    it('should return value from sync script', async () => {
      await I.amOnPage('/');
      const val = await I.executeScript(a => a + 5, 5);
      assert.equal(val, 10);
    });

    it('should return value from sync script in iframe', async function () {
      if (isHelper('Nightmare')) return; // TODO Not yet implemented
      if (isHelper('TestCafe')) this.skip(); // TODO Not yet implemented

      await I.amOnPage('/iframe');
      await I.switchTo('iframe');
      const val = await I.executeScript(() => document.getElementsByTagName('h1')[0].innerText);
      assert.equal(val, 'Information');
    });

    it('should execute async script', async function () {
      if (isHelper('TestCafe')) this.skip(); // TODO Not yet implemented
      if (isHelper('Playwright')) return; // It won't be implemented

      await I.amOnPage('/');
      const val = await I.executeAsyncScript((val, done) => {
        setTimeout(() => {
          document.getElementById('link').innerHTML = val;
          done(5);
        }, 100);
      }, 'Timeout');
      assert.equal(val, 5);
      await I.see('Timeout', 'a');
    });
  });

  describe('#fillField, #appendField', () => {
    it('should fill input fields', async () => {
      await I.amOnPage('/form/field');
      await I.fillField('Name', 'Nothing special');
      await I.click('Submit');
      assert.equal(formContents('name'), 'Nothing special');
    });

    it('should fill input fields with secrets', async () => {
      await I.amOnPage('/form/field');
      await I.fillField('Name', secret('Something special'));
      await I.click('Submit');
      assert.equal(formContents('name'), 'Something special');
    });

    it('should fill field by css', async () => {
      await I.amOnPage('/form/field');
      await I.fillField('#name', 'Nothing special');
      await I.click('Submit');
      assert.equal(formContents('name'), 'Nothing special');
    });

    it('should fill field by strict locator', async () => {
      await I.amOnPage('/form/field');
      await I.fillField({
        id: 'name',
      }, 'Nothing special');
      await I.click('Submit');
      assert.equal(formContents('name'), 'Nothing special');
    });

    it('should fill field by name', async () => {
      await I.amOnPage('/form/example1');
      await I.fillField('LoginForm[username]', 'davert');
      await I.fillField('LoginForm[password]', '123456');
      await I.click('Login');
      assert.equal(formContents('LoginForm').username, 'davert');
      assert.equal(formContents('LoginForm').password, '123456');
    });

    it('should fill textarea by css', async () => {
      await I.amOnPage('/form/textarea');
      await I.fillField('textarea', 'Nothing special');
      await I.click('Submit');
      assert.equal(formContents('description'), 'Nothing special');
    });

    it('should fill textarea by label', async () => {
      await I.amOnPage('/form/textarea');
      await I.fillField('Description', 'Nothing special');
      await I.click('Submit');
      assert.equal(formContents('description'), 'Nothing special');
    });

    it('should fill input by aria-label and aria-labelledby', async () => {
      await I.amOnPage('/form/aria');
      await I.fillField('My Address', 'Home Sweet Home');
      await I.fillField('Phone', '123456');
      await I.click('Submit');
      assert.equal(formContents('my-form-phone'), '123456');
      assert.equal(formContents('my-form-address'), 'Home Sweet Home');
    });

    it('should fill textarea by overwritting the existing value', async () => {
      await I.amOnPage('/form/textarea');
      await I.fillField('Description', 'Nothing special');
      await I.fillField('Description', 'Some other text');
      await I.click('Submit');
      assert.equal(formContents('description'), 'Some other text');
    });

    it('should append field value', async () => {
      await I.amOnPage('/form/field');
      await I.appendField('Name', '_AND_NEW');
      await I.click('Submit');
      assert.equal(formContents('name'), 'OLD_VALUE_AND_NEW');
    });

    it('should not fill invisible fields', async () => {
      if (isHelper('Playwright')) return; // It won't be implemented
      await I.amOnPage('/form/field');
      await assert.rejects(I.fillField('email', 'test@1234'));
    });
  });

  describe('#clearField', () => {
    it('should clear a given element', async () => {
      await I.amOnPage('/form/field');
      await I.fillField('#name', 'Nothing special');
      await I.seeInField('#name', 'Nothing special');
      await I.clearField('#name');
      await I.dontSeeInField('#name', 'Nothing special');
    });

    it('should clear field by name', async () => {
      await I.amOnPage('/form/example1');
      await I.clearField('LoginForm[username]');
      await I.click('Login');
      assert.equal(formContents('LoginForm').username, '');
    });

    it('should clear field by locator', async () => {
      await I.amOnPage('/form/example1');
      await I.clearField('#LoginForm_username');
      await I.click('Login');
      assert.equal(formContents('LoginForm').username, '');
    });
  });

  describe('#type', () => {
    it('should type into a field', async function () {
      if (isHelper('TestCafe')) this.skip();
      if (isHelper('Nightmare')) return;
      if (isHelper('Protractor')) this.skip();

      await I.amOnPage('/form/field');
      await I.click('Name');

      await I.type('Type Test');
      await I.seeInField('Name', 'Type Test');

      await I.fillField('Name', '');

      await I.type(['T', 'y', 'p', 'e', '2']);
      await I.seeInField('Name', 'Type2');
    });

    it('should use delay to slow down typing', async function () {
      if (isHelper('TestCafe')) this.skip();
      if (isHelper('Nightmare')) return;
      if (isHelper('Protractor')) this.skip();

      await I.amOnPage('/form/field');
      await I.fillField('Name', '');
      const time = Date.now();
      await I.type('12345', 100);
      await I.seeInField('Name', '12345');
      assert(Date.now() - time > 500);
    });
  });

  describe('check fields: #seeInField, #seeCheckboxIsChecked, ...', () => {
    it('should check for empty field', async () => {
      await I.amOnPage('/form/empty');
      await I.seeInField('#empty_input', '');
    });

    it('should check for empty textarea', async () => {
      await I.amOnPage('/form/empty');
      await I.seeInField('#empty_textarea', '');
    });

    it('should check field equals', async () => {
      await I.amOnPage('/form/field');
      await I.seeInField('Name', 'OLD_VALUE');
      await I.seeInField('name', 'OLD_VALUE');
      await I.seeInField('//input[@id="name"]', 'OLD_VALUE');
      await I.dontSeeInField('//input[@id="name"]', 'NOtVALUE');
    });

    it('should check textarea equals', async () => {
      await I.amOnPage('/form/textarea');
      await I.seeInField('Description', 'sunrise');
      await I.seeInField('textarea', 'sunrise');
      await I.seeInField('//textarea[@id="description"]', 'sunrise');
      await I.dontSeeInField('//textarea[@id="description"]', 'sunset');
    });

    it('should check checkbox is checked :)', async () => {
      await I.amOnPage('/info');
      await I.seeCheckboxIsChecked('input[type=checkbox]');
    });

    it('should check checkbox is not checked', async () => {
      await I.amOnPage('/form/checkbox');
      await I.dontSeeCheckboxIsChecked('#checkin');
    });

    it('should match fields with the same name', async () => {
      await I.amOnPage('/form/example20');
      await I.seeInField("//input[@name='txtName'][2]", 'emma');
      await I.seeInField("input[name='txtName']:nth-child(2)", 'emma');
    });
  });

  describe('#grabTextFromAll, #grabHTMLFromAll, #grabValueFromAll, #grabAttributeFromAll', () => {
    it('should grab multiple texts from page', async () => {
      await I.amOnPage('/info');
      let vals = await I.grabTextFromAll('#grab-multiple a');
      assert.equal(vals[0], 'First');
      assert.equal(vals[1], 'Second');
      assert.equal(vals[2], 'Third');

      await I.amOnPage('/info');
      vals = await I.grabTextFromAll('#invalid-id a');
      assert.equal(vals.length, 0);
    });

    it('should grab multiple html from page', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/info');
      let vals = await I.grabHTMLFromAll('#grab-multiple a');
      assert.equal(vals[0], 'First');
      assert.equal(vals[1], 'Second');
      assert.equal(vals[2], 'Third');

      await I.amOnPage('/info');
      vals = await I.grabHTMLFromAll('#invalid-id a');
      assert.equal(vals.length, 0);
    });

    it('should grab multiple attribute from element', async () => {
      await I.amOnPage('/form/empty');
      const vals = await I.grabAttributeFromAll({
        css: 'input',
      }, 'name');
      assert.equal(vals[0], 'text');
      assert.equal(vals[1], 'empty_input');
    });

    it('Should return empty array if no attribute found', async () => {
      await I.amOnPage('/form/empty');
      const vals = await I.grabAttributeFromAll({
        css: 'div',
      }, 'test');
      assert.equal(vals.length, 0);
    });

    it('should grab values if multiple field matches', async () => {
      await I.amOnPage('/form/hidden');
      let vals = await I.grabValueFromAll('//form/input');
      assert.equal(vals[0], 'kill_people');
      assert.equal(vals[1], 'Submit');

      vals = await I.grabValueFromAll("//form/input[@name='action']");
      assert.equal(vals[0], 'kill_people');
    });

    it('Should return empty array if no value found', async () => {
      await I.amOnPage('/');
      const vals = await I.grabValueFromAll('//form/input');
      assert.equal(vals.length, 0);
    });
  });

  describe('#grabTextFrom, #grabHTMLFrom, #grabValueFrom, #grabAttributeFrom', () => {
    it('should grab text from page', async () => {
      await I.amOnPage('/');
      let val = await I.grabTextFrom('h1');
      assert.equal(val, 'Welcome to test app!');

      val = await I.grabTextFrom('//h1');
      assert.equal(val, 'Welcome to test app!');
    });

    it('should grab html from page', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/info');
      const val = await I.grabHTMLFrom('#grab-multiple');
      assert.equal(`
    <a id="first-link">First</a>
    <a id="second-link">Second</a>
    <a id="third-link">Third</a>
`, val);
    });

    it('should grab value from field', async () => {
      await I.amOnPage('/form/hidden');
      let val = await I.grabValueFrom('#action');
      assert.equal(val, 'kill_people');
      val = await I.grabValueFrom("//form/input[@name='action']");
      assert.equal(val, 'kill_people');
      await I.amOnPage('/form/textarea');
      val = await I.grabValueFrom('#description');
      assert.equal(val, 'sunrise');
      await I.amOnPage('/form/select');
      val = await I.grabValueFrom('#age');
      assert.equal(val, 'oldfag');
    });

    it('should grab attribute from element', async () => {
      await I.amOnPage('/search');
      const val = await I.grabAttributeFrom({
        css: 'form',
      }, 'method');
      assert.equal(val, 'get');
    });

    it('should grab custom attribute from element', async () => {
      await I.amOnPage('/form/example4');
      const val = await I.grabAttributeFrom({
        css: '.navbar-toggle',
      }, 'data-toggle');
      assert.equal(val, 'collapse');
    });
  });

  describe('page title : #seeTitle, #dontSeeTitle, #grabTitle', () => {
    it('should check page title', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/');
      await I.seeInTitle('TestEd Beta 2.0');
      await I.dontSeeInTitle('Welcome to test app');
      await I.amOnPage('/info');
      await I.dontSeeInTitle('TestEd Beta 2.0');
    });

    it('should grab page title', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/');
      const val = await I.grabTitle();
      assert.equal(val, 'TestEd Beta 2.0');
    });
  });

  describe('#attachFile', () => {
    it('should upload file located by CSS', async () => {
      await I.amOnPage('/form/file');
      await I.attachFile('#avatar', 'app/avatar.jpg');
      await I.click('Submit');
      await I.see('Thank you');
      formContents().files.should.have.key('avatar');
      formContents().files.avatar.name.should.eql('avatar.jpg');
      formContents().files.avatar.type.should.eql('image/jpeg');
    });

    it('should upload file located by label', async () => {
      if (isHelper('Nightmare')) return;

      await I.amOnPage('/form/file');
      await I.attachFile('Avatar', 'app/avatar.jpg');
      await I.click('Submit');
      await I.see('Thank you');
      formContents().files.should.have.key('avatar');
      formContents().files.avatar.name.should.eql('avatar.jpg');
      formContents().files.avatar.type.should.eql('image/jpeg');
    });
  });

  describe('#saveScreenshot', () => {
    beforeEach(() => {
      global.output_dir = path.join(global.codecept_dir, 'output');
    });

    it('should create a screenshot file in output dir', async () => {
      const sec = (new Date()).getUTCMilliseconds();
      await I.amOnPage('/');
      await I.saveScreenshot(`screenshot_${sec}.png`);
      assert.ok(fileExists(path.join(global.output_dir, `screenshot_${sec}.png`)), null, 'file does not exists');
    });

    it('should create a full page screenshot file in output dir', async () => {
      const sec = (new Date()).getUTCMilliseconds();
      await I.amOnPage('/');
      await I.saveScreenshot(`screenshot_full_${+sec}.png`, true);
      assert.ok(fileExists(path.join(global.output_dir, `screenshot_full_${+sec}.png`)), null, 'file does not exists');
    });
  });

  describe('cookies : #setCookie, #clearCookies, #seeCookie', () => {
    it('should do all cookie stuff', async () => {
      await I.amOnPage('/');
      await I.setCookie({
        name: 'auth',
        value: '123456',
        url: 'http://localhost',
      });
      await I.seeCookie('auth');
      await I.dontSeeCookie('auuth');

      const cookie = await I.grabCookie('auth');
      assert.equal(cookie.value, '123456');

      await I.clearCookie('auth');
      await I.dontSeeCookie('auth');
    });

    it('should grab all cookies', async () => {
      await I.amOnPage('/');
      await I.setCookie({
        name: 'auth',
        value: '123456',
        url: 'http://localhost',
      });
      await I.setCookie({
        name: 'user',
        value: 'davert',
        url: 'http://localhost',
      });

      const cookies = await I.grabCookie();
      assert.equal(cookies.length, 2);
      assert(cookies[0].name);
      assert(cookies[0].value);
    });

    it('should clear all cookies', async () => {
      await I.amOnPage('/');
      await I.setCookie({
        name: 'auth',
        value: '123456',
        url: 'http://localhost',
      });
      await I.clearCookie();
      await I.dontSeeCookie('auth');
    });
  });

  describe('#waitForText', () => {
    it('should wait for text', async () => {
      await I.amOnPage('/dynamic');
      await I.dontSee('Dynamic text');
      await I.waitForText('Dynamic text', 2);
      await I.see('Dynamic text');
    });

    it('should wait for text in context', async () => {
      await I.amOnPage('/dynamic');
      await I.dontSee('Dynamic text');
      await I.waitForText('Dynamic text', 2, '#text');
      await I.see('Dynamic text');
    });

    it('should fail if no context', async function () {
      if (isHelper('TestCafe')) this.skip();

      let failed = false;
      await I.amOnPage('/dynamic');
      await I.dontSee('Dynamic text');
      try {
        await I.waitForText('Dynamic text', 1, '#fext');
      } catch (e) {
        failed = true;
      }
      assert.ok(failed);
    });

    it('should fail if text doesn\'t contain', async function () {
      if (isHelper('TestCafe')) this.skip();

      let failed = false;
      await I.amOnPage('/dynamic');
      try {
        await I.waitForText('Other text', 1);
      } catch (e) {
        failed = true;
      }
      assert.ok(failed);
    });

    it('should fail if text is not in element', async function () {
      if (isHelper('TestCafe')) this.skip();

      let failed = false;
      await I.amOnPage('/dynamic');
      try {
        await I.waitForText('Other text', 1, '#text');
      } catch (e) {
        failed = true;
      }
      assert.ok(failed);
    });

    it('should wait for text after timeout', async () => {
      await I.amOnPage('/timeout');
      await I.dontSee('Timeout text');
      await I.waitForText('Timeout text', 31, '#text');
      await I.see('Timeout text');
    });

    it('should wait for text located by XPath', async () => {
      await I.amOnPage('/dynamic');
      await I.dontSee('Dynamic text');
      await I.waitForText('Dynamic text', 5, '//div[@id="text"]');
    });
  });

  describe('#waitForElement', () => {
    it('should wait for visible element', async () => {
      await I.amOnPage('/form/wait_visible');
      await I.dontSee('Step One Button');
      await I.dontSeeElement('#step_1');
      await I.waitForVisible('#step_1', 2);
      await I.seeElement('#step_1');
      await I.click('#step_1');
      await I.waitForVisible('#step_2', 2);
      await I.see('Step Two Button');
    });

    it('should wait for element in DOM', async () => {
      await I.amOnPage('/form/wait_visible');
      await I.waitForElement('#step_2');
      await I.dontSeeElement('#step_2');
      await I.seeElementInDOM('#step_2');
    });

    it('should wait for element by XPath', async () => {
      await I.amOnPage('/form/wait_visible');
      await I.waitForElement('//div[@id="step_2"]');
      await I.dontSeeElement('//div[@id="step_2"]');
      await I.seeElementInDOM('//div[@id="step_2"]');
    });

    it('should wait for element to appear', async () => {
      await I.amOnPage('/form/wait_element');
      await I.dontSee('Hello');
      await I.dontSeeElement('h1');
      await I.waitForElement('h1', 2);
      await I.see('Hello');
    });
  });

  describe('#waitForInvisible', () => {
    it('should wait for element to be invisible', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.see('Step One Button');
      await I.seeElement('#step_1');
      await I.waitForInvisible('#step_1', 2);
      await I.dontSeeElement('#step_1');
    });

    it('should wait for element to be invisible by XPath', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.seeElement('//div[@id="step_1"]');
      await I.waitForInvisible('//div[@id="step_1"]');
      await I.dontSeeElement('//div[@id="step_1"]');
      await I.seeElementInDOM('//div[@id="step_1"]');
    });

    it('should wait for element to be removed', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.see('Step Two Button');
      await I.seeElement('#step_2');
      await I.waitForInvisible('#step_2', 2);
      await I.dontSeeElement('#step_2');
    });

    it('should wait for element to be removed by XPath', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.see('Step Two Button');
      await I.seeElement('//div[@id="step_2"]');
      await I.waitForInvisible('//div[@id="step_2"]', 2);
      await I.dontSeeElement('//div[@id="step_2"]');
    });
  });

  describe('#waitToHide', () => {
    it('should wait for element to be invisible', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.see('Step One Button');
      await I.seeElement('#step_1');
      await I.waitToHide('#step_1', 2);
      await I.dontSeeElement('#step_1');
    });

    it('should wait for element to be invisible by XPath', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.seeElement('//div[@id="step_1"]');
      await I.waitToHide('//div[@id="step_1"]');
      await I.dontSeeElement('//div[@id="step_1"]');
      await I.seeElementInDOM('//div[@id="step_1"]');
    });

    it('should wait for element to be removed', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.see('Step Two Button');
      await I.seeElement('#step_2');
      await I.waitToHide('#step_2', 2);
      await I.dontSeeElement('#step_2');
    });

    it('should wait for element to be removed by XPath', async () => {
      await I.amOnPage('/form/wait_invisible');
      await I.see('Step Two Button');
      await I.seeElement('//div[@id="step_2"]');
      await I.waitToHide('//div[@id="step_2"]', 2);
      await I.dontSeeElement('//div[@id="step_2"]');
    });
  });

  describe('#waitForDetached', () => {
    it('should throw an error if the element still exists in DOM', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/wait_detached');
      await I.see('Step One Button');
      await I.seeElement('#step_1');

      try {
        await I.waitForDetached('#step_1', 2);
        throw Error('Should not get this far');
      } catch (err) {
        err.message.should.include('still on page after');
      }
    });

    it('should throw an error if the element still exists in DOM by XPath', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/wait_detached');
      await I.see('Step One Button');
      await I.seeElement('#step_1');

      try {
        await I.waitForDetached('#step_1', 2);
        throw Error('Should not get this far');
      } catch (err) {
        err.message.should.include('still on page after');
      }
    });

    it('should wait for element to be removed from DOM', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/wait_detached');
      await I.see('Step Two Button');
      await I.seeElement('#step_2');
      await I.waitForDetached('#step_2', 2);
      await I.dontSeeElementInDOM('#step_2');
    });

    it('should wait for element to be removed from DOM by XPath', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/wait_detached');
      await I.seeElement('//div[@id="step_2"]');
      await I.waitForDetached('//div[@id="step_2"]');
      await I.dontSeeElement('//div[@id="step_2"]');
      await I.dontSeeElementInDOM('//div[@id="step_2"]');
    });
  });

  describe('within tests', () => {
    afterEach(() => I._withinEnd());

    it('should execute within block', async () => {
      await I.amOnPage('/form/example4');
      await I.seeElement('#navbar-collapse-menu');
      await I._withinBegin('#register');
      await I.see('E-Mail');
      await I.dontSee('Toggle navigation');
      await I.dontSeeElement('#navbar-collapse-menu');
    });

    it('should respect form fields inside within block ', async () => {
      let rethrow;

      await I.amOnPage('/form/example4');
      await I.seeElement('#navbar-collapse-menu');
      await I.see('E-Mail');
      await I.see('Hasło');
      await I.fillField('Hasło', '12345');
      await I.seeInField('Hasło', '12345');
      await I.checkOption('terms');
      await I.seeCheckboxIsChecked('terms');
      await I._withinBegin({ css: '.form-group' });
      await I.see('E-Mail');
      await I.dontSee('Hasło');

      try {
        await I.dontSeeElement('#navbar-collapse-menu');
      } catch (err) {
        rethrow = err;
      }

      try {
        await I.dontSeeCheckboxIsChecked('terms');
      } catch (err) {
        if (!err) assert.fail('seen checkbox');
      }

      try {
        await I.seeInField('Hasło', '12345');
      } catch (err) {
        if (!err) assert.fail('seen field');
      }

      if (rethrow) throw rethrow;
    });

    it('should execute within block 2', async () => {
      await I.amOnPage('/form/example4');
      await I.fillField('Hasło', '12345');
      await I._withinBegin({ xpath: '//div[@class="form-group"][2]' });
      await I.dontSee('E-Mail');
      await I.see('Hasło');

      const label = await I.grabTextFrom('label');
      assert.equal(label, 'Hasło');

      const input = await I.grabValueFrom('input');
      assert.equal(input, '12345');
    });

    it('within should respect context in see', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/example4');
      await I.see('Rejestracja', 'fieldset');
      await I._withinBegin({ css: '.navbar-header' });

      try {
        await I.see('Rejestracja', '.container fieldset');
      } catch (err) {
        if (!err) assert.fail('seen fieldset');
      }

      try {
        await I.see('Toggle navigation', '.container fieldset');
      } catch (err) {
        if (!err) assert.fail('seen fieldset');
      }
    });

    it('within should respect context in see when using nested frames', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/iframe_nested');
      await I._withinBegin({
        frame: ['#wrapperId', '[name=content]'],
      });

      try {
        await I.see('Kill & Destroy');
      } catch (err) {
        if (!err) assert.fail('seen "Kill & Destroy"');
      }

      try {
        await I.dontSee('Nested Iframe test');
      } catch (err) {
        if (!err) assert.fail('seen "Nested Iframe test"');
      }

      try {
        await I.dontSee('Iframe test');
      } catch (err) {
        if (!err) assert.fail('seen "Iframe test"');
      }
    });
  });

  describe('scroll: #scrollTo, #scrollPageToTop, #scrollPageToBottom', () => {
    it('should scroll inside an iframe', async function () {
      if (isHelper('Nightmare')) return;
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/iframe');
      await I.resizeWindow(500, 700);
      await I.switchTo(0);

      const { x, y } = await I.grabPageScrollPosition();
      await I.scrollTo('.sign');

      const { x: afterScrollX, y: afterScrollY } = await I.grabPageScrollPosition();
      assert.notEqual(afterScrollY, y);
      assert.equal(afterScrollX, x);
    });

    it('should scroll to an element', async () => {
      await I.amOnPage('/form/scroll');
      await I.resizeWindow(500, 700);
      const { y } = await I.grabPageScrollPosition();
      await I.scrollTo('.section3 input[name="test"]');

      const { y: afterScrollY } = await I.grabPageScrollPosition();
      assert.notEqual(afterScrollY, y);
    });

    it('should scroll to coordinates', async () => {
      await I.amOnPage('/form/scroll');
      await I.resizeWindow(500, 700);
      await I.scrollTo(50, 70);

      const { x: afterScrollX, y: afterScrollY } = await I.grabPageScrollPosition();
      assert.equal(afterScrollX, 50);
      assert.equal(afterScrollY, 70);
    });

    it('should scroll to bottom of page', async () => {
      await I.amOnPage('/form/scroll');
      await I.resizeWindow(500, 700);
      const { y } = await I.grabPageScrollPosition();
      await I.scrollPageToBottom();

      const { y: afterScrollY } = await I.grabPageScrollPosition();
      assert.notEqual(afterScrollY, y);
      assert.notEqual(afterScrollY, 0);
    });

    it('should scroll to top of page', async () => {
      await I.amOnPage('/form/scroll');
      await I.resizeWindow(500, 700);
      await I.scrollPageToBottom();
      const { y } = await I.grabPageScrollPosition();
      await I.scrollPageToTop();

      const { y: afterScrollY } = await I.grabPageScrollPosition();
      assert.notEqual(afterScrollY, y);
      assert.equal(afterScrollY, 0);
    });
  });

  describe('#grabCssPropertyFrom', () => {
    it('should grab css property for given element', async function () {
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/doubleclick');
      const css = await I.grabCssPropertyFrom('#block', 'height');
      assert.equal(css, '100px');
    });

    it('should grab camelcased css properies', async () => {
      if (isHelper('TestCafe')) return;

      await I.amOnPage('/form/doubleclick');
      const css = await I.grabCssPropertyFrom('#block', 'user-select');
      assert.equal(css, 'text');
    });

    it('should grab multiple values if more than one matching element found', async () => {
      if (isHelper('Nightmare')) return;
      if (isHelper('TestCafe')) return;

      await I.amOnPage('/info');
      const css = await I.grabCssPropertyFromAll('.span', 'height');
      assert.equal(css[0], '12px');
      assert.equal(css[1], '15px');
    });
  });

  describe('#seeAttributesOnElements', () => {
    it('should check attributes values for given element', async function () {
      if (isHelper('Nightmare')) return;
      if (isHelper('TestCafe')) this.skip();

      try {
        await I.amOnPage('/info');
        await I.seeAttributesOnElements('//form', {
          method: 'post',
        });
        await I.seeAttributesOnElements('//form', {
          method: 'post',
          action: `${siteUrl}/`,
        });
        await I.seeAttributesOnElements('//form', {
          method: 'get',
        });
        throw Error('It should never get this far');
      } catch (e) {
        e.message.should.include('all elements (//form) to have attributes {"method":"get"}');
      }
    });

    it('should check attributes values for several elements', async function () {
      if (isHelper('Nightmare')) return;
      if (isHelper('TestCafe')) this.skip();

      try {
        await I.amOnPage('/');
        await I.seeAttributesOnElements('a', {
          'qa-id': 'test',
          'qa-link': 'test',
        });
        await I.seeAttributesOnElements('//div', {
          'qa-id': 'test',
        });
        await I.seeAttributesOnElements('a', {
          'qa-id': 'test',
          href: '/info',
        });
        throw new Error('It should never get this far');
      } catch (e) {
        e.message.should.include('all elements (a) to have attributes {"qa-id":"test","href":"/info"}');
      }
    });
  });

  describe('#seeCssPropertiesOnElements', () => {
    it('should check css property for given element', async function () {
      if (isHelper('Nightmare')) return;
      if (isHelper('TestCafe')) this.skip();

      try {
        await I.amOnPage('/info');
        await I.seeCssPropertiesOnElements('h3', {
          'font-weight': 'bold',
        });
        await I.seeCssPropertiesOnElements('h3', {
          'font-weight': 'bold',
          display: 'block',
        });
        await I.seeCssPropertiesOnElements('h3', {
          'font-weight': 'non-bold',
        });
        throw Error('It should never get this far');
      } catch (e) {
        e.message.should.include('expected all elements (h3) to have CSS property {"font-weight":"non-bold"}');
      }
    });

    it('should check css property for several elements', async function () {
      if (isHelper('Nightmare')) return;
      if (isHelper('TestCafe')) this.skip();

      try {
        await I.amOnPage('/');
        await I.seeCssPropertiesOnElements('a', {
          color: 'rgb(0, 0, 238)',
          cursor: 'pointer',
        });
        await I.seeCssPropertiesOnElements('a', {
          color: '#0000EE',
          cursor: 'pointer',
        });
        await I.seeCssPropertiesOnElements('//div', {
          display: 'block',
        });
        await I.seeCssPropertiesOnElements('a', {
          'margin-top': '0em',
          cursor: 'pointer',
        });
        throw Error('It should never get this far');
      } catch (e) {
        e.message.should.include('expected all elements (a) to have CSS property {"margin-top":"0em","cursor":"pointer"}');
      }
    });

    it('should normalize css color properties for given element', async function () {
      if (isHelper('Nightmare')) return;
      if (isHelper('TestCafe')) this.skip();

      await I.amOnPage('/form/css_colors');
      await I.seeCssPropertiesOnElements('#namedColor', {
        'background-color': 'purple',
        color: 'yellow',
      });
      await I.seeCssPropertiesOnElements('#namedColor', {
        'background-color': '#800080',
        color: '#ffff00',
      });

      await I.seeCssPropertiesOnElements('#namedColor', {
        'background-color': 'rgb(128,0,128)',
        color: 'rgb(255,255,0)',
      });

      await I.seeCssPropertiesOnElements('#namedColor', {
        'background-color': 'rgba(128,0,128,1)',
        color: 'rgba(255,255,0,1)',
      });
    });
  });

  describe('#customLocators', () => {
    beforeEach(() => {
      originalLocators = Locator.filters;
      Locator.filters = [];
    });
    afterEach(() => {
      // reset custom locators
      Locator.filters = originalLocators;
    });
    it('should support xpath custom locator by default', async () => {
      customLocators({
        attribute: 'data-test-id',
        enabled: true,
      });
      await I.amOnPage('/form/custom_locator');
      await I.dontSee('Step One Button');
      await I.dontSeeElement('$step_1');
      await I.waitForVisible('$step_1', 2);
      await I.seeElement('$step_1');
      await I.click('$step_1');
      await I.waitForVisible('$step_2', 2);
      await I.see('Step Two Button');
    });
    it('can use css strategy for custom locator', async () => {
      customLocators({
        attribute: 'data-test-id',
        enabled: true,
        strategy: 'css',
      });
      await I.amOnPage('/form/custom_locator');
      await I.dontSee('Step One Button');
      await I.dontSeeElement('$step_1');
      await I.waitForVisible('$step_1', 2);
      await I.seeElement('$step_1');
      await I.click('$step_1');
      await I.waitForVisible('$step_2', 2);
      await I.see('Step Two Button');
    });
    it('can use xpath strategy for custom locator', async () => {
      customLocators({
        attribute: 'data-test-id',
        enabled: true,
        strategy: 'xpath',
      });
      await I.amOnPage('/form/custom_locator');
      await I.dontSee('Step One Button');
      await I.dontSeeElement('$step_1');
      await I.waitForVisible('$step_1', 2);
      await I.seeElement('$step_1');
      await I.click('$step_1');
      await I.waitForVisible('$step_2', 2);
      await I.see('Step Two Button');
    });
  });
};
