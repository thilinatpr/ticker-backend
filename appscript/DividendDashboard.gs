/**
 * Sets up the Google Sheet for the Dividend Dashboard script with a clickable button.
 */
function DividendDash_completeSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Main sheet setup
  let mainSheet = ss.getSheetByName('Main') || ss.getActiveSheet();
  mainSheet.setName('Main');

  mainSheet.clear();
  mainSheet.clearFormats();

  // Column headers
  mainSheet.getRange('A1').setValue('Ticker Symbols')
    .setFontWeight('bold')
    .setBackground('#e8f0fe');

  mainSheet.getRange('B1').setValue('Last Updated:')
    .setFontWeight('bold')
    .setBackground('#f1f3f4');

  mainSheet.setColumnWidths(1, 2, 180);
  mainSheet.setFrozenRows(1);

  // Instruction note
  mainSheet.getRange('A2').setNote('Enter one ticker per row (e.g., AAPL, MSFT)');

  // 2. Create dividends_data sheet
  let dataSheet = ss.getSheetByName('dividends_data');
  if (!dataSheet) {
    dataSheet = ss.insertSheet('dividends_data');
  } else {
    dataSheet.clear();
  }
  dataSheet.getRange('A1').setValue('Dashboard URL')
    .setFontWeight('bold')
    .setBackground('#e8f0fe');
  dataSheet.setColumnWidth(1, 500);

  // 3. Add menu with "Update Dividends" button
  DividendDash_addCustomMenu();

  SpreadsheetApp.getUi().alert(
    '✅ Setup complete!\n\nUse the "Dividend Dashboard" menu → "Update Dividends" to run the dashboard.\n' +
    'Add ticker symbols in column A of the Main sheet.'
  );
}

/**
 * Adds a custom menu for triggering the dashboard.
 */
function DividendDash_addCustomMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Dividend Dashboard')
    .addItem('Update Dividends', 'DividendDash_triggerUpdate')
    .addToUi();
}

/**
 * Auto-add menu when the spreadsheet is opened.
 */
function onOpen() {
  DividendDash_addCustomMenu();
}


/**
 * Dividend Dashboard Integration for Google Apps Script
 * 
 * Connects Google Sheets to dividend update dashboard
 * Functions prefixed with 'DividendDash_' to avoid conflicts
 * 
 * Usage:
 * 1. Run DividendDash_completeSetup() once
 * 2. Enter "UPDATE_DIVIDENDS" in cell A1 to trigger dashboard
 * 3. Or run DividendDash_triggerUpdate() manually
 */

// Namespaced configuration to avoid conflicts
// Stage 4: CF-Native endpoints (no Vercel dependency)
const DIVIDEND_API_BASE_URL = 'https://ticker-backend-worker2.patprathnayaka.workers.dev';
const DIVIDEND_DASHBOARD_URL = DIVIDEND_API_BASE_URL + '/dashboard'; // Future CF-native dashboard
const DIVIDEND_API_KEYS = {
  'demo': 'tk_demo_key_12345',
  'user1': 'tk_user1_api_key_67890',
  'user2': 'tk_user2_api_key_abcde'
};

/**
 * SIMPLE onEdit trigger - Add this as a simple trigger
 * This function will be called automatically when any cell is edited
 */
function onEdit(e) {
  // Check if this is the dividend trigger
  if (e && e.range && e.range.getA1Notation() === 'A1' && e.value === 'UPDATE_DIVIDENDS') {
    DividendDash_openUpdateDashboard();
    // Clear the trigger cell
    e.range.setValue('');
  }
}

/**
 * NAMESPACED: Manual trigger function - Use this anytime
 */
function DividendDash_triggerUpdate() {
  DividendDash_openUpdateDashboard();
}

/**
 * NAMESPACED: Opens the update dashboard with current sheet data
 */
function DividendDash_openUpdateDashboard() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const user = Session.getActiveUser().getEmail();
    
    // Extract tickers from sheet
    const tickers = DividendDash_getTickersFromSheet(sheet);
    if (tickers.length === 0) {
      SpreadsheetApp.getUi().alert('No tickers found in sheet. Please add ticker symbols in column A.');
      return;
    }
    
    // Get last updated timestamp
    const lastUpdated = DividendDash_getLastUpdatedTimestamp(sheet);
    
    // Determine API key for user
    const apiKey = DividendDash_getUserApiKey(user);
    
    // Build dashboard URL
    const dashboardUrl = DividendDash_buildDashboardUrl(tickers, lastUpdated, apiKey, user);
    
    console.log(`Opening dashboard for ${user} with ${tickers.length} tickers`);
    
    // Add dashboard URL to dividends_data sheet
    DividendDash_addUrlToSheet(dashboardUrl);
    
    // Set up completion monitoring (check every 30 seconds for 2 hours)
    DividendDash_setupCompletionMonitoring();
    
    // Log details for debugging
    console.log(`✅ Dashboard triggered for ${tickers.length} tickers`);
    console.log(`API Key: ${DividendDash_maskApiKey(apiKey)}`);
    console.log(`Last Updated: ${lastUpdated || 'Never'}`);
    
  } catch (error) {
    console.log('Error opening dashboard: ' + error.toString());
    SpreadsheetApp.getUi().alert('Error opening dashboard: ' + error.message);
  }
}

/**
 * NAMESPACED: Set up monitoring for dashboard completion
 */
function DividendDash_setupCompletionMonitoring() {
  // Create a time-based trigger to check for completion
  const trigger = ScriptApp.newTrigger('DividendDash_checkForCompletion')
    .timeBased()
    .everyMinutes(1) // Check every minute
    .create();
  
  // Store trigger ID for cleanup
  PropertiesService.getScriptProperties().setProperty('DIVIDEND_COMPLETION_TRIGGER', trigger.getUniqueId());
  PropertiesService.getScriptProperties().setProperty('DIVIDEND_MONITORING_START', new Date().toISOString());
}

/**
 * NAMESPACED: Check for completion notification from dashboard
 */
function DividendDash_checkForCompletion() {
  try {
    const startTime = PropertiesService.getScriptProperties().getProperty('DIVIDEND_MONITORING_START');
    if (!startTime) return; // No active monitoring
    
    const elapsedHours = (new Date() - new Date(startTime)) / (1000 * 60 * 60);
    
    // Stop monitoring after 3 hours
    if (elapsedHours > 3) {
      DividendDash_stopCompletionMonitoring();
      console.log('Dividend update monitoring stopped after 3 hours');
      return;
    }
    
    // Check if dashboard posted completion data
    const completionData = DividendDash_checkCompletionStatus();
    
    if (completionData) {
      // Update the sheet with completion info
      DividendDash_updateSheetWithCompletion(completionData);
      
      // Stop monitoring
      DividendDash_stopCompletionMonitoring();
      
      console.log(`Dividend update completed: ${completionData.successCount}/${completionData.tickers.length} successful`);
    }
    
  } catch (error) {
    console.log('Error checking completion status: ' + error.toString());
  }
}

/**
 * NAMESPACED: Check for completion status via API
 */
function DividendDash_checkCompletionStatus() {
  // In a real implementation, this would check the backend API for job completion
  // For now, we'll return null (no completion detected)
  return null;
}

/**
 * NAMESPACED: Update sheet with completion data and refresh dividend data
 */
function DividendDash_updateSheetWithCompletion(completionData) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    
    // Update last updated timestamp in column B1
    const timestamp = new Date(completionData.timestamp);
    sheet.getRange('B1').setValue(timestamp);
    
    // Add completion note in column B2
    const successRate = Math.round((completionData.successCount / completionData.tickers.length) * 100);
    const completionNote = `✅ Updated: ${successRate}% success (${completionData.successCount}/${completionData.tickers.length})`;
    sheet.getRange('B2').setValue(completionNote);
    
    console.log(`Sheet updated with completion data: ${completionNote}`);
    
    // Trigger dividend data refresh after a short delay
    Utilities.sleep(3000); // Wait 3 seconds for data to be available
    DividendDash_refreshDividendDataInSheet(completionData.tickers);
    
  } catch (error) {
    console.log('Error updating sheet with completion data: ' + error.toString());
  }
}

/**
 * NAMESPACED: Refresh dividend data in sheet after updates
 */
function DividendDash_refreshDividendDataInSheet(tickers) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    
    console.log(`Refreshing dividend data for ${tickers.length} tickers...`);
    
    // Add dividend count information starting from column C
    sheet.getRange('C1').setValue('Dividend Count')
      .setFontWeight('bold')
      .setBackground('#e8f0fe');
    
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const rowNum = i + 2; // Start from row 2
      
      try {
        // Fetch dividend count for this ticker
        // Stage 4: CF-Native endpoint (no API key required)
        const response = UrlFetchApp.fetch(`${DIVIDEND_API_BASE_URL}/dividends/${ticker}`);
        
        if (response.getResponseCode() === 200) {
          const data = JSON.parse(response.getContentText());
          sheet.getRange(rowNum, 3).setValue(`${data.totalRecords} records`);
          console.log(`${ticker}: ${data.totalRecords} dividend records`);
        } else {
          sheet.getRange(rowNum, 3).setValue('Error fetching');
        }
        
      } catch (error) {
        console.log(`Error refreshing ${ticker}: ${error.toString()}`);
        sheet.getRange(rowNum, 3).setValue('Refresh failed');
      }
      
      // Small delay between API calls
      Utilities.sleep(500);
    }
    
    console.log('Dividend data refresh completed');
    
  } catch (error) {
    console.log('Error refreshing dividend data: ' + error.toString());
  }
}

/**
 * NAMESPACED: Manual function to refresh dividend data
 */
function DividendDash_manualRefreshData() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const tickers = DividendDash_getTickersFromSheet(sheet);
    
    if (tickers.length === 0) {
      SpreadsheetApp.getUi().alert('No tickers found in sheet.');
      return;
    }
    
    DividendDash_refreshDividendDataInSheet(tickers);
    SpreadsheetApp.getUi().alert(`Refreshed dividend data for ${tickers.length} tickers.`);
    
  } catch (error) {
    console.log('Error in manual refresh: ' + error.toString());
    SpreadsheetApp.getUi().alert('Error refreshing data: ' + error.message);
  }
}

/**
 * NAMESPACED: Stop completion monitoring and cleanup triggers
 */
function DividendDash_stopCompletionMonitoring() {
  try {
    const triggerId = PropertiesService.getScriptProperties().getProperty('DIVIDEND_COMPLETION_TRIGGER');
    
    if (triggerId) {
      const triggers = ScriptApp.getProjectTriggers();
      for (const trigger of triggers) {
        if (trigger.getUniqueId() === triggerId) {
          ScriptApp.deleteTrigger(trigger);
          break;
        }
      }
    }
    
    // Cleanup properties
    PropertiesService.getScriptProperties().deleteProperty('DIVIDEND_COMPLETION_TRIGGER');
    PropertiesService.getScriptProperties().deleteProperty('DIVIDEND_MONITORING_START');
    
  } catch (error) {
    console.log('Error stopping completion monitoring: ' + error.toString());
  }
}

/**
 * NAMESPACED: Extract ticker symbols from the sheet
 */
function DividendDash_getTickersFromSheet(sheet) {
  const tickers = [];
  
  try {
    const range = sheet.getRange('A:A');
    const values = range.getValues();
    
    for (let i = 1; i < values.length; i++) {
      const value = values[i][0];
      if (value && typeof value === 'string' && value.trim() !== '') {
        const ticker = value.toString().trim().toUpperCase();
        
        if (/^[A-Z.]+$/.test(ticker) && ticker.length <= 10) {
          tickers.push(ticker);
        }
      }
    }
    
    return [...new Set(tickers)];
    
  } catch (error) {
    console.log('Error extracting tickers: ' + error.toString());
    return [];
  }
}

/**
 * NAMESPACED: Get API key for user
 */
function DividendDash_getUserApiKey(userEmail) {
  if (userEmail.includes('demo') || userEmail.includes('test')) {
    return DIVIDEND_API_KEYS.demo;
  }
  return DIVIDEND_API_KEYS.demo; // Default
}

/**
 * NAMESPACED: Get last updated timestamp
 */
function DividendDash_getLastUpdatedTimestamp(sheet) {
  try {
    const timestampCell = sheet.getRange('B1');
    const timestamp = timestampCell.getValue();
    
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    return null;
  } catch (error) {
    console.log('Error getting timestamp: ' + error.toString());
    return null;
  }
}

/**
 * NAMESPACED: Build dashboard URL with parameters (Google Apps Script compatible)
 */
function DividendDash_buildDashboardUrl(tickers, lastUpdated, apiKey, userEmail) {
  // Manual URL parameter building (URLSearchParams not available in Apps Script)
  const params = [];
  
  params.push('tickers=' + encodeURIComponent(JSON.stringify(tickers)));
  params.push('apiKey=' + encodeURIComponent(apiKey));
  
  if (lastUpdated) {
    params.push('lastUpdated=' + encodeURIComponent(lastUpdated));
  }
  
  params.push('user=' + encodeURIComponent(Utilities.base64Encode(userEmail)));
  params.push('session=' + encodeURIComponent(Date.now().toString()));
  
  return `${DIVIDEND_DASHBOARD_URL}?${params.join('&')}`;
}


/**
 * NAMESPACED: Add dashboard URL to dividends_data sheet
 */
function DividendDash_addUrlToSheet(url) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName('dividends_data');
    
    // Create dividends_data sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet('dividends_data');
    }
    
    // Add the URL to cell A1
    sheet.getRange('A1').setValue(url);
    sheet.getRange('A1').setFontColor('#1a73e8').setFontWeight('bold');
    
    // Set column width to fit URL
    sheet.setColumnWidth(1, 500);
    
    // Navigate to the sheet
    spreadsheet.setActiveSheet(sheet);
    
  } catch (error) {
    console.error('Error adding URL to sheet:', error);
  }
}

/**
 * NAMESPACED: Mask API key for display
 */
function DividendDash_maskApiKey(apiKey) {
  if (apiKey.length <= 8) return apiKey;
  return apiKey.substring(0, 6) + '***' + apiKey.substring(apiKey.length - 4);
}

