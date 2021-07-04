---
permalink: /react
title: Testing React Applications
---

# Testing React Applications

React applications require some additional love for end to end testing.
At first, it is very hard to test an application which was never designed to be tested!
This happens to many React application. While building components developers often forget to keep the element's semantic.

Generated HTML code may often look like this:

```js
<div class="jss607 jss869 jss618 jss871 jss874 jss876" tabindex="0" role="tab" aria-selected="true" style="pointer-events: auto;">
  <span class="jss877">
    <span class="jss878">
      <span class="jss879">Click Me!</span>
    </span>
  </span>
<span class="jss610"></span></div>
```

It's quite common that clickable elements are not actual `a` or `button` elements. This way `I.click('Click Me!');` won't work, as well as `fillField('name', 'value)`. Finding a correct locator for such cases turns to be almost impossible.

In this case test engineers have two options:

1. Update JSX files to change output HTML and rebuild the application
1. Test the application how it is.

We recommend for long-running projects to go with the first option. The better you write your initial HTML the cleaner and less fragile will be your tests. Replace divs with correct HTML elements, add `data-` attributes, add labels, and names to input fields to make all CodeceptJS magic like clicking link by a text to work.

However, if you can't update the code you can go to the second option. In this case, you should bind your locators to visible text on page and available semantic attribues. For instance, instead of using generated locator as this one:

```
//*[@id="document"]/div[2]/div/div[2]/div
```

use [Locator Builder](/locators#locator-builder) to make clean semantic locator:

```js
locate('[role=tab]').withText('Click Me!');
```

This way you can build very flexible and stable locators even on application never designed for testing.

## Locators

For React apps a special `react` locator is available. It allows to select an element by its component name, props and state.

```js
{ react: 'MyComponent' }
{ react: 'Button', props: { title: 'Click Me' }}
{ react: 'Button', state: { some: 'state' }}
{ react: 'Input', state: 'valid'}
```

In WebDriver, Puppeteer, and Playwright you can use React locators in any method where locator is required:

```js
I.click({ react: 'Tab', props: { title: 'Click Me!' }});
I.seeElement({ react: 't', props: { title: 'Clicked' }});
```

To find React element names and props in a tree use [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) extension.

> Turn off minification for application builds otherwise component names will be uglified as well

React locators work via [resq](https://github.com/baruchvlz/resq) library, which handles React 16 and above.
