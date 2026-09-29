const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

async function exchange(code, redirectUri = 'http://localhost:3000/oauth2callback') {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const config = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('[SUCCESS] OAuth tokens successfully retrieved and stored to token.json!');
    console.log('Refresh token present:', !!tokens.refresh_token);
  } catch (err) {
    console.error('[Error exchanging code]:', err.message);
    process.exit(1);
  }
}

const inputCode = process.argv[2];
const customRedirect = process.argv[3];

if (!inputCode) {
  console.log('Usage: node exchange.js "<code>" [redirect_uri]');
  process.exit(1);
}

// Clean up input if full URL was pasted
let code = inputCode.trim();
if (code.includes('code=')) {
  const params = new URLSearchParams(code.split('?')[1] || code);
  code = params.get('code') || code;
}

exchange(code, customRedirect);
