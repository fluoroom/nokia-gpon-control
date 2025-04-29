require('dotenv').config();
const {By, Builder, Browser} = require('selenium-webdriver');
const assert = require("assert");
const {until} = require('selenium-webdriver');
const {Options} = require('selenium-webdriver/chrome');
const { spawn } = require('child_process');

// Helper function to wait for alerts and handle them
async function waitForAlerts(driver, okString) {
  try {
    const alert = await driver.switchTo().alert();
    const alertText = await alert.getText();
    console.log('Error:', alertText);
    runScript(alertText);
    await alert.accept();
    return false; // Return false to indicate there was an error
  } catch (alertErr) {
    console.log(okString);
    runScript(okString);    
    return true; // Return true to indicate success
  }
}

function runScript(message) {
  const script = process.env.SCRIPT_LOCATION;
  if (!script) {
    return;
  }

  try {
    const child = spawn(script, ['"' + message.toString() + '"'], {
      shell: true  // This ensures it can run shell scripts
    });

    child.stdout.on('data', (data) => {
      //console.log(`Script output: ${data}`);
      //only on success
      if (data.toString().includes(process.env.SCRIPT_OK_STRING)) {
        console.log('Script OK');
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`Script error: ${data}`);
    });

    child.on('close', (code) => {
      ///console.log(`Script exited with code ${code}`);
    });
  } catch (error) {
    console.error('Failed to run script:', error);
  }
}

// Initialize WebDriver
async function initializeDriver() {
  const requiredEnvVars = ['MODEM_HOST', 'MODEM_USERNAME', 'MODEM_PASSWORD'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  const options = new Options();
  
  // Headless mode configuration
  options.addArguments('--headless=new');
  options.addArguments('--disable-gpu');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  
  // Additional arguments for headless environment
  options.addArguments('--disable-software-rasterizer');
  options.addArguments('--disable-extensions');
  options.addArguments('--disable-setuid-sandbox');
  options.addArguments('--remote-debugging-port=9222');
  options.addArguments('--disable-features=VizDisplayCompositor');
  options.addArguments('--force-device-scale-factor=1');
  
  // Explicitly set display
  process.env.DISPLAY = ':99';

  try {
    const driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .build();
      
    await driver.manage().setTimeouts({implicit: 3000});
    return driver;
  } catch (error) {
    console.error('Failed to initialize WebDriver:', error.message);
    console.log('Please ensure the following are installed:');
    console.log('1. Chromium browser: sudo pacman -S chromium');
    console.log('2. ChromeDriver: sudo pacman -S chromium-driver');
    console.log('3. Xvfb: sudo pacman -S xorg-server-xvfb');
    throw error;
  }
}

// Login function
async function login(driver) {
  await driver.get(process.env.MODEM_HOST + '/admin.html');
  let usernameInput = await driver.findElement(By.id('username'));
  let passwordInput = await driver.findElement(By.id('password'));
  let loginButton = await driver.findElement(By.id('loginBT'));

  await usernameInput.sendKeys(process.env.MODEM_USERNAME);
  await passwordInput.sendKeys(process.env.MODEM_PASSWORD);
  await loginButton.click();
  await driver.sleep(1000);
}

// Helper function to handle WiFi state changes
async function setWiFiState(driver, enable, is24GHz = false, maxRetries = 3) {
  const network = is24GHz ? '2.4GHz' : '5GHz';
  const state = enable ? 'enabled' : 'disabled';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const url = is24GHz 
      ? process.env.MODEM_HOST + '/wlan_config.cgi'
      : process.env.MODEM_HOST + '/wlan_config.cgi?v=11ac';
      
    await driver.get(url);
    await driver.wait(until.elementLocated(By.name('wl_enable')), 5000);
    let enableCheckbox = await driver.findElement(By.name('wl_enable'));
    
    // Get current state
    const isCurrentlyEnabled = await enableCheckbox.isSelected();
    
    // Only click if the current state doesn't match desired state
    if (isCurrentlyEnabled !== enable) {
      await enableCheckbox.click();
    }
    
    let saveButton = await driver.findElement(By.css('input[type="submit"]'));
    await driver.sleep(1000);
    await saveButton.click();
    
    const success = await waitForAlerts(driver, `${network} ${state}`);
    if (success) {
      return; // Operation succeeded, exit the function
    }
    
    if (attempt < maxRetries) {
      console.log(`Attempt ${attempt} failed. Retrying...`);
      await login(driver);
      await driver.sleep(2000); // Wait a bit before retrying
    } else {
      console.error(`Failed to set ${network} WiFi state after ${maxRetries} attempts`);
    }
  }
}

// Turn WiFi on
async function wifiOn(driver, is24GHz = false) {
  await setWiFiState(driver, true, is24GHz);
}

// Turn WiFi off
async function wifiOff(driver, is24GHz = false) {
  await setWiFiState(driver, false, is24GHz);
}

// Main control function
async function modemControl(command, network, state) {
  let driver;
  
  try {
    driver = await initializeDriver();
    await login(driver);
    
    switch(network) {
      case '5':
        await setWiFiState(driver, state === 'on', false);
        break;
      case '2.4':
        await setWiFiState(driver, state === 'on', true);
        break;
      case 'all':
        await setWiFiState(driver, state === 'on', false); // 5GHz
        await setWiFiState(driver, state === 'on', true);  // 2.4GHz
        break;
      default:
        throw new Error('Invalid network specified. Use: 5, 2.4, or all');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
    throw e;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3 || args[0] !== 'wifi') {
    console.error('Usage: nokia-gpon-ctl wifi <network> <state>');
    console.error('network: 5, 2.4, or all');
    console.error('state: on or off');
    process.exit(1);
  }

  const [command, network, state] = args;
  
  if (!['5', '2.4', 'all'].includes(network)) {
    console.error('Network must be 5, 2.4, or all');
    process.exit(1);
  }
  
  if (!['on', 'off'].includes(state)) {
    console.error('State must be on or off');
    process.exit(1);
  }

  return [command, network, state];
}

// Execute the main function with CLI arguments
const [command, network, state] = parseArgs();
modemControl(command, network, state);