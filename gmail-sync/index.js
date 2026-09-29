const { runSync } = require('./sync.js');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10);
const PORT = 3000;

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function getOauth2Client() {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const config = credentials.installed || credentials.web;
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    'http://localhost:3000/oauth2callback'
  );
}

// Background sync loop
setInterval(async () => {
  try {
    await runSync();
  } catch (err) {
    console.error('Periodic sync error:', err);
  }
}, INTERVAL_MINUTES * 60 * 1000);

const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);

  if (req.method === 'GET' && reqUrl.pathname === '/') {
    const hasCredentials = fs.existsSync(CREDENTIALS_PATH);
    const hasToken = fs.existsSync(TOKEN_PATH);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Sync UI</title>
        <style>
          body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .container { background: #1e293b; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 100%; }
          h1 { margin-top: 0; font-size: 24px; color: #38bdf8; }
          p { color: #94a3b8; line-height: 1.5; margin-bottom: 30px; }
          .btn { display: inline-block; padding: 14px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; cursor: pointer; border: none; transition: all 0.2s; width: 100%; box-sizing: border-box; margin-bottom: 15px; font-size: 16px; }
          .btn-google { background: #ffffff; color: #475569; }
          .btn-google:hover { background: #f1f5f9; }
          .btn-sync { background: #3b82f6; color: white; }
          .btn-sync:hover { background: #2563eb; }
          .btn-disabled { background: #334155; color: #64748b; cursor: not-allowed; }
          .status { font-size: 14px; margin-top: 10px; color: #10b981; }
        </style>
        <script>
          async function triggerSync() {
            const btn = document.getElementById('syncBtn');
            const msg = document.getElementById('statusMsg');
            const days = document.getElementById('daysSelect') ? document.getElementById('daysSelect').value : 14;
            btn.innerText = 'Syncing...';
            btn.classList.add('btn-disabled');
            try {
              const res = await fetch('/sync?days=' + days, { method: 'POST' });
              const result = await res.text();
              msg.innerText = result;
              msg.style.color = '#10b981';
            } catch (err) {
              msg.innerText = 'Error syncing. Check container logs.';
              msg.style.color = '#ef4444';
            }
            btn.innerText = 'Sync Now';
            btn.classList.remove('btn-disabled');
          }
        </script>
      </head>
      <body>
        <div class="container">
          <h1>Gmail Sync Control</h1>
          <p>Connect your Google account and manually trigger transaction syncs to Firefly III.</p>
          
          ${hasCredentials ? 
            `<a class="btn btn-google" href="/connect">
               ${hasToken ? 'Reconnect Google Account' : 'Connect Google Account'}
             </a>` : 
            `<p style="color:#ef4444;">credentials.json missing!</p>`
          }

          <div style="margin-bottom: 20px;">
            <label for="daysSelect" style="color:#94a3b8; font-size: 14px;">Time Filter:</label>
            <select id="daysSelect" style="padding: 8px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; margin-left: 10px;">
              <option value="7">Last 7 Days</option>
              <option value="14" selected>Last 14 Days</option>
              <option value="30">Last 1 Month</option>
              <option value="90">Last 3 Months</option>
              <option value="180">Last 6 Months</option>
              <option value="365">Last 1 Year</option>
            </select>
          </div>
          
          <button id="syncBtn" class="btn btn-sync ${!hasToken ? 'btn-disabled' : ''}" 
                  onclick="triggerSync()" ${!hasToken ? 'disabled' : ''}>
            Sync Now
          </button>
          
          <div id="statusMsg" class="status"></div>
        </div>
      </body>
      </html>
    `);
  } 
  else if (req.method === 'GET' && reqUrl.pathname === '/connect') {
    const oauth2Client = getOauth2Client();
    if (!oauth2Client) {
      res.writeHead(400);
      res.end('credentials.json missing');
      return;
    }
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
    res.writeHead(302, { Location: authUrl });
    res.end();
  }
  else if (req.method === 'GET' && reqUrl.pathname === '/oauth2callback') {
    const code = reqUrl.query.code;
    if (code) {
      try {
        const oauth2Client = getOauth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        res.writeHead(302, { Location: '/' });
        res.end();
      } catch (err) {
        res.writeHead(500);
        res.end('Error retrieving tokens: ' + err.message);
      }
    } else {
      res.writeHead(400);
      res.end('No code provided in callback');
    }
  }
  else if (req.method === 'POST' && reqUrl.pathname === '/sync') {
    try {
      const days = parseInt(reqUrl.query.days, 10) || 14;
      await runSync(days);
      res.writeHead(200);
      res.end('Sync completed successfully!');
    } catch (err) {
      res.writeHead(500);
      res.end('Sync failed: ' + err.message);
    }
  }
  else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Web UI listening on http://0.0.0.0:${PORT}`);
  console.log(`Background polling also running every ${INTERVAL_MINUTES} minutes.`);
});
