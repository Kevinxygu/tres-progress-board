// global values
const NOTION_SECRET_KEY = "HELLO"; // internal integration secret
const PAGE_ID = "WORLD"; // part of the URL after page name
const NOTION_VERSION = "2022-06-28";

// Read sheet + upload into notion
const syncSheetToNotion = () => {
  console.log("[syncSheetToNotion] Starting sync…");
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Requests');
  if (!sheet) {
    console.error("[syncSheetToNotion] Sheet ‘Requests’ not found!");
    return;
  }
  const dataRange = sheet.getDataRange().getValues();
  console.log("[syncSheetToNotion] Retrieved data, rows:", dataRange.length - 1);
  const [headers, ...rows] = dataRange;

  rows.forEach((row, idx) => {
    console.log(`[syncSheetToNotion] Row #${idx + 1}:`, row);
    const data = headers.reduce((obj, h, i) => { obj[h] = row[i]; return obj; }, {});
    upsertNotionPage(data);
  });
}

// If page w ID exists, update it ELSE create a new one
const upsertNotionPage = (data) => {
  console.log("[upsertNotionPage] Data to upsert:", data);
  const queryUrl = `https://api.notion.com/v1/databases/${PAGE_ID}/query`;
  const queryOpts = {
    method:  'post',
    headers: defaultHeaders(),
    payload: JSON.stringify({
      filter: {
        property: 'ID',
        number:   { equals: data.ID }
      }
    }),
    muteHttpExceptions: true
  };
  console.log("[upsertNotionPage] Querying Notion:", queryUrl, queryOpts.payload);

  let queryResp;
  try {
    queryResp = UrlFetchApp.fetch(queryUrl, queryOpts);
  } catch (err) {
    console.error("[upsertNotionPage] fetch(query) failed:", err);
    return;
  }

  const code = queryResp.getResponseCode();
  const body = queryResp.getContentText();
  console.log(`[upsertNotionPage] Query response code: ${code}`);
  console.log("[upsertNotionPage] Query response body:", body);

  let results = [];
  try {
    results = JSON.parse(body).results || [];
  } catch (err) {
    console.error("[upsertNotionPage] JSON.parse failed:", err);
    return;
  }

  if (results.length) {
    console.log("[upsertNotionPage] Found existing page, updating:", results[0].id);
    updateNotionPage(results[0].id, data);
  } else {
    console.log("[upsertNotionPage] No page found, creating a new one");
    createNotionPage(data);
  }
}

// helper function for new page
const createNotionPage = (data) => {
  const url = 'https://api.notion.com/v1/pages';
  const payload = {
    parent:     { database_id: PAGE_ID },
    properties: buildProperties(data)
  };
  const opts = {
    method:  'post',
    headers: defaultHeaders(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  console.log("[createNotionPage] URL:", url);
  console.log("[createNotionPage] Payload:", opts.payload);

  let resp;
  try {
    resp = UrlFetchApp.fetch(url, opts);
  } catch (err) {
    console.error("[createNotionPage] fetch(create) failed:", err);
    return;
  }

  console.log(`[createNotionPage] Response code: ${resp.getResponseCode()}`);
  console.log("[createNotionPage] Response body:", resp.getContentText());
}

// update existing page
const updateNotionPage = (pageId, data) => {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const payload = { properties: buildProperties(data) };
  const opts = {
    method:  'patch',
    headers: defaultHeaders(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  console.log("[updateNotionPage] URL:", url);
  console.log("[updateNotionPage] Payload:", opts.payload);

  let resp;
  try {
    resp = UrlFetchApp.fetch(url, opts);
  } catch (err) {
    console.error("[updateNotionPage] fetch(update) failed:", err);
    return;
  }

  console.log(`[updateNotionPage] Response code: ${resp.getResponseCode()}`);
  console.log("[updateNotionPage] Response body:", resp.getContentText());
}

// Build notion params from sheets
const buildProperties = (d) => {
  // no change here
  return {
    'ID':          { number: d.ID },
    'Title':       { title:       [{ text: { content: d.Title }}] },
    'Type':        { select:      { name: d.Type }},
    'Request For': { rich_text:   [{ text: { content: d['Request For'] }}] },
    'Team':        { rich_text:   [{ text: { content: d.Team }}] },
    'Description': { rich_text:   [{ text: { content: d.Description }}] },
    'Amount':      { number:      parseFloat(d.Amount) || 0 },
    'Due Date':    { date:        { start: new Date(d['Due Date']).toISOString() }},
    'Urgency':     { select:      { name: d.Urgency }},
    'Status':      { select:      { name: d.Status }}
  };
}

// Include default headers
const defaultHeaders = () => {
  const headers = {
    'Authorization': `Bearer ${NOTION_SECRET_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type':  'application/json'
  };
  console.log("[defaultHeaders] Using headers:", headers);
  return headers;
}
