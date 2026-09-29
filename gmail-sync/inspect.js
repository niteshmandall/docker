const fs = require('fs');
const { google } = require('googleapis');

const creds = JSON.parse(fs.readFileSync('credentials.json')).web;
const token = JSON.parse(fs.readFileSync('token.json'));
const auth = new google.auth.OAuth2(creds.client_id, creds.client_secret);
auth.setCredentials(token);

const gmail = google.gmail({ version: 'v1', auth });

async function inspect() {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'debited OR credited OR spent',
    maxResults: 10,
  });

  console.log('Found messages:', res.data.messages ? res.data.messages.length : 0);

  for (const m of (res.data.messages || []).slice(0, 8)) {
    const d = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'metadata',
    });
    const headers = d.data.payload.headers;
    const sub = headers.find(h => h.name.toLowerCase() === 'subject')?.value;
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value;
    const date = headers.find(h => h.name.toLowerCase() === 'date')?.value;
    console.log({ from, sub, date, id: m.id });
  }
}

inspect().catch(console.error);
