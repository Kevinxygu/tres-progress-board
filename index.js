// main function to run
const main = () => {
  console.log("[processRawDataToUpload] Starting data processing...");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('Raw Data + Responses');
  const uploadSheet = ss.getSheetByName('Upload');
  
  if (!rawSheet) {
    console.error("[processRawDataToUpload] Sheet 'Raw Data + Responses' not found!");
    return;
  }
  
  if (!uploadSheet) {
    console.error("[processRawDataToUpload] Sheet 'Upload' not found!");
    return;
  }
  
  // Get raw data
  const rawData = rawSheet.getDataRange().getValues();
  const [rawHeaders, ...rawRows] = rawData;
  
  console.log("[processRawDataToUpload] Raw data headers:", rawHeaders);
  console.log("[processRawDataToUpload] Processing", rawRows.length, "rows");
  
  // Clear upload sheet before writing new data
  const uploadRange = uploadSheet.getDataRange();
  if (uploadRange.getNumRows() > 1) {
    uploadSheet.getRange(2, 1, uploadRange.getNumRows() - 1, uploadRange.getNumColumns()).clearContent();
  }
  
  // process each row
  const uploadData = [];
  rawRows.forEach((row, index) => {
    const processedRow = processRawRow(rawHeaders, row, index + 1);
    if (processedRow) {
      uploadData.push(processedRow);
    }
  });
  
  // write to upload
  if (uploadData.length > 0) {
    const uploadHeaders = ['ID', 'Type', 'Title', 'Request For', 'Team', 'Notes', 'Due Date', 'Urgency', 'Status'];
    
    // double-check headers
    if (uploadSheet.getRange(1, 1).getValue() !== 'ID') {
      uploadSheet.getRange(1, 1, 1, uploadHeaders.length).setValues([uploadHeaders]);
    }
    
    // write the data
    uploadSheet.getRange(2, 1, uploadData.length, uploadHeaders.length).setValues(uploadData);
    console.log("[processRawDataToUpload] Successfully wrote", uploadData.length, "rows to Upload sheet");
  }
}

// FUNCTION: process an individual raw data row
const processRawRow = (headers, row, rowIndex) => {
  try {
    // create object from headers and row data
    const data = headers.reduce((obj, header, i) => {
      obj[header] = row[i] || '';
      return obj;
    }, {});
    
    // set status as reimbursement / invoice
    const hasReimbursementData = data['What request are you making?'] == 'Reimbursement';
    const hasInvoiceData = data['What request are you making?'] == 'Sponsor Invoice';
    
    let type, title, team;
    
    if (hasReimbursementData && !hasInvoiceData) {
      type = 'Reimbursement';
      title = data['Please give a quick description of what you bought. If it\'s part of the budget sheet, please provide the line number too'] || data[Object.keys(data)[3]] || ''; // Column D equivalent
      team = data[Object.keys(data)[4]] || ''; // Column E equivalent
    } else if (hasInvoiceData) {
      type = 'Invoice';
      title = data['Company'] || data[Object.keys(data)[9]] || ''; // Column J equivalent
      team = 'Spocos';
    } else {
      console.log(`[processRawRow] Row ${rowIndex}: Unable to determine type, skipping`);
      return null;
    }
    
    // extract request
    const requestFor = data['Full Name'] || data[Object.keys(data)[1]] || '';
    
    return [
      rowIndex,           // ID
      type,               // Type
      title,              // Title
      requestFor,         // Request For
      team,               // Team
      '',                 // Notes (manual input)
      '',                 // Due Date (manual input)
      '',                 // Urgency (manual input)
      ''                  // Status (manual input)
    ];
    
  } catch (error) {
    console.error(`[processRawRow] Error processing row ${rowIndex}:`, error);
    return null;
  }
}

// set up automatic processing trigger
const setupAutoProcess = () => {
  // Delete existing triggers first
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processRawDataToUpload') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // create new trigger for automatic processing
  ScriptApp.newTrigger('processRawDataToUpload')
    .timeBased()
    .everyHours(1) // Process every hour
    .create();
    
  console.log("[setupAutoProcess] Automatic processing trigger created - runs every hour");
}

// debugging for raw data
const debugRawData = () => {
  console.log("[debugRawData] Checking raw data structure...");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('Raw Data + Responses');
  
  if (!rawSheet) {
    console.error("[debugRawData] Sheet 'Raw Data + Responses' not found!");
    return;
  }
  
  const rawData = rawSheet.getDataRange().getValues();
  const [rawHeaders, ...rawRows] = rawData;
  
  console.log("[debugRawData] Headers found:", rawHeaders);
  console.log("[debugRawData] First data row:", rawRows[0]);
  console.log("[debugRawData] Total rows:", rawRows.length);
  
  // show sample of how the data will be processed
  if (rawRows.length > 0) {
    const sampleProcessed = processRawRow(rawHeaders, rawRows[0], 1);
    console.log("[debugRawData] Sample processed row:", sampleProcessed);
  }
}

// debugging for upload sheet
const debugUploadSheet = () => {
  console.log("[debugUploadSheet] Checking Upload sheet data...");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const uploadSheet = ss.getSheetByName('Upload');
  
  if (!uploadSheet) {
    console.error("[debugUploadSheet] Upload sheet not found!");
    return;
  }
  
  const data = uploadSheet.getDataRange().getValues();
  console.log("[debugUploadSheet] Upload sheet data:");
  data.forEach((row, index) => {
    console.log(`Row ${index}:`, row);
  });
}

// Create a summary report
const createSummaryReport = () => {
  console.log("[createSummaryReport] Creating processing summary...");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const uploadSheet = ss.getSheetByName('Upload');
  
  if (!uploadSheet) {
    console.error("[createSummaryReport] Upload sheet not found!");
    return;
  }
  
  const data = uploadSheet.getDataRange().getValues();
  const [headers, ...rows] = data;
  
  // Count by type
  const typeCounts = {};
  const teamCounts = {};
  
  rows.forEach(row => {
    const type = row[1]; // Type column
    const team = row[4]; // Team column
    
    if (type) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    if (team) {
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    }
  });
  
  console.log("[createSummaryReport] Processing Summary:");
  console.log("- Total entries:", rows.length);
  console.log("- By type:", typeCounts);
  console.log("- By team:", teamCounts);
  
  return {
    totalEntries: rows.length,
    byType: typeCounts,
    byTeam: teamCounts
  };
}