const given = when = then = global.codeceptjs.container.plugins('commentStep');
const { I } = inject();

Feature('Steps');

Scenario('Default command timeout', ({ I }) => {
  I.exceededByTimeout(1000);
});

Scenario('Wait command timeout', ({ I }) => {
  I.waitForSleep(1000);
});
