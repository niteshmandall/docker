const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const readline = require('readline');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

async function authenticate() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('Error: credentials.json not found in ' + CREDENTIALS_PATH);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const config = credentials.installed || credentials.web;

  if (!config) {
    console.error('Error: Invalid credentials.json format.');
    process.exit(1);
  }

  const redirectUri = process.env.OAUTH_REDIRECT_URI || (config.redirect_uris && config.redirect_uris[0]) || 'http://localhost:3000/oauth2callback';

  console.log(`Using redirect URI: ${redirectUri}`);

  const oauth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n======================================================');
  console.log('AUTHORIZE GOOGLE GMAIL ACCESS:');
  console.log('1. Open this URL in your browser:');
  console.log(`\n${authUrl}\n`);
  console.log('2. Log in with your Google account.');
  console.log('======================================================\n');

  // Start a local web server to catch redirect if redirectUri is localhost
  const parsedRedirect = url.parse(redirectUri);
  let server = null;

  if (parsedRedirect.hostname === 'localhost' || parsedRedirect.hostname === '127.0.0.1') {
    const port = parsedRedirect.port ? parseInt(parsedRedirect.port) : 3000;
    server = http.createServer(async (req, res) => {
      try {
        const reqUrl = url.parse(req.url, true);
        if (reqUrl.pathname === parsedRedirect.pathname || reqUrl.pathname === '/') {
          const code = reqUrl.query.code;
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication successful!</h1><p>You can close this tab and return to your terminal.</p>');

            const { tokens } = await oauth2Client.getToken(code);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log('\n[SUCCESS] Token stored to ' + TOKEN_PATH);
            process.exit(0);
          }
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Authentication error: ' + err.message);
        console.error('Error exchanging code:', err);
      }
    });

    server.listen(port, () => {
      console.log(`Local callback server listening on port ${port}...`);
    });
  }

  // Also support manual paste in case redirect goes somewhere else or port is blocked
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Or paste the "code" query parameter (or full redirected URL) here: ', async (input) => {
    try {
      let code = input.trim();
      if (code.includes('code=')) {
        const parsed = url.parse(code, true);
        code = parsed.query.code || code;
      }
      const { tokens } = await oauth2Client.getToken(code);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('\n[SUCCESS] Token stored to ' + TOKEN_PATH);
      if (server) server.close();
      process.exit(0);
    } catch (err) {
      console.error('\n[Error exchanging code]:', err.message);
      process.exit(1);
    }
  });
}

authenticate();
