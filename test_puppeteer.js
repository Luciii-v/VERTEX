const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
    if (!response.ok()) console.log('PAGE HTTP ERROR:', response.status(), response.url());
  });

  await page.goto('http://localhost:3000');
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 2000));
  
  // Click on "Dashboard"
  // First we need to get past the "Select Workspace" screen
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const dashBtn = buttons.find(b => b.textContent.includes('Dashboard') || b.textContent.includes('DASHBOARD'));
    if (dashBtn) dashBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
