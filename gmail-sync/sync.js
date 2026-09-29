const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const FIREFLY_URL = process.env.FIREFLY_URL || 'http://localhost';
const FIREFLY_TOKEN = process.env.FIREFLY_TOKEN || '';

// Account IDs in Firefly III
const ACCOUNT_HDFC = 1;
const ACCOUNT_DCB = 5;

function decodeBase64(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function extractBodyText(payload) {
  let text = '';
  if (payload.body && payload.body.data) {
    text += decodeBase64(payload.body.data);
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        text += '\n' + decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
        text += '\n' + decodeBase64(part.body.data);
      } else if (part.parts) {
        text += '\n' + extractBodyText(part);
      }
    }
  }
  // Strip HTML tags and replace HTML entities
  return text
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

function parseBankEmail(from, subject, body, dateStr, msgId) {
  const cleanBody = body.replace(/\s+/g, ' ');

  // ----------------------------------------------------
  // 1. HDFC Bank UPI / Debit
  // "Rs.10000.00 is debited from your account ending 0882 towards VPA 6203171317@superyes ... on 29-09-26"
  // ----------------------------------------------------
  const hdfcDebitMatch = cleanBody.match(/(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{2})?)\s+(?:has been|is)\s+debited\s+from\s+your\s+account\s*(?:ending\s+([0-9]+)|(?:\*\*)?([0-9]+))?/i);
  if (hdfcDebitMatch) {
    const amount = parseFloat(hdfcDebitMatch[1].replace(/,/g, ''));
    let payee = 'Expense';
    const toMatch = cleanBody.match(/towards\s+VPA\s+([^\s]+)/i);
    const toGenMatch = cleanBody.match(/to\s+(?:VPA\s+)?([A-Za-z0-9._@\- ]+?)(?:\s+on|\s+towards|\.|\r|\n)/i);
    if (toMatch && toMatch[1]) payee = toMatch[1].trim();
    else if (toGenMatch && toGenMatch[1]) payee = toGenMatch[1].trim();

    return {
      type: 'withdrawal',
      date: dateStr,
      amount: amount.toFixed(2),
      description: payee,
      accountId: ACCOUNT_HDFC,
      notes: `HDFC Debit alert. ${subject}`,
      external_id: `gmail_${msgId}`,
    };
  }

  // ----------------------------------------------------
  // 4. HDFC Credit Card Spend
  // ----------------------------------------------------
  const hdfcCcMatch = cleanBody.match(/(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{2})?)\s+(?:has been|was)?\s*spent\s+on\s+your\s+HDFC\s+Bank\s+Credit\s+Card\s+ending\s+([0-9]+)\s+at\s+([A-Za-z0-9._\- ]+?)\s+on/i);
  if (hdfcCcMatch) {
    const amount = parseFloat(hdfcCcMatch[1].replace(/,/g, ''));
    return {
      type: 'withdrawal',
      date: dateStr,
      amount: amount.toFixed(2),
      description: hdfcCcMatch[3].trim(),
      accountId: ACCOUNT_HDFC,
      notes: `HDFC Credit Card Spend ending in ${hdfcCcMatch[2]}`,
      external_id: `gmail_${msgId}`,
    };
  }

  // ----------------------------------------------------
  // 5. HDFC Salary / Account Credit
  // ----------------------------------------------------
  const hdfcCreditMatch = cleanBody.match(/(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{2})?).*?(?:credited|deposited|received|added)/i) || cleanBody.match(/(?:credited|deposited|received|added).*?(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{2})?)/i) || subject.match(/(?:credit|deposit|receive).*?(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (hdfcCreditMatch) {
    const amount = parseFloat(hdfcCreditMatch[1].replace(/,/g, ''));
    let source = 'Inward Credit / Salary';
    const byMatch = cleanBody.match(/by\s+([A-Za-z0-9._\- ]+?)(?:\s+on|\.|\r|\n)/i);
    if (byMatch && byMatch[1].trim()) source = byMatch[1].trim();

    return {
      type: 'deposit',
      date: dateStr,
      amount: amount.toFixed(2),
      description: source,
      accountId: ACCOUNT_HDFC,
      notes: `HDFC Credit Alert: ${subject}`,
      external_id: `gmail_${msgId}`,
    };
  }

  return null;
}

// Push to Firefly III REST API
async function pushToFirefly(parsedTx) {
  if (!FIREFLY_TOKEN) {
    console.warn('[Firefly III] No FIREFLY_TOKEN provided. Skipping API push.');
    return false;
  }

  const payload = {
    error_if_duplicate_hash: true,
    apply_rules: true,
    transactions: [
      {
        type: parsedTx.type,
        date: parsedTx.date,
        amount: parsedTx.amount,
        description: parsedTx.description,
        source_id: parsedTx.type === 'withdrawal' ? parsedTx.accountId : undefined,
        destination_id: parsedTx.type === 'deposit' ? parsedTx.accountId : undefined,
        notes: parsedTx.notes,
        external_id: parsedTx.external_id,
      },
    ],
  };

  try {
    const res = await fetch(`${FIREFLY_URL}/api/v1/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIREFLY_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 201) {
      console.log(`[Firefly III Synced] ₹${parsedTx.amount} | ${parsedTx.type} -> ${parsedTx.description}`);
      return true;
    } else if (res.status === 422) {
      console.log(`[Firefly III] Skipped duplicate/existing: ${parsedTx.description} (₹${parsedTx.amount})`);
      return false;
    } else {
      const errText = await res.text();
      console.error(`[Firefly III Error ${res.status}]:`, errText);
      return false;
    }
  } catch (err) {
    console.error('[Firefly III Connection Error]:', err.message);
    return false;
  }
}

async function runSync(days = 14) {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('No token.json found.');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const config = credentials.installed || credentials.web;
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  const auth = new google.auth.OAuth2(config.client_id, config.client_secret);
  auth.setCredentials(token);

  const gmail = google.gmail({ version: 'v1', auth });

  console.log(`[Gmail Sync] Searching for bank alerts from the past ${days} days...`);
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `from:(hdfcbank.bank.in OR hdfcbank.net) newer_than:${days}d`,
    maxResults: 100,
  });

  const messages = res.data.messages || [];
  console.log(`[Gmail Sync] Found ${messages.length} potential bank transaction emails.`);

  let syncedCount = 0;
  for (const item of messages) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: item.id,
      format: 'full',
    });

    const headers = msg.data.payload.headers || [];
    const from = (headers.find(h => h.name.toLowerCase() === 'from') || {}).value || '';
    const subject = (headers.find(h => h.name.toLowerCase() === 'subject') || {}).value || '';
    const dateHeader = (headers.find(h => h.name.toLowerCase() === 'date') || {}).value || '';
    const dateStr = dateHeader ? new Date(dateHeader).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const bodyText = extractBodyText(msg.data.payload);
    const parsed = parseBankEmail(from, subject, bodyText, dateStr, item.id);

    if (parsed) {
      const success = await pushToFirefly(parsed);
      if (success) syncedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`[Sync Finished] Processed ${messages.length} messages. Newly added to Firefly III: ${syncedCount}`);
  console.log(`========================================\n`);
}

module.exports = { runSync, parseBankEmail };

if (require.main === module) {
  runSync(14).catch(console.error);
}
