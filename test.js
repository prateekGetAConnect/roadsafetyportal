const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:8081');
  await new Promise(r => setTimeout(r, 2000));
  await page.type('#v360-search-input', 'DL-3C-AB-2294');
  await page.click('#v360-search-btn');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
