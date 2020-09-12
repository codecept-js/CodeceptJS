function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class CustomHelper extends Helper {
  async exceededByTimeout(s) {
    await sleep(s);
  }

  async waitForSleep(s) {
    await sleep(s);
  }
}

module.exports = CustomHelper;
