// ... existing code ...

// Helper function to handle WiFi state changes
async function setWiFiState(driver, enable, is24GHz = false) {
  const url = is24GHz 
    ? process.env.MODEM_HOST + '/wlan_config.cgi'
    : process.env.MODEM_HOST + '/wlan_config.cgi?v=11ac';
    
  await driver.get(url);
  await driver.wait(until.elementLocated(By.name('wl_enable')), 10000);
  let enableCheckbox = await driver.findElement(By.name('wl_enable'));
  
  // Get current state
  const isCurrentlyEnabled = await enableCheckbox.isSelected();
  
  // Only click if the current state doesn't match desired state
  if (isCurrentlyEnabled !== enable) {
    await enableCheckbox.click();
  }
  
  let saveButton = await driver.findElement(By.css('input[type="submit"]'));
  await saveButton.click();
  
  const network = is24GHz ? '2.4GHz' : '5GHz';
  const state = enable ? 'enabled' : 'disabled';
  await waitForAlerts(driver, `${network} ${state}`);
  await driver.sleep(1000);
}

// Turn WiFi on
async function wifiOn(driver, is24GHz = false) {
  await setWiFiState(driver, true, is24GHz);
}

// Turn WiFi off
async function wifiOff(driver, is24GHz = false) {
  await setWiFiState(driver, false, is24GHz);
}

// Update main control function for testing
async function modemControl() {
  let driver;
  
  try {
    driver = await initializeDriver();
    await login(driver);
    
    // Example usage:
    await wifiOff(driver); // Turn off 5GHz
    await wifiOff(driver, true); // Turn off 2.4GHz
    await driver.sleep(2000);
    await wifiOn(driver); // Turn on 5GHz
    await wifiOn(driver, true); // Turn on 2.4GHz
    
  } catch (e) {
    console.error('Error:', e.message);
    throw e;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

// ... rest of existing code ...