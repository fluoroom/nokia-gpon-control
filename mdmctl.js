require('dotenv').config();
const {By, Builder, Browser} = require('selenium-webdriver');
const assert = require("assert");
const {until} = require('selenium-webdriver');

(async function modemControl() {
  let driver;
  
  try {
    // Validate environment variables
    const requiredEnvVars = ['MODEM_HOST', 'MODEM_USERNAME', 'MODEM_PASSWORD'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    driver = await new Builder().forBrowser(Browser.CHROME).build();
    
    // Clear cookies and session data

    await driver.get(process.env.MODEM_HOST+'/admin.html');
    await driver.manage().deleteAllCookies();
    await driver.executeScript('window.sessionStorage.clear();');
    await driver.executeScript('window.localStorage.clear();');
    
    // Refresh page after clearing data
    await driver.navigate().refresh();
    await driver.manage().setTimeouts({implicit: 500});
  
    await driver.get(process.env.MODEM_HOST+'/login.cgi?out');
    let usernameInput = await driver.findElement(By.id('username'));
    let passwordInput = await driver.findElement(By.id('password'));
    let loginButton = await driver.findElement(By.id('loginBT'));
  
    await usernameInput.sendKeys(process.env.MODEM_USERNAME);
    await passwordInput.sendKeys(process.env.MODEM_PASSWORD);
    await loginButton.click();
    await driver.sleep(4000);

    // Toggle 5GHz WiFi
    await driver.get(process.env.MODEM_HOST + '/wlan_config.cgi?v=11ac');
    await driver.wait(until.elementLocated(By.name('wl_enable')), 10000);
    let enableCheckbox5 = await driver.findElement(By.name('wl_enable'));
    let saveButton5 = await driver.findElement(By.css('input[type="submit"]'));
    await enableCheckbox5.click();
    await saveButton5.click();
    await driver.sleep(4000);
    console.log('5GHz toggled');

    // Toggle 2.4GHz WiFi
    await driver.get(process.env.MODEM_HOST + '/wlan_config.cgi');
    await driver.wait(until.elementLocated(By.name('wl_enable')), 10000);
    let enableCheckbox24 = await driver.findElement(By.name('wl_enable'));
    let saveButton24 = await driver.findElement(By.css('input[type="submit"]'));
    await enableCheckbox24.click();
    await saveButton24.click();
    await driver.sleep(4000);
    console.log('2.4GHz toggled');
    return;
    
  } catch (e) {
    console.error('Error:', e.message);
    throw e; // Re-throw to ensure non-zero exit code
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}())