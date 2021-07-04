Feature('React Selectors');

Scenario('props @WebDriver @Puppeteer @Playwright', ({ I }) => {
  I.amOnPage('https://ahfarmer.github.io/calculator/');
  I.click('7');
  I.seeElement({ react: 't', props: { name: '5' } });
  I.click('button', { react: 't', props: { name: '2' } });
  I.click('button', { react: 't', props: { name: '+' } });
  I.click('button', { react: 't', props: { name: '9' } });
  I.click('button', { react: 't', props: { name: '=' } });
  I.seeElement({ react: 't', props: { value: '81' } });
});

Scenario('component name @Puppeteer @Playwright', ({ I }) => {
  I.amOnPage('http://negomi.github.io/react-burger-menu/');
  I.click({ react: 'BurgerIcon' });
  I.waitForVisible('#slide', 10);
  I.click('Alerts');
  I.seeElement({ react: 'Demo' });
});
